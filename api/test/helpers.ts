import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { getPlatformProxy } from 'wrangler';
import { createApp } from '../src/app';
import type { Env } from '../src/env';
import { DEV_OWNER_EMAIL, devSeed, prodSeed, toSql } from '../src/seed';

export const PROJECT = 'prana-crm';
export const ISSUER = `https://securetoken.google.com/${PROJECT}`;

interface TokenClaims {
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  audience?: string;
  issuer?: string;
  /** e.g. "1h", or a past time like "-1m". */
  expires?: string;
}

interface CallOptions {
  token?: string | null;
  body?: unknown;
  form?: FormData;
  env?: Partial<Env>;
}

/**
 * A fresh local D1 and R2 (through Miniflare, nothing persisted) with the migration applied,
 * and the real app wired to test signing keys in place of Google's.
 */
export async function setup(seed: 'dev' | 'prod' | 'none' = 'dev') {
  const proxy = await getPlatformProxy<Env>({ configPath: resolve(import.meta.dirname, '../wrangler.toml'), persist: false });
  // Emulator mode is off unless a test turns it on, whatever a local .dev.vars says.
  const env: Env = { ...proxy.env, FIREBASE_PROJECT_ID: PROJECT, ENVIRONMENT: 'test', FIREBASE_AUTH_EMULATOR: undefined };

  const run = async (statements: string[]) => {
    await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
  };

  const migration = readFileSync(resolve(import.meta.dirname, '../migrations/0001_init.sql'), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  await run(migration);

  const now = new Date().toISOString();
  if (seed === 'dev') await run(toSql(devSeed({ now }), 'keep'));
  if (seed === 'prod') await run(toSql(prodSeed({ now, owners: [{ email: DEV_OWNER_EMAIL, name: 'Mario' }] }), 'keep'));

  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' }] });
  const app = createApp({ keys });

  const sign = (claims: TokenClaims, key: CryptoKey = privateKey) =>
    new SignJWT({ email: claims.email, email_verified: claims.emailVerified ?? true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(claims.uid ?? 'uid-owner')
      .setAudience(claims.audience ?? PROJECT)
      .setIssuer(claims.issuer ?? ISSUER)
      .setIssuedAt()
      .setExpirationTime(claims.expires ?? '1h')
      .sign(key);

  const ownerToken = await sign({ uid: 'uid-owner', email: DEV_OWNER_EMAIL });

  /** Calls the API as the owner unless told otherwise; `token: null` sends no Authorization header. */
  async function call<T = any>(method: string, path: string, options: CallOptions = {}): Promise<{ status: number; body: T; res: Response }> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const token = options.token === undefined ? ownerToken : options.token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const res = await app.request(`/api${path}`, { method, headers, body }, { ...env, ...options.env });
    const isJson = res.headers.get('Content-Type')?.includes('application/json');
    return { status: res.status, body: (isJson ? await res.clone().json() : null) as T, res };
  }

  return { app, env, run, sign, ownerToken, call, dispose: () => proxy.dispose() };
}

export type TestApi = Awaited<ReturnType<typeof setup>>;
