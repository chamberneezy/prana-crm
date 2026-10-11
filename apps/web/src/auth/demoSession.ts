import { DEMO_OWNER, DEMO_PROJECT } from 'prana-api-demo';
import type { AuthSession } from './types';

// The demo has no accounts: "signing in" only remembers, in this browser, that the visitor came in.
const KEY = 'prana.demo.signedIn';
const listeners = new Set<(signedIn: boolean) => void>();

function signedIn(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function set(value: boolean) {
  try {
    if (value) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // without storage the visitor simply signs in again next time
  }
  for (const listener of listeners) listener(value);
}

const encode = (part: object) => btoa(JSON.stringify(part)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** An unsigned token for the demo owner, in the same form the local Auth emulator issues. */
function demoToken(): string {
  const claims = { sub: DEMO_OWNER.uid, email: DEMO_OWNER.email, email_verified: true, aud: DEMO_PROJECT, iss: `https://securetoken.google.com/${DEMO_PROJECT}`, exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.`;
}

export const demoSession: AuthSession = {
  onChange(callback) {
    listeners.add(callback);
    // Like Firebase, report the current state on a later tick, never during the subscribe call.
    queueMicrotask(() => callback(signedIn()));
    return () => listeners.delete(callback);
  },
  getToken: async () => (signedIn() ? demoToken() : null),
  signInWithEmail: async () => set(true),
  signInWithProvider: async () => set(true),
  sendPasswordReset: async () => {},
  email: () => (signedIn() ? DEMO_OWNER.email : null),
  signOut: async () => set(false),
};
