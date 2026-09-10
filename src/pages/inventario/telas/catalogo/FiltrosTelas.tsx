// La fila de chips del catálogo de telas (lámina «Telas»).
//
// Los desplegables ofrecen solo lo que existe en el catálogo cargado: preguntar
// por un proveedor que no vende ninguna de estas telas es una pregunta perdida.

import { X } from 'lucide-react';
import {
  ChipBusqueda,
  ChipFiltro,
  ChipSelect,
} from '@/components/inventario/ChipsFiltro';
import { etiquetaAlmacen } from '@/modules/inventario/almacenes';
import type { FiltrosTelas as Filtros, OpcionesTelas } from '@/modules/inventario/telasCatalogo';

export function FiltrosTelas({
  filtros,
  onFiltros,
  opciones,
}: {
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  opciones: OpcionesTelas;
}) {
  const set = (patch: Partial<Filtros>) => onFiltros({ ...filtros, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* La familia elegida se muestra con su nombre y una cruz para soltarla:
          es el filtro que más se queda puesto sin que nadie se acuerde. */}
      {filtros.familia ? (
        <ChipFiltro activo onClick={() => set({ familia: '' })} titulo="Quitar el filtro de familia">
          Familia: {opciones.familias.find((f) => f.id === filtros.familia)?.texto ?? filtros.familia}
          <X className="h-3 w-3" />
        </ChipFiltro>
      ) : (
        <ChipSelect valor="" onChange={(v) => set({ familia: v })} etiqueta="Familia de tela">
          <option value="">Familia</option>
          {opciones.familias.map((f) => (
            <option key={f.id} value={f.id}>
              {f.texto}
            </option>
          ))}
        </ChipSelect>
      )}

      <ChipSelect valor={filtros.color} onChange={(v) => set({ color: v })} etiqueta="Color">
        <option value="">Color</option>
        {opciones.colores.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect valor={filtros.almacen} onChange={(v) => set({ almacen: v })} etiqueta="Almacén">
        <option value="">Almacén</option>
        {opciones.almacenes.map((a) => (
          <option key={a} value={a}>
            {etiquetaAlmacen(a)}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect
        valor={filtros.proveedor}
        onChange={(v) => set({ proveedor: v })}
        etiqueta="Proveedor"
      >
        <option value="">Proveedor</option>
        {opciones.proveedores.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </ChipSelect>

      <ChipFiltro
        activo={filtros.soloBajoMinimo}
        onClick={() => set({ soloBajoMinimo: !filtros.soloBajoMinimo })}
        titulo="Solo las telas que están bajo su mínimo o ya se acabaron"
      >
        Solo bajo mínimo
      </ChipFiltro>

      <div className="ml-auto">
        <ChipBusqueda
          valor={filtros.busqueda}
          onChange={(v) => set({ busqueda: v })}
          placeholder="Código o descripción"
          etiqueta="Buscar por código, descripción, proveedor o posición"
          ancho="w-[190px]"
        />
      </div>
    </div>
  );
}

export default FiltrosTelas;
