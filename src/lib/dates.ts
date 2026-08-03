import { formatInTimeZone } from "date-fns-tz";

/** The calendar date (yyyy-MM-dd) in the given timezone, defaulting to now. */
export function localDate(tz: string, d: Date = new Date()): string {
  try {
    return formatInTimeZone(d, tz, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(d, "UTC", "yyyy-MM-dd");
  }
}

/** The date string one day before the given yyyy-MM-dd (tz-agnostic). */
export function previousDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Weekday (0=Sun … 6=Sat) for a yyyy-MM-dd calendar date. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}
