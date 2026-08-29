import type { ProgramSettings, TierRule } from "./settings-types";
import { lookbackLabel } from "./settings-types";

export type TierSnapshot = {
  name: string;
  qualifyingPoints: number;
  lookbackPeriod: ProgramSettings["tiers"]["lookbackPeriod"];
  lookbackLabel: string;
  nextTier: { name: string; pointsNeeded: number } | null;
};

export function resolveTier(qualifyingPoints: number, rules: TierRule[]): TierRule {
  const ordered = [...rules].sort((a, b) => a.minPoints - b.minPoints);
  let current = ordered[0] ?? { name: "Bronze", minPoints: 0, isBase: true };
  for (const rule of ordered) {
    if (qualifyingPoints >= rule.minPoints) current = rule;
  }
  return current;
}

export function tierSnapshot(qualifyingPoints: number, settings: ProgramSettings): TierSnapshot {
  const ordered = [...settings.tiers.rules].sort((a, b) => a.minPoints - b.minPoints);
  const current = resolveTier(qualifyingPoints, ordered);
  const idx = ordered.findIndex((r) => r.name === current.name && r.minPoints === current.minPoints);
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  return {
    name: current.name,
    qualifyingPoints,
    lookbackPeriod: settings.tiers.lookbackPeriod,
    lookbackLabel: lookbackLabel(settings.tiers.lookbackPeriod),
    nextTier: next ? { name: next.name, pointsNeeded: Math.max(0, next.minPoints - qualifyingPoints) } : null,
  };
}

export function tierTone(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("platinum")) return "platinum";
  if (n.includes("gold")) return "gold";
  if (n.includes("silver")) return "silver";
  return "bronze";
}
