// Inicialización de Sentry (error tracking).
// Si VITE_SENTRY_DSN no está seteada, la inicialización es un no-op
// → puedes desarrollar en local sin necesidad de tener un DSN.

import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.info('[Sentry] VITE_SENTRY_DSN no seteada — error tracking desactivado');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION || 'dev',
    // Muestreo: 100% en dev, 20% traces en prod (balance coste/observabilidad)
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    // Replay: graba la sesión cuando hay error. 10% de sesiones normales, 100% de sesiones con error.
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event, hint) {
      // Descartar errores de red comunes que no son bugs reales
      const err = hint.originalException;
      if (err instanceof Error) {
        const msg = err.message || '';
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
          return null;
        }
        // AbortError: usuario canceló (navegación rápida), no es bug
        if (err.name === 'AbortError') return null;
      }
      return event;
    },
  });
}

// Setea el usuario actual en Sentry. Se llama desde AuthProvider cuando cambia la sesión.
export function setSentryUser(
  user: { id: string; email?: string | null; nombre?: string | null; empresaId?: string | null } | null,
) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
    username: user.nombre ?? undefined,
  });
  if (user.empresaId) {
    Sentry.setTag('empresa_id', user.empresaId);
  }
}

// ErrorBoundary listo para usar en App.tsx.
export const SentryErrorBoundary = Sentry.ErrorBoundary;
