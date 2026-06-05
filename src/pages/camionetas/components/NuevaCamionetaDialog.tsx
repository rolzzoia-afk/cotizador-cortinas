// Modal para crear una camioneta nueva. Solo edita la tabla `camionetas`
// (sin afectar inventario).

import { useState } from 'react';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

interface NuevaCamionetaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  onCreada: () => Promise<void>;
}

export default function NuevaCamionetaDialog({
  open,
  onOpenChange,
  empresaId,
  onCreada,
}: NuevaCamionetaDialogProps) {
  const [nombre, setNombre] = useState('');
  const [patente, setPatente] = useState('');
  const [instalador, setInstalador] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!empresaId) return;
    if (!nombre.trim()) {
      toast.warning('Ingresa un nombre para la camioneta');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('camionetas').insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      patente: patente.trim() || null,
      instalador: instalador.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Error al crear camioneta');
      return;
    }
    toast.success(`Camioneta "${nombre.trim()}" creada`);
    setNombre('');
    setPatente('');
    setInstalador('');
    onOpenChange(false);
    await onCreada();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Truck className="mr-2 inline h-5 w-5 text-primary" />
            Nueva camioneta
          </DialogTitle>
          <DialogDescription>
            Registra una nueva camioneta de la flota para gestionar su stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="n-nombre">Nombre / alias</Label>
            <Input
              id="n-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Camioneta 1, Van Norte"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-patente">Patente (opcional)</Label>
            <Input
              id="n-patente"
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="Ej: ABCD-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-inst">Instalador responsable (opcional)</Label>
            <Input
              id="n-inst"
              value={instalador}
              onChange={(e) => setInstalador(e.target.value)}
              placeholder="Nombre"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Creando…' : 'Crear camioneta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
