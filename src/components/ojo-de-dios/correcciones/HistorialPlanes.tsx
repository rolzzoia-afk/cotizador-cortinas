// Sección "Historial de planes de corte" — lista todos los planes
// guardados, permite ver preview de cada uno y restaurar la colmena al
// estado anterior. Maneja el flujo de restauración parcial (cuando
// algunos tubos ya no se pueden restaurar porque fueron cortados).
//
// Es el componente más grande del módulo Correcciones porque combina
// 3 sub-vistas (lista, filtro y dialog de preview).

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Eye,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirmar } from '@/components/ui/confirm';
import {
  type PlanResumen,
  type usePlanesHistorial,
} from '@/modules/admin/correcciones';
import { extraerOTsPlan } from './utils/extraer-ots-plan';

interface HistorialPlanesProps {
  ctx: ReturnType<typeof usePlanesHistorial>;
  email: string;
}

export default function HistorialPlanes({ ctx, email }: HistorialPlanesProps) {
  const { planes, loading, cargar, restaurar } = ctx;
  const [preview, setPreview] = useState<PlanResumen | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [filtro, setFiltro] = useState('');

  const planesVisibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return planes;
    return planes.filter((p) =>
      extraerOTsPlan(p).some((ot) => ot.toLowerCase().includes(q)),
    );
  }, [planes, filtro]);

  const onRestaurar = async (plan: PlanResumen) => {
    if (!email) {
      toast.error('Configura primero el email del optimizador');
      return;
    }
    const fecha = plan.fecha
      ? new Date(plan.fecha).toLocaleString('es-CL')
      : '—';
    const tieneSnap = plan.snapshot_inventario.length > 0;
    const msgInv = tieneSnap
      ? `\n🗄 Colmena: se restaurarán ${plan.snapshot_inventario.length} tubos al estado anterior a este plan.`
      : `\n⚠️ Este plan no tiene snapshot de colmena guardado. Solo se restaurará el listado de cortes.`;
    if (
      !await confirmar(
        `⏱ VIAJE EN EL TIEMPO\n\nVas a volver al estado del: ${fecha}${msgInv}\n\n¿Confirmas la restauración? Esta acción actualiza el inventario físico de tubos.`,
      )
    )
      return;
    setRestaurando(true);
    try {
      const res = await restaurar(plan.id, email);
      const omitidos = res.count_omitidos_tombstone ?? 0;

      if (omitidos > 0) {
        // PARCIAL: mostrar dialog persistente con detalle de tubos no restaurados.
        // Esto reemplaza el toast.success que pasaba desapercibido (incidente 29-05).
        const detalleArr = ((res as { tubos_omitidos_detalle?: unknown[] }).tubos_omitidos_detalle || []) as Array<{
          cod?: string; medida_cm?: string | number; n_colmena?: string;
        }>;
        const listaDetalle = detalleArr.slice(0, 30).map((t) =>
          `  · ${t.cod || '?'}  ${t.medida_cm ?? '?'} cm  (${t.n_colmena || '?'})`,
        ).join('\n');
        const masTubos = detalleArr.length > 30 ? `\n  … y ${detalleArr.length - 30} más` : '';
        toast.error(
          '⚠️ RESTAURACIÓN PARCIAL\n\n' +
          `Se restauraron ${res.count_despues} de ${res.count_despues + omitidos} tubos.\n` +
          `Antes había ${res.count_antes} tubos en colmena.\n\n` +
          `❌ ${omitidos} tubo${omitidos === 1 ? '' : 's'} NO se restauraron porque ya fueron cortados o eliminados físicamente:\n` +
          listaDetalle + masTubos +
          '\n\nSi esos tubos NO fueron cortados en la realidad (la app se confundió), contacta a soporte para corrección manual. ' +
          'NO le vuelvas a dar "Restaurar" — no van a aparecer apretando el botón otra vez.',
        );
      } else {
        toast.success(
          `Restauración completa. ${res.count_despues} tubos restaurados (antes había ${res.count_antes}).`,
        );
      }
      setPreview(null);
      await cargar();
    } catch (e) {
      // PostgrestError no es Error nativo — tiene .message y opcionalmente
      // .details/.hint. Sin este cast, el error venía como "[object Object]".
      const err = e as { message?: string; details?: string; hint?: string } | Error;
      const msg =
        (err as Error).message ||
        (err as { message?: string }).message ||
        String(e);
      const extra = (err as { details?: string }).details
        ? ` (${(err as { details?: string }).details})`
        : '';
      toast.error('Error al restaurar: ' + msg + extra);
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <div className="rounded-lg border border-destructive/30 bg-card/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-destructive" />
          <strong className="text-sm">Historial de planes de corte</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] text-muted-foreground">
            Puedes restaurar cualquier plan anterior
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={cargar}
            disabled={loading}
            className="h-8 gap-1 border-destructive/30 text-destructive"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Cargar
          </Button>
        </div>
      </div>

      {planes.length > 0 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por OT…"
            className="h-8 border-border bg-card pl-8 text-xs"
          />
        </div>
      )}

      <div className="max-h-[340px] overflow-y-auto text-xs">
        {!loading && planes.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">
            Haz clic en "Cargar" para ver todos los planes guardados.
          </div>
        )}
        {!loading && planes.length > 0 && planesVisibles.length === 0 && (
          <div className="py-3 text-center text-muted-foreground">
            No hay planes que coincidan con "{filtro}".
          </div>
        )}
        {planesVisibles.map((plan) => {
          const i = planes.findIndex((p) => p.id === plan.id);
          const fecha = plan.fecha
            ? new Date(plan.fecha).toLocaleString('es-CL')
            : '—';
          const esActivo = i === 0;
          const esRestauracion = plan.tipo === 'restauracion';
          const tieneSnap = plan.snapshot_inventario.length > 0;
          return (
            <div
              key={plan.id}
              className={cn(
                'flex flex-wrap items-center gap-2 py-2',
                esRestauracion
                  ? 'mb-1 rounded border border-purple-500/20 bg-accent/5 px-2'
                  : 'border-b border-border last:border-b-0',
              )}
            >
              <div className="min-w-[180px] flex-1">
                <span className="text-foreground">{fecha}</span>
                {plan.fecha_correccion && (
                  <span className="ml-2 text-[0.65rem] text-success">
                    (corregido por admin)
                  </span>
                )}
                {esActivo && (
                  <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[0.65rem] text-success">
                    ● Activo
                  </span>
                )}
                {esRestauracion && (
                  <span className="ml-2 rounded-full border border-purple-500/30 bg-accent/15 px-2 py-0.5 text-[0.65rem] text-accent">
                    ⏱ Restaurado
                  </span>
                )}
                {!esRestauracion && tieneSnap && (
                  <span
                    className="ml-2 text-[0.65rem] text-accent"
                    title="Tiene snapshot — puede restaurar colmena completa"
                  >
                    <Camera className="inline h-3 w-3" />
                  </span>
                )}
                {!esRestauracion && !tieneSnap && i > 0 && (
                  <span
                    className="ml-2 text-[0.65rem] text-muted-foreground"
                    title="Sin snapshot"
                  >
                    <AlertTriangle className="inline h-3 w-3" />
                  </span>
                )}
                <div className="text-[0.68rem] text-muted-foreground">
                  {plan.nCortes} corte(s)
                  {plan.optimizer_email && (
                    <span className="text-warning"> · {plan.optimizer_email}</span>
                  )}
                </div>
                {(() => {
                  const ots = extraerOTsPlan(plan);
                  if (ots.length === 0) return null;
                  return (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ots.slice(0, 6).map((ot) => (
                        <span
                          key={ot}
                          className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[0.65rem] font-mono text-accent"
                        >
                          OT {ot}
                        </span>
                      ))}
                      {ots.length > 6 && (
                        <span
                          className="text-[0.65rem] text-muted-foreground"
                          title={ots.slice(6).map((o) => `OT ${o}`).join(', ')}
                        >
                          +{ots.length - 6}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-blue-500/30 px-2 text-[0.65rem] text-blue-300"
                  onClick={() => setPreview(plan)}
                >
                  <Eye className="h-3 w-3" />
                  Ver
                </Button>
                {i > 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestaurar(plan)}
                    disabled={restaurando || !tieneSnap}
                    title={
                      !tieneSnap
                        ? 'No se puede restaurar: este plan no tiene snapshot de colmena guardado'
                        : undefined
                    }
                    className={cn(
                      'h-6 gap-1 border-destructive/30 px-2 text-[0.65rem] text-destructive',
                      !tieneSnap && 'opacity-40',
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar
                  </Button>
                ) : (
                  <span className="self-center text-[0.65rem] text-success">
                    Plan vigente
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-destructive">
              <Eye className="mr-1 inline h-3.5 w-3.5" />
              Vista previa del plan
            </strong>
            <button
              onClick={() => setPreview(null)}
              className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-2 text-[0.68rem] text-muted-foreground">
            Plan del{' '}
            {preview.fecha ? new Date(preview.fecha).toLocaleString('es-CL') : '—'}
          </div>
          {preview.resultados.length === 0 ? (
            <div className="text-muted-foreground">Sin cortes en este plan.</div>
          ) : (
            <div className="max-h-[220px] overflow-y-auto text-[0.7rem]">
              <table className="w-full">
                <thead className="sticky top-0 bg-card text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-1.5 text-left">#</th>
                    <th className="p-1.5 text-left">OT / Ubic.</th>
                    <th className="p-1.5 text-left">Código tubo</th>
                    <th className="p-1.5 text-left">Medida (cm)</th>
                    <th className="p-1.5 text-left">Colmena</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.resultados.map((item, i) => {
                    const res = item.resultado || {};
                    const ord = item.orden || {};
                    const codigo =
                      res.codigo || res.codigo_original || ord.cod || '—';
                    const medida =
                      res.medida_cm !== undefined
                        ? Number(res.medida_cm).toFixed(1) + ' cm'
                        : '—';
                    const colmena = res.colmena ? String(res.colmena) : '—';
                    const otUbic =
                      [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="p-1.5 text-muted-foreground">{i + 1}</td>
                        <td className="p-1.5">{otUbic}</td>
                        <td className="p-1.5 font-mono">{codigo}</td>
                        <td className="p-1.5 font-semibold">{medida}</td>
                        <td className="p-1.5">{colmena}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => onRestaurar(preview)}
              disabled={restaurando}
              className="gap-1 bg-destructive hover:bg-destructive"
            >
              {restaurando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Restaurar este plan como activo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
