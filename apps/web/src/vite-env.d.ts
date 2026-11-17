/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" in the public demo build. */
  readonly VITE_DEMO?: string;
  /** "firebase" makes a demo build use real sign-in (the public preview). */
  readonly VITE_AUTH?: string;
  /** Sign-in buttons to show, e.g. "google,password". Left out: all of them. */
  readonly VITE_AUTH_PROVIDERS?: string;
  /** SHA-256 of the e-mails allowed into the preview, comma-separated. */
  readonly VITE_OWNER_HASHES?: string;
  /** SHA-256 of the e-mails let into the preview as teachers (view-only; for now nothing), comma-separated. */
  readonly VITE_TEACHER_HASHES?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** Set only for local development, e.g. http://127.0.0.1:9099. */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
  /** "firestore": right-click on anything opens the feedback form, which saves to Firestore. */
  readonly VITE_FEEDBACK?: string;
  /** Set only for local development, e.g. 127.0.0.1:8080. */
  readonly VITE_FIRESTORE_EMULATOR_HOST?: string;
  /** Set on the old preview (GitHub Pages): it forwards there, after sending the owner's own entries (src/moved). */
  readonly VITE_MOVED_TO?: string;
  /** The commit the build was made from, recorded with feedback. */
  readonly VITE_BUILD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
