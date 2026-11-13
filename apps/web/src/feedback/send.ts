import { REAL_SIGN_IN } from '../auth/session';

/** Feedback is on where sign-in is real and a place to keep it is configured. */
export const FEEDBACK_ENABLED = REAL_SIGN_IN && import.meta.env.VITE_FEEDBACK === 'firestore';

export type FeedbackKind = 'bug' | 'idea' | 'question';

export interface FeedbackEntry {
  kind: FeedbackKind;
  comment: string;
  /** label: the chosen target as read out in the form; path: from the page down to it. */
  target: { label: string; path: string[]; selector: string };
  page: { path: string; title: string };
  lang: string;
  authorName: string;
}

// Firestore (the "lite" build, a fraction of the size) is loaded the first time something is sent.
let ready: Promise<{ send: (entry: FeedbackEntry) => Promise<void> }> | null = null;

function load() {
  ready ??= (async () => {
    const [{ addDoc, collection, connectFirestoreEmulator, getFirestore, serverTimestamp }, { auth, firebaseApp }] = await Promise.all([
      import('firebase/firestore/lite'),
      import('../auth/firebaseSession'),
    ]);
    const db = getFirestore(firebaseApp);
    const emulator = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;
    if (emulator) {
      const [host = '127.0.0.1', port = '8080'] = emulator.split(':');
      connectFirestoreEmulator(db, host, Number(port));
    }
    return {
      send: async (entry: FeedbackEntry) => {
        const user = auth.currentUser;
        if (!user?.email) throw new Error('not signed in');
        await addDoc(collection(db, 'feedback'), {
          status: 'new',
          kind: entry.kind,
          comment: entry.comment,
          target: entry.target,
          page: entry.page,
          context: {
            lang: entry.lang,
            viewport: `${window.innerWidth}×${window.innerHeight}`,
            user_agent: navigator.userAgent.slice(0, 400),
            build: (import.meta.env.VITE_BUILD ?? 'local').slice(0, 80),
          },
          author: { uid: user.uid, email: user.email.toLowerCase(), name: entry.authorName.slice(0, 120) },
          created_at: serverTimestamp(),
        });
      },
    };
  })().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

export async function sendFeedback(entry: FeedbackEntry): Promise<void> {
  await (await load()).send(entry);
}
