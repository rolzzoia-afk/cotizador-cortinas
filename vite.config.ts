import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Subimos el threshold de warning porque ya splitteamos; lo que pase de
    // 800 kB sí conviene investigar.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split de vendors pesados para que se cacheen independientes de la app
        // y no se re-descarguen en cada deploy si no cambiaron.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
          ],
          'charts': ['recharts'],
          'pdf': ['jspdf'],
          'excel': ['xlsx'],
          'qr': ['qrcode.react', 'html5-qrcode'],
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'query': ['@tanstack/react-query', '@tanstack/react-table'],
          'sentry': ['@sentry/react'],
        },
      },
    },
  },
});
