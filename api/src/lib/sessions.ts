import { addDays, dayStartUtc, localDate, type SessionView } from '@prana/shared';
import { and, eq, gte, isNull, lt, lte, type SQL, sql } from 'drizzle-orm';
import { closure, location, offering, session, staff } from '../db/schema';
import type { Db } from '../env';
import { ApiError } from '../errors';
import { publicRow } from './http';

/** Where a session is held when not said: the business's first location. */
export async function firstLocationId(db: Db, businessId: string): Promise<string> {
  const [first] = await db
    .select({ id: location.id })
    .from(location)
    .where(and(eq(location.business_id, businessId), isNull(location.deleted_at)))
    .orderBy(location.created_at)
    .limit(1);
  if (!first) throw new ApiError('invalid_input', ['location_id']);
  return first.id;
}

/** Closed days (holiday name by date) from..to inclusive. */
export async function loadClosures(db: Db, businessId: string, from: string, to: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ date: closure.date, name: closure.name })
    .from(closure)
    .where(and(eq(closure.business_id, businessId), isNull(closure.deleted_at), gte(closure.date, from), lte(closure.date, to)));
  return new Map(rows.map((r) => [r.date, r.name]));
}

/** The holiday's name when the studio is closed on that calendar day, otherwise null. */
export async function closureOn(db: Db, businessId: string, date: string): Promise<string | null> {
  return (await loadClosures(db, businessId, date, date)).get(date) ?? null;
}

/** Sessions with their class type, teacher, check-in count and whether their day is closed, earliest first. */
export async function loadSessionViews(db: Db, businessId: string, timeZone: string, filter?: SQL): Promise<SessionView[]> {
  const rows = await db
    .select({
      row: session,
      offering_name: offering.name,
      color_token: offering.color_token,
      entry_rule: offering.entry_rule,
      default_capacity: offering.default_capacity,
      teacher_name: staff.name,
      booked: sql<number>`(select count(*) from visit v where v.session_id = "session"."id" and v.deleted_at is null)`,
    })
    .from(session)
    .innerJoin(offering, eq(offering.id, session.offering_id))
    .leftJoin(staff, eq(staff.id, session.teacher_staff_id))
    .where(and(eq(session.business_id, businessId), isNull(session.deleted_at), filter))
    .orderBy(session.starts_at);

  const days = rows.map((r) => localDate(r.row.starts_at, timeZone));
  const closed = days.length ? await loadClosures(db, businessId, days[0]!, days[days.length - 1]!) : new Map<string, string>();

  return rows.map((r, i) => ({
    ...publicRow(r.row),
    offering_name: r.offering_name,
    color_token: r.color_token,
    entry_rule: r.entry_rule,
    teacher_name: r.teacher_name,
    booked: r.booked,
    effective_capacity: r.row.capacity ?? r.default_capacity,
    closure_name: closed.get(days[i]!) ?? null,
  }));
}

/** Sessions starting on any of the calendar days from..to (inclusive) in the business's time zone. */
export function startsBetween(from: string, to: string, timeZone: string): SQL {
  return and(gte(session.starts_at, dayStartUtc(from, timeZone)), lt(session.starts_at, dayStartUtc(addDays(to, 1), timeZone))) as SQL;
}

export async function loadSessionView(db: Db, businessId: string, timeZone: string, id: string): Promise<SessionView | undefined> {
  const [view] = await loadSessionViews(db, businessId, timeZone, eq(session.id, id));
  return view;
}
