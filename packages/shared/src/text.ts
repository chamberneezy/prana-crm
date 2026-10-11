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
