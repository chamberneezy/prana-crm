import { addDays, addMonths, type DashboardResponse, type MeResponse, type StaffListResponse, dashboardQuerySchema, dayStartUtc, EXPIRING_WITHIN_DAYS, startOfMonth } from '@prana/shared';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { member, payment, staff as staffTable } from '../db/schema';
import type { AppEnv } from '../env';
import { ctx, parseQuery, publicRow } from '../lib/http';
import { loadMemberFacts, toSummary } from '../lib/members';
import { loadSessionViews, startsBetween } from '../lib/sessions';

export const me = new Hono<AppEnv>();
export const staffList = new Hono<AppEnv>();
export const dashboard = new Hono<AppEnv>();

me.get('/', (c) => {
  const { staff, business: biz } = ctx(c);
  const { id, name, locale, timezone } = biz;
  const body: MeResponse = { staff: publicRow(staff), business: { id, name, locale, timezone } };
  return c.json(body);
});

staffList.get('/', async (c) => {
  const { db, businessId } = ctx(c);
  const rows = await db
    .select()
    .from(staffTable)
    .where(and(eq(staffTable.business_id, businessId), isNull(staffTable.deleted_at)))
    .orderBy(staffTable.name);
  const body: StaffListResponse = { staff: rows.map(publicRow) };
  return c.json(body);
});

dashboard.get('/', async (c) => {
  const { db, businessId, today, timeZone } = ctx(c);
  const date = parseQuery(c, dashboardQuerySchema).date ?? today;
  const tomorrow = addDays(date, 1);
  const month = startOfMonth(date);

  const [todaySessions, tomorrowSessions, members, facts, paid] = await Promise.all([
    loadSessionViews(db, businessId, startsBetween(date, date, timeZone)),
    loadSessionViews(db, businessId, startsBetween(tomorrow, tomorrow, timeZone)),
    db
      .select()
      .from(member)
      .where(and(eq(member.business_id, businessId), isNull(member.deleted_at))),
    loadMemberFacts(db, businessId, date),
    db
      .select({ total: sql<number | null>`sum(${payment.amount_cents})` })
      .from(payment)
      .where(
        and(
          eq(payment.business_id, businessId),
          isNull(payment.deleted_at),
          gte(payment.paid_at, dayStartUtc(month, timeZone)),
          lt(payment.paid_at, dayStartUtc(addMonths(month, 1), timeZone)),
        ),
      ),
  ]);

  const summaries = members.map((m) => toSummary(m, facts.get(m.id)));
  const counts = { active_members: 0, expiring_this_week: 0, unpaid_members: 0, debts_total_cents: 0, payments_this_month_cents: paid[0]?.total ?? 0 };
  for (const s of summaries) {
    // Active = has a current membership that isn't frozen.
    if (s.status !== 'none' && s.status !== 'frozen') counts.active_members++;
    // An unpaid membership that also ends this week is counted here too.
    const endsSoon = s.days_left !== null && s.days_left <= EXPIRING_WITHIN_DAYS;
    if (s.status === 'expiring' || (s.status === 'unpaid' && endsSoon)) counts.expiring_this_week++;
    if (s.debt_cents > 0) {
      counts.unpaid_members++;
      counts.debts_total_cents += s.debt_cents;
    }
  }

  const attention = summaries
    .filter((s) => s.status === 'unpaid' || s.status === 'expiring')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'unpaid' ? -1 : 1;
      return (a.days_left ?? 0) - (b.days_left ?? 0) || a.full_name.localeCompare(b.full_name, 'hr');
    });

  const body: DashboardResponse = { date, today: todaySessions, tomorrow: tomorrowSessions, attention, counts, currency: 'EUR' };
  return c.json(body);
});
