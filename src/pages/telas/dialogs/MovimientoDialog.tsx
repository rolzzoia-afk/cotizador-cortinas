// Modal de registrar movimiento de tela (ingreso/salida/traslado/ajuste).
// Inserta una fila en `movimientos_telas`.

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import FieldText from '../components/fields/FieldText';
import FieldSelect from '../components/fields/FieldSelect';
import FieldSelectValidador from '../components/fields/FieldSelectValidador';
import type { MovTipo, Tela, ValidadoresMap } from '../Telas.types';

interface MovimientoDialogProps {
  tipo: MovTipo;
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}

const TITULOS: Record<MovTipo, string> = {
  INGRESO: 'Nueva Entrada de Tela',
  SALIDA: 'Salida de Tela a Producción',
  TRASLADO: 'Traslado MP ↔ Liberado',
  AJUSTE: 'Ajuste de Inventario',
};

export default function MovimientoDialog({
  tipo,
  telas,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: MovimientoDialogProps) {
  const [codigo, setCodigo] = useState('');
  const [metros, setMetros] = useState('1');
  const [almacen, setAlmacen] = useState('LIBERADO');
  const [ot, setOt] = useState('');
  const [responsable, setResponsable] = useState('');
  const [operario, setOperario] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!codigo) {
      toast.warning('Selecciona la tela');
      return;
    }
    const m = Number(metros);
    if (!Number.isFinite(m) || m <= 0) {
      toast.warning('Metros inválidos');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('movimientos_telas').insert({
      empresa_id: empresaId,
      codigo,
      tipo,
      metros: m,
      almacen,
      ot: ot.trim() || null,
      responsable: responsable || null,
      operario: operario || null,
      notas: notas.trim() || null,
      fecha: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success('Movimiento registrado');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{TITULOS[tipo]}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 text-xs">Código Tela *</Label>
            <select
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="">— Seleccionar tela —</option>
              {telas.map((t) => (
                <option key={t.id} value={t.codigo}>
                  {t.codigo} — {t.nemotecnico || ''}
                </option>
              ))}
            </select>
          </div>
          <FieldText label="Metros *" value={metros} onChange={setMetros} placeholder="1" />
          <FieldSelect
            label="Almacén"
            value={almacen}
            onChange={setAlmacen}
            options={[
              { v: 'LIBERADO', l: 'Liberado' },
              { v: 'MATERIAS PRIMAS', l: 'Materias Primas' },
            ]}
          />
          <FieldText label="OT (opcional)" value={ot} onChange={setOt} placeholder="#OT-001" />
          <FieldSelectValidador
            label="Responsable"
            value={responsable}
            onChange={setResponsable}
            opts={validadores.RESPONSABLE || []}
          />
          <FieldSelectValidador
            label="Operario"
            value={operario}
            onChange={setOperario}
            opts={validadores.OPERARIO || []}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Notas</Label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalle del movimiento…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
