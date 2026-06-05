// Panel de "Reunión diaria" — bloque del header del dashboard de métricas.
// Muestra los 6 KPIs del mes (meta, vendido, brecha, ritmo diario,
// clientes calientes, cierres ayer), la barra de avance global y el
// desglose por vendedora. Si esAdmin, permite editar metas.

import { useState } from 'react';
import { CalendarDays, Flame, Pencil } from 'lucide-react';
import type {
  ProgresoVendedora,
  ReunionDiaria,
} from '@/modules/leads/metricas';
import type { VendedoraOpt } from '@/modules/leads/hooks';
import KpiCard from './KpiCard';
import BarraAvance from './BarraAvance';
import MetasEditor from './MetasEditor';
import { fmtCLP, fmtPct } from '../utils/formato';

interface ReunionDiariaPanelProps {
  reunion: ReunionDiaria;
  progreso: ProgresoVendedora[];
  esAdmin: boolean;
  periodo: string;
  metas: Record<string, number>;
  vendedoras: VendedoraOpt[];
  onGuardarMeta: (vendedoraId: string, monto: number) => Promise<void>;
}

export default function ReunionDiariaPanel({
  reunion,
  progreso,
  esAdmin,
  periodo,
  metas,
  vendedoras,
  onGuardarMeta,
}: ReunionDiariaPanelProps) {
  const [editando, setEditando] = useState(false);
  const nombrePeriodo = new Date(periodo + '-01T00:00:00').toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-accent" />
          <div>
            <div className="text-base font-bold text-foreground">Reunión diaria</div>
            <div className="text-[11px] capitalize text-muted-foreground">{nombrePeriodo}</div>
          </div>
        </div>
        {esAdmin && (
          <button
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3 w-3" /> {editando ? 'Cerrar' : 'Editar metas'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Meta del mes" value={fmtCLP(reunion.metaMes)} />
        <KpiCard
          label="Vendido"
          value={fmtCLP(reunion.acumulado)}
          sub={fmtPct(reunion.avancePct, 0) + ' de la meta'}
          accent="success"
        />
        <KpiCard
          label="Brecha"
          value={fmtCLP(reunion.brecha)}
          sub={reunion.brecha > 0 ? 'falta' : 'meta lograda'}
          accent={reunion.brecha > 0 ? 'warn' : 'success'}
        />
        <KpiCard
          label="Ritmo diario"
          value={fmtCLP(reunion.ritmoDiario)}
          sub={`${reunion.diasHabilesRestantes} días hábiles`}
        />
        <KpiCard
          label="Clientes calientes"
          value={String(reunion.clientesCalientes)}
          sub="activos"
          icon={<Flame className="h-3 w-3" />}
        />
        <KpiCard
          label="Cierres ayer"
          value={String(reunion.cierresAyer)}
          sub={`${reunion.cierresMes} en el mes`}
        />
      </div>

      <div className="mt-3">
        <BarraAvance pct={reunion.avancePct} />
      </div>

      {esAdmin &&
        (editando ? (
          <MetasEditor vendedoras={vendedoras} metas={metas} onGuardarMeta={onGuardarMeta} />
        ) : progreso.length > 0 ? (
          <div className="mt-4 space-y-2">
            {progreso.map((p) => (
              <div key={p.vendedoraId} className="text-xs">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="font-medium text-foreground">{p.nombre}</span>
                  <span className="text-muted-foreground">
                    {fmtCLP(p.vendido)} / {fmtCLP(p.meta)} · aporte {fmtPct(p.aportePct, 0)}
                  </span>
                </div>
                <BarraAvance pct={p.avancePct} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Todavía no hay metas cargadas. Usa "Editar metas" para definir la meta mensual de cada vendedora.
          </p>
        ))}
    </div>
  );
}
