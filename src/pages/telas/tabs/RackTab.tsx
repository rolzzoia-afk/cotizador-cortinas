// Tab Rack: mapa visual de slots del rack con filtros + búsqueda + leyenda.
// Click en un slot abre DetalleSlotDialog con info del insumo + fallas.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { B1_RACK_MAP, B2_RACK_MAP, RACK_MAP } from '@/modules/telas/rackMaps';
import LegendDot from '../components/LegendDot';
import RackSection from '../components/RackSection';
import DetalleSlotDialog from '../dialogs/DetalleSlotDialog';
import type { Colmena, ColmenaEntry, Falla, Tela } from '../Telas.types';

interface RackTabProps {
  telas: Tela[];
  fallas: Falla[];
  colmena: Colmena;
}

export default function RackTab({ telas, fallas, colmena }: RackTabProps) {
  const [filtroAlm, setFiltroAlm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<{ slot: string; entrada: ColmenaEntry } | null>(null);

  const bodegas = useMemo(() => {
    if (filtroAlm === 'MATERIAS PRIMAS') {
      return [
        { label: 'BODEGA 1', map: B1_RACK_MAP },
        { label: 'BODEGA 2', map: B2_RACK_MAP },
      ];
    }
    return [{ label: null as string | null, map: RACK_MAP }];
  }, [filtroAlm]);

  const q = busqueda.trim().toLowerCase();
  const fallaCodes = useMemo(
    () =>
      new Set(
        fallas.filter((f) => f.resuelto === 'NO').map((f) => (f.codigo || '').toUpperCase()),
      ),
    [fallas],
  );

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filtroAlm}
          onChange={(e) => setFiltroAlm(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los almacenes</option>
          <option value="LIBERADO">Liberado</option>
          <option value="MATERIAS PRIMAS">Materias Primas</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="BK">Blackout</option>
          <option value="DU">Duo</option>
          <option value="SC">Screen</option>
        </select>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código en rack…"
            className="border-border bg-card pl-8"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <LegendDot color="#6366f1" label="Blackout" />
          <LegendDot color="#a855f7" label="Duo" />
          <LegendDot color="#3b82f6" label="Screen" />
          <LegendDot color="#ef4444" label="Con falla" />
          <LegendDot color="#374151" label="Vacío" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {bodegas.map(({ label, map }) => (
          <div key={label ?? 'main'}>
            {label && (
              <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(map).map(([nombre, cfg]) => (
                <RackSection
                  key={nombre}
                  nombre={nombre}
                  config={cfg}
                  colmena={colmena}
                  fallaCodes={fallaCodes}
                  filtroAlm={filtroAlm}
                  filtroTipo={filtroTipo}
                  busqueda={q}
                  onClickSlot={(slot, entrada) => entrada && setDetalle({ slot, entrada })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {detalle && (
        <DetalleSlotDialog
          slot={detalle.slot}
          entrada={detalle.entrada}
          tela={telas.find((t) => t.codigo === detalle.entrada.codigo) || null}
          fallas={fallas.filter(
            (f) => f.codigo === detalle.entrada.codigo && f.resuelto === 'NO',
          )}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
