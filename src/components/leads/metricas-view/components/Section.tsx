// Card contenedor con título + subtítulo opcional + ícono opcional.
// Wrapper para cada bloque del dashboard de métricas.

import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Section({ title, subtitle, icon, children }: SectionProps) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <strong className="text-sm">{title}</strong>
      </div>
      {subtitle && <p className="mb-3 text-[11px] text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}
