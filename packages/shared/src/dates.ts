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

/** A one-month period starting on `start`: 11.10. → 10.11. */
export function monthPeriodEnd(start: string): string {
  return addDays(addMonths(start, 1), -1);
}
