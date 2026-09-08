// Encabezado de cada submódulo del inventario (lámina «Insumos · catálogo» y
// todas las que siguen): miga chica, título grande en Fraunces, una línea que
// dice de un vistazo cuánto hay, y a la derecha el buscador y los botones.
//
// El buscador se pasa armado desde afuera: cada pantalla busca cosas distintas
// y ya tiene su propio estado.

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  /** Texto chico de arriba: «Inventario», «Inventario · Insumos». */
  miga?: ReactNode;
  titulo: ReactNode;
  /** Una línea con los conteos vivos. Sin adornos: números y hechos. */
  hint?: ReactNode;
  /** Buscador ya armado (input + ícono). Va antes de las acciones. */
  buscador?: ReactNode;
  /** Botones, de menos a más importante (el accent va último). */
  acciones?: ReactNode;
  className?: string;
}

export function PageHeader({
  miga,
  titulo,
  hint,
  buscador,
  acciones,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start gap-4', className)}>
      <div className="min-w-0">
        {miga ? <div className="text-xs text-muted-foreground">{miga}</div> : null}
        <h1 className="mt-1 font-serif text-[1.75rem] font-medium leading-tight tracking-[-0.02em]">
          {titulo}
        </h1>
        {hint ? <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {buscador || acciones ? (
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          {buscador}
          {acciones}
        </div>
      ) : null}
    </div>
  );
}

export default PageHeader;
