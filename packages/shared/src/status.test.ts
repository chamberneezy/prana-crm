import { describe, expect, it } from 'vitest';
import { deriveMemberStatus, isCurrentMembership, type MembershipFacts, pickCurrentMembership } from './status';

const today = '2026-10-11';

const base: MembershipFacts = {
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  frozen_until: null,
  plan_code: '2x',
  price_cents: 8500,
  paid_cents: 8500,
};

describe('deriveMemberStatus: the six states', () => {
  it('none: no current membership', () => {
    expect(deriveMemberStatus(null, today)).toEqual({ status: 'none', days_left: null, debt_cents: 0 });
  });
  it('active: paid and not ending soon', () => {
    expect(deriveMemberStatus(base, today)).toEqual({ status: 'active', days_left: 20, debt_cents: 0 });
  });
  it('trial: plan code trial', () => {
    expect(deriveMemberStatus({ ...base, plan_code: 'trial', price_cents: null, paid_cents: 0 }, today).status).toBe('trial');
  });
  it('expiring: the period ends within 7 days', () => {
    const r = deriveMemberStatus({ ...base, period_end: '2026-10-14' }, today);
    expect(r).toEqual({ status: 'expiring', days_left: 3, debt_cents: 0 });
  });
  it('unpaid: payments are below the plan price', () => {
    const r = deriveMemberStatus({ ...base, paid_cents: 2000 }, today);
    expect(r).toEqual({ status: 'unpaid', days_left: 20, debt_cents: 6500 });
  });
  it('frozen: frozen_until is today or later', () => {
    expect(deriveMemberStatus({ ...base, frozen_until: '2026-10-11' }, today).status).toBe('frozen');
    expect(deriveMemberStatus({ ...base, frozen_until: '2026-11-01' }, today).status).toBe('frozen');
  });
});

describe('deriveMemberStatus: priority and edges', () => {
  it('frozen wins over unpaid, expiring and trial', () => {
    const m = { ...base, plan_code: 'trial', paid_cents: 0, period_end: '2026-10-12', frozen_until: '2026-10-20' };
    expect(deriveMemberStatus(m, today).status).toBe('frozen');
  });
  it('unpaid wins over expiring and trial', () => {
    const m = { ...base, plan_code: 'trial', paid_cents: 0, period_end: '2026-10-12' };
    expect(deriveMemberStatus(m, today).status).toBe('unpaid');
  });
  it('expiring wins over trial', () => {
    const m = { ...base, plan_code: 'trial', price_cents: null, paid_cents: 0, period_end: '2026-10-12' };
    expect(deriveMemberStatus(m, today).status).toBe('expiring');
  });
  it('a freeze that ended yesterday no longer counts', () => {
    expect(deriveMemberStatus({ ...base, frozen_until: '2026-10-10' }, today).status).toBe('active');
  });
  it('unpaid when a price is set and nothing is paid', () => {
    expect(deriveMemberStatus({ ...base, paid_cents: 0 }, today)).toMatchObject({ status: 'unpaid', debt_cents: 8500 });
  });
  it('never unpaid while the plan has no price', () => {
    expect(deriveMemberStatus({ ...base, price_cents: null, paid_cents: 0 }, today)).toMatchObject({ status: 'active', debt_cents: 0 });
  });
  it('an overpayment is not a negative debt', () => {
    expect(deriveMemberStatus({ ...base, paid_cents: 9000 }, today).debt_cents).toBe(0);
  });
  it('expiring covers the last day and exactly 7 days, but not 8', () => {
    expect(deriveMemberStatus({ ...base, period_end: '2026-10-11' }, today)).toMatchObject({ status: 'expiring', days_left: 0 });
    expect(deriveMemberStatus({ ...base, period_end: '2026-10-18' }, today)).toMatchObject({ status: 'expiring', days_left: 7 });
    expect(deriveMemberStatus({ ...base, period_end: '2026-10-19' }, today)).toMatchObject({ status: 'active', days_left: 8 });
  });
  it('not expiring once a following membership exists', () => {
    expect(deriveMemberStatus({ ...base, period_end: '2026-10-14', renewed: true }, today).status).toBe('active');
  });
});

describe('current membership', () => {
  const past = { period_start: '2026-09-01', period_end: '2026-09-30', frozen_until: null };
  const now = { period_start: '2026-10-01', period_end: '2026-10-31', frozen_until: null };
  const next = { period_start: '2026-11-01', period_end: '2026-11-30', frozen_until: null };

  it('is the one whose period contains today', () => {
    expect(isCurrentMembership(past, today)).toBe(false);
    expect(isCurrentMembership(now, today)).toBe(true);
    expect(isCurrentMembership(next, today)).toBe(false);
    expect(pickCurrentMembership([past, now, next], today)).toBe(now);
  });
  it('includes the first and last day of the period', () => {
    expect(isCurrentMembership(now, '2026-10-01')).toBe(true);
    expect(isCurrentMembership(now, '2026-10-31')).toBe(true);
    expect(isCurrentMembership(now, '2026-11-01')).toBe(false);
  });
  it('stays current while frozen, even after the period ended', () => {
    expect(isCurrentMembership({ ...past, frozen_until: '2026-10-20' }, today)).toBe(true);
  });
  it('is null when nothing is current', () => {
    expect(pickCurrentMembership([past, next], today)).toBeNull();
    expect(pickCurrentMembership([], today)).toBeNull();
  });
  it('prefers the latest-starting one when two overlap', () => {
    const overlap = { period_start: '2026-10-05', period_end: '2026-11-04', frozen_until: null };
    expect(pickCurrentMembership([now, overlap], today)).toBe(overlap);
  });
});
