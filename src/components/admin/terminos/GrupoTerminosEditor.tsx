// Editor de UN grupo de términos: su nombre, a qué aplica y su lista de textos.
// Lo consume TerminosSection, que maneja la lista de grupos y el guardado.

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORIAS_FASE1 } from '@/modules/cotizador/categorias';
import type { GrupoTerminos } from '@/modules/cotizador/terminos';

/** Gamas de tela del catálogo (la columna "categoría" de la tela). */
const TELAS = ['A', 'B'];

interface GrupoTerminosEditorProps {
  grupo: GrupoTerminos;
  onChange: (patch: Partial<GrupoTerminos>) => void;
  onEliminar: () => void;
}

export default function GrupoTerminosEditor({
  grupo,
  onChange,
  onEliminar,
}: GrupoTerminosEditorProps) {
  const toggleEnLista = (lista: string[] | undefined, valor: string): string[] => {
    const set = new Set(lista ?? []);
    if (set.has(valor)) set.delete(valor);
    else set.add(valor);
    return [...set];
  };

  const setTermino = (i: number, texto: string) => {
    const t = [...grupo.terminos];
    t[i] = texto;
    onChange({ terminos: t });
  };

  const moverTermino = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= grupo.terminos.length) return;
    const t = [...grupo.terminos];
    [t[i], t[j]] = [t[j], t[i]];
    onChange({ terminos: t });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label className="text-xs">Nombre del grupo</Label>
          <Input
            value={grupo.nombre}
            onChange={(e) => onChange({ nombre: e.target.value })}
            placeholder="Gama premium, Bee-black, General…"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onEliminar} className="text-destructive">
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Eliminar grupo
        </Button>
      </div>

      {/* A qué aplica */}
      <div className="space-y-2">
        <Label className="text-xs">¿A qué cotizaciones aplica?</Label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={grupo.siempre === true}
            onChange={(e) => onChange({ siempre: e.target.checked })}
          />
          Siempre (condiciones generales, van en toda cotización)
        </label>

        {!grupo.siempre && (
          <div className="space-y-2 rounded border border-dashed p-2">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Gama de tela
              </div>
              <div className="flex flex-wrap gap-1">
                {TELAS.map((t) => {
                  const on = (grupo.telas ?? []).includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => onChange({ telas: toggleEnLista(grupo.telas, t) })}
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        on ? 'border-accent bg-accent/20 text-accent' : 'text-muted-foreground'
                      }`}
                    >
                      Categoría {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                Tipo de cortina
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIAS_FASE1.flatMap((g) => g.options).map((o) => {
                  const on = (grupo.categorias ?? []).includes(o.value.toUpperCase());
                  return (
                    <button
                      key={o.value}
                      onClick={() =>
                        onChange({
                          categorias: toggleEnLista(grupo.categorias, o.value.toUpperCase()),
                        })
                      }
                      className={`rounded-md border px-2 py-1 text-[11px] ${
                        on ? 'border-accent bg-accent/20 text-accent' : 'text-muted-foreground'
                      }`}
                      title={o.value}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {!grupo.siempre &&
              !(grupo.telas ?? []).length &&
              !(grupo.categorias ?? []).length && (
                <p className="text-[11px] text-warning">
                  Sin gama ni tipo marcado este grupo no aparece en ninguna cotización.
                </p>
              )}
          </div>
        )}
      </div>

      {/* Términos */}
      <div className="space-y-1">
        <Label className="text-xs">Términos ({grupo.terminos.length})</Label>
        {grupo.terminos.map((t, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="w-5 pt-2 text-right text-[11px] text-muted-foreground">{i + 1}.</span>
            <textarea
              value={t}
              onChange={(e) => setTermino(i, e.target.value)}
              rows={2}
              className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
            <div className="flex flex-col">
              <button
                onClick={() => moverTermino(i, -1)}
                className="text-muted-foreground hover:text-foreground"
                title="Subir"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                onClick={() => moverTermino(i, 1)}
                className="text-muted-foreground hover:text-foreground"
                title="Bajar"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
            <button
              onClick={() => onChange({ terminos: grupo.terminos.filter((_, j) => j !== i) })}
              className="pt-1 text-destructive"
              title="Quitar término"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange({ terminos: [...grupo.terminos, ''] })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar término
        </Button>
      </div>
    </div>
  );
}
