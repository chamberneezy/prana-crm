import { localDate, uuidv7 } from '@prana/shared';
import { and, eq, isNull } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { z } from 'zod';
import type { member } from '../db/schema';
import type { AppContext, Db } from '../env';
import { ApiError } from '../errors';

/** Validates data against a schema, or throws invalid_input naming the fields that failed. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')).filter(Boolean))];
  throw new ApiError('invalid_input', fields);
}

export async function parseBody<T>(c: AppContext, schema: z.ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await c.req.json();
  } catch {
    throw new ApiError('invalid_input');
  }
  return parse(schema, data);
}

export function parseQuery<T>(c: AppContext, schema: z.ZodType<T>): T {
  return parse(schema, c.req.query());
}

/** What every handler needs: the database, who is asking, and "now" in the business's time zone. */
export function ctx(c: AppContext) {
  const staff = c.get('staff');
  const business = c.get('business');
  const now = new Date().toISOString();
  return {
    db: c.get('db'),
    staff,
    business,
    businessId: staff.business_id,
    timeZone: business.timezone,
    now,
    today: localDate(now, business.timezone),
  };
}

/** Columns for a new row. */
export function created(businessId: string, now: string) {
  return { id: uuidv7(), business_id: businessId, created_at: now, updated_at: now, deleted_at: null, changed_at: now };
}

/** Columns for an edited row. */
export function touched(now: string) {
  return { updated_at: now, changed_at: now };
}

/** Columns for a soft-deleted row. */
export function removed(now: string) {
  return { deleted_at: now, updated_at: now, changed_at: now };
}

/**
 * Loads a live row by id within the business, or throws not_found. Never returns another business's row.
 * Every business table has id, business_id and deleted_at; `member` stands in for all of them here.
 */
export async function owned<T extends SQLiteTable>(db: Db, table: T, id: string, businessId: string): Promise<T['$inferSelect']> {
  const t = table as unknown as typeof member;
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), eq(t.business_id, businessId), isNull(t.deleted_at)))
    .limit(1);
  if (!row) throw new ApiError('not_found');
  return row as T['$inferSelect'];
}

/** Drops server-only columns before a row leaves the API. */
export function publicRow<T extends object>(row: T): Omit<T, 'changed_at' | 'r2_key' | 'firebase_uid'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { changed_at, r2_key, firebase_uid, ...rest } = row as T & { changed_at?: unknown; r2_key?: unknown; firebase_uid?: unknown };
  return rest as Omit<T, 'changed_at' | 'r2_key' | 'firebase_uid'>;
}

/** Empty strings from forms are stored as null. */
export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
