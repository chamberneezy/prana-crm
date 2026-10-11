import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

test.beforeEach(async ({ page }) => {
  await signInToOverview(page);
  await openSection(page, 'Članovi');
});

test('filter, search and open a profile', async ({ page }) => {
  const list = page.getByRole('region', { name: 'Popis članova' });

  // Each filter chip carries its count, and the list shows exactly that many members.
  // (Other flows add members to the same database, so the counts are read rather than fixed.)
  const count = async (chip: RegExp) => Number(((await page.getByRole('tab', { name: chip }).textContent()) ?? '').replace(/\D/g, ''));

  await page.getByRole('tab', { name: /^Neplaćeno/ }).click();
  await expect(page.getByRole('tab', { name: /^Neplaćeno/ })).toHaveAttribute('aria-selected', 'true');
  await expect(list.getByRole('button')).toHaveCount(await count(/^Neplaćeno/));
  await expect(list.getByRole('button', { name: /Marko Kovač/ })).toContainText('Neplaćeno');
  for (const row of await list.getByRole('button').all()) await expect(row).toContainText('Neplaćeno');

  await page.getByRole('tab', { name: /^Svi/ }).click();
  await expect(list.getByRole('button')).toHaveCount(await count(/^Svi/));
  await page.getByRole('searchbox').fill('simic');
  // The search is applied a moment after typing stops.
  await expect(page).toHaveURL(/q=simic/);
  await expect(list.getByRole('button')).toHaveCount(1);
  await list.getByRole('button', { name: /Nina Šimić/ }).click();

  await expect(page).toHaveURL(/\/clanovi\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Nina Šimić').first()).toBeVisible();
  await expect(page.getByText('Važno za praksu · vidi učitelj')).toBeVisible();
  await expect(page.getByText('Zadnji dolasci')).toBeVisible();

  // Going back keeps the search.
  await page.getByRole('link', { name: /Članovi/ }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('simic');
});

test('add a member manually', async ({ page }) => {
  const name = `Proba Testić ${Date.now().toString().slice(-6)}`;
  await page.getByRole('button', { name: 'Novi član' }).click();
  await page.getByRole('link', { name: /Upiši ručno/ }).click();
  await expect(page.getByRole('heading', { name: 'Novi član' })).toBeVisible();
  await expect(page.getByText('Prijava za članstvo')).toBeVisible();

  await page.getByLabel('Ime i prezime').fill(name);
  await page.getByLabel('E-mail').fill('proba.testic@example.com');
  await page.getByLabel('Broj mobitela').fill('091 111 2222');
  await page.getByLabel('Datum rođenja').fill('31.02.1990.');
  await page.getByRole('radio', { name: /3× tjedno/ }).click();
  await page.getByRole('radio', { name: 'Da, molimo navedite' }).click();
  await page.getByLabel('Molimo navedite').fill('Osjetljivo rame');

  // The form is signed at the studio, today: the city and the date are separate fields.
  await expect(page.getByLabel('Mjesto', { exact: true })).toHaveValue('Varaždin');
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue(/^\d{2}\.\d{2}\.\d{4}\.$/);
  await page.getByLabel('Datum', { exact: true }).fill('31.02.2026.');
  await page.getByLabel('Mjesto', { exact: true }).fill('Čakovec');

  // Nothing is saved without the accuracy consent.
  const save = page.getByRole('button', { name: 'Spremi člana' });
  await expect(save).toBeDisabled();
  await page.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await expect(save).toBeEnabled();

  // A date that doesn't exist is caught before saving.
  await save.click();
  await expect(page.getByText('Unesite datum u obliku dd.mm.gggg.')).toHaveCount(2);
  await page.getByLabel('Datum rođenja').fill('28.02.1990.');
  await page.getByLabel('Datum', { exact: true }).fill('3.10.2026');
  await save.click();

  await expect(page).toHaveURL(/\/clanovi\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('status')).toContainText(`${name} je spremljen/a kao novi član.`);
  await expect(page.getByText('Osjetljivo rame')).toBeVisible();
  await expect(page.getByText('3× tjedno').first()).toBeVisible();
  // The corrected place and date were saved with the member.
  await expect(page.getByText('potpisano', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Uredi' }).click();
  await expect(page.getByLabel('Mjesto', { exact: true })).toHaveValue('Čakovec');
  await expect(page.getByLabel('Datum', { exact: true })).toHaveValue('03.10.2026.');
  await page.getByRole('button', { name: 'Odustani' }).click();

  await page.getByRole('link', { name: /Članovi/ }).click();
  await page.getByRole('searchbox').fill(name);
  await expect(page.getByRole('region', { name: 'Popis članova' }).getByRole('button', { name: new RegExp(name) })).toBeVisible();
});
