// El panel de conteo de tubos: abrir un inventario, ver cómo va, comparar lo
// contado contra el sistema y cerrarlo con firma.
//
// Estaba dentro del archivo de la Colmena de Ojo de Dios, que tenía 1.602
// líneas y cuatro responsabilidades. Se mudó acá, que es su lugar: el submódulo
// de Conteo físico. Ojo de Dios lo sigue mostrando, importándolo desde acá.

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, ClipboardCheck, Grid3x3, Lock, Search, Undo2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import {
  useColmenaTubos,
  useInventario,
  useTalliesReconciliacion,
  type InventarioDiffRow,
} from '@/modules/admin/colmena';
import { PorColmenaTabla, StatBox, TalliesReconciliacionTabla } from './TablasConteoTubos';
import { ModalAccion, ModalCerrarInventario } from './ModalesConteoTubos';
import DiffModal from './DiffModal';

/**
 * La pantalla completa, que se trae sus propios datos. La usa el submódulo de
 * Conteo; Ojo de Dios usa `InventarioPanel`, que recibe el contexto de afuera
 * porque allá se comparte con el editor de tubos.
 */
export function ConteoTubosAdmin() {
  const tubos = useColmenaTubos();
  const inventario = useInventario();
  return (
    <InventarioPanel
      ctx={inventario}
      tubosActuales={tubos.tubos.length}
      onCambio={tubos.refrescar}
    />
  );
}


