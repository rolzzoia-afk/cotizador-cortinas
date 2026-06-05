// KPI numérico con label + sub-label opcional + accent de color.
// Usado en la grilla de KPIs principal y en el panel de Reunión Diaria.

import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'success' | 'warn';
  icon?: ReactNode;
}

export default function KpiCard({ label, value, sub, accent, icon }: KpiCardProps) {
  // Colores explícitos para que se lean bien tanto en oscuro como claro
  const valueColor =
    accent === 'warn'
      ? '#F0997B' // coral suave, muy legible en oscuro
      : accent === 'success'
        ? '#5DCAA5'
        : undefined;
  const subColor =
    accent === 'warn'
      ? '#F0997B'
      : accent === 'success'
        ? '#5DCAA5'
        : 'var(--muted-foreground)';
  return (
    <div className="rounded-md bg-secondary/40 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 text-xl font-medium"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: subColor }}>
          {icon}
          {sub}
        </div>
      )}
    </div>
  );
}
