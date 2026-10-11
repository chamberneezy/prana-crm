import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Prijava' })).toBeVisible();
  await expect(page.getByText('Ovo je demo')).toBeVisible();
  await page.getByRole('button', { name: 'Prijava', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pregled' })).toBeVisible();
}

const openSection = async (page: Page, name: string) => {
  await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
};

test('the demo runs with no server: sample data, and changes that survive a reload', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await enter(page);

  // The sample data is there.
  await expect(page.getByRole('region', { name: 'Za provjeru' }).getByRole('button', { name: /Marko Kovač/ })).toContainText('Neplaćeno');
  await openSection(page, 'Članovi');
  await expect(page.getByRole('tab', { name: /^Svi/ })).toHaveText('Svi 8');

  // Add a member by hand.
  await page.getByRole('button', { name: 'Novi član' }).click();
  await page.getByRole('link', { name: /Upiši ručno/ }).click();
  await page.getByLabel('Ime i prezime').fill('Demo Posjetitelj');
  await page.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await page.getByRole('button', { name: 'Spremi člana' }).click();
  await expect(page).toHaveURL(/\/prana-crm\/clanovi\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('status')).toContainText('Demo Posjetitelj je spremljen/a kao novi član.');

  // A deep link reloads into the same page, still signed in, with the new member kept in this browser.
  await page.reload();
  await expect(page.getByText('Demo Posjetitelj').first()).toBeVisible();
  await openSection(page, 'Članovi');
  await expect(page.getByRole('tab', { name: /^Svi/ })).toHaveText('Svi 9');

  // Nothing was sent to an API or to a sign-in service.
  // (Fonts still come from Google Fonts, as in the real app.)
  expect(requests.filter((url) => /\/api\/|identitytoolkit|securetoken|firebase/.test(url))).toEqual([]);
});

test('schedule, check-in, payment and PDF import all work in the demo', async ({ page }) => {
  await enter(page);

  // Schedule a session and check a member in.
  await openSection(page, 'Raspored');
  await page.getByRole('button', { name: 'Restorativna joga', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Novi termin' });
  await form.getByLabel('Početak').fill('21:30');
  await form.getByRole('button', { name: 'Dodaj termin' }).click();
  const card = page.getByRole('button', { name: /21:30–22:30/ });
  await card.click();
  const panel = page.getByRole('dialog', { name: 'Restorativna joga' });
  await panel.getByLabel('Pretražite člana').fill('maja');
  await panel.getByRole('button', { name: 'Evidentiraj: Maja Perić' }).click();
  await expect(card).toContainText('1 prijava');
  await page.keyboard.press('Escape');

  // Record the unpaid member's payment.
  await openSection(page, 'Pregled');
  await page.getByRole('region', { name: 'Za provjeru' }).getByRole('button', { name: /Marko Kovač/ }).click();
  await page.getByRole('button', { name: 'Zabilježi uplatu' }).click();
  await page.getByRole('dialog', { name: 'Zabilježi uplatu' }).getByRole('button', { name: 'Zabilježi uplatu' }).click();
  await expect(page.getByText('Dugovanje 65,00 €')).toHaveCount(0);

  // Import the sample form offered on the import page, and open the stored file from the profile.
  await openSection(page, 'Članovi');
  await page.getByRole('button', { name: 'Novi član' }).click();
  await expect(page.getByRole('link', { name: /Preuzmite primjer upisnice/ })).toHaveAttribute('href', '/prana-crm/primjer-upisnice.pdf');
  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'primjer-upisnice.pdf', mimeType: 'application/pdf', buffer: readFileSync('apps/web/public/primjer-upisnice.pdf') });
  await expect(page.getByRole('heading', { name: 'Provjerite podatke' })).toBeVisible();
  const review = page.getByRole('region', { name: 'Prepoznati podaci' });
  await expect(review.getByLabel('Ime i prezime')).toHaveValue('Lucija Perić');
  await expect(review.getByLabel('Broj mobitela')).toHaveAttribute('aria-invalid', 'true');
  await review.getByLabel('Broj mobitela').fill('098 765 4321');
  await review.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await review.getByRole('button', { name: 'Spremi člana' }).click();
  await page.getByRole('link', { name: /Otvori profil/ }).click();
  await expect(page.getByRole('button', { name: /primjer-upisnice\.pdf/ })).toContainText('Uvezeno');

  // "Otvori" opens the stored file in a new tab without complaint…
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: /primjer-upisnice\.pdf/ }).click();
  await popup;
  await expect(page.getByText('Datoteka se nije otvorila')).toHaveCount(0);

  // …and it is kept, intact, in this browser's own storage.
  const header = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('prana-demo');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('bytes').objectStore('bytes');
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            const key = keys.result.find((k) => String(k).startsWith('file:'));
            if (!key) return resolve('no stored file');
            const file = store.get(key);
            file.onsuccess = () => resolve(new TextDecoder().decode((file.result as Uint8Array).subarray(0, 24)));
          };
        };
      }),
  );
  expect(header).toBe('application/pdf\0%PDF-1.4');
});

test('"Vrati početne podatke" starts again from the sample data', async ({ page }) => {
  await enter(page);
  await openSection(page, 'Članovi');
  await page.getByRole('button', { name: 'Novi član' }).click();
  await page.getByRole('link', { name: /Upiši ručno/ }).click();
  await page.getByLabel('Ime i prezime').fill('Privremeni Član');
  await page.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await page.getByRole('button', { name: 'Spremi člana' }).click();
  await expect(page.getByRole('status')).toContainText('Privremeni Član');

  await page.getByRole('button', { name: 'Odjava' }).click();
  await page.getByRole('button', { name: 'Vrati početne podatke' }).click();
  await page.getByRole('button', { name: 'Prijava', exact: true }).click();
  await openSection(page, 'Članovi');
  await expect(page.getByRole('tab', { name: /^Svi/ })).toHaveText('Svi 8');
});
