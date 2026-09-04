import { describe, expect, it } from "vitest";
import { parseSetupBody } from "./validate";

const validTiers = {
  lookbackPeriod: "1_year" as const,
  rules: [
    { name: "Bronze", minPoints: 0, isBase: true },
    { name: "Silver", minPoints: 250, isBase: false },
    { name: "Gold", minPoints: 501, isBase: false },
    { name: "Platinum", minPoints: 1000, isBase: false },
  ],
};

describe("parseSetupBody", () => {
  it("accepts allow-listed env flags and program settings", () => {
    const parsed = parseSetupBody({
      request_id: "req-1",
      changes: {
        enable_cancel_earn: true,
        enable_cancel_redeem: false,
        expiration_interval: "1_year",
        timezone: "Asia/Manila",
        tiers: validTiers,
      },
    });
    expect(parsed.ok).toBe(true);
  });

  it("accepts a single change", () => {
    const parsed = parseSetupBody({
      request_id: "req-2",
      changes: { enable_cancel_redeem: true },
    });
    expect(parsed.ok).toBe(true);
  });

  it("accepts dry_run without applying extra fields", () => {
    const parsed = parseSetupBody({
      request_id: "manual-dry-run-001",
      dry_run: true,
      changes: { enable_cancel_earn: true, expiration_interval: "1_year" },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.dry_run).toBe(true);
  });

  it("rejects an empty changes object", () => {
    const parsed = parseSetupBody({ request_id: "req-3", changes: {} });
    expect(parsed).toEqual({ ok: false, error: "changes must not be empty." });
  });

  it("rejects unknown top-level fields", () => {
    const parsed = parseSetupBody({
      request_id: "req-4",
      changes: { enable_cancel_earn: true },
      extra: true,
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/unknown fields/i);
  });

  it("rejects unknown change fields and env keys", () => {
    const parsed = parseSetupBody({
      request_id: "req-5",
      changes: { enable_cancel_earn: true, DATABASE_URL: "mysql://x" },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/unknown fields/i);
  });

  it("rejects a non-boolean cancel flag", () => {
    const parsed = parseSetupBody({
      request_id: "req-6",
      changes: { enable_cancel_redeem: "true" },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/boolean/i);
  });

  it("rejects unsupported expiration intervals", () => {
    const parsed = parseSetupBody({
      request_id: "req-7",
      changes: { expiration_interval: "2_years" },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/6_months/i);
  });

  it("rejects an invalid timezone", () => {
    const parsed = parseSetupBody({
      request_id: "req-8",
      changes: { timezone: "Not/A_Zone" },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/timezone|IANA/i);
  });

  it("rejects tier rules that violate program rules", () => {
    const parsed = parseSetupBody({
      request_id: "req-9",
      changes: {
        tiers: {
          lookbackPeriod: "1_year",
          rules: [
            { name: "Bronze", minPoints: 10, isBase: true },
            { name: "Silver", minPoints: 250, isBase: false },
            { name: "Gold", minPoints: 501, isBase: false },
            { name: "Platinum", minPoints: 1000, isBase: false },
          ],
        },
      },
    });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toMatch(/Bronze min/i);
  });
});
