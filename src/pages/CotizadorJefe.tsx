// Wrapper del Cotizador del Jefe (OLZZO v1.1).
// Modo restringido para rol distinto de 'admin': solo tab Cotizador,
// sin export/import/reset, sin margen bruto, descuento clampeado a 40%.

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth';
// @ts-expect-error — JSX file sin tipos
import CotizadorJefeApp from './cotizador-jefe/CotizadorJefeApp.jsx';

export function CotizadorJefe() {
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const rol = (perfil?.rol || '').toLowerCase().trim();
  const restringido = rol !== 'admin';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">
          Cotizador del Jefe · OLZZO v1.1
          {restringido && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">(modo vendedor)</span>
          )}
        </h1>
      </div>
      <div>
        <CotizadorJefeApp restringido={restringido} />
      </div>
    </div>
  );
}
