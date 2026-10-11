import { type DemoStorage, startDemoBackend } from 'prana-api-demo';
import { REAL_SIGN_IN, session } from '../auth/session';

// The demo's database and uploaded files live in this browser's IndexedDB, and nowhere else.
const DB_NAME = 'prana-demo';
const STORE = 'bytes';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

const storage: DemoStorage = {
  get: async (key) => ((await withStore('readonly', (s) => s.get(key))) as Uint8Array | undefined) ?? null,
  put: async (key, bytes) => void (await withStore('readwrite', (s) => s.put(bytes, key))),
  delete: async (key) => void (await withStore('readwrite', (s) => s.delete(key))),
};

const allowedHashes = (import.meta.env.VITE_OWNER_HASHES ?? '').split(',').map((h) => h.trim()).filter(Boolean);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * With real sign-in (the public preview), only the listed people are put on the staff list;
 * everyone else is answered "no access", as the deployed API would. This runs in the browser,
 * so it keeps the preview tidy rather than secret: the data here is sample data.
 */
async function ownerFor(email: string | null): Promise<{ ownerEmail: string; ownerName: string } | undefined> {
  if (!REAL_SIGN_IN || !email) return undefined;
  if (!allowedHashes.includes(await sha256(email))) return undefined;
  // The name shown in the app: the one on their account, or else the first part of the address ("matija.z…" → "Matija").
  const fromAddress = (email.split('@')[0] ?? '').split(/[._-]/)[0] ?? '';
  return { ownerEmail: email, ownerName: session.displayName() ?? fromAddress.charAt(0).toUpperCase() + fromAddress.slice(1) };
}

let started: { email: string | null; backend: ReturnType<typeof startDemoBackend> } | undefined;

/** Answers an API request from the in-browser backend, starting it on first use and when someone else signs in. */
export async function demoFetch(path: string, init: RequestInit): Promise<Response> {
  const email = session.email();
  if (!started || started.email !== email) {
    started = {
      email,
      backend: ownerFor(email).then((owner) => startDemoBackend(storage, { projectId: REAL_SIGN_IN ? import.meta.env.VITE_FIREBASE_PROJECT_ID : undefined, ...owner })),
    };
  }
  // The host is never contacted; the app only looks at the path.
  return (await started.backend).fetch(new Request(`https://demo.invalid/api${path}`, init));
}

/** Throws away everything the visitor changed and starts again from the sample data. */
export async function resetDemo(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  location.reload();
}
