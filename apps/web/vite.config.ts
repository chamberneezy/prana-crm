import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    server: {
      // The Worker is the only thing that talks to the database; in development it runs beside Vite.
      proxy: { '/api': env.API_PROXY_TARGET || 'http://localhost:8787' },
    },
  };
});
