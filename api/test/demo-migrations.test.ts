import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import initSqlJs from 'sql.js';
import { describe, expect, it, vi } from 'vitest';

const dir = resolve(import.meta.dirname, '../migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

// The demo imports its migrations through Vite (`?raw`); here they are read from disk.
vi.mock('../migrations/0001_init.sql?raw', () => ({ default: readFileSync(resolve(dir, '0001_init.sql'), 'utf8') }));
vi.mock('../migrations/0002_member_names.sql?raw', () => ({ default: readFileSync(resolve(dir, '0002_member_names.sql'), 'utf8') }));

const { MIGRATIONS, migrate } = await import('../src/demo/migrations');

describe('demo migrations', () => {
  it('lists every migration file, in order', () => {
    expect(MIGRATIONS.map((m) => m.name)).toEqual(files);
  });

  it('upgrades a database saved before bookkeeping, keeping its data', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.exec(readFileSync(resolve(dir, '0001_init.sql'), 'utf8'));
    const now = '2026-11-01T10:00:00.000Z';
    db.run("INSERT INTO business (id, name, created_at, updated_at) VALUES ('b', 'Prana', ?, ?)", [now, now]);
    db.run("INSERT INTO member (id, business_id, full_name, member_since, created_at, updated_at, changed_at) VALUES ('m', 'b', 'Ana Marija Horvat', '2026-11-01', ?, ?, ?)", [now, now, now]);

    expect(migrate(db)).toEqual(files.slice(1));
    expect(db.exec("SELECT first_name, last_name, full_name FROM member WHERE id = 'm'")[0]?.values).toEqual([['Ana', 'Marija Horvat', 'Ana Marija Horvat']]);
    // Running again does nothing.
    expect(migrate(db)).toEqual([]);
  });

  it('builds a new database from nothing', async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    expect(migrate(db)).toEqual(files);
  });
});
