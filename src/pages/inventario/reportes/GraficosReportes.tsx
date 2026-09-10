// Los cuatro gráficos de Reportes (lámina «Reportes»).
//
// Barras dibujadas con divs, no con una librería: son series chicas y de una
// sola variable, y el eje que importa es el rótulo, no la grilla. Cada barra
// lleva su número al lado, así que el largo es una ayuda visual y nunca la
// única forma de leer el dato.

import { cn } from '@/lib/utils';
import type { BarraMes } from '@/modules/inventario/reportes';

/** Barras horizontales con su valor escrito. */
export function BarrasHorizontales({
  filas,
  maximo,
  formato,
}: {
  filas: Array<{ nombre: string; valor: number; sufijo?: string }>;
  maximo: number;
  formato: (v: number) => string;
}) {
  const tope = maximo > 0 ? maximo : 1;
  return (
    <div className="flex flex-col gap-2">
      {filas.map((f) => (
        <div key={f.nombre} className="flex items-center gap-3 text-[0.78rem]">
          <span className="w-[104px] shrink-0 truncate" title={f.nombre}>
            {f.nombre}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="h-3.5 shrink-0 rounded-[2px] bg-accent"
              style={{ width: `${Math.max(2, (f.valor / tope) * 100)}%` }}
            />
            <span className="shrink-0 font-mono text-[0.78rem] font-semibold tabular-nums">
              {formato(f.valor)}
              {f.sufijo}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barras verticales por mes. La del mes en curso va apagada. */
export function BarrasMensuales({
  barras,
  formato,
}: {
  barras: BarraMes[];
  formato: (v: number) => string;
}) {
  const tope = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <div className="flex h-[190px] items-end gap-1.5">
      {barras.map((b) => (
        <div key={b.clave} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className={cn(
                'w-full rounded-t-[3px]',
                b.enCurso ? 'bg-accent/35' : 'bg-accent',
              )}
              style={{ height: `${Math.max(1, (b.valor / tope) * 100)}%` }}
              title={`${b.etiqueta}: ${formato(b.valor)}${b.enCurso ? ' (mes en curso)' : ''}`}
            />
          </div>
          <span
            className={cn(
              'text-[0.65rem] text-muted-foreground',
              b.enCurso && 'font-medium text-foreground',
            )}
          >
            {b.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}

export default BarrasMensuales;
