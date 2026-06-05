// Gráfico de barras agrupadas — SVG inline, sin librerías.
//
// Lenguaje v4: sin chrome, sin sombras, sin colores decorativos. Las series
// usan tokens del tema (success/destructive/warning) — color comunica estado,
// no decoración.
//
// Decisiones de craft (post-impeccable):
// - Sin grid lines completas. Solo 3 líneas hairline horizontales (baseline,
//   midline, top) — suficiente referencia, mínimo ruido.
// - Eje Y implícito en el tooltip + un solo label "max=N" en la esquina.
// - Hover por columna (día) muestra los 3 valores. No por barra individual.
// - prefers-reduced-motion: instant entry, sin transition.

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface BarSeries {
  key: string;
  label: string;
  // Color token: variable CSS de Tailwind (text-success → fill-success no
  // existe en core, así que usamos hsl directo del token).
  colorVar: string; // 'success' | 'destructive' | 'warning' | 'accent' | etc.
}

export interface GroupedBarsProps {
  data: number[][]; // matriz [día][serie] — values
  labels: string[]; // labels del eje X (mismo length que data)
  series: BarSeries[]; // metadata de cada serie (mismo length que data[i])
  height?: number;
  ariaLabel?: string;
}

export default function GroupedBars({
  data,
  labels,
  series,
  height = 180,
  ariaLabel,
}: GroupedBarsProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { maxVal, scaled } = useMemo(() => {
    let m = 0;
    for (const row of data) for (const v of row) if (v > m) m = v;
    if (m === 0) m = 1;
    return { maxVal: m, scaled: data.map((row) => row.map((v) => v / m)) };
  }, [data]);

  const cols = data.length;
  // Layout: cada columna tiene `series.length` barras + un pequeño gap
  // entre columnas. Calculamos como porcentaje sobre 100% de width.
  const colGapPct = 1.2; // gap relativo entre columnas (en %)
  const barGapPct = 0.25; // gap dentro de la columna (en %)
  const totalColGaps = colGapPct * (cols - 1);
  const colWidthPct = (100 - totalColGaps) / cols;
  const barWidthPct = (colWidthPct - barGapPct * (series.length - 1)) / series.length;

  return (
    <div
      className="relative w-full"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Gridlines hairline — solo 3 (top / mid / base) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-0 top-0 h-px bg-border" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border/60" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      </div>

      {/* Max label en esquina superior derecha */}
      <div className="dp-num absolute right-0 top-0 -translate-y-full pb-0.5 text-[10px] tabular-nums text-muted-foreground">
        max {maxVal}
      </div>

      {/* Barras */}
      <div className="absolute inset-0 flex items-end gap-[1.2%] pb-px">
        {scaled.map((row, ci) => {
          const isHover = hoverIdx === ci;
          return (
            <div
              key={ci}
              className="dp-row flex h-full flex-1 items-end gap-[0.25%]"
              style={{ width: `${colWidthPct}%` }}
              onMouseEnter={() => setHoverIdx(ci)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {row.map((v, si) => {
                const sMeta = series[si];
                const h = Math.max(v * 100, v > 0 ? 1.5 : 0); // mínimo visible
                return (
                  <div
                    key={si}
                    className={cn(
                      'gb-bar relative flex-1 origin-bottom',
                      isHover ? 'opacity-100' : 'opacity-85',
                    )}
                    style={{
                      width: `${barWidthPct}%`,
                      height: `${h}%`,
                      background: `hsl(var(--${sMeta.colorVar}))`,
                      transition: 'opacity 120ms var(--ease-out-strong)',
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* X labels */}
      <div className="absolute -bottom-5 left-0 right-0 flex gap-[1.2%]">
        {labels.map((lab, i) => (
          <div
            key={i}
            className={cn(
              'dp-num flex-1 text-center text-[9.5px] tabular-nums transition-colors',
              hoverIdx === i ? 'text-foreground' : 'text-muted-foreground/70',
            )}
            style={{ width: `${colWidthPct}%` }}
          >
            {lab}
          </div>
        ))}
      </div>

      {/* Tooltip por columna */}
      {hoverIdx !== null && (
        <div
          className="dp-num pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-border bg-popover px-2 py-1.5 text-[10.5px] shadow-sm"
          style={{
            left: `${(hoverIdx + 0.5) * (100 / cols)}%`,
            top: -8,
          }}
        >
          <div className="mb-1 font-medium text-foreground">{labels[hoverIdx]}</div>
          {series.map((s, si) => (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 flex-shrink-0"
                style={{ background: `hsl(var(--${s.colorVar}))` }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span
                className="ml-auto tabular-nums text-foreground"
                style={{ color: `hsl(var(--${s.colorVar}))` }}
              >
                {data[hoverIdx][si]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
