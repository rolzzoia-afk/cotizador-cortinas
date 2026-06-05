// Modal de crear / editar tela. Formulario con 21 campos + upload de foto.
// Si es edición, permite eliminar con confirmación.

import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Save, Trash2, X } from 'lucide-react';
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
import FieldNumber from '../components/fields/FieldNumber';
import FieldSelect from '../components/fields/FieldSelect';
import FieldSelectValidador from '../components/fields/FieldSelectValidador';
import { EMPTY_TELA } from '../Telas.config';
import type { Tela, ValidadoresMap } from '../Telas.types';

interface TelaDialogProps {
  tela: Tela | null;
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function TelaDialog({
  tela,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: TelaDialogProps) {
  const [form, setForm] = useState<Omit<Tela, 'id'>>(
    tela
      ? {
          codigo: tela.codigo,
          tipo: tela.tipo,
          grupo: tela.grupo,
          nemotecnico: tela.nemotecnico,
          proveedor: tela.proveedor,
          cod_ext: tela.cod_ext,
          descriptor: tela.descriptor,
          ancho: tela.ancho,
          calidad: tela.calidad,
          status_stock: tela.status_stock,
          stock_minimo: tela.stock_minimo,
          stock_total: tela.stock_total,
          stock_mp: tela.stock_mp,
          stock_liberado: tela.stock_liberado,
          posicion: tela.posicion,
          almacen: tela.almacen,
          estado: tela.estado,
          proveedor_codigo: tela.proveedor_codigo,
          responsable: tela.responsable,
          observaciones: tela.observaciones,
          foto_url: tela.foto_url,
        }
      : { ...EMPTY_TELA },
  );
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(
    tela?.foto_url ? '✓ Foto guardada' : null,
  );
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onFoto = async (file: File) => {
    setUploading(true);
    setUploadMsg('Subiendo foto…');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cod = (form.codigo || 'tela').trim().toUpperCase().replace(/\s+/g, '_');
      const path = `${empresaId}/${cod}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('fotos-telas')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: url } = supabase.storage.from('fotos-telas').getPublicUrl(path);
      if (!url?.publicUrl) throw new Error('No se pudo obtener URL pública');
      set('foto_url', url.publicUrl);
      setUploadMsg('✓ Foto guardada');
    } catch (e) {
      const err = e as Error;
      setUploadMsg('⚠ ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const guardar = async () => {
    if (!form.codigo || !form.codigo.trim()) {
      toast.warning('El código es obligatorio');
      return;
    }
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      ...form,
      codigo: form.codigo.trim(),
      posicion: form.posicion?.toString().trim().toUpperCase() || null,
    };
    const { error } = tela
      ? await supabase.from('telas_catalogo').update(payload).eq('id', tela.id)
      : await supabase.from('telas_catalogo').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(tela ? 'Tela actualizada' : 'Tela creada');
    onSaved();
  };

  const eliminar = async () => {
    if (!tela) return;
    setSaving(true);
    const { error } = await supabase.from('telas_catalogo').delete().eq('id', tela.id);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success('Tela eliminada');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{tela ? `Editar — ${tela.codigo}` : 'Nueva Tela'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldText label="Código *" value={form.codigo} onChange={(v) => set('codigo', v)} placeholder="BK 32" />
          <FieldSelect
            label="Tipo *"
            value={form.tipo || 'BK'}
            onChange={(v) => set('tipo', v)}
            options={[
              { v: 'BK', l: 'Blackout (BK)' },
              { v: 'DU', l: 'Duo (DU)' },
              { v: 'SC', l: 'Screen (SC)' },
            ]}
          />
          <FieldSelectValidador
            label="Grupo"
            value={form.grupo || ''}
            onChange={(v) => set('grupo', v || null)}
            opts={validadores.GRUPO || []}
          />
          <FieldText
            label="Nemotécnico"
            value={form.nemotecnico || ''}
            onChange={(v) => set('nemotecnico', v || null)}
            placeholder="BK Blanco Perla"
          />
          <FieldSelectValidador
            label="Proveedor"
            value={form.proveedor || ''}
            onChange={(v) => set('proveedor', v || null)}
            opts={validadores.PROVEEDOR || []}
          />
          <FieldText
            label="Cód. Externo"
            value={form.cod_ext || ''}
            onChange={(v) => set('cod_ext', v || null)}
            placeholder="ROB 085"
          />
          <FieldText
            label="Descriptor"
            value={form.descriptor || ''}
            onChange={(v) => set('descriptor', v || null)}
            placeholder="BLANCO ESTANDAR"
          />
          <FieldNumber
            label="Ancho (m)"
            value={form.ancho}
            onChange={(v) => set('ancho', v)}
            step={0.01}
          />
          <FieldText
            label="Calidad"
            value={form.calidad || ''}
            onChange={(v) => set('calidad', v || null)}
            placeholder="PREMIUM"
          />
          <FieldSelect
            label="Status Stock"
            value={form.status_stock || ''}
            onChange={(v) => set('status_stock', v || null)}
            options={[
              { v: '', l: '—' },
              { v: 'OK', l: 'OK' },
              { v: 'CRITICO', l: 'Crítico' },
              { v: 'AGOTADO', l: 'Agotado' },
            ]}
          />
          <FieldNumber
            label="Stock Mínimo"
            value={form.stock_minimo}
            onChange={(v) => set('stock_minimo', v)}
            step={0.1}
          />
          <FieldNumber
            label="Stock Total"
            value={form.stock_total}
            onChange={(v) => set('stock_total', v)}
            step={0.01}
          />
          <FieldNumber
            label="Stock MP"
            value={form.stock_mp}
            onChange={(v) => set('stock_mp', v)}
            step={0.01}
          />
          <FieldNumber
            label="Stock Liberado"
            value={form.stock_liberado}
            onChange={(v) => set('stock_liberado', v)}
            step={0.01}
          />
          <FieldText
            label="Posición Rack"
            value={form.posicion || ''}
            onChange={(v) => set('posicion', v ? v.toUpperCase() : null)}
            placeholder="A01"
          />
          <FieldSelect
            label="Almacén"
            value={form.almacen || 'LIBERADO'}
            onChange={(v) => set('almacen', v)}
            options={[
              { v: 'LIBERADO', l: 'Liberado' },
              { v: 'MATERIAS PRIMAS', l: 'Materias Primas' },
            ]}
          />
          <FieldSelect
            label="Estado"
            value={form.estado || 'ACTIVO'}
            onChange={(v) => set('estado', v)}
            options={[
              { v: 'ACTIVO', l: 'Activo' },
              { v: 'DESCONTINUADO', l: 'Descontinuado' },
              { v: 'X CARGAR', l: 'Por cargar' },
              { v: 'INACTIVO', l: 'Inactivo' },
            ]}
          />
          <FieldText
            label="Código Proveedor"
            value={form.proveedor_codigo || ''}
            onChange={(v) => set('proveedor_codigo', v || null)}
            placeholder="COD-PROV"
          />
          <FieldSelectValidador
            label="Responsable Carga"
            value={form.responsable || ''}
            onChange={(v) => set('responsable', v || null)}
            opts={validadores.RESPONSABLE || []}
          />
        </div>

        <div>
          <Label className="mb-1 text-xs">Observaciones</Label>
          <textarea
            value={form.observaciones || ''}
            onChange={(e) => set('observaciones', e.target.value || null)}
            rows={2}
            placeholder="Notas sobre esta tela…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label className="mb-1 flex items-center gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" /> Foto de la Tela
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFoto(f);
              }}
            />
            <input
              id="telaFotoGaleria"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFoto(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputFotoRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" /> Tomar Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('telaFotoGaleria')?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Desde Galería
            </Button>
            {uploadMsg && <span className="text-[11px] text-muted-foreground">{uploadMsg}</span>}
          </div>
          {form.foto_url && (
            <div className="relative mt-2">
              <img
                src={form.foto_url}
                alt="preview"
                className="max-h-48 rounded-lg border border-border object-contain"
              />
              <button
                onClick={() => {
                  set('foto_url', null);
                  setUploadMsg(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive hover:bg-destructive/15"
                title="Quitar foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <div>
            {tela && !confirmDel && (
              <Button
                variant="outline"
                onClick={() => setConfirmDel(true)}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/15"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
            {tela && confirmDel && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-destructive">¿Confirmar borrado?</span>
                <Button size="sm" variant="outline" onClick={() => setConfirmDel(false)}>
                  No
                </Button>
                <Button
                  size="sm"
                  onClick={eliminar}
                  disabled={saving}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Sí, eliminar
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
