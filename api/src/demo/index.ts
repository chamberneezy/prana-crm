import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import migration from '../../migrations/0001_init.sql?raw';
import { createApp } from '../app';
import type { Env } from '../env';
import { DEV_OWNER_EMAIL, devSeed, SEED, toSql } from '../seed';
import { createD1 } from './d1';
import { createR2 } from './r2';

/**
 * The public demo: the same Worker app, running inside the browser.
 * The database is SQLite in WebAssembly, seeded with the sample data, and kept (with any
 * uploaded files) in the visitor's own browser. Nothing is sent anywhere, and there is no
 * real sign-in: the demo owner is accepted the way the local Auth emulator's accounts are.
 */

/** Where the demo keeps its bytes. The web app backs this with IndexedDB. */
export interface DemoStorage {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
}

export const DEMO_PROJECT = 'prana-crm';
export const DEMO_OWNER = { uid: 'demo-owner', email: DEV_OWNER_EMAIL };

const DATABASE_KEY = 'sqlite';

export interface DemoOptions {
  /** The Firebase project the sign-in tokens come from. Left out: the demo's own unsigned tokens. */
  projectId?: string;
  /** The e-mail to put on the studio's one staff row, i.e. who is let in. Left out: the demo owner. */
  ownerEmail?: string;
}

export async function startDemoBackend(storage: DemoStorage, options: DemoOptions = {}) {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const saved = await storage.get(DATABASE_KEY);
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  if (!saved) {
    db.exec(migration);
    // Sample dates are relative to the day the demo is first opened.
    for (const statement of toSql(devSeed({ now: new Date().toISOString() }), 'keep')) db.run(statement);
  }

  // The staff allowlist has one row. Put the allowed person's e-mail on it; anyone else gets "no access".
  db.run('UPDATE staff SET email = ?, firebase_uid = NULL WHERE id = ?', [(options.ownerEmail ?? DEV_OWNER_EMAIL).toLowerCase(), SEED.owner]);

  // Every change is written to the browser's storage before its response goes back,
  // so nothing is lost if the tab is closed or reloaded straight afterwards.
  let dirty = true;
  const save = async () => {
    if (!dirty) return;
    dirty = false;
    const bytes = db.export();
    // Exporting reopens the database, which switches foreign keys back off.
    db.run('PRAGMA foreign_keys = ON');
    await storage.put(DATABASE_KEY, bytes);
  };
  await save();

  const env: Env = {
    DB: createD1(db, () => {
      dirty = true;
    }),
    BUCKET: createR2(storage),
    FIREBASE_PROJECT_ID: options.projectId ?? DEMO_PROJECT,
    ENVIRONMENT: 'demo',
    // Tokens are read without checking their signature, as with the local emulator: this copy of the API
    // runs in the visitor's own browser on their own data, so there is nothing for a signature to protect.
    // The deployed Worker ignores this flag in production and always verifies.
    FIREBASE_AUTH_EMULATOR: 'true',
  };
  const app = createApp();

  return {
    async fetch(request: Request): Promise<Response> {
      const response = await app.fetch(request, env);
      await save();
      return response;
    },
  };
}
