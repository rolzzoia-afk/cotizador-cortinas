// Filtros propios de la Planilla: mes y semana (como el Excel), ticket,
// persona del equipo, estado de la cotización, solo con OT y archivados.
// A la derecha: editar el equipo y exportar a Excel.

import { Download, Loader2, Users } from 'lucide-react';
import {
  ChipFiltro,
  ChipSelect,
  InterruptorFiltro,
  SeparadorChips,
} from '@/components/inventario/ChipsFiltro';
import { Button } from '@/components/ui/button';
import { ESTADO_COTIZACION_LABEL, ESTADOS_COTIZACION } from '@/modules/leads/cotizacionEstado';
import {
  FILTROS_PLANILLA_VACIOS,
  TICKET_LABEL,
  type FiltrosPlanilla,
  type Ticket,
} from '@/modules/leads/planilla';
import type { EstadoCotizacion } from '@/modules/leads/types';

type Props = {
  filtros: FiltrosPlanilla;
  setFiltros: (f: FiltrosPlanilla) => void;
  meses: { valor: string; texto: string }[];
  personas: string[];
  visibles: number;
  total: number;
  exportando: boolean;
  onExportar: () => void;
  onEquipo: () => void;
};

export default function PlanillaFiltros({
  filtros,
  setFiltros,
  meses,
  personas,
  visibles,
  total,
  exportando,
  onExportar,
  onEquipo,
}: Props) {
  const set = <K extends keyof FiltrosPlanilla>(k: K, v: FiltrosPlanilla[K]) => setFiltros({ ...filtros, [k]: v });
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_PLANILLA_VACIOS);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ChipSelect valor={filtros.mes} onChange={(v) => set('mes', v)} etiqueta="Mes">
        <option value="">Todos los meses</option>
        {meses.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.texto}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect valor={filtros.semana} onChange={(v) => set('semana', v)} etiqueta="Semana">
        <option value="">Todas las semanas</option>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <option key={n} value={String(n)}>
            Semana {n}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect valor={filtros.ticket} onChange={(v) => set('ticket', v as '' | Ticket)} etiqueta="Ticket">
        <option value="">Todos los tickets</option>
        {(Object.keys(TICKET_LABEL) as Ticket[]).map((t) => (
          <option key={t} value={t}>
            {TICKET_LABEL[t]}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect valor={filtros.persona} onChange={(v) => set('persona', v)} etiqueta="Persona del equipo">
        <option value="">Todo el equipo</option>
        {personas.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </ChipSelect>
      <ChipSelect
        valor={filtros.estadoCotizacion}
        onChange={(v) => set('estadoCotizacion', v as '' | EstadoCotizacion)}
        etiqueta="Estado de la cotización"
      >
        <option value="">Toda cotización</option>
        {ESTADOS_COTIZACION.map((e) => (
          <option key={e} value={e}>
            {ESTADO_COTIZACION_LABEL[e]}
          </option>
        ))}
      </ChipSelect>
      <ChipFiltro activo={filtros.soloConCotizacion} onClick={() => set('soloConCotizacion', !filtros.soloConCotizacion)}>
        Con OT
      </ChipFiltro>
      <SeparadorChips />
      <InterruptorFiltro activo={filtros.ocultarArchivados} onChange={(v) => set('ocultarArchivados', v)}>
        Ocultar archivados
      </InterruptorFiltro>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => setFiltros(FILTROS_PLANILLA_VACIOS)}
          className="text-[12px] text-muted-foreground hover:text-destructive"
        >
          Limpiar
        </button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">
        {visibles} / {total}
      </span>
      <Button size="sm" variant="outline" onClick={onEquipo} className="gap-1.5">
        <Users className="h-4 w-4" /> Equipo
      </Button>
      <Button size="sm" variant="outline" onClick={onExportar} disabled={exportando || visibles === 0} className="gap-1.5">
        {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Exportar Excel
      </Button>
    </div>
  );
}
