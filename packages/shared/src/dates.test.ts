import { describe, expect, it } from 'vitest';
import { addDays, addMonths, dayStartUtc, diffDays, formatWeekRange, localDate, weekdayIndex, monthPeriodEnd, startOfMonth, startOfWeek, zonedTimeToUtc } from './dates';

describe('localDate', () => {
  it('gives the calendar date in Zagreb', () => {
    expect(localDate('2026-10-11T10:00:00Z')).toBe('2026-10-11');
    expect(localDate('2026-10-11T22:30:00Z')).toBe('2026-10-12');
    expect(localDate('2026-12-31T23:30:00Z')).toBe('2027-01-01');
  });
});

describe('zonedTimeToUtc', () => {
  it('converts summer and winter wall-clock times', () => {
    expect(zonedTimeToUtc('2026-10-12', '09:00')).toBe('2026-10-12T07:00:00.000Z');
    expect(zonedTimeToUtc('2026-12-01', '18:15')).toBe('2026-12-01T17:15:00.000Z');
  });
  it('is right on both sides of the autumn clock change (25.10.2026.)', () => {
    expect(zonedTimeToUtc('2026-10-24', '09:00')).toBe('2026-10-24T07:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-25', '09:00')).toBe('2026-10-25T08:00:00.000Z');
    expect(dayStartUtc('2026-10-25')).toBe('2026-10-24T22:00:00.000Z');
    expect(dayStartUtc('2026-10-26')).toBe('2026-10-25T23:00:00.000Z');
  });
  it('is right on both sides of the spring clock change (29.03.2026.)', () => {
    expect(zonedTimeToUtc('2026-03-28', '09:00')).toBe('2026-03-28T08:00:00.000Z');
    expect(zonedTimeToUtc('2026-03-29', '09:00')).toBe('2026-03-29T07:00:00.000Z');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('adds months and clamps to the end of the month', () => {
    expect(addMonths('2026-10-11', 1)).toBe('2026-11-11');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('counts days between dates', () => {
    expect(diffDays('2026-10-11', '2026-10-14')).toBe(3);
    expect(diffDays('2026-10-11', '2026-10-11')).toBe(0);
    expect(diffDays('2026-10-11', '2026-10-09')).toBe(-2);
    // unaffected by the clock change
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
  it('finds the Monday of a week and the first of a month', () => {
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05'); // Sunday
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(startOfMonth('2026-10-11')).toBe('2026-10-01');
  });
  it('numbers weekdays from Monday and labels a week', () => {
    expect(weekdayIndex('2026-10-12')).toBe(1);
    expect(weekdayIndex('2026-10-11')).toBe(7);
    expect(formatWeekRange('2026-10-12')).toBe('12.–18.10.2026.');
    expect(formatWeekRange('2026-09-28')).toBe('28.09.–04.10.2026.');
    expect(formatWeekRange('2026-12-28')).toBe('28.12.–03.01.2027.');
  });
  it('gives a one-month membership period', () => {
    expect(monthPeriodEnd('2026-10-11')).toBe('2026-11-10');
    expect(monthPeriodEnd('2026-10-01')).toBe('2026-10-31');
  });
});
