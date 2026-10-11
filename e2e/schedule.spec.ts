import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

/** Today's date in the studio's time zone, as YYYY-MM-DD. */
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zagreb' }).format(new Date());

test.beforeEach(async ({ page }) => {
  await signInToOverview(page);
  await openSection(page, 'Članovi');
});

test('schedule a session from a class type and check a member in', async ({ page }) => {
  // The dev seed gives Maja Perić a 2× tjedno membership with 4 of 8 visits used.
  await page.getByRole('searchbox').fill('Maja');
  await expect(page.getByRole('button', { name: /Maja Perić/ })).toContainText('4/8 dolazaka');

  await page.getByRole('button', { name: 'Raspored' }).click();
  await expect(page.getByRole('heading', { name: 'Raspored' })).toBeVisible();

  // From the class type: the form opens with the class and its usual length filled in.
  await page.getByRole('button', { name: 'Restorativna joga', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novi termin' });
  await expect(form.getByLabel('Vrsta sata')).toHaveValue(/.+/);
  await expect(form.getByLabel('Trajanje (min)')).toHaveValue('60');
  await expect(form.getByLabel('Datum')).toHaveValue(today);

  // Nothing is saved without a start time.
  await form.getByRole('button', { name: 'Dodaj termin' }).click();
  await expect(form.getByText('Upišite vrijeme početka.')).toBeVisible();
  await form.getByLabel('Početak').fill('21:30');
  await form.getByLabel('Broj mjesta').fill('2');
  await form.getByRole('button', { name: 'Dodaj termin' }).click();
  await expect(page.getByRole('status')).toContainText('Termin je dodan u raspored.');

  const card = page.getByRole('button', { name: /21:30–22:30/ });
  await expect(card).toContainText('Restorativna joga');
  await expect(card).toContainText('0 prijava');

  // Check Maja in from the session's panel.
  await card.click();
  const panel = page.getByRole('dialog', { name: 'Restorativna joga' });
  await expect(panel.getByText('Još nema evidentiranih dolazaka')).toBeVisible();
  await panel.getByLabel('Pretražite člana').fill('maja');
  await panel.getByRole('button', { name: 'Evidentiraj: Maja Perić' }).click();
  await expect(page.getByRole('status')).toContainText('Dolazak evidentiran: Maja Perić.');
  await expect(panel.getByRole('button', { name: 'Ukloni dolazak: Maja Perić' })).toBeVisible();
  await expect(card).toContainText('1 prijava');

  // The same member can't be checked in twice.
  await panel.getByLabel('Pretražite člana').fill('maja');
  await expect(panel.getByText('Evidentirano')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // The visit counts toward her membership.
  await page.getByRole('button', { name: 'Članovi' }).click();
  await page.getByRole('searchbox').fill('Maja');
  await expect(page.getByRole('button', { name: /Maja Perić/ })).toContainText('5/8 dolazaka');
});

test('week navigation, and edit and delete a session', async ({ page }) => {
  await page.getByRole('button', { name: 'Raspored' }).click();
  const week = page.getByRole('group', { name: 'Tjedni raspored' });
  await expect(week.getByRole('button').first()).toBeVisible();
  const label = page.getByText(/^\d{2}\.(\d{2}\.)?–\d{2}\.\d{2}\.\d{4}\.$/);
  const thisWeek = await label.textContent();

  await page.getByRole('button', { name: 'Sljedeći tjedan' }).click();
  await expect(label).not.toHaveText(thisWeek ?? '');
  await expect(page).toHaveURL(/tjedan=\d{4}-\d{2}-\d{2}/);
  await page.getByRole('button', { name: 'Ovaj tjedan' }).click();
  await expect(label).toHaveText(thisWeek ?? '');

  await page.getByRole('button', { name: 'Novi termin' }).click();
  const form = page.getByRole('dialog', { name: 'Novi termin' });
  await form.getByLabel('Vrsta sata').selectOption({ label: 'Pranayama & meditacija' });
  await expect(form.getByLabel('Trajanje (min)')).toHaveValue('30');
  await form.getByLabel('Početak').fill('06:15');
  await form.getByRole('button', { name: 'Dodaj termin' }).click();

  const card = page.getByRole('button', { name: /06:15–06:45/ });
  await expect(card).toContainText('slobodan ulaz');
  await card.click();
  const panel = page.getByRole('dialog', { name: 'Pranayama & meditacija' });
  await panel.getByRole('button', { name: 'Uredi termin' }).click();
  const edit = page.getByRole('dialog', { name: 'Uredi termin' });
  await edit.getByLabel('Početak').fill('06:30');
  await edit.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(page.getByRole('button', { name: /06:30–07:00/ })).toBeVisible();

  await panel.getByRole('button', { name: 'Obriši termin' }).click();
  await expect(panel.getByText('Obrisati ovaj termin?')).toBeVisible();
  await panel.getByRole('button', { name: 'Obriši', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Termin je obrisan.');
  await expect(page.getByRole('button', { name: /06:30–07:00/ })).toHaveCount(0);
});

test('class types: add one, edit it and schedule from it', async ({ page }) => {
  await page.getByRole('button', { name: 'Vrste satova' }).click();
  await expect(page.getByRole('heading', { name: 'Vrste satova' })).toBeVisible();
  const joga = page.getByRole('region', { name: 'Joga' });
  await expect(joga.getByRole('row')).toHaveCount(6); // header + the five seeded classes
  await expect(joga.getByRole('row', { name: /Ashtanga Mysore/ })).toContainText('120 min');

  await page.getByRole('button', { name: 'Nova vrsta sata' }).click();
  const form = page.getByRole('dialog', { name: 'Nova vrsta sata' });
  await form.getByRole('button', { name: 'Spremi vrstu sata' }).click();
  await expect(form.getByText('Upišite naziv.')).toBeVisible();
  await form.getByLabel('Naziv').fill('Yin joga');
  await form.getByRole('radio', { name: 'Rumenilo' }).click();
  await form.getByLabel('Trajanje (min)').fill('90');
  await form.getByRole('button', { name: 'Spremi vrstu sata' }).click();
  await expect(page.getByRole('status')).toContainText('Yin joga je spremljena.');

  const row = joga.getByRole('row', { name: /Yin joga/ });
  await expect(row).toContainText('90 min');
  await expect(row).toContainText('Na početku sata');

  await row.getByRole('button', { name: 'Uredi' }).click();
  const edit = page.getByRole('dialog', { name: 'Uredi vrstu sata' });
  await edit.getByLabel('Pravilo ulaza').fill('Slobodan ulaz');
  await edit.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(row).toContainText('Slobodan ulaz');

  // "Zakaži" opens Novi termin on the schedule with this class type chosen.
  await row.getByRole('button', { name: 'Zakaži' }).click();
  await expect(page.getByRole('heading', { name: 'Raspored' })).toBeVisible();
  const session = page.getByRole('dialog', { name: 'Novi termin' });
  await expect(session.getByLabel('Trajanje (min)')).toHaveValue('90');
  await expect(session.getByLabel('Vrsta sata').locator('option:checked')).toHaveText('Yin joga');
});
