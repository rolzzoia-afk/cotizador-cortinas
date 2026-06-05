// Encabezado clickeable de columna con indicador de orden.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { SortCol, SortDir } from '../Inventario.types';

interface SortThProps {
  col: SortCol;
  current: SortCol;
  dir: SortDir;
  onSort: (c: SortCol) => void;
  align?: 'left' | 'center' | 'right';
  children: ReactNode;
}

export default function SortTh({ col, current, dir, onSort, align, children }: SortThProps) {
  const isActive = col === current;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        'cursor-pointer select-none p-2 hover:text-foreground',
        textAlign,
        isActive && 'text-accent',
      )}
    >
      {children}
      {isActive && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}
