import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { computeExpiresAt, lookbackThreshold } from "./expiration";
import { mysqlAddMonths, mysqlAddYears } from "./mysql-date";
import { normalizePhMobile } from "./phone";
import { resolveTier } from "./tiers";
import { DEFAULT_PROGRAM_SETTINGS, validateProgramSettings } from "./settings-types";
import { nextExpirationFromLots } from "./members";

describe("MySQL DATE_ADD clip", () => {
  it("clips Aug 31 + 6 months to Feb 28 (non-leap)", () => {
    expect(mysqlAddMonths({ year: 2026, month: 8, day: 31 }, 6)).toEqual({
      year: 2027,
      month: 2,
      day: 28,
    });
  });
  it("clips Feb 29 + 1 year to Feb 28", () => {
    expect(mysqlAddYears({ year: 2024, month: 2, day: 29 }, 1)).toEqual({
      year: 2025,
      month: 2,
      day: 28,
    });
  });
});

describe("expiration §8.2", () => {
  const tz = "Asia/Manila";

  function manila(iso: string) {
    return DateTime.fromISO(iso, { zone: tz }).toUTC().toJSDate();
  }

  it("1 year: 26 Aug 2026 14:14:32 → 27 Aug 2027 00:00:00", () => {
    const expires = computeExpiresAt(manila("2026-08-26T14:14:32"), tz, "1_year");
    const local = DateTime.fromJSDate(expires, { zone: "utc" }).setZone(tz);
    expect(local.toFormat("yyyy-LL-dd HH:mm:ss")).toBe("2027-08-27 00:00:00");
  });

  it("6 months: same earn → 27 Feb 2027 00:00:00", () => {
    const expires = computeExpiresAt(manila("2026-08-26T14:14:32"), tz, "6_months");
    const local = DateTime.fromJSDate(expires, { zone: "utc" }).setZone(tz);
    expect(local.toFormat("yyyy-LL-dd HH:mm:ss")).toBe("2027-02-27 00:00:00");
  });

  it("Aug 31 + 6 months → 1 Mar 2027 00:00:00", () => {
    const expires = computeExpiresAt(manila("2026-08-31T09:00:00"), tz, "6_months");
    const local = DateTime.fromJSDate(expires, { zone: "utc" }).setZone(tz);
    expect(local.toFormat("yyyy-LL-dd HH:mm:ss")).toBe("2027-03-01 00:00:00");
  });

  it("29 Feb 2024 + 1 year → 1 Mar 2025 00:00:00", () => {
    const expires = computeExpiresAt(manila("2024-02-29T18:00:00"), tz, "1_year");
    const local = DateTime.fromJSDate(expires, { zone: "utc" }).setZone(tz);
    expect(local.toFormat("yyyy-LL-dd HH:mm:ss")).toBe("2025-03-01 00:00:00");
  });

  it("ignores clock time of the earn", () => {
    const a = computeExpiresAt(manila("2026-08-26T00:00:01"), tz, "1_year");
    const b = computeExpiresAt(manila("2026-08-26T23:59:59"), tz, "1_year");
    expect(a.getTime()).toBe(b.getTime());
  });
});

describe("cancelled earn expiration regression", () => {
  const now = new Date("2026-08-29T00:00:00.000Z");
  const expiresAt = new Date("2027-08-30T00:00:00.000Z");

  it("reproduces the partial-cancel bug in next expiration", () => {
    expect(
      nextExpirationFromLots(
        [{ originalAmount: 100, remainingAmount: 80, cancelledAmount: 20, expiresAt }],
        now,
        "UTC",
      ),
    ).toEqual({ when: expiresAt.toISOString(), amount: 100 });
  });

  it("skips a fully cancelled earn", () => {
    expect(
      nextExpirationFromLots(
        [{ originalAmount: 100, remainingAmount: 0, cancelledAmount: 100, expiresAt }],
        now,
        "UTC",
      ),
    ).toBeNull();
  });
});

describe("lookback DATE_SUB", () => {
  it("subtracts 3 months clipping end-of-month", () => {
    const now = DateTime.fromISO("2026-08-31T08:00:00", { zone: "utc" }).toJSDate();
    const from = lookbackThreshold(now, "3_months");
    const d = DateTime.fromJSDate(from, { zone: "utc" });
    expect(d.toFormat("yyyy-LL-dd")).toBe("2026-05-31");
  });
});

describe("phone", () => {
  it("normalizes PH mobiles to E.164", () => {
    expect(normalizePhMobile("0917 123 4567")).toBe("+639171234567");
    expect(normalizePhMobile("+63 9171234567")).toBe("+639171234567");
    expect(normalizePhMobile("9171234567")).toBe("+639171234567");
    expect(normalizePhMobile("639171234567")).toBe("+639171234567");
    expect(normalizePhMobile("021234567")).toBeNull();
    expect(normalizePhMobile("08171234567")).toBeNull();
  });
});

describe("tiers", () => {
  const rules = DEFAULT_PROGRAM_SETTINGS.tiers.rules;
  it("800 → Gold, 1000 → Platinum, 500 → Silver", () => {
    expect(resolveTier(800, rules).name).toBe("Gold");
    expect(resolveTier(1000, rules).name).toBe("Platinum");
    expect(resolveTier(500, rules).name).toBe("Silver");
    expect(resolveTier(0, rules).name).toBe("Bronze");
    expect(resolveTier(249, rules).name).toBe("Bronze");
    expect(resolveTier(250, rules).name).toBe("Silver");
    expect(resolveTier(501, rules).name).toBe("Gold");
  });
});

describe("settings validation", () => {
  it("rejects non-increasing mins", () => {
    expect(() =>
      validateProgramSettings({
        ...DEFAULT_PROGRAM_SETTINGS,
        tiers: {
          lookbackPeriod: "1_year",
          rules: [
            { name: "Bronze", minPoints: 0, isBase: true },
            { name: "Silver", minPoints: 250, isBase: false },
            { name: "Gold", minPoints: 250, isBase: false },
            { name: "Platinum", minPoints: 1000, isBase: false },
          ],
        },
      }),
    ).toThrow(/strictly increasing/);
  });

  it("locks bronze at 0", () => {
    expect(() =>
      validateProgramSettings({
        ...DEFAULT_PROGRAM_SETTINGS,
        tiers: {
          lookbackPeriod: "1_year",
          rules: [
            { name: "Bronze", minPoints: 10, isBase: true },
            { name: "Silver", minPoints: 250, isBase: false },
            { name: "Gold", minPoints: 501, isBase: false },
            { name: "Platinum", minPoints: 1000, isBase: false },
          ],
        },
      }),
    ).toThrow(/locked at 0/);
  });
});
