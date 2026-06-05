// Celda chica de info (label + valor) para el modal de celda de rack.

import type { ReactNode } from 'react';

interface InfoCellProps {
  label: string;
  children: ReactNode;
}

export default function InfoCell({ label, children }: InfoCellProps) {
  return (
    <div className="rounded border border-border bg-card/40 p-2">
      <div className="text-[0.65rem] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
