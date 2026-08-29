export type ExpirationIntervalId = "6_months" | "1_year";
export type LookbackPeriodId = "3_months" | "6_months" | "1_year";

export type TierRule = {
  name: string;
  minPoints: number;
  isBase: boolean;
};

export type ProgramSettings = {
  schemaVersion: 1;
  expiration: {
    interval: ExpirationIntervalId;
    timezone: string;
  };
  tiers: {
    lookbackPeriod: LookbackPeriodId;
    rules: TierRule[];
  };
};

export const DEFAULT_PROGRAM_SETTINGS: ProgramSettings = {
  schemaVersion: 1,
  expiration: {
    interval: "1_year",
    timezone: "Asia/Manila",
  },
  tiers: {
    lookbackPeriod: "1_year",
    rules: [
      { name: "Bronze", minPoints: 0, isBase: true },
      { name: "Silver", minPoints: 250, isBase: false },
      { name: "Gold", minPoints: 501, isBase: false },
      { name: "Platinum", minPoints: 1000, isBase: false },
    ],
  },
};

const INTERVALS = new Set<ExpirationIntervalId>(["6_months", "1_year"]);
const LOOKBACKS = new Set<LookbackPeriodId>(["3_months", "6_months", "1_year"]);

export function lookbackLabel(period: LookbackPeriodId): string {
  if (period === "3_months") return "last 3 months";
  if (period === "6_months") return "last 6 months";
  return "last 1 year";
}

export function intervalLabel(interval: ExpirationIntervalId): string {
  return interval === "6_months" ? "6 months" : "1 year";
}

export function validateProgramSettings(input: unknown): ProgramSettings {
  if (!input || typeof input !== "object") {
    throw new Error("Settings must be an object.");
  }
  const raw = input as Record<string, unknown>;
  const expiration = raw.expiration as Record<string, unknown> | undefined;
  const tiers = raw.tiers as Record<string, unknown> | undefined;
  if (!expiration || typeof expiration !== "object") throw new Error("expiration is required.");
  if (!tiers || typeof tiers !== "object") throw new Error("tiers is required.");

  const interval = expiration.interval;
  const timezone = expiration.timezone;
  if (interval !== "6_months" && interval !== "1_year") {
    throw new Error("expiration.interval must be 6_months or 1_year.");
  }
  if (typeof timezone !== "string" || !timezone.trim()) {
    throw new Error("expiration.timezone is required.");
  }
  if (!isValidIanaZone(timezone)) {
    throw new Error("expiration.timezone must be a valid IANA name (e.g. Asia/Manila).");
  }

  const lookbackPeriod = tiers.lookbackPeriod;
  if (lookbackPeriod !== "3_months" && lookbackPeriod !== "6_months" && lookbackPeriod !== "1_year") {
    throw new Error("tiers.lookbackPeriod must be 3_months, 6_months, or 1_year.");
  }
  if (!Array.isArray(tiers.rules) || tiers.rules.length !== 4) {
    throw new Error("tiers.rules must have exactly four tiers.");
  }

  const rules: TierRule[] = [];
  const names = new Set<string>();
  for (let i = 0; i < tiers.rules.length; i++) {
    const row = tiers.rules[i] as Record<string, unknown>;
    const name = typeof row?.name === "string" ? row.name.trim() : "";
    if (!name) throw new Error("Each tier needs a non-empty name.");
    if (names.has(name.toLowerCase())) throw new Error("Tier names must be unique.");
    names.add(name.toLowerCase());
    const minPoints = Number(row.minPoints);
    if (!Number.isInteger(minPoints) || minPoints < 0) {
      throw new Error("Each tier min must be an integer ≥ 0.");
    }
    const isBase = i === 0;
    if (isBase && minPoints !== 0) throw new Error("Bronze min is locked at 0.");
    if (!isBase && minPoints < 1) throw new Error("Non-base tier mins must be integers ≥ 1.");
    if (i > 0 && minPoints <= rules[i - 1].minPoints) {
      throw new Error("Tier mins must be strictly increasing.");
    }
    rules.push({ name, minPoints, isBase });
  }

  if (!INTERVALS.has(interval) || !LOOKBACKS.has(lookbackPeriod)) {
    throw new Error("Invalid interval or lookback.");
  }

  return {
    schemaVersion: 1,
    expiration: { interval, timezone: timezone.trim() },
    tiers: { lookbackPeriod, rules },
  };
}

function isValidIanaZone(zone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function exampleTierCopy(settings: ProgramSettings): string {
  const gold = settings.tiers.rules.find((r) => r.minPoints > 250) ?? settings.tiers.rules[2];
  const platinum = settings.tiers.rules[settings.tiers.rules.length - 1];
  const sample = 800;
  const hit = [...settings.tiers.rules].reverse().find((r) => sample >= r.minPoints);
  const period =
    settings.tiers.lookbackPeriod === "3_months"
      ? "3 months"
      : settings.tiers.lookbackPeriod === "6_months"
        ? "6 months"
        : "1 year";
  return `${sample.toLocaleString("en-US")} earned in ${period} → ${hit?.name ?? "Bronze"}. ${platinum.minPoints.toLocaleString("en-US")}+ → ${platinum.name}.`;
}
