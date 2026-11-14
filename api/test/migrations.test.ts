import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';

const dir = resolve(import.meta.dirname, '../migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const statements = (file: string) =>
  readFileSync(resolve(dir, file), 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

// Each migration on a database that already holds data, in real D1 (Miniflare), as production will meet it.
describe('migrations on a database with data', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
  let db: Env['DB'];
  const run = (list: string[]) => db.batch(list.map((s) => db.prepare(s)));

  beforeAll(async () => {
    proxy = await getPlatformProxy<Env>({ configPath: resolve(import.meta.dirname, '../wrangler.toml'), persist: false });
    db = proxy.env.DB;
  });
  afterAll(() => proxy.dispose());

  it('keeps every membership pointing at its plan through the plan rebuild', async () => {
    const upTo = files.indexOf('0003_custom_plans.sql');
    for (const file of files.slice(0, upTo)) await run(statements(file));
    // Data as the schema was then (the seed follows the latest schema, so it isn't used here).
    const t0 = '2026-11-01T10:00:00.000Z';
    await run([
      `INSERT INTO business (id, name, created_at, updated_at) VALUES ('b', 'Prana', '${t0}', '${t0}')`,
      `INSERT INTO member (id, business_id, full_name, first_name, last_name, member_since, created_at, updated_at, changed_at) VALUES ('m1', 'b', 'Ana Horvat', 'Ana', 'Horvat', '2026-11-01', '${t0}', '${t0}', '${t0}')`,
      `INSERT INTO member (id, business_id, full_name, first_name, last_name, member_since, created_at, updated_at, changed_at) VALUES ('m2', 'b', 'Ivo Ivić', 'Ivo', 'Ivić', '2026-11-01', '${t0}', '${t0}', '${t0}')`,
      ...['1x', '2x', 'trial'].map((code) => `INSERT INTO plan (id, business_id, code, name, created_at, updated_at, changed_at) VALUES ('p-${code}', 'b', '${code}', '${code}', '${t0}', '${t0}', '${t0}')`),
      `INSERT INTO membership (id, business_id, member_id, plan_id, period_start, period_end, created_at, updated_at, changed_at) VALUES ('ms1', 'b', 'm1', 'p-2x', '2026-11-01', '2026-11-30', '${t0}', '${t0}', '${t0}')`,
      `INSERT INTO membership (id, business_id, member_id, plan_id, period_start, period_end, created_at, updated_at, changed_at) VALUES ('ms2', 'b', 'm2', 'p-trial', '2026-11-05', '2026-12-04', '${t0}', '${t0}', '${t0}')`,
    ]);
    const before = await db.prepare('SELECT m.id, p.code FROM membership m JOIN plan p ON p.id = m.plan_id ORDER BY m.id').all();
    expect(before.results.length).toBeGreaterThan(0);

    for (const file of files.slice(upTo)) await run(statements(file));

    const after = await db.prepare('SELECT m.id, p.code FROM membership m JOIN plan p ON p.id = m.plan_id ORDER BY m.id').all();
    expect(after.results).toEqual(before.results);
    // The new code is allowed, and foreign keys are still enforced.
    const now = new Date().toISOString();
    const business = (await db.prepare('SELECT id FROM business').first<{ id: string }>())!.id;
    await db.prepare("INSERT INTO plan (id, business_id, code, name, created_at, updated_at, changed_at) VALUES ('p-custom', ?, 'custom', 'Studentska', ?, ?, ?)").bind(business, now, now, now).run();
    await expect(
      db.prepare("INSERT INTO membership (id, business_id, member_id, plan_id, period_start, period_end, created_at, updated_at, changed_at) VALUES ('x', ?, 'no-such-member', 'p-custom', '2026-11-01', '2026-11-30', ?, ?, ?)").bind(business, now, now, now).run(),
    ).rejects.toThrow(/FOREIGN KEY/);
    const indexes = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'plan'").all();
    expect(indexes.results.map((r) => r.name)).toContain('plan_business');
  });
});
