import { expect, type Page, test } from '@playwright/test';
import { openSection, signInToOverview } from './users';

/**
 * A filled-in digital upisnica as a real PDF with a text layer, printed by the browser.
 * The phone has an unreadable digit and the accuracy consent has no tick mark.
 */
async function makeUpisnicaPdf(page: Page): Promise<Buffer> {
  const sheet = await page.context().newPage();
  const row = (label: string, value: string) => `<div class="row"><span class="label">${label}</span><span>${value}</span></div>`;
  await sheet.setContent(`<!doctype html><html lang="hr"><head><meta charset="utf-8"><style>
    body { font: 12pt Arial, Helvetica, sans-serif; margin: 40pt; }
    h1 { font-size: 18pt; margin: 0 0 24pt; }
    .row { display: flex; margin-bottom: 14pt; }
    .label { width: 220pt; flex: none; }
    p { margin: 0 0 14pt; }
  </style></head><body>
    <h1>Prijava za članstvo</h1>
    ${row('Ime i prezime', 'dora vuković')}
    ${row('E-mail', 'Dora.Vukovic@Example.com')}
    ${row('Broj mobitela', '098 76? 4321')}
    ${row('Datum rođenja', '5.4.1993')}
    ${row('Student / umirovljenik?', 'DA')}
    ${row('Odaberite članstvo', '3× tjedno')}
    <p>Postoji li nešto što bi učitelj trebao znati?</p>
    <p>Da</p>
    <p>Molimo navedite</p>
    <p>Osjetljiv donji dio leđa</p>
    <p>Potvrđujem da su navedeni podaci točni.</p>
    <p>Mjesto i datum</p>
    <p>Zagreb, 9.10.2026.</p>
  </body></html>`);
  const pdf = await sheet.pdf({ format: 'A4' });
  await sheet.close();
  return pdf;
}

// The smallest valid PNG: one white pixel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

test.beforeEach(async ({ page }) => {
  await signInToOverview(page);
  await page.getByRole('button', { name: 'Novi član' }).click();
  await expect(page.getByText('Povucite PDF upisnice ovamo')).toBeVisible();
});

test('import a PDF, review the flagged fields and save with the document', async ({ page }) => {
  const pdf = await makeUpisnicaPdf(page);
  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'upisnica-dora.pdf', mimeType: 'application/pdf', buffer: pdf });

  await expect(page.getByRole('heading', { name: 'Provjerite podatke' })).toBeVisible();
  await expect(page.getByText('upisnica-dora.pdf · 1 str.')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Izvorni dokument' })).toBeVisible();

  // The fields are filled in and tidied: name in title case, e-mail lower-cased, date with leading zeros.
  const form = page.getByRole('region', { name: 'Prepoznati podaci' });
  await expect(form.getByLabel('Ime i prezime')).toHaveValue('Dora Vuković');
  await expect(form.getByLabel('E-mail')).toHaveValue('dora.vukovic@example.com');
  await expect(form.getByLabel('Datum rođenja')).toHaveValue('05.04.1993.');
  await expect(form.getByRole('radio', { name: 'DA', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(form.getByRole('radio', { name: /3× tjedno/ })).toHaveAttribute('aria-checked', 'true');
  await expect(form.getByLabel('Molimo navedite')).toHaveValue('Osjetljiv donji dio leđa');
  await expect(form.getByLabel('Mjesto i datum')).toHaveValue('Zagreb, 09.10.2026.');

  // The unreadable phone and the unticked consent are flagged, in the notice, the form and on the page image.
  await expect(form.getByText('2 polja za provjeru')).toBeVisible();
  await expect(form.getByText('Broj mobitela, Potvrda točnosti podataka. Ostalo je prepoznato sigurno.')).toBeVisible();
  await expect(form.getByLabel('Broj mobitela')).toHaveValue('098 76? 4321');
  await expect(form.getByLabel('Broj mobitela')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByText('Provjerite prije spremanja.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Izvorni dokument' }).getByTitle('Broj mobitela')).toBeVisible();

  // Nothing is saved without the accuracy consent.
  const save = form.getByRole('button', { name: 'Spremi člana' });
  await expect(save).toBeDisabled();
  await form.getByLabel('Broj mobitela').fill('098 765 4321');
  await expect(form.getByText('Provjerite prije spremanja.')).toHaveCount(0);
  await form.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await save.click();

  await expect(page.getByRole('status')).toContainText('Dora Vuković je spremljen/a kao novi član.');
  await page.getByRole('link', { name: /Otvori profil/ }).click();

  // The profile has the member and the stored original.
  await expect(page).toHaveURL(/\/clanovi\/[0-9a-f-]{36}$/);
  await expect(page.getByText('098 765 4321')).toBeVisible();
  await expect(page.getByText('Osjetljiv donji dio leđa')).toBeVisible();
  const stored = page.getByRole('button', { name: /upisnica-dora\.pdf/ });
  await expect(stored).toContainText('Uvezeno');

  // "Otvori" fetches the file through the API, with the sign-in token.
  const fileResponse = page.waitForResponse((r) => /\/api\/documents\/[0-9a-f-]{36}\/file$/.test(r.url()));
  await stored.click();
  const response = await fileResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/pdf');
});

test('undo after saving removes the member again', async ({ page }) => {
  const pdf = await makeUpisnicaPdf(page);
  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'upisnica-dora.pdf', mimeType: 'application/pdf', buffer: pdf });
  const form = page.getByRole('region', { name: 'Prepoznati podaci' });
  await form.getByLabel('Ime i prezime').fill('Poništena Osoba');
  await form.getByLabel('Broj mobitela').fill('098 765 4321');
  await form.getByRole('checkbox', { name: /Potvrđujem da su navedeni podaci točni/ }).click();
  await form.getByRole('button', { name: 'Spremi člana' }).click();
  await expect(page.getByRole('status')).toContainText('Poništena Osoba je spremljen/a kao novi član.');

  await page.getByRole('button', { name: 'Poništi' }).click();
  // The form is back, with what was typed.
  await expect(form.getByLabel('Ime i prezime')).toHaveValue('Poništena Osoba');
  await openSection(page, 'Članovi');
  await page.getByRole('searchbox').fill('Poništena');
  await expect(page.getByText('Nema članova za ovaj prikaz')).toBeVisible();
});

test('a photo opens the review with the original and an empty form', async ({ page }) => {
  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'upisnica-foto.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByRole('heading', { name: 'Provjerite podatke' })).toBeVisible();
  await expect(page.getByText('Tekst nije pročitan')).toBeVisible();
  const form = page.getByRole('region', { name: 'Prepoznati podaci' });
  await expect(form.getByLabel('Ime i prezime')).toHaveValue('');
  await expect(form.getByRole('button', { name: 'Spremi člana' })).toBeDisabled();

  await page.getByRole('button', { name: 'Druga datoteka' }).click();
  await expect(page.getByText('Povucite PDF upisnice ovamo')).toBeVisible();
});

test('files that cannot be imported are refused in plain words', async ({ page }) => {
  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'popis.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
  await expect(page.getByText('Odaberite PDF, JPG ili PNG datoteku.')).toBeVisible();

  await page.getByLabel('Odaberite datoteku').setInputFiles({ name: 'pokvaren.pdf', mimeType: 'application/pdf', buffer: Buffer.from('this is not a pdf') });
  await expect(page.getByText('Datoteka se nije mogla otvoriti. Pokušajte s drugom.')).toBeVisible();
});
