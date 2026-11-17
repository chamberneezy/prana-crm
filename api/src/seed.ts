import { STUDIO_PLACE, addDays, addMonths, type ColorToken, localDate, type PaymentMethod, type PlanCode, splitFullName, startOfWeek, TIME_ZONE, uuidv7, zonedTimeToUtc } from '@prana/shared';

/** The plans every studio starts with. The studio's own ones (`custom`) are added in the app. */
type StandardPlan = Exclude<PlanCode, 'custom'>;

/** Seed data as plain rows, turned into SQL by toSql(). Used by scripts/seed.ts and by the tests. */

type Value = string | number | boolean | null;
export interface SeedRow {
  table: string;
  row: Record<string, Value>;
}

// Fixed IDs (UUIDv7-shaped) so seeding twice never duplicates rows.
const fixedId = (n: number) => `01900000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

export const SEED = {
  business: fixedId(0x1),
  location: fixedId(0x2),
  group: fixedId(0x3),
  owner: fixedId(0x4),
  offerings: { spine: fixedId(0x11), ashtanga: fixedId(0x12), restorative: fixedId(0x13), blackLotus: fixedId(0x14), pranayama: fixedId(0x15) },
  plans: { '1x': fixedId(0x21), '2x': fixedId(0x22), '3x': fixedId(0x23), unl: fixedId(0x24), trial: fixedId(0x25) } satisfies Record<StandardPlan, string>,
  member: (n: number) => fixedId(0x100 + n),
  teachers: [fixedId(0x31), fixedId(0x32)],
  weekSlot: (n: number) => fixedId(0x80 + n),
};

type OfferingKey = keyof typeof SEED.offerings;

// The studio's real classes, from its weekly schedule poster. Templates only: no day or time.
const OFFERINGS: Array<{ key: OfferingKey; name: string; color_token: ColorToken; minutes: number; entry_rule: string | null }> = [
  { key: 'spine', name: 'Joga za kralježnicu', color_token: 'class-spine', minutes: 60, entry_rule: null },
  { key: 'ashtanga', name: 'Ashtanga Mysore', color_token: 'class-ashtanga', minutes: 120, entry_rule: 'Ulaz do 60 min nakon početka' },
  { key: 'restorative', name: 'Restorativna joga', color_token: 'class-restorative', minutes: 60, entry_rule: null },
  { key: 'blackLotus', name: 'Black Lotus Yoga', color_token: 'class-black-lotus', minutes: 75, entry_rule: null },
  { key: 'pranayama', name: 'Pranayama & meditacija', color_token: 'class-pranayama', minutes: 30, entry_rule: 'Slobodan ulaz' },
];

// The studio's usual week, from its schedule poster (week of 8 November 2026), Mon–Sun:
// [weekday offset, start, class]. It is the standard week the planner starts from.
const WEEK: Array<[number, string, OfferingKey]> = [
  [0, '09:00', 'spine'],
  [0, '17:00', 'ashtanga'],
  [1, '19:15', 'restorative'],
  [2, '09:00', 'spine'],
  [2, '18:15', 'blackLotus'],
  [3, '17:00', 'ashtanga'],
  [3, '19:15', 'restorative'],
  [4, '18:15', 'blackLotus'],
  [4, '19:45', 'pranayama'],
  [6, '09:00', 'ashtanga'],
];

const PLANS: Array<{ code: StandardPlan; name: string; visits_per_month: number | null }> = [
  { code: '1x', name: '1× tjedno', visits_per_month: 4 },
  { code: '2x', name: '2× tjedno', visits_per_month: 8 },
  { code: '3x', name: '3× tjedno', visits_per_month: 12 },
  { code: 'unl', name: 'Neograničeno', visits_per_month: null },
  { code: 'trial', name: 'Proba', visits_per_month: 1 },
];

const stamps = (now: string) => ({ created_at: now, updated_at: now, deleted_at: null, changed_at: now });

export interface SeedOwner {
  email: string;
  name: string;
}

export interface ProdSeedOptions {
  now: string;
  /** Who may sign in as owner (everything). Left out: no staff rows, so nobody can sign in yet. */
  owners?: SeedOwner[];
  /** Teachers who may sign in, with what ROLE_ACCESS gives teachers (view-only; for now nothing). */
  teachers?: SeedOwner[];
}

/** Production seed: the business, one location, the Joga group, the five classes and the five plans. No members. */
export function prodSeed({ now, owners = [], teachers = [] }: ProdSeedOptions): SeedRow[] {
  const b = SEED.business;
  const rows: SeedRow[] = [
    { table: 'business', row: { id: b, name: 'Prana Yoga Studio', locale: 'hr', timezone: TIME_ZONE, created_at: now, updated_at: now } },
    { table: 'location', row: { id: SEED.location, business_id: b, name: 'Prana Yoga Studio', ...stamps(now) } },
    { table: 'offering_group', row: { id: SEED.group, business_id: b, name: 'Joga', sort: 0, ...stamps(now) } },
  ];
  owners.forEach((owner, i) => {
    // The first owner keeps the fixed id the sample data points at; further ones follow it.
    const id = i === 0 ? SEED.owner : fixedId(0x40 + i);
    rows.push({ table: 'staff', row: { id, business_id: b, firebase_uid: null, email: owner.email.toLowerCase(), name: owner.name, role: 'owner', ...stamps(now) } });
  });
  teachers.forEach((teacher, i) => {
    rows.push({ table: 'staff', row: { id: fixedId(0x60 + i), business_id: b, firebase_uid: null, email: teacher.email.toLowerCase(), name: teacher.name, role: 'teacher', ...stamps(now) } });
  });
  for (const o of OFFERINGS) {
    rows.push({
      table: 'offering',
      row: {
        id: SEED.offerings[o.key],
        business_id: b,
        group_id: SEED.group,
        name: o.name,
        color_token: o.color_token,
        default_duration_min: o.minutes,
        entry_rule: o.entry_rule,
        default_capacity: null,
        active: true,
        teacher_ids: '[]',
        ...stamps(now),
      },
    });
  }
  WEEK.forEach(([day, time, key], i) => {
    const minutes = OFFERINGS.find((o) => o.key === key)!.minutes;
    rows.push({
      table: 'week_slot',
      row: { id: SEED.weekSlot(i), business_id: b, weekday: day + 1, start_time: time, duration_min: minutes, offering_id: SEED.offerings[key], teacher_staff_id: null, ...stamps(now) },
    });
  });
  for (const p of PLANS) {
    // price_cents stays empty until the studio provides prices.
    rows.push({ table: 'plan', row: { id: SEED.plans[p.code], business_id: b, code: p.code, name: p.name, visits_per_month: p.visits_per_month, price_cents: null, ...stamps(now) } });
  }
  return rows;
}

// ── Dev only ──────────────────────────────────────────────────────────────────

export const DEV_OWNER_EMAIL = 'mario@prana.test';
/** A sample teacher who can sign in locally, with a teacher's access. */
export const DEV_TEACHER_EMAIL = 'petra@prana.test';

/** Made-up prices so the "unpaid" state can be seen locally. Not the studio's prices. */
const DEV_PRICES: Record<StandardPlan, number | null> = { '1x': 6500, '2x': 8500, '3x': 10000, unl: 12000, trial: null };

interface DevMember {
  name: string;
  email: string;
  phone: string;
  dob: string;
  student?: boolean;
  health?: string;
  news?: boolean;
  /** No membership when left out. */
  plan?: StandardPlan;
  /** Period end relative to today; the period is the month before it. */
  endsInDays?: number;
  frozenForDays?: number;
  paid?: PaymentMethod;
  visits?: number;
}

// Sample people. All five statuses, plus one member without a membership.
const DEV_MEMBERS: DevMember[] = [
  { name: 'Ana Horvat', email: 'ana.horvat@example.com', phone: '091 234 5678', dob: '1988-03-14', student: true, news: true, plan: '2x', endsInDays: 3, paid: 'cash', visits: 6 },
  { name: 'Marko Kovač', email: 'marko.kovac@example.com', phone: '098 765 4321', dob: '1979-11-02', plan: '1x', endsInDays: 25, visits: 1 },
  { name: 'Iva Babić', email: 'iva.babic@example.com', phone: '095 111 2233', dob: '1992-06-21', health: 'Hernija L5, izbjegavati duboke pretklone.', plan: '3x', endsInDays: 5, paid: 'card', visits: 9 },
  { name: 'Petra Novak', email: 'petra.novak@example.com', phone: '099 444 5566', dob: '1985-01-30', news: true, plan: 'unl', endsInDays: 20, frozenForDays: 14, paid: 'transfer', visits: 2 },
  { name: 'Luka Jurić', email: 'luka.juric@example.com', phone: '092 333 7788', dob: '1998-09-09', student: true, plan: 'trial', endsInDays: 29, visits: 0 },
  { name: 'Maja Perić', email: 'maja.peric@example.com', phone: '091 555 0101', dob: '1990-12-05', news: true, plan: '2x', endsInDays: 18, paid: 'card', visits: 4 },
  { name: 'Nina Šimić', email: 'nina.simic@example.com', phone: '097 222 9090', dob: '1975-04-17', health: 'Operacija koljena 2024., bez dubokih čučnjeva.', plan: 'unl', endsInDays: 12, paid: 'cash', visits: 7 },
  { name: 'Ivan Knežević', email: 'ivan.knezevic@example.com', phone: '098 101 2020', dob: '1983-07-26' },
];

/**
 * The standard week as sessions, for `weeks` weeks from the week of `today` (production starts with an empty calendar).
 * Random ids: seeding again adds another copy, so run it once; later weeks come from the planner.
 */
export function standardWeekSessions({ now, today, weeks }: { now: string; today: string; weeks: number }): SeedRow[] {
  const monday = startOfWeek(today);
  const rows: SeedRow[] = [];
  for (let week = 0; week < weeks; week++) {
    for (const [day, time, key] of WEEK) {
      const template = OFFERINGS.find((o) => o.key === key)!;
      const starts_at = zonedTimeToUtc(addDays(monday, week * 7 + day), time);
      rows.push({
        table: 'session',
        row: {
          id: uuidv7(),
          business_id: SEED.business,
          location_id: SEED.location,
          offering_id: SEED.offerings[key],
          starts_at,
          ends_at: new Date(Date.parse(starts_at) + template.minutes * 60_000).toISOString(),
          teacher_staff_id: null,
          capacity: 12,
          note: null,
          ...stamps(now),
        },
      });
    }
  }
  return rows;
}

/** Dev seed: the production seed plus an owner, sample prices, five weeks of sessions and sample members. */
export function devSeed({ now }: { now: string }): SeedRow[] {
  const b = SEED.business;
  const today = localDate(now);
  const rows = prodSeed({ now, owners: [{ email: DEV_OWNER_EMAIL, name: 'Mario' }] });
  for (const r of rows) {
    if (r.table === 'plan') r.row.price_cents = DEV_PRICES[r.row.code as StandardPlan];
  }
  // Two sample teachers, added by name (no e-mail, so no sign-in), and who teaches what.
  const [petra, ivan] = SEED.teachers as [string, string];
  // Petra can sign in locally, to try the teacher's view; Ivan is a name only.
  rows.push({ table: 'staff', row: { id: petra, business_id: b, firebase_uid: null, email: DEV_TEACHER_EMAIL, name: 'Petra', role: 'teacher', ...stamps(now) } });
  rows.push({ table: 'staff', row: { id: ivan, business_id: b, firebase_uid: null, email: '', name: 'Ivan', role: 'teacher', ...stamps(now) } });
  const teaching: Partial<Record<OfferingKey, string[]>> = { spine: [petra], ashtanga: [SEED.owner, ivan], restorative: [petra, ivan], blackLotus: [ivan] };
  for (const r of rows) {
    const key = (Object.keys(SEED.offerings) as OfferingKey[]).find((k) => SEED.offerings[k] === r.row.id);
    if (r.table === 'offering' && key) r.row.teacher_ids = JSON.stringify(teaching[key] ?? []);
  }
  // The standard week names each class's usual teacher, so its rows go after the teachers'.
  const slots = rows.filter((r) => r.table === 'week_slot');
  rows.splice(0, rows.length, ...rows.filter((r) => r.table !== 'week_slot'), ...slots);
  for (const r of slots) {
    const slotKey = (Object.keys(SEED.offerings) as OfferingKey[]).find((k) => SEED.offerings[k] === r.row.offering_id)!;
    r.row.teacher_staff_id = teaching[slotKey]?.[0] ?? null;
  }

  // The three weeks before this one (past sessions to hang visits on), this week, and the next
  // (so "tomorrow" has sessions on a Sunday too).
  const monday = startOfWeek(today);
  const sessions: Array<{ id: string; starts_at: string }> = [];
  for (let week = -3; week <= 1; week++) {
    WEEK.forEach(([day, time, key], i) => {
      const template = OFFERINGS.find((o) => o.key === key)!;
      const starts_at = zonedTimeToUtc(addDays(monday, week * 7 + day), time);
      const id = fixedId(0x1000 + (week + 3) * 0x100 + i);
      sessions.push({ id, starts_at });
      rows.push({
        table: 'session',
        row: {
          id,
          business_id: b,
          location_id: SEED.location,
          offering_id: SEED.offerings[key],
          starts_at,
          ends_at: new Date(Date.parse(starts_at) + template.minutes * 60_000).toISOString(),
          teacher_staff_id: SEED.owner,
          capacity: 12,
          note: null,
          ...stamps(now),
        },
      });
    });
  }
  const past = sessions.filter((s) => s.starts_at < now).sort((a, c) => (a.starts_at < c.starts_at ? 1 : -1));

  DEV_MEMBERS.forEach((m, i) => {
    const memberId = SEED.member(i);
    const period_end = m.plan ? addDays(today, m.endsInDays ?? 20) : null;
    const period_start = period_end ? addDays(addMonths(period_end, -1), 1) : null;
    const since = period_start && period_start < today ? period_start : today;
    rows.push({
      table: 'member',
      row: {
        id: memberId,
        business_id: b,
        ...splitFullName(m.name),
        full_name: m.name,
        email: m.email,
        phone: m.phone,
        dob: m.dob,
        is_student_or_retired: m.student ?? false,
        health_flag: Boolean(m.health),
        health_text: m.health ?? null,
        consent_accuracy: true,
        consent_news: m.news ?? false,
        signed_place: STUDIO_PLACE,
        signed_date: since,
        member_since: since,
        notes: null,
        ...stamps(now),
      },
    });
    if (!m.plan || !period_start || !period_end) return;

    const membershipId = fixedId(0x200 + i);
    rows.push({
      table: 'membership',
      row: {
        id: membershipId,
        business_id: b,
        member_id: memberId,
        plan_id: SEED.plans[m.plan],
        period_start,
        period_end,
        frozen_until: m.frozenForDays ? addDays(today, m.frozenForDays) : null,
        ...stamps(now),
      },
    });

    const price = DEV_PRICES[m.plan];
    if (m.paid && price) {
      rows.push({
        table: 'payment',
        row: {
          id: fixedId(0x300 + i),
          business_id: b,
          member_id: memberId,
          membership_id: membershipId,
          amount_cents: price,
          currency: 'EUR',
          method: m.paid,
          paid_at: zonedTimeToUtc(period_start, '10:00'),
          note: null,
          ...stamps(now),
        },
      });
    }

    const periodStartUtc = zonedTimeToUtc(period_start, '00:00');
    // Stagger by member so not everyone is in the same classes.
    const attended = past.filter((s) => s.starts_at >= periodStartUtc).filter((_, n) => (n + i) % 2 === 0).slice(0, m.visits ?? 0);
    attended.forEach((s, n) => {
      rows.push({
        table: 'visit',
        row: { id: fixedId(0x10000 + i * 0x100 + n), business_id: b, member_id: memberId, session_id: s.id, membership_id: membershipId, checked_in_at: s.starts_at, ...stamps(now) },
      });
    });
  });

  // A finished membership for the member who has none now, so the profile has history.
  const lapsed = DEV_MEMBERS.length - 1;
  const lapsedEnd = addDays(today, -20);
  const lapsedStart = addDays(addMonths(lapsedEnd, -1), 1);
  rows.push(
    {
      table: 'membership',
      row: { id: fixedId(0x200 + lapsed), business_id: b, member_id: SEED.member(lapsed), plan_id: SEED.plans['1x'], period_start: lapsedStart, period_end: lapsedEnd, frozen_until: null, ...stamps(now) },
    },
    {
      table: 'payment',
      row: {
        id: fixedId(0x300 + lapsed),
        business_id: b,
        member_id: SEED.member(lapsed),
        membership_id: fixedId(0x200 + lapsed),
        amount_cents: DEV_PRICES['1x'] ?? 0,
        currency: 'EUR',
        method: 'cash',
        paid_at: zonedTimeToUtc(lapsedStart, '10:00'),
        note: null,
        ...stamps(now),
      },
    },
  );
  // The member row was written with member_since = today; move it back to when they joined.
  const lapsedMember = rows.find((r) => r.table === 'member' && r.row.id === SEED.member(lapsed));
  if (lapsedMember) {
    lapsedMember.row.member_since = lapsedStart;
    lapsedMember.row.signed_date = lapsedStart;
  }

  return rows;
}

function literal(value: Value): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * One INSERT per row.
 * - 'keep': rows that already exist are left alone (production: never overwrite the owner's edits).
 * - 'refresh': rows that already exist are updated (dev: re-seeding moves the sample dates to this week).
 */
export function toSql(rows: SeedRow[], mode: 'keep' | 'refresh'): string[] {
  return rows.map(({ table, row }) => {
    const columns = Object.keys(row);
    const values = columns.map((c) => literal(row[c] ?? null)).join(', ');
    if (mode === 'keep') return `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${values})`;
    const updates = columns
      .filter((c) => c !== 'id' && c !== 'created_at' && c !== 'firebase_uid')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  });
}
