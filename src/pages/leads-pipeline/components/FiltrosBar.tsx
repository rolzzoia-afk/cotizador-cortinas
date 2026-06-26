// Barra de filtros del Pipeline: búsqueda de texto, dropdown de vendedora,
// dropdown de canal, toggle bot/manual, ordenar por scoring, chips de
// estado para filtrar por uno o varios estados a la vez.

import { Bot, Search, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  ESTADOS_LABEL,
  ESTADOS_ORDEN,
  ESTADOS_TONO,
  type LeadEstado,
} from '@/modules/leads/types';
import type { FiltroOrigen } from '../LeadsPipeline.types';
import { TONO_CLS } from '../LeadsPipeline.config';

interface FiltrosBarProps {
  busqueda: string;
  setBusqueda: (v: string) => void;
  filtroVendedora: string;
  setFiltroVendedora: (v: string) => void;
  filtroCanal: string;
  setFiltroCanal: (v: string) => void;
  filtroOrigen: FiltroOrigen;
  setFiltroOrigen: (v: FiltroOrigen) => void;
  ordenarPorScoring: boolean;
  setOrdenarPorScoring: (fn: (v: boolean) => boolean) => void;
  hayLeadsDeBot: boolean;
  vendedoras: { id: string; nombre: string }[];
  canales: string[];
  filtroEstados: Set<LeadEstado>;
  toggleEstadoFiltro: (e: LeadEstado) => void;
  setFiltroEstados: (s: Set<LeadEstado>) => void;
  resultadoCount: number;
  totalCount: number;
}

export default function FiltrosBar({
  busqueda,
  setBusqueda,
  filtroVendedora,
  setFiltroVendedora,
  filtroCanal,
  setFiltroCanal,
  filtroOrigen,
  setFiltroOrigen,
  ordenarPorScoring,
  setOrdenarPorScoring,
  hayLeadsDeBot,
  vendedoras,
  canales,
  filtroEstados,
  toggleEstadoFiltro,
  setFiltroEstados,
  resultadoCount,
  totalCount,
}: FiltrosBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/40 px-5 py-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre/teléfono/email…"
          className="w-64 pl-8"
        />
      </div>
      <select
        value={filtroVendedora}
        onChange={(e) => setFiltroVendedora(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">Todas las vendedoras</option>
        <option value="__sin_asignar">Sin asignar</option>
        {vendedoras.map((v) => (
          <option key={v.id} value={v.id}>
            {v.nombre}
          </option>
        ))}
      </select>
      <select
        value={filtroCanal}
        onChange={(e) => setFiltroCanal(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">Todos los canales</option>
        {canales.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="Web">Web</option>
        <option value="Referido">Referido</option>
      </select>

      {hayLeadsDeBot && (
        <>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(['todos', 'bot', 'manual'] as FiltroOrigen[]).map((o, idx) => (
              <button
                key={o}
                onClick={() => setFiltroOrigen(o)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors',
                  idx > 0 && 'border-l border-border',
                  filtroOrigen === o
                    ? 'bg-accent/15 text-accent'
                    : 'bg-transparent text-muted-foreground hover:text-foreground',
                )}
                title={
                  o === 'bot'
                    ? 'Solo leads derivados por el bot de WhatsApp'
                    : o === 'manual'
                      ? 'Solo leads cargados manualmente'
                      : 'Todos los leads'
                }
              >
                {o === 'bot' && <Bot className="h-3 w-3" />}
                {o === 'todos' ? 'Todos' : o === 'bot' ? 'Bot' : 'Manual'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setOrdenarPorScoring((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
              ordenarPorScoring
                ? 'border-warning/30 bg-warning/15 text-warning'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
            title="Priorizar leads con mayor scoring del bot"
          >
            <Star className={cn('h-3 w-3', ordenarPorScoring && 'fill-current')} />
            Por scoring
          </button>
        </>
      )}

      <div className="ml-1 flex flex-wrap items-center gap-1">
        {ESTADOS_ORDEN.map((e) => {
          const activo = filtroEstados.has(e);
          return (
            <button
              key={e}
              onClick={() => toggleEstadoFiltro(e)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[12px] font-medium transition-colors',
                activo
                  ? TONO_CLS[ESTADOS_TONO[e]]
                  : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {ESTADOS_LABEL[e]}
            </button>
          );
        })}
        {filtroEstados.size > 0 && (
          <button
            onClick={() => setFiltroEstados(new Set())}
            className="ml-1 inline-flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> limpiar
          </button>
        )}
      </div>

      <span className="ml-auto text-xs text-muted-foreground">
        {resultadoCount} / {totalCount}
      </span>
    </div>
  );
}
