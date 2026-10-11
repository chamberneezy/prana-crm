import { formatTime } from '@prana/shared';
import type { useLang } from '../i18n';

type Strings = Pick<ReturnType<typeof useLang>, 't' | 'tn'>;

/**
 * The entry rule as it applies to one session: a rule that names minutes
 * ("Ulaz do 60 min nakon početka") becomes a clock time ("ulaz do 18:00");
 * any other rule is shown as written ("slobodan ulaz").
 */
export function entryNote(rule: string | null, startsAt: string, { t }: Strings): string | null {
  if (!rule) return null;
  const minutes = /(\d+)\s*min/i.exec(rule)?.[1];
  if (minutes) return t('schedule.entryUntil', { time: formatTime(new Date(Date.parse(startsAt) + Number(minutes) * 60_000)) });
  return rule.charAt(0).toLowerCase() + rule.slice(1);
}

/** The small line on a session card: "ulaz do 18:00 · 8 prijava". */
export function sessionMeta(session: { entry_rule: string | null; starts_at: string; booked: number }, strings: Strings): string {
  return [entryNote(session.entry_rule, session.starts_at, strings), strings.tn('signups', session.booked)].filter(Boolean).join(' · ');
}

/** Reads a whole number from a form field; null when empty, NaN when it isn't one. */
export function wholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}
