// Sección "Corregir un plan antiguo" — permite marcar como defectuosa
// una línea de un plan que YA NO es el más reciente. NO rebobina el
// inventario y NO crea un plan nuevo: solo registra el error (audit +
// evento error_reemplazo). Después el encargado corta el reemplazo
// desde el optimizador normal.

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type LineaPlan,
  TIPO_ERROR_LABELS,
  type TipoError,
  useCorreccionRetroactiva,
  type usePlanesHistorial,
} from '@/modules/admin/correcciones';
import { extraerOTsPlan } from './utils/extraer-ots-plan';

interface CorreccionRetroactivaSectionProps {
  planes: ReturnType<typeof usePlanesHistorial>;
  onAplicado: () => void;
}

export default function CorreccionRetroactivaSection({
  planes,
  onAplicado,
}: CorreccionRetroactivaSectionProps) {
  const retroactiva = useCorreccionRetroactiva();
  const [planSeleccionadoId, setPlanSeleccionadoId] = useState<string>('');
  const [lineaEditando, setLineaEditando] = useState<number | null>(null);
  const [tipo, setTipo] = useState<TipoError | ''>('');
  const [nota, setNota] = useState('');
  const [aplicando, setAplicando] = useState(false);

  // Excluir el plan más reciente (se corrige por la sección "Plan activo")
  // y los planes tipo 'respaldo' (no son los reales).
  const planesParaCorregir = useMemo(
    () =>
      planes.planes
        .slice(1)
        .filter((p) => !p.tipo || p.tipo !== 'respaldo'),
    [planes.planes],
  );

  const planSeleccionado = useMemo(
    () => planes.planes.find((p) => p.id === planSeleccionadoId) || null,
    [planSeleccionadoId, planes.planes],
  );

  const resetForm = () => {
    setLineaEditando(null);
    setTipo('');
    setNota('');
  };

  const aplicar = async () => {
    if (!planSeleccionadoId || lineaEditando === null || !tipo) return;
    setAplicando(true);
    try {
      const r = await retroactiva.aplicar(
        planSeleccionadoId,
        lineaEditando,
        tipo as TipoError,
        nota || undefined,
      );
      toast.success(
        `Corrección registrada${r.ot ? ` (OT ${r.ot})` : ''}. Ahora corta la línea con otro tubo desde el optimizador.`,
        { duration: 7000 },
      );
      resetForm();
      onAplicado();
    } catch (e) {
      toast.error(
        'No se pudo aplicar: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="rounded-lg border border-purple-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-purple-300" />
        <strong className="text-sm">Corregir un plan antiguo</strong>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Usa esto cuando descubras un problema en un plan que <strong>ya no es el más reciente</strong>{' '}
        (ejemplo: un tubo dañado detectado después de varios planes). Solo registra el error — no
        revierte el inventario ni afecta los planes posteriores. Después hay que cortar el reemplazo
        desde el optimizador normal con otro tubo del mismo código.
      </p>

      {planes.loading && (
        <div className="text-xs text-muted-foreground">Cargando planes...</div>
      )}

      {!planes.loading && planesParaCorregir.length === 0 && (
        <div className="text-xs text-muted-foreground">
          No hay planes antiguos para corregir. (El plan más reciente se corrige arriba en
          &ldquo;Plan de corte activo&rdquo;.)
        </div>
      )}

      {planesParaCorregir.length > 0 && (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Plan a corregir</Label>
            <select
              value={planSeleccionadoId}
              onChange={(e) => {
                setPlanSeleccionadoId(e.target.value);
                resetForm();
              }}
              className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
            >
              <option value="">Elige un plan...</option>
              {planesParaCorregir.map((p) => {
                const fecha = p.fecha ? new Date(p.fecha).toLocaleString('es-CL') : '?';
                const ots = extraerOTsPlan(p).slice(0, 3).join(', ');
                return (
                  <option key={p.id} value={p.id}>
                    {fecha} · {p.nCortes} cortes
                    {ots ? ` · OT ${ots}` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {planSeleccionado && planSeleccionado.resultados.length > 0 && (
            <div className="max-h-[280px] overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">OT / Ubic.</th>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Medida</th>
                    <th className="p-2 text-left">Colmena</th>
                    <th className="p-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {planSeleccionado.resultados.map((item, i) => {
                    const res =
                      item.resultado || (item as LineaPlan['resultado']) || {};
                    const ord = item.orden || {};
                    const codigo = res?.codigo || res?.codigo_original || ord.cod || '—';
                    const medida =
                      res?.medida_cm !== undefined
                        ? Number(res.medida_cm).toFixed(1) + ' cm'
                        : '—';
                    const colmena = res?.colmena ? String(res.colmena) : '—';
                    const otUbic =
                      [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                    return (
                      <tr
                        key={i}
                        className={cn(
                          'border-t border-border hover:bg-card',
                          lineaEditando === i && 'bg-purple-500/10',
                        )}
                      >
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[100px] truncate p-2">{otUbic}</td>
                        <td
                          className="max-w-[130px] truncate p-2 font-mono"
                          title={String(codigo)}
                        >
                          {codigo}
                        </td>
                        <td className="p-2 font-semibold">{medida}</td>
                        <td className="p-2">{colmena}</td>
                        <td className="p-2 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 border-purple-500/30 px-2 text-purple-300 hover:bg-purple-500/15"
                            onClick={() => {
                              setLineaEditando(i);
                              setTipo('');
                              setNota('');
                            }}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Marcar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {lineaEditando !== null && planSeleccionado && (
            <div className="space-y-2 rounded border border-purple-500/30 bg-purple-500/10 p-3">
              <div className="text-xs font-semibold">
                Línea #{lineaEditando + 1} —{' '}
                {planSeleccionado.resultados[lineaEditando]?.resultado?.codigo || '—'}{' '}
                ({Number(
                  planSeleccionado.resultados[lineaEditando]?.resultado?.medida_cm ?? 0,
                ).toFixed(1)}{' '}
                cm)
              </div>
              <div>
                <Label className="text-xs">Tipo de error</Label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoError)}
                  className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
                >
                  <option value="">Elige el tipo...</option>
                  {(Object.entries(TIPO_ERROR_LABELS) as Array<[TipoError, string]>).map(
                    ([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <Label className="text-xs">Nota (opcional)</Label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  className="mt-1 h-8 text-xs"
                  placeholder="Detalle de qué pasó (qué viste, dónde, etc.)"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={aplicar}
                  disabled={!tipo || aplicando}
                  size="sm"
                  className="gap-1 bg-purple-500 hover:bg-purple-500/90"
                >
                  {aplicando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  Aplicar corrección retroactiva
                </Button>
                <Button onClick={resetForm} size="sm" variant="outline">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
