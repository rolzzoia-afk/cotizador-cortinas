// Sección visual de un rack (tabla con filas/columnas de slots). Cada slot
// muestra el código del insumo, colorea por tipo (BK/DU/SC) o estado
// (falla). Filtra por almacén/tipo/búsqueda.

import { cn } from '@/lib/utils';
import type { RackMap } from '@/modules/telas/rackMaps';
import type { Colmena, ColmenaEntry } from '../Telas.types';

interface RackSectionProps {
  nombre: string;
  config: RackMap[string];
  colmena: Colmena;
  fallaCodes: Set<string>;
  filtroAlm: string;
  filtroTipo: string;
  busqueda: string;
  onClickSlot: (slot: string, entrada: ColmenaEntry | null) => void;
}

export default function RackSection({
  nombre,
  config,
  colmena,
  fallaCodes,
  filtroAlm,
  filtroTipo,
  busqueda,
  onClickSlot,
}: RackSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {nombre}
      </div>
      <table className="w-full border-separate border-spacing-[3px] text-[12px]">
        <thead>
          <tr>
            <th className="w-6 text-center text-muted-foreground">#</th>
            {config.cols.map((col) => (
              <th key={col} className="text-center text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row) => (
            <tr key={row.num}>
              <td className="text-center text-[12px] text-muted-foreground">{row.num}</td>
              {row.slots.map((slot, i) => {
                if (!slot) {
                  return (
                    <td key={i} className="p-0">
                      <div className="h-10 rounded-sm bg-card/50" />
                    </td>
                  );
                }
                const info = colmena[slot];
                let show = true;
                if (filtroAlm && info && info.almacen !== filtroAlm) show = false;
                if (filtroTipo && info && info.tipo !== filtroTipo) show = false;
                if (!info && (filtroAlm || filtroTipo)) show = false;

                const hasFalla =
                  info && fallaCodes.has((info.codigo || '').toUpperCase());
                const matches =
                  busqueda &&
                  ((info?.codigo || '').toLowerCase().includes(busqueda) ||
                    slot.toLowerCase().includes(busqueda));

                let bg = 'rgb(39, 39, 42)';
                let color = 'rgb(161, 161, 170)';
                let borderColor = 'rgba(255,255,255,0.05)';
                if (!show) {
                  bg = 'rgba(39, 39, 42, 0.3)';
                } else if (info) {
                  if (hasFalla) {
                    bg = 'rgba(239,68,68,0.2)';
                    borderColor = 'rgba(239,68,68,0.4)';
                    color = '#fca5a5';
                  } else if (info.tipo === 'BK') {
                    bg = 'rgba(99,102,241,0.2)';
                    borderColor = 'rgba(99,102,241,0.4)';
                    color = '#a5b4fc';
                  } else if (info.tipo === 'DU') {
                    bg = 'rgba(168,85,247,0.2)';
                    borderColor = 'rgba(168,85,247,0.4)';
                    color = '#d8b4fe';
                  } else if (info.tipo === 'SC') {
                    bg = 'rgba(59,130,246,0.2)';
                    borderColor = 'rgba(59,130,246,0.4)';
                    color = '#93c5fd';
                  }
                }
                if (matches) {
                  borderColor = '#fbbf24';
                }
                return (
                  <td key={i} className="p-0">
                    <button
                      disabled={!info && !(filtroAlm || filtroTipo)}
                      onClick={() => onClickSlot(slot, info || null)}
                      className={cn(
                        'flex h-10 w-full flex-col items-center justify-center overflow-hidden rounded-sm border px-0.5 text-[11px] leading-tight transition',
                        info && 'cursor-pointer hover:scale-105',
                      )}
                      style={{ background: bg, color, borderColor }}
                      title={info ? `${info.codigo} · ${slot}` : slot}
                    >
                      {info ? (
                        <>
                          <span className="truncate font-bold">{info.codigo}</span>
                          <span className="truncate text-[11px] opacity-60">{slot}</span>
                        </>
                      ) : (
                        <span className="text-[11px] opacity-50">{slot}</span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
