// Botón de pestaña, único para toda la app. Venía repetido en tres lugares
// (Tubos, Producción e Inventario) y ya se habían separado entre sí.
//
// Dos pintas:
// - 'clasico': la de Tubos, Producción y Admin. Es la de por defecto para que
//   esas pantallas no cambien de aspecto al pasar a este componente.
// - 'subrayado': la del módulo /inventario (lámina «Piezas y estados»): sin
//   fondo, subrayada en terracota.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type VarianteTab = 'clasico' | 'subrayado';

export interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Contador chico a la derecha del rótulo (alertas, líneas, avisos). */
  badge?: ReactNode;
  variante?: VarianteTab;
  className?: string;
}

const BASE = 'flex items-center gap-1.5 whitespace-nowrap transition-colors';

const PINTAS: Record<VarianteTab, { base: string; on: string; off: string }> = {
  clasico: {
    base: 'rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-semibold',
    on: 'border-primary bg-primary/10 text-foreground',
    off: 'text-muted-foreground hover:text-foreground',
  },
  subrayado: {
    base: 'border-b-2 border-transparent px-0.5 py-2.5 text-[0.845rem] font-medium',
    on: 'border-accent text-accent',
    off: 'text-muted-foreground hover:text-foreground',
  },
};

export function TabButton({
  active,
  onClick,
  children,
  badge,
  variante = 'clasico',
  className,
}: TabButtonProps) {
  const pinta = PINTAS[variante];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={cn(BASE, pinta.base, active ? pinta.on : pinta.off, className)}
    >
      {children}
      {badge}
    </button>
  );
}

export default TabButton;
