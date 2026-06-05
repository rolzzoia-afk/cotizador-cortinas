// Botón de tab del header de Inventario.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export default function TabBtn({ active, onClick, children }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.78rem] font-medium transition-colors',
        active
          ? 'bg-accent text-foreground shadow'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
