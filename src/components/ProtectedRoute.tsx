import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { puedeAccederRuta } from '@/lib/roles';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, empresaId, onboardingCompletado, perfil } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!session) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (!empresaId) {
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center">
        Tu cuenta no tiene una empresa asignada. Contacta al administrador.
      </div>
    );
  }

  if (!onboardingCompletado && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // Control de acceso por rol: bloqueo real (no solo ocultar el menú).
  if (!puedeAccederRuta(perfil?.rol, location.pathname)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-warning" />
        <p className="text-lg font-semibold">No tienes acceso a esta sección</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu rol actual ({perfil?.rol || 'sin rol'}) no permite entrar aquí. Si crees que es un
          error, pide al administrador que ajuste tu rol en Admin → Usuarios y roles.
        </p>
        <Link to="/" className="mt-2 text-sm font-medium text-primary hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
