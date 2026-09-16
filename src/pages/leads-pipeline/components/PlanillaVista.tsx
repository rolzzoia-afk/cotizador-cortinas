// La Planilla de seguimiento: el Excel del equipo comercial dentro de la app.
// Una fila por cliente/cotización, con los filtros del Excel (mes, semana,
// ticket, persona), el estado de la cotización con su botón, los seguimientos
// 1-2-3 y quién hizo el último cambio. Exporta con los mismos encabezados.

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { formatCLP } from '@/lib/formatters';
import { descargarExcelPlanilla } from '@/modules/leads/exportarPlanilla';
import {
  FILTROS_PLANILLA_VACIOS,
  filaPlanilla,
  filtrarFilas,
  mesesDisponibles,
  totalesPlanilla,
  type FiltrosPlanilla,
} from '@/modules/leads/planilla';
import { useEquipoVentas, useNombresPerfiles, useSeguimientosEmpresa } from '@/modules/leads/planillaStore';
import type { Lead } from '@/modules/leads/types';
import EquipoDialog from './EquipoDialog';
import PlanillaFila, { GRUPOS_PLANILLA } from './PlanillaFila';
import PlanillaFiltros from './PlanillaFiltros';

type Props = {
  leads: Lead[];
  onAbrir: (leadId: string) => void;
  onRefresh: () => void | Promise<void>;
};

const FONDO_GRUPO = ['bg-secondary', 'bg-card'];

export default function PlanillaVista({ leads, onAbrir, onRefresh }: Props) {
  const { porLead, refresh: refrescarSeguimientos } = useSeguimientosEmpresa();
  const nombres = useNombresPerfiles();
  const { equipo, guardar: guardarEquipo } = useEquipoVentas();
  const [filtros, setFiltros] = useState<FiltrosPlanilla>(FILTROS_PLANILLA_VACIOS);
  const [equipoAbierto, setEquipoAbierto] = useState(false);
  const [exportando, setExportando] = useState(false);

  const porId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const filas = useMemo(() => {
    const hoy = new Date();
    return leads
      .map((l) => filaPlanilla(l, { seguimientos: porLead.get(l.id) ?? [], nombres, hoy }))
      .sort((a, b) => b.fechaIso.localeCompare(a.fechaIso));
  }, [leads, porLead, nombres]);

  const visibles = useMemo(() => filtrarFilas(filas, filtros), [filas, filtros]);
  const totales = useMemo(() => totalesPlanilla(visibles), [visibles]);
  const meses = useMemo(() => mesesDisponibles(filas), [filas]);
  const personas = useMemo(() => {
    const set = new Set<string>([...equipo.vendedoras, ...equipo.terreno]);
    for (const f of filas) [f.llamada, f.cotiza, f.visita].forEach((p) => p && set.add(p));
    return [...set].sort((a, b) => a.localeCompare(b, 'es-CL'));
  }, [equipo, filas]);

  // Un cambio desde la fila (estado de la cotización, seguimiento) llega solo
  // por tiempo real; se refresca igual por si la conexión está caída.
  const trasCambio = useCallback(async () => {
    await Promise.all([onRefresh(), refrescarSeguimientos()]);
  }, [onRefresh, refrescarSeguimientos]);

  const exportar = async () => {
    setExportando(true);
    try {
      const mes = meses.find((m) => m.valor === filtros.mes)?.texto.replace(' ', '_');
      await descargarExcelPlanilla(visibles, mes);
    } catch (e) {
      toast.error('No se pudo exportar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-3">
      <PlanillaFiltros
        filtros={filtros}
        setFiltros={setFiltros}
        meses={meses}
        personas={personas}
        visibles={visibles.length}
        total={filas.length}
        exportando={exportando}
        onExportar={exportar}
        onEquipo={() => setEquipoAbierto(true)}
      />

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          Cotizado: <strong className="text-foreground">{formatCLP(totales.cotizado)}</strong>
        </span>
        <span>
          Ganado: <strong className="text-success">{formatCLP(totales.ganado)}</strong>
        </span>
        {totales.porActualizar > 0 && (
          <button
            type="button"
            onClick={() => setFiltros({ ...filtros, estadoCotizacion: 'por_actualizar' })}
            className="font-semibold text-warning hover:underline"
          >
            {totales.porActualizar} por actualizar
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
          {filas.length === 0 ? 'Todavía no hay clientes.' : 'Ningún cliente con estos filtros.'}
        </div>
      ) : (
        <div className="max-h-[calc(100vh-260px)] overflow-auto rounded-lg border border-border bg-card/40">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                {GRUPOS_PLANILLA.map((g, i) => (
                  <th
                    key={g.titulo}
                    colSpan={g.columnas.length}
                    className={`${i === 0 ? 'sticky left-0 z-30 ' : ''}${FONDO_GRUPO[i % 2]} border-b border-l border-border px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide text-foreground`}
                  >
                    {g.titulo}
                  </th>
                ))}
              </tr>
              <tr>
                {GRUPOS_PLANILLA.flatMap((g, gi) =>
                  g.columnas.map((c, ci) => (
                    <th
                      key={`${g.titulo}-${ci}`}
                      className={`${gi === 0 ? 'sticky left-0 z-30 border-r ' : ''}${ci === 0 ? 'border-l ' : ''}whitespace-nowrap border-b border-border bg-card px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`}
                    >
                      {c}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const lead = porId.get(f.id);
                return lead ? <PlanillaFila key={f.id} fila={f} lead={lead} onAbrir={onAbrir} onCambio={trasCambio} /> : null;
              })}
            </tbody>
          </table>
        </div>
      )}

      <EquipoDialog open={equipoAbierto} onOpenChange={setEquipoAbierto} equipo={equipo} onGuardar={guardarEquipo} />
    </div>
  );
}
