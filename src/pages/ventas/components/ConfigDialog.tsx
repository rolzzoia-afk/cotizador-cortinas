// Diálogo modal de configuración de KPI Ventas: edita las 2 metas (visitas
// y cierre %) y las 3 listas de equipo (canales, vendedoras, terreno).
// onSave devuelve una Promise para que el orquestador pueda esperar el
// upsert a Supabase antes de cerrar el modal.

import { useEffect, useState } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ChipList from './ChipList';
import NumInput from './NumInput';
import type { KpiConfig } from '../Ventas.types';

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: KpiConfig;
  onSave: (c: KpiConfig) => Promise<void>;
}

export default function ConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: ConfigDialogProps) {
  const [draft, setDraft] = useState<KpiConfig>(config);
  const [nuevoCanal, setNuevoCanal] = useState('');
  const [nuevaVendedora, setNuevaVendedora] = useState('');
  const [nuevoTerreno, setNuevoTerreno] = useState('');

  useEffect(() => {
    if (open) setDraft(config);
  }, [open, config]);

  const addCanal = () => {
    const v = nuevoCanal.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, canales: [...d.canales, v] }));
    setNuevoCanal('');
  };
  const addVendedora = () => {
    const v = nuevaVendedora.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, vendedoras: [...d.vendedoras, v] }));
    setNuevaVendedora('');
  };
  const addTerreno = () => {
    const v = nuevoTerreno.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, terreno: [...d.terreno, v] }));
    setNuevoTerreno('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Settings className="h-4 w-4" /> Configuración KPI Ventas
          </DialogTitle>
        </DialogHeader>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Metas</div>
          <div className="flex items-center justify-between border-b border-border py-2.5">
            <span className="text-sm">Meta de visitas por asesora (diario)</span>
            <NumInput
              value={draft.meta_visitas}
              min={1}
              onChange={(v) => setDraft((d) => ({ ...d, meta_visitas: v }))}
              className="w-20 rounded-lg border border-border bg-secondary px-2 py-1.5 text-center font-bold text-foreground"
            />
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm">Meta % cierre de cotizaciones</span>
            <NumInput
              value={draft.meta_cierre_pct}
              min={1}
              max={100}
              onChange={(v) => setDraft((d) => ({ ...d, meta_cierre_pct: v }))}
              className="w-20 rounded-lg border border-border bg-secondary px-2 py-1.5 text-center font-bold text-foreground"
            />
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Canales de contacto</div>
          <ChipList
            items={draft.canales}
            onRemove={(i) =>
              setDraft((d) => ({ ...d, canales: d.canales.filter((_, idx) => idx !== i) }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevoCanal}
              onChange={(e) => setNuevoCanal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCanal()}
              placeholder="Nuevo canal (ej: TikTok)"
              className="flex-1 border-border bg-secondary text-foreground"
            />
            <Button onClick={addCanal} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Equipo — Llamadas / cotizaciones
          </div>
          <ChipList
            items={draft.vendedoras}
            onRemove={(i) =>
              setDraft((d) => ({
                ...d,
                vendedoras: d.vendedoras.filter((_, idx) => idx !== i),
              }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevaVendedora}
              onChange={(e) => setNuevaVendedora(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVendedora()}
              placeholder="Nombre vendedora"
              className="flex-1 border-border bg-secondary text-foreground"
            />
            <Button onClick={addVendedora} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="mb-5">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Equipo — Terreno</div>
          <ChipList
            items={draft.terreno}
            onRemove={(i) =>
              setDraft((d) => ({ ...d, terreno: d.terreno.filter((_, idx) => idx !== i) }))
            }
          />
          <div className="mt-2 flex gap-2">
            <Input
              value={nuevoTerreno}
              onChange={(e) => setNuevoTerreno(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTerreno()}
              placeholder="Nombre vendedor/a terreno"
              className="flex-1 border-border bg-secondary text-foreground"
            />
            <Button onClick={addTerreno} size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              await onSave(draft);
              onOpenChange(false);
            }}
          >
            Guardar configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
