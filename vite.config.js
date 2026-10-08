import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), ...(process.env.DEV_HTTPS === '1' ? [basicSsl()] : [])],
  server: {
    host: '::',
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': process.env.API_TARGET || 'http://127.0.0.1:3000',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
