import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { SentryErrorBoundary, initSentry } from '@/lib/sentry';
import { ThemeProvider } from '@/components/theme-provider';
import './index.css';

// Sentry debe inicializarse lo antes posible para capturar errores de arranque
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SentryErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-foreground">
          <h1 className="text-lg font-semibold">Algo salió mal</h1>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
          <p className="text-xs text-muted-foreground">
            El error fue reportado automáticamente. Puedes recargar o reintentar.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => resetError()}
              className="rounded border border-border bg-card px-3 py-1.5 text-sm hover:bg-card"
            >
              Reintentar
            </button>
            <button
              onClick={() => location.reload()}
              className="rounded bg-accent px-3 py-1.5 text-sm hover:bg-accent"
            >
              Recargar página
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <ThemeProvider defaultTheme="system" storageKey="rolzzo-theme">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </SentryErrorBoundary>
  </StrictMode>,
);
