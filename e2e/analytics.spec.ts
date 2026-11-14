import { expect, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

test('Analitika shows attendance and income, and the period can be changed', async ({ page }) => {
  await signInToOverview(page);
  await openSection(page, 'Analitika');

  const stats = page.getByRole('region', { name: 'Analitika' });
  await expect(stats.getByText('Dolasci', { exact: true })).toBeVisible();
  await expect(stats.getByText('Prihod', { exact: true })).toBeVisible();

  // Six months by default, one column each.
  await expect(page.getByRole('tab', { name: '6 mj.' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Dolasci po mjesecima' }).getByRole('listitem')).toHaveCount(6);
  await page.getByRole('tab', { name: '12 mj.' }).click();
  await expect(page.getByRole('region', { name: 'Dolasci po mjesecima' }).getByRole('listitem')).toHaveCount(12);

  // The sample classes are listed with their visits; the busiest times have counts.
  await expect(page.getByRole('region', { name: 'Po vrsti sata' }).getByText('Ashtanga Mysore')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Kada dolaze' }).getByRole('cell', { name: /dolaz/ }).first()).toBeVisible();

  // A member in a list opens their profile.
  await page.getByRole('region', { name: 'Najaktivniji' }).getByRole('link').first().click();
  await expect(page).toHaveURL(/\/clanovi\/[0-9a-f-]{36}$/);
});
