// Admin → Términos y condiciones de la cotización.
//
// El admin arma GRUPOS (General, Gama premium, Bee-black…), define a qué
// cotizaciones aplica cada uno y escribe sus términos. En Fase 1/3 se muestran
// unidos y sin repetir, según lo que tenga la cotización.

import { useEffect, useState } from 'react';
import { FileText, Plus, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
  TERMINOS_DEFAULT,
  terminosParaCotizacion,
  type ConfigTerminos,
  type GrupoTerminos,
} from '@/modules/cotizador/terminos';
import { guardarTerminos, useTerminos } from '@/modules/cotizador/terminosStore';
import GrupoTerminosEditor from './terminos/GrupoTerminosEditor';

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
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar términos'}
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
        </>
      )}
    </section>
  );
}
