import { expect, type Page, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

/** "65,00 €" from cents, as the app shows money. */
const money = (cents: number) => `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(cents / 100)} €`;

interface Dashboard {
  counts: { active_members: number; expiring_this_week: number; debts_total_cents: number; payments_this_month_cents: number };
  attention: Array<{ full_name: string; status: string }>;
  today: unknown[];
}

/** Loads the overview afresh and returns what the API answered for it. */
async function loadOverview(page: Page): Promise<Dashboard> {
  const response = page.waitForResponse((r) => r.url().includes('/api/dashboard') && r.ok());
  // A full load, so there is always a new request to read, even when the overview is already open.
  await page.goto('/pregled');
  await expect(page.getByRole('heading', { name: 'Pregled' })).toBeVisible();
  return (await (await response).json()) as Dashboard;
}

const stat = (page: Page, label: string | RegExp) => page.getByText(label).locator('xpath=following-sibling::span');

test.beforeEach(async ({ page }) => {
  await signInToOverview(page);
});

test('the overview numbers match the API, and unpaid and expiring members are in "Za provjeru"', async ({ page }) => {
  const data = await loadOverview(page);

  await expect(stat(page, 'Aktivni članovi')).toHaveText(String(data.counts.active_members));
  await expect(stat(page, 'Ističu ovaj tjedan')).toHaveText(String(data.counts.expiring_this_week));
  await expect(stat(page, 'Dugovanja')).toHaveText(money(data.counts.debts_total_cents));
  await expect(stat(page, /^Uplate u /)).toHaveText(money(data.counts.payments_this_month_cents));

  const check = page.getByRole('region', { name: 'Za provjeru' });
  await expect(check.getByRole('button')).toHaveCount(data.attention.length);
  for (const member of data.attention) {
    await expect(check.getByRole('button', { name: new RegExp(member.full_name) })).toContainText(member.status === 'unpaid' ? 'Neplaćeno' : 'Ističe');
  }
  // From the dev seed: one unpaid member and two memberships ending this week.
  await expect(check.getByRole('button', { name: /Marko Kovač/ })).toContainText('1× tjedno · 65,00 €');
  await expect(check.getByRole('button', { name: /Ana Horvat/ })).toContainText('Ističe za 3 dana');
  await expect(check.getByRole('button', { name: /Iva Babić/ })).toContainText('Ističe za 5 dana');

  // Today's and tomorrow's classes, with a link to the whole week.
  await expect(page.getByText(/^Danas · /)).toBeVisible();
  await expect(page.getByText(/^Sutra · /)).toBeVisible();
  await page.getByRole('link', { name: /Cijeli raspored/ }).click();
  await expect(page.getByRole('heading', { name: 'Raspored' })).toBeVisible();
});

test('recording a payment clears the debt everywhere', async ({ page }) => {
  const before = await loadOverview(page);
  await page.getByRole('region', { name: 'Za provjeru' }).getByRole('button', { name: /Marko Kovač/ }).click();

  await expect(page.getByText('Dugovanje 65,00 €')).toBeVisible();
  await page.getByRole('button', { name: 'Zabilježi uplatu' }).click();
  const form = page.getByRole('dialog', { name: 'Zabilježi uplatu' });
  // The amount starts from what is owed.
  await expect(form.getByLabel('Iznos (€)')).toHaveValue('65,00');
  await form.getByLabel('Iznos (€)').fill('abc');
  await form.getByRole('button', { name: 'Zabilježi uplatu' }).click();
  await expect(form.getByText('Upišite iznos, npr. 65,00.')).toBeVisible();
  await form.getByLabel('Iznos (€)').fill('65');
  await form.getByRole('radio', { name: 'Kartica' }).click();
  await form.getByRole('button', { name: 'Zabilježi uplatu' }).click();

  await expect(page.getByRole('status')).toContainText('Uplata je zabilježena.');
  await expect(page.getByText('Dugovanje 65,00 €')).toHaveCount(0);
  await expect(page.getByText(/1× tjedno · kartica/)).toBeVisible();

  const after = await loadOverview(page);
  expect(after.counts.debts_total_cents).toBe(before.counts.debts_total_cents - 6500);
  expect(after.counts.payments_this_month_cents).toBe(before.counts.payments_this_month_cents + 6500);
  await expect(page.getByRole('region', { name: 'Za provjeru' }).getByRole('button', { name: /Marko Kovač/ })).toHaveCount(0);

  // The payment is in this month's list.
  await openSection(page, 'Uplate');
  const row = page.getByRole('row', { name: /Marko Kovač/ });
  await expect(row).toContainText('kartica');
  await expect(row).toContainText('65,00 €');
  await page.getByRole('button', { name: 'Prethodni mjesec' }).click();
  await expect(page).toHaveURL(/mjesec=\d{4}-\d{2}/);
});

test('add, freeze and renew a membership from the profile', async ({ page }) => {
  await openSection(page, 'Članovi');

  // A member with no membership gets one.
  await page.getByRole('button', { name: /Ivan Knežević/ }).click();
  await expect(page.getByText('Član trenutno nema članarinu.')).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj članarinu' }).click();
  const add = page.getByRole('dialog', { name: 'Nova članarina' });
  await add.getByRole('button', { name: 'Spremi članarinu' }).click();
  await expect(add.getByText('Odaberite članarinu.')).toBeVisible();
  await add.getByLabel('Članarina').selectOption({ label: 'Proba' });
  await add.getByRole('button', { name: 'Spremi članarinu' }).click();
  await expect(page.getByRole('status')).toContainText('Članarina je dodana.');
  await expect(page.getByText('0 od 1 iskorišteno')).toBeVisible();

  // Freeze and unfreeze.
  await page.getByRole('link', { name: /Članovi/ }).click();
  await page.getByRole('button', { name: /Nina Šimić/ }).click();
  await page.getByRole('button', { name: 'Zamrzni' }).click();
  const freeze = page.getByRole('dialog', { name: 'Zamrzni članarinu' });
  await freeze.getByRole('button', { name: 'Zamrzni' }).click();
  await expect(page.getByRole('status')).toContainText('Članarina je zamrznuta do');
  await expect(page.getByText('Zamrznuta', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Odmrzni' }).click();
  await expect(page.getByRole('status')).toContainText('Članarina više nije zamrznuta.');
  await expect(page.getByText('Aktivna', { exact: true })).toBeVisible();

  // Renew: the member stops showing as expiring, and can't be renewed twice.
  await page.getByRole('link', { name: /Članovi/ }).click();
  await page.getByRole('button', { name: /Iva Babić/ }).click();
  await expect(page.getByText('Ističe za 5 dana')).toBeVisible();
  await page.getByRole('button', { name: 'Produži članarinu' }).click();
  const renew = page.getByRole('dialog', { name: 'Produži članarinu' });
  await expect(renew.getByLabel('Razdoblje')).toHaveValue(/^\d{2}\.\d{2}\.\d{4}\.–\d{2}\.\d{2}\.\d{4}\.$/);
  await renew.getByRole('button', { name: 'Produži članarinu' }).click();
  await expect(page.getByRole('status')).toContainText('Članarina je produžena do');
  await expect(page.getByText(/^Produženo do \d{2}\.\d{2}\.\d{4}\.$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Produži članarinu' })).toHaveCount(0);
  await expect(page.getByText('Ističe za 5 dana')).toHaveCount(0);
});

test('set a plan price', async ({ page }) => {
  await openSection(page, 'Karte i članarine');
  const row = page.getByRole('row', { name: /Proba/ });
  await expect(row).toContainText('Cijena nije upisana');

  await row.getByRole('button', { name: 'Uredi: Proba' }).click();
  const form = page.getByRole('dialog', { name: 'Uredi članarinu' });
  await form.getByLabel('Cijena (€)').fill('10');
  await form.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(row).toContainText('10,00 €');

  // Back to no price, so trial members are not shown as owing.
  await row.getByRole('button', { name: 'Uredi: Proba' }).click();
  await form.getByLabel('Cijena (€)').fill('');
  await form.getByRole('button', { name: 'Spremi promjene' }).click();
  await expect(row).toContainText('Cijena nije upisana');
});
