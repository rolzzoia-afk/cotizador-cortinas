// Revisar lo que la app leyó del papel, línea por línea, antes de guardarlo.
//
// Todo se puede corregir: el código y la descripción (la lectura se pudo
// equivocar), la cantidad FACTURADA y a qué corresponde. Una línea que la
// lectura inventó se quita; una que no vio se agrega.
//
// Abajo, lo que la orden espera y el papel no trae: no es un error —puede ser
// una entrega parcial— pero conviene verlo antes de contar.

import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { cn } from '@/lib/utils';
import { formatearCantidad, pendienteDeLinea, type OrdenCompra } from '@/modules/inventario/compras';
import type { ArticuloCatalogo } from '@/modules/inventario/recepcionCatalogo';
import { marcarDuplicadas, type LineaRevision } from '@/modules/inventario/recepcionFactura';
import EmparejarLineaFactura from './EmparejarLineaFactura';

export function PasoRevisarFactura({
  lineas,
  orden,
  catalogo,
  deshabilitado,
  onCambiar,
}: {
  lineas: LineaRevision[];
  orden: OrdenCompra | null;
  catalogo: ArticuloCatalogo[];
  deshabilitado?: boolean;
  onCambiar: (l: LineaRevision[]) => void;
}) {
  const cambiar = (key: string, cambio: Partial<LineaRevision> | LineaRevision) =>
    onCambiar(marcarDuplicadas(lineas.map((l) => (l.key === key ? { ...l, ...cambio } : l))));

  const quitar = (key: string) =>
    onCambiar(
      marcarDuplicadas(lineas.filter((l) => l.key !== key)).map((l, i) => ({ ...l, posicion: i + 1 })),
    );

  const agregar = () =>
    onCambiar([
      ...lineas,
      {
        key: `m${Date.now()}`,
        posicion: lineas.length + 1,
        codigo: '',
        descripcion: '',
        cantidad: null,
        unidad: null,
        paquete: null,
        accion: 'recibir',
        motivo_exclusion: null,
        orden_linea_id: null,
        dominio: null,
        item_cod: null,
        factor: 1,
        vinculo: null,
        confianza: null,
        duplicada: false,
      },
    ]);

  const usadas = new Set(lineas.filter((l) => l.accion === 'recibir').map((l) => l.orden_linea_id));
  const noVienen = (orden?.lineas ?? []).filter(
    (l) => (l.estado_linea === 'pendiente' || l.estado_linea === 'parcial') && pendienteDeLinea(l) > 0 && !usadas.has(l.id),
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 w-10 px-3 text-left font-medium">#</th>
              <th className="h-9 px-2 text-left font-medium">Lo que dice el papel</th>
              <th className="h-9 w-[104px] px-2 text-center font-medium">Facturado</th>
              <th className="h-9 px-2 text-left font-medium">A qué corresponde</th>
              <th className="h-9 w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => (
              <tr
                key={l.key}
                className={cn('border-b border-border align-top last:border-0', l.accion === 'excluir' && 'bg-secondary/30')}
              >
                <td className="px-3 py-2 font-mono text-muted-foreground">{l.posicion}</td>
                <td className="px-2 py-1.5">
                  <Input
                    value={l.codigo}
                    onChange={(e) => cambiar(l.key, { codigo: e.target.value })}
                    disabled={deshabilitado}
                    placeholder="Código"
                    aria-label={`Código de la línea ${l.posicion}`}
                    className="mb-1 h-7 font-mono text-[0.72rem]"
                  />
                  <Input
                    value={l.descripcion}
                    onChange={(e) => cambiar(l.key, { descripcion: e.target.value })}
                    disabled={deshabilitado}
                    placeholder="Descripción, como en el papel"
                    aria-label={`Descripción de la línea ${l.posicion}`}
                    className="h-7 text-[0.74rem]"
                  />
                  {l.paquete != null && (
                    <div className="mt-0.5 text-[0.66rem] text-muted-foreground">
                      paquete de {formatearCantidad(l.paquete)} impreso en el papel
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <InputDecimal
                    value={l.cantidad ?? 0}
                    onChange={(v) => cambiar(l.key, { cantidad: v >= 0 ? v : 0 })}
                    disabled={deshabilitado || l.accion === 'excluir'}
                    aria-label={`Facturado de la línea ${l.posicion}`}
                    className={cn(
                      'mx-auto h-8 w-[84px] px-2 text-center font-mono text-[0.78rem]',
                      l.accion === 'recibir' && !(Number(l.cantidad) > 0) && 'border-warning/70',
                    )}
                  />
                  {l.unidad && (
                    <div className="mt-0.5 text-center text-[0.66rem] text-muted-foreground">{l.unidad}</div>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <EmparejarLineaFactura
                    linea={l}
                    orden={orden}
                    catalogo={catalogo}
                    deshabilitado={deshabilitado}
                    onCambiar={(nueva) => cambiar(l.key, nueva)}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => quitar(l.key)}
                    disabled={deshabilitado}
                    aria-label={`Quitar la línea ${l.posicion}`}
                    title="Quitar: la lectura la inventó o está repetida"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={agregar}
        disabled={deshabilitado}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[0.78rem] text-muted-foreground hover:bg-secondary"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar una línea que la lectura no vio
      </button>

      {noVienen.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 px-3.5 py-2.5 text-xs leading-relaxed">
          <b className="font-medium">La orden espera y este papel no trae:</b>{' '}
          {noVienen
            .map((l) => `${l.item_cod || l.codigo_interno || `#${l.posicion}`} (faltan ${formatearCantidad(pendienteDeLinea(l))})`)
            .join(' · ')}
          . Si es una entrega parcial, está bien: la orden queda esperando el resto.
        </div>
      )}
    </div>
  );
}

export default PasoRevisarFactura;
