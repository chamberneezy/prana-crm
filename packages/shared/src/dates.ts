import { TIME_ZONE } from './format';

/** Calendar dates are "YYYY-MM-DD" strings; instants are UTC ISO strings. */

const formatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(instant: Date, timeZone: string) {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, format);
  }
  const out: Record<string, string> = {};
  for (const p of format.formatToParts(instant)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
  };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function toDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

function split(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y ?? 0, m ?? 1, d ?? 1];
}

/** The calendar date of an instant in the given time zone. */
export function localDate(instant: Date | string, timeZone: string = TIME_ZONE): string {
  const p = zonedParts(typeof instant === 'string' ? new Date(instant) : instant, timeZone);
  return toDate(p.year, p.month, p.day);
}

/** The UTC instant of a wall-clock time ("HH:mm") on a calendar date in the given time zone. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string = TIME_ZONE): string {
  const [y, m, d] = split(date);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour ?? 0, minute ?? 0);
  const offsetAt = (ms: number) => {
    const p = zonedParts(new Date(ms), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
  };
  const first = offsetAt(wall);
  let utc = wall - first;
  // The offset can differ on the far side of a daylight-saving change.
  const second = offsetAt(utc);
  if (second !== first) utc = wall - second;
  return new Date(utc).toISOString();
}

/** The UTC instant at which a calendar date starts in the given time zone. */
export function dayStartUtc(date: string, timeZone: string = TIME_ZONE): string {
  return zonedTimeToUtc(date, '00:00', timeZone);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = split(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Adds months, clamping to the last day of the target month (31.01. + 1 → 28.02.). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = split(date);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toDate(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, lastDay));
}

/** Whole days from one calendar date to another (negative when `to` is earlier). */
export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = split(from);
  const [ty, tm, td] = split(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** The Monday of the week a date falls in. */
export function startOfWeek(date: string): string {
  const [y, m, d] = split(date);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

/** The last day of the month a date falls in: 11.10. → 31.10. */
export function endOfMonth(date: string): string {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

/**
 * Memberships run by calendar month: a period ends on the last day of the month it starts in.
 * (Someone joining on the 20th gets the current month, 1.–31., at the full price.)
 */
export function monthPeriodEnd(start: string): string {
  return endOfMonth(start);
}

/** A new membership's first day: the 1st of the month `date` falls in. */
export function monthPeriodStart(date: string): string {
  return startOfMonth(date);
}

/**
 * The period of a new membership that starts around `date`: the calendar month for a regular plan,
 * and one month from that day for a trial, so a trial on the 28th doesn't run out three days later.
 */
export function membershipPeriod(planCode: string, date: string): { start: string; end: string } {
  if (planCode === 'trial') return { start: date, end: addDays(addMonths(date, 1), -1) };
  return { start: monthPeriodStart(date), end: monthPeriodEnd(date) };
}

/**
 * The first day of a renewal: the day after the old period ends, or, if that has already passed,
 * the 1st of the current month (as for a new member).
 */
export function renewalStart(previousEnd: string, today: string): string {
  const dayAfter = addDays(previousEnd, 1);
  return dayAfter > today ? dayAfter : monthPeriodStart(today);
}

/** 1 = Monday … 7 = Sunday. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = split(date);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** "12.–18.10.2026." for the week starting on `monday`; both months are shown when it spans two. */
export function formatWeekRange(monday: string): string {
  const [, m1, d1] = split(monday);
  const [y2, m2, d2] = split(addDays(monday, 6));
  const first = m1 === m2 ? `${pad(d1)}.` : `${pad(d1)}.${pad(m1)}.`;
  return `${first}–${pad(d2)}.${pad(m2)}.${y2}.`;
}
