// Las barras de consumo de los últimos seis meses (lámina 4).
//
// Consumo es lo que se fue: salidas y mermas. El mes en curso va aparte —
// todavía no terminó, y pintarlo igual que los demás haría parecer que se
// consumió menos.

import { cn } from '@/lib/utils';
import type { MesConsumo } from '@/modules/inventario/ficha';

export function ConsumoMeses({
  consumo,
  promedio,
  cobertura,
}: {
  consumo: MesConsumo[];
  promedio: number;
  cobertura: number | null;
}) {
  const maximo = Math.max(1, ...consumo.map((m) => m.salidas));
  const ultimo = consumo.length - 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Consumo de los últimos 6 meses
        </h2>
        <div className="ml-auto text-xs text-muted-foreground">
          Promedio <span className="font-mono text-foreground">{promedio.toLocaleString('es-CL')}</span> / mes
          {cobertura != null ? (
            <>
              {' · cobertura '}
              <span className="font-mono text-foreground">
                {cobertura.toLocaleString('es-CL')}
              </span>
              {' meses'}
            </>
          ) : (
            ' · sin salidas en el período'
          )}
        </div>
      </div>

      <div className="mt-4 flex h-[110px] items-end gap-2">
        {consumo.map((m, i) => (
          <div key={m.clave} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="text-[0.6875rem] font-mono text-muted-foreground">
              {m.salidas > 0 ? m.salidas.toLocaleString('es-CL') : ''}
            </div>
            <div
              className={cn(
                'w-full rounded-t-[3px]',
                i === ultimo ? 'bg-accent/70' : 'bg-accent/25',
              )}
              style={{ height: `${Math.max(2, (m.salidas / maximo) * 74)}px` }}
              title={`${m.etiqueta}: ${m.salidas.toLocaleString('es-CL')}`}
            />
            <div className="text-[0.6875rem] text-muted-foreground">{m.etiqueta}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">
        El último mes va más oscuro porque todavía no termina; el promedio no lo cuenta.
      </p>
    </div>
  );
}

export default ConsumoMeses;
