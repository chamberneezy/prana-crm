import { describe, expect, it } from 'vitest';
import { hasUnreadable, normalizeDate, normalizeEmail, normalizePhone, titleCaseName } from './normalize';

describe('normalizeEmail', () => {
  it('lower-cases and validates', () => {
    expect(normalizeEmail(' Ana.Horvat@Example.COM ')).toEqual({ value: 'ana.horvat@example.com', valid: true });
    expect(normalizeEmail('ana.horvat@example')).toEqual({ value: 'ana.horvat@example', valid: false });
    expect(normalizeEmail('ana horvat')).toMatchObject({ valid: false });
  });
});

describe('normalizePhone', () => {
  it('writes Croatian mobile numbers as 091 234 5678', () => {
    for (const raw of ['0912345678', '091 234 5678', '091/234-5678', '+385 91 234 5678', '00385912345678', '+385 (0)91 234 5678']) {
      expect(normalizePhone(raw), raw).toEqual({ value: '091 234 5678', valid: true });
    }
    expect(normalizePhone('098 123 456')).toEqual({ value: '098 123 456', valid: true });
  });
  it('keeps what it cannot read and marks it invalid', () => {
    expect(normalizePhone('098 76? 4321')).toEqual({ value: '098 76? 4321', valid: false });
    expect(normalizePhone('12345')).toEqual({ value: '12345', valid: false });
    expect(normalizePhone('nema')).toMatchObject({ valid: false });
  });
});

describe('normalizeDate', () => {
  it('writes dates as dd.mm.yyyy.', () => {
    expect(normalizeDate('14.03.1988.')).toEqual({ value: '14.03.1988.', valid: true });
    expect(normalizeDate('2.9.2026')).toEqual({ value: '02.09.2026.', valid: true });
    expect(normalizeDate('21/06/1992')).toEqual({ value: '21.06.1992.', valid: true });
    expect(normalizeDate('21 - 6 - 1992')).toEqual({ value: '21.06.1992.', valid: true });
  });
  it('rejects dates that do not exist or are incomplete', () => {
    expect(normalizeDate('31.02.2026.')).toMatchObject({ valid: false });
    expect(normalizeDate('14.03.88')).toMatchObject({ valid: false });
    expect(normalizeDate('14.13.1988.')).toMatchObject({ valid: false });
    expect(normalizeDate('14.03.19?8.')).toMatchObject({ value: '14.03.19?8.', valid: false });
  });
});

describe('titleCaseName', () => {
  it('keeps Croatian letters and double-barrelled names', () => {
    expect(titleCaseName('ana  horvat')).toBe('Ana Horvat');
    expect(titleCaseName('ŽELJKA ĐURĐEVIĆ-ČAČIĆ')).toBe('Željka Đurđević-Čačić');
    expect(titleCaseName('šime šarić')).toBe('Šime Šarić');
  });
});

describe('hasUnreadable', () => {
  it('spots characters the recogniser gave up on', () => {
    expect(hasUnreadable('098 76? 4321')).toBe(true);
    expect(hasUnreadable('098 76� 4321')).toBe(true);
    expect(hasUnreadable('098 765 4321')).toBe(false);
  });
});
