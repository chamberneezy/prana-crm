import { addDays, dayStartUtc, type SessionView } from '@prana/shared';
import { and, eq, gte, isNull, lt, type SQL, sql } from 'drizzle-orm';
import { offering, session, staff } from '../db/schema';
import type { Db } from '../env';
import { publicRow } from './http';

/** Sessions with their class type, teacher and check-in count, earliest first. */
export async function loadSessionViews(db: Db, businessId: string, filter?: SQL): Promise<SessionView[]> {
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

  return rows.map((r) => ({
    ...publicRow(r.row),
    offering_name: r.offering_name,
    color_token: r.color_token,
    entry_rule: r.entry_rule,
    teacher_name: r.teacher_name,
    booked: r.booked,
    effective_capacity: r.row.capacity ?? r.default_capacity,
  }));
}

/** Sessions starting on any of the calendar days from..to (inclusive) in the business's time zone. */
export function startsBetween(from: string, to: string, timeZone: string): SQL {
  return and(gte(session.starts_at, dayStartUtc(from, timeZone)), lt(session.starts_at, dayStartUtc(addDays(to, 1), timeZone))) as SQL;
}

export async function loadSessionView(db: Db, businessId: string, id: string): Promise<SessionView | undefined> {
  const [view] = await loadSessionViews(db, businessId, eq(session.id, id));
  return view;
}
