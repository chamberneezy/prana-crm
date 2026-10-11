import type { AuthSession } from './types';

export * from './types';

/** A demo build: the API runs inside the browser on sample data, with no server. */
export const DEMO = import.meta.env.VITE_DEMO === 'true';
/** Sign-in is real (Firebase) everywhere except the plain demo, where any button lets the visitor in. */
export const REAL_SIGN_IN = !DEMO || import.meta.env.VITE_AUTH === 'firebase';

const shown = import.meta.env.VITE_AUTH_PROVIDERS?.split(',').map((p) => p.trim());
/** Which sign-in methods the login screen offers. */
export const offers = (method: 'apple' | 'google' | 'password') => !shown || shown.includes(method);

// Only the one in use is loaded, so the demo ships without the Firebase SDK and the real app without the demo.
// (The two implementations import from ./types, never from this file: this module waits for them.)
export const session: AuthSession = REAL_SIGN_IN ? (await import('./firebaseSession')).firebaseSession : (await import('./demoSession')).demoSession;
