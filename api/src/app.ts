import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { requireAccess } from './access';
import { requireStaff } from './auth';
import type { AppEnv } from './env';
import { ApiError, errorBody, ERRORS } from './errors';
import { analytics } from './routes/analytics';
import { dashboard, me, staffList } from './routes/dashboard';
import { documents } from './routes/documents';
import { members } from './routes/members';
import { memberships, plans } from './routes/memberships';
import { offeringGroups, offerings } from './routes/offerings';
import { payments } from './routes/payments';
import { closures, weekPlan, weekTemplate } from './routes/planner';
import { publicApi } from './routes/public';
import { bookings, sessions, visits } from './routes/sessions';
import { sync } from './routes/sync';

export interface AppOptions {
  /** Token signing keys. Left out: Google's published keys. Tests pass their own. */
  keys?: JWTVerifyGetKey;
}

export function createApp(options: AppOptions = {}) {
  const api = new Hono<AppEnv>();

  api.use(async (c, next) => {
    c.set('db', drizzle(c.env.DB));
    await next();
    // Responses carry personal data; nothing in between may keep a copy.
    if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store');
  });
  api.use(requireStaff(options.keys));
  // What the signed-in role may see and change (ROLE_ACCESS in @prana/shared).
  api.use(requireAccess());

  api.route('/me', me);
  api.route('/staff', staffList);
  api.route('/dashboard', dashboard);
  api.route('/analytics', analytics);
  api.route('/members', members);
  api.route('/offering-groups', offeringGroups);
  api.route('/offerings', offerings);
  api.route('/sessions', sessions);
  api.route('/visits', visits);
  api.route('/bookings', bookings);
  api.route('/closures', closures);
  api.route('/week-plan', weekPlan);
  api.route('/week-template', weekTemplate);
  api.route('/plans', plans);
  api.route('/memberships', memberships);
  api.route('/payments', payments);
  api.route('/documents', documents);
  api.route('/sync', sync);

  const app = new Hono<AppEnv>();
  // The studio's public app needs no sign-in. It is mounted first, so the staff checks never run for it.
  app.route('/api/public', publicApi);
  app.route('/api', api);

  app.notFound((c) => c.json(errorBody('not_found'), 404));

  app.onError((err, c) => {
    if (err instanceof ApiError) return c.json(errorBody(err.code, err.fields), ERRORS[err.code].status);
    // Never log request data: it can hold names, contacts and health notes.
    console.error('request failed:', c.req.method, c.req.routePath, err instanceof Error ? err.name : 'unknown error');
    return c.json(errorBody('internal'), 500);
  });

  return app;
}
