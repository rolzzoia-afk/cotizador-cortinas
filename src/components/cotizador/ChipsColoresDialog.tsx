// Editor de colores de los chips de categoría del catálogo (Fase 0).
// Cada chip tiene un selector de color; sin override usa su color por defecto.

import { useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { estiloChipHex, type ChipsColores } from '@/modules/cotizador/chipsColores';

export type ChipEditable = { id: string; label: string; hexDefault: string };

interface ChipsColoresDialogProps {
  chips: ChipEditable[];
  colores: ChipsColores;
  onGuardar: (nuevos: ChipsColores) => Promise<void>;
  onClose: () => void;
}

export default function ChipsColoresDialog({
  chips,
  colores,
  onGuardar,
  onClose,
}: ChipsColoresDialogProps) {
  const [draft, setDraft] = useState<ChipsColores>({ ...colores });
  const [saving, setSaving] = useState(false);

  const setColor = (id: string, hex: string) => setDraft((d) => ({ ...d, [id]: hex }));
  const resetUno = (id: string) =>
    setDraft((d) => {
      const n = { ...d };
      delete n[id];
      return n;
    });

  const guardar = async () => {
    setSaving(true);
    try {
      await onGuardar(draft);
      toast.success('Colores de categorías guardados.');
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
          <DialogTitle>Colores de las categorías</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
          {chips.map((c) => {
            const hex = draft[c.id] ?? c.hexDefault;
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
                {draft[c.id] && (
                  <button
                    type="button"
                    onClick={() => resetUno(c.id)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground underline hover:text-foreground"
                    title="Volver al color por defecto"
                  >
                    <RotateCcw className="h-3 w-3" /> Por defecto
                  </button>
                )}
              </div>
            );
          })}
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
