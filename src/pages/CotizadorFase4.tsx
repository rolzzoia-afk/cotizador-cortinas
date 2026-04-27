import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Factory,
  FileDown,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Scissors,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useOT } from '@/modules/ots/hooks';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { SUB_ETAPAS_PROD, calcularPorcentaje, colorProgreso } from '@/modules/ots/constants';
import { SUB_ETAPA_META, colorCategoria } from '@/modules/cotizador/fase4';
import { formatCLP } from '@/modules/cotizador/calculos';
import {
  asignarJuntoEnOrden,
  buildOptimizerRows,
  restorePlanGuardado,
} from '@/modules/cotizador/tela';
import { bomToOrdenMaterialesRows, calcularBOM } from '@/modules/cotizador/bom';
import {
  generarEtiquetasPDF,
  generarPDFProduccion,
  validarDatosParaEtiquetas,
} from '@/modules/cotizador/pdfProduccion';
import type { BomItem, SubEtapaProd } from '@/modules/ots/types';

type BomEstado = 'guardado' | 'pendiente' | 'guardando';

export function CotizadorFase4() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { empresaId } = useAuth();
  const [avanzando, setAvanzando] = useState(false);
  const [cambiandoSub, setCambiandoSub] = useState(false);
  const [bomItems, setBomItems] = useState<BomItem[] | null>(null);
  const [bomEstado, setBomEstado] = useState<BomEstado>('guardado');
  const [bomSaving, setBomSaving] = useState(false);

  const pdfRows = useMemo(() => {
    if (!ot || loadingCat) return null;
    const fresh = buildOptimizerRows(ot.storeVentanas, catalogo);
    if (fresh.length === 0) return [];
    const guardado = ot.datosGenerales?.optimizerRows;
    const restored = restorePlanGuardado(fresh, guardado);
    const tieneJunto = restored.some((r) => r.junto && r.junto !== '' && r.junto !== '?');
    return tieneJunto ? restored : asignarJuntoEnOrden(restored);
  }, [ot, loadingCat, catalogo]);

  // Inicializar BOM: usa lo guardado en la OT si existe, si no calcula desde pdfRows
  useEffect(() => {
    if (!ot || bomItems !== null) return;
    const saved = ot.datosGenerales?.bom;
    if (saved && saved.length > 0) {
      setBomItems(saved);
      setBomEstado('guardado');
    } else if (pdfRows && pdfRows.length > 0) {
      setBomItems(calcularBOM(pdfRows));
      setBomEstado('pendiente');
    }
  }, [ot, pdfRows, bomItems]);

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
      navigate('/panel');
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

  const metaPDF = () => ({
    ot: ot?.datosGenerales.ot || '—',
    cliente: ot?.datosGenerales.cliente || '—',
    fecha: new Date().toISOString().split('T')[0],
  });

  const onGenerarPDF = () => {
    if (!pdfRows || pdfRows.length === 0) {
      toast.error('No hay paños. Agregá ventanas en Fase 2 primero.');
      return;
    }
    try {
      generarPDFProduccion(pdfRows, metaPDF(), catalogo);
      toast.success('PDF de Producción generado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error generando PDF: ' + msg);
    }
  };

  const onImprimirEtiquetas = () => {
    if (!pdfRows || pdfRows.length === 0) {
      toast.error('No hay paños. Agregá ventanas en Fase 2 primero.');
      return;
    }
    const faltantes = validarDatosParaEtiquetas(pdfRows);
    if (faltantes.length > 0) {
      const continuar = confirm(
        'Faltan campos importantes para etiquetas detalladas:\n\n' +
          faltantes.join('\n') +
          '\n\n¿Querés imprimir de todos modos con los datos disponibles?',
      );
      if (!continuar) return;
    }
    try {
      generarEtiquetasPDF(pdfRows, metaPDF(), catalogo);
      toast.success('Etiquetas generadas');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error generando etiquetas: ' + msg);
    }
  };

  // ── BOM: handlers ──────────────────────────────────────────
  const setBomField = (idx: number, field: keyof BomItem, value: string | number) => {
    setBomItems((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setBomEstado('pendiente');
  };

  const addBomRow = () => {
    setBomItems((prev) => [
      ...(prev || []),
      {
        categoria: 'OTRO',
        descripcion: 'Nuevo ítem',
        especificacion: '',
        color: '',
        cantidad: 1,
        unidad: 'unid.',
      },
    ]);
    setBomEstado('pendiente');
  };

  const removeBomRow = (idx: number) => {
    setBomItems((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
    setBomEstado('pendiente');
  };

  const recomputarBom = () => {
    if (!pdfRows || pdfRows.length === 0) {
      toast.error('No hay paños en el optimizador para recalcular.');
      return;
    }
    if (bomItems && bomItems.length > 0) {
      if (!confirm('Esto sobrescribe el BOM actual con uno fresco desde el optimizador. ¿Continuar?'))
        return;
    }
    setBomItems(calcularBOM(pdfRows));
    setBomEstado('pendiente');
    toast.success('BOM recalculado desde el optimizador');
  };

  const guardarBom = async () => {
    if (!ot || !bomItems || !empresaId) return;
    setBomSaving(true);
    setBomEstado('guardando');
    try {
      const dg = {
        ...(ot.datosGenerales || {}),
        bom: bomItems,
        bomFecha: new Date().toISOString(),
      };
      await guardar({ datosGenerales: dg });

      // Sincronizar orden_materiales (lo consume Bodeguero)
      const rows = bomToOrdenMaterialesRows(bomItems, empresaId, ot.id);
      const { error: delErr } = await supabase
        .from('orden_materiales')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('ot_id', ot.id);
      if (delErr && delErr.code !== '42P01') {
        console.warn('[BOM] Error borrando orden_materiales:', delErr.message);
      }
      if (!delErr || delErr.code !== '42P01') {
        const { error: insErr } = await supabase.from('orden_materiales').insert(rows);
        if (insErr) console.warn('[BOM] Error insertando orden_materiales:', insErr.message);
      }

      setBomEstado('guardado');
      toast.success('BOM guardado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error guardando BOM: ' + msg);
      setBomEstado('pendiente');
    } finally {
      setBomSaving(false);
    }
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
        <Link to="/panel" className="text-sm text-indigo-300 hover:underline">
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
            onClick={() => navigate('/panel')}
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

        {/* BOM editable */}
        <div className="mb-4 rounded-lg border border-white/10 bg-zinc-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-medium text-zinc-200">Lista de materiales (BOM)</span>
              {ot.datosGenerales.bomFecha && (
                <span className="text-[0.68rem] text-zinc-500">
                  · Guardado {new Date(ot.datosGenerales.bomFecha).toLocaleString('es-CL')}
                </span>
              )}
              <BomEstadoBadge estado={bomEstado} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={recomputarBom}
                disabled={!pdfRows || pdfRows.length === 0 || readOnly}
                className="h-7 gap-1 text-[0.7rem]"
                title="Recalcula desde optimizador (sobrescribe)"
              >
                <RefreshCw className="h-3 w-3" />
                Recalcular
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={addBomRow}
                disabled={readOnly}
                className="h-7 gap-1 text-[0.7rem]"
              >
                <Plus className="h-3 w-3" />
                Agregar fila
              </Button>
              <Button
                size="sm"
                onClick={guardarBom}
                disabled={!bomItems || bomSaving || bomEstado === 'guardado' || readOnly}
                className="h-7 gap-1 bg-emerald-600 text-[0.7rem] hover:bg-emerald-500"
              >
                {bomSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Guardar BOM
              </Button>
            </div>
          </div>
          {!bomItems ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Cargando BOM…
            </div>
          ) : bomItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No hay materiales. Completá los paños en Fase 2 o presioná <em>Recalcular</em>.
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
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {bomItems.map((it, idx) => (
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
                      <td className="p-2">
                        <Input
                          value={it.descripcion}
                          onChange={(e) => setBomField(idx, 'descripcion', e.target.value)}
                          disabled={readOnly}
                          className="h-6 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={it.especificacion || ''}
                          onChange={(e) => setBomField(idx, 'especificacion', e.target.value)}
                          disabled={readOnly}
                          className="h-6 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={it.color || ''}
                          onChange={(e) => setBomField(idx, 'color', e.target.value)}
                          disabled={readOnly}
                          className="h-6 text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) =>
                            setBomField(idx, 'cantidad', parseFloat(e.target.value) || 0)
                          }
                          disabled={readOnly}
                          min={0}
                          step={1}
                          className="h-6 w-16 text-right text-xs"
                        />
                      </td>
                      <td className="p-2 text-zinc-500">{it.unidad}</td>
                      <td className="p-2">
                        <button
                          onClick={() => removeBomRow(idx)}
                          disabled={readOnly}
                          className="text-red-400 opacity-50 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20"
                          title="Eliminar fila"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </td>
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
            <span className="text-sm font-medium text-blue-200">
              Optimización, PDF de producción y etiquetas
            </span>
          </div>
          <p className="mb-3 text-xs text-zinc-400">
            Todo corre en React. El plan de corte desde colmena queda en legacy (Fase 6 pendiente).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={abrirTelaReact}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500"
            >
              <Scissors className="h-3.5 w-3.5" />
              Abrir Tela (optimizador)
            </Button>
            <Button
              size="sm"
              onClick={onGenerarPDF}
              disabled={!pdfRows || pdfRows.length === 0}
              className="gap-1.5 bg-purple-600 hover:bg-purple-500"
            >
              <FileDown className="h-3.5 w-3.5" />
              Generar PDF Producción
            </Button>
            <Button
              size="sm"
              onClick={onImprimirEtiquetas}
              disabled={!pdfRows || pdfRows.length === 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir etiquetas
            </Button>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/panel')}>
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

function BomEstadoBadge({ estado }: { estado: BomEstado }) {
  const cfg = {
    guardado: { label: '✓ Guardado', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    pendiente: { label: 'Sin guardar', bg: 'rgba(245,158,11,0.2)', color: '#f59e0b' },
    guardando: { label: 'Guardando…', bg: 'rgba(124,117,240,0.15)', color: '#a78bfa' },
  }[estado];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
