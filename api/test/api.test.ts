import { addDays, localDate, type MemberSummary, monthPeriodEnd, routes, uuidv7 } from '@prana/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApi } from '@prana/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEED } from '../src/seed';
import { setup, type TestApi } from './helpers';

// Runs against the dev seed: 8 sample members covering every status, 5 weeks of sessions.
let t: TestApi;
const today = localDate(new Date());
beforeAll(async () => {
  t = await setup('dev');
});
afterAll(() => t.dispose());

const byName = (list: MemberSummary[], name: string) => list.find((m) => m.full_name === name)!;

describe('members', () => {
  it('lists members with the status derived by the API', async () => {
    const { status, body } = await t.call('GET', '/members');
    expect(status).toBe(200);
    expect(body.counts).toEqual({ all: 8, active: 2, expiring: 2, unpaid: 1, frozen: 1, trial: 1, none: 1 });
    expect(body.members.map((m: MemberSummary) => m.full_name)).toEqual([...body.members.map((m: MemberSummary) => m.full_name)].sort((a, b) => a.localeCompare(b, 'hr')));

    const ana = byName(body.members, 'Ana Horvat');
    expect(ana).toMatchObject({ status: 'expiring', days_left: 3, debt_cents: 0 });
    expect(ana.membership).toMatchObject({ plan_code: '2x', plan_name: '2× tjedno', visits_used: 6, visits_total: 8, paid_cents: 8500 });
    expect(ana.last_visit_at).toBeTruthy();

    expect(byName(body.members, 'Marko Kovač')).toMatchObject({ status: 'unpaid', debt_cents: 6500 });
    expect(byName(body.members, 'Petra Novak').status).toBe('frozen');
    expect(byName(body.members, 'Luka Jurić').status).toBe('trial');
    expect(byName(body.members, 'Maja Perić').status).toBe('active');
    expect(byName(body.members, 'Ivan Knežević')).toMatchObject({ status: 'none', membership: null, days_left: null });
    // The health note is there for the list's tag, and only when flagged.
    expect(byName(body.members, 'Iva Babić')).toMatchObject({ health_flag: true, health_text: expect.stringContaining('Hernija') });
    expect(ana.health_text).toBeNull();
  });

  it('filters by status and searches name, e-mail and phone without diacritics', async () => {
    const unpaid = await t.call('GET', '/members?status=unpaid');
    expect(unpaid.body.members.map((m: MemberSummary) => m.full_name)).toEqual(['Marko Kovač']);
    expect(unpaid.body.counts.all).toBe(8);

    expect((await t.call('GET', '/members?q=simic')).body.members.map((m: MemberSummary) => m.full_name)).toEqual(['Nina Šimić']);
    expect((await t.call('GET', '/members?q=IVA.BABIC@')).body.members).toHaveLength(1);
    expect((await t.call('GET', '/members?q=098%20765')).body.members.map((m: MemberSummary) => m.full_name)).toEqual(['Marko Kovač']);
    expect((await t.call('GET', '/members?status=nonsense')).status).toBe(400);
  });

  it('shows a profile with visits, payments and documents', async () => {
    const { status, body } = await t.call('GET', `/members/${SEED.member(0)}`);
    expect(status).toBe(200);
    expect(body.member).toMatchObject({ full_name: 'Ana Horvat', dob: '1988-03-14', is_student_or_retired: true, consent_accuracy: true });
    expect(body.member).not.toHaveProperty('changed_at');
    expect(body.summary.status).toBe('expiring');
    expect(body.visits).toHaveLength(6);
    expect(body.visits[0]).toMatchObject({ offering_name: expect.any(String), color_token: expect.stringMatching(/^class-/) });
    expect(body.payments).toEqual([expect.objectContaining({ amount_cents: 8500, method: 'cash', plan_name: '2× tjedno', currency: 'EUR' })]);
    expect(body.documents).toEqual([]);
  });

  it('saves nothing without the accuracy consent or a name', async () => {
    const noConsent = await t.call('POST', '/members', { body: { full_name: 'Bez Privole', consent_accuracy: false } });
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.error).toMatchObject({ code: 'consent_required', message_hr: 'Potrebna je potvrda točnosti podataka.' });

    const noName = await t.call('POST', '/members', { body: { full_name: '  ', consent_accuracy: true } });
    expect(noName.body.error).toMatchObject({ code: 'invalid_input', fields: ['full_name'] });

    const badEmail = await t.call('POST', '/members', { body: { full_name: 'Test', email: 'not-an-email', dob: '14.03.1988.', consent_accuracy: true } });
    expect(badEmail.body.error.fields.sort()).toEqual(['dob', 'email']);

    expect((await t.call('GET', '/members')).body.counts.all).toBe(8);
  });

  it('adds a member, with a first membership when a plan is chosen', async () => {
    const { status, body } = await t.call('POST', '/members', {
      body: { full_name: 'Lucija Perić', email: 'Lucija.Peric@Example.com', phone: ' 098 761 4321 ', dob: '1991-07-22', health_flag: true, health_text: 'Bol u lijevom koljenu', consent_accuracy: true, consent_news: true, signed_place: 'Zagreb', signed_date: today, plan_code: '2x' },
    });
    expect(status).toBe(201);
    expect(body.member).toMatchObject({ full_name: 'Lucija Perić', email: 'lucija.peric@example.com', phone: '098 761 4321', member_since: today, consent_news: true });
    expect(body.member.id).toMatch(/^[0-9a-f-]{36}$/);
    // Dev plans have a price, so a new membership starts out unpaid.
    expect(body.summary).toMatchObject({ status: 'unpaid', debt_cents: 8500 });
    expect(body.summary.membership).toMatchObject({ plan_code: '2x', period_start: today, period_end: monthPeriodEnd(today), visits_used: 0 });

    const plain = await t.call('POST', '/members', { body: { full_name: 'Bez Članarine', consent_accuracy: true } });
    expect(plain.status).toBe(201);
    expect(plain.body.summary).toMatchObject({ status: 'none', membership: null });
    expect(plain.body.member).toMatchObject({ email: null, health_flag: false, is_student_or_retired: false });
  });

  it('edits a member; the consent cannot be withdrawn by an edit', async () => {
    const id = SEED.member(5);
    const { status, body } = await t.call('PATCH', `/members/${id}`, { body: { phone: '091 000 1111', notes: '' } });
    expect(status).toBe(200);
    expect(body.member).toMatchObject({ full_name: 'Maja Perić', phone: '091 000 1111', notes: null });
    expect((await t.call('PATCH', `/members/${id}`, { body: { consent_accuracy: false } })).status).toBe(400);
    expect((await t.call('PATCH', `/members/${uuidv7()}`, { body: { phone: '1' } })).status).toBe(404);
  });
});

