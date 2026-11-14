import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

test("the studio adds its own membership, signs someone up on it, and removes it", async ({ page }) => {
  const plan = `Studentska ${Date.now().toString().slice(-5)}`;
  await signInToOverview(page);
  await openSection(page, 'Članarine');

  await page.getByRole('button', { name: 'Nova članarina' }).click();
  const panel = page.getByRole('dialog', { name: 'Nova članarina' });
  await panel.getByLabel('Naziv').fill(plan);
  await panel.getByLabel('Dolasci mjesečno').fill('0');
  await panel.getByLabel('Cijena (€)').fill('40');
  await panel.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(panel.getByText('Upišite broj od 1 do 100, ili ostavite prazno.')).toBeVisible();
  await panel.getByLabel('Dolasci mjesečno').fill('4');
  await panel.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(page.getByRole('status')).toContainText(`Članarina „${plan}” je dodana.`);
  const row = page.getByRole('row', { name: new RegExp(plan) });
  await expect(row).toContainText('Vlastita');
  await expect(row).toContainText('40,00 €');

  // It is offered when signing someone up, with its price.
  await openSection(page, 'Članovi');
  await page.getByRole('button', { name: 'Novi član' }).click();
  await page.getByRole('link', { name: /Upiši ručno/ }).click();
  await page.getByLabel('Ime', { exact: true }).fill('Iva');
  await page.getByLabel('Prezime').fill('Studentić');
  await page.getByRole('radio', { name: new RegExp(plan) }).click();
  await expect(page.getByText('Plaćeno? (40,00 €)')).toBeVisible();
  await page.getByRole('radio', { name: 'Gotovina' }).click();
  await page.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await page.getByRole('button', { name: 'Spremi člana' }).click();
  await expect(page).toHaveURL(/\/clanovi\/[0-9a-f-]{36}$/);
  await expect(page.getByText(plan).first()).toBeVisible();

  // Removing it: memberships already on it stay.
  await openSection(page, 'Članarine');
  await page.getByRole('row', { name: new RegExp(plan) }).getByRole('button', { name: /Uredi/ }).click();
  const edit = page.getByRole('dialog', { name: 'Uredi članarinu' });
  await edit.getByRole('button', { name: 'Ukloni' }).click();
  await expect(edit.getByText(/Postojeće članarine na njoj ostaju/)).toBeVisible();
  await edit.getByRole('button', { name: 'Ukloni' }).click();
  await expect(page.getByRole('status')).toContainText(`Članarina „${plan}” je uklonjena.`);
  await expect(page.getByRole('row', { name: new RegExp(plan) })).toHaveCount(0);
});
