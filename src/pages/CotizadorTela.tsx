import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownCircle,
  ExternalLink,
  Factory,
  Loader2,
  Save,
  Scissors,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOT } from '@/modules/ots/hooks';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import {
  asignarJuntoEnOrden,
  autoOptimizar,
  buildOptimizerRows,
  calcularPanos,
  restorePlanGuardado,
  type OptimizerRow,
} from '@/modules/cotizador/tela';
import type { Ventana } from '@/modules/cotizador/types';

export function CotizadorTela() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const [rows, setRows] = useState<OptimizerRow[] | null>(null);
  const [saving, setSaving] = useState(false);

  const ventanas: Ventana[] = useMemo(
    () => ((ot?.storeVentanas || []) as unknown as Ventana[]),
    [ot],
  );

  const cargar = useMemo(
    () => () => {
      if (!ot || loadingCat) return;
      const fresh = buildOptimizerRows(ot.storeVentanas, catalogo);
      const guardado = ot.datosGenerales?.optimizerRows;
      const restored = restorePlanGuardado(fresh, guardado);
      const tieneJunto = restored.some((r) => r.junto && r.junto !== '' && r.junto !== '?');
      setRows(tieneJunto ? restored : asignarJuntoEnOrden(restored));
    },
    [ot, loadingCat, catalogo],
  );

  // Auto-cargar cuando hay OT y catálogo listos
  useEffect(() => {
    if (ot && !loadingCat && rows === null) {
      cargar();
    }
  }, [ot, loadingCat, rows, cargar]);

  const onAutoOptimizar = () => {
    if (!rows) return;
    setRows(autoOptimizar(rows));
    toast.success('Plan auto-optimizado');
  };

  const onGuardar = async () => {
    if (!ot || !rows) return;
    setSaving(true);
    try {
      const dg = {
        ...(ot.datosGenerales || {}),
        optimizerRows: JSON.parse(JSON.stringify(rows)),
      };
      await guardar({ datosGenerales: dg });
      toast.success('Plan guardado en la OT');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const setRowField = (
    idx: number,
    field: 'anchoPano' | 'numeroPano' | 'junto',
    value: string,
  ) => {
    if (!rows) return;
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const r = { ...next[idx] };
      if (field === 'anchoPano') r.anchoPano = parseFloat(value) || 0;
      else if (field === 'numeroPano') r.numeroPano = parseInt(value) || 0;
      else r.junto = value;
      next[idx] = r;
      return next;
    });
  };

  const calculo = useMemo(() => (rows ? calcularPanos(rows) : null), [rows]);

  const abrirPlanCorteLegacy = () => {
    if (!ot) return;
    localStorage.setItem('activeOTId', ot.id);
    localStorage.setItem('rolzzo_goto_tab', 'tela-tab');
    navigate('/cotizador');
  };

  if (loading || loadingCat) {
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

  const sinVentanas = ventanas.length === 0;

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/ots/${ot.id}/fase4`)}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            title="Volver a Fase 4"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Scissors className="h-4 w-4 text-indigo-300" />
              Tela — Optimización de paños
            </h2>
            <p className="text-xs text-zinc-500">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={cargar} className="gap-1">
            <ArrowDownCircle className="h-3.5 w-3.5" />
            Recargar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={abrirPlanCorteLegacy}
            className="gap-1"
            title="Plan de Corte desde Colmena (legacy)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Plan de Corte (legacy)
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {sinVentanas ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
            La OT no tiene ventanas todavía. Completá Fase 2 primero.
          </div>
        ) : (
          <>
            {/* Optimizador */}
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-zinc-900/40">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <strong className="text-sm">Optimizador de Corte</strong>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={onAutoOptimizar}
                    disabled={!rows}
                    className="h-8 gap-1 bg-amber-600 hover:bg-amber-500"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-Optimizar
                  </Button>
                  <Button
                    size="sm"
                    onClick={onGuardar}
                    disabled={!rows || saving}
                    className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500"
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Guardar plan
                  </Button>
                </div>
              </div>
              <div className="max-h-[460px] overflow-auto">
                <table className="w-full text-[0.7rem]">
                  <thead className="sticky top-0 bg-zinc-900 text-[0.62rem] uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="p-1.5 text-left">Cod</th>
                      <th className="p-1.5 text-center">Cant</th>
                      <th className="p-1.5 text-left">Producto</th>
                      <th className="p-1.5 text-left">CodInt</th>
                      <th className="p-1.5 text-left">Tipo</th>
                      <th className="p-1.5 text-right">Ancho (m)</th>
                      <th className="p-1.5 text-right">Alto (m)</th>
                      <th className="p-1.5 text-right">Extra</th>
                      <th className="p-1.5 text-right">Alto+Extra</th>
                      <th className="p-1.5 text-right">Alto Real</th>
                      <th className="p-1.5 text-right">M²</th>
                      <th className="p-1.5 text-right">Ancho Rollo</th>
                      <th className="p-1.5 text-center">Ancho Paño</th>
                      <th className="p-1.5 text-center">N° Paño</th>
                      <th className="p-1.5 text-center">Junto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rows && (
                      <tr>
                        <td colSpan={15} className="p-4 text-center text-zinc-500">
                          Cargando filas...
                        </td>
                      </tr>
                    )}
                    {rows?.map((r, idx) => (
                      <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                        <td className="p-1.5 font-mono">{r.cod}</td>
                        <td className="p-1.5 text-center">{r.cant}</td>
                        <td className="max-w-[120px] truncate p-1.5" title={r.producto}>
                          {r.producto}
                        </td>
                        <td className="p-1.5 font-mono text-zinc-400">{r.codInt}</td>
                        <td className="p-1.5 text-zinc-400">{r.tipo}</td>
                        <td className="p-1.5 text-right">{r.ancho.toFixed(4)}</td>
                        <td className="p-1.5 text-right">{r.alto.toFixed(4)}</td>
                        <td className="p-1.5 text-right">{r.extra.toFixed(2)}</td>
                        <td className="p-1.5 text-right">{r.altoExtra.toFixed(4)}</td>
                        <td className="p-1.5 text-right">{r.altoReal.toFixed(4)}</td>
                        <td className="p-1.5 text-right">{r.m2.toFixed(4)}</td>
                        <td className="p-1.5 text-right text-zinc-400">
                          {r.anchoRollo.toFixed(2)}
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            value={r.anchoPano.toFixed(4)}
                            onChange={(e) => setRowField(idx, 'anchoPano', e.target.value)}
                            step="0.001"
                            className="h-6 w-20 text-[0.7rem]"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            value={r.numeroPano}
                            onChange={(e) => setRowField(idx, 'numeroPano', e.target.value)}
                            placeholder="1"
                            className="h-6 w-12 text-[0.7rem]"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            value={r.junto}
                            onChange={(e) => setRowField(idx, 'junto', e.target.value)}
                            placeholder="A"
                            maxLength={2}
                            className="h-6 w-10 text-center text-[0.7rem]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cálculo de paños — derivado */}
            {calculo && calculo.panos.length > 0 && (
              <div className="rounded-lg border border-purple-500/20 bg-zinc-900/40">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Factory className="h-3.5 w-3.5 text-purple-300" />
                    <strong className="text-sm">Cálculo de Paños (cortes de tela)</strong>
                  </div>
                  <span className="text-[0.68rem] text-zinc-400">
                    {calculo.totalPanos} paños · {calculo.totalM2.toFixed(2)} m² total
                  </span>
                </div>
                <div className="max-h-[400px] overflow-auto">
                  <table className="w-full text-[0.7rem]">
                    <thead className="sticky top-0 bg-zinc-900 text-[0.62rem] uppercase tracking-wide text-zinc-400">
                      <tr>
                        <th className="p-1.5 text-left">#</th>
                        <th className="p-1.5 text-left">Cod</th>
                        <th className="p-1.5 text-center">Cant</th>
                        <th className="p-1.5 text-left">Producto</th>
                        <th className="p-1.5 text-left">CodInt</th>
                        <th className="p-1.5 text-right">Ancho corte</th>
                        <th className="p-1.5 text-right">Corte -3.5cm</th>
                        <th className="p-1.5 text-right">Alto</th>
                        <th className="p-1.5 text-right">Alto corte</th>
                        <th className="p-1.5 text-right">Alto real</th>
                        <th className="p-1.5 text-right">M²</th>
                        <th className="p-1.5 text-right">Ancho paño opt</th>
                        <th className="p-1.5 text-center">Paño #</th>
                        <th className="p-1.5 text-center">Junto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculo.panos.map((p) => (
                        <tr key={p.idx} className="border-t border-white/5 hover:bg-white/5">
                          <td className="p-1.5 text-zinc-500">{p.idx}</td>
                          <td className="p-1.5 font-mono">{p.cod}</td>
                          <td className="p-1.5 text-center">{p.cant}</td>
                          <td className="max-w-[120px] truncate p-1.5" title={p.producto}>
                            {p.producto}
                          </td>
                          <td className="p-1.5 font-mono text-zinc-400">{p.codInt}</td>
                          <td className="p-1.5 text-right">
                            {(p.anchoCorteCm + 3.5).toFixed(1)} cm
                          </td>
                          <td className="p-1.5 text-right text-amber-300">
                            {p.anchoCorteCm} cm
                          </td>
                          <td className="p-1.5 text-right">{p.altoCm.toFixed(1)} cm</td>
                          <td className="p-1.5 text-right text-amber-300">
                            {p.altoCorteCm} cm
                          </td>
                          <td className="p-1.5 text-right">{p.altoReal.toFixed(4)} m</td>
                          <td className="p-1.5 text-right font-semibold text-emerald-300">
                            {p.m2.toFixed(4)}
                          </td>
                          <td className="p-1.5 text-right">{p.anchoPano.toFixed(4)} m</td>
                          <td className="p-1.5 text-center">{p.numeroPano || '—'}</td>
                          <td className="p-1.5 text-center">{p.junto || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-purple-500/40 font-semibold">
                      <tr>
                        <td colSpan={10} className="p-1.5 text-right">
                          Total
                        </td>
                        <td className="p-1.5 text-right text-emerald-300">
                          {calculo.totalM2.toFixed(2)} m²
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
