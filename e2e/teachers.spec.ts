import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

test('a class type names who teaches it, and its new sessions start with the first of them', async ({ page }) => {
  const teacher = `Lana ${Date.now().toString().slice(-5)}`;
  await signInToOverview(page);
  await openSection(page, 'Vrste satova');
  const row = page.getByRole('region', { name: 'Joga' }).getByRole('row', { name: /Black Lotus Yoga/ });
  // The sample data has Ivan teaching it.
  await expect(row).toContainText('Ivan');

  await row.getByRole('button', { name: 'Uredi' }).click();
  const edit = page.getByRole('dialog', { name: 'Uredi vrstu sata' });
  const who = edit.getByRole('group', { name: 'Tko vodi' });
  await expect(who.getByRole('checkbox', { name: /^Ivan/ })).toBeChecked();

  // A new teacher is added by name and ticked straight away.
  await who.getByLabel('Ime učitelja').fill(teacher);
  await who.getByRole('button', { name: 'Dodaj' }).click();
  await expect(page.getByRole('status')).toContainText(`${teacher} je dodan/a kao učitelj.`);
  await expect(who.getByRole('checkbox', { name: new RegExp(teacher) })).toBeChecked();
  // Unticking Ivan makes the new teacher the first.
  await who.getByRole('checkbox', { name: /^Ivan/ }).click();
  await edit.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(row).toContainText(teacher);
  await expect(row).not.toContainText('Ivan');

  await row.getByRole('button', { name: 'Zakaži' }).click();
  const session = page.getByRole('dialog', { name: 'Novi termin' });
  await expect(session.getByLabel('Učitelj').locator('option:checked')).toHaveText(teacher);
});
