import {
  digitsOnly,
  foldText,
  joinName,
  splitFullName,
  type MemberDetailResponse,
  memberInputSchema,
  memberPatchSchema,
  type MemberResponse,
  type MembersResponse,
  membersQuerySchema,
  membershipPeriod,
  membersFromTable,
  membersImportInputSchema,
  type MembersImportReadResponse,
  type MembersImportResponse,
  readTable,
  SpreadsheetError,
} from '@prana/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { document, member, membership, offering, payment, plan, session, visit } from '../db/schema';
import type { AppEnv, Db } from '../env';
import { ApiError } from '../errors';
import { deleteMemberDocuments } from '../lib/documents';
import { blankToNull, created, ctx, owned, parseBody, parseQuery, publicRow, removed, touched } from '../lib/http';
import { loadMemberFacts, summaryFor, toSummary } from '../lib/members';

export const members = new Hono<AppEnv>();

/**
 * The three name columns from what was sent: first and last name, or a full name split at the first space.
 * Returns null when nothing about the name was sent.
 */
function names(input: { first_name?: string; last_name?: string; full_name?: string }, current?: { first_name: string; last_name: string }) {
  if (input.first_name !== undefined || input.last_name !== undefined) {
    const first_name = (input.first_name ?? current?.first_name ?? '').trim();
    const last_name = (input.last_name ?? current?.last_name ?? '').trim();
    return { first_name, last_name, full_name: joinName(first_name, last_name) };
  }
  if (input.full_name !== undefined) {
    const split = splitFullName(input.full_name);
    return { ...split, full_name: joinName(split.first_name, split.last_name) };
  }
  return null;
}

members.get('/', async (c) => {
  const { db, businessId, today } = ctx(c);
  const query = parseQuery(c, membersQuerySchema);

  const [rows, facts] = await Promise.all([
    db
      .select()
      .from(member)
      .where(and(eq(member.business_id, businessId), isNull(member.deleted_at))),
    loadMemberFacts(db, businessId, today),
  ]);

  let list = rows;
  if (query.q) {
    const q = foldText(query.q);
    const qDigits = digitsOnly(query.q);
    list = rows.filter(
      (m) =>
        foldText(m.full_name).includes(q) ||
        (m.email !== null && foldText(m.email).includes(q)) ||
        (qDigits.length >= 3 && m.phone !== null && digitsOnly(m.phone).includes(qDigits)),
    );
  }

  const summaries = list.map((m) => toSummary(m, facts.get(m.id))).sort((a, b) => a.full_name.localeCompare(b.full_name, 'hr'));
  const counts = { all: summaries.length, active: 0, expiring: 0, unpaid: 0, frozen: 0, trial: 0, none: 0 };
  for (const s of summaries) counts[s.status]++;

  const body: MembersResponse = {
    members: query.status ? summaries.filter((s) => s.status === query.status) : summaries,
    counts,
  };
  return c.json(body);
});

members.post('/', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, memberInputSchema);
  if (!input.consent_accuracy) throw new ApiError('consent_required');
  const name = names(input);
  if (!name?.first_name) throw new ApiError('invalid_input', ['first_name']);

  const row = {
    ...created(businessId, now),
    ...name,
    email: blankToNull(input.email)?.toLowerCase() ?? null,
    phone: blankToNull(input.phone),
    dob: input.dob ?? null,
    is_student_or_retired: input.is_student_or_retired ?? false,
    health_flag: input.health_flag ?? false,
    health_text: blankToNull(input.health_text),
    consent_accuracy: true,
    consent_news: input.consent_news ?? false,
    signed_place: blankToNull(input.signed_place),
    signed_date: input.signed_date ?? null,
    member_since: input.member_since ?? today,
    notes: blankToNull(input.notes),
  };

  if (input.plan_id || input.plan_code) {
    const [chosen] = await db
      .select()
      .from(plan)
      .where(and(eq(plan.business_id, businessId), input.plan_id ? eq(plan.id, input.plan_id) : eq(plan.code, input.plan_code!), isNull(plan.deleted_at)))
      .limit(1);
    if (!chosen) throw new ApiError('invalid_input', [input.plan_id ? 'plan_id' : 'plan_code']);
    const period = membershipPeriod(chosen.code, row.member_since);
    const first = {
      ...created(businessId, now),
      member_id: row.id,
      plan_id: chosen.id,
      period_start: period.start,
      period_end: period.end,
      frozen_until: null,
    };
    // Paid at sign-up: the plan's price, recorded against the first membership. A plan without a price has nothing to pay.
    const paid =
      input.paid_with && chosen.price_cents !== null && chosen.price_cents > 0
        ? { ...created(businessId, now), member_id: row.id, membership_id: first.id, amount_cents: chosen.price_cents, currency: 'EUR' as const, method: input.paid_with, paid_at: now, note: null }
        : null;
    // Member, first membership and payment are written together or not at all.
    await db.batch([db.insert(member).values(row), db.insert(membership).values(first), ...(paid ? [db.insert(payment).values(paid)] : [])]);
  } else {
    await db.insert(member).values(row);
  }

  const body: MemberResponse = { member: publicRow(row), summary: await summaryFor(db, row, today) };
  return c.json(body, 201);
});

