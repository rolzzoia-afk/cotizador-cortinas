import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { SentryErrorBoundary, initSentry } from '@/lib/sentry';
import './index.css';

// Sentry debe inicializarse lo antes posible para capturar errores de arranque
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-100">
          <h1 className="text-lg font-semibold">Algo salió mal</h1>
          <p className="max-w-md text-center text-sm text-zinc-400">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
          <p className="text-xs text-zinc-500">
            El error fue reportado automáticamente. Podés recargar o reintentar.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resetError()}
              className="rounded border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Reintentar
            </button>
            <button
              onClick={() => location.reload()}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm hover:bg-indigo-500"
            >
              Recargar página
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </SentryErrorBoundary>
  </StrictMode>,
);
