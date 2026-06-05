// Section dentro del documento — sin chrome de card. Título inline arriba,
// contenido directo abajo. La jerarquía la hace el spacing y la tipografía,
// no un container con border + bg.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  title: string;
  icon: ReactNode;
  iconColor: string;
  count?: number;
  countColor?: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function GlassCard({
  title,
  count,
  extra,
  children,
  className,
}: GlassCardProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium tracking-tight text-foreground">{title}</h3>
        <div className="flex items-baseline gap-2">
          {extra}
          {count !== undefined && count > 0 && (
            <span className="dp-num text-[12px] text-muted-foreground">{count}</span>
          )}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
