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

type PluralBase = { [K in MessageKey]: K extends `${infer B}.other` ? B : never }[MessageKey];

const pluralRules: Partial<Record<Lang, Intl.PluralRules>> = {};

/**
 * Picks the plural form for a count: Croatian has three (1 dolazak, 2 dolaska, 5 dolazaka).
 * `base` is a key with `.one`, `.few` and `.other` variants; `{n}` is filled with the count.
 */
export function translatePlural(lang: Lang, base: PluralBase, n: number, vars?: Record<string, string | number>): string {
  const rules = (pluralRules[lang] ??= new Intl.PluralRules(lang));
  const category = rules.select(n);
  const form = category === 'one' || category === 'few' ? category : 'other';
  return translate(lang, `${base}.${form}` as MessageKey, { n, ...vars });
}
