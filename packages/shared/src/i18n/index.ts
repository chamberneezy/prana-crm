import en from './en.json';
import hr from './hr.json';

export type Lang = 'hr' | 'en';
export type MessageKey = keyof typeof hr;

/** Croatian is the source; English must carry the same keys (checked in the test). */
export const dictionaries: Record<Lang, Record<MessageKey, string>> = { hr, en };

/** Looks up a string and fills `{name}` placeholders. */
export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dictionaries[lang][key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
