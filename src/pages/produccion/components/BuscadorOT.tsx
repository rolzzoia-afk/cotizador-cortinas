// El buscador de OT que manda en todo el módulo: se escribe una vez arriba y
// todas las pestañas trabajan sobre esa misma orden.

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SUB_ETAPA_META } from '@/modules/cotizador/fase4';
import type { OT } from '@/modules/ots/types';

export default function BuscadorOT({
  ot,
  onBuscar,
  otCargada,
  loading,
}: {
  /** La OT vigente (ya confirmada). */
  ot: string;
  onBuscar: (numero: string) => void;
  otCargada: OT | null;
  loading: boolean;
}) {
  const [texto, setTexto] = useState(ot);

  // Si la OT cambia desde afuera (por ejemplo al limpiar), el campo la sigue.
  useEffect(() => {
    setTexto(ot);
  }, [ot]);

  const meta = otCargada?.subEtapa ? SUB_ETAPA_META[otCargada.subEtapa] : null;

  return (
    <div className="mb-4 rounded-lg border bg-card p-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onBuscar(texto.trim());
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Orden de trabajo
        </label>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="3197"
          className="w-40"
          inputMode="numeric"
        />
        <Button type="submit" size="sm" disabled={!texto.trim()}>
          <Search className="mr-1.5 h-4 w-4" />
          Buscar
        </Button>

        {ot && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {loading ? (
              <span className="text-muted-foreground">Cargando…</span>
            ) : otCargada ? (
              <>
                <span className="font-semibold text-foreground">
                  {otCargada.datosGenerales?.cliente || 'Sin cliente'}
                </span>
                {otCargada.datosGenerales?.direccion && (
                  <span className="text-muted-foreground">
                    · {otCargada.datosGenerales.direccion}
                  </span>
                )}
                {meta && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                  >
                    {meta.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-amber-400">
                La OT {ot} no está en el sistema. Igual puedes trabajar el plan de corte.
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
