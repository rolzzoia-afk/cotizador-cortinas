// Tab "Mapa Rack": selector de almacén + búsqueda + grilla de racks. Cada
// celda del rack se renderiza con RackRow; click abre CellRackDialog.

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Insumo } from '@/modules/inventario/helpers';
import { type AlmacenRack, getRacks } from '@/modules/inventario/rackConfig';
import RackRow from '../components/RackRow';

interface RackTabProps {
  filtroAlmacenRack: AlmacenRack;
  setFiltroAlmacenRack: (a: AlmacenRack) => void;
  busquedaRack: string;
  setBusquedaRack: (v: string) => void;
  mapaUbicacionesSize: number;
  codigoPorSlot: (rack: string, fila: number, col: string) => string | null;
  insumoByCod: Map<string, Insumo>;
  onCellClick: (rack: string, fila: number, col: string) => void;
}

export default function RackTab({
  filtroAlmacenRack,
  setFiltroAlmacenRack,
  busquedaRack,
  setBusquedaRack,
  mapaUbicacionesSize,
  codigoPorSlot,
  insumoByCod,
  onCellClick,
}: RackTabProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filtroAlmacenRack}
          onChange={(e) => setFiltroAlmacenRack(e.target.value as AlmacenRack)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="LIBERADO">Bodega LIBERADO</option>
          <option value="MATERIAS_PRIMAS">MATERIAS PRIMAS</option>
        </select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busquedaRack}
            onChange={(e) => setBusquedaRack(e.target.value)}
            placeholder="Resaltar código en rack…"
            className="pl-8"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {mapaUbicacionesSize} posiciones registradas
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {getRacks(filtroAlmacenRack).map((rack) => (
          <div key={rack.nombre} className="rounded-lg border border-border bg-card/40 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
              {rack.nombre}
            </div>
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: `28px repeat(${rack.columnas.length}, minmax(0,1fr))`,
              }}
            >
              <div className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground">
                #
              </div>
              {rack.columnas.map((col) => (
                <div
                  key={col}
                  className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground"
                >
                  {col}
                </div>
              ))}
              {Array.from({ length: rack.filas }, (_, i) => i + 1).map((fila) => (
                <RackRow
                  key={fila}
                  fila={fila}
                  columnas={rack.columnas}
                  rackNombre={rack.nombre}
                  busqueda={busquedaRack}
                  codigoSlot={codigoPorSlot}
                  insumoByCod={insumoByCod}
                  onCellClick={(col) => onCellClick(rack.nombre, fila, col)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
