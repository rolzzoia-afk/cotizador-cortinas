// Header con ícono coloreado + título + subtítulo + slot derecho.
// Usado por las 6 secciones del Panel KPI Ventas.

import type { ReactNode } from 'react';

interface SectionHeaderProps {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: ReactNode;
  right?: ReactNode;
}

export default function SectionHeader({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  right,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-bold text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
      </div>
      {right}
    </div>
  );
}
