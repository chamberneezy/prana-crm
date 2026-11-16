import {
  addDays,
  dayStartUtc,
  offeringGroupInputSchema,
  type OfferingGroupsResponse,
  offeringInputSchema,
  offeringPatchSchema,
  type OfferingsResponse,
  startOfWeek,
} from '@prana/shared';
import { and, asc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { offering, offeringGroup, session, staff } from '../db/schema';
import type { AppEnv, Db } from '../env';
import { ApiError } from '../errors';
import { blankToNull, created, ctx, owned, parseBody, publicRow, touched } from '../lib/http';

/** Teacher ids as given, once each, each one a live staff member of this business. */
export async function checkedTeachers(db: Db, businessId: string, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const found = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.business_id, businessId), isNull(staff.deleted_at), inArray(staff.id, unique)));
  if (found.length !== unique.length) throw new ApiError('invalid_input', ['teacher_ids']);
  return unique;
}

export const offeringGroups = new Hono<AppEnv>();
export const offerings = new Hono<AppEnv>();

offeringGroups.get('/', async (c) => {
  const { db, businessId } = ctx(c);
  const rows = await db
    .select()
    .from(offeringGroup)
    .where(and(eq(offeringGroup.business_id, businessId), isNull(offeringGroup.deleted_at)))
    .orderBy(asc(offeringGroup.sort), asc(offeringGroup.name));
  const body: OfferingGroupsResponse = { groups: rows.map(publicRow) };
  return c.json(body);
});

offeringGroups.post('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, offeringGroupInputSchema);
  let sort = input.sort;
  if (sort === undefined) {
    const [last] = await db
      .select({ max: sql<number | null>`max(${offeringGroup.sort})` })
      .from(offeringGroup)
      .where(and(eq(offeringGroup.business_id, businessId), isNull(offeringGroup.deleted_at)));
    sort = (last?.max ?? -1) + 1;
  }
  const row = { ...created(businessId, now), name: input.name, sort };
  await db.insert(offeringGroup).values(row);
  return c.json({ group: publicRow(row) }, 201);
});

offerings.get('/', async (c) => {
  const { db, businessId, today, timeZone } = ctx(c);
  const monday = startOfWeek(today);
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(offering)
      .where(and(eq(offering.business_id, businessId), isNull(offering.deleted_at)))
      .orderBy(asc(offering.created_at), asc(offering.id)),
    db
      .select({ offering_id: session.offering_id, count: sql<number>`count(*)` })
      .from(session)
      .where(
        and(
          eq(session.business_id, businessId),
          isNull(session.deleted_at),
          gte(session.starts_at, dayStartUtc(monday, timeZone)),
          lt(session.starts_at, dayStartUtc(addDays(monday, 7), timeZone)),
        ),
      )
      .groupBy(session.offering_id),
  ]);
  const thisWeek = new Map(counts.map((r) => [r.offering_id, r.count]));
  const body: OfferingsResponse = { offerings: rows.map((r) => ({ ...publicRow(r), sessions_this_week: thisWeek.get(r.id) ?? 0 })) };
  return c.json(body);
});

offerings.post('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, offeringInputSchema);
  await owned(db, offeringGroup, input.group_id, businessId);
  const row = {
    ...created(businessId, now),
    group_id: input.group_id,
    name: input.name,
    color_token: input.color_token,
    default_duration_min: input.default_duration_min,
    entry_rule: blankToNull(input.entry_rule),
    default_capacity: input.default_capacity ?? null,
    active: input.active ?? true,
    teacher_ids: await checkedTeachers(db, businessId, input.teacher_ids ?? []),
  };
  await db.insert(offering).values(row);
  return c.json({ offering: publicRow(row) }, 201);
});

offerings.patch('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, offeringPatchSchema);
  const existing = await owned(db, offering, c.req.param('id'), businessId);
  if (input.group_id) await owned(db, offeringGroup, input.group_id, businessId);
  const patch = {
    ...input,
    ...('entry_rule' in input ? { entry_rule: blankToNull(input.entry_rule) } : {}),
    ...(input.teacher_ids ? { teacher_ids: await checkedTeachers(db, businessId, input.teacher_ids) } : {}),
    ...touched(now),
  };
  await db.update(offering).set(patch).where(eq(offering.id, existing.id));
  return c.json({ offering: publicRow({ ...existing, ...patch }) });
});
