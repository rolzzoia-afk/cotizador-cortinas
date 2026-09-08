// El panel derecho del Kardex: todo lo que se sabe de un movimiento.
//
// Lo que aporta sobre la tabla son las dos cifras de arriba —en cuánto estaba
// el artículo antes y en cuánto quedó— y el aviso de que salió acompañado: un
// despacho de nueve materiales es UNA operación, y desde acá se ven las nueve.

import { ArrowRight, MoveLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { badgeTipoMovimiento } from '@/modules/inventario/badges';
import {
  origenDestino,
  textoCantidad,
  textoSaldo,
  type FilaKardexVista,
} from '@/modules/inventario/kardexVista';

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-[0.78rem] last:border-0">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function DetalleMovimiento({
  m,
  companeros,
  queryRol,
  onVerLote,
  onCorregir,
}: {
  m: FilaKardexVista | null;
  companeros: number;
  queryRol: string;
  onVerLote: () => void;
  onCorregir: () => void;
}) {
  if (!m) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card p-4">
        <EmptyState
          titulo="Detalle"
          texto="Elige un movimiento de la lista para ver de dónde salió, en cuánto quedó el artículo y quién lo registró."
        />
      </div>
    );
  }

  const badge = badgeTipoMovimiento(m.tipo);
  const { desde, hacia } = origenDestino(m);
  const fecha = new Date(m.fecha);
  // El saldo de antes se deduce del de después: la base guarda el resultado, y
  // la dirección del movimiento dice de qué lado estaba.
  const suma = m.tipo === 'INGRESO' || m.tipo === 'DEVOLUCION' || !!m.destino;
  const antes =
    m.saldo_post == null || m.cantidad == null
      ? null
      : suma
        ? m.saldo_post - m.cantidad
        : m.saldo_post + m.cantidad;

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-[0.9375rem] font-medium">Detalle</h2>
        <Badge variant={badge.variante} className="ml-auto">
          {badge.texto}
        </Badge>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {fecha.toLocaleDateString('es-CL')} ·{' '}
        {fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
      </div>

      <div className="mt-3.5 rounded-lg border border-border bg-background/70 p-3">
        <div className="font-mono text-[0.9375rem] font-medium">{m.item_cod}</div>
        {m.item_nombre && (
          <div className="text-[0.78rem] text-muted-foreground">{m.item_nombre}</div>
        )}
        <div className="mt-2.5 flex items-center gap-2 text-[0.8125rem]">
          <span className="font-medium">{desde}</span>
          {hacia && (
            <>
              <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
              <span className="font-medium">{hacia}</span>
            </>
          )}
          <span className="ml-auto shrink-0 font-mono font-semibold">{textoCantidad(m)}</span>
        </div>
      </div>

      <div className="mt-3">
        {antes != null && (
          <Dato rotulo="Saldo antes">
            <span className="font-mono">{textoSaldo({ saldo_post: antes, unidad: m.unidad })}</span>
          </Dato>
        )}
        {m.saldo_post != null && (
          <Dato rotulo="Saldo después">
            <span className="font-mono font-semibold">{textoSaldo(m)}</span>
          </Dato>
        )}
        <Dato rotulo="Motivo">{m.referencia}</Dato>
        {m.ot && (
          <Dato rotulo="OT">
            <span className="font-mono text-accent">{m.ot}</span>
          </Dato>
        )}
        <Dato rotulo="Quién">{m.quien}</Dato>
        <Dato rotulo="Notas">{m.notas}</Dato>
        {!m.editable && <Dato rotulo="Viene de">{m.fuente}</Dato>}
      </div>

      {companeros > 0 && (
        <div className="mt-3.5 rounded-lg border border-accent/30 bg-accent/[0.1] px-3 py-2.5 text-xs leading-relaxed">
          Este movimiento salió junto con otros <b className="font-semibold">{companeros}</b> en el
          mismo despacho.
          <button
            type="button"
            onClick={onVerLote}
            className="mt-1 block text-accent hover:underline"
          >
            Ver el despacho completo →
          </button>
        </div>
      )}

      {!m.editable && (
        <div className="mt-3.5 flex gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <MoveLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Esta fila viene del historial de tubos y paños. Se muestra para poder seguir la historia
            del artículo, pero se corrige donde se registró.
          </span>
        </div>
      )}

      <div className="mt-auto flex gap-2 pt-3.5">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link
            to={`/inventario/${m.dominio === 'tela' ? 'telas' : 'insumos'}/${encodeURIComponent(
              m.item_cod,
            )}${queryRol}`}
          >
            Ver artículo
          </Link>
        </Button>
        <Button size="sm" className="flex-1" onClick={onCorregir} disabled={!m.editable}>
          Corregir
        </Button>
      </div>
    </div>
  );
}

export default DetalleMovimiento;
