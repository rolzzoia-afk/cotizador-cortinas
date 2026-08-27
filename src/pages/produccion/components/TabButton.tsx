// Botón de pestaña del módulo Producción. Misma pinta que el de Tubos, para
// que el taller no tenga que aprender dos interfaces.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Contador chico a la derecha (áreas listas, avisos pendientes). */
  badge?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
      {badge}
    </button>
  );
}