const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024;

type Person = { first_name: string; last_name: string; email?: string | null };

/** Keys that make two members the same person: the folded full name, and the e-mail. */
function sameness(existing: { full_name: string; email: string | null }[]) {
  const names = new Set(existing.map((m) => foldText(m.full_name)));
  const emails = new Set(existing.flatMap((m) => (m.email ? [m.email.toLowerCase()] : [])));
  return {
    has: (m: Person) => names.has(foldText(joinName(m.first_name, m.last_name))) || (!!m.email && emails.has(m.email.toLowerCase())),
    add: (m: Person) => {
      names.add(foldText(joinName(m.first_name, m.last_name)));
      if (m.email) emails.add(m.email.toLowerCase());
    },
  };
}

function existingMembers(db: Db, businessId: string) {
  return db
    .select({ full_name: member.full_name, email: member.email })
    .from(member)
    .where(and(eq(member.business_id, businessId), isNull(member.deleted_at)));
}

/** A CSV or .xlsx file in, the members it lists out, marked when already there. Saves nothing. */
members.post('/import/read', async (c) => {
  const { db, businessId } = ctx(c);
  let form: Record<string, string | File>;
  try {
    form = await c.req.parseBody();
  } catch {
    throw new ApiError('invalid_input', ['file']);
  }
  const file = form.file;
  if (!(file instanceof File)) throw new ApiError('invalid_input', ['file']);
  if (file.size > MAX_SPREADSHEET_BYTES) throw new ApiError('file_too_large');

  let table;
  try {
    table = membersFromTable(await readTable(new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    const reason = error instanceof SpreadsheetError ? error.reason : 'unreadable';
    throw new ApiError(reason === 'old_excel' ? 'spreadsheet_old_excel' : reason === 'no_name_column' ? 'spreadsheet_no_names' : 'spreadsheet_unreadable');
  }

  const known = sameness(await existingMembers(db, businessId));
  const rows = table.rows.map((row) => {
    const duplicate = known.has(row);
    known.add(row);
    return { ...row, duplicate };
  });
  const body: MembersImportReadResponse = { columns: table.columns, rows };
  return c.json(body);
});

/** Adds the previewed members in one go; anyone already there (or listed twice) is skipped, not doubled. */
members.post('/import', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, membersImportInputSchema);
  if (!input.consent_accuracy) throw new ApiError('consent_required');

  const known = sameness(await existingMembers(db, businessId));
  const rows = [];
  for (const m of input.members) {
    if (known.has(m)) continue;
    known.add(m);
    const first_name = m.first_name.trim();
    const last_name = m.last_name.trim();
    rows.push({
      ...created(businessId, now),
      first_name,
      last_name,
      full_name: joinName(first_name, last_name),
      email: blankToNull(m.email)?.toLowerCase() ?? null,
      phone: blankToNull(m.phone),
      dob: m.dob ?? null,
      is_student_or_retired: m.is_student_or_retired ?? false,
      health_flag: false,
      health_text: null,
      consent_accuracy: true,
      consent_news: false,
      signed_place: null,
      signed_date: null,
      member_since: m.member_since ?? today,
      notes: blankToNull(m.notes),
    });
  }

  // One statement for the lot: D1 limits bound values per statement and queries per request, so the rows go in as
  // a single JSON value that SQLite unpacks. A statement is all or nothing.
  if (rows.length) {
    const columns = Object.keys(rows[0]!) as (keyof (typeof rows)[number])[];
    const json = JSON.stringify(rows.map((row) => columns.map((k) => (typeof row[k] === 'boolean' ? (row[k] ? 1 : 0) : row[k]))));
    const picks = columns.map((_, i) => `json_extract(value, '$[${i}]')`).join(', ');
    await db.run(sql.raw(`INSERT INTO member (${columns.join(', ')}) SELECT ${picks} FROM json_each(`).append(sql`${json})`));
  }

  const body: MembersImportResponse = { created: rows.length, skipped: input.members.length - rows.length };
  return c.json(body, 201);
});

