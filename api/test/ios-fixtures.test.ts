import { addDays, localDate, startOfWeek } from '@prana/shared';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { SEED } from '../src/seed';
import { setup, type TestApi } from './helpers';

/**
 * Real API answers for the iOS app's decoding tests (apps/ios/PranaKit/Tests/PranaKitTests/Fixtures).
 * Written only with IOS_FIXTURES=1 (`IOS_FIXTURES=1 npx vitest run api/test/ios-fixtures.test.ts`), so the
 * files change only when asked; otherwise this just checks the answers are there.
 */
let t: TestApi;
beforeAll(async () => {
  t = await setup('dev');
});
afterAll(() => t.dispose());

it('answers every call the iOS app decodes', async () => {
  const monday = startOfWeek(localDate(new Date()));
  const studio = `/public/studios/${SEED.business}`;
  const schedule = await t.call('GET', `${studio}/schedule?from=${monday}&to=${addDays(monday, 6)}`, { token: null });
  const upcoming = schedule.body.sessions.find((s: { ends_at: string }) => s.ends_at > new Date().toISOString()) ?? schedule.body.sessions[0];
  const booking = await t.call('POST', `${studio}/bookings`, { token: null, body: { session_id: upcoming.id, first_name: 'Ana', last_name: 'Horvat' } });
  const notMember = await t.call('POST', `${studio}/bookings`, { token: null, body: { session_id: upcoming.id, first_name: 'Netko', last_name: 'Drugi' } });

  const answers: Record<string, unknown> = {
    'public-schedule': schedule.body,
    'public-booking': booking.body,
    'error-member-not-found': notMember.body,
    me: (await t.call('GET', '/me')).body,
    dashboard: (await t.call('GET', '/dashboard')).body,
    sessions: (await t.call('GET', `/sessions?from=${monday}`)).body,
    'session-detail': (await t.call('GET', `/sessions/${upcoming.id}`)).body,
    members: (await t.call('GET', '/members')).body,
    'member-detail': (await t.call('GET', `/members/${SEED.member(0)}`)).body,
    offerings: (await t.call('GET', '/offerings')).body,
    'offering-groups': (await t.call('GET', '/offering-groups')).body,
    staff: (await t.call('GET', '/staff')).body,
    closures: (await t.call('GET', '/closures')).body,
    'week-template': (await t.call('GET', '/week-template')).body,
    plans: (await t.call('GET', '/plans')).body,
    payments: (await t.call('GET', '/payments')).body,
    analytics: (await t.call('GET', '/analytics?months=3')).body,
  };
  for (const [name, body] of Object.entries(answers)) expect(body, name).toBeTruthy();

  if (process.env.IOS_FIXTURES === '1') {
    const dir = resolve(import.meta.dirname, '../../apps/ios/PranaKit/Tests/PranaKitTests/Fixtures');
    mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(answers)) writeFileSync(resolve(dir, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`);
  }
});
