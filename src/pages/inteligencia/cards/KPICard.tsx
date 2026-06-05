// KPI principal: número grande mono tabular, label uppercase tracked
// debajo y sub-label de contexto. Estilo Bloomberg: el número manda,
// el ícono es flag de identidad (no decoración).

import type { ReactNode } from 'react';

interface KPICardProps {
  icon: ReactNode;
  color: string;
  value: number;
  label: string;
  sub: string;
}

export default function KPICard({ icon, color, value, label, sub }: KPICardProps) {
  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors duration-150 hover:border-foreground/20">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: color }}
      />
      <div className="px-4 py-3 pl-5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="dp-num text-[28px] font-semibold leading-none text-foreground">
            {value}
          </div>
          <span
            className="flex h-4 w-4 items-center justify-center opacity-60"
            style={{ color }}
            aria-hidden
          >
            {icon}
          </span>
        </div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/75">
          {label}
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}
