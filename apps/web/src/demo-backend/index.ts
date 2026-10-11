import { type DemoStorage, startDemoBackend } from 'prana-api-demo';

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

let backend: ReturnType<typeof startDemoBackend> | undefined;

/** Answers an API request from the in-browser backend, starting it on first use. */
export async function demoFetch(path: string, init: RequestInit): Promise<Response> {
  backend ??= startDemoBackend(storage);
  // The host is never contacted; the app only looks at the path.
  return (await backend).fetch(new Request(`https://demo.invalid/api${path}`, init));
}

/** Throws away everything the visitor changed and starts again from the sample data. */
export async function resetDemo(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  location.reload();
}
