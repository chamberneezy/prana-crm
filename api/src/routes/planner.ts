import {
  addDays,
  closureInputSchema,
  type ClosureResponse,
  closuresQuerySchema,
  type ClosuresResponse,
  type SessionsResponse,
  startOfWeek,
  weekPlanInputSchema,
  weekTemplateInputSchema,
  type WeekTemplateResponse,
  zonedTimeToUtc,
} from '@prana/shared';
import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { closure, offering, session, visit, weekSlot } from '../db/schema';
import type { AppEnv, Db } from '../env';
import { ApiError } from '../errors';
import { created, ctx, owned, parseBody, parseQuery, publicRow, removed, touched } from '../lib/http';
import { firstLocationId, loadSessionViews, startsBetween } from '../lib/sessions';
import { checkedTeachers } from './offerings';

export const closures = new Hono<AppEnv>();
export const weekPlan = new Hono<AppEnv>();
export const weekTemplate = new Hono<AppEnv>();

// ── Closed days (holidays) ────────────────────────────────────────────────────

closures.get('/', async (c) => {
  const { db, businessId, today } = ctx(c);
  const query = parseQuery(c, closuresQuerySchema);
  const from = query.from ?? startOfWeek(today);
  const to = query.to ?? addDays(from, 6);
  const rows = await db
    .select()
    .from(closure)
    .where(and(eq(closure.business_id, businessId), isNull(closure.deleted_at), gte(closure.date, from), lte(closure.date, to)))
    .orderBy(asc(closure.date));
  const body: ClosuresResponse = { closures: rows.map(publicRow) };
  return c.json(body);
});

// Closing a day that is already closed renames it.
closures.post('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, closureInputSchema);
  const [existing] = await db
    .select()
    .from(closure)
    .where(and(eq(closure.business_id, businessId), eq(closure.date, input.date), isNull(closure.deleted_at)))
    .limit(1);
  if (existing) {
    const patch = { name: input.name, ...touched(now) };
    await db.update(closure).set(patch).where(eq(closure.id, existing.id));
    const body: ClosureResponse = { closure: publicRow({ ...existing, ...patch }) };
    return c.json(body);
  }
  const row = { ...created(businessId, now), date: input.date, name: input.name };
  await db.insert(closure).values(row);
  const body: ClosureResponse = { closure: publicRow(row) };
  return c.json(body, 201);
});

closures.delete('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const existing = await owned(db, closure, c.req.param('id'), businessId);
  await db.update(closure).set(removed(now)).where(eq(closure.id, existing.id));
  return c.body(null, 204);
});

// ── Class types and teachers named in a plan ──────────────────────────────────

async function checkedOfferings(db: Db, businessId: string, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (!unique.length) return;
  const found = await db
    .select({ id: offering.id })
    .from(offering)
    .where(and(eq(offering.business_id, businessId), isNull(offering.deleted_at), inArray(offering.id, unique)));
  if (found.length !== unique.length) throw new ApiError('invalid_input', ['offering_id']);
}

async function checkPlan(db: Db, businessId: string, rows: Array<{ offering_id: string; teacher_staff_id: string | null }>) {
  await checkedOfferings(
    db,
    businessId,
    rows.map((r) => r.offering_id),
  );
  try {
    await checkedTeachers(
      db,
      businessId,
      rows.flatMap((r) => (r.teacher_staff_id ? [r.teacher_staff_id] : [])),
    );
  } catch {
    throw new ApiError('invalid_input', ['teacher_staff_id']);
  }
}

// ── A week's plan ─────────────────────────────────────────────────────────────

weekPlan.put('/:monday', async (c) => {
  const { db, businessId, now, timeZone } = ctx(c);
  const monday = c.req.param('monday');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monday) || startOfWeek(monday) !== monday) throw new ApiError('invalid_input', ['monday']);
  const sunday = addDays(monday, 6);
  const { sessions: wanted } = await parseBody(c, weekPlanInputSchema);

  const badDay = wanted.findIndex((s) => s.date < monday || s.date > sunday);
  if (badDay >= 0) throw new ApiError('invalid_input', [`sessions.${badDay}.date`]);
  await checkPlan(db, businessId, wanted);

  const inWeek = startsBetween(monday, sunday, timeZone);
  const existing = await db
    .select()
    .from(session)
    .where(and(eq(session.business_id, businessId), isNull(session.deleted_at), inWeek));
  const byId = new Map(existing.map((s) => [s.id, s]));
  const badId = wanted.findIndex((s) => s.id && !byId.has(s.id));
  if (badId >= 0) throw new ApiError('invalid_input', [`sessions.${badId}.id`]);

  // A session left out is deleted, unless people were checked in to it: those stay, whatever the plan says.
  const kept = new Set(wanted.flatMap((s) => (s.id ? [s.id] : [])));
  const gone = existing.filter((s) => !kept.has(s.id));
  if (gone.length) {
    const [withVisits] = await db
      .select({ id: visit.session_id })
      .from(visit)
      .where(
        and(
          inArray(
            visit.session_id,
            gone.map((s) => s.id),
          ),
          isNull(visit.deleted_at),
        ),
      )
      .limit(1);
    if (withVisits) throw new ApiError('session_has_visits');
  }

  const locationId = wanted.some((s) => !s.id) ? await firstLocationId(db, businessId) : null;
  const writes = [];
  for (const s of wanted) {
    const starts_at = zonedTimeToUtc(s.date, s.start_time, timeZone);
    const ends_at = new Date(Date.parse(starts_at) + s.duration_min * 60_000).toISOString();
    const fields = { offering_id: s.offering_id, starts_at, ends_at, teacher_staff_id: s.teacher_staff_id };
    const before = s.id ? byId.get(s.id) : undefined;
    if (before) {
      const same = before.offering_id === fields.offering_id && before.starts_at === starts_at && before.ends_at === ends_at && before.teacher_staff_id === fields.teacher_staff_id;
      if (!same) writes.push(db.update(session).set({ ...fields, ...touched(now) }).where(eq(session.id, before.id)));
    } else {
      writes.push(db.insert(session).values({ ...created(businessId, now), ...fields, location_id: locationId!, capacity: null, note: null }));
    }
  }
  for (const s of gone) writes.push(db.update(session).set(removed(now)).where(eq(session.id, s.id)));
  if (writes.length) await db.batch(writes as [(typeof writes)[number], ...(typeof writes)[number][]]);

  const body: SessionsResponse = { sessions: await loadSessionViews(db, businessId, timeZone, inWeek) };
  return c.json(body);
});

// ── The standard week ─────────────────────────────────────────────────────────

async function loadTemplate(db: Db, businessId: string): Promise<WeekTemplateResponse> {
  const rows = await db
    .select()
    .from(weekSlot)
    .where(and(eq(weekSlot.business_id, businessId), isNull(weekSlot.deleted_at)))
    .orderBy(asc(weekSlot.weekday), asc(weekSlot.start_time));
  return { slots: rows.map(publicRow) };
}

weekTemplate.get('/', async (c) => {
  const { db, businessId } = ctx(c);
  return c.json(await loadTemplate(db, businessId));
});

weekTemplate.put('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const { slots } = await parseBody(c, weekTemplateInputSchema);
  await checkPlan(db, businessId, slots);
  await db.batch([
    db
      .update(weekSlot)
      .set(removed(now))
      .where(and(eq(weekSlot.business_id, businessId), isNull(weekSlot.deleted_at))),
    ...slots.map((s) => db.insert(weekSlot).values({ ...created(businessId, now), ...s })),
  ]);
  return c.json(await loadTemplate(db, businessId));
});
