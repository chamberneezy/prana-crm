import { describe, expect, it } from 'vitest';
import en from './en.json';
import hr from './hr.json';
import { translate } from './index';

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('dictionaries', () => {
  it('have the same keys in Croatian and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(hr).sort());
  });
  it('use the same placeholders in both languages', () => {
    const enByKey: Record<string, string> = en;
    for (const [key, text] of Object.entries(hr)) {
      expect(placeholders(enByKey[key] ?? ''), key).toEqual(placeholders(text));
    }
  });
});

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('hr', 'membership.usedOf', { used: 5, total: 8 })).toBe('5 od 8 iskorišteno');
    expect(translate('en', 'membership.renewal', { date: '01.11.' })).toBe('Renews 01.11.');
  });
});
