// Editor modal-inline para marcar una línea de un plan como
// incorrecta. Se usa desde dos lugares:
//   - `PlanActivoSection` (corrige el plan más reciente)
//   - `CorreccionRetroactivaSection` (corrige planes antiguos)
//
// El componente solo recoge el dato (tipo de error + nota + medida
// rectificada opcional + serial opcional). La persistencia la hace el
// padre vía onSave.

import { useState } from 'react';
import { CheckCircle2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  type CorreccionPendiente,
  type LineaPlan,
  type Plan,
  TIPO_ERROR_LABELS,
  type TipoError,
} from '@/modules/admin/correcciones';

interface EditorLineaProps {
  idx: number;
  plan: Plan;
  pendiente: CorreccionPendiente | undefined;
  onCancel: () => void;
  onSave: (c: CorreccionPendiente) => void;
  onRemove: () => void;
}

export default function EditorLinea({
  idx,
  plan,
  pendiente,
  onCancel,
  onSave,
  onRemove,
}: EditorLineaProps) {
  const item = plan.resultados[idx];
  const res = item?.resultado || (item as LineaPlan['resultado']) || {};
  const ord = item?.orden || {};

  const [tipo, setTipo] = useState<TipoError | ''>(pendiente?.tipo || '');
  const [largo, setLargo] = useState(
    pendiente?.nuevaMedida != null
      ? String(pendiente.nuevaMedida)
      : res?.medida_cm != null
        ? String(res.medida_cm)
        : '',
  );
  const [serial, setSerial] = useState(
    pendiente?.nuevoCodigo != null
      ? pendiente.nuevoCodigo
      : res?.codigo || res?.codigo_original || '',
  );
  const [nota, setNota] = useState(pendiente?.nota || '');

  const submit = () => {
    if (!tipo) {
      toast.error('Selecciona el tipo de error');
      return;
    }
    onSave({
      tipo,
      nuevaMedida: parseFloat(largo) || null,
      nuevoCodigo: serial.trim() || null,
      nota: nota.trim(),
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-warning/30 bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-warning">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Editar línea {idx + 1} — OT {ord.ot || '?'} · {ord.ubic || '?'}
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <Label className="text-[0.65rem]">Tipo de error</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoError | '')}
            className="h-8 w-full rounded border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">— Seleccionar —</option>
            {(Object.entries(TIPO_ERROR_LABELS) as Array<[TipoError, string]>).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {tipo === 'medida_erronea' && (
          <div>
            <Label className="text-[0.65rem]">Medida correcta (cm)</Label>
            <Input
              type="number"
              value={largo}
              onChange={(e) => setLargo(e.target.value)}
              step="0.1"
              className="h-8 text-xs"
            />
          </div>
        )}

        {tipo === 'tubo_equivocado' && (
          <div>
            <Label className="text-[0.65rem]">Tubo correcto (código/serial)</Label>
            <Input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="Ej: T-001-A"
              className="h-8 text-xs"
            />
          </div>
        )}

        <div>
          <Label className="text-[0.65rem]">Nota (opcional)</Label>
          <Input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descripción del problema"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={submit}
            className="h-8 gap-1 bg-warning hover:bg-warning"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Guardar corrección
          </Button>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          {pendiente && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="border-destructive/30 text-destructive hover:bg-destructive/15"
            >
              Descartar corrección
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
