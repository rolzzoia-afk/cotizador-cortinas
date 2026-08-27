// Dónde está un insumo: el rack, la fila y la columna, dibujados en la grilla
// del galpón para que el bodeguero camine derecho.
//
// Solo lectura: acá no se cambia una ubicación. Para eso está Inventario →
// Racks. La tubería no vive en un rack sino en la colmena, así que para un
// código de tubo se muestra su posición de colmena.

import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getColmenaPorCodTubo,
  getRackRawBOM,
  rackToDisplayLabel,
  type BOMItem,
  type Insumo,
  type Rack,
  type TuboColmena,
} from '@/modules/bodega/bomUtils';
import { getRacks, type AlmacenRack } from '@/modules/inventario/rackConfig';
import type { InsumoConsolidado } from '@/modules/cotizador/inventarioOT';

/** El insumo consolidado visto como item de BOM, que es lo que sabe buscar bodega. */
function comoBOM(i: InsumoConsolidado): BOMItem {
  return {
    id: i.id,
    categoria: '',
    descripcion: i.descripcion,
    especificacion: i.codigo || '',
    color: '',
    cantidad_req: i.cantidad,
    unidad: i.unidad || '',
    cantidad_despachada: 0,
    estado: 'pendiente',
  };
}

export default function UbicacionDialog({
  insumo,
  insumosCat,
  racks,
  tubos,
  onClose,
}: {
  insumo: InsumoConsolidado | null;
  insumosCat: Insumo[];
  racks: Rack[];
  tubos: TuboColmena[];
  onClose: () => void;
}) {
  const ubic = useMemo(
    () => (insumo ? getRackRawBOM(comoBOM(insumo), insumosCat, racks) : null),
    [insumo, insumosCat, racks],
  );

  const colmena = useMemo(
    () => (insumo?.codigo ? getColmenaPorCodTubo(insumo.codigo, tubos) : null),
    [insumo, tubos],
  );

  const almacen: AlmacenRack =
    (ubic?.almacen || '').toUpperCase() === 'MATERIAS_PRIMAS' ? 'MATERIAS_PRIMAS' : 'LIBERADO';
  const def = useMemo(
    () => getRacks(almacen).find((r) => r.nombre === String(ubic?.rack ?? '').trim()) ?? null,
    [almacen, ubic],
  );

  return (
    <Dialog open={!!insumo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {insumo?.codigo ? `[${insumo.codigo}] ` : ''}
            {insumo?.descripcion}
          </DialogTitle>
          <DialogDescription>
            {ubic
              ? `${almacen === 'LIBERADO' ? 'Bodega liberado' : 'Materias primas'} · ${rackToDisplayLabel(ubic.rack, ubic.fila, ubic.columna)}`
              : colmena
                ? `En la colmena de tubos: ${colmena}`
                : 'Este insumo no tiene ubicación registrada.'}
          </DialogDescription>
        </DialogHeader>

        {ubic && def && (
          <div className="overflow-x-auto">
            <table className="border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1" />
                  {def.columnas.map((c) => (
                    <th key={c} className="p-1 font-medium text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: def.filas }, (_, i) => i + 1).map((fila) => (
                  <tr key={fila}>
                    <th className="p-1 text-right font-medium text-muted-foreground">{fila}</th>
                    {def.columnas.map((col) => {
                      const aqui =
                        String(ubic.fila).trim() === String(fila) &&
                        String(ubic.columna).trim().toUpperCase() === col.toUpperCase();
                      return (
                        <td
                          key={col}
                          className={cn(
                            'h-8 w-10 border border-border/60 text-center align-middle',
                            aqui && 'bg-emerald-500/30 font-bold text-emerald-200',
                          )}
                        >
                          {aqui && <MapPin className="mx-auto h-4 w-4" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">{ubic.rack}</p>
          </div>
        )}

        {ubic && !def && (
          <p className="text-xs text-muted-foreground">
            El rack «{String(ubic.rack)}» no está en el plano del galpón, así que no se puede
            dibujar. La posición igual es la de arriba.
          </p>
        )}

        {!ubic && !colmena && (
          <p className="text-xs text-muted-foreground">
            Se puede registrar en <strong>Inventario → Racks</strong>. Mientras tanto, hay que
            buscarlo a mano.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
