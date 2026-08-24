import { cn } from '@/lib/utils';

/**
 * Una línea del recuadro de totales: etiqueta a la izquierda, monto a la
 * derecha. La comparten la cotización real y la maqueta de la vista previa del
 * editor de documentos, para que se vean idénticas.
 */
export default function FilaTotal({
  label,
  valor,
  fuerte,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    // `gap-6`: el recuadro se ancha según su fila más larga, así que sin una
    // separación mínima la etiqueta y el monto quedaban pegados al quitar las
    // filas de IVA y abono, que eran las que lo estiraban.
    <div className="flex items-center justify-between gap-6">
      <span className={cn('text-muted-foreground', fuerte && 'font-semibold text-foreground')}>
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          fuerte ? 'text-base font-bold text-foreground' : 'text-foreground',
        )}
      >
        {valor}
      </span>
    </div>
  );
}
