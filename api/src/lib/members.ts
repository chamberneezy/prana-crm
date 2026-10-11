import { deriveMemberStatus, type MemberSummary, type MembershipView, pickCurrentMembership, type StatusResult } from '@prana/shared';
import { and, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { type MemberRow, membership, payment, plan, visit } from '../db/schema';
import type { Db } from '../env';
import { publicRow } from './http';

export interface MemberFacts extends StatusResult {
  membership: MembershipView | null;
  last_visit_at: string | null;
}

const NO_FACTS: MemberFacts = { status: 'none', days_left: null, debt_cents: 0, membership: null, last_visit_at: null };

/**
 * Current membership, usage, payments and derived status per member, for the whole
 * business or one member. A handful of grouped queries, combined here, so the status
 * rules stay in one function (deriveMemberStatus) and lists never query per row.
 */
export async function loadMemberFacts(db: Db, businessId: string, today: string, memberId?: string): Promise<Map<string, MemberFacts>> {
  const [memberships, paid, used, last] = await Promise.all([
    db
      .select({ row: membership, plan_code: plan.code, plan_name: plan.name, visits_total: plan.visits_per_month, price_cents: plan.price_cents })
      .from(membership)
      .innerJoin(plan, eq(plan.id, membership.plan_id))
      .where(
        and(
          eq(membership.business_id, businessId),
          isNull(membership.deleted_at),
          // current or upcoming; finished periods can't affect the status
          or(gte(membership.period_end, today), gte(membership.frozen_until, today)),
          memberId ? eq(membership.member_id, memberId) : undefined,
        ),
      ),
    db
      .select({ membership_id: payment.membership_id, total: sql<number>`sum(${payment.amount_cents})` })
      .from(payment)
      .where(and(eq(payment.business_id, businessId), isNull(payment.deleted_at), isNotNull(payment.membership_id), memberId ? eq(payment.member_id, memberId) : undefined))
      .groupBy(payment.membership_id),
    db
      .select({ membership_id: visit.membership_id, count: sql<number>`count(*)` })
      .from(visit)
      .where(and(eq(visit.business_id, businessId), isNull(visit.deleted_at), isNotNull(visit.membership_id), memberId ? eq(visit.member_id, memberId) : undefined))
      .groupBy(visit.membership_id),
    db
      .select({ member_id: visit.member_id, at: sql<string>`max(${visit.checked_in_at})` })
      .from(visit)
      .where(and(eq(visit.business_id, businessId), isNull(visit.deleted_at), memberId ? eq(visit.member_id, memberId) : undefined))
      .groupBy(visit.member_id),
  ]);

  const paidBy = new Map(paid.map((p) => [p.membership_id, p.total]));
  const usedBy = new Map(used.map((u) => [u.membership_id, u.count]));

  const byMember = new Map<string, typeof memberships>();
  for (const m of memberships) {
    const list = byMember.get(m.row.member_id);
    if (list) list.push(m);
    else byMember.set(m.row.member_id, [m]);
  }

  const facts = new Map<string, MemberFacts>();
  for (const [id, list] of byMember) {
    const current = pickCurrentMembership(
      list.map((m) => m.row),
      today,
    );
    const found = current && list.find((m) => m.row === current);
    if (!current || !found) continue;

    const paid_cents = paidBy.get(current.id) ?? 0;
    const following = list.filter((m) => m.row !== current && m.row.period_start > current.period_end).map((m) => m.row.period_end);
    const renewed = following.length > 0;
    const result = deriveMemberStatus({ ...current, plan_code: found.plan_code, price_cents: found.price_cents, paid_cents, renewed }, today);
    facts.set(id, {
      ...result,
      membership: {
        ...publicRow(current),
        plan_code: found.plan_code,
        plan_name: found.plan_name,
        visits_total: found.visits_total,
        visits_used: usedBy.get(current.id) ?? 0,
        price_cents: found.price_cents,
        paid_cents,
        renewed_until: renewed ? following.reduce((latest, end) => (end > latest ? end : latest)) : null,
      },
      last_visit_at: null,
    });
  }

  for (const v of last) {
    const existing = facts.get(v.member_id);
    if (existing) existing.last_visit_at = v.at;
    else facts.set(v.member_id, { ...NO_FACTS, last_visit_at: v.at });
  }
  return facts;
}

export function toSummary(row: MemberRow, facts: MemberFacts | undefined): MemberSummary {
  const f = facts ?? NO_FACTS;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    health_flag: row.health_flag,
    health_text: row.health_flag ? row.health_text : null,
    status: f.status,
    days_left: f.days_left,
    debt_cents: f.debt_cents,
    membership: f.membership,
    last_visit_at: f.last_visit_at,
  };
}

export async function summaryFor(db: Db, row: MemberRow, today: string): Promise<MemberSummary> {
  const facts = await loadMemberFacts(db, row.business_id, today, row.id);
  return toSummary(row, facts.get(row.id));
}
