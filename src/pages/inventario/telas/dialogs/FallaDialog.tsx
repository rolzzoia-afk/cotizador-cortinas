// Modal de reportar / editar falla de tela. Trae datos del catálogo
// automáticamente al elegir el código.

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
import FieldText from '../components/fields/FieldText';
import FieldNumber from '../components/fields/FieldNumber';
import FieldSelect from '../components/fields/FieldSelect';
import FieldSelectValidador from '../components/fields/FieldSelectValidador';
import type { Falla, Tela, ValidadoresMap } from '../Telas.types';

interface FallaDialogProps {
  falla: Falla | null;
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function FallaDialog({
  falla,
  telas,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: FallaDialogProps) {
  const [codigo, setCodigo] = useState(falla?.codigo || '');
  const [tipoFalla, setTipoFalla] = useState(falla?.tipo_falla || '');
  const [ancho, setAncho] = useState<number | null>(falla?.ancho ?? null);
  const [alto, setAlto] = useState<number | null>(falla?.alto ?? null);
  const [metraje, setMetraje] = useState<number | null>(falla?.metraje ?? null);
  const [fechaReporte, setFechaReporte] = useState(
    falla?.fecha_reporte || new Date().toISOString().slice(0, 10),
  );
  const [responsable, setResponsable] = useState(falla?.responsable || '');
  const [informado, setInformado] = useState(falla?.informado || '');
  const [observaciones, setObservaciones] = useState(falla?.observaciones || '');
  const [solucion, setSolucion] = useState(falla?.solucion || '');
  const [fechaRes, setFechaRes] = useState(falla?.fecha_resolucion || '');
  const [resuelto, setResuelto] = useState(falla?.resuelto || 'NO');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!codigo) {
      toast.warning('El código de tela es obligatorio');
      return;
    }
    setSaving(true);
    const tela = telas.find((t) => t.codigo === codigo);
    const payload = {
      empresa_id: empresaId,
      codigo,
      tipo: tela?.tipo || null,
      grupo: tela?.grupo || null,
      proveedor: tela?.proveedor || null,
      nemotecnico: tela?.nemotecnico || null,
      ancho: ancho ?? tela?.ancho ?? null,
      alto,
      tipo_falla: tipoFalla || null,
      metraje,
      fecha_reporte: fechaReporte || null,
      responsable: responsable || null,
      informado: informado.trim() || null,
      observaciones: observaciones.trim() || null,
      solucion: solucion.trim() || null,
      fecha_resolucion: fechaRes || null,
      resuelto,
    };
    const { error } = falla
      ? await supabase.from('telas_fallas').update(payload).eq('id', falla.id)
      : await supabase.from('telas_fallas').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(falla ? 'Falla actualizada' : 'Falla registrada');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{falla ? 'Editar Falla' : 'Reportar Falla'}</DialogTitle>
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
          <FieldSelectValidador
            label="Tipo de Falla *"
            value={tipoFalla}
            onChange={setTipoFalla}
            opts={validadores.TIPO_FALLA || []}
          />
          <FieldNumber label="Ancho (m)" value={ancho} onChange={setAncho} step={0.01} />
          <FieldNumber label="Alto / Metraje (m)" value={alto} onChange={setAlto} step={0.01} />
          <FieldNumber
            label="Metraje afectado (m)"
            value={metraje}
            onChange={setMetraje}
            step={0.01}
          />
          <div>
            <Label className="mb-1 text-xs">Fecha Reporte</Label>
            <Input
              type="date"
              value={fechaReporte}
              onChange={(e) => setFechaReporte(e.target.value)}
              className="border-border bg-secondary"
            />
          </div>
          <FieldSelectValidador
            label="Responsable Reporte"
            value={responsable}
            onChange={setResponsable}
            opts={validadores.RESPONSABLE || []}
          />
          <FieldText
            label="Informado a"
            value={informado}
            onChange={setInformado}
            placeholder="Nombre o cargo"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Observaciones</Label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Detalle de la falla…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Solución</Label>
          <textarea
            value={solucion}
            onChange={(e) => setSolucion(e.target.value)}
            rows={2}
            placeholder="Qué se hizo para resolver…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-xs">Fecha Resolución</Label>
            <Input
              type="date"
              value={fechaRes}
              onChange={(e) => setFechaRes(e.target.value)}
              className="border-border bg-secondary"
            />
          </div>
          <FieldSelect
            label="¿Resuelto?"
            value={resuelto}
            onChange={setResuelto}
            options={[
              { v: 'NO', l: 'No' },
              { v: 'EN PROCESO', l: 'En proceso' },
              { v: 'SI', l: 'Sí' },
            ]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
