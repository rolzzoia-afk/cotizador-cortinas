// Al confirmar un corte general que sale de rollo, este diálogo pregunta DÓNDE
// se guardó cada sobrante reutilizable (≥120×180) antes de sumarlo a la colmena.
// Captura la ubicación física por sobrante para que el operario lo encuentre y
// se vea en su lugar dentro de la vista Colmena (zona "Cortes nuevos").

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type SobranteRollo = { codInt: string; sob: { ancho: number; alto: number } };

interface GuardarSobranteRolloDialogProps {
  sobrantes: SobranteRollo[];
  otNum: string;
  empresaId: string;
  onClose: () => void;
}

export default function GuardarSobranteRolloDialog({
  sobrantes,
  otNum,
  empresaId,
  onClose,
}: GuardarSobranteRolloDialogProps) {
  const [ubic, setUbic] = useState<string[]>(() => sobrantes.map(() => ''));
  const [saving, setSaving] = useState(false);

  const setOne = (i: number, v: string) => setUbic((arr) => arr.map((u, j) => (j === i ? v : u)));

  const guardar = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const filas = sobrantes.map((x, i) => {
        const loc = ubic[i].trim();
        return {
          empresa_id: empresaId,
          codigo: x.codInt,
          medida_ancho: x.sob.ancho,
          medida_alto: x.sob.alto,
          disponible: true,
          ubicacion: loc || `CORTE OT ${otNum}`,
          datos_extra: { fuente: 'corte_rollo', zona: 'CORTE', ot_origen: otNum, creadoEn: now },
        };
      });
      const { error } = await supabase.from('colmena_panos').insert(filas);
      if (error) throw error;
      toast.success(`${filas.length} sobrante(s) de rollo agregado(s) a la colmena.`);
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Guardar sobrantes de rollo a la colmena</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Este corte dejó {sobrantes.length} sobrante(s) reutilizable(s) (≥120×180). Indicá dónde
          guardaste cada uno para encontrarlo después. Si lo dejás vacío, queda como “CORTE OT {otNum}”.
        </p>
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto py-1">
          {sobrantes.map((x, i) => (
            <div
              key={`${x.codInt}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{x.codInt}</div>
                <div className="text-xs text-muted-foreground">
                  {x.sob.ancho}×{x.sob.alto} cm
                </div>
              </div>
              <div className="w-44">
                <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Ubicación
                </Label>
                <Input
                  value={ubic[i]}
                  onChange={(e) => setOne(i, e.target.value)}
                  placeholder="ej. A-19, RACK 2…"
                  className="border-border bg-secondary"
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Omitir (no guardar)
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar a colmena'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
