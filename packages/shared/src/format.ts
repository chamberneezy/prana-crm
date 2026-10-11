export const TIME_ZONE = 'Europe/Zagreb';

type DateInput = Date | string;

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(value: DateInput) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const out: Record<string, string> = {};
  for (const p of partsFormat.formatToParts(date)) out[p.type] = p.value;
  return { day: out.day ?? '', month: out.month ?? '', year: out.year ?? '', hour: out.hour ?? '', minute: out.minute ?? '' };
}

/** 6500 → "65,00 €", 118000 → "1.180,00 €". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')} €`;
}

/** "11.10.2026." in the studio's time zone. */
export function formatDate(value: DateInput): string {
  const p = parts(value);
  return `${p.day}.${p.month}.${p.year}.`;
}

/** "11.10." in the studio's time zone. */
export function formatDayMonth(value: DateInput): string {
  const p = parts(value);
  return `${p.day}.${p.month}.`;
}

/** "18:15" in the studio's time zone. */
export function formatTime(value: DateInput): string {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

/** "18:15–19:30" with an en dash. */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** Age in full years from a "dd.mm.yyyy." date of birth, or null if it can't be read. */
export function ageFromDob(dob: string, today: Date = new Date()): number | null {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s*$/.exec(dob);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const now = parts(today);
  let age = Number(now.year) - year;
  if (Number(now.month) < month || (Number(now.month) === month && Number(now.day) < day)) age--;
  return age >= 0 ? age : null;
}

/** "1988-03-14" → "14.03.1988."; anything else comes back unchanged. */
export function isoToDisplayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}.` : iso;
}

/** "14.03.1988." or "14.3.1988" → "1988-03-14"; null if it isn't a real date. */
export function displayToIsoDate(display: string): string | null {
  const m = /^\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?\s*$/.exec(display);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}
