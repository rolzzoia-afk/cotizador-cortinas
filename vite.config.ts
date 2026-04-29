/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// BUILD_ID expuesto al cliente como import.meta.env.VITE_BUILD_ID para hacer
// cache-busting de los HTML legacy (optimizador, postventa, etc.) que viven
// fuera del bundle de Vite y no llevan hash en su nombre. Incidente 2026-04-29:
// un operario sincronizó con HTML cacheado de antes del baseline → DELETE
// silencioso de 81 tubos. Cambiar el src del iframe a `?v=<BUILD_ID>` fuerza
// al navegador a revalidar en cada deploy.
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8)
  || process.env.GITHUB_SHA?.slice(0, 8)
  || String(Date.now());

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
