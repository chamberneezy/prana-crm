import { addDays, addMonths, dayStartUtc, paymentInputSchema, type PaymentResponse, type PaymentsResponse, paymentsQuerySchema, startOfMonth } from '@prana/shared';
import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { member, membership, payment, plan } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { blankToNull, created, ctx, owned, parseBody, parseQuery, publicRow } from '../lib/http';
import { loadMemberFacts, toSummary } from '../lib/members';

export const payments = new Hono<AppEnv>();

payments.get('/', async (c) => {
  const { db, businessId, today, timeZone } = ctx(c);
  const query = parseQuery(c, paymentsQuerySchema);
  const from = query.from ?? startOfMonth(today);
  const to = query.to ?? addDays(addMonths(startOfMonth(from), 1), -1);

  const rows = await db
    .select({ row: payment, member_name: member.full_name, member_deleted: member.deleted_at, plan_name: plan.name })
    .from(payment)
    .leftJoin(member, eq(member.id, payment.member_id))
    .leftJoin(membership, eq(membership.id, payment.membership_id))
    .leftJoin(plan, eq(plan.id, membership.plan_id))
    .where(
      and(
        eq(payment.business_id, businessId),
        isNull(payment.deleted_at),
        gte(payment.paid_at, dayStartUtc(from, timeZone)),
        lt(payment.paid_at, dayStartUtc(addDays(to, 1), timeZone)),
      ),
    )
    .orderBy(desc(payment.paid_at));

  const body: PaymentsResponse = {
    from,
    to,
    // A deleted member's payments stay in the books, without the name.
    payments: rows.map((r) => ({ ...publicRow(r.row), member_name: r.member_deleted ? null : r.member_name, plan_name: r.plan_name })),
    total_cents: rows.reduce((sum, r) => sum + r.row.amount_cents, 0),
    currency: 'EUR',
  };
  return c.json(body);
});

payments.post('/', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, paymentInputSchema);
  const who = await owned(db, member, input.member_id, businessId);

  let membershipId: string | null;
  if (input.membership_id === undefined) {
    const facts = await loadMemberFacts(db, businessId, today, who.id);
    membershipId = facts.get(who.id)?.membership?.id ?? null;
  } else {
    membershipId = input.membership_id;
    if (membershipId) {
      const target = await owned(db, membership, membershipId, businessId);
      if (target.member_id !== who.id) throw new ApiError('invalid_input', ['membership_id']);
    }
  }

  const row = {
    ...created(businessId, now),
    member_id: who.id,
    membership_id: membershipId,
    amount_cents: input.amount_cents,
    currency: 'EUR' as const,
    method: input.method,
    paid_at: input.paid_at ? new Date(input.paid_at).toISOString() : now,
    note: blankToNull(input.note),
  };
  await db.insert(payment).values(row);

  const facts = await loadMemberFacts(db, businessId, today, who.id);
  const body: PaymentResponse = { payment: publicRow(row), summary: toSummary(who, facts.get(who.id)) };
  return c.json(body, 201);
});
