// Los nombres de las columnas LLAMADA, PERSONA QUE COTIZA y SALIDA VISITA.
// Son las mismas listas del engranaje de /ventas: agregar o sacar a alguien
// acá también cambia allá. Sacar un nombre no borra lo que ya quedó guardado
// en los clientes viejos.

import { useEffect, useState } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ChipList from '@/pages/ventas/components/ChipList';
import type { EquipoVentas } from '@/modules/leads/planillaStore';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipo: EquipoVentas;
  onGuardar: (e: EquipoVentas) => Promise<void>;
};

function Lista({
  titulo,
  ayuda,
  items,
  onCambio,
  placeholder,
}: {
  titulo: string;
  ayuda: string;
  items: string[];
  onCambio: (items: string[]) => void;
  placeholder: string;
}) {
  const [nuevo, setNuevo] = useState('');
  const agregar = () => {
    const v = nuevo.trim();
    if (!v) return;
    if (items.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast.info(`«${v}» ya está en la lista`);
      return;
    }
    onCambio([...items, v]);
    setNuevo('');
  };
  return (
    <section className="space-y-2">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</div>
        <p className="text-[11px] text-muted-foreground">{ayuda}</p>
      </div>
      <ChipList items={items} onRemove={(i) => onCambio(items.filter((_, idx) => idx !== i))} />
      <div className="flex gap-2">
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button onClick={agregar} size="sm" aria-label="Agregar">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

export default function EquipoDialog({ open, onOpenChange, equipo, onGuardar }: Props) {
  const [draft, setDraft] = useState<EquipoVentas>(equipo);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setDraft(equipo);
  }, [open, equipo]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(draft);
      toast.success('Equipo guardado');
      onOpenChange(false);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Equipo de la planilla
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <Lista
            titulo="Llamada y persona que cotiza"
            ayuda="Quién atiende la llamada y quién arma la cotización."
            items={draft.vendedoras}
            onCambio={(vendedoras) => setDraft((d) => ({ ...d, vendedoras }))}
            placeholder="Nombre (ej: María Fernanda)"
          />
          <Lista
            titulo="Salida a visita"
            ayuda="Quién va a la casa del cliente."
            items={draft.terreno}
            onCambio={(terreno) => setDraft((d) => ({ ...d, terreno }))}
            placeholder="Nombre (ej: Lourdes)"
          />
          <p className="text-[11px] text-muted-foreground">
            Son las mismas listas del engranaje de Ventas. Sacar a alguien no cambia los clientes que ya atendió.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando} className="gap-1.5">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar equipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
