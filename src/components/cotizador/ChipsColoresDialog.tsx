// Editor de colores de los chips de categoría del catálogo (Fase 0).
// Cada chip tiene un selector de color; sin override usa su color por defecto.

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { estiloChipHex, type ChipsColores } from '@/modules/cotizador/chipsColores';
import {
  HEX_CHIP_CUSTOM_DEFAULT,
  idChipCustom,
  type ChipCustom,
} from '@/modules/cotizador/chipsCustom';

export type ChipEditable = { id: string; label: string; hexDefault: string };

interface ChipsColoresDialogProps {
  chips: ChipEditable[];
  colores: ChipsColores;
  /** Las categorías PROPIAS de la empresa, que acá se crean y se borran. */
  propias: ChipCustom[];
  onGuardar: (nuevos: ChipsColores) => Promise<void>;
  onGuardarPropias: (nuevos: ChipCustom[]) => Promise<void>;
  onClose: () => void;
}

export default function ChipsColoresDialog({
  chips,
  colores,
  propias,
  onGuardar,
  onGuardarPropias,
  onClose,
}: ChipsColoresDialogProps) {
  const [draft, setDraft] = useState<ChipsColores>({ ...colores });
  const [draftPropias, setDraftPropias] = useState<ChipCustom[]>(propias);
  const [nueva, setNueva] = useState('');
  const [saving, setSaving] = useState(false);
  // Los chips de fábrica llevan su color en el mapa de overrides; los propios
  // lo llevan encima, porque no tienen ningún color de fábrica que pisar.
  const esPropio = (id: string) => draftPropias.some((c) => c.id === id);

  const setColor = (id: string, hex: string) => {
    if (esPropio(id)) {
      setDraftPropias((p) => p.map((c) => (c.id === id ? { ...c, hex } : c)));
      return;
    }
    setDraft((d) => ({ ...d, [id]: hex }));
  };
  const resetUno = (id: string) =>
    setDraft((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });

  const agregar = () => {
    const label = nueva.trim();
    if (!label) return;
    const id = idChipCustom(label);
    if (draftPropias.some((c) => c.id === id) || chips.some((c) => c.id === id)) {
      toast.error('Ya existe una categoría con ese nombre.');
      return;
    }
    setDraftPropias((p) => [...p, { id, label, hex: HEX_CHIP_CUSTOM_DEFAULT }]);
    setNueva('');
  };

  const guardar = async () => {
    setSaving(true);
    try {
      await onGuardarPropias(draftPropias);
      await onGuardar(draft);
      toast.success('Categorías guardadas.');
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Categorías del catálogo</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {chips.map((c) => {
            const hex = esPropio(c.id)
              ? (draftPropias.find((x) => x.id === c.id)?.hex ?? c.hexDefault)
              : (draft[c.id] ?? c.hexDefault);
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                <span
                  className="min-w-28 rounded-md border px-2.5 py-1 text-center text-[11px] font-bold"
                  style={estiloChipHex(hex)}
                >
                  {c.label}
                </span>
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setColor(c.id, e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
                  title="Elige el color del chip"
                />
                {esPropio(c.id) ? (
                  <button
                    type="button"
                    onClick={() => setDraftPropias((p) => p.filter((x) => x.id !== c.id))}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-destructive"
                    title="Eliminar esta categoría (los productos que la usaban vuelven a la suya)"
                  >
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </button>
                ) : (
                  draft[c.id] && (
                    <button
                      type="button"
                      onClick={() => resetUno(c.id)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
                      title="Volver al color por defecto"
                    >
                      <RotateCcw className="h-3 w-3" /> Por defecto
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Categorías propias: un chip sin regla, al que los productos entran
            a mano desde su ficha. Es lo que pidió el dueño para juntar lo suyo
            (una promoción, un proveedor) sin tocar las reglas de fábrica. */}
        <div className="rounded-md border border-dashed p-2">
          <div className="mb-1.5 text-[11px] text-muted-foreground">
            Una categoría propia no agrupa sola: los productos se le asignan a mano en su ficha,
            en «Categoría del catálogo». Al eliminarla, esos productos vuelven a la que les toca
            automáticamente.
          </div>
          <div className="flex items-center gap-2">
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
              placeholder="Nombre de la categoría"
              maxLength={24}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button size="sm" variant="secondary" onClick={agregar} disabled={!nueva.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar categoría
            </Button>
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button
            variant="outline"
            className="mr-auto gap-1.5"
            onClick={() => setDraft({})}
            disabled={saving}
            title="Volver todos los chips a sus colores originales"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar todos
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
