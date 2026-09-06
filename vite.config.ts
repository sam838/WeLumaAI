import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const hmrEnabled =
    process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // AI Studio preview proxies do not reliably support Vite WebSockets.
      // HMR and file watching are opt-in for local development.
      hmr: hmrEnabled,
      watch: hmrEnabled ? {} : null,
    },
  };
});
