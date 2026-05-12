import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import type { Lead, LeadInput } from '@/modules/leads/types';
import { useVendedoras } from '@/modules/leads/hooks';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: Lead | null;
  canales: string[];
  onSubmit: (input: LeadInput) => Promise<void>;
};

const EMPTY: LeadInput = {
  nombre: '',
  telefono: '',
  email: '',
  rut: '',
  canal: '',
  ubicacion: '',
  vendedora_id: null,
  valor_estimado: null,
  comentarios: '',
};

export function LeadDialog({ open, onOpenChange, lead, canales, onSubmit }: Props) {
  const { vendedoras } = useVendedoras();
  const [draft, setDraft] = useState<LeadInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setDraft({
        nombre: lead.nombre,
        telefono: lead.telefono ?? '',
        email: lead.email ?? '',
        rut: lead.rut ?? '',
        canal: lead.canal ?? '',
        ubicacion: lead.ubicacion ?? '',
        vendedora_id: lead.vendedora_id ?? null,
        valor_estimado: lead.valor_estimado,
        comentarios: lead.comentarios ?? '',
      });
    } else {
      setDraft(EMPTY);
    }
  }, [open, lead]);

  const handleGuardar = async () => {
    if (!draft.nombre.trim()) {
      toast.error('Ingresá el nombre del lead');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
      toast.success(lead ? 'Lead actualizado' : 'Lead creado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{lead ? 'Editar lead' : 'Nuevo lead'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nombre*</Label>
            <Input
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              placeholder="María González"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Teléfono</Label>
              <Input
                value={draft.telefono || ''}
                onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={draft.email || ''}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="cliente@email.com"
                type="email"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>RUT</Label>
              <Input
                value={draft.rut || ''}
                onChange={(e) => setDraft((d) => ({ ...d, rut: e.target.value }))}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <Label>Ubicación</Label>
              <Input
                value={draft.ubicacion || ''}
                onChange={(e) => setDraft((d) => ({ ...d, ubicacion: e.target.value }))}
                placeholder="Las Condes, Vitacura, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Canal</Label>
              <select
                value={draft.canal || ''}
                onChange={(e) => setDraft((d) => ({ ...d, canal: e.target.value }))}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">— Sin canal —</option>
                {canales.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="Web">Web</option>
                <option value="Referido">Referido</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div>
              <Label>Asignar vendedora</Label>
              <select
                value={draft.vendedora_id || ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, vendedora_id: e.target.value || null }))
                }
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">— Sin asignar —</option>
                {vendedoras.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>Valor estimado (CLP)</Label>
            <Input
              type="number"
              value={draft.valor_estimado ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  valor_estimado: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="Opcional"
            />
          </div>

          <div>
            <Label>Comentarios</Label>
            <textarea
              value={draft.comentarios || ''}
              onChange={(e) => setDraft((d) => ({ ...d, comentarios: e.target.value }))}
              placeholder="Notas internas del lead"
              rows={3}
              className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {lead ? 'Guardar cambios' : 'Crear lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