describe('staff', () => {
  it('lists the business\u2019s staff without sign-in details', async () => {
    const { status, body } = await t.call('GET', '/staff');
    expect(status).toBe(200);
    expect(body.staff).toEqual([expect.objectContaining({ id: SEED.owner, name: 'Mario', role: 'owner' })]);
    expect(body.staff[0]).not.toHaveProperty('firebase_uid');
  });
});

describe('class types', () => {
  it('lists the seeded group and the five classes as templates', async () => {
    const groups = await t.call('GET', '/offering-groups');
    expect(groups.body.groups.map((g: { name: string }) => g.name)).toEqual(['Joga']);

    const { body } = await t.call('GET', '/offerings');
    expect(body.offerings.map((o: { name: string }) => o.name)).toEqual(['Joga za kralježnicu', 'Ashtanga Mysore', 'Restorativna joga', 'Black Lotus Yoga', 'Pranayama & meditacija']);
    expect(body.offerings[1]).toMatchObject({ color_token: 'class-ashtanga', default_duration_min: 120, entry_rule: 'Ulaz do 60 min nakon početka', active: true });
    // The sample week has 10 sessions.
    expect(body.offerings.reduce((n: number, o: { sessions_this_week: number }) => n + o.sessions_this_week, 0)).toBe(10);
  });

  it('adds a group and a class type, and edits it', async () => {
    const group = await t.call('POST', '/offering-groups', { body: { name: 'Masaže' } });
    expect(group.status).toBe(201);
    expect(group.body.group).toMatchObject({ name: 'Masaže', sort: 1 });

    const made = await t.call('POST', '/offerings', { body: { group_id: group.body.group.id, name: 'Masaža leđa', color_token: 'class-workshop', default_duration_min: 45 } });
    expect(made.status).toBe(201);
    expect(made.body.offering).toMatchObject({ name: 'Masaža leđa', active: true, default_capacity: null, entry_rule: null });

    const edited = await t.call('PATCH', `/offerings/${made.body.offering.id}`, { body: { default_capacity: 1, active: false } });
    expect(edited.body.offering).toMatchObject({ default_capacity: 1, active: false, name: 'Masaža leđa' });

    expect((await t.call('POST', '/offerings', { body: { group_id: uuidv7(), name: 'X', color_token: 'class-spine', default_duration_min: 60 } })).status).toBe(404);
    expect((await t.call('POST', '/offerings', { body: { group_id: SEED.group, name: 'X', color_token: 'purple', default_duration_min: 60 } })).status).toBe(400);
  });
});

