import { expect, type Page } from '@playwright/test';

/** The dev seed allowlists this address as the owner. */
export const OWNER = { email: 'mario@prana.test', password: 'prana-e2e-owner' };
/** A real Firebase account that is not on the studio's staff list. */
export const STRANGER = { email: 'stranger@prana.test', password: 'prana-e2e-stranger' };

export async function signIn(page: Page, user = OWNER) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Lozinka').fill(user.password);
  await page.getByRole('button', { name: 'Prijava', exact: true }).click();
}

/** Signs in as the owner and waits for the overview, where the app opens. */
export async function signInToOverview(page: Page) {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Pregled' })).toBeVisible();
}

/** Opens a section from the sidebar and waits for its page title. */
export async function openSection(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}
