import { expect, test } from '@playwright/test';
import { signIn, TEACHER } from './users';

test('a teacher signs in to an empty tool: no sections yet, and no way into them', async ({ page }) => {
  await signIn(page, TEACHER);
  await expect(page.getByText('Pristup još nije postavljen')).toBeVisible();
  await expect(page).toHaveURL(/\/bez-pristupa$/);

  // The sidebar has no sections, only their name and "Odjava"; no feedback either (that is for the owners).
  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('button', { name: 'Članovi' })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Pregled' })).toHaveCount(0);
  await expect(page.getByText('Petra').first()).toBeVisible();
  await expect(page.getByText('Desni klik bilo gdje: povratna informacija')).toHaveCount(0);

  // Typing an address doesn't get them in either.
  for (const path of ['/clanovi', '/uplate', '/analitika', '/clanovi/novi/rucno']) {
    await page.goto(path);
    await expect(page.getByText('Pristup još nije postavljen')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Odjava' }).click();
  await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
});
