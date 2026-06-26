// Últimos movimientos de bodega. Patrón timeline editorial: tiempo en mono
// pequeño + acción + dato a la derecha. Color sólo en el delta numérico
// (+ / −), nada de rails ni badges decorativos.

import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { fmt, fmtFechaHora } from '../utils/formato';
import type { Insumo, Mov } from '../Inteligencia.types';

interface ActivityCardProps {
  movs: Mov[];
  insumos: Insumo[];
}

export default function ActivityCard({ movs, insumos }: ActivityCardProps) {
  const recientes = movs.slice(0, 20);

  return (
    <GlassCard
      title="Últimos movimientos de bodega"
      icon={null}
      iconColor=""
    >
      <div className="max-h-80 overflow-y-auto">
        {recientes.length === 0 ? (
          <EmptyState icon="" text="Sin movimientos en los últimos 30 días" />
        ) : (
          <ul className="divide-y divide-border/50">
            {recientes.map((m, i) => {
              const tipoRaw = (m.tipo || '').trim();
              const tipo = tipoRaw.toLowerCase();
              const esEntrada =
                tipo === 'entrada' ||
                tipoRaw === 'NUEVO INGRESO' ||
                tipoRaw === 'DEVOLUCION';
              const esSalida =
                tipo === 'salida' ||
                tipo === 'despacho' ||
                tipoRaw === 'SALIDA PRODUCCION';

              const tone = esEntrada
                ? 'text-success'
                : esSalida
                  ? 'text-destructive'
                  : 'text-warning';
              const signo = esEntrada ? '+' : esSalida ? '−' : '';

              const codInsumo = (m.codigo || '').trim();
              const nomInsumo = (m.producto || '').trim();
              const insRec = codInsumo
                ? insumos.find((x) => (x.cod || '').toUpperCase() === codInsumo.toUpperCase())
                : null;
              const nombreFinal = nomInsumo || insRec?.nemotecnico || '—';
              const titulo = codInsumo && nombreFinal
                ? `${codInsumo} — ${nombreFinal}`
                : codInsumo || nombreFinal || 'Insumo';

              const cantStr = m.cantidad !== undefined ? `${signo}${fmt(m.cantidad)}` : '';

              return (
                <li
                  key={i}
                  className="dp-row grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 py-1.5"
                >
                  <span className="dp-num w-14 flex-shrink-0 text-[12px] tabular-nums text-muted-foreground">
                    {fmtFechaHora(m.fecha)}
                  </span>
                  <span className="min-w-0 truncate text-[12px] text-foreground/85">
                    {titulo}
                  </span>
                  {cantStr && (
                    <span className={`dp-num flex-shrink-0 text-[13px] font-medium ${tone}`}>
                      {cantStr}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </GlassCard>
  );
}
