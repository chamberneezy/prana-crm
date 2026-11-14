import { addDays, addMonths, analyticsQuerySchema, type AnalyticsResponse, dayStartUtc, endOfMonth, localDate, localHour, pickCurrentMembership, startOfMonth, weekdayIndex } from '@prana/shared';
import { and, eq, gte, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { member, membership, offering, payment, plan, session, visit } from '../db/schema';
import type { AppEnv } from '../env';
import { ctx, parseQuery } from '../lib/http';

export const analytics = new Hono<AppEnv>();

const TOP = 5;

/**
 * "Analitika": attendance and income over whole calendar months, ending with this one.
 * A studio has hundreds of check-ins a month, not millions: the rows are read once and counted here.
 */
analytics.get('/', async (c) => {
  const { db, businessId, today, timeZone } = ctx(c);
  const months = parseQuery(c, analyticsQuerySchema).months ?? 6;
  const from = startOfMonth(addMonths(today, -(months - 1)));
  const to = endOfMonth(today);
  const fromUtc = dayStartUtc(from, timeZone);
  const toUtc = dayStartUtc(addDays(to, 1), timeZone);
  const recentFrom = dayStartUtc(addDays(today, -29), timeZone);

  const [visits, payments, people, memberships] = await Promise.all([
    db
      .select({ member_id: visit.member_id, checked_in_at: visit.checked_in_at, session_id: session.id, starts_at: session.starts_at, offering_id: offering.id, offering_name: offering.name, color_token: offering.color_token })
      .from(visit)
      .innerJoin(session, eq(session.id, visit.session_id))
      .innerJoin(offering, eq(offering.id, session.offering_id))
      .where(and(eq(visit.business_id, businessId), isNull(visit.deleted_at), isNull(session.deleted_at), gte(session.starts_at, fromUtc), lt(session.starts_at, toUtc))),
    db
      .select({ amount_cents: payment.amount_cents, method: payment.method, paid_at: payment.paid_at, plan_code: plan.code, plan_name: plan.name })
      .from(payment)
      .leftJoin(membership, eq(membership.id, payment.membership_id))
      .leftJoin(plan, eq(plan.id, membership.plan_id))
      .where(and(eq(payment.business_id, businessId), isNull(payment.deleted_at), gte(payment.paid_at, fromUtc), lt(payment.paid_at, toUtc))),
    db
      .select({ id: member.id, full_name: member.full_name })
      .from(member)
      .where(and(eq(member.business_id, businessId), isNull(member.deleted_at))),
    db
      .select({ member_id: membership.member_id, period_start: membership.period_start, period_end: membership.period_end, frozen_until: membership.frozen_until })
      .from(membership)
      .where(and(eq(membership.business_id, businessId), isNull(membership.deleted_at))),
  ]);

  const names = new Map(people.map((p) => [p.id, p.full_name]));
  const monthKey = (instant: string) => localDate(instant, timeZone).slice(0, 7);
  const monthRows = new Map<string, { visits: number; income_cents: number; who: Set<string> }>();
  for (let i = 0; i < months; i++) monthRows.set(addMonths(from, i).slice(0, 7), { visits: 0, income_cents: 0, who: new Set() });

  const byOffering = new Map<string, { offering_id: string; name: string; color_token: AnalyticsResponse['by_offering'][number]['color_token']; visits: number; sessions: Set<string> }>();
  const bySlot = new Map<string, number>();
  const perMember = new Map<string, { visits: number; recent: number; last: string | null }>();
  const sessionsWithVisits = new Set<string>();

  for (const v of visits) {
    if (!names.has(v.member_id)) continue;
    const m = monthRows.get(monthKey(v.starts_at));
    if (m) {
      m.visits++;
      m.who.add(v.member_id);
    }
    sessionsWithVisits.add(v.session_id);
    const o = byOffering.get(v.offering_id) ?? { offering_id: v.offering_id, name: v.offering_name, color_token: v.color_token, visits: 0, sessions: new Set<string>() };
    o.visits++;
    o.sessions.add(v.session_id);
    byOffering.set(v.offering_id, o);
    const slot = `${weekdayIndex(localDate(v.starts_at, timeZone))}-${localHour(v.starts_at, timeZone)}`;
    bySlot.set(slot, (bySlot.get(slot) ?? 0) + 1);
    const p = perMember.get(v.member_id) ?? { visits: 0, recent: 0, last: null };
    p.visits++;
    if (v.starts_at >= recentFrom) p.recent++;
    if (!p.last || v.checked_in_at > p.last) p.last = v.checked_in_at;
    perMember.set(v.member_id, p);
  }

  const byMethod = new Map<string, number>();
  const byPlan = new Map<string, { plan_code: AnalyticsResponse['by_plan'][number]['plan_code']; plan_name: string | null; cents: number }>();
  for (const p of payments) {
    const m = monthRows.get(monthKey(p.paid_at));
    if (m) m.income_cents += p.amount_cents;
    byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount_cents);
    const key = p.plan_name ?? '';
    const entry = byPlan.get(key) ?? { plan_code: p.plan_code, plan_name: p.plan_name, cents: 0 };
    entry.cents += p.amount_cents;
    byPlan.set(key, entry);
  }

  const counted = (id: string) => {
    const p = perMember.get(id);
    return { id, full_name: names.get(id) ?? '', visits: p?.visits ?? 0, last_visit_at: p?.last ?? null };
  };
  const byName = (a: { full_name: string }, b: { full_name: string }) => a.full_name.localeCompare(b.full_name, 'hr');

  // Least active: members paying for a membership right now, by check-ins in the last 30 days.
  const membershipsBy = new Map<string, typeof memberships>();
  for (const m of memberships) membershipsBy.set(m.member_id, [...(membershipsBy.get(m.member_id) ?? []), m]);
  const current = [...membershipsBy].filter(([id, list]) => names.has(id) && pickCurrentMembership(list, today)).map(([id]) => id);
  const least = current
    .map((id) => ({ ...counted(id), recent: perMember.get(id)?.recent ?? 0 }))
    .sort((a, b) => a.recent - b.recent || byName(a, b))
    .slice(0, TOP)
    .map(({ recent, ...rest }) => ({ ...rest, visits: recent }));

  const totalVisits = [...monthRows.values()].reduce((n, m) => n + m.visits, 0);
  const body: AnalyticsResponse = {
    from,
    to,
    totals: {
      visits: totalVisits,
      income_cents: [...monthRows.values()].reduce((n, m) => n + m.income_cents, 0),
      sessions: sessionsWithVisits.size,
      average_class_size: sessionsWithVisits.size ? Math.round((totalVisits / sessionsWithVisits.size) * 10) / 10 : 0,
      members_who_came: perMember.size,
    },
    months: [...monthRows].map(([month, m]) => ({ month, visits: m.visits, income_cents: m.income_cents, members_who_came: m.who.size })),
    by_offering: [...byOffering.values()].map(({ sessions, ...o }) => ({ ...o, sessions: sessions.size })).sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, 'hr')),
    by_slot: [...bySlot].map(([key, n]) => {
      const [weekday, hour] = key.split('-').map(Number);
      return { weekday: weekday ?? 1, hour: hour ?? 0, visits: n };
    }),
    most_active: [...perMember.keys()]
      .map(counted)
      .sort((a, b) => b.visits - a.visits || byName(a, b))
      .slice(0, TOP),
    least_active: least,
    by_method: [...byMethod].map(([method, n]) => ({ method: method as AnalyticsResponse['by_method'][number]['method'], cents: n })).sort((a, b) => b.cents - a.cents),
    by_plan: [...byPlan.values()].sort((a, b) => b.cents - a.cents),
    currency: 'EUR',
  };
  return c.json(body);
});
