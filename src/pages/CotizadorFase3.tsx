import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOT } from '@/modules/ots/hooks';
import {
  calcularSubtotalVentana,
  calcularTotalesFase3,
  formatCLP,
  IVA_RATE,
} from '@/modules/cotizador/calculos';
import type { Ventana } from '@/modules/cotizador/types';

export function CotizadorFase3() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const [avanzando, setAvanzando] = useState(false);

  const ventanas: Ventana[] = useMemo(
    () => ((ot?.storeVentanas || []) as unknown as Ventana[]),
    [ot],
  );

  const totales = useMemo(
    () => calcularTotalesFase3(ventanas),
    [ventanas],
  );

  const eliminarVentana = async (id: string | number) => {
    if (!ot) return;
    if (!confirm('¿Eliminar esta ventana de la cotización?')) return;
    try {
      const nuevas = ot.storeVentanas.filter((v) => v.id !== id);
      const totalConIva = calcularTotalesFase3(nuevas as unknown as Ventana[]).total;
      await guardar({ storeVentanas: nuevas, totalConIva });
      toast.success('Ventana eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const enviarAProduccion = async () => {
    if (!ot) return;
    if (ventanas.length === 0) {
      toast.error('No hay ventanas en la cotización');
      return;
    }
    setAvanzando(true);
    try {
      const dg = {
        ...(ot.datosGenerales || {}),
        historialEstados: [
          ...(ot.datosGenerales?.historialEstados || []),
          { de: ot.estado, a: 'produccion' as const, fecha: new Date().toISOString() },
        ],
      };
      await guardar({
        estado: 'produccion',
        subEtapa: 'Estructura',
        datosGenerales: dg,
        totalConIva: totales.total,
      });
      toast.success('OT enviada a Producción');
      localStorage.setItem('activeOTId', ot.id);
      navigate(`/ots/${ot.id}/fase4`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al avanzar: ' + msg);
    } finally {
      setAvanzando(false);
    }
  };

  const guardarTotalSinAvanzar = async () => {
    if (!ot) return;
    try {
      await guardar({ totalConIva: totales.total });
      toast.success('Total guardado');
    } catch {
      toast.error('Error al guardar');
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
        <Link to="/" className="text-sm text-indigo-300 hover:underline">
          Volver al Panel
        </Link>
      </div>
    );
  }

  const readOnly = ot.estado !== 'aprobada' && ot.estado !== 'esperando';

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
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
            <h2 className="text-base font-semibold">Fase 3 — Cotización final</h2>
            <p className="text-xs text-zinc-500">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'} ·
              estado: <span className="text-zinc-300">{ot.estado}</span>
            </p>
          </div>
        </div>
        {readOnly && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.7rem] text-zinc-400">
            Solo lectura (la OT ya avanzó a {ot.estado})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-zinc-400">
          <Pencil className="h-3.5 w-3.5" />
          Para editar los paños (medidas reales y ficha técnica),{' '}
          <button
            className="text-indigo-300 hover:underline"
            onClick={() => navigate(`/ots/${ot.id}/fase2`)}
          >
            abrir Fase 2
          </button>
          .
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-900/40">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-[0.68rem] uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-2 text-left">Cant</th>
                <th className="p-2 text-left">Ubicación</th>
                <th className="p-2 text-left">Producto</th>
                <th className="p-2 text-left">Dimensiones</th>
                <th className="p-2 text-right">M²</th>
                <th className="p-2 text-right">Precio $/m²</th>
                <th className="p-2 text-right">Subtotal</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {ventanas.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-zinc-500">
                    La OT no tiene ventanas todavía. Ingresá productos en Fase 1 → Fase 2.
                  </td>
                </tr>
              )}
              {ventanas.map((v) => {
                const calc = calcularSubtotalVentana(v);
                const anchoCm = (calc.totalAncho * 100).toFixed(0);
                const altoCm = ((v.alto || 0) * 100).toFixed(0);
                return (
                  <tr key={String(v.id)} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2 text-center font-semibold">{v.cantidad || 1}</td>
                    <td className="p-2">{v.ubicacion}</td>
                    <td className="p-2">
                      <div>{v.producto || v.codInt}</div>
                      <div className="text-[0.68rem] text-zinc-500">
                        {v.color} · {v.codInt}
                      </div>
                    </td>
                    <td className="p-2 text-zinc-400">
                      {anchoCm}×{altoCm} cm
                    </td>
                    <td className="p-2 text-right text-zinc-300">{calc.m2.toFixed(2)}</td>
                    <td className="p-2 text-right text-zinc-400">{formatCLP(v.precio || 0)}</td>
                    <td className="p-2 text-right font-semibold text-emerald-300">
                      {formatCLP(calc.subtotal)}
                    </td>
                    <td className="p-2 text-right">
                      {!readOnly && (
                        <button
                          onClick={() => eliminarVentana(v.id)}
                          className="rounded border border-red-500/30 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-zinc-900/40 p-4">
            <TotalRow label="Subtotal" value={totales.subtotal} />
            <TotalRow
              label={`IVA (${(IVA_RATE * 100).toFixed(0)}%)`}
              value={totales.iva}
              muted
            />
            <div className="mt-2 border-t border-white/10 pt-2">
              <TotalRow label="Total" value={totales.total} big />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            Volver al Panel
          </Button>
          {!readOnly && (
            <>
              <Button variant="outline" onClick={guardarTotalSinAvanzar} className="gap-1">
                <ClipboardCheck className="h-4 w-4" /> Guardar total
              </Button>
              <Button
                onClick={enviarAProduccion}
                disabled={avanzando || ventanas.length === 0}
                className="gap-1"
              >
                {avanzando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Aprobar y enviar a Producción
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  big,
  muted,
}: {
  label: string;
  value: number;
  big?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        big ? 'text-base font-semibold' : 'text-sm',
        muted ? 'text-zinc-500' : 'text-zinc-200',
      )}
    >
      <span>{label}</span>
      <span className={big ? 'text-emerald-300' : ''}>{formatCLP(value)}</span>
    </div>
  );
}
