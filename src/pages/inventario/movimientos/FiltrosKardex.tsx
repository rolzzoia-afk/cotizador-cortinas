// La fila de filtros del Kardex (lámina «Kardex»).
//
// Los tres primeros son interruptores, no un desplegable: se pueden mirar los
// insumos y las telas a la vez, que es lo normal cuando se busca una OT.

import {
  ChipBusqueda,
  ChipFiltro,
  ChipSelect,
  InterruptorFiltro,
  SeparadorChips,
} from '@/components/inventario/ChipsFiltro';
import { etiquetaAlmacen } from '@/modules/inventario/almacenes';
import { RANGOS, type FiltrosVista, type Rango } from '@/modules/inventario/kardexVista';

const TIPOS = [
  'INGRESO',
  'SALIDA',
  'TRASLADO',
  'DEVOLUCION',
  'AJUSTE',
  'MERMA',
  'CONTEO',
] as const;

export function FiltrosKardex({
  filtros,
  onFiltros,
  rango,
  onRango,
  tipo,
  onTipo,
  historico,
  onHistorico,
  almacenes,
  usuarios,
}: {
  filtros: FiltrosVista;
  onFiltros: (f: FiltrosVista) => void;
  rango: Rango;
  onRango: (r: Rango) => void;
  tipo: string;
  onTipo: (t: string) => void;
  historico: boolean;
  onHistorico: (v: boolean) => void;
  almacenes: string[];
  usuarios: string[];
}) {
  const set = (patch: Partial<FiltrosVista>) => onFiltros({ ...filtros, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ChipFiltro activo={filtros.insumos} onClick={() => set({ insumos: !filtros.insumos })}>
        Insumos
      </ChipFiltro>
      <ChipFiltro activo={filtros.telas} onClick={() => set({ telas: !filtros.telas })}>
        Telas
      </ChipFiltro>
      <ChipFiltro
        activo={filtros.camionetas}
        onClick={() => set({ camionetas: !filtros.camionetas })}
      >
        Camionetas
      </ChipFiltro>

      <SeparadorChips />

      <ChipSelect valor={tipo} onChange={onTipo} etiqueta="Tipo de movimiento">
        <option value="">Tipo: todos</option>
        {TIPOS.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect valor={filtros.almacen} onChange={(v) => set({ almacen: v })} etiqueta="Almacén">
        <option value="">Almacén: todos</option>
        {almacenes.map((a) => (
          <option key={a} value={a}>
            {etiquetaAlmacen(a)}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect
        valor={rango === '7d' ? '' : rango}
        onChange={(v) => onRango((v || '7d') as Rango)}
        etiqueta="Rango de fechas"
      >
        {RANGOS.map((r) => (
          <option key={r.id} value={r.id === '7d' ? '' : r.id}>
            {r.texto}
          </option>
        ))}
      </ChipSelect>

      <ChipBusqueda
        valor={filtros.busqueda}
        onChange={(v) => set({ busqueda: v })}
        placeholder="OT o referencia"
        etiqueta="Buscar por código, OT o referencia"
      />

      <ChipSelect valor={filtros.usuario} onChange={(v) => set({ usuario: v })} etiqueta="Usuario">
        <option value="">Usuario</option>
        {usuarios.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </ChipSelect>

      <div className="ml-auto">
        <InterruptorFiltro activo={historico} onChange={onHistorico}>
          Incluir histórico anterior al kardex
        </InterruptorFiltro>
      </div>
    </div>
  );
}

export default FiltrosKardex;
