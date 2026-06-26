// OTs en riesgo operativo. Patrón editorial: ID en mono a la izquierda,
// cliente como texto principal, motivos en micro-texto, estado a la derecha.
// Sin rails. Con scroll vertical para listas largas.

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { ESTADOS_ACTIVOS, ESTADOS_PRODUCCION } from '../Inteligencia.config';
import { diasDesde, diasHasta, dgStr, fmtFecha } from '../utils/formato';
import type { OT } from '../Inteligencia.types';

interface OTRiskCardProps {
  ots: OT[];
}

export default function OTRiskCard({ ots }: OTRiskCardProps) {
  const riesgos = useMemo(() => {
    const candidatas = ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''));
    return candidatas
      .map((ot) => {
        const otId = dgStr(ot, ['ot']) || '#' + String(ot.id).slice(-4);
        const cli = dgStr(ot, ['nombre_cliente', 'cliente']) || 'Sin nombre';
        const estado = ot.estado || '—';
        const diasSinMov = diasDesde(ot.fecha_modificacion);
        const fe = dgStr(ot, ['fecha_entrega', 'fechaEntrega']);
        const diasParaEntr = fe ? diasHasta(fe) : null;

        let riesgo = 0;
        const motivos: string[] = [];
        if (ESTADOS_PRODUCCION.includes(estado)) {
          if (diasSinMov >= 5) {
            riesgo += 3;
            motivos.push(`${diasSinMov}d sin movimiento`);
          } else if (diasSinMov >= 3) {
            riesgo += 2;
            motivos.push(`${diasSinMov}d sin actividad`);
          }
        }
        if (diasParaEntr !== null) {
          if (diasParaEntr <= 0) {
            riesgo += 4;
            motivos.push('Entrega vencida');
          } else if (diasParaEntr <= 2) {
            riesgo += 3;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          } else if (diasParaEntr <= 5) {
            riesgo += 2;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          } else if (diasParaEntr <= 10) {
            riesgo += 1;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          }
        }
        return { ot, otId, cli, estado, diasSinMov, diasParaEntr, riesgo, motivos };
      })
      .filter((r) => r.riesgo > 0)
      .sort((a, b) => b.riesgo - a.riesgo);
  }, [ots]);

  const estadoLabel: Record<string, string> = {
    cotizacion: 'Cotización',
    medicion: 'Medición',
    aprobado: 'Aprobado',
    produccion: 'Producción',
    listo: 'Listo',
    instalacion: 'Instalación',
  };

  return (
    <GlassCard title="OTs en riesgo operativo" icon={null} iconColor="" count={riesgos.length}>
      {riesgos.length === 0 ? (
        <EmptyState icon="" text="No hay OTs en situación de riesgo" />
      ) : (
        <ul className="dp-scroll max-h-[420px] overflow-y-auto divide-y divide-border/50 pr-1">
          {riesgos.map((r) => {
            const tone =
              r.riesgo >= 4
                ? 'text-destructive'
                : r.riesgo >= 2
                  ? 'text-warning'
                  : 'text-accent';
            return (
              <li
                key={String(r.ot.id)}
                className="dp-row grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1 py-2.5"
              >
                <span className="dp-num text-[13px] font-semibold tabular-nums text-foreground">
                  {r.otId}
                </span>
                <span className="min-w-0 truncate text-[13px] text-foreground/85">
                  {r.cli}
                </span>
                <span className="text-[12px] uppercase tracking-wider text-muted-foreground">
                  {estadoLabel[r.estado] || r.estado}
                </span>
                <span aria-hidden />
                <span className={cn('col-span-2 truncate text-[11.5px] font-medium', tone)}>
                  {r.motivos.join(' · ')}
                  {r.diasParaEntr !== null && r.diasParaEntr > 0 && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      Entrega{' '}
                      <span className="dp-num text-foreground/70">
                        {fmtFecha(dgStr(r.ot, ['fecha_entrega', 'fechaEntrega']))}
                      </span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
