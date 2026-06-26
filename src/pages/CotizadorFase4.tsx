import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Factory,
  FileDown,
  Loader2,
  Printer,
  Scissors,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useOT } from '@/modules/ots/hooks';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { SUB_ETAPAS_PROD, calcularPorcentaje, colorProgreso } from '@/modules/ots/constants';
import { SUB_ETAPA_META } from '@/modules/cotizador/fase4';
import { formatCLP } from '@/modules/cotizador/calculos';
import {
  asignarJuntoEnOrden,
  buildOptimizerRows,
  restorePlanGuardado,
} from '@/modules/cotizador/tela';
import { bomToOrdenMaterialesRows, calcularBOM } from '@/modules/cotizador/bom';
import { INVENTARIO_VACIO, type InventarioEstado } from '@/modules/cotizador/inventario';
import { InventarioSheet } from '@/components/cotizador/InventarioSheet';
import {
  generarEtiquetasPDF,
  validarDatosParaEtiquetas,
} from '@/modules/cotizador/pdfProduccion';
import { generarPdfHojaCorte } from '@/modules/cotizador/pdfCorteOptimizacion';
import { generarPdfCalculoGeneral } from '@/modules/cotizador/pdfCalculoGeneral';
import { generarPdfInventario } from '@/modules/cotizador/pdfInventario';
import { generarPlanCorte, rowToPano, type ColmenaPanoRow } from '@/modules/cotizador/planCorte';
import { deduccionesColmena } from '@/modules/cotizador/colmenaCorte';
import type { SubEtapaProd } from '@/modules/ots/types';
import type { Ventana as VentanaCotizador } from '@/modules/cotizador/types';
import { descargarExcelOrdenes } from '@/modules/descuentos/excel-ordenes';
import { confirmar } from '@/components/ui/confirm';

