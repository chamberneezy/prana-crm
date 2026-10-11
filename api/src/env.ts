import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { Context } from 'hono';
import type { BusinessRow, StaffRow } from './db/schema';

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  /** "production" on the deployed Worker. */
  ENVIRONMENT?: string;
  /** "true" accepts unsigned Firebase Auth emulator tokens. Ignored in production. */
  FIREBASE_AUTH_EMULATOR?: string;
}

export type Db = DrizzleD1Database;

export interface AppEnv {
  Bindings: Env;
  Variables: {
    db: Db;
    staff: StaffRow;
    business: BusinessRow;
  };
}

export type AppContext = Context<AppEnv>;
