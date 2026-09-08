// Admin → Términos y condiciones de la cotización.
//
// El admin arma GRUPOS (General, Gama premium, Bee-black…), define a qué
// cotizaciones aplica cada uno y escribe sus términos. En Fase 1/3 se muestran
// unidos y sin repetir, según lo que tenga la cotización.

import { useEffect, useState } from 'react';
import { FileText, History, Plus, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { BarraGuardarSticky } from '@/components/admin/BarraGuardarSticky';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import {
  TERMINOS_DEFAULT,
  claveTermino,
  terminosParaCotizacion,
  type ConfigTerminos,
  type GrupoTerminos,
} from '@/modules/cotizador/terminos';
import { guardarTerminos, useTerminos } from '@/modules/cotizador/terminosStore';
import {
  cargarRespaldosTerminos,
  terminosDelRespaldo,
  type RespaldoTerminos,
} from '@/modules/cotizador/terminosRespaldos';
import GrupoTerminosEditor from './terminos/GrupoTerminosEditor';
import ImportarTerminosDialog from './terminos/ImportarTerminosDialog';

/** Id estable a partir del nombre (o uno aleatorio si queda vacío). */
function nuevoId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function TerminosSection() {
  const { empresaId } = useAuth();
  const { terminos, loading, refresh } = useTerminos();
  const [draft, setDraft] = useState<ConfigTerminos>(TERMINOS_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [importando, setImportando] = useState(false);
  const [respaldos, setRespaldos] = useState<RespaldoTerminos[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);

  useEffect(() => {
    if (empresaId) cargarRespaldosTerminos(empresaId).then(setRespaldos);
  }, [empresaId, terminos]);

  /**
   * Carga en el borrador los términos leídos de una planilla. A un grupo nuevo
   * van tal cual; a uno existente, reemplazando los suyos o agregándose al
   * final sin repetir (misma comparación que usa la cotización para no listar
   * dos veces el mismo término).
   */
  const importarTerminos = (
    destino: string,
    terminos: string[],
    modo: 'reemplazar' | 'agregar',
  ) => {
    setDraft((d) => {
      if (!destino) {
        return {
          grupos: [
            ...d.grupos,
            { id: nuevoId(), nombre: 'Importados', siempre: false, telas: [], categorias: [], terminos },
          ],
        };
      }
      return {
        grupos: d.grupos.map((g) => {
          if (g.id !== destino) return g;
          if (modo === 'reemplazar') return { ...g, terminos };
          const vistos = new Set(g.terminos.map(claveTermino));
          const nuevos = terminos.filter((t) => !vistos.has(claveTermino(t)));
          return { ...g, terminos: [...g.terminos, ...nuevos] };
        }),
      };
    });
    setDirty(true);
    toast.success(
      `${terminos.length} términos cargados. Revísalos y presiona «Guardar términos».`,
    );
  };

  useEffect(() => {
    if (!loading) {
      setDraft(terminos);
      setDirty(false);
    }
  }, [loading, terminos]);

  const setGrupo = (id: string, patch: Partial<GrupoTerminos>) => {
    setDraft((d) => ({
      grupos: d.grupos.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
    setDirty(true);
  };

  const agregarGrupo = () => {
    setDraft((d) => ({
      grupos: [
        ...d.grupos,
        { id: nuevoId(), nombre: 'Grupo nuevo', siempre: false, telas: [], categorias: [], terminos: [''] },
      ],
    }));
    setDirty(true);
  };

  const eliminarGrupo = (id: string) => {
    setDraft((d) => ({ grupos: d.grupos.filter((g) => g.id !== id) }));
    setDirty(true);
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      // Se limpian los términos vacíos al guardar (no se pierde nada útil).
      const limpio: ConfigTerminos = {
        grupos: draft.grupos.map((g) => ({ ...g, terminos: g.terminos.filter((t) => t.trim()) })),
      };
      await guardarTerminos(empresaId, limpio);
      await refresh();
      setDirty(false);
      toast.success('Términos guardados. Las cotizaciones nuevas ya los muestran.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  // Vista previa: qué vería una cotización con TODO (sirve para revisar el dedupe).
  const todasCats = [...new Set(draft.grupos.flatMap((g) => g.categorias ?? []))];
  const todasTelas = [...new Set(draft.grupos.flatMap((g) => g.telas ?? []))];
  const preview = terminosParaCotizacion(draft, todasCats, todasTelas);

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Términos y condiciones de la cotización
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Cada grupo define a qué cotizaciones aplica (siempre, por gama de tela o por tipo de
        cortina). En Fase 1 y Fase 3 se muestran juntos los términos de todos los grupos que
        apliquen; si un término está repetido en dos grupos, sale una sola vez.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-3">
            {draft.grupos.map((g) => (
              <GrupoTerminosEditor
                key={g.id}
                grupo={g}
                onChange={(patch) => setGrupo(g.id, patch)}
                onEliminar={() => eliminarGrupo(g.id)}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={agregarGrupo} variant="secondary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar grupo
            </Button>
            <Button onClick={() => setImportando(true)} variant="secondary" size="sm">
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Importar desde planilla
            </Button>
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar términos'}
            </Button>
            <Button
              onClick={() => setVerRespaldos(true)}
              variant="ghost"
              size="sm"
              disabled={!respaldos.length}
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              Respaldos ({respaldos.length})
            </Button>
            <Button
              onClick={() => {
                setDraft(TERMINOS_DEFAULT);
                setDirty(true);
                toast.info('Cargado el texto por defecto. Presiona Guardar para aplicarlo.');
              }}
              variant="ghost"
              size="sm"
              disabled={saving}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar default
            </Button>
          </div>

          <div className="mt-4 rounded-lg border border-dashed p-3">
            <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              Vista previa — cotización que incluya todos los tipos ({preview.length} términos)
            </div>
            <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-muted-foreground">
              {preview.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>

          {/* La lista de términos es larga: el botón de arriba desaparece de
              la pantalla apenas se baja a editar uno. */}
          <BarraGuardarSticky
            visible={dirty}
            guardando={saving}
            puedeGuardar={!!empresaId}
            etiquetaGuardar="Guardar términos"
            onGuardar={onGuardar}
          />

          {importando && (
            <ImportarTerminosDialog
              grupos={draft.grupos}
              onClose={() => setImportando(false)}
              onImportar={importarTerminos}
            />
          )}

          <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Respaldos de los términos</DialogTitle>
                <DialogDescription>
                  Cada vez que se guarda queda una foto de cómo estaban antes. Al restaurar una se
                  carga en pantalla: todavía hay que presionar Guardar para aplicarla.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {respaldos.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md border p-2 text-xs">
                    <div>
                      <div className="font-medium">
                        {new Date(r.fecha).toLocaleString('es-CL', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </div>
                      <div className="text-muted-foreground">
                        {r.motivo} · {terminosDelRespaldo(r)} términos en {r.config.grupos.length}{' '}
                        grupos
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDraft(r.config);
                        setDirty(true);
                        setVerRespaldos(false);
                        toast.info('Respaldo cargado. Presiona Guardar para aplicarlo.');
                      }}
                    >
                      Restaurar
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
