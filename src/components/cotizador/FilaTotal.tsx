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
  /** Uno de los dos montos que paga el cliente (el resto es el desglose). */
  fuerte?: boolean;
}) {
  return (
    // `gap-6`: el recuadro se ancha según su fila más larga, así que sin una
    // separación mínima la etiqueta y el monto quedaban pegados.
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
