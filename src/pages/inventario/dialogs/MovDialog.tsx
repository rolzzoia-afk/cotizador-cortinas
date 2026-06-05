// Modal de registrar movimiento de inventario (entrada / salida /
// devolución / ajuste). Valida formulario y delega el guardado.

import { Loader2 } from 'lucide-react';
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
import type { Insumo } from '@/modules/inventario/helpers';
import SelectValidador from '../components/SelectValidador';
import type { MovForm, MovTipo, ValidadoresMap } from '../Inventario.types';

interface MovDialogProps {
  open: boolean;
  form: MovForm;
  insumos: Insumo[];
  validadores: ValidadoresMap;
  saving: boolean;
  onClose: () => void;
  onChange: (patch: Partial<MovForm>) => void;
  onSave: () => void;
}

export default function MovDialog({
  open,
  form,
  insumos,
  validadores,
  saving,
  onClose,
  onChange,
  onSave,
}: MovDialogProps) {
  const tituloPorTipo: Record<MovTipo, string> = {
    'NUEVO INGRESO': 'Registrar entrada',
    'SALIDA PRODUCCION': 'Registrar salida',
    DEVOLUCION: 'Registrar devolución',
    AJUSTE: 'Ajuste de inventario',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tituloPorTipo[form.tipo]}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Tipo</Label>
            <select
              value={form.tipo}
              onChange={(e) => onChange({ tipo: e.target.value as MovTipo })}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
            >
              <option value="NUEVO INGRESO">Entrada</option>
              <option value="SALIDA PRODUCCION">Salida</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="AJUSTE">Ajuste</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Insumo</Label>
            <select
              value={form.codigo}
              onChange={(e) => onChange({ codigo: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
            >
              <option value="">Seleccionar insumo…</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.cod || ''}>
                  {i.cod} — {i.nemotecnico || i.descriptor_proveedor || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              value={form.cantidad}
              onChange={(e) => onChange({ cantidad: e.target.value })}
            />
          </div>
          <div>
            <Label>Almacén</Label>
            <select
              value={form.almacen}
              onChange={(e) => onChange({ almacen: e.target.value as 'MP' | 'LIBERADO' })}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
            >
              <option value="MP">Materias primas (MP)</option>
              <option value="LIBERADO">Liberado</option>
            </select>
          </div>
          <div>
            <Label>OT</Label>
            <Input
              value={form.ot}
              onChange={(e) => onChange({ ot: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div>
            <Label>Responsable</Label>
            <SelectValidador
              value={form.responsable_entrega}
              onChange={(v) => onChange({ responsable_entrega: v })}
              opciones={validadores['RESPONSABLE'] || []}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Recepción</Label>
            <SelectValidador
              value={form.recepcion}
              onChange={(v) => onChange({ recepcion: v })}
              opciones={validadores['RESPONSABLE'] || []}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Bitácora</Label>
            <Input
              value={form.bitacora}
              onChange={(e) => onChange({ bitacora: e.target.value })}
              placeholder="Observaciones del movimiento…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
