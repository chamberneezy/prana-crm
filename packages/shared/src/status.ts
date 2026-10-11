import { diffDays } from './dates';
import type { MemberStatus } from './types';

/** What the API reports: a chip status, or `none` when the member has no current membership. */
export type ApiMemberStatus = MemberStatus | 'none';

/** A membership counts as expiring when it ends within this many days. */
export const EXPIRING_WITHIN_DAYS = 7;

interface Period {
  /** YYYY-MM-DD */
  period_start: string;
  /** YYYY-MM-DD */
  period_end: string;
  /** YYYY-MM-DD */
  frozen_until: string | null;
}

export interface MembershipFacts extends Period {
  plan_code: string;
  /** null until the studio sets a price; a plan without a price is never unpaid. */
  price_cents: number | null;
  paid_cents: number;
  /** A following membership already exists, so this one is not flagged as expiring. */
  renewed?: boolean;
}

export interface StatusResult {
  status: ApiMemberStatus;
  /** Days until the period ends; null without a current membership. */
  days_left: number | null;
  debt_cents: number;
}

/** A membership is current while today is inside its period, or while it is frozen. */
export function isCurrentMembership(m: Period, today: string): boolean {
  if (m.frozen_until !== null && m.frozen_until >= today) return true;
  return m.period_start <= today && today <= m.period_end;
}

/** The member's current membership: the latest-starting one that is current today. */
export function pickCurrentMembership<T extends Period>(memberships: T[], today: string): T | null {
  let current: T | null = null;
  for (const m of memberships) {
    if (!isCurrentMembership(m, today)) continue;
    if (!current || m.period_start > current.period_start) current = m;
  }
  return current;
}

/**
 * Member status, checked in priority order: frozen, unpaid, expiring, trial, active.
 * This is the only place the rules live; the API calls it and the apps only display the result.
 */
export function deriveMemberStatus(membership: MembershipFacts | null, today: string): StatusResult {
  if (!membership) return { status: 'none', days_left: null, debt_cents: 0 };

  const days_left = diffDays(today, membership.period_end);
  const debt_cents = membership.price_cents === null ? 0 : Math.max(0, membership.price_cents - membership.paid_cents);

  let status: ApiMemberStatus = 'active';
  if (membership.frozen_until !== null && membership.frozen_until >= today) status = 'frozen';
  else if (debt_cents > 0) status = 'unpaid';
  else if (days_left <= EXPIRING_WITHIN_DAYS && !membership.renewed) status = 'expiring';
  else if (membership.plan_code === 'trial') status = 'trial';

  return { status, days_left, debt_cents };
}
