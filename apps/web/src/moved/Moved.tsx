import { useEffect, useState } from 'react';

/**
 * The old preview's address (GitHub Pages) now forwards to the live studio. The preview kept its data in each
 * browser only, so before forwarding this page looks there for anything the owner entered or changed themselves
 * (the sample data has fixed ids and was never edited) and, if it finds some, sends a copy to Firestore
 * (`previewExports`), where it is checked and moved into the live studio by hand.
 */

const SAMPLE_ID = '01900000-0000-7000-8000-';

type State =
  | { step: 'checking' }
  | { step: 'signIn'; count: number }
  | { step: 'sending'; count: number }
  | { step: 'sent'; count: number }
  | { step: 'failed'; count: number; message: string }
  | { step: 'leaving' };

interface Found {
  rows: Record<string, Record<string, unknown>[]>;
  count: number;
}

async function storedDatabase(): Promise<Uint8Array | null> {
  if (!('indexedDB' in window)) return null;
  const known = (await indexedDB.databases?.()) ?? [];
  if (known.length && !known.some((d) => d.name === 'prana-demo')) return null;
  return new Promise((resolve) => {
    const open = indexedDB.open('prana-demo', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('bytes');
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      const read = db.transaction('bytes').objectStore('bytes').get('sqlite');
      read.onsuccess = () => {
        db.close();
        const value = read.result as Uint8Array | ArrayBuffer | undefined;
        resolve(value ? new Uint8Array(value) : null);
      };
      read.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

/** Rows the owner added, changed or deleted: everything that isn't untouched sample data. */
async function ownChanges(bytes: Uint8Array): Promise<Found> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm-browser.wasm?url')]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database(bytes);
  try {
    const tables = (db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'")[0]?.values ?? []).map(
      (v) => String(v[0]),
    );
    const rows: Found['rows'] = {};
    let count = 0;
    for (const table of tables) {
      const columns = (db.exec(`PRAGMA table_info("${table}")`)[0]?.values ?? []).map((v) => String(v[1]));
      if (!columns.includes('id') || !columns.includes('updated_at')) continue;
      const deleted = columns.includes('deleted_at') ? ' OR deleted_at IS NOT NULL' : '';
      const result = db.exec(`SELECT * FROM "${table}" WHERE id NOT LIKE '${SAMPLE_ID}%' OR updated_at <> created_at${deleted}`)[0];
      if (!result) continue;
      rows[table] = result.values.map((values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i] instanceof Uint8Array ? null : values[i]])));
      count += result.values.length;
    }
    // Signing in to the preview put the person on its staff list; that alone isn't data worth moving.
    const staff = rows.staff ?? [];
    const meaningful = count - staff.filter((s) => s.email).length;
    return { rows, count: meaningful > 0 ? count : 0 };
  } finally {
    db.close();
  }
}

async function send(found: Found): Promise<void> {
  const [{ addDoc, collection, getFirestore, serverTimestamp }, { auth, firebaseApp }] = await Promise.all([import('firebase/firestore/lite'), import('../auth/firebaseSession')]);
  const user = auth.currentUser;
  if (!user?.email) throw new Error('not signed in');
  await addDoc(collection(getFirestore(firebaseApp), 'previewExports'), {
    author: { uid: user.uid, email: user.email.toLowerCase() },
    count: found.count,
    rows: JSON.stringify(found.rows),
    created_at: serverTimestamp(),
  });
}

async function signedIn(): Promise<boolean> {
  const { auth } = await import('../auth/firebaseSession');
  await auth.authStateReady();
  return Boolean(auth.currentUser);
}

export function Moved({ to }: { to: string }) {
  const [state, setState] = useState<State>({ step: 'checking' });
  const [found, setFound] = useState<Found | null>(null);
  const target = to.replace(/\/$/, '') + '/' + location.pathname.slice(import.meta.env.BASE_URL.length).replace(/^\//, '');

  const leave = () => {
    setState({ step: 'leaving' });
    location.replace(target);
  };

  const transfer = async (data: Found) => {
    setState({ step: 'sending', count: data.count });
    try {
      await send(data);
      setState({ step: 'sent', count: data.count });
      setTimeout(leave, 4000);
    } catch (error) {
      setState({ step: 'failed', count: data.count, message: error instanceof Error ? error.message : String(error) });
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const bytes = await storedDatabase();
        const data = bytes ? await ownChanges(bytes) : null;
        if (!data || data.count === 0) return leave();
        setFound(data);
        if (await signedIn()) await transfer(data);
        else setState({ step: 'signIn', count: data.count });
      } catch {
        leave();
      }
    })();
    // Runs once, on opening the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInAndSend = async () => {
    if (!found) return;
    try {
      const { firebaseSession } = await import('../auth/firebaseSession');
      await firebaseSession.signInWithProvider('google');
      await transfer(found);
    } catch {
      setState({ step: 'signIn', count: found.count });
    }
  };

  const records = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'zapis' : 'zapisa'}`;

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--surface-page, #F4EFEA)', color: 'var(--text-1, #2A322E)' }}>
      <div style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'Cinzel, serif', fontSize: 26 }}>Prana je preseljena</h1>
        {state.step === 'checking' || state.step === 'leaving' ? (
          <p style={{ margin: 0 }}>Otvaramo pravi studio…</p>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Ova probna verzija čuvala je podatke samo u ovom pregledniku. Ovdje smo pronašli {records(state.count)} koje ste sami unijeli. Šaljemo ih u pravi studio, gdje ih
              vide svi i aplikacija.
            </p>
            {state.step === 'signIn' && (
              <button type="button" onClick={() => void signInAndSend()} style={button}>
                Prijava s Googleom i slanje podataka
              </button>
            )}
            {state.step === 'sending' && <p style={{ margin: 0 }}>Šaljemo…</p>}
            {state.step === 'sent' && <p style={{ margin: 0, fontWeight: 600 }}>Preneseno. Hvala! Otvaramo pravi studio…</p>}
            {state.step === 'failed' && (
              <>
                <p style={{ margin: 0, color: '#8C3F28' }}>Slanje nije uspjelo ({state.message}). Pokušajte ponovno ili javite Mariju.</p>
                <button type="button" onClick={() => found && void transfer(found)} style={button}>
                  Pokušaj ponovno
                </button>
              </>
            )}
            <a href={target} style={{ color: 'inherit' }}>
              Otvori pravi studio
            </a>
          </>
        )}
      </div>
    </main>
  );
}

const button = { height: 48, border: 0, borderRadius: 999, background: '#2A322E', color: '#fff', font: 'inherit', fontWeight: 600, cursor: 'pointer' } as const;
