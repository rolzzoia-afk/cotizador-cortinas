// Card de KPI numérico para la grid superior del Catálogo.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  icon?: ReactNode;
}

export default function StatCard({ label, value, tone, icon }: StatCardProps) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-destructive'
        : tone === 'warning'
          ? 'text-warning'
          : tone === 'info'
            ? 'text-sky-300'
            : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold', color)}>{value}</div>
    </div>
  );
}
