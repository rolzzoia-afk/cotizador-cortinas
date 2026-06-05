// Tab Movimientos: 4 botones para crear movimientos + lista filtrable.

import { useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Pencil,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MovimientoDialog from '../dialogs/MovimientoDialog';
import { fmtFechaHora } from '../utils/formato';
import type { MovTipo, Movimiento, Tela, ValidadoresMap } from '../Telas.types';

interface MovimientosTabProps {
  movimientos: Movimiento[];
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
}

export default function MovimientosTab({
  movimientos,
  telas,
  validadores,
  empresaId,
  onReload,
}: MovimientosTabProps) {
  const [modalMov, setModalMov] = useState<MovTipo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      const matchQ =
        !q ||
        [m.codigo, m.tipo, m.responsable, m.ot, m.notas].some((v) =>
          (v || '').toLowerCase().includes(q),
        );
      const matchT = !filtroTipo || m.tipo === filtroTipo;
      return matchQ && matchT;
    });
  }, [movimientos, busqueda, filtroTipo]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          onClick={() => setModalMov('INGRESO')}
          className="gap-1.5 bg-success hover:bg-success/90"
        >
          <ArrowDownCircle className="h-4 w-4" /> Nueva Entrada
        </Button>
        <Button
          onClick={() => setModalMov('SALIDA')}
          className="gap-1.5 bg-destructive hover:bg-destructive/90"
        >
          <ArrowUpCircle className="h-4 w-4" /> Nueva Salida
        </Button>
        <Button
          onClick={() => setModalMov('TRASLADO')}
          className="gap-1.5 bg-warning hover:bg-warning/90"
        >
          <ArrowLeftRight className="h-4 w-4" /> Traslado
        </Button>
        <Button variant="outline" onClick={() => setModalMov('AJUSTE')} className="gap-1.5">
          <Pencil className="h-4 w-4" /> Ajuste
        </Button>
        <div className="ml-auto flex gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="INGRESO">Entradas</option>
            <option value="SALIDA">Salidas</option>
            <option value="TRASLADO">Traslados</option>
            <option value="AJUSTE">Ajustes</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="w-56 border-border bg-card pl-8"
            />
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          <ArrowLeftRight className="h-8 w-8 opacity-60" />
          No hay movimientos registrados aún
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((m) => {
            const tela = telas.find((t) => t.codigo === m.codigo);
            const tipoCls =
              m.tipo === 'INGRESO'
                ? 'bg-success/15 text-success'
                : m.tipo === 'SALIDA'
                  ? 'bg-destructive/15 text-destructive'
                  : m.tipo === 'TRASLADO'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-muted/30 text-muted-foreground';
            const tipoIcon =
              m.tipo === 'INGRESO'
                ? '↓'
                : m.tipo === 'SALIDA'
                  ? '↑'
                  : m.tipo === 'TRASLADO'
                    ? '↔'
                    : '✎';
            return (
              <div
                key={m.id}
                className="grid grid-cols-[40px_1fr_auto] items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold',
                    tipoCls,
                  )}
                >
                  {tipoIcon}
                </div>
                <div>
                  <div className="text-[13px] font-semibold">
                    {m.tipo} — <strong>{m.codigo}</strong>
                    {tela && (
                      <span className="ml-1 text-muted-foreground">({tela.nemotecnico || ''})</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.metros}m · {m.almacen || '—'}
                    {m.ot && ` · OT: ${m.ot}`}
                    {m.responsable && ` · ${m.responsable}`}
                  </div>
                  {m.notas && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{m.notas}</div>
                  )}
                </div>
                <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {fmtFechaHora(m.fecha)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalMov && (
        <MovimientoDialog
          tipo={modalMov}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalMov(null)}
          onSaved={() => {
            setModalMov(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}
