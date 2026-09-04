/** Calendar month arithmetic that clips to the last day of a month (no overflow). */

export type Ymd = { year: number; month: number; day: number };

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calendarAddMonths(date: Ymd, months: number): Ymd {
  const idx = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(idx / 12);
  const month = ((idx % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  return { year, month, day };
}

export function calendarAddYears(date: Ymd, years: number): Ymd {
  return calendarAddMonths(date, years * 12);
}
