import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Factory,
  Loader2,
  Package,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOT } from '@/modules/ots/hooks';
import { SUB_ETAPAS_PROD, calcularPorcentaje, colorProgreso } from '@/modules/ots/constants';
import { SUB_ETAPA_META, colorCategoria } from '@/modules/cotizador/fase4';
import { formatCLP } from '@/modules/cotizador/calculos';
import type { SubEtapaProd } from '@/modules/ots/types';

export function CotizadorFase4() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const [avanzando, setAvanzando] = useState(false);
  const [cambiandoSub, setCambiandoSub] = useState(false);

  const bom = useMemo(() => ot?.datosGenerales?.bom || [], [ot]);

  const cambiarSubEtapa = async (sub: SubEtapaProd) => {
    if (!ot || cambiandoSub) return;
    if (ot.subEtapa === sub) return;
    setCambiandoSub(true);
    try {
      await guardar({ subEtapa: sub });
      toast.success(`Sub-etapa: ${sub}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al cambiar sub-etapa: ' + msg);
    } finally {
      setCambiandoSub(false);
    }
  };

  const marcarComoLista = async () => {
    if (!ot) return;
    if (!confirm('¿Marcar esta OT como lista para entrega?')) return;
    setAvanzando(true);
    try {
      const dg = {
        ...(ot.datosGenerales || {}),
        historialEstados: [
          ...(ot.datosGenerales?.historialEstados || []),
          { de: ot.estado, a: 'lista' as const, fecha: new Date().toISOString() },
        ],
      };
      await guardar({
        estado: 'lista',
        subEtapa: null,
        datosGenerales: dg,
      });
      toast.success('OT marcada como lista');
      navigate('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al avanzar: ' + msg);
    } finally {
      setAvanzando(false);
    }
  };

  const abrirTelaReact = () => {
    if (!ot) return;
    navigate(`/ots/${ot.id}/tela`);
  };

  const abrirFase4Legacy = () => {
    if (!ot) return;
    localStorage.setItem('activeOTId', ot.id);
    localStorage.setItem('rolzzo_goto_tab', 'fase4-tab');
    navigate('/cotizador');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
      </div>
    );
  }
  if (!ot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <p>OT no encontrada.</p>
        <Link to="/" className="text-sm text-indigo-300 hover:underline">
          Volver al Panel
        </Link>
      </div>
    );
  }

  const readOnly = ot.estado !== 'produccion';
  const pct = calcularPorcentaje(ot.estado, ot.subEtapa);
  const barColor = colorProgreso(pct);
  const ventanasCount = (ot.storeVentanas || []).length;
  const totalPanos = (ot.storeVentanas || []).reduce(
    (acc, v) => acc + ((v.panos as unknown[] | undefined)?.length || 0),
    0,
  );

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            title="Volver al Panel"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Factory className="h-4 w-4 text-blue-300" />
              Fase 4 — Producción
            </h2>
            <p className="text-xs text-zinc-500">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'} ·
              estado: <span className="text-zinc-300">{ot.estado}</span>
            </p>
          </div>
        </div>
        {readOnly && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.7rem] text-zinc-400">
            Solo lectura (la OT está en {ot.estado})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {/* Sub-etapas tracker */}
        <div className="mb-4 rounded-lg border border-white/10 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">Sub-etapas de producción</span>
            <span className="text-xs text-zinc-400">
              Avance: <span style={{ color: barColor }}>{pct}%</span>
            </span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SUB_ETAPAS_PROD.map((sub) => {
              const meta = SUB_ETAPA_META[sub];
              const ordenActual = ot.subEtapa ? SUB_ETAPA_META[ot.subEtapa].orden : 0;
              const esActual = ot.subEtapa === sub;
              const yaPasado = meta.orden < ordenActual;
              return (
                <button
                  key={sub}
                  disabled={readOnly || cambiandoSub}
                  onClick={() => cambiarSubEtapa(sub)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    !readOnly && !esActual && 'hover:brightness-125',
                  )}
                  style={{
                    borderColor: esActual ? meta.color : yaPasado ? meta.border : 'rgba(255,255,255,0.1)',
                    backgroundColor: esActual ? meta.bg : yaPasado ? 'rgba(255,255,255,0.03)' : 'transparent',
                    color: esActual ? meta.color : yaPasado ? '#a1a1aa' : '#71717a',
                  }}
                >
                  {yaPasado && <CheckCircle2 className="h-3 w-3" />}
                  <span className="text-[0.65rem] opacity-70">{meta.orden}.</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Resumen de la OT */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card label="Ventanas" value={String(ventanasCount)} hint="en esta OT" />
          <Card label="Paños totales" value={String(totalPanos)} hint="suma de paños" />
          <Card
            label="Total c/IVA"
            value={formatCLP(ot.totalConIva || 0)}
            hint={ot.datosGenerales.fechaEntrega ? `Entrega: ${ot.datosGenerales.fechaEntrega}` : '—'}
          />
        </div>

        {/* BOM read-only */}
        <div className="mb-4 rounded-lg border border-white/10 bg-zinc-900/40">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-medium text-zinc-200">Lista de materiales (BOM)</span>
              {ot.datosGenerales.bomFecha && (
                <span className="text-[0.68rem] text-zinc-500">
                  · Guardado {new Date(ot.datosGenerales.bomFecha).toLocaleString('es-CL')}
                </span>
              )}
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.68rem] text-zinc-400">
              Solo lectura — se edita en tab Tela legacy
            </span>
          </div>
          {bom.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No hay BOM generado todavía. Abrí <strong className="text-zinc-300">Tab Tela (legacy)</strong> y presioná{' '}
              <em>Guardar BOM</em> para persistirla.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900 text-[0.68rem] uppercase tracking-wide text-zinc-400">
                  <tr>
                    <th className="w-8 p-2 text-left">#</th>
                    <th className="p-2 text-left">Categoría</th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="p-2 text-left">Especificación</th>
                    <th className="p-2 text-left">Color</th>
                    <th className="p-2 text-right">Cantidad</th>
                    <th className="p-2 text-left">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((it, idx) => (
                    <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                      <td className="p-2 text-zinc-500">{idx + 1}</td>
                      <td className="p-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
                          style={{
                            backgroundColor: colorCategoria(it.categoria) + '22',
                            color: colorCategoria(it.categoria),
                          }}
                        >
                          {it.categoria}
                        </span>
                      </td>
                      <td className="p-2 text-zinc-200">{it.descripcion}</td>
                      <td className="p-2 text-zinc-400">{it.especificacion || '—'}</td>
                      <td className="p-2 text-zinc-400">{it.color || '—'}</td>
                      <td className="p-2 text-right font-semibold text-emerald-300">
                        {it.cantidad}
                      </td>
                      <td className="p-2 text-zinc-500">{it.unidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Integraciones */}
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-200">Optimización de paños y plan de corte</span>
          </div>
          <p className="mb-3 text-xs text-zinc-400">
            El optimizador de paños está en React. El BOM/etiquetas/PDF siguen en legacy hasta Fase 6.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={abrirTelaReact}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500"
            >
              <Scissors className="h-3.5 w-3.5" />
              Abrir Tela (optimizador de paños)
            </Button>
            <Button variant="outline" size="sm" onClick={abrirFase4Legacy} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir Fase 4 legacy (BOM + etiquetas + PDF)
            </Button>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/')}>
              Volver al Panel
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/ots/${ot.id}/fase3`)}
              className="gap-1"
            >
              Ver cotización (Fase 3)
            </Button>
          </div>
          {!readOnly && (
            <Button
              onClick={marcarComoLista}
              disabled={avanzando}
              className="gap-1 bg-purple-600 hover:bg-purple-500"
            >
              {avanzando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Marcar como lista para entrega
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
      <div className="text-[0.68rem] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{value}</div>
      {hint && <div className="mt-1 text-[0.68rem] text-zinc-500">{hint}</div>}
    </div>
  );
}