members.get('/:id', async (c) => {
  const { db, businessId, today } = ctx(c);
  const row = await owned(db, member, c.req.param('id'), businessId);

  const [summary, visits, payments, documents] = await Promise.all([
    summaryFor(db, row, today),
    db
      .select({
        id: visit.id,
        session_id: visit.session_id,
        checked_in_at: visit.checked_in_at,
        starts_at: session.starts_at,
        offering_name: offering.name,
        color_token: offering.color_token,
      })
      .from(visit)
      .innerJoin(session, eq(session.id, visit.session_id))
      .innerJoin(offering, eq(offering.id, session.offering_id))
      .where(and(eq(visit.member_id, row.id), eq(visit.business_id, businessId), isNull(visit.deleted_at)))
      .orderBy(desc(visit.checked_in_at))
      .limit(10),
    db
      .select({ row: payment, plan_name: plan.name })
      .from(payment)
      .leftJoin(membership, eq(membership.id, payment.membership_id))
      .leftJoin(plan, eq(plan.id, membership.plan_id))
      .where(and(eq(payment.member_id, row.id), eq(payment.business_id, businessId), isNull(payment.deleted_at)))
      .orderBy(desc(payment.paid_at)),
    db
      .select()
      .from(document)
      .where(and(eq(document.member_id, row.id), eq(document.business_id, businessId), isNull(document.deleted_at)))
      .orderBy(desc(document.created_at)),
  ]);

  const body: MemberDetailResponse = {
    member: publicRow(row),
    summary,
    visits,
    payments: payments.map((p) => ({ ...publicRow(p.row), member_name: row.full_name, plan_name: p.plan_name })),
    documents: documents.map(publicRow),
  };
  return c.json(body);
});

members.patch('/:id', async (c) => {
  const { db, businessId, now, today } = ctx(c);
  const input = await parseBody(c, memberPatchSchema);
  const existing = await owned(db, member, c.req.param('id'), businessId);
  // The consent can't be withdrawn by an edit; a member without it is deleted instead.
  if (input.consent_accuracy === false) throw new ApiError('consent_required');

  const name = names(input, existing);
  if (name && !name.first_name) throw new ApiError('invalid_input', ['first_name']);
  const patch = {
    ...input,
    ...(name ?? {}),
    ...('email' in input ? { email: blankToNull(input.email)?.toLowerCase() ?? null } : {}),
    ...('phone' in input ? { phone: blankToNull(input.phone) } : {}),
    ...('health_text' in input ? { health_text: blankToNull(input.health_text) } : {}),
    ...('signed_place' in input ? { signed_place: blankToNull(input.signed_place) } : {}),
    ...('notes' in input ? { notes: blankToNull(input.notes) } : {}),
    ...touched(now),
  };
  await db.update(member).set(patch).where(eq(member.id, existing.id));

  const row = { ...existing, ...patch };
  const body: MemberResponse = { member: publicRow(row), summary: await summaryFor(db, row, today) };
  return c.json(body);
});

members.delete('/:id', async (c) => {
  const { db, businessId, now } = ctx(c);
  const row = await owned(db, member, c.req.param('id'), businessId);
  await deleteMemberDocuments(db, c.env.BUCKET, businessId, row.id, now);
  await db.update(member).set(removed(now)).where(eq(member.id, row.id));
  return c.body(null, 204);
});
