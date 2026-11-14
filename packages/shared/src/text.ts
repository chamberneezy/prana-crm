/** Lower-cases and strips diacritics (č ć š ž đ → c c s z d) for searching and fuzzy matching. */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Keeps only the digits, e.g. for comparing phone numbers. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, '');
}

/** "Ana Marija Horvat" → first "Ana", last "Marija Horvat": the first word is the first name, the rest the last name. */
export function splitFullName(full: string): { first_name: string; last_name: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  return { first_name: words[0] ?? '', last_name: words.slice(1).join(' ') };
}

/** The name as shown and searched: "first last". */
export function joinName(first: string, last: string): string {
  return [first.trim(), last.trim()].filter(Boolean).join(' ');
}
