// Insights automáticos derivados: día pico de movimientos, OT más grande,
// insumos detenidos, cotizaciones antiguas, OTs entregadas este mes.

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import GlassCard from '../components/GlassCard';
import EmptyState from '../components/EmptyState';
import { ESTADOS_ACTIVOS } from '../Inteligencia.config';
import { diasDesde, dgStr } from '../utils/formato';
import type { Insumo, Mov, OT } from '../Inteligencia.types';

interface InsightsCardProps {
  ots: OT[];
  insumos: Insumo[];
  movs: Mov[];
}

export default function InsightsCard({ ots, insumos, movs }: InsightsCardProps) {
  const insights = useMemo(() => {
    const arr: { tipo: 'info' | 'warning' | 'success' | 'danger'; txt: string }[] = [];
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const actividadPorDia = [0, 0, 0, 0, 0, 0, 0];
    for (const m of movs) {
      if (!m.fecha) continue;
      actividadPorDia[new Date(m.fecha).getDay()]++;
    }
    const diaPico = actividadPorDia.indexOf(Math.max(...actividadPorDia));
    if (Math.max(...actividadPorDia) > 0) {
      arr.push({
        tipo: 'info',
        txt: `El día con más movimientos es el <strong>${diasSemana[diaPico]}</strong>`,
      });
    }

    const topOT = ots
      .filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''))
      .map((o) => ({ ot: o, cant: (o.items || []).length }))
      .sort((a, b) => b.cant - a.cant)[0];
    if (topOT && topOT.cant > 0) {
      const cli = dgStr(topOT.ot, ['nombre_cliente', 'cliente']) || 'un cliente';
      arr.push({
        tipo: 'info',
        txt: `La OT más grande es de <strong>${cli}</strong> con ${topOT.cant} ventana${topOT.cant > 1 ? 's' : ''}`,
      });
    }

    const codsConMov = new Set(movs.map((m) => (m.codigo || '').trim().toUpperCase()));
    const insDetenidos = insumos.filter(
      (ins) => ins.stock_total > 0 && !codsConMov.has((ins.cod || '').toUpperCase()),
    );
    if (insDetenidos.length > 0) {
      arr.push({
        tipo: 'warning',
        txt: `<strong>${insDetenidos.length} insumos</strong> tienen stock pero sin movimiento en 30 días`,
      });
    }

    const cotizacionAntigua = ots.filter(
      (o) => o.estado === 'cotizacion' && diasDesde(o.fecha_creacion) >= 14,
    );
    if (cotizacionAntigua.length > 0) {
      arr.push({
        tipo: 'warning',
        txt: `<strong>${cotizacionAntigua.length} cotización${cotizacionAntigua.length > 1 ? 'es' : ''}</strong> llevan 14+ días sin aprobar`,
      });
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const entregadasMes = ots.filter(
      (o) => o.estado === 'entregado' && o.fecha_modificacion && new Date(o.fecha_modificacion) >= inicioMes,
    ).length;
    if (entregadasMes > 0) {
      arr.push({
        tipo: 'success',
        txt: `<strong>${entregadasMes} OT${entregadasMes > 1 ? 's' : ''}</strong> entregada${entregadasMes > 1 ? 's' : ''} este mes`,
      });
    }

    return arr;
  }, [ots, insumos, movs]);

  const tipoIcon = (t: string) => {
    const colorCls =
      t === 'danger'
        ? 'text-destructive'
        : t === 'warning'
          ? 'text-warning'
          : t === 'success'
            ? 'text-success'
            : 'text-accent';
    switch (t) {
      case 'danger':
      case 'warning':
        return <AlertTriangle className={`h-3.5 w-3.5 ${colorCls}`} />;
      case 'success':
        return <CheckCircle2 className={`h-3.5 w-3.5 ${colorCls}`} />;
      default:
        return <Info className={`h-3.5 w-3.5 ${colorCls}`} />;
    }
  };
  const tipoCls = (t: string) => {
    switch (t) {
      case 'danger':
        return 'border-destructive';
      case 'warning':
        return 'border-warning';
      case 'success':
        return 'border-success';
      default:
        return 'border-accent';
    }
  };

  return (
    <GlassCard title="Insights automáticos" icon={<Lightbulb className="h-4 w-4" />} iconColor="#f59e0b">
      {insights.length === 0 ? (
        <EmptyState icon="—" text="Acumula más datos para ver insights" />
      ) : (
        <div className="dp-scroll flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
          {insights.map((i, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2.5 rounded-sm border-l-2 bg-secondary/30 px-3 py-2 text-[12px] text-foreground/85',
                tipoCls(i.tipo),
              )}
            >
              <span className="mt-0.5 flex-shrink-0">{tipoIcon(i.tipo)}</span>
              <span
                className="[&_strong]:dp-num [&_strong]:font-semibold [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{ __html: i.txt }}
              />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
