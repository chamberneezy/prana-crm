import { expect, test } from '@playwright/test';
import { OWNER, signIn, STRANGER } from './users';

test('the owner signs in and lands on the member list', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Članovi' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ana Horvat/ })).toBeVisible();

  // The session survives a reload, and signing out returns to the login screen.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Članovi' })).toBeVisible();
  await page.getByRole('button', { name: 'Odjava' }).click();
  await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
});

test('an account that is not on the staff list gets no access', async ({ page }) => {
  await signIn(page, STRANGER);
  await expect(page.getByRole('alert')).toHaveText('Ovaj račun nema pristup studiju.');
  await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Članovi' })).toHaveCount(0);
});

test('a wrong password is explained in plain words', async ({ page }) => {
  await signIn(page, { email: OWNER.email, password: 'not-the-password' });
  await expect(page.getByRole('alert')).toHaveText('E-mail ili lozinka nisu točni.');
});