export function CotizadorFase4() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { empresaId, empresaNombre } = useAuth();
  const [avanzando, setAvanzando] = useState(false);
  const [cambiandoSub, setCambiandoSub] = useState(false);
  const [inventario, setInventario] = useState<InventarioEstado | null>(null);
  const [invDirty, setInvDirty] = useState(false);
  const [invSaving, setInvSaving] = useState(false);

  const pdfRows = useMemo(() => {
    if (!ot || loadingCat) return null;
    const fresh = buildOptimizerRows(ot.storeVentanas, catalogo);
    if (fresh.length === 0) return [];
    const guardado = ot.datosGenerales?.optimizerRows;
    const restored = restorePlanGuardado(fresh, guardado);
    const tieneJunto = restored.some((r) => r.junto && r.junto !== '' && r.junto !== '?');
    return tieneJunto ? restored : asignarJuntoEnOrden(restored);
  }, [ot, loadingCat, catalogo]);

  // Componentes consolidados (siempre frescos desde el optimizador).
  // El ajuste manual se hace con la columna "Adicional" de la hoja.
  const invItems = useMemo(
    () => (pdfRows && ot ? calcularBOM(pdfRows, ot.storeVentanas) : []),
    [pdfRows, ot?.storeVentanas],
  );

  // Inicializar estado de entrega del inventario desde lo guardado en la OT.
  useEffect(() => {
    if (!ot || inventario !== null) return;
    setInventario(ot.datosGenerales?.inventario || INVENTARIO_VACIO);
  }, [ot, inventario]);

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
    if (!(await confirmar({ titulo: 'Marcar como lista', mensaje: '¿Marcar esta OT como lista para entrega?', confirmLabel: 'Marcar lista' }))) return;
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
    empresa: empresaNombre ?? undefined,
  });

  const onGenerarPDF = () => {
    if (!ot || (ot.storeVentanas || []).length === 0) {
      toast.error('No hay ventanas en la OT.');
      return;
    }
    try {
      const ventanas = (ot.storeVentanas || []) as unknown as VentanaCotizador[];
      generarPdfInventario(ventanas, catalogo, {
        ot: ot.datosGenerales.ot || String(ot.id),
        cliente: ot.datosGenerales.cliente || undefined,
        empresa: empresaNombre ?? undefined,
      });
      toast.success('Hoja de inventario generada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error generando inventario: ' + msg);
    }
  };

  const onExcelOrdenes = () => {
    if (!ot) return;
    try {
      const ventanas = (ot.storeVentanas || []) as unknown as VentanaCotizador[];
      const res = descargarExcelOrdenes(ot.datosGenerales.ot || '—', ventanas, {
        adicionalesFase0: ot.datosGenerales.adicionalesFase0,
      });
      if (res.advertencias.length > 0) {
        toast.warning(
          `Excel generado (${res.filas} cortes) con ${res.advertencias.length} advertencia(s): ` +
            res.advertencias[0],
        );
      } else {
        toast.success(`Excel de órdenes generado: ${res.filas} cortes con despiece calculado.`);
      }
    } catch (e) {
      toast.error('Error generando Excel: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onCalculoGeneral = () => {
    if (!ot || (ot.storeVentanas || []).length === 0) {
      toast.error('No hay ventanas en la OT.');
      return;
    }
    try {
      const ventanas = (ot.storeVentanas || []) as unknown as VentanaCotizador[];
      generarPdfCalculoGeneral(ventanas, catalogo, {
        ot: ot.datosGenerales.ot || String(ot.id),
        cliente: ot.datosGenerales.cliente || undefined,
      });
      toast.success('Cálculo general generado');
    } catch (e) {
      toast.error('Error generando cálculo general: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const onImprimirEtiquetas = async () => {
    if (!pdfRows || pdfRows.length === 0) {
      toast.error('No hay paños. Agrega ventanas en Fase 2 primero.');
      return;
    }
    const faltantes = validarDatosParaEtiquetas(pdfRows);
    if (faltantes.length > 0) {
      const continuar = await confirmar(
        'Faltan campos importantes para etiquetas detalladas:\n\n' +
          faltantes.join('\n') +
          '\n\n¿Deseas imprimir de todos modos con los datos disponibles?',
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

  const [corteLoading, setCorteLoading] = useState(false);
  const onImprimirCorte = async () => {
    if (!pdfRows || pdfRows.length === 0) {
      toast.error('No hay paños. Agrega ventanas en Fase 2 primero.');
      return;
    }
    if (!ot || !empresaId) return;
    setCorteLoading(true);
    try {
      // Sobrantes de colmena disponibles (igual que el Plan de Corte) para
      // saber qué pieza sale de qué sobrante.
      const { data: panosData } = await supabase
        .from('colmena_panos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('disponible', true);
      const colmenaPanos = ((panosData || []) as ColmenaPanoRow[]).map(rowToPano);
      generarPdfHojaCorte(pdfRows, colmenaPanos, ot, {
        ot: ot.datosGenerales.ot || String(ot.id),
        cliente: ot.datosGenerales.cliente || '',
        empresa: empresaNombre ?? undefined,
      });
      toast.success('Hoja de corte generada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error generando hoja de corte: ' + msg);
    } finally {
      setCorteLoading(false);
    }
  };

  // ── Confirmar corte general: descuenta de la colmena los paños usados ──
  // Se hace UNA sola vez (antes de pasar a dimensionado). Aplica el mismo plan
  // que la Hoja de corte: cada sobrante usado se achica al retazo o se marca
  // como Usado. Guard de idempotencia en datosGenerales.corteGeneralColmena.
  const [corteGenLoading, setCorteGenLoading] = useState(false);
  const corteGenConfirmado = ot?.datosGenerales?.corteGeneralColmena;

  const onConfirmarCorteGeneral = async () => {
    if (!ot || !empresaId) return;
    if (corteGenConfirmado) {
      toast.info(
        `El corte general ya se confirmó el ${corteGenConfirmado.confirmadoEn.split('T')[0]}.`,
      );
      return;
    }
    setCorteGenLoading(true);
    try {
      const { data: panosData } = await supabase
        .from('colmena_panos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('disponible', true);
      const panos = ((panosData || []) as ColmenaPanoRow[]).map(rowToPano);
      const plan = generarPlanCorte([ot], panos);
      const deducciones = deduccionesColmena(plan);
      if (deducciones.length === 0) {
        toast.info('Este corte no usa paños de la colmena (todo sale de rollo).');
        return;
      }
      const retazos = deducciones.filter((d) => d.accion === 'retazo').length;
      const usados = deducciones.filter((d) => d.accion === 'usado').length;
      const ok = await confirmar({
        titulo: 'Confirmar corte general',
        mensaje:
          `Se descontarán ${deducciones.length} paño(s) de la colmena:\n` +
          `· ${retazos} quedan como retazo (medida nueva, misma ubicación)\n` +
          `· ${usados} se marcan como usados\n\n` +
          'Esto actualiza el inventario y no debería repetirse.',
        confirmLabel: 'Confirmar y descontar',
        destructivo: true,
      });
      if (!ok) return;
      const otNum = ot.datosGenerales.ot || String(ot.id);
      const now = new Date().toISOString();
      const aplicadas = await Promise.all(
        deducciones.map(async (d) => {
          const res =
            d.accion === 'retazo'
              ? await supabase
                  .from('colmena_panos')
                  .update({ medida_ancho: d.nuevoAncho, medida_alto: d.nuevoAlto, disponible: true })
                  .eq('id', d.docId)
              : await supabase
                  .from('colmena_panos')
                  .update({ disponible: false, ot_asignada: otNum, fecha_uso: now })
                  .eq('id', d.docId);
          return { ...d, error: res.error ? res.error.message : undefined };
        }),
      );
      const fallidas = aplicadas.filter((d) => d.error);
      // Persistir el snapshot SIEMPRE (aunque haya fallos parciales) para no
      // re-descontar en un reintento.
      await guardar({
        datosGenerales: {
          ...(ot.datosGenerales || {}),
          corteGeneralColmena: { confirmadoEn: now, panos: aplicadas },
        },
      });
      if (fallidas.length) {
        toast.error(
          `Corte confirmado, pero ${fallidas.length} paño(s) no se actualizaron ` +
            `(${fallidas.map((d) => d.cod).join(', ')}). Revisalos en Ojo de Dios → Colmena.`,
        );
      } else {
        toast.success(`Colmena descontada: ${retazos} retazo(s), ${usados} usado(s).`);
      }
    } catch (e) {
      toast.error('Error al confirmar corte general: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCorteGenLoading(false);
    }
  };

  // ── Inventario: handlers ──────────────────────────────────────────
  const onInventarioChange = (estado: InventarioEstado) => {
    setInventario(estado);
    setInvDirty(true);
  };

  const guardarInventario = async () => {
    if (!ot || !inventario || !empresaId) return;
    setInvSaving(true);
    try {
      const ahora = new Date().toISOString();
      const dg = {
        ...(ot.datosGenerales || {}),
        inventario,
        inventarioFecha: ahora,
        // El BOM guardado sigue alimentando Bodeguero
        bom: invItems,
        bomFecha: ahora,
      };
      await guardar({ datosGenerales: dg });

      // Sincronizar orden_materiales (lo consume Bodeguero)
      const rows = bomToOrdenMaterialesRows(invItems, empresaId, ot.id);
      const { error: delErr } = await supabase
        .from('orden_materiales')
        .delete()
        .eq('empresa_id', empresaId)
        .eq('ot_id', ot.id);
      if (delErr && delErr.code !== '42P01') {
        console.warn('[Inventario] Error borrando orden_materiales:', delErr.message);
      }
      if (!delErr || delErr.code !== '42P01') {
        const { error: insErr } = await supabase.from('orden_materiales').insert(rows);
        if (insErr) console.warn('[Inventario] Error insertando orden_materiales:', insErr.message);
      }

      setInvDirty(false);
      toast.success('Hoja de inventario guardada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error guardando inventario: ' + msg);
    } finally {
      setInvSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
      </div>
    );
  }
  if (!ot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>OT no encontrada.</p>
        <Link to="/panel" className="text-sm text-accent hover:underline">
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
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/panel')}
            className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            title="Volver al Panel"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Factory className="h-4 w-4 text-blue-300" />
              Fase 4 — Producción
            </h2>
            <p className="text-xs text-muted-foreground">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'} ·
              estado: <span className="text-foreground">{ot.estado}</span>
            </p>
          </div>
        </div>
        {readOnly && (
          <span className="rounded-full border border-border bg-card px-2 py-1 text-[0.7rem] text-muted-foreground">
            Solo lectura (la OT está en {ot.estado})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {/* Sub-etapas tracker */}
        <div className="mb-4 rounded-lg border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Sub-etapas de producción</span>
            <span className="text-xs text-muted-foreground">
              Avance: <span style={{ color: barColor }}>{pct}%</span>
            </span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-card">
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

        {/* Hoja de inventario (entrega y recepción de material) */}
        {inventario && (
          <InventarioSheet
            ot={ot}
            items={invItems}
            estado={inventario}
            onChange={onInventarioChange}
            readOnly={readOnly}
            empresaNombre={empresaNombre}
            dirty={invDirty}
            guardando={invSaving}
            onGuardar={guardarInventario}
          />
        )}

        {/* Integraciones */}
        <div className="mb-4 rounded-lg border border-blue-500/20 bg-accent/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Scissors className="h-4 w-4 text-blue-300" />
            <span className="text-sm font-medium text-blue-200">
              Optimización, PDF de producción y etiquetas
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Todo corre en React. El plan de corte desde colmena queda en legacy (Fase 6 pendiente).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={abrirTelaReact}
              className="gap-1.5 bg-accent hover:bg-accent"
            >
              <Scissors className="h-3.5 w-3.5" />
              Abrir Tela (optimizador)
            </Button>
            <Button
              size="sm"
              onClick={onGenerarPDF}
              disabled={!pdfRows || pdfRows.length === 0}
              className="gap-1.5 bg-accent hover:bg-accent"
            >
              <FileDown className="h-3.5 w-3.5" />
              Generar PDF Producción
            </Button>
            <Button
              size="sm"
              onClick={onImprimirEtiquetas}
              disabled={!pdfRows || pdfRows.length === 0}
              className="gap-1.5 bg-success hover:bg-success/90"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir etiquetas
            </Button>
            <Button
              size="sm"
              onClick={onImprimirCorte}
              disabled={!pdfRows || pdfRows.length === 0 || corteLoading}
              variant="outline"
              className="gap-1.5"
              title="Hoja de corte / optimización de telas (PDF para imprimir)"
            >
              {corteLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="h-3.5 w-3.5" />
              )}
              Imprimir corte
            </Button>
            <Button
              size="sm"
              onClick={onConfirmarCorteGeneral}
              disabled={
                !pdfRows || pdfRows.length === 0 || corteGenLoading || !!corteGenConfirmado
              }
              className="gap-1.5 bg-warning text-warning-foreground hover:bg-warning/90 disabled:opacity-60"
              title="Descuenta de la colmena los paños usados en este corte (retazo o usado). Hacerlo UNA vez, antes de pasar a dimensionado."
            >
              {corteGenLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {corteGenConfirmado ? 'Colmena descontada ✓' : 'Confirmar corte general'}
            </Button>
            <Button
              size="sm"
              onClick={onExcelOrdenes}
              disabled={!ot || (ot.storeVentanas || []).length === 0}
              variant="outline"
              className="gap-1.5"
              title="Excel con medidas de corte calculadas (tubo/peso/cenefas) para cargar en el Optimizador"
            >
              <FileDown className="h-3.5 w-3.5" />
              Excel órdenes (optimizador)
            </Button>
            <Button
              size="sm"
              onClick={onCalculoGeneral}
              disabled={!ot || (ot.storeVentanas || []).length === 0}
              variant="outline"
              className="gap-1.5"
              title="Hoja maestra con todo el despiece por cortina, agrupado por sistema (PDF)"
            >
              <FileDown className="h-3.5 w-3.5" />
              Cálculo general
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
              className="gap-1 bg-accent hover:bg-accent"
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
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-[0.68rem] text-muted-foreground">{hint}</div>}
    </div>
  );
}

