import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5620,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5621',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5620,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5621',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
        reglement: 'reglement.html',
      },
    },
  },
});
