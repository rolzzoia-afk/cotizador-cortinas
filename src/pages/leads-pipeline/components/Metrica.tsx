// KPI numérico con título + valor coloreado por tono.

import { cn } from '@/lib/utils';

interface MetricaProps {
  titulo: string;
  valor: number | string;
  tono?: 'progress' | 'success' | 'warn';
}

export default function Metrica({ titulo, valor, tono }: MetricaProps) {
  const cls =
    tono === 'success'
      ? 'text-success'
      : tono === 'warn'
        ? 'text-warning'
        : tono === 'progress'
          ? 'text-accent'
          : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn('mt-0.5 text-xl font-extrabold', cls)}>{valor}</div>
    </div>
  );
}
