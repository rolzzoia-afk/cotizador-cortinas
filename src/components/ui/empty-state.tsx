// Qué se muestra cuando una tabla o una lista no tiene nada. Lámina «Piezas y
// estados»: recuadro punteado, ícono, una línea que dice qué falta y, si hay
// algo que hacer, un botón para hacerlo.
//
// Acepta la forma vieja (solo children) para reemplazar sin fricción las tres
// copias que había en Camionetas, Tubos e Inteligencia.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Ícono lucide ya renderizado, o cualquier nodo. */
  icono?: ReactNode;
  titulo?: string;
  texto?: string;
  /** Botón u otra acción. Va abajo del texto. */
  accion?: ReactNode;
  /** Forma antigua: el contenido completo, sin estructura. */
  children?: ReactNode;
  className?: string;
}

export function EmptyState({ icono, titulo, texto, accion, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      {icono ? (
        <span className="text-muted-foreground/70" aria-hidden>
          {icono}
        </span>
      ) : null}
      {titulo ? <div className="text-[0.845rem] font-medium text-foreground">{titulo}</div> : null}
      {texto ? <div className="max-w-sm text-xs">{texto}</div> : null}
      {children}
      {accion ? <div className="mt-1">{accion}</div> : null}
    </div>
  );
}

export default EmptyState;
