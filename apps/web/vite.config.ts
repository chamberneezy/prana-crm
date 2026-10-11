import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // GitHub Pages serves the demo from /<repository>/, so the build can be told its base path.
    base: env.VITE_BASE || '/',
    plugins: [react()],
    resolve: {
      // The demo build runs the API in the browser; see src/demo-backend.
      alias: { 'prana-api-demo': decodeURIComponent(new URL('../../api/src/demo/index.ts', import.meta.url).pathname) },
    },
    server: {
      // The Worker is the only thing that talks to the database; in development it runs beside Vite.
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:8787' },
    },
  };
});
