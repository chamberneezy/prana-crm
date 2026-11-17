import { expect, test } from '@playwright/test';
import { signInToOverview } from './users';

test('the owner adds members from a CSV list; ones already there are not added twice', async ({ page }) => {
  await signInToOverview(page);
  await page.goto('/clanovi/novi');
  const csv = 'Ime i prezime;E-mail;Datum rođenja\nAna Horvat;;\nKlara Tablica;klara@example.com;3.4.1990.\nMirna Tablica;;\n';
  await page.getByLabel('Popis članova').setInputFiles({ name: 'clanovi.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  await expect(page.getByRole('heading', { name: 'Uvoz članova' })).toBeVisible();
  await expect(page.getByText('Pronađeno: 3 člana · 1 već postoji')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Ana Horvat' })).toContainText('Već upisan/a');
  await expect(page.getByRole('listitem').filter({ hasText: 'Klara Tablica' })).toContainText('klara@example.com · 03.04.1990');

  const add = page.getByRole('button', { name: 'Dodaj: 2 člana' });
  await expect(add).toBeDisabled();
  await page.getByRole('checkbox', { name: /Svi ovi članovi/ }).click();
  await add.click();
  await expect(page.getByRole('status')).toContainText('Dodano: 2 člana. Preskočeno: 0.');

  await page.getByRole('button', { name: 'Članovi' }).last().click();
  await expect(page.getByText('Klara Tablica')).toBeVisible();
});
