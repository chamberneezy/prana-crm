import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { uuidv7 } from './ids';
import { foldText } from './text';

describe('uuidv7', () => {
  it('is a valid version 7 UUID', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(z.uuid().safeParse(id).success).toBe(true);
  });
  it('sorts by creation time', () => {
    expect(uuidv7(1_000_000) < uuidv7(2_000_000)).toBe(true);
    expect(uuidv7(Date.UTC(2026, 9, 11)).slice(0, 13)).toBe('01a12842-5c00');
  });
});

describe('foldText', () => {
  it('strips Croatian diacritics and case', () => {
    expect(foldText('Željka Đurđević-Čačić Š')).toBe('zeljka durdevic-cacic s');
  });
});
