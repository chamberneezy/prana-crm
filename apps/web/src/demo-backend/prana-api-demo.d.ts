// The demo backend lives in api/src/demo and is bundled through a Vite alias (see vite.config.ts).
// It is typed here by hand because the API's own sources need the Workers types, which clash with the browser's.
declare module 'prana-api-demo' {
  export interface DemoStorage {
    get(key: string): Promise<Uint8Array | null>;
    put(key: string, bytes: Uint8Array): Promise<void>;
    delete(key: string): Promise<void>;
  }
  export const DEMO_PROJECT: string;
  export const DEMO_OWNER: { uid: string; email: string };
  export function startDemoBackend(storage: DemoStorage): Promise<{ fetch(request: Request): Promise<Response> }>;
}
