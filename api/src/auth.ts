import { and, eq, isNull, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, decodeJwt, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { business, staff } from './db/schema';
import type { AppEnv, Env } from './env';
import { ApiError } from './errors';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let googleKeys: JWTVerifyGetKey | undefined;

interface Identity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export function emulatorMode(env: Env): boolean {
  return env.FIREBASE_AUTH_EMULATOR === 'true' && env.ENVIRONMENT !== 'production';
}

function identityFrom(payload: JWTPayload): Identity {
  if (!payload.sub) throw new Error('no subject');
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
  };
}

/**
 * Verifies a Firebase ID token: RS256 against Google's keys, with audience, issuer and expiry.
 * In emulator mode (local only) tokens are unsigned, so only the claims are checked.
 */
export async function verifyIdToken(token: string, env: Env, keys?: JWTVerifyGetKey): Promise<Identity> {
  const audience = env.FIREBASE_PROJECT_ID;
  const issuer = `https://securetoken.google.com/${audience}`;

  if (emulatorMode(env)) {
    const payload = decodeJwt(token);
    if (payload.aud !== audience || payload.iss !== issuer) throw new Error('wrong project');
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) throw new Error('expired');
    return identityFrom(payload);
  }

  googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const { payload } = await jwtVerify(token, keys ?? googleKeys, { audience, issuer, algorithms: ['RS256'] });
  return identityFrom(payload);
}

/**
 * Every /api request: verify the token, then find the staff row.
 * Signing in to Firebase alone grants nothing; only allowlisted staff get through.
 */
export function requireStaff(keys?: JWTVerifyGetKey) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(header)?.[1];
    if (!token) throw new ApiError('unauthenticated');

    let identity: Identity;
    try {
      identity = await verifyIdToken(token, c.env, keys);
    } catch {
      throw new ApiError('unauthenticated');
    }

    const db = c.get('db');
    let [row] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.firebase_uid, identity.uid), isNull(staff.deleted_at)))
      .limit(1);

    // First login: bind the account to the allowlisted row with the same verified e-mail.
    // The emulator forgets its accounts on every restart, so there the row is bound again to the new uid.
    const emulator = emulatorMode(c.env);
    if (!row && identity.email && (identity.emailVerified || emulator)) {
      const now = new Date().toISOString();
      [row] = await db
        .update(staff)
        .set({ firebase_uid: identity.uid, updated_at: now, changed_at: now })
        .where(and(sql`lower(${staff.email}) = ${identity.email}`, emulator ? undefined : isNull(staff.firebase_uid), isNull(staff.deleted_at)))
        .returning();
    }
    if (!row) throw new ApiError('no_access');

    const [biz] = await db.select().from(business).where(eq(business.id, row.business_id)).limit(1);
    if (!biz) throw new ApiError('no_access');

    c.set('staff', row);
    c.set('business', biz);
    await next();
  });
}
