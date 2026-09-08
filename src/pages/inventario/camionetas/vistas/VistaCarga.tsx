// Vista de carga: selecciona insumos y cantidades a transferir desde bodega
// a la camioneta. Por cada insumo: inserta un movimiento `carga`, incrementa
// inventario_camioneta (o crea fila), y decrementa stock_total en insumos.

import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SectionTitle from '../components/SectionTitle';
import type { Camioneta, Insumo } from '../Camionetas.types';

interface VistaCargaProps {
  camioneta: Camioneta;
  empresaId: string;
  onDone: () => void;
}

export default function VistaCarga({ camioneta, empresaId, onDone }: VistaCargaProps) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('insumos')
        .select('id, nemotecnico, cod, stock_total')
        .eq('empresa_id', empresaId)
        .order('nemotecnico');
      setInsumos((data as Insumo[]) ?? []);
    };
    run();
  }, [empresaId]);

  const ajustar = (id: string, delta: number, max: number) => {
    setCantidades((prev) => {
      const actual = prev[id] ?? 0;
      const nuevo = Math.max(0, Math.min(max, actual + delta));
      return { ...prev, [id]: nuevo };
    });
  };

  const confirmar = async () => {
    const items = Object.entries(cantidades).filter(([, q]) => q > 0);
    if (items.length === 0) {
      toast.error('Selecciona al menos un insumo');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre de quien carga');
      return;
    }
    setSaving(true);

    const movs = items.map(([insumo_id, cantidad]) => ({
      empresa_id: empresaId,
      camioneta_id: camioneta.id,
      insumo_id,
      cantidad,
      tipo: 'carga' as const,
      registrado_por: responsable.trim(),
    }));

    const { error } = await supabase.from('movimientos_camioneta').insert(movs);
    if (error) {
      toast.error('Error al registrar movimientos');
      setSaving(false);
      return;
    }

    for (const [insumo_id, cantidad] of items) {
      const { data: existing } = await supabase
        .from('inventario_camioneta')
        .select('id, cantidad')
        .eq('camioneta_id', camioneta.id)
        .eq('insumo_id', insumo_id)
        .maybeSingle<{ id: string; cantidad: number }>();

      if (existing) {
        await supabase
          .from('inventario_camioneta')
          .update({ cantidad: existing.cantidad + cantidad })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inventario_camioneta')
          .insert({ camioneta_id: camioneta.id, insumo_id, cantidad });
      }
      const ins = insumos.find((i) => i.id === insumo_id);
      if (ins) {
        await supabase
          .from('insumos')
          .update({ stock_total: Math.max(0, (ins.stock_total ?? 0) - cantidad) })
          .eq('id', insumo_id);
      }
    }
    toast.success(
      `${items.length} insumo${items.length > 1 ? 's' : ''} cargado${items.length > 1 ? 's' : ''}`,
    );
    onDone();
  };

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Selecciona los insumos y la cantidad que cargas en la camioneta. El stock se descontará de bodega.
      </p>
      <Label htmlFor="resp">¿Quién carga?</Label>
      <Input
        id="resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del instalador o bodeguero"
        className="mb-4"
      />
      <SectionTitle>Insumos disponibles en bodega</SectionTitle>
      <div className="mb-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {insumos.map((ins) => {
          const qty = cantidades[ins.id] ?? 0;
          const max = ins.stock_total ?? 999;
          return (
            <div
              key={ins.id}
              className={cn(
                'flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition-colors',
                qty > 0 && 'border-primary bg-primary/5',
              )}
            >
              <div>
                <div className="text-sm font-semibold">
                  {ins.nemotecnico ?? ins.cod ?? 'Insumo'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ins.cod ?? ''} · Stock: {ins.stock_total ?? 0}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => ajustar(ins.id, -1, max)}
                  disabled={qty === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[24px] text-center text-base font-extrabold">{qty}</span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => ajustar(ins.id, 1, max)}
                  disabled={qty >= max}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={confirmar} className="w-full" disabled={saving}>
        {saving ? 'Guardando…' : 'Confirmar carga'}
      </Button>
    </>
  );
}
