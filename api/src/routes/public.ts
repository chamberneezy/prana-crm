import {
  addDays,
  diffDays,
  foldText,
  localDate,
  publicBookingInputSchema,
  type PublicBookingResponse,
  publicScheduleQuerySchema,
  type PublicScheduleResponse,
  startOfWeek,
  uuidv7,
} from '@prana/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { booking, business, member, session } from '../db/schema';
import type { AppEnv, Db } from '../env';
import { ApiError } from '../errors';
import { parse, parseBody } from '../lib/http';
import { closureOn, loadSessionViews, startsBetween } from '../lib/sessions';

/**
 * The studio's app, for anyone: no account. It shows the classes and lets a member sign up for one by first and
 * last name, which must match a member of the studio. Everything is scoped by the studio id in the path.
 */
export const publicApi = new Hono<AppEnv>();

publicApi.use(async (c, next) => {
  c.set('db', drizzle(c.env.DB));
  await next();
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
});

async function studio(db: Db, id: string) {
  const [row] = await db.select().from(business).where(eq(business.id, id)).limit(1);
  if (!row) throw new ApiError('not_found');
  return row;
}

/** "  Ana   Marija " → "ana marija": case, diacritics and spacing don't count when matching names. */
const nameKey = (text: string) => foldText(text).trim().replace(/\s+/g, ' ');

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

publicApi.get('/studios/:studioId/schedule', async (c) => {
  const db = c.get('db');
  const biz = await studio(db, c.req.param('studioId'));
  const today = localDate(new Date(), biz.timezone);
  const query = parse(publicScheduleQuerySchema, c.req.query());
  const from = query.from ?? startOfWeek(today);
  const to = query.to ?? addDays(from, 6);
  if (to < from || diffDays(from, to) > 31) throw new ApiError('invalid_input', ['to']);

  const views = await loadSessionViews(db, biz.id, biz.timezone, startsBetween(from, to, biz.timezone));
  const body: PublicScheduleResponse = {
    studio: { name: biz.name, timezone: biz.timezone },
    from,
    to,
    // Only what a schedule poster shows: no capacity, notes, counts or who comes.
    sessions: views.map((s) => ({
      id: s.id,
      offering_id: s.offering_id,
      offering_name: s.offering_name,
      color_token: s.color_token,
      entry_rule: s.entry_rule,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      teacher_name: s.teacher_name,
      closure_name: s.closure_name,
    })),
  };
  return c.json(body);
});

publicApi.post('/studios/:studioId/bookings', async (c) => {
  const db = c.get('db');
  const biz = await studio(db, c.req.param('studioId'));
  const input = await parseBody(c, publicBookingInputSchema);
  const now = new Date().toISOString();

  const [target] = await db
    .select()
    .from(session)
    .where(and(eq(session.id, input.session_id), eq(session.business_id, biz.id), isNull(session.deleted_at)))
    .limit(1);
  if (!target) throw new ApiError('not_found');
  if (target.ends_at <= now) throw new ApiError('session_over');
  if (await closureOn(db, biz.id, localDate(target.starts_at, biz.timezone))) throw new ApiError('day_closed');

  // The name as on the upisnica; "Ana Marija" + "Horvat" also finds Ana + "Marija Horvat".
  const wanted = nameKey(`${input.first_name} ${input.last_name}`);
  const members = await db
    .select({ id: member.id, full_name: member.full_name })
    .from(member)
    .where(and(eq(member.business_id, biz.id), isNull(member.deleted_at)))
    .orderBy(member.created_at);
  const who = members.find((m) => nameKey(m.full_name) === wanted);
  if (!who) throw new ApiError('member_not_found');

  const token = newToken();
  const cancel_token_hash = await sha256(token);
  const [already] = await db
    .select({ id: booking.id })
    .from(booking)
    .where(and(eq(booking.session_id, target.id), eq(booking.member_id, who.id), isNull(booking.deleted_at)))
    .limit(1);

  // Signing up twice keeps one sign-up; this device gets a fresh token for it.
  let id = already?.id;
  if (id) {
    await db.update(booking).set({ cancel_token_hash, updated_at: now, changed_at: now }).where(eq(booking.id, id));
  } else {
    id = uuidv7();
    await db.insert(booking).values({ id, business_id: biz.id, session_id: target.id, member_id: who.id, cancel_token_hash, created_at: now, updated_at: now, deleted_at: null, changed_at: now });
  }
  const body: PublicBookingResponse = { booking: { id, session_id: target.id, cancel_token: token } };
  return c.json(body, already ? 200 : 201);
});

publicApi.delete('/studios/:studioId/bookings/:id', async (c) => {
  const db = c.get('db');
  const biz = await studio(db, c.req.param('studioId'));
  const token = c.req.header('X-Cancel-Token') ?? '';
  const [row] = await db
    .select()
    .from(booking)
    .where(and(eq(booking.id, c.req.param('id')), eq(booking.business_id, biz.id), isNull(booking.deleted_at)))
    .limit(1);
  // A wrong token looks the same as no sign-up at all.
  if (!row || !token || (await sha256(token)) !== row.cancel_token_hash) throw new ApiError('not_found');
  const now = new Date().toISOString();
  await db.update(booking).set({ deleted_at: now, updated_at: now, changed_at: now }).where(eq(booking.id, row.id));
  return c.body(null, 204);
});
