import { generateKeyPair, UnsecuredJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEV_OWNER_EMAIL } from '../src/seed';
import { ISSUER, PROJECT, setup, type TestApi } from './helpers';

let t: TestApi;
beforeAll(async () => {
  t = await setup('prod');
});
afterAll(() => t.dispose());

const unsigned = (email: string, uid = 'uid-emulator') =>
  new UnsecuredJWT({ email, email_verified: false }).setSubject(uid).setAudience(PROJECT).setIssuer(ISSUER).setExpirationTime('1h').encode();

describe('401: the token is missing or not valid', () => {
  it('no Authorization header', async () => {
    const { status, body } = await t.call('GET', '/me', { token: null });
    expect(status).toBe(401);
    expect(body.error).toMatchObject({ code: 'unauthenticated', message_hr: 'Prijavite se ponovno.' });
    expect(body.error.message_en).toBeTruthy();
  });
  it('not a token at all', async () => {
    expect((await t.call('GET', '/me', { token: 'not-a-token' })).status).toBe(401);
  });
  it('signed with a key that is not Google’s', async () => {
    const other = await generateKeyPair('RS256');
    const token = await t.sign({ email: DEV_OWNER_EMAIL }, other.privateKey);
    expect((await t.call('GET', '/me', { token })).status).toBe(401);
  });
  it('expired', async () => {
    const token = await t.sign({ email: DEV_OWNER_EMAIL, expires: '-1m' });
    expect((await t.call('GET', '/me', { token })).status).toBe(401);
  });
  it('issued for another Firebase project', async () => {
    const wrongAudience = await t.sign({ email: DEV_OWNER_EMAIL, audience: 'another-project' });
    const wrongIssuer = await t.sign({ email: DEV_OWNER_EMAIL, issuer: 'https://securetoken.google.com/another-project' });
    expect((await t.call('GET', '/me', { token: wrongAudience })).status).toBe(401);
    expect((await t.call('GET', '/me', { token: wrongIssuer })).status).toBe(401);
  });
  it('unsigned (emulator-style) while emulator mode is off', async () => {
    expect((await t.call('GET', '/me', { token: unsigned(DEV_OWNER_EMAIL) })).status).toBe(401);
  });
  it('covers every endpoint, including ones that do not exist', async () => {
    expect((await t.call('GET', '/members', { token: null })).status).toBe(401);
    expect((await t.call('POST', '/sync', { token: null, body: { mutations: [] } })).status).toBe(401);
    expect((await t.call('GET', '/nothing-here', { token: null })).status).toBe(401);
  });
});

describe('403: signed in to Firebase, but not on the staff allowlist', () => {
  it('an unknown account', async () => {
    const token = await t.sign({ uid: 'uid-stranger', email: 'stranger@example.com' });
    const { status, body } = await t.call('GET', '/me', { token });
    expect(status).toBe(403);
    expect(body.error).toMatchObject({ code: 'no_access', message_hr: 'Ovaj račun nema pristup studiju.' });
  });
  it('an account with no e-mail', async () => {
    const token = await t.sign({ uid: 'uid-anonymous' });
    expect((await t.call('GET', '/me', { token })).status).toBe(403);
  });
  it('the owner’s e-mail, but not verified, is not bound', async () => {
    const token = await t.sign({ uid: 'uid-impostor', email: DEV_OWNER_EMAIL, emailVerified: false });
    expect((await t.call('GET', '/me', { token })).status).toBe(403);
    expect((await t.call('GET', '/members', { token })).status).toBe(403);
  });
});

describe('the allowlisted owner', () => {
  it('is bound on first login and recognised by uid afterwards', async () => {
    const first = await t.call('GET', '/me');
    expect(first.status).toBe(200);
    expect(first.body.staff).toMatchObject({ email: DEV_OWNER_EMAIL, role: 'owner' });
    expect(first.body.business).toEqual({ id: expect.any(String), name: 'Prana Yoga Studio', locale: 'hr', timezone: 'Europe/Zagreb' });
    expect(first.body.staff).not.toHaveProperty('firebase_uid');
    expect(first.res.headers.get('Cache-Control')).toBe('no-store');

    // The e-mail claim is no longer needed once the uid is bound.
    const byUid = await t.sign({ uid: 'uid-owner' });
    expect((await t.call('GET', '/me', { token: byUid })).status).toBe(200);
  });
  it('cannot be taken over by a second account with the same e-mail', async () => {
    const token = await t.sign({ uid: 'uid-second', email: DEV_OWNER_EMAIL });
    expect((await t.call('GET', '/me', { token })).status).toBe(403);
  });
  it('matches the e-mail regardless of case', async () => {
    await t.run([
      `INSERT INTO staff (id, business_id, firebase_uid, email, name, role, created_at, updated_at, deleted_at, changed_at)
       SELECT '01900000-0000-7000-8000-0000000000aa', id, NULL, 'teacher@example.com', 'Teacher', 'teacher', created_at, created_at, NULL, created_at FROM business`,
    ]);
    const token = await t.sign({ uid: 'uid-teacher', email: 'Teacher@Example.com' });
    const { status, body } = await t.call('GET', '/me', { token });
    expect(status).toBe(200);
    expect(body.staff.role).toBe('teacher');
  });
});

describe('emulator mode (local development only)', () => {
  const emulator = { FIREBASE_AUTH_EMULATOR: 'true', ENVIRONMENT: 'development' };

  it('accepts unsigned emulator tokens, still behind the allowlist', async () => {
    expect((await t.call('GET', '/me', { token: unsigned('stranger@example.com'), env: emulator })).status).toBe(403);
    expect((await t.call('GET', '/me', { token: unsigned('teacher@example.com', 'uid-teacher'), env: emulator })).status).toBe(200);
  });
  it('still checks the project and expiry', async () => {
    const otherProject = new UnsecuredJWT({ email: DEV_OWNER_EMAIL }).setSubject('uid-owner').setAudience('another-project').setIssuer(ISSUER).setExpirationTime('1h').encode();
    const expired = new UnsecuredJWT({ email: DEV_OWNER_EMAIL }).setSubject('uid-owner').setAudience(PROJECT).setIssuer(ISSUER).setExpirationTime('-1m').encode();
    expect((await t.call('GET', '/me', { token: otherProject, env: emulator })).status).toBe(401);
    expect((await t.call('GET', '/me', { token: expired, env: emulator })).status).toBe(401);
  });
  it('is ignored in production', async () => {
    const env = { FIREBASE_AUTH_EMULATOR: 'true', ENVIRONMENT: 'production' };
    expect((await t.call('GET', '/me', { token: unsigned('teacher@example.com', 'uid-teacher'), env })).status).toBe(401);
  });
});
