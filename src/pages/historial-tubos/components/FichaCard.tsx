// Tarjeta de ficha completa de un tubo: cabecera con su estado actual +
// 3 secciones (origen, qué pasó después, historia completa de eventos).
// Es el corazón de la vista Trazabilidad.

import {
  ArrowLeftRight,
  Box,
  History,
  Link2,
  Scissors,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FichaSeccion from './FichaSeccion';
import { EV } from '../HistorialTubos.config';
import { formatFechaHora } from '../utils/formato-fechas';
import { labelOrigen } from '../utils/label-origen';
import type { FichaTuboResp } from '../HistorialTubos.types';

interface FichaCardProps {
  ficha: FichaTuboResp;
  onVerTubo: (id: string) => void;
}

export default function FichaCard({ ficha, onVerTubo }: FichaCardProps) {
  const { tubo, origen, padre, eventos, hijos, consumido_en } = ficha;
  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <div>
            <div className="text-base font-bold">
              {tubo.n_colmena ?? '—'} · {tubo.cod ?? '—'} ·{' '}
              {tubo.medida_cm != null ? `${Number(tubo.medida_cm).toFixed(1)} cm` : '—'}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              ID: {tubo.tubo_raiz_id.slice(0, 8)}…
            </div>
          </div>
        </div>
        <Badge
          className={cn(
            tubo.en_inventario
              ? 'bg-success/20 text-success'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {tubo.estado_descripcion}
        </Badge>
      </div>

      <FichaSeccion title="De dónde vino" icon={<Box className="h-4 w-4 text-success" />}>
        {origen ? (
          <>
            <p>
              <strong>{labelOrigen(origen.evento, origen.fuente)}</strong>{' '}
              <span className="text-muted-foreground">· {formatFechaHora(origen.fecha)}</span>
            </p>
            {origen.ot && (
              <p className="text-xs text-muted-foreground">
                Asociado a OT <strong>{origen.ot}</strong>
              </p>
            )}
            {origen.notas && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                &ldquo;{origen.notas}&rdquo;
              </p>
            )}
            {padre && (
              <div className="mt-2 rounded border border-primary/30 bg-primary/5 p-2">
                <p className="text-xs">↑ Es el sobrante o merma del corte de:</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1"
                  onClick={() => onVerTubo(padre.tubo_raiz_id)}
                >
                  <Link2 className="h-3 w-3" />
                  {padre.n_colmena ?? '—'} · {padre.cod ?? '—'} ·{' '}
                  {padre.medida_cm != null
                    ? `${Number(padre.medida_cm).toFixed(1)} cm`
                    : '—'}
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  OT {padre.evento_corte_ot ?? '?'}
                  {padre.evento_corte_linea != null &&
                    ` · línea ${padre.evento_corte_linea + 1}`}
                  {' · '}
                  {formatFechaHora(padre.evento_corte_fecha)}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Sin evento de origen registrado.
          </p>
        )}
      </FichaSeccion>

      {consumido_en && (
        <FichaSeccion
          title="Qué pasó después"
          icon={<Scissors className="h-4 w-4 text-accent" />}
        >
          <p>
            Cortado para OT <strong>{consumido_en.ot ?? '?'}</strong>
            {consumido_en.linea_idx != null && ` (línea ${consumido_en.linea_idx + 1})`}{' '}
            <span className="text-muted-foreground">
              · {formatFechaHora(consumido_en.fecha)}
            </span>
          </p>
          {consumido_en.medida_cortada != null && (
            <p className="text-xs text-muted-foreground">
              {Number(consumido_en.medida_cortada).toFixed(1)} cm fueron usados.
            </p>
          )}
          {hijos.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold">
                Lo que generó el corte ({hijos.length} pieza{hijos.length !== 1 ? 's' : ''}):
              </p>
              <div className="space-y-1">
                {hijos.map((h) => (
                  <div
                    key={h.tubo_raiz_id}
                    className="flex items-center justify-between rounded border bg-muted/30 p-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto gap-1 p-0 text-xs"
                      onClick={() => onVerTubo(h.tubo_raiz_id)}
                    >
                      {h.evento === 'sobrante' || h.evento === 'sobrante_error' ? (
                        <ArrowLeftRight className="h-3 w-3 text-accent" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                      )}
                      <span className="font-semibold">
                        {h.evento === 'merma' ? 'Merma' : 'Sobrante'}
                      </span>
                      <span>·</span>
                      <span>{h.n_colmena ?? '—'}</span>
                      <span>·</span>
                      <span className="font-mono">{h.cod ?? '—'}</span>
                      <span>·</span>
                      <span>
                        {h.medida_cm != null
                          ? `${Number(h.medida_cm).toFixed(1)} cm`
                          : '—'}
                      </span>
                    </Button>
                    {h.en_inventario && (
                      <Badge className="bg-success/20 text-[10px] text-success">
                        En stock
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </FichaSeccion>
      )}

      <FichaSeccion title="Historia completa" icon={<History className="h-4 w-4 text-primary" />}>
        <ul className="space-y-1.5">
          {eventos.map((e) => {
            const cfg = EV[e.evento] ?? {
              color: 'text-muted-foreground',
              icon: Box,
              label: e.evento,
            };
            const Icon = cfg.icon;
            return (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <Icon className={cn('mt-0.5 h-3.5 w-3.5', cfg.color)} />
                <div className="flex-1">
                  <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatFechaHora(e.created_at)}
                  </span>
                  {e.ot && (
                    <span className="text-muted-foreground"> · OT {e.ot}</span>
                  )}
                  {e.notas && (
                    <p className="text-[11px] italic text-muted-foreground">
                      &ldquo;{e.notas}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </FichaSeccion>
    </div>
  );
}
