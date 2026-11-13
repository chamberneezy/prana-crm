import { expect, test } from '@playwright/test';
import { FIRESTORE_EMULATOR_URL } from '../scripts/emulator-user.mjs';
import { OWNER, openSection, signInToOverview } from './users';

const FEEDBACK = `${FIRESTORE_EMULATOR_URL}/v1/projects/prana-crm/databases/(default)/documents/feedback`;

/** Firestore's typed JSON, as far as these checks read it. */
interface Value {
  stringValue?: string;
  mapValue?: { fields: Record<string, Value> };
}

/** Every entry stored in the Firestore emulator (read as its administrator). */
async function storedEntries(): Promise<Array<Record<string, Value>>> {
  const res = await fetch(`${FEEDBACK}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  const body = (await res.json()) as { documents?: Array<{ fields: Record<string, Value> }> };
  return (body.documents ?? []).map((d) => d.fields);
}

const text = (entry: Record<string, Value> | undefined, ...path: string[]) => {
  let value: Value | undefined = entry?.[path[0]!];
  for (const key of path.slice(1)) value = value?.mapValue?.fields[key];
  return value?.stringValue;
};

test('right-click on an element sends feedback about it', async ({ page }) => {
  await signInToOverview(page);
  await openSection(page, 'Članovi');
  await expect(page.getByText('Desni klik bilo gdje: povratna informacija').first()).toBeVisible();

  await page.getByRole('button', { name: 'Novi član' }).click({ button: 'right' });
  const dialog = page.getByRole('dialog', { name: 'Povratna informacija' });
  await expect(dialog).toBeVisible();

  // The clicked button is chosen; the page is offered as the widest choice.
  await expect(dialog.getByRole('radio', { name: 'Gumb „Novi član”' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('radio', { name: 'Cijela stranica: Članovi' })).toBeVisible();

  // Nothing goes without a comment.
  const send = dialog.getByRole('button', { name: 'Pošalji' });
  await expect(send).toBeDisabled();
  const comment = `Gumb bi mogao biti veći ${Date.now()}`;
  await dialog.getByLabel('Komentar').fill(comment);
  await dialog.getByRole('radio', { name: 'Prijedlog' }).click();
  await send.click();

  await expect(page.getByRole('status')).toContainText('Hvala! Povratna informacija je poslana.');
  await expect(dialog).toBeHidden();

  const saved = (await storedEntries()).find((f) => text(f, 'comment') === comment);
  expect(saved).toBeDefined();
  expect(text(saved, 'kind')).toBe('idea');
  expect(text(saved, 'status')).toBe('new');
  expect(text(saved, 'page', 'path')).toBe('/clanovi');
  expect(text(saved, 'target', 'label')).toBe('Gumb „Novi član”');
  expect(text(saved, 'author', 'email')).toBe(OWNER.email);
});

test('a section can be chosen instead, and Escape closes without sending', async ({ page }) => {
  await signInToOverview(page);
  const before = (await storedEntries()).length;

  await page.getByRole('region', { name: 'Pregled' }).first().click({ button: 'right', position: { x: 4, y: 4 } });
  const dialog = page.getByRole('dialog', { name: 'Povratna informacija' });
  await dialog.getByRole('radio', { name: /^Cijela stranica/ }).click();
  await expect(dialog.getByRole('radio', { name: /^Cijela stranica/ })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByLabel('Komentar').fill('ne šalje se');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Shift + right-click leaves the browser's own menu alone.
  await page.getByRole('heading', { name: 'Pregled', level: 1 }).click({ button: 'right', modifiers: ['Shift'] });
  await expect(dialog).toBeHidden();
  expect((await storedEntries()).length).toBe(before);
});

test('a member row is named by the member, inside its list', async ({ page }) => {
  await signInToOverview(page);
  await openSection(page, 'Članovi');
  await page.getByRole('region', { name: 'Popis članova' }).getByRole('button', { name: /Nina Šimić/ }).click({ button: 'right' });
  const dialog = page.getByRole('dialog', { name: 'Povratna informacija' });
  await expect(dialog.getByRole('group', { name: 'Na što se odnosi?' }).getByRole('radio')).toHaveText(['Gumb „Nina Šimić”', 'Odjeljak „Popis članova”', 'Cijela stranica: Članovi']);
  await dialog.getByRole('button', { name: 'Zatvori' }).click();
  await expect(dialog).toBeHidden();
});

test('the rules refuse entries that are not from a signed-in owner', async () => {
  // No sign-in at all: Firestore says no (403), whatever the entry says.
  const res = await fetch(FEEDBACK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'new' }, comment: { stringValue: 'spam' } } }),
  });
  expect(res.status).toBe(403);
});
