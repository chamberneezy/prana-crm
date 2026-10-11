// Writes apps/web/public/primjer-upisnice.pdf: a filled-in sample upisnica with a text layer,
// offered on the demo's import page so the import can be tried without a real form.
//   node scripts/make-sample-pdf.mjs
import { chromium } from '@playwright/test';

const row = (label, value) => `<div class="row"><span class="label">${label}</span><span>${value}</span></div>`;

const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><style>
  body { font: 12pt Arial, Helvetica, sans-serif; margin: 40pt; color: #2a322e; }
  h1 { font-size: 18pt; margin: 0 0 6pt; }
  .lead { margin: 0 0 24pt; color: #535c55; font-size: 10pt; }
  .row { display: flex; margin-bottom: 14pt; }
  .label { width: 220pt; flex: none; }
  p { margin: 0 0 14pt; }
  .gap { margin-top: 24pt; }
</style></head><body>
  <h1>Prijava za članstvo</h1>
  <p class="lead">Primjer ispunjene upisnice · izmišljeni podaci</p>
  ${row('Ime i prezime', 'Lucija Perić')}
  ${row('E-mail', 'lucija.peric@example.com')}
  ${row('Broj mobitela', '098 76? 4321')}
  ${row('Datum rođenja', '22.07.1991.')}
  ${row('Student / umirovljenik?', 'NE')}
  ${row('Odaberite članstvo', '2× tjedno')}
  <p class="gap">Postoji li nešto što bi učitelj trebao znati?</p>
  <p>Da</p>
  <p>Molimo navedite</p>
  <p>Bol u lijevom koljenu</p>
  <p class="gap">Potvrđujem da su navedeni podaci točni.</p>
  <p>Mjesto i datum</p>
  <p>Zagreb, 11.10.2026.</p>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
await page.pdf({ path: 'apps/web/public/primjer-upisnice.pdf', format: 'A4' });
await browser.close();
console.log('Wrote apps/web/public/primjer-upisnice.pdf');
