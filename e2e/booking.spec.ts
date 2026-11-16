import { expect, test } from '@playwright/test';
import { signInToOverview } from './users';

/** The sample studio (SEED.business). */
const STUDIO = '01900000-0000-7000-8000-000000000001';
const zagrebDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zagreb' }).format(new Date(iso));

test('a member signs up in the studio app; staff see the najava and check them in', async ({ page, request }) => {
  // What the iOS app does, without signing in.
  const schedule = await (await request.get(`/api/public/studios/${STUDIO}/schedule`)).json();
  const upcoming = schedule.sessions.find((s: { ends_at: string; closure_name: string | null }) => s.ends_at > new Date().toISOString() && !s.closure_name);
  test.skip(!upcoming, 'no class left this week');
  const signUp = await request.post(`/api/public/studios/${STUDIO}/bookings`, { data: { session_id: upcoming.id, first_name: 'luka', last_name: 'JURIC' } });
  expect(signUp.status()).toBe(201);

  await signInToOverview(page);
  await page.goto(`/raspored?tjedan=${schedule.from}`);
  const time = new Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', hour: '2-digit', minute: '2-digit' }).format(new Date(upcoming.starts_at));
  const day = page.getByRole('region', { name: new RegExp(zagrebDay(upcoming.starts_at).split('-').reverse().join('.')) });
  const card = day.getByRole('button', { name: new RegExp(`${time}.*${upcoming.offering_name}`) });
  await expect(card).toContainText('1 najava');
  await card.click();

  const panel = page.getByRole('dialog', { name: upcoming.offering_name });
  await expect(panel).toContainText('Najave iz aplikacije · 1');
  await panel.getByRole('button', { name: 'Evidentiraj: Luka Jurić' }).first().click();
  await expect(page.getByRole('status')).toContainText('Dolazak evidentiran: Luka Jurić.');
  await expect(panel.getByRole('listitem').filter({ hasText: 'Luka Jurić' }).first()).toContainText('Evidentirano');
});
