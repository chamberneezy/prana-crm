import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

/** The Monday `weeks` weeks from now, in the studio's time zone, as YYYY-MM-DD. */
function mondayIn(weeks: number): string {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zagreb' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + weeks * 7);
  return d.toISOString().slice(0, 10);
}
const display = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.`;
const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test.beforeEach(async ({ page }) => {
  await signInToOverview(page);
});

test('Učitelji: add a teacher and choose the classes they teach', async ({ page }) => {
  const name = `Maja ${Date.now().toString().slice(-5)}`;
  await openSection(page, 'Učitelji');
  // The sample data: Petra teaches Kralježnica and Restorativna.
  await expect(page.getByRole('row', { name: /^Petra/ })).toContainText('Joga za kralježnicu');

  await page.getByRole('button', { name: 'Novi učitelj' }).click();
  const form = page.getByRole('dialog', { name: 'Novi učitelj' });
  await form.getByLabel('Ime').fill(name);
  await form.getByRole('checkbox', { name: 'Pranayama & meditacija' }).click();
  await form.getByRole('button', { name: 'Dodaj učitelja' }).click();
  await expect(page.getByRole('status')).toContainText(`${name} je dodan/a kao učitelj.`);
  await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Pranayama & meditacija');

  // Class types list them too.
  await openSection(page, 'Vrste satova');
  await expect(page.getByRole('row', { name: /Pranayama/ })).toContainText(name);
});

test('Tjedni plan: fill a week from the standard week, change it, save it, then close a day', async ({ page }) => {
  const monday = mondayIn(30);
  await openSection(page, 'Tjedni plan');
  await page.goto(`/tjedni-plan?tjedan=${monday}`);
  await expect(page.getByRole('heading', { name: 'Tjedni plan', level: 1 })).toBeVisible();

  const day = (name: string, offset: number) => page.getByRole('region', { name: `${name}, ${display(plusDays(monday, offset))}` });
  await expect(day('Ponedjeljak', 0)).toContainText('Nema satova');

  await page.getByRole('button', { name: 'Popuni iz standardnog tjedna' }).click();
  await expect(page.getByRole('status')).toContainText('Tjedan je popunjen.');
  // The poster's week: Monday has Kralježnica at 09:00 and Ashtanga at 17:00.
  const monSpine = day('Ponedjeljak', 0).getByRole('group', { name: 'Joga za kralježnicu 09:00' });
  await expect(monSpine.getByLabel('Učitelj')).toHaveValue(/.+/);
  await expect(day('Ponedjeljak', 0).getByRole('group')).toHaveCount(2);
  await expect(day('Nedjelja', 6).getByRole('group')).toHaveCount(1);

  // Move Monday's Kralježnica to 10:00 and give it to Ivan; drop Sunday's class; add one on Saturday.
  await monSpine.getByLabel('Početak').fill('10:00');
  await day('Ponedjeljak', 0).getByRole('group', { name: 'Joga za kralježnicu 10:00' }).getByLabel('Učitelj').selectOption({ label: 'Ivan' });
  await day('Nedjelja', 6).getByRole('button', { name: /Ukloni sat: Ashtanga Mysore/ }).click();
  await day('Subota', 5).getByRole('button', { name: /Dodaj sat/ }).click();
  const saturday = day('Subota', 5).getByRole('group');
  await saturday.getByLabel('Sat', { exact: true }).selectOption({ label: 'Black Lotus Yoga' });
  await expect(saturday.getByLabel('Trajanje (min)')).toHaveValue('75');
  await saturday.getByLabel('Početak').fill('10:30');

  // Moving away is held until the changes are saved or dropped.
  await expect(page.getByRole('button', { name: 'Sljedeći tjedan' })).toBeDisabled();
  await page.getByRole('button', { name: 'Spremi tjedan' }).click();
  await expect(page.getByRole('status')).toContainText('je spremljen u raspored.');
  await expect(page.getByRole('button', { name: 'Spremi tjedan' })).toBeDisabled();

  // The schedule shows it.
  await page.goto(`/raspored?tjedan=${monday}`);
  const grid = page.getByRole('group', { name: 'Tjedni raspored' });
  await expect(grid.getByRole('button', { name: /10:00–11:00/ })).toContainText('Joga za kralježnicu');
  await expect(grid.getByRole('button', { name: /10:30–11:45/ })).toContainText('Black Lotus Yoga');
  await expect(page.getByRole('region', { name: `Nedjelja, ${display(plusDays(monday, 6))}` }).getByRole('button')).toHaveCount(0);

  // Wednesday becomes a holiday: its classes stay, cancelled, and check-in is closed.
  await page.getByRole('button', { name: 'Neradni dan' }).click();
  const closures = page.getByRole('dialog', { name: 'Neradni dani' });
  await closures.getByLabel('Datum').fill(plusDays(monday, 2));
  await closures.getByLabel('Naziv').fill('Praznik');
  await closures.getByRole('button', { name: 'Označi neradni dan' }).click();
  await expect(page.getByRole('status')).toContainText('je neradni dan.');
  await closures.getByRole('button', { name: 'Zatvori' }).click();

  const wednesday = page.getByRole('region', { name: `Srijeda, ${display(plusDays(monday, 2))}` });
  await expect(wednesday).toContainText('Neradni dan · Praznik');
  const cancelled = wednesday.getByRole('button', { name: /Black Lotus Yoga/ });
  await expect(cancelled).toContainText('Otkazano · Praznik');
  await cancelled.click();
  await expect(page.getByText('Neradni dan (Praznik): sat je otkazan')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evidentiraj dolazak' })).toBeHidden();
});
