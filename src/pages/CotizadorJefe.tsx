// Wrapper del Cotizador del Jefe (OLZZO v1.1) integrado al shell Rolzzo.
//
// Modo restringido (rol distinto de 'admin'):
// - Solo tab Cotizador
// - Sin Exportar/Importar/Reset
// - Sin Margen Bruto Estimado
// - Sin detalle expandido del precio
// - Descuento clampeado a 40% (para todos, no solo restringido)
//
// El CSS del cotizador del jefe (CotizadorJefe.css) está scopeado bajo
// .cotizador-jefe-scope para no contaminar las CSS variables del shell.
// El wrapper agrega ese className al contenedor que monta el JSX app.

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
      {/* cotizador-jefe-scope aísla las CSS variables y los selectores del
          cotizador del jefe para que no contaminen el theme global del shell.
          El contenedor además le da un fondo claro definido para que el
          cotizador (light theme) se vea como una "ventana" dentro del shell. */}
      <div className="cotizador-jefe-scope bg-[#f7f8fa] text-[#1f2937]">
        <CotizadorJefeApp restringido={restringido} />
      </div>
    </div>
  );
}
