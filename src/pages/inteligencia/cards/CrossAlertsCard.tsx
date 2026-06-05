// Stock crítico cruzado con producción. Tratamiento de lista editorial:
// cada item es una fila densa con el dato a la derecha alineado, barra de
// progreso animada bajo cada fila mostrando stock vs mínimo. Scroll vertical.

import { useMemo } from 'react';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import StockBar from '../components/StockBar';
import { ESTADOS_PRODUCCION } from '../Inteligencia.config';
import { dgStr, fmt } from '../utils/formato';
import type { Insumo, Mov, OT, Rack } from '../Inteligencia.types';

interface CrossAlertsCardProps {
  insumos: Insumo[];
  stockBajo: Insumo[];
  racks: Rack[];
  ots: OT[];
  movs: Mov[];
}

export default function CrossAlertsCard({ stockBajo, racks, ots, movs }: CrossAlertsCardProps) {
  const otsEnProd = ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || ''));

  const cruces = useMemo(() => {
    return stockBajo
      .map((ins) => {
        const codIns = (ins.cod || '').toUpperCase().trim();
        const otsAfectadas: string[] = [];
        for (const ot of otsEnProd) {
          const otId = dgStr(ot, ['ot']) || String(ot.id);
          const movsOT = movs.filter((m) => {
            const mc = (m.codigo || '').toUpperCase().trim();
            const otM = String(m.ot || '');
            return otM === String(ot.id) && mc === codIns;
          });
          if (movsOT.length > 0) otsAfectadas.push(otId);
        }
        const stock = ins.stock_total;
        const minimo = Number(ins.minimo) || 0;
        const pct = minimo > 0 ? Math.max(0, Math.min(100, (stock / minimo) * 100)) : 0;
        const critico = stock <= 0;
        const rack = racks.find((r) => (r.codigo_insumo || '').toUpperCase() === codIns);
        const posicion = rack ? `${rack.rack} ${rack.fila}-${rack.columna}` : ins.ubicacion || '';
        return { ins, stock, minimo, pct, critico, posicion, otsAfectadas };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [stockBajo, racks, otsEnProd, movs]);

  return (
    <GlassCard title="Stock crítico" icon={null} iconColor="" count={cruces.length}>
      {cruces.length === 0 ? (
        <EmptyState icon="" text="Todos los insumos sobre mínimo" />
      ) : (
        <ul className="dp-scroll max-h-[420px] overflow-y-auto divide-y divide-border/50 pr-1">
          {cruces.map((c, i) => (
            <li key={`${c.ins.cod}-${i}`} className="dp-row py-2.5">
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-foreground">
                    {c.ins.nemotecnico || c.ins.cod}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    {c.posicion && <span className="font-mono">{c.posicion}</span>}
                    {c.otsAfectadas.length > 0 && (
                      <span>
                        OT activa{' '}
                        <span className="dp-num text-foreground/80">
                          {c.otsAfectadas.slice(0, 2).join(' · ')}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="dp-num text-[15px] font-medium leading-none">
                    <span className={c.critico ? 'text-destructive' : 'text-warning'}>
                      {fmt(c.stock)}
                    </span>
                    <span className="text-muted-foreground/60"> / {fmt(c.minimo)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2">
                <StockBar value={c.stock} max={c.minimo} tone={c.critico ? 'destructive' : 'warning'} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
