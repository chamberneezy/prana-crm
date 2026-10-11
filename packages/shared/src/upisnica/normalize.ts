/** Value clean-up shared by the parser and its tests. Each returns the tidy value and whether it passed validation. */

export interface Normalized {
  value: string;
  valid: boolean;
}

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

/** A character the recogniser could not read. */
export function hasUnreadable(text: string): boolean {
  return /[?�]/.test(text);
}

/** Lower-case, no spaces. */
export function normalizeEmail(raw: string): Normalized {
  const value = raw.replace(/\s+/g, '').toLowerCase();
  return { value, valid: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) };
}

/** Croatian format: "091 234 5678". +385 and 00385 become the leading 0. */
export function normalizePhone(raw: string): Normalized {
  const trimmed = collapse(raw);
  if (/[^\d\s+()\-/.]/.test(trimmed)) return { value: trimmed, valid: false };
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+385')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('00385')) digits = `0${digits.slice(5)}`;
  // A 0 kept after the country code ("+385 (0)91 …") would otherwise double up.
  if (digits.startsWith('00')) digits = digits.slice(1);

  if (/^0\d{9}$/.test(digits)) return { value: `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`, valid: true };
  if (/^0\d{8}$/.test(digits)) return { value: `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`, valid: true };
  return { value: trimmed, valid: false };
}

/** "dd.mm.yyyy." from d.m.yyyy with dots, slashes or dashes. The date must exist. */
export function normalizeDate(raw: string): Normalized {
  const trimmed = collapse(raw);
  const m = /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})\s*\.?$/.exec(trimmed);
  if (!m) return { value: trimmed, valid: false };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 1900;
  if (!real) return { value: trimmed, valid: false };
  return { value: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}.`, valid: true };
}

/** Title case that keeps č ć š ž đ and handles double-barrelled names: "ana-marija ČAČIĆ" → "Ana-Marija Čačić". */
export function titleCaseName(raw: string): string {
  return collapse(raw)
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => (part ? part.charAt(0).toLocaleUpperCase('hr') + part.slice(1).toLocaleLowerCase('hr') : part))
        .join('-'),
    )
    .join(' ');
}
