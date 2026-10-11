import {
  addDays,
  membershipFreezeSchema,
  membershipInputSchema,
  membershipRenewSchema,
  type MembershipResponse,
  monthPeriodEnd,
  planPatchSchema,
  type PlansResponse,
} from '@prana/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { member, membership, plan } from '../db/schema';
import type { AppContext, AppEnv } from '../env';
import { ApiError } from '../errors';
import { created, ctx, owned, parseBody, publicRow, touched } from '../lib/http';
import { summaryFor } from '../lib/members';

export const plans = new Hono<AppEnv>();
export const memberships = new Hono<AppEnv>();

plans.get('/', async (c) => {
  const { db, businessId } = ctx(c);
  const rows = await db
    .select()
    .from(plan)
    .where(and(eq(plan.business_id, businessId), isNull(plan.deleted_at)))
    .orderBy(asc(plan.created_at), asc(plan.id));
  const body: PlansResponse = { plans: rows.map(publicRow) };
  return c.json(body);
});

plans.patch('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, planPatchSchema);
  const existing = await owned(db, plan, c.req.param('id'), businessId);
  const patch = { ...input, ...touched(now) };
  await db.update(plan).set(patch).where(eq(plan.id, existing.id));
  return c.json({ plan: publicRow({ ...existing, ...patch }) });
});

async function respond(c: AppContext, row: typeof membership.$inferSelect, status: 200 | 201) {
  const { db, businessId, today } = ctx(c);
  const who = await owned(db, member, row.member_id, businessId);
  const body: MembershipResponse = { membership: publicRow(row), summary: await summaryFor(db, who, today) };
  return c.json(body, status);
}

memberships.post('/', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, membershipInputSchema);
  await owned(db, member, input.member_id, businessId);
  await owned(db, plan, input.plan_id, businessId);

  const period_start = input.period_start ?? today;
  const period_end = input.period_end ?? monthPeriodEnd(period_start);
  if (period_end < period_start) throw new ApiError('invalid_input', ['period_end']);

  const row = { ...created(businessId, now), member_id: input.member_id, plan_id: input.plan_id, period_start, period_end, frozen_until: null };
  await db.insert(membership).values(row);
  return respond(c, row, 201);
});

// The following month: it starts the day after the old period ends, or today if that has already passed.
memberships.post('/:id/renew', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, membershipRenewSchema);
  const previous = await owned(db, membership, c.req.param('id'), businessId);
  if (input.plan_id) await owned(db, plan, input.plan_id, businessId);

  const dayAfter = addDays(previous.period_end, 1);
  const period_start = dayAfter > today ? dayAfter : today;
  const row = {
    ...created(businessId, now),
    member_id: previous.member_id,
    plan_id: input.plan_id ?? previous.plan_id,
    period_start,
    period_end: monthPeriodEnd(period_start),
    frozen_until: null,
  };
  await db.insert(membership).values(row);
  return respond(c, row, 201);
});

memberships.post('/:id/freeze', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, membershipFreezeSchema);
  const existing = await owned(db, membership, c.req.param('id'), businessId);
  const patch = { frozen_until: input.until, ...touched(now) };
  await db.update(membership).set(patch).where(eq(membership.id, existing.id));
  return respond(c, { ...existing, ...patch }, 200);
});
