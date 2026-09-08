// Vista de devolución: por cada insumo en la camioneta, indicar qué pasó
// (vuelve OK a bodega, era defectuoso, se queda en camioneta). Los que
// vuelven OK suman a stock_total; los defectuosos solo registran el
// movimiento; los "se queda" no se tocan.

import { useState } from 'react';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SectionTitle from '../components/SectionTitle';
import EmptyState from '../components/EmptyState';
import type { Camioneta, EstadoDev, StockItem } from '../Camionetas.types';

interface VistaDevolucionProps {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string;
  onDone: () => void;
}

export default function VistaDevolucion({
  camioneta,
  stock,
  empresaId,
  onDone,
}: VistaDevolucionProps) {
  const [estados, setEstados] = useState<Record<string, EstadoDev>>(() => {
    const e: Record<string, EstadoDev> = {};
    for (const s of stock.filter((x) => x.cantidad > 0)) e[s.insumo_id] = 'ok';
    return e;
  });
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  const stockConQty = stock.filter((s) => s.cantidad > 0);

  const confirmar = async () => {
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre del bodeguero');
      return;
    }
    if (stockConQty.length === 0) {
      toast.warning('No hay insumos para devolver');
      return;
    }
    setSaving(true);

    const movs = stockConQty
      .filter((s) => (estados[s.insumo_id] ?? 'ok') !== 'queda')
      .map((s) => ({
        empresa_id: empresaId,
        camioneta_id: camioneta.id,
        insumo_id: s.insumo_id,
        cantidad: s.cantidad,
        tipo:
          estados[s.insumo_id] === 'defectuoso'
            ? ('defectuoso' as const)
            : ('devolucion' as const),
        registrado_por: responsable.trim(),
      }));

    if (movs.length > 0) {
      const { error } = await supabase.from('movimientos_camioneta').insert(movs);
      if (error) {
        toast.error('Error al registrar devolución');
        setSaving(false);
        return;
      }
    }

    for (const s of stockConQty) {
      const estado = estados[s.insumo_id] ?? 'ok';
      if (estado === 'queda') continue;
      await supabase.from('inventario_camioneta').update({ cantidad: 0 }).eq('id', s.id);
      if (estado === 'ok') {
        const { data: ins } = await supabase
          .from('insumos')
          .select('stock_total')
          .eq('id', s.insumo_id)
          .single<{ stock_total: number | null }>();
        if (ins) {
          await supabase
            .from('insumos')
            .update({ stock_total: (ins.stock_total ?? 0) + s.cantidad })
            .eq('id', s.insumo_id);
        }
      }
    }

    toast.success('Devolución registrada');
    onDone();
  };

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Al volver a la industria, indica qué pasó con cada insumo que tenía la camioneta.
      </p>
      <Label htmlFor="dev-resp">Registrado por</Label>
      <Input
        id="dev-resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del bodeguero"
        className="mb-4"
      />
      <SectionTitle>Estado de cada insumo</SectionTitle>
      {stockConQty.length === 0 ? (
        <EmptyState>
          <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
          La camioneta no tiene insumos registrados.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {stockConQty.map((s) => {
            const nombre = s.insumos?.nemotecnico ?? s.insumos?.cod ?? s.insumo_id;
            const est = estados[s.insumo_id] ?? 'ok';
            return (
              <div key={s.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 text-sm font-semibold">
                  {nombre}{' '}
                  <span className="text-xs text-muted-foreground">({s.cantidad} u.)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['ok', 'defectuoso', 'queda'] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEstados((prev) => ({ ...prev, [s.insumo_id]: e }))}
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                        est === e ? 'scale-[1.03] opacity-100' : 'opacity-50',
                        e === 'ok' && 'border-success/30 bg-success/15 text-success',
                        e === 'defectuoso' &&
                          'border-destructive/30 bg-destructive/15 text-destructive',
                        e === 'queda' && 'border-warning/30 bg-warning/15 text-warning',
                      )}
                    >
                      {e === 'ok' && '✅ Vuelve OK'}
                      {e === 'defectuoso' && '❌ Defectuoso'}
                      {e === 'queda' && '🚐 Se queda'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button
        onClick={confirmar}
        className="mt-5 w-full"
        disabled={saving || stockConQty.length === 0}
      >
        {saving ? 'Guardando…' : 'Confirmar devolución'}
      </Button>
    </>
  );
}
