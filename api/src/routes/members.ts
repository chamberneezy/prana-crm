import {
  digitsOnly,
  foldText,
  type MemberDetailResponse,
  memberInputSchema,
  memberPatchSchema,
  type MemberResponse,
  type MembersResponse,
  membersQuerySchema,
  monthPeriodEnd,
} from '@prana/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { document, member, membership, offering, payment, plan, session, visit } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../errors';
import { deleteMemberDocuments } from '../lib/documents';
import { blankToNull, created, ctx, owned, parseBody, parseQuery, publicRow, removed, touched } from '../lib/http';
import { loadMemberFacts, summaryFor, toSummary } from '../lib/members';

export const members = new Hono<AppEnv>();

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

  const row = {
    ...created(businessId, now),
    full_name: input.full_name,
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

  if (input.plan_code) {
    const [chosen] = await db
      .select()
      .from(plan)
      .where(and(eq(plan.business_id, businessId), eq(plan.code, input.plan_code), isNull(plan.deleted_at)))
      .limit(1);
    if (!chosen) throw new ApiError('invalid_input', ['plan_code']);
    // Member and first membership are written together or not at all.
    await db.batch([
      db.insert(member).values(row),
      db.insert(membership).values({
        ...created(businessId, now),
        member_id: row.id,
        plan_id: chosen.id,
        period_start: row.member_since,
        period_end: monthPeriodEnd(row.member_since),
        frozen_until: null,
      }),
    ]);
  } else {
    await db.insert(member).values(row);
  }

  const body: MemberResponse = { member: publicRow(row), summary: await summaryFor(db, row, today) };
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

  const patch = {
    ...input,
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