describe('sessions and check-in', () => {
  let sessionId: string;
  let memberId: string;
  const startsAt = `${addDays(today, 2)}T16:00:00.000Z`;

  it('schedules a session from a class type; the end comes from its duration', async () => {
    const { status, body } = await t.call('POST', '/sessions', { body: { offering_id: SEED.offerings.ashtanga, starts_at: startsAt, capacity: 2 } });
    expect(status).toBe(201);
    expect(body.session).toMatchObject({
      offering_name: 'Ashtanga Mysore',
      color_token: 'class-ashtanga',
      starts_at: startsAt,
      ends_at: `${addDays(today, 2)}T18:00:00.000Z`,
      location_id: SEED.location,
      booked: 0,
      effective_capacity: 2,
      teacher_name: null,
    });
    sessionId = body.session.id;
  });

  it('lists sessions for a date range, earliest first', async () => {
    const day = localDate(startsAt);
    const { body } = await t.call('GET', `/sessions?from=${day}&to=${day}`);
    expect(body.sessions.some((s: { id: string }) => s.id === sessionId)).toBe(true);
    const starts = body.sessions.map((s: { starts_at: string }) => s.starts_at);
    expect(starts).toEqual([...starts].sort());
    for (const s of body.sessions) expect(localDate(s.starts_at)).toBe(day);

    // Default: this week, Monday to Sunday. The seed puts 10 sessions in it.
    const week = await t.call('GET', '/sessions');
    expect(week.body.sessions.length).toBeGreaterThanOrEqual(10);
  });

  it('checks a member in, and the visit counts toward the membership', async () => {
    const made = await t.call('POST', '/members', { body: { full_name: 'Tea Marić', consent_accuracy: true, plan_code: '1x' } });
    memberId = made.body.member.id;
    expect(made.body.summary.membership.visits_used).toBe(0);

    const { status, body } = await t.call('POST', `/sessions/${sessionId}/visits`, { body: { member_id: memberId } });
    expect(status).toBe(201);
    expect(body.visit).toMatchObject({ member_id: memberId, session_id: sessionId, membership_id: made.body.summary.membership.id });
    expect(body.summary.membership).toMatchObject({ visits_used: 1, visits_total: 4 });
    expect(body.summary.last_visit_at).toBe(body.visit.checked_in_at);

    const again = await t.call('POST', `/sessions/${sessionId}/visits`, { body: { member_id: memberId } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_checked_in');

    const detail = await t.call('GET', `/sessions/${sessionId}`);
    expect(detail.body.session.booked).toBe(1);
    expect(detail.body.attendees).toEqual([expect.objectContaining({ member_id: memberId, full_name: 'Tea Marić', visit_id: body.visit.id })]);

    // Undoing the check-in gives the visit back, and the member can be checked in again.
    expect((await t.call('DELETE', `/visits/${body.visit.id}`)).status).toBe(204);
    expect((await t.call('GET', `/members/${memberId}`)).body.summary.membership.visits_used).toBe(0);
    expect((await t.call('POST', `/sessions/${sessionId}/visits`, { body: { member_id: memberId } })).status).toBe(201);
  });

  it('checks in a member without a membership, tied to no membership', async () => {
    const { status, body } = await t.call('POST', `/sessions/${sessionId}/visits`, { body: { member_id: SEED.member(7) } });
    expect(status).toBe(201);
    expect(body.visit.membership_id).toBeNull();
    expect(body.summary.status).toBe('none');
  });

  it('moves a session keeping its length, and deletes it with its check-ins', async () => {
    const moved = await t.call('PATCH', `/sessions/${sessionId}`, { body: { starts_at: `${addDays(today, 3)}T07:00:00.000Z`, note: 'Zamjena' } });
    expect(moved.body.session).toMatchObject({ starts_at: `${addDays(today, 3)}T07:00:00.000Z`, ends_at: `${addDays(today, 3)}T09:00:00.000Z`, note: 'Zamjena', booked: 2 });
    expect((await t.call('PATCH', `/sessions/${sessionId}`, { body: { ends_at: `${addDays(today, 3)}T06:00:00.000Z` } })).status).toBe(400);

    expect((await t.call('DELETE', `/sessions/${sessionId}`)).status).toBe(204);
    expect((await t.call('GET', `/sessions/${sessionId}`)).status).toBe(404);
    expect((await t.call('GET', `/members/${memberId}`)).body.summary.membership.visits_used).toBe(0);
  });
});

describe('plans, memberships and payments', () => {
  it('lists the five plans and lets the owner set a price', async () => {
    const { body } = await t.call('GET', '/plans');
    expect(body.plans.map((p: { code: string; visits_per_month: number | null }) => [p.code, p.visits_per_month])).toEqual([
      ['1x', 4],
      ['2x', 8],
      ['3x', 12],
      ['unl', null],
      ['trial', 1],
    ]);
    const edited = await t.call('PATCH', `/plans/${SEED.plans.trial}`, { body: { price_cents: 1000 } });
    expect(edited.body.plan).toMatchObject({ code: 'trial', price_cents: 1000 });
    // The trial member now owes the new price…
    expect(byName((await t.call('GET', '/members')).body.members, 'Luka Jurić')).toMatchObject({ status: 'unpaid', debt_cents: 1000 });
    // …and is a trial again once the price is cleared.
    await t.call('PATCH', `/plans/${SEED.plans.trial}`, { body: { price_cents: null } });
    expect(byName((await t.call('GET', '/members')).body.members, 'Luka Jurić').status).toBe('trial');
  });

  it('records a payment against the current membership, which clears "unpaid"', async () => {
    const marko = SEED.member(1);
    const part = await t.call('POST', '/payments', { body: { member_id: marko, amount_cents: 2000, method: 'cash' } });
    expect(part.status).toBe(201);
    expect(part.body.payment).toMatchObject({ amount_cents: 2000, currency: 'EUR', method: 'cash', membership_id: expect.any(String) });
    expect(part.body.summary).toMatchObject({ status: 'unpaid', debt_cents: 4500 });

    const rest = await t.call('POST', '/payments', { body: { member_id: marko, amount_cents: 4500, method: 'transfer', note: 'Ostatak' } });
    expect(rest.body.summary).toMatchObject({ status: 'active', debt_cents: 0 });

    expect((await t.call('POST', '/payments', { body: { member_id: marko, amount_cents: 0, method: 'cash' } })).status).toBe(400);
    expect((await t.call('POST', '/payments', { body: { member_id: marko, amount_cents: 100, method: 'crypto' } })).status).toBe(400);
  });

  it('lists payments for a period with the total', async () => {
    const { body } = await t.call('GET', `/payments?from=${today}&to=${today}`);
    const marko = body.payments.filter((p: { member_name: string }) => p.member_name === 'Marko Kovač');
    expect(marko.map((p: { amount_cents: number }) => p.amount_cents).sort()).toEqual([2000, 4500]);
    expect(marko[0]).toMatchObject({ plan_name: '1× tjedno' });
    expect(body.total_cents).toBe(body.payments.reduce((n: number, p: { amount_cents: number }) => n + p.amount_cents, 0));
    expect(body).toMatchObject({ from: today, to: today, currency: 'EUR' });
  });

  it('freezes and unfreezes a membership', async () => {
    const maja = await t.call('GET', `/members/${SEED.member(5)}`);
    const id = maja.body.summary.membership.id;
    const frozen = await t.call('POST', `/memberships/${id}/freeze`, { body: { until: addDays(today, 10) } });
    expect(frozen.status).toBe(200);
    expect(frozen.body.membership.frozen_until).toBe(addDays(today, 10));
    expect(frozen.body.summary.status).toBe('frozen');
    const lifted = await t.call('POST', `/memberships/${id}/freeze`, { body: { until: null } });
    expect(lifted.body.summary.status).toBe('active');
  });

  it('renews: the next month starts the day after the current one ends', async () => {
    const ana = await t.call('GET', `/members/${SEED.member(0)}`);
    const current = ana.body.summary.membership;
    const { status, body } = await t.call('POST', `/memberships/${current.id}/renew`, { body: {} });
    expect(status).toBe(201);
    expect(body.membership).toMatchObject({ plan_id: current.plan_id, period_start: addDays(current.period_end, 1), period_end: monthPeriodEnd(addDays(current.period_end, 1)) });
    // Still on the current period, but no longer flagged as expiring.
    expect(body.summary).toMatchObject({ status: 'active', days_left: 3 });
    expect(body.summary.membership.id).toBe(current.id);
  });

  it('starts a membership for a member who has none', async () => {
    const { status, body } = await t.call('POST', '/memberships', { body: { member_id: SEED.member(7), plan_id: SEED.plans.trial } });
    expect(status).toBe(201);
    expect(body.membership).toMatchObject({ period_start: today, period_end: monthPeriodEnd(today) });
    expect(body.summary.status).toBe('trial');
    expect((await t.call('POST', '/memberships', { body: { member_id: SEED.member(7), plan_id: SEED.plans['1x'], period_start: today, period_end: addDays(today, -1) } })).status).toBe(400);
  });
});

describe('dashboard', () => {
  it('matches the member list', async () => {
    const [{ body }, list] = await Promise.all([t.call('GET', '/dashboard'), t.call('GET', '/members')]);
    const members: MemberSummary[] = list.body.members;
    const counts = list.body.counts;

    expect(body.date).toBe(today);
    expect(body.counts.active_members).toBe(counts.all - counts.none - counts.frozen);
    expect(body.counts.debts_total_cents).toBe(members.reduce((n, m) => n + m.debt_cents, 0));
    expect(body.counts.unpaid_members).toBe(members.filter((m) => m.debt_cents > 0).length);
    expect(body.counts.expiring_this_week).toBeGreaterThanOrEqual(counts.expiring);
    expect(body.counts.payments_this_month_cents).toBeGreaterThan(0);

    // "Za provjeru": everyone unpaid or expiring, unpaid first.
    const expected = members.filter((m) => m.status === 'unpaid' || m.status === 'expiring').map((m) => m.id);
    expect(body.attention.map((m: MemberSummary) => m.id).sort()).toEqual(expected.sort());
    const statuses = body.attention.map((m: MemberSummary) => m.status);
    expect(statuses).toEqual([...statuses].sort((a, b) => (a === b ? 0 : a === 'unpaid' ? -1 : 1)));

    for (const s of body.today) expect(localDate(s.starts_at)).toBe(today);
    for (const s of body.tomorrow) expect(localDate(s.starts_at)).toBe(addDays(today, 1));
  });

  it('can be asked about another day', async () => {
    const monday = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    const { body } = await t.call('GET', `/dashboard?date=${monday}`);
    expect(body.today.map((s: { offering_name: string }) => s.offering_name)).toEqual(['Joga za kralježnicu', 'Ashtanga Mysore']);
    expect(body.tomorrow.map((s: { offering_name: string }) => s.offering_name)).toEqual(['Restorativna joga']);
  });
});

describe('documents', () => {
  const pdf = new TextEncoder().encode('%PDF-1.4\n% a small test file\n');
  let documentId: string;
  let memberId: string;

  const upload = (bytes: Uint8Array, name: string, type: string, source?: string) => {
    const form = new FormData();
    form.append('file', new File([bytes], name, { type }));
    if (source) form.append('source', source);
    return t.call('POST', '/documents', { form });
  };

  it('stores an uploaded upisnica privately and serves it back only through the API', async () => {
    const { status, body } = await upload(pdf, 'upisnica-lucija.pdf', 'application/pdf');
    expect(status).toBe(201);
    expect(body.document).toMatchObject({ kind: 'upisnica', mime: 'application/pdf', source: 'pdf', filename: 'upisnica-lucija.pdf', size_bytes: pdf.byteLength, member_id: null });
    expect(body.document).not.toHaveProperty('r2_key');
    documentId = body.document.id;

    const stored = await t.env.BUCKET.get(`${SEED.business}/documents/${documentId}`);
    expect(stored).not.toBeNull();

    const file = await t.call('GET', `/documents/${documentId}/file`);
    expect(file.status).toBe(200);
    expect(file.res.headers.get('Content-Type')).toBe('application/pdf');
    expect(file.res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(new Uint8Array(await file.res.arrayBuffer())).toEqual(pdf);

    expect((await t.call('GET', `/documents/${documentId}/file`, { token: null })).status).toBe(401);
  });

  it('goes by what the file is, not what it is called', async () => {
    const text = await upload(new TextEncoder().encode('just some text'), 'upisnica.pdf', 'application/pdf');
    expect(text.status).toBe(415);
    expect(text.body.error.code).toBe('unsupported_file');

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const photo = await upload(png, 'photo.bin', 'application/octet-stream', 'camera');
    expect(photo.status).toBe(201);
    expect(photo.body.document).toMatchObject({ mime: 'image/png', source: 'camera' });

    const empty = new FormData();
    expect((await t.call('POST', '/documents', { form: empty })).status).toBe(400);
  });

  it('refuses files over 20 MB', async () => {
    const big = new Uint8Array(20 * 1024 * 1024 + 1);
    big.set(pdf);
    const { status, body } = await upload(big, 'big.pdf', 'application/pdf');
    expect(status).toBe(413);
    expect(body.error.message_hr).toBe('Datoteka je veća od 20 MB.');
  });

  it('links the document to the saved member with the recognised fields', async () => {
    const made = await t.call('POST', '/members', { body: { full_name: 'Dora Vuković', consent_accuracy: true } });
    memberId = made.body.member.id;
    const ocr = { name: 'Dora Vuković', needsReview: ['phone'], confidence: { name: 0.98, phone: 0.41 } };
    const { status, body } = await t.call('PATCH', `/documents/${documentId}`, { body: { member_id: memberId, ocr_json: ocr } });
    expect(status).toBe(200);
    expect(body.document).toMatchObject({ member_id: memberId, ocr_json: ocr });

    const profile = await t.call('GET', `/members/${memberId}`);
    expect(profile.body.documents).toEqual([expect.objectContaining({ id: documentId, ocr_json: ocr, filename: 'upisnica-lucija.pdf' })]);
    expect((await t.call('PATCH', `/documents/${documentId}`, { body: { member_id: uuidv7() } })).status).toBe(404);
  });

  it('deleting the member deletes their stored file', async () => {
    expect((await t.call('DELETE', `/members/${memberId}`)).status).toBe(204);
    expect(await t.env.BUCKET.get(`${SEED.business}/documents/${documentId}`)).toBeNull();
    expect((await t.call('GET', `/documents/${documentId}/file`)).status).toBe(404);
    expect((await t.call('GET', `/members/${memberId}`)).status).toBe(404);
    expect((await t.call('GET', '/members?q=Dora')).body.members).toEqual([]);
  });

  it('deletes a document that was never saved to a member', async () => {
    const { body } = await upload(pdf, 'odustao.pdf', 'application/pdf');
    expect((await t.call('DELETE', `/documents/${body.document.id}`)).status).toBe(204);
    expect(await t.env.BUCKET.get(`${SEED.business}/documents/${body.document.id}`)).toBeNull();
  });
});

describe('sync (iOS)', () => {
  let cursor: string;
  const id = uuidv7();
  const stamp = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
  const memberRow = (overrides: Record<string, unknown> = {}) => ({
    id,
    full_name: 'Offline Član',
    email: null,
    phone: null,
    dob: null,
    is_student_or_retired: false,
    health_flag: false,
    health_text: null,
    consent_accuracy: true,
    consent_news: false,
    signed_place: null,
    signed_date: null,
    member_since: today,
    notes: null,
    updated_at: stamp(),
    deleted_at: null,
    ...overrides,
  });

  it('pulls everything first, deleted rows included, without server-only columns', async () => {
    const { status, body } = await t.call('GET', '/sync');
    expect(status).toBe(200);
    expect(Object.keys(body.changes).sort()).toEqual(['document', 'location', 'member', 'membership', 'offering', 'offering_group', 'payment', 'plan', 'session', 'staff', 'visit']);
    expect(body.changes.plan).toHaveLength(5);
    expect(body.changes.member.some((m: { deleted_at: string | null }) => m.deleted_at !== null)).toBe(true);
    const text = JSON.stringify(body);
    expect(text).not.toContain('r2_key');
    expect(text).not.toContain('firebase_uid');
    expect(text).not.toContain('changed_at');
    cursor = body.cursor;
  });

  it('pulls nothing when nothing changed', async () => {
    const { body } = await t.call('GET', `/sync?since=${encodeURIComponent(cursor)}`);
    expect(Object.values(body.changes).flat()).toEqual([]);
    expect(body.cursor).toBe(cursor);
  });

  it('pushes a row made offline; the next pull returns it', async () => {
    const push = await t.call('POST', '/sync', { body: { mutations: [{ table: 'member', row: memberRow() }] } });
    expect(push.body).toMatchObject({ applied: 1, conflicts: [], rejected: [] });

    const pull = await t.call('GET', `/sync?since=${encodeURIComponent(cursor)}`);
    expect(pull.body.changes.member).toEqual([expect.objectContaining({ id, full_name: 'Offline Član', business_id: SEED.business })]);
    expect((await t.call('GET', `/members/${id}`)).status).toBe(200);
    cursor = pull.body.cursor;
  });

  it('last write wins by updated_at; the older write comes back as a conflict', async () => {
    await t.call('PATCH', `/members/${id}`, { body: { full_name: 'Uređen Na Webu' } });

    const stale = await t.call('POST', '/sync', { body: { mutations: [{ table: 'member', row: memberRow({ full_name: 'Stara Izmjena', updated_at: stamp(-60_000) }) }] } });
    expect(stale.body.applied).toBe(0);
    expect(stale.body.conflicts).toEqual([expect.objectContaining({ index: 0, table: 'member', id, server: expect.objectContaining({ full_name: 'Uređen Na Webu' }) })]);
    expect((await t.call('GET', `/members/${id}`)).body.member.full_name).toBe('Uređen Na Webu');

    const newer = await t.call('POST', '/sync', { body: { mutations: [{ table: 'member', row: memberRow({ full_name: 'Nova Izmjena', updated_at: stamp(60_000) }) }] } });
    expect(newer.body.applied).toBe(1);
    expect((await t.call('GET', `/members/${id}`)).body.member.full_name).toBe('Nova Izmjena');
  });

  it('rejects rows it cannot accept and still applies the rest', async () => {
    const visitId = uuidv7();
    const session = (await t.call('GET', '/sessions')).body.sessions[0];
    const visit = { id: visitId, member_id: id, session_id: session.id, membership_id: null, checked_in_at: stamp(), updated_at: stamp(), deleted_at: null };
    const { body } = await t.call('POST', '/sync', {
      body: {
        mutations: [
          { table: 'member', row: memberRow({ id: uuidv7(), consent_accuracy: false }) },
          { table: 'member', row: { id: uuidv7(), full_name: 'Nepotpun' } },
          { table: 'visit', row: { ...visit, id: uuidv7(), member_id: uuidv7() } },
          { table: 'visit', row: visit },
          { table: 'visit', row: { ...visit, id: uuidv7() } },
        ],
      },
    });
    expect(body.applied).toBe(1);
    expect(body.rejected.map((r: { index: number; code: string }) => [r.index, r.code])).toEqual([
      [0, 'consent_required'],
      [1, 'invalid_input'],
      [2, 'invalid_input'],
      [4, 'already_checked_in'],
    ]);
    expect(body.rejected[2].fields).toEqual(['member_id']);
    expect((await t.call('POST', '/sync', { body: { mutations: [{ table: 'staff', row: {} }] } })).status).toBe(400);
  });

  it('a delete made offline is a row with deleted_at', async () => {
    const at = stamp(120_000);
    const { body } = await t.call('POST', '/sync', { body: { mutations: [{ table: 'member', row: memberRow({ updated_at: at, deleted_at: at }) }] } });
    expect(body.applied).toBe(1);
    expect((await t.call('GET', `/members/${id}`)).status).toBe(404);
  });
});

describe('business scope', () => {
  const other = { business: '01900000-0000-7000-8000-00000000b001', staff: '01900000-0000-7000-8000-00000000b002', member: '01900000-0000-7000-8000-00000000b003' };
  let token: string;

  beforeAll(async () => {
    const now = new Date().toISOString();
    await t.run([
      `INSERT INTO business (id, name, locale, timezone, created_at, updated_at) VALUES ('${other.business}', 'Drugi studio', 'hr', 'Europe/Zagreb', '${now}', '${now}')`,
      `INSERT INTO staff (id, business_id, firebase_uid, email, name, role, created_at, updated_at, deleted_at, changed_at) VALUES ('${other.staff}', '${other.business}', 'uid-other', 'other@example.com', 'Druga', 'owner', '${now}', '${now}', NULL, '${now}')`,
      `INSERT INTO member (id, business_id, full_name, member_since, consent_accuracy, created_at, updated_at, deleted_at, changed_at) VALUES ('${other.member}', '${other.business}', 'Tuđi Član', '${today}', 1, '${now}', '${now}', NULL, '${now}')`,
    ]);
    token = await t.sign({ uid: 'uid-other' });
  });

  it('staff of another business see only their own data', async () => {
    expect((await t.call('GET', '/me', { token })).body.business.name).toBe('Drugi studio');
    expect((await t.call('GET', '/members', { token })).body.members.map((m: MemberSummary) => m.full_name)).toEqual(['Tuđi Član']);
    expect((await t.call('GET', '/offerings', { token })).body.offerings).toEqual([]);
    expect((await t.call('GET', '/sessions', { token })).body.sessions).toEqual([]);
    expect((await t.call('GET', '/plans', { token })).body.plans).toEqual([]);
    expect((await t.call('GET', '/sync', { token })).body.changes.member).toHaveLength(1);
    expect((await t.call('GET', '/dashboard', { token })).body.counts.active_members).toBe(0);
  });

  it('and cannot read or change rows of the first one', async () => {
    const ana = SEED.member(0);
    expect((await t.call('GET', `/members/${ana}`, { token })).status).toBe(404);
    expect((await t.call('PATCH', `/members/${ana}`, { token, body: { full_name: 'Preuzeto' } })).status).toBe(404);
    expect((await t.call('DELETE', `/members/${ana}`, { token })).status).toBe(404);
    expect((await t.call('POST', '/payments', { token, body: { member_id: ana, amount_cents: 100, method: 'cash' } })).status).toBe(404);
    expect((await t.call('POST', '/memberships', { token, body: { member_id: other.member, plan_id: SEED.plans['1x'] } })).status).toBe(404);

    // Sync cannot overwrite a row that belongs elsewhere, or point at one.
    const at = new Date(Date.now() + 600_000).toISOString();
    const push = await t.call('POST', '/sync', {
      token,
      body: { mutations: [{ table: 'offering_group', row: { id: SEED.group, name: 'Preuzeto', sort: 0, updated_at: at, deleted_at: null } }] },
    });
    expect(push.body).toMatchObject({ applied: 0, rejected: [expect.objectContaining({ code: 'not_found' })] });

    expect((await t.call('GET', `/members/${ana}`)).body.member.full_name).toBe('Ana Horvat');
    expect((await t.call('GET', '/offering-groups')).body.groups[0].name).toBe('Joga');
  });
});

describe('the contract', () => {
  it('every documented route exists, and every route is documented', () => {
    const real = new Set(
      t.app.routes
        .filter((r) => r.method !== 'ALL')
        .map((r) => `${r.method} ${r.path.replace(/^\/api/, '').replace(/\/$/, '').replace(/:(\w+)/g, '{$1}')}`),
    );
    const documented = new Set(routes.map((r) => `${r.method.toUpperCase()} ${r.path}`));
    expect([...real].sort()).toEqual([...documented].sort());
  });

  it('docs/openapi.json is up to date (regenerate with `npm run openapi -w @prana/api`)', () => {
    const saved = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../docs/openapi.json'), 'utf8'));
    expect(saved).toEqual(JSON.parse(JSON.stringify(buildOpenApi())));
  });

  it('answers unknown paths and bad JSON with the standard error shape', async () => {
    const missing = await t.call('GET', '/nothing-here');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({ code: 'not_found', message_hr: expect.any(String), message_en: expect.any(String) });

    const res = await t.app.request('/api/members', { method: 'POST', headers: { Authorization: `Bearer ${t.ownerToken}`, 'Content-Type': 'application/json' }, body: '{not json' }, t.env);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid_input');
  });
});
