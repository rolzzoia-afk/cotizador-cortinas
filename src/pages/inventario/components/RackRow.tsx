// Fila de un rack: una celda por columna. Cada celda muestra el código
// del insumo en ese slot (o vacío). Click abre el modal de celda.

import { cn } from '@/lib/utils';
import { type Insumo, getStockTotal } from '@/modules/inventario/helpers';

interface RackRowProps {
  fila: number;
  columnas: string[];
  rackNombre: string;
  busqueda: string;
  codigoSlot: (rack: string, fila: number, col: string) => string | null;
  insumoByCod: Map<string, Insumo>;
  onCellClick: (col: string) => void;
}

export default function RackRow({
  fila,
  columnas,
  rackNombre,
  busqueda,
  codigoSlot,
  insumoByCod,
  onCellClick,
}: RackRowProps) {
  const q = busqueda.trim().toUpperCase();
  return (
    <>
      <div className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground">
        {fila}
      </div>
      {columnas.map((col) => {
        const codigo = codigoSlot(rackNombre, fila, col);
        const insumo = codigo ? insumoByCod.get(codigo) : undefined;
        const bajo =
          insumo && (insumo.minimo || 0) > 0 && getStockTotal(insumo) < (insumo.minimo || 0);
        const vacio = !codigo;
        const match = q && codigo && codigo.toUpperCase().includes(q);
        const dim = q && codigo && !match;
        return (
          <button
            key={col}
            onClick={() => onCellClick(col)}
            title={codigo || `${col}${fila} vacío`}
            className={cn(
              'aspect-square rounded border text-center text-[0.56rem] font-semibold transition-all',
              vacio
                ? 'border-border bg-secondary/30 text-muted-foreground'
                : bajo
                  ? 'border-warning/30 bg-warning/15 text-warning'
                  : 'border-accent/30 bg-accent/15 text-accent',
              match && 'scale-110 ring-2 ring-yellow-400 z-10',
              dim && 'opacity-20',
            )}
          >
            {codigo ? codigo.slice(-4) : ''}
          </button>
        );
      })}
    </>
  );
}
