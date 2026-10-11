import { describe, expect, it } from 'vitest';
import en from './en.json';
import hr from './hr.json';
import { translate, translatePlural } from './index';

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

describe('translatePlural', () => {
  it('uses the three Croatian forms', () => {
    const word = (n: number) => translatePlural('hr', 'visits', n);
    expect([1, 2, 4, 5, 8, 11, 12, 21, 22, 25].map(word)).toEqual(['dolazak', 'dolaska', 'dolaska', 'dolazaka', 'dolazaka', 'dolazaka', 'dolazaka', 'dolazak', 'dolaska', 'dolazaka']);
    expect(translatePlural('hr', 'members.count', 3)).toBe('3 člana');
    expect(translatePlural('hr', 'status.expiresIn', 1)).toBe('Ističe za 1 dan');
  });
  it('uses the two English forms', () => {
    expect(translatePlural('en', 'members.count', 1)).toBe('1 member');
    expect(translatePlural('en', 'members.count', 3)).toBe('3 members');
  });
});
