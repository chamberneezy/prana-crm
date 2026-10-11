/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" in the public demo build. */
  readonly VITE_DEMO?: string;
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
