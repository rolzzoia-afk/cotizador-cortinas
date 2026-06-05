// Modal de crear/editar insumo. Formulario completo con 18 campos +
// upload de foto a Supabase Storage. La lógica de guardar/foto vive
// en el orquestador y se pasa por props.

import { useRef } from 'react';
import { Camera, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import SelectValidador from '../components/SelectValidador';
import type { InsumoForm, ValidadoresMap } from '../Inventario.types';

interface InsumoDialogProps {
  open: boolean;
  editId: string | null;
  form: InsumoForm;
  validadores: ValidadoresMap;
  fotoEstado: { msg: string; tone: string };
  saving: boolean;
  onClose: () => void;
  onChange: (patch: Partial<InsumoForm>) => void;
  onSave: () => void;
  onFotoArchivo: (file: File | null) => Promise<void>;
  onQuitarFoto: () => void;
}

export default function InsumoDialog({
  open,
  editId,
  form,
  validadores,
  fotoEstado,
  saving,
  onClose,
  onChange,
  onSave,
  onFotoArchivo,
  onQuitarFoto,
}: InsumoDialogProps) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editId ? `Editar insumo: ${form.cod}` : 'Nuevo insumo'}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto py-1 sm:grid-cols-2">
          <div className="sm:col-span-2 flex gap-3">
            <div className="flex-1">
              <Label>Código *</Label>
              <Input
                value={form.cod}
                onChange={(e) => onChange({ cod: e.target.value.toUpperCase() })}
                disabled={!!editId}
                placeholder="Ej: INS-1234"
              />
            </div>
            <div className="flex-1">
              <Label>Nemotécnico</Label>
              <Input
                value={form.nemotecnico}
                onChange={(e) => onChange({ nemotecnico: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Categoría</Label>
            <SelectValidador
              value={form.categoria}
              onChange={(v) => onChange({ categoria: v })}
              opciones={validadores['CATEGORIA'] || []}
            />
          </div>
          <div>
            <Label>Sub-categoría</Label>
            <SelectValidador
              value={form.sub_categoria}
              onChange={(v) => onChange({ sub_categoria: v })}
              opciones={validadores['SUB_CATEGORIA'] || []}
            />
          </div>
          <div>
            <Label>Producto</Label>
            <SelectValidador
              value={form.producto}
              onChange={(v) => onChange({ producto: v })}
              opciones={validadores['PRODUCTO'] || []}
            />
          </div>
          <div>
            <Label>Proveedor</Label>
            <SelectValidador
              value={form.proveedor}
              onChange={(v) => onChange({ proveedor: v })}
              opciones={validadores['PROVEEDOR'] || []}
            />
          </div>
          <div>
            <Label>Compra</Label>
            <SelectValidador
              value={form.compra}
              onChange={(v) => onChange({ compra: v })}
              opciones={validadores['COMPRA'] || []}
            />
          </div>
          <div>
            <Label>Color</Label>
            <SelectValidador
              value={form.color}
              onChange={(v) => onChange({ color: v })}
              opciones={validadores['COLOR'] || []}
            />
          </div>
          <div>
            <Label>Mínimo</Label>
            <Input
              type="number"
              value={form.minimo}
              onChange={(e) => onChange({ minimo: e.target.value })}
            />
          </div>
          <div>
            <Label>Cantidad por paquete</Label>
            <Input
              type="number"
              value={form.can_x_paquete}
              onChange={(e) => onChange({ can_x_paquete: e.target.value })}
            />
          </div>
          <div>
            <Label>Costo (sin IVA)</Label>
            <Input
              type="number"
              value={form.costo}
              onChange={(e) => onChange({ costo: e.target.value })}
            />
          </div>
          <div>
            <Label>Ubicación</Label>
            <SelectValidador
              value={form.ubicacion}
              onChange={(v) => onChange({ ubicacion: v })}
              opciones={validadores['UBICACION'] || []}
            />
          </div>
          <div>
            <Label>Código proveedor</Label>
            <Input
              value={form.cod_proveedor}
              onChange={(e) => onChange({ cod_proveedor: e.target.value })}
            />
          </div>
          <div>
            <Label>Estado</Label>
            <select
              value={form.estado_inventario}
              onChange={(e) => onChange({ estado_inventario: e.target.value })}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
            >
              <option value="ACTIVO">Activo</option>
              <option value="DISCONTINUADO">Discontinuado</option>
              <option value="SIN_STOCK_LARGO">Sin stock largo</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Descriptor proveedor</Label>
            <Input
              value={form.descriptor_proveedor}
              onChange={(e) => onChange({ descriptor_proveedor: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Comentarios</Label>
            <Input
              value={form.comentarios}
              onChange={(e) => onChange({ comentarios: e.target.value })}
            />
          </div>
          {!editId && (
            <div className="sm:col-span-2">
              <Label>Stock inicial (MP)</Label>
              <Input
                type="number"
                value={form.stock_inicial}
                onChange={(e) => onChange({ stock_inicial: e.target.value })}
              />
              <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                Si ingresás una cantidad, se crea un movimiento de NUEVO INGRESO en MP.
              </p>
            </div>
          )}

          <div className="sm:col-span-2 rounded-lg border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label className="mb-0">Foto</Label>
              {fotoEstado.msg && (
                <span className={cn('text-[0.72rem]', fotoEstado.tone)}>{fotoEstado.msg}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onFotoArchivo(e.target.files?.[0] || null)}
              />
              <input
                ref={galRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFotoArchivo(e.target.files?.[0] || null)}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => camRef.current?.click()}
                type="button"
              >
                <Camera className="h-4 w-4" /> Tomar foto
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => galRef.current?.click()}
                type="button"
              >
                <ImageIcon className="h-4 w-4" /> Subir foto
              </Button>
              {form.foto_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onQuitarFoto}
                  type="button"
                  className="gap-1 text-destructive hover:bg-destructive/15"
                >
                  <X className="h-4 w-4" /> Quitar
                </Button>
              )}
            </div>
            {form.foto_url && (
              <div className="mt-2">
                <img
                  src={form.foto_url}
                  alt="Preview"
                  className="max-h-44 rounded border border-border object-contain"
                />
              </div>
            )}
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
