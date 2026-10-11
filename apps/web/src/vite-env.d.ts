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
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** Set only for local development, e.g. http://127.0.0.1:9099. */
  readonly VITE_FIREBASE_AUTH_EMULATOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
