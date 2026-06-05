// Tab "Movimientos": filtros + lista de los últimos 200 movimientos.

import {
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardPlus,
  Pencil,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type Movimiento, esEntrada, formatFecha } from '@/modules/inventario/helpers';
import type { MovTipo } from '../Inventario.types';

interface MovimientosTabProps {
  movimientosFiltrados: Movimiento[];
  busquedaMov: string;
  setBusquedaMov: (v: string) => void;
  filtroTipoMov: string;
  setFiltroTipoMov: (v: string) => void;
  onNuevoMov: (tipo: MovTipo) => void;
  onSeleccionar: (m: Movimiento) => void;
}

export default function MovimientosTab({
  movimientosFiltrados,
  busquedaMov,
  setBusquedaMov,
  filtroTipoMov,
  setFiltroTipoMov,
  onNuevoMov,
  onSeleccionar,
}: MovimientosTabProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busquedaMov}
            onChange={(e) => setBusquedaMov(e.target.value)}
            placeholder="Buscar por código, producto, OT…"
            className="pl-8"
          />
        </div>
        <select
          value={filtroTipoMov}
          onChange={(e) => setFiltroTipoMov(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="NUEVO INGRESO">Entrada</option>
          <option value="SALIDA PRODUCCION">Salida</option>
          <option value="DEVOLUCION">Devolución</option>
          <option value="AJUSTE">Ajuste</option>
          <option value="PEDIDO REPOSICION">Pedido reposición</option>
        </select>
        <Button onClick={() => onNuevoMov('NUEVO INGRESO')} size="sm" variant="outline" className="gap-1">
          <ArrowDownCircle className="h-4 w-4" /> Entrada
        </Button>
        <Button onClick={() => onNuevoMov('SALIDA PRODUCCION')} size="sm" variant="outline" className="gap-1">
          <ArrowUpCircle className="h-4 w-4" /> Salida
        </Button>
        <Button onClick={() => onNuevoMov('AJUSTE')} size="sm" variant="outline" className="gap-1">
          <Pencil className="h-4 w-4" /> Ajuste
        </Button>
      </div>
      <div className="space-y-2">
        {movimientosFiltrados.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay movimientos que coincidan.
          </p>
        )}
        {movimientosFiltrados.map((m) => {
          const entrada = esEntrada(m.tipo);
          const ajuste = m.tipo === 'AJUSTE';
          const signo = entrada ? '+' : m.tipo === 'PEDIDO REPOSICION' ? '' : '-';
          const color = ajuste
            ? 'text-sky-300'
            : entrada
              ? 'text-success'
              : m.tipo === 'PEDIDO REPOSICION'
                ? 'text-accent'
                : 'text-destructive';
          const bg = ajuste
            ? 'bg-sky-500/10 border-sky-500/30'
            : entrada
              ? 'bg-success/15 border-success/30'
              : m.tipo === 'PEDIDO REPOSICION'
                ? 'bg-accent/10 border-violet-500/30'
                : 'bg-destructive/15 border-destructive/30';
          const Icon = ajuste
            ? Pencil
            : entrada
              ? ArrowDownCircle
              : m.tipo === 'PEDIDO REPOSICION'
                ? ClipboardPlus
                : ArrowUpCircle;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSeleccionar(m)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left transition-colors hover:border-border hover:bg-card/80"
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded border',
                  bg,
                  color,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="truncate">
                    {m.tipo}: {m.codigo} — {m.producto || ''}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong className={color}>
                    {signo}
                    {m.cantidad}
                  </strong>{' '}
                  unidades
                  {m.almacen ? ` → ${m.almacen}` : ''}
                  {m.ot ? ` · OT: ${m.ot}` : ''}
                  {m.responsable_entrega ? ` · ${m.responsable_entrega}` : ''}
                </div>
                <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  {formatFecha(m.fecha)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
