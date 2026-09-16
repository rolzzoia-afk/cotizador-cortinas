// Debajo del botón «Guardar» de Costo total: si el costo de esta OT ya quedó
// en la base, cuándo y quién, y si lo que se ve hoy cambió desde entonces.

import { AlertTriangle, Database } from 'lucide-react';
import { formatCLP } from '@/lib/formatters';
import { useNombresPerfiles } from '@/modules/leads/planillaStore';
import type { FotoGuardada } from '@/modules/produccion/costoOTFoto';

const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function EstadoFotoCosto({
  foto,
  desactualizada,
  cargando,
}: {
  foto: FotoGuardada | null;
  desactualizada: boolean;
  cargando: boolean;
}) {
  const nombres = useNombresPerfiles();
  if (cargando) return null;

  if (!foto) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        El costo de esta OT todavía no está guardado en la base.
      </p>
    );
  }

  const quien = foto.guardado_por ? nombres.get(foto.guardado_por) : '';
  return (
    <div className="space-y-0.5 text-[11px]">
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        Guardado en la base el {cuando(foto.guardado_at)}
        {quien ? ` por ${quien}` : ''}
        {foto.version > 1 ? ` · versión ${foto.version}` : ''}
      </p>
      {desactualizada && (
        <p className="flex items-center gap-1.5 text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Cambió desde que se guardó (costo guardado: {formatCLP(Number(foto.costo_con_fallas))}). Guarda
          de nuevo para dejarlo al día.
        </p>
      )}
    </div>
  );
}
