import type { LookbackPeriodId } from "./settings-types";

export type HistoryRange = "3m" | "6m" | "1y" | "all";

export const HISTORY_PAGE_SIZE = 10;

export type MemberSnapshot = {
  id: number;
  name: string;
  contactNumber: string;
  status: "active" | "inactive";
  createdAt: string;
  timezone: string;
  available: number;
  earnedTotal: number;
  redeemedTotal: number;
  expiredTotal: number;
  unpostedExpired: number;
  tier: {
    name: string;
    qualifyingPoints: number;
    lookbackPeriod: LookbackPeriodId;
    lookbackLabel: string;
    nextTier: { name: string; pointsNeeded: number } | null;
  };
  nextExpiration: { when: string; amount: number } | null;
};

export type MemberChromeData = {
  id: number;
  name: string;
  status: "active" | "inactive";
  available: number;
  earnedTotal: number;
  redeemedTotal: number;
  expiredTotal: number;
  tier: MemberSnapshot["tier"];
};
