import { type SyncPullResponse, type SyncPushResponse, syncPushRowSchemas, syncPushSchema, type SyncPushTable, syncQuerySchema } from '@prana/shared';
import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { document, location, member, membership, offering, offeringGroup, payment, plan, session, staff, visit } from '../db/schema';
import type { AppEnv, Db } from '../env';
import { deleteMemberDocuments } from '../lib/documents';
import { ctx, parseBody, parseQuery, publicRow } from '../lib/http';

export const sync = new Hono<AppEnv>();

// Every business table has id, business_id, updated_at and changed_at; `member` stands in for all of them.
type AnyTable = typeof member;
const generic = (table: unknown) => table as AnyTable;

const PULL_TABLES = { location, staff, offering_group: offeringGroup, offering, session, plan, member, membership, visit, payment, document };

/** Tables the app may write offline, with the columns that must point at rows of the same business. */
const PUSH_TABLES: Record<SyncPushTable, { table: unknown; refs: Record<string, unknown> }> = {
  offering_group: { table: offeringGroup, refs: {} },
  offering: { table: offering, refs: { group_id: offeringGroup } },
  session: { table: session, refs: { offering_id: offering, location_id: location, teacher_staff_id: staff } },
  member: { table: member, refs: {} },
  membership: { table: membership, refs: { member_id: member, plan_id: plan } },
  visit: { table: visit, refs: { member_id: member, session_id: session, membership_id: membership } },
  payment: { table: payment, refs: { member_id: member, membership_id: membership } },
};

const EPOCH = '1970-01-01T00:00:00.000Z';

async function pull(db: Db, businessId: string, since: string | undefined) {
  let cursor = since ?? EPOCH;
  const changes: Record<string, unknown[]> = {};
  for (const [name, table] of Object.entries(PULL_TABLES)) {
    const t = generic(table);
    const rows = await db
      .select()
      .from(t)
      .where(and(eq(t.business_id, businessId), since ? gt(t.changed_at, since) : undefined));
    for (const row of rows) if (row.changed_at > cursor) cursor = row.changed_at;
    changes[name] = rows.map(publicRow);
  }
  return { cursor, changes };
}

sync.get('/', async (c) => {
  const { db, businessId } = ctx(c);
  const { since } = parseQuery(c, syncQuerySchema);
  return c.json((await pull(db, businessId, since)) as SyncPullResponse);
});

sync.post('/', async (c) => {
  const { db, businessId, now } = ctx(c);
  const { mutations } = await parseBody(c, syncPushSchema);
  const result: SyncPushResponse = { applied: 0, conflicts: [], rejected: [], cursor: now };

  // In order: the client sends parents (a member) before children (their visit).
  for (const [index, mutation] of mutations.entries()) {
    const { table: name } = mutation;
    const config = PUSH_TABLES[name];
    const t = generic(config.table);
    const rowId = typeof mutation.row.id === 'string' ? mutation.row.id : null;

    const parsed = syncPushRowSchemas[name].safeParse(mutation.row);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean))];
      result.rejected.push({ index, table: name, id: rowId, code: 'invalid_input', fields });
      continue;
    }
    const row = parsed.data as Record<string, unknown> & { id: string; updated_at: string; deleted_at: string | null; created_at?: string };

    const [existing] = await db.select().from(t).where(eq(t.id, row.id)).limit(1);
    if (existing && existing.business_id !== businessId) {
      result.rejected.push({ index, table: name, id: row.id, code: 'not_found' });
      continue;
    }

    let badRef: string | undefined;
    for (const [column, target] of Object.entries(config.refs)) {
      const value = row[column];
      if (typeof value !== 'string') continue;
      const r = generic(target);
      const [found] = await db
        .select({ id: r.id })
        .from(r)
        .where(and(eq(r.id, value), eq(r.business_id, businessId)))
        .limit(1);
      if (!found) {
        badRef = column;
        break;
      }
    }
    if (badRef) {
      result.rejected.push({ index, table: name, id: row.id, code: 'invalid_input', fields: [badRef] });
      continue;
    }

    if (name === 'member' && !existing && row.consent_accuracy !== true) {
      result.rejected.push({ index, table: name, id: row.id, code: 'consent_required' });
      continue;
    }

    // Last write wins by updated_at; the losing client gets the server's row back.
    if (existing && existing.updated_at > row.updated_at) {
      result.conflicts.push({ index, table: name, id: row.id, server: publicRow(existing) });
      continue;
    }

    const values = { ...row, business_id: businessId, created_at: existing?.created_at ?? row.created_at ?? now, changed_at: now };
    try {
      await db
        .insert(t)
        .values(values as never)
        .onConflictDoUpdate({ target: t.id, set: values as never });
    } catch (err) {
      const duplicateVisit = name === 'visit' && err instanceof Error && /UNIQUE/i.test(`${err.message} ${String((err as { cause?: unknown }).cause ?? '')}`);
      result.rejected.push({ index, table: name, id: row.id, code: duplicateVisit ? 'already_checked_in' : 'invalid_input' });
      continue;
    }

    if (name === 'member' && row.deleted_at && !existing?.deleted_at) {
      await deleteMemberDocuments(db, c.env.BUCKET, businessId, row.id, now);
    }
    result.applied++;
  }

  return c.json(result);
});
