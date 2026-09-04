import { DateTime } from "luxon";
import { calendarAddMonths, calendarAddYears, type Ymd } from "./mysql-date";
import type { ExpirationIntervalId } from "./settings-types";

export function computeExpiresAt(
  occurredAt: Date,
  timezone: string,
  interval: ExpirationIntervalId,
): Date {
  const local = DateTime.fromJSDate(occurredAt, { zone: "utc" }).setZone(timezone);
  if (!local.isValid) {
    throw new Error(`Invalid occurred_at or timezone (${timezone})`);
  }
  const earnDate: Ymd = { year: local.year, month: local.month, day: local.day };
  const anniversary =
    interval === "1_year" ? calendarAddYears(earnDate, 1) : calendarAddMonths(earnDate, 6);
  const expireLocal = DateTime.fromObject(
    {
      year: anniversary.year,
      month: anniversary.month,
      day: anniversary.day,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone },
  ).plus({ days: 1 });
  if (!expireLocal.isValid) {
    throw new Error("Could not compute expires_at");
  }
  return expireLocal.toUTC().toJSDate();
}

export function lookbackThreshold(now: Date, period: "3_months" | "6_months" | "1_year"): Date {
  const months = period === "3_months" ? 3 : period === "6_months" ? 6 : 12;
  const utc = DateTime.fromJSDate(now, { zone: "utc" });
  const shifted = calendarAddMonths({ year: utc.year, month: utc.month, day: utc.day }, -months);
  return utc
    .set({ year: shifted.year, month: shifted.month, day: shifted.day })
    .toJSDate();
}

export function parseOccurredAt(input: string, timezone: string): Date {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("occurred_at is required");
  if (/Z$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const dt = DateTime.fromISO(trimmed, { setZone: true });
    if (!dt.isValid) throw new Error("Invalid occurred_at");
    return dt.toUTC().toJSDate();
  }
  const dt = DateTime.fromISO(trimmed, { zone: timezone });
  if (!dt.isValid) throw new Error("Invalid occurred_at");
  return dt.toUTC().toJSDate();
}

export function formatDateTime(date: Date, timezone: string, withSeconds = true): string {
  const dt = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone);
  return dt.toFormat(withSeconds ? "dd LLL yyyy, HH:mm:ss" : "dd LLL yyyy, HH:mm");
}

export function formatDate(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone).toFormat("dd LLL yyyy");
}

export function formatExpirePhrase(date: Date, timezone: string): string {
  const dt = DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone);
  return `${dt.toFormat("dd LLL yyyy")} at ${dt.toFormat("HH:mm")}`;
}

export function toDatetimeLocalValue(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone).toFormat("yyyy-LL-dd'T'HH:mm");
}

export function localDateKey(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(timezone).toFormat("yyyy-LL-dd");
}

export function nowInZone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}
