import {
  addDays,
  type SessionDetailResponse,
  sessionInputSchema,
  sessionPatchSchema,
  type SessionsResponse,
  sessionsQuerySchema,
  startOfWeek,
  visitInputSchema,
  type VisitResponse,
} from '@prana/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { location, member, offering, session, staff, visit } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { blankToNull, created, ctx, owned, parseBody, parseQuery, publicRow, removed, touched } from '../lib/http';
import { loadMemberFacts, toSummary } from '../lib/members';
import { loadSessionView, loadSessionViews, startsBetween } from '../lib/sessions';

export const sessions = new Hono<AppEnv>();
export const visits = new Hono<AppEnv>();

sessions.get('/', async (c) => {
  const { db, businessId, today, timeZone } = ctx(c);
  const query = parseQuery(c, sessionsQuerySchema);
  const from = query.from ?? startOfWeek(today);
  const to = query.to ?? addDays(from, 6);
  const body: SessionsResponse = { sessions: await loadSessionViews(db, businessId, startsBetween(from, to, timeZone)) };
  return c.json(body);
});

sessions.post('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, sessionInputSchema);
  const template = await owned(db, offering, input.offering_id, businessId);

  let locationId = input.location_id;
  if (locationId) {
    await owned(db, location, locationId, businessId);
  } else {
    const [first] = await db
      .select({ id: location.id })
      .from(location)
      .where(and(eq(location.business_id, businessId), isNull(location.deleted_at)))
      .orderBy(asc(location.created_at))
      .limit(1);
    if (!first) throw new ApiError('invalid_input', ['location_id']);
    locationId = first.id;
  }
  if (input.teacher_staff_id) await owned(db, staff, input.teacher_staff_id, businessId);

  const ends_at = input.ends_at ?? new Date(Date.parse(input.starts_at) + template.default_duration_min * 60_000).toISOString();
  if (ends_at <= input.starts_at) throw new ApiError('invalid_input', ['ends_at']);

  const row = {
    ...created(businessId, now),
    location_id: locationId,
    offering_id: template.id,
    starts_at: new Date(input.starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    teacher_staff_id: input.teacher_staff_id ?? null,
    capacity: input.capacity ?? null,
    note: blankToNull(input.note),
  };
  await db.insert(session).values(row);
  return c.json({ session: await loadSessionView(db, businessId, row.id) }, 201);
});

sessions.get('/:id', async (c) => {
  const { db, businessId } = ctx(c);
  const view = await loadSessionView(db, businessId, c.req.param('id'));
  if (!view) throw new ApiError('not_found');
  const attendees = await db
    .select({
      visit_id: visit.id,
      member_id: member.id,
      full_name: member.full_name,
      health_flag: member.health_flag,
      health_text: member.health_text,
      checked_in_at: visit.checked_in_at,
    })
    .from(visit)
    .innerJoin(member, eq(member.id, visit.member_id))
    .where(and(eq(visit.session_id, view.id), eq(visit.business_id, businessId), isNull(visit.deleted_at), isNull(member.deleted_at)))
    .orderBy(asc(member.full_name));
  const body: SessionDetailResponse = { session: view, attendees: attendees.map((a) => ({ ...a, health_text: a.health_flag ? a.health_text : null })) };
  return c.json(body);
});

sessions.patch('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const input = await parseBody(c, sessionPatchSchema);
  const existing = await owned(db, session, c.req.param('id'), businessId);
  if (input.offering_id) await owned(db, offering, input.offering_id, businessId);
  if (input.location_id) await owned(db, location, input.location_id, businessId);
  if (input.teacher_staff_id) await owned(db, staff, input.teacher_staff_id, businessId);

  const starts_at = input.starts_at ? new Date(input.starts_at).toISOString() : existing.starts_at;
  // Moving the start without giving an end keeps the length.
  const ends_at = input.ends_at
    ? new Date(input.ends_at).toISOString()
    : new Date(Date.parse(starts_at) + (Date.parse(existing.ends_at) - Date.parse(existing.starts_at))).toISOString();
  if (ends_at <= starts_at) throw new ApiError('invalid_input', ['ends_at']);

  const patch = {
    ...input,
    starts_at,
    ends_at,
    ...('note' in input ? { note: blankToNull(input.note) } : {}),
    ...touched(now),
  };
  await db.update(session).set(patch).where(eq(session.id, existing.id));
  return c.json({ session: await loadSessionView(db, businessId, existing.id) });
});

sessions.delete('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const existing = await owned(db, session, c.req.param('id'), businessId);
  // The check-ins go with the session, so they stop counting toward memberships.
  await db.batch([
    db
      .update(visit)
      .set(removed(now))
      .where(and(eq(visit.session_id, existing.id), isNull(visit.deleted_at))),
    db.update(session).set(removed(now)).where(eq(session.id, existing.id)),
  ]);
  return c.body(null, 204);
});

sessions.post('/:id/visits', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, visitInputSchema);
  const target = await owned(db, session, c.req.param('id'), businessId);
  const who = await owned(db, member, input.member_id, businessId);

  const [already] = await db
    .select({ id: visit.id })
    .from(visit)
    .where(and(eq(visit.session_id, target.id), eq(visit.member_id, who.id), isNull(visit.deleted_at)))
    .limit(1);
  if (already) throw new ApiError('already_checked_in');

  // The visit counts toward the membership that is current today.
  const before = await loadMemberFacts(db, businessId, today, who.id);
  const row = {
    ...created(businessId, now),
    member_id: who.id,
    session_id: target.id,
    membership_id: before.get(who.id)?.membership?.id ?? null,
    checked_in_at: now,
  };
  await db.insert(visit).values(row);

  const after = await loadMemberFacts(db, businessId, today, who.id);
  const body: VisitResponse = { visit: publicRow(row), summary: toSummary(who, after.get(who.id)) };
  return c.json(body, 201);
});

visits.delete('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const existing = await owned(db, visit, c.req.param('id'), businessId);
  await db.update(visit).set(removed(now)).where(eq(visit.id, existing.id));
  return c.body(null, 204);
});
