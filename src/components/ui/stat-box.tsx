// Número grande con su rótulo: los KPI del tablero y las cajas de resumen que
// van arriba de las tablas. Lámina «Piezas y estados».
//
// El valor va en Fraunces (font-serif) como el resto de los números grandes de
// la app; el rótulo, en versalitas chicas.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Colorea el valor y el borde. 'neutro' = sin color, que es lo normal. */
export type TonoStat = 'neutro' | 'accent' | 'destructive' | 'warning' | 'success';

const TONO_VALOR: Record<TonoStat, string> = {
  neutro: 'text-foreground',
  accent: 'text-accent',
  destructive: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

const TONO_BORDE: Record<TonoStat, string> = {
  neutro: '',
  accent: 'border-accent/40',
  destructive: 'border-destructive/40',
  warning: 'border-warning/40',
  success: 'border-success/40',
};

export interface StatBoxProps {
  rotulo: string;
  /** El número o el texto corto. Si es muy largo, `compacto` lo achica. */
  valor: ReactNode;
  hint?: ReactNode;
  tono?: TonoStat;
  /** Para valores de texto (p. ej. «Insumos · Materias primas»). */
  compacto?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatBox({
  rotulo,
  valor,
  hint,
  tono = 'neutro',
  compacto,
  onClick,
  className,
}: StatBoxProps) {
  const Elemento = onClick ? 'button' : 'div';
  return (
    <Elemento
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'rounded-lg border border-border bg-card px-4 py-3.5 text-left',
        TONO_BORDE[tono],
        onClick && 'transition-colors hover:border-accent/50',
        className,
      )}
    >
      <div
        className={cn(
          'text-[0.6875rem] font-medium uppercase tracking-[0.08em]',
          tono === 'neutro' ? 'text-muted-foreground' : TONO_VALOR[tono],
        )}
      >
        {rotulo}
      </div>
      <div
        className={cn(
          'mt-1.5 font-serif font-medium leading-none tracking-[-0.03em]',
          compacto ? 'pt-1 text-[1.35rem] leading-tight' : 'text-[1.75rem]',
          TONO_VALOR[tono],
        )}
      >
        {valor}
      </div>
      {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
    </Elemento>
  );
}

export default StatBox;