// ─── INVENTARIO PANEL ──────────────────────────────────────────────
export function InventarioPanel({
  ctx,
  tubosActuales,
  onCambio,
}: {
  ctx: ReturnType<typeof useInventario>;
  tubosActuales: number;
  onCambio: () => void;
}) {
  const { activo, historicos, loading, iniciar, cerrar, revertir, diff } = ctx;
  const [iniciando, setIniciando] = useState(false);
  const [notasInicio, setNotasInicio] = useState('');
  const [accion, setAccion] = useState<'cerrar' | 'revertir' | 'diff' | null>(null);
  const [textoAccion, setTextoAccion] = useState('');
  const [diffData, setDiffData] = useState<InventarioDiffRow[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { tallies, refrescar: refrescarTallies } = useTalliesReconciliacion(activo?.id ?? null);
  const [verTallies, setVerTallies] = useState(false);

  const [verPorColmena, setVerPorColmena] = useState(false);

  const stats = useMemo(() => {
    if (!diffData) return null;
    return {
      mantenidos: diffData.filter((r) => r.tipo === 'mantenido').length,
      eliminados: diffData.filter((r) => r.tipo === 'eliminado').length,
      nuevos: diffData.filter((r) => r.tipo === 'nuevo').length,
      modificados: diffData.filter((r) => r.tipo === 'modificado').length,
    };
  }, [diffData]);

  // Agrega el diff por n_colmena para la vista live por colmena.
  // Mismo tubo movido de C1 → C2: salida en C1, entrada en C2.
  const perColmena = useMemo(() => {
    if (!diffData) return [];
    const map = new Map<
      string,
      { snapshot: number; actual: number; modificados: number; nuevos: number; eliminados: number }
    >();
    const bump = (k: string, key: 'snapshot' | 'actual' | 'modificados' | 'nuevos' | 'eliminados') => {
      const row = map.get(k) || { snapshot: 0, actual: 0, modificados: 0, nuevos: 0, eliminados: 0 };
      row[key]++;
      map.set(k, row);
    };
    diffData.forEach((r) => {
      const pre = r.n_colmena_pre;
      const post = r.n_colmena_post;
      if (pre) bump(pre, 'snapshot');
      if (post) bump(post, 'actual');
      if (r.tipo === 'nuevo' && post) bump(post, 'nuevos');
      if (r.tipo === 'eliminado' && pre) bump(pre, 'eliminados');
      if (r.tipo === 'modificado') {
        if (post && post === pre) bump(post, 'modificados');
        else {
          if (pre) bump(pre, 'eliminados');
          if (post) bump(post, 'nuevos');
        }
      }
    });
    return Array.from(map.entries())
      .map(([n_colmena, v]) => ({
        n_colmena,
        ...v,
        delta: v.actual - v.snapshot,
      }))
      .sort((a, b) => {
        // Colmenas con anomalías primero, luego por nombre
        const anomA = a.delta !== 0 || a.modificados > 0 ? 0 : 1;
        const anomB = b.delta !== 0 || b.modificados > 0 ? 0 : 1;
        if (anomA !== anomB) return anomA - anomB;
        return a.n_colmena.localeCompare(b.n_colmena, 'es', { numeric: true });
      });
  }, [diffData]);

  // Auto-cargar diff cuando hay inventario activo
  useEffect(() => {
    if (!activo) {
      setDiffData(null);
      return;
    }
    let cancel = false;
    diff(activo.id).then((rows) => {
      if (!cancel) setDiffData(rows);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [activo, diff, tubosActuales]);

  const handleIniciar = async () => {
    setEnviando(true);
    try {
      await iniciar(notasInicio.trim() || null);
      toast.success('Inventario iniciado. Snapshot guardado.');
      setIniciando(false);
      setNotasInicio('');
      onCambio();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  const handleRevertir = async () => {
    if (!activo) return;
    setEnviando(true);
    try {
      await revertir(activo.id, textoAccion.trim());
      toast.success('Inventario revertido. Tubos restaurados al snapshot.');
      onCambio();
      setAccion(null);
      setTextoAccion('');
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  const handleCerrar = async (firmaPng: string, notas: string) => {
    if (!activo) return;
    setEnviando(true);
    try {
      await cerrar(activo.id, firmaPng, notas.trim() || null);
      toast.success('Inventario cerrado y firmado.');
      setAccion(null);
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/30 p-3 text-xs text-muted-foreground">
        Cargando estado de inventario…
      </div>
    );
  }

  // ── Sin inventario activo: panel mínimo con botón iniciar
  if (!activo) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/30 p-3">
        {!iniciando ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <span>
                Sin inventario activo. {historicos.length > 0 && (
                  <span className="text-muted-foreground">
                    Último: {new Date(historicos[0].iniciado_at).toLocaleDateString('es-CL')} (
                    {historicos[0].estado})
                  </span>
                )}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIniciando(true)}
              className="h-8 gap-1 border-warning/30 text-warning hover:bg-warning/15"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Iniciar inventario
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <ClipboardCheck className="h-4 w-4" />
              Iniciar nuevo inventario
            </div>
            <p className="text-xs text-muted-foreground">
              Se hará un snapshot de los <strong>{tubosActuales}</strong> tubos actuales y se
              bloqueará el optimizador (operarios no podrán cortar) hasta que cierres o reviertas.
            </p>
            <textarea
              value={notasInicio}
              onChange={(e) => setNotasInicio(e.target.value)}
              rows={2}
              placeholder="Notas opcionales (responsable, motivo, alcance…)"
              className="w-full rounded border border-border bg-card px-2 py-1.5 text-xs"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIniciando(false);
                  setNotasInicio('');
                }}
                disabled={enviando}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleIniciar}
                disabled={enviando}
                className="h-8 gap-1 bg-warning hover:bg-warning"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                {enviando ? 'Iniciando…' : 'Confirmar e iniciar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inventario activo: panel prominente
  const tieneAnomaliasAlPasar = stats && (stats.eliminados > 0 || stats.nuevos > 0 || stats.modificados > 0);

  return (
    <div className="rounded-lg border-2 border-warning/30 bg-warning/15 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-5 w-5 text-warning" />
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              Inventario activo
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-warning">
                Optimizador bloqueado
              </span>
            </div>
            <div className="mt-0.5 text-[0.7rem] text-warning/70">
              Iniciado por{' '}
              <strong>{activo.iniciado_por_email || '—'}</strong> el{' '}
              {new Date(activo.iniciado_at).toLocaleString('es-CL')}
              {' '}· Snapshot de {activo.tubos_count_pre} tubos
            </div>
            {activo.notas && (
              <div className="mt-1 max-w-xl whitespace-pre-wrap text-[0.7rem] text-amber-100/80">
                {activo.notas}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox label="Mantenidos" valor={stats.mantenidos} color="zinc" />
          <StatBox label="Modificados" valor={stats.modificados} color="indigo" />
          <StatBox label="Nuevos" valor={stats.nuevos} color="emerald" />
          <StatBox label="Eliminados" valor={stats.eliminados} color="red" />
        </div>
      )}

      {perColmena.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setVerPorColmena((v) => !v)}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[0.7rem] text-warning hover:bg-warning/15"
          >
            <Grid3x3 className="h-3 w-3" />
            {verPorColmena ? 'Ocultar vista por colmena' : 'Ver por colmena'}
            <span className="text-warning/60">
              ({perColmena.length} colmena{perColmena.length === 1 ? '' : 's'})
            </span>
          </button>
          {verPorColmena && <PorColmenaTabla rows={perColmena} />}
        </div>
      )}

      {tallies.length > 0 && perColmena.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              if (!verTallies) refrescarTallies();
              setVerTallies((v) => !v);
            }}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[0.7rem] text-warning hover:bg-warning/15"
          >
            <ClipboardCheck className="h-3 w-3" />
            {verTallies ? 'Ocultar conteos doble ciego' : 'Ver conteos doble ciego'}
            <span className="text-warning/60">
              ({new Set(tallies.map((t) => t.operario_email)).size} operario
              {new Set(tallies.map((t) => t.operario_email)).size === 1 ? '' : 's'})
            </span>
          </button>
          {verTallies && (
            <TalliesReconciliacionTabla
              tallies={tallies}
              snapshotPorColmena={
                new Map(perColmena.map((r) => [r.n_colmena, r.snapshot]))
              }
            />
          )}
        </div>
      )}

      {tieneAnomaliasAlPasar && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-warning/30 bg-warning/15 p-2 text-[0.7rem] text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            Hay cambios pendientes contra el snapshot. Revisa el diff completo antes de cerrar para
            confirmar que todos los cambios son correctos.
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAccion('diff')}
          disabled={!stats}
          className="h-8 gap-1 border-border text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          Ver diff completo
        </Button>
        <Button
          size="sm"
          onClick={() => setAccion('cerrar')}
          className="h-8 gap-1 bg-success hover:bg-success/90"
        >
          <Archive className="h-3.5 w-3.5" />
          Cerrar inventario
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAccion('revertir')}
          className="h-8 gap-1 border-destructive/30 text-destructive hover:bg-destructive/15"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Revertir al snapshot
        </Button>
      </div>

      {/* Modal de acción */}
      {accion === 'cerrar' && (
        <ModalCerrarInventario
          confirmando={enviando}
          onConfirmar={handleCerrar}
          onCancelar={() => setAccion(null)}
        />
      )}
      {accion === 'revertir' && (
        <ModalAccion
          titulo="Revertir inventario"
          descripcion="Se restaurarán los tubos al estado del snapshot inicial. Cualquier cambio hecho durante el inventario se perderá. El motivo queda registrado."
          textareaLabel="Motivo del rollback (mínimo 5 caracteres) *"
          textareaValor={textoAccion}
          setTextareaValor={setTextoAccion}
          onConfirmar={handleRevertir}
          onCancelar={() => {
            setAccion(null);
            setTextoAccion('');
          }}
          confirmando={enviando}
          confirmarTexto="Sí, revertir"
          confirmarColor="red"
          confirmarDisabled={textoAccion.trim().length < 5}
        />
      )}
      {accion === 'diff' && diffData && (
        <DiffModal
          rows={diffData}
          onClose={() => setAccion(null)}
        />
      )}
    </div>
  );
}
