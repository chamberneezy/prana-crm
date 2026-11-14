import { type Area, canEdit, canView, hasFullAccess } from '@prana/shared';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from './env';
import { ApiError } from './errors';

/**
 * Which part of the app each endpoint belongs to (see ROLE_ACCESS in @prana/shared). Reading needs `view` on it,
 * any change needs `edit`. A list of areas means any one of them will do (e.g. the plans are read by the sign-up form
 * as well as on Članarine).
 */
/** Areas (any one will do), `anyone` on the staff list, or `full`: only a role that can do everything. */
type Rule = Area[] | 'anyone' | 'full';

export const ROUTES: Array<{ prefix: string; read: Rule; write: Rule }> = [
  // Who is signed in: everyone on the staff list, whatever their role, so the app can show them their own access.
  { prefix: '/me', read: 'anyone', write: 'full' },
  { prefix: '/dashboard', read: ['overview'], write: 'full' },
  { prefix: '/analytics', read: ['analytics'], write: 'full' },
  { prefix: '/members', read: ['members'], write: ['members'] },
  { prefix: '/documents', read: ['members'], write: ['members'] },
  { prefix: '/memberships', read: ['members'], write: ['members'] },
  { prefix: '/plans', read: ['plans', 'members'], write: ['plans'] },
  { prefix: '/payments', read: ['payments', 'members'], write: ['payments', 'members'] },
  { prefix: '/offering-groups', read: ['offerings', 'schedule'], write: ['offerings'] },
  { prefix: '/offerings', read: ['offerings', 'schedule'], write: ['offerings'] },
  { prefix: '/sessions', read: ['schedule', 'overview'], write: ['schedule'] },
  { prefix: '/visits', read: ['schedule'], write: ['schedule'] },
  { prefix: '/staff', read: ['schedule', 'offerings'], write: ['offerings'] },
  // The iOS app's sync reads and writes everything.
  { prefix: '/sync', read: 'full', write: 'full' },
];

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Turns away a request the signed-in role may not make. Runs after requireStaff. */
export function requireAccess() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const role = c.get('staff').role;
    const path = c.req.path.replace(/^\/api/, '');
    const route = ROUTES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
    // Anything not listed is for owners only, so a new endpoint is closed until it is placed here.
    const reading = READS.has(c.req.method);
    const rule: Rule = route ? (reading ? route.read : route.write) : 'full';
    const allowed = rule === 'anyone' || (rule === 'full' ? hasFullAccess(role) : rule.some((area) => (reading ? canView(role, area) : canEdit(role, area))));
    if (!allowed) throw new ApiError('forbidden');
    await next();
  });
}
