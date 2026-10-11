import type { AuthSession } from './types';

export * from './types';

/** The public demo build: no accounts, and the API runs inside the browser on sample data. */
export const DEMO = import.meta.env.VITE_DEMO === 'true';

// Only the one in use is loaded, so the demo ships without the Firebase SDK and the real app without the demo.
// (The two implementations import from ./types, never from this file: this module waits for them.)
export const session: AuthSession = DEMO ? (await import('./demoSession')).demoSession : (await import('./firebaseSession')).firebaseSession;
