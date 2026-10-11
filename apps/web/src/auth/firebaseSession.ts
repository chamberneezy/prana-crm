import { FirebaseError, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { type AuthSession, SignInFailure } from './types';

// Only the Auth module of the Firebase SDK is used. All data goes through the API.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || undefined,
});

const auth = getAuth(app);

const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
if (emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });

const WRONG_CREDENTIALS = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/missing-password'];
const CANCELLED = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled'];

async function attempt(signIn: () => Promise<unknown>): Promise<void> {
  try {
    await signIn();
  } catch (error) {
    const code = error instanceof FirebaseError ? error.code : '';
    throw new SignInFailure(WRONG_CREDENTIALS.includes(code) ? 'wrong' : CANCELLED.includes(code) ? 'cancelled' : 'failed');
  }
}

export const firebaseSession: AuthSession = {
  onChange: (callback) => onAuthStateChanged(auth, (user) => callback(Boolean(user))),
  getToken: async (forceRefresh) => (await auth.currentUser?.getIdToken(forceRefresh)) ?? null,
  signInWithEmail: (email, password) => attempt(() => signInWithEmailAndPassword(auth, email, password)),
  signInWithProvider: (provider) => attempt(() => signInWithPopup(auth, provider === 'apple' ? new OAuthProvider('apple.com') : new GoogleAuthProvider())),
  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Say nothing either way: whether an address has an account is not for the login screen to reveal.
    }
  },
  email: () => auth.currentUser?.email?.toLowerCase() ?? null,
  signOut: () => signOut(auth),
};
