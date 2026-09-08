// La tabla del Kardex (lámina «Kardex»).
//
// Ocho columnas y una fila por movimiento. Las filas atenuadas vienen del
// historial de tubos y paños: se ven porque son parte de la historia de un
// artículo, pero no se corrigen desde acá — las escribe el optimizador.

import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { badgeTipoMovimiento } from '@/modules/inventario/badges';
import {
  origenDestino,
  textoCantidad,
  textoSaldo,
  type FilaKardexVista,
} from '@/modules/inventario/kardexVista';

/** «08-09 11:42», que es como se lee de un vistazo en una lista larga. */
function fechaCorta(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}-${mm} ${hh}:${mi}`;
}

function Fila({
  m,
  activa,
  onClick,
}: {
  m: FilaKardexVista;
  activa: boolean;
  onClick: () => void;
}) {
  const badge = badgeTipoMovimiento(m.tipo);
  const { desde, hacia } = origenDestino(m);
  const saldo = textoSaldo(m);
  const negativo = m.saldo_post != null && m.saldo_post < 0;

  return (
    <tr
      onClick={onClick}
      className={cn(
        'cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/[0.05]',
        activa && 'bg-accent/[0.09]',
        // El historial de tubos y paños se ve, pero no se toca desde acá.
        !m.editable && 'opacity-[0.72]',
      )}
    >
      <td className="whitespace-nowrap px-2.5 py-2 font-mono text-muted-foreground">
        {fechaCorta(m.fecha)}
      </td>
      <td className="px-2.5 py-2">
        <div className="font-mono font-medium">{m.item_cod}</div>
        {m.item_nombre && (
          <div className="text-[0.6875rem] text-muted-foreground">{m.item_nombre}</div>
        )}
      </td>
      <td className="px-2.5 py-2">
        <Badge variant={badge.variante}>{badge.texto}</Badge>
      </td>
      <td className="px-2.5 py-2 text-muted-foreground">
        {desde}
        {hacia && (
          <>
            {' → '}
            <span className="text-foreground">{hacia}</span>
          </>
        )}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono">{textoCantidad(m)}</td>
      <td
        className={cn(
          'whitespace-nowrap px-2.5 py-2 text-right font-mono',
          negativo && 'text-destructive',
          saldo === '—' && 'text-muted-foreground/60',
        )}
      >
        {saldo}
      </td>
      <td className="px-2.5 py-2">
        {m.ot ? (
          <span className="font-mono text-accent">OT {m.ot}</span>
        ) : (
          <span className="text-muted-foreground">{m.referencia || '—'}</span>
        )}
      </td>
      <td className="px-2.5 py-2 text-muted-foreground">{m.quien || '—'}</td>
    </tr>
  );
}

export function TablaKardex({
  filas,
  total,
  loading,
  seleccionada,
  onSeleccionar,
  hayHistorico,
  textoRango,
}: {
  filas: FilaKardexVista[];
  total: number;
  loading: boolean;
  seleccionada: FilaKardexVista | null;
  onSeleccionar: (m: FilaKardexVista) => void;
  hayHistorico: boolean;
  textoRango: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (filas.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-card">
        <EmptyState
          titulo="No hay movimientos"
          texto="Nada calza con los filtros de arriba. Prueba con un rango de fechas más amplio o enciende el histórico."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[880px] text-[0.78rem] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-10 w-[104px] px-2.5 text-left font-medium">Fecha</th>
              <th className="h-10 w-[150px] px-2.5 text-left font-medium">Artículo</th>
              <th className="h-10 w-[88px] px-2.5 text-left font-medium">Tipo</th>
              <th className="h-10 px-2.5 text-left font-medium">Origen → destino</th>
              <th className="h-10 w-[86px] px-2.5 text-right font-medium">Cantidad</th>
              <th className="h-10 w-[72px] px-2.5 text-right font-medium">Saldo</th>
              <th className="h-10 w-[96px] px-2.5 text-left font-medium">Referencia</th>
              <th className="h-10 w-[82px] px-2.5 text-left font-medium">Quién</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <Fila
                key={`${m.fuente}-${m.id}`}
                m={m}
                activa={seleccionada?.id === m.id}
                onClick={() => onSeleccionar(m)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>
          {filas.length.toLocaleString('es-CL')} de {total.toLocaleString('es-CL')} movimientos ·{' '}
          {textoRango.toLowerCase()}
        </span>
        {hayHistorico && (
          <Badge variant="muted" className="ml-auto">
            Las filas atenuadas vienen del historial de tubos y paños: se ven, no se editan acá
          </Badge>
        )}
      </div>
    </div>
  );
}

export default TablaKardex;
