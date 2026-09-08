// La fila de filtros del Kardex (lámina «Kardex»).
//
// Los tres primeros son interruptores, no un desplegable: se pueden mirar los
// insumos y las telas a la vez, que es lo normal cuando se busca una OT.

import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { etiquetaAlmacen } from '@/modules/inventario/almacenes';
import {
  RANGOS,
  type FiltrosVista,
  type Rango,
} from '@/modules/inventario/kardexVista';

const TIPOS = [
  'INGRESO',
  'SALIDA',
  'TRASLADO',
  'DEVOLUCION',
  'AJUSTE',
  'MERMA',
  'CONTEO',
] as const;

function Chip({
  activo,
  children,
  onClick,
}: {
  activo?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background/50 px-3 text-[0.78rem] text-muted-foreground transition-colors',
        activo && 'border-accent bg-accent/[0.12] font-medium text-accent',
      )}
    >
      {children}
    </button>
  );
}

/** Un desplegable con la misma pinta que los chips. */
function ChipSelect({
  valor,
  onChange,
  children,
  etiqueta,
}: {
  valor: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  etiqueta: string;
}) {
  return (
    <div
      className={cn(
        'relative inline-flex h-[34px] items-center rounded-lg border border-border bg-background/50 text-[0.78rem] text-muted-foreground',
        valor && 'border-accent bg-accent/[0.12] font-medium text-accent',
      )}
    >
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label={etiqueta}
        className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 text-inherit outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3" />
    </div>
  );
}

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
      <Chip activo={filtros.insumos} onClick={() => set({ insumos: !filtros.insumos })}>
        Insumos
      </Chip>
      <Chip activo={filtros.telas} onClick={() => set({ telas: !filtros.telas })}>
        Telas
      </Chip>
      <Chip activo={filtros.camionetas} onClick={() => set({ camionetas: !filtros.camionetas })}>
        Camionetas
      </Chip>

      <span className="mx-1 h-[22px] w-px bg-border" />

      <ChipSelect valor={tipo} onChange={onTipo} etiqueta="Tipo de movimiento">
        <option value="">Tipo: todos</option>
        {TIPOS.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect
        valor={filtros.almacen}
        onChange={(v) => set({ almacen: v })}
        etiqueta="Almacén"
      >
        <option value="">Almacén: todos</option>
        {almacenes.map((a) => (
          <option key={a} value={a}>
            {etiquetaAlmacen(a)}
          </option>
        ))}
      </ChipSelect>

      <ChipSelect valor={rango === '7d' ? '' : rango} onChange={(v) => onRango((v || '7d') as Rango)} etiqueta="Rango de fechas">
        {RANGOS.map((r) => (
          <option key={r.id} value={r.id === '7d' ? '' : r.id}>
            {r.texto}
          </option>
        ))}
      </ChipSelect>

      <div
        className={cn(
          'relative inline-flex h-[34px] items-center rounded-lg border border-border bg-background/50 pl-2.5 text-[0.78rem]',
          filtros.busqueda && 'border-accent',
        )}
      >
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={filtros.busqueda}
          onChange={(e) => set({ busqueda: e.target.value })}
          placeholder="OT o referencia"
          aria-label="Buscar por código, OT o referencia"
          className="h-full w-[150px] bg-transparent px-2 outline-none placeholder:text-muted-foreground"
        />
      </div>

      <ChipSelect valor={filtros.usuario} onChange={(v) => set({ usuario: v })} etiqueta="Usuario">
        <option value="">Usuario</option>
        {usuarios.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </ChipSelect>

      <label className="ml-auto flex cursor-pointer items-center gap-2 text-[0.78rem] text-muted-foreground">
        Incluir histórico anterior al kardex
        <input
          type="checkbox"
          checked={historico}
          onChange={(e) => onHistorico(e.target.checked)}
          className="sr-only"
        />
        <span
          className={cn(
            'relative inline-block h-[22px] w-[38px] rounded-full transition-colors',
            historico ? 'bg-accent' : 'bg-secondary',
          )}
        >
          <span
            className={cn(
              'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-card transition-all',
              historico ? 'right-[2px]' : 'left-[2px]',
            )}
          />
        </span>
      </label>
    </div>
  );
}

export default FiltrosKardex;
