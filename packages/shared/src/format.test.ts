import { describe, expect, it } from 'vitest';
import { ageFromDob, formatDate, formatDayMonth, formatMoney, formatTime, formatTimeRange } from './format';

describe('formatMoney', () => {
  it('uses comma decimals and the euro sign after the amount', () => {
    expect(formatMoney(6500)).toBe('65,00 €');
    expect(formatMoney(5)).toBe('0,05 €');
    expect(formatMoney(0)).toBe('0,00 €');
  });
  it('groups thousands with a dot', () => {
    expect(formatMoney(118000)).toBe('1.180,00 €');
    expect(formatMoney(123456789)).toBe('1.234.567,89 €');
  });
  it('keeps the sign for negative amounts', () => {
    expect(formatMoney(-1250)).toBe('-12,50 €');
  });
});

describe('dates and times', () => {
  it('formats dates with the trailing dot', () => {
    expect(formatDate('2026-10-11T10:00:00Z')).toBe('11.10.2026.');
    expect(formatDayMonth('2026-11-01T10:00:00Z')).toBe('01.11.');
  });
  it('shows UTC instants in Europe/Zagreb', () => {
    // summer time, UTC+2
    expect(formatTime('2026-10-12T16:15:00Z')).toBe('18:15');
    // winter time, UTC+1
    expect(formatTime('2026-12-01T17:15:00Z')).toBe('18:15');
    // late evening UTC is already the next day in Zagreb
    expect(formatDate('2026-10-11T22:30:00Z')).toBe('12.10.2026.');
    expect(formatTime('2026-10-11T22:30:00Z')).toBe('00:30');
  });
  it('joins a time range with an en dash', () => {
    expect(formatTimeRange('2026-10-12T16:15:00Z', '2026-10-12T17:30:00Z')).toBe('18:15–19:30');
  });
});

describe('ageFromDob', () => {
  const today = new Date('2026-10-11T10:00:00Z');
  it('counts full years', () => {
    expect(ageFromDob('22.07.1991.', today)).toBe(35);
    expect(ageFromDob('11.10.1991.', today)).toBe(35);
    expect(ageFromDob('12.10.1991.', today)).toBe(34);
  });
  it('accepts a date without the trailing dot', () => {
    expect(ageFromDob('1.2.2000', today)).toBe(26);
  });
  it('returns null for unreadable dates', () => {
    expect(ageFromDob('', today)).toBeNull();
    expect(ageFromDob('22.13.1991.', today)).toBeNull();
    expect(ageFromDob('22.07.19?1.', today)).toBeNull();
  });
});
