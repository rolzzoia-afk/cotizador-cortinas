// Log de correcciones registradas (no planes, sino marcas tipo
// "medida_erronea / tubo_equivocado / etc." aplicadas sobre líneas
// específicas de planes). Solo lectura, con un botón Refrescar.

import { Clock, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  TIPO_ERROR_LABELS,
  type TipoError,
  type useCorreccionesHistorial,
} from '@/modules/admin/correcciones';

interface HistorialCorreccionesProps {
  ctx: ReturnType<typeof useCorreccionesHistorial>;
}

export default function HistorialCorrecciones({ ctx }: HistorialCorreccionesProps) {
  const { registros, loading, cargar } = ctx;

  return (
    <div className="rounded-lg border border-purple-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <strong className="text-sm">Historial de correcciones</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-8 gap-1 border-purple-500/30 text-accent"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refrescar
        </Button>
      </div>
      <div className="max-h-[200px] overflow-y-auto text-xs">
        {!loading && registros.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">Sin correcciones registradas.</div>
        )}
        {registros.map((r) => {
          const ts = (r.timestamp || '').slice(0, 16).replace('T', ' ');
          const tipoLabel =
            (r.tipo && TIPO_ERROR_LABELS[r.tipo as TipoError]) || r.tipo || '—';
          return (
            <div
              key={r.id}
              className="border-b border-border py-1.5 last:border-b-0"
            >
              <span className="text-warning">{tipoLabel}</span>
              <span className="text-muted-foreground"> · Línea {(r.linea_idx ?? -1) + 1}</span>
              <span className="text-muted-foreground"> · {ts}</span>
              {r.nota && (
                <div className="italic text-muted-foreground">{r.nota}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
