import type { Database } from 'sql.js';
import m0001 from '../../migrations/0001_init.sql?raw';
import m0002 from '../../migrations/0002_member_names.sql?raw';
import m0003 from '../../migrations/0003_custom_plans.sql?raw';

/** Every migration, in order. A test checks this lists each file in migrations/. */
export const MIGRATIONS: Array<{ name: string; sql: string }> = [
  { name: '0001_init.sql', sql: m0001 },
  { name: '0002_member_names.sql', sql: m0002 },
  { name: '0003_custom_plans.sql', sql: m0003 },
];

/**
 * Brings a demo database up to date, as `wrangler d1 migrations apply` does for D1, with the same
 * bookkeeping table. A database saved before there was bookkeeping already has 0001: it is recorded as applied,
 * so the visitor's data is kept and only the newer migrations run.
 */
export function migrate(db: Database): string[] {
  const hadTables = db.exec("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'member'").length > 0;
  db.run('CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
  const applied = new Set((db.exec('SELECT name FROM d1_migrations')[0]?.values ?? []).map((r) => String(r[0])));
  if (hadTables && applied.size === 0) {
    db.run('INSERT INTO d1_migrations (name) VALUES (?)', ['0001_init.sql']);
    applied.add('0001_init.sql');
  }

  const ran: string[] = [];
  for (const { name, sql } of MIGRATIONS) {
    if (applied.has(name)) continue;
    // As in SQLite's own recipe for changing a table: foreign keys off while a table is rebuilt.
    db.run('PRAGMA foreign_keys = OFF');
    db.run('BEGIN');
    try {
      db.exec(sql);
      db.run('INSERT INTO d1_migrations (name) VALUES (?)', [name]);
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    } finally {
      db.run('PRAGMA foreign_keys = ON');
    }
    ran.push(name);
  }
  return ran;
}
