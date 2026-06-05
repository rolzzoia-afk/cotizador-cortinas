// Sección "Plan de corte activo": muestra el plan más reciente del
// optimizador y permite marcar líneas como erróneas (vía EditorLinea).
// Las correcciones quedan pendientes hasta que se aprieta "Aplicar".

import { useState } from 'react';
import { CheckCheck, Loader2, Pencil, RefreshCw, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  type LineaPlan,
  type usePlanActivo,
} from '@/modules/admin/correcciones';
import EditorLinea from './EditorLinea';

interface PlanActivoSectionProps {
  ctx: ReturnType<typeof usePlanActivo>;
}

export default function PlanActivoSection({ ctx }: PlanActivoSectionProps) {
  const { plan, loading, status, pendientes, setPendiente, removerPendiente, cargar, aplicarTodo } =
    ctx;
  const [editorIdx, setEditorIdx] = useState<number | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const onAplicarTodo = async () => {
    setAplicando(true);
    try {
      const n = await aplicarTodo();
      toast.success(`${n} corrección(es) aplicadas al plan`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al aplicar: ' + msg);
    } finally {
      setAplicando(false);
    }
  };

  const tienePendientes = Object.keys(pendientes).length > 0;

  return (
    <div className="rounded-lg border border-blue-500/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-accent" />
          <strong className="text-sm">Plan de corte activo</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={cargar}
          disabled={loading}
          className="h-8 gap-1 border-blue-500/30 text-blue-300"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Cargar
        </Button>
      </div>
      {status && <div className="mb-2 text-xs text-muted-foreground">{status}</div>}

      {plan && plan.resultados.length > 0 && (
        <div className="max-h-[320px] overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left">#</th>
                <th className="p-2 text-left">OT / Ubic.</th>
                <th className="p-2 text-left">Código tubo</th>
                <th className="p-2 text-left">Medida (cm)</th>
                <th className="p-2 text-left">Colmena</th>
                <th className="p-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {plan.resultados.map((item, i) => {
                const res = item.resultado || (item as LineaPlan['resultado']) || {};
                const ord = item.orden || {};
                const codigo = res?.codigo || res?.codigo_original || ord.cod || '—';
                const medida =
                  res?.medida_cm !== undefined ? Number(res.medida_cm).toFixed(1) + ' cm' : '—';
                const colmena = res?.colmena ? String(res.colmena) : '—';
                const otUbic = [ord.ot, ord.ubic].filter(Boolean).join(' · ') || '—';
                const tieneCorr = !!pendientes[i];
                return (
                  <tr
                    key={i}
                    className="border-t border-border hover:bg-card"
                    style={tieneCorr ? { backgroundColor: 'rgba(251,191,36,0.12)' } : undefined}
                  >
                    <td className="p-2 text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[100px] truncate p-2">{otUbic}</td>
                    <td className="max-w-[130px] truncate p-2 font-mono" title={String(codigo)}>
                      {codigo}
                      {tieneCorr && (
                        <span
                          className="ml-1 rounded-full bg-warning px-1.5 py-0.5 text-[0.6rem] font-bold text-foreground"
                          title="Corrección pendiente"
                        >
                          ✏
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-semibold">{medida}</td>
                    <td className="p-2">{colmena}</td>
                    <td className="p-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 border-warning/30 p-0 text-warning hover:bg-warning/15"
                        onClick={() => setEditorIdx(i)}
                        title="Editar línea"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editorIdx != null && plan && (
        <EditorLinea
          idx={editorIdx}
          plan={plan}
          pendiente={pendientes[editorIdx]}
          onCancel={() => setEditorIdx(null)}
          onSave={(c) => {
            setPendiente(editorIdx, c);
            setEditorIdx(null);
            toast.success('Corrección guardada (pendiente de aplicar)');
          }}
          onRemove={() => {
            removerPendiente(editorIdx);
            setEditorIdx(null);
            toast.info('Corrección descartada');
          }}
        />
      )}

      {tienePendientes && (
        <div className="mt-3">
          <Button
            onClick={onAplicarTodo}
            disabled={aplicando}
            className="w-full gap-1 bg-success hover:bg-success/90"
          >
            {aplicando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Aplicar {Object.keys(pendientes).length} corrección(es) al plan
          </Button>
        </div>
      )}
    </div>
  );
}
