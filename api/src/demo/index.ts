import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';
import migration from '../../migrations/0001_init.sql?raw';
import { createApp } from '../app';
import type { Env } from '../env';
import { DEV_OWNER_EMAIL, devSeed, toSql } from '../seed';
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

export async function startDemoBackend(storage: DemoStorage) {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const saved = await storage.get(DATABASE_KEY);
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  if (!saved) {
    db.exec(migration);
    // Sample dates are relative to the day the demo is first opened.
    for (const statement of toSql(devSeed({ now: new Date().toISOString() }), 'keep')) db.run(statement);
  }

  // Every change is written to the browser's storage before its response goes back,
  // so nothing is lost if the tab is closed or reloaded straight afterwards.
  let dirty = !saved;
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
    FIREBASE_PROJECT_ID: DEMO_PROJECT,
    ENVIRONMENT: 'demo',
    // Demo tokens are unsigned, like the local emulator's. The Worker ignores this flag in production.
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
