// Vista de detalle de una camioneta: muestra su stock + acciones (carga,
// swap, devolución, historial, eliminar).

import {
  ArrowLeftRight,
  ClipboardCheck,
  Clock,
  Package,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import SectionTitle from '../components/SectionTitle';
import EmptyState from '../components/EmptyState';
import type { Camioneta, StockItem, Vista } from '../Camionetas.types';

interface VistaDetalleProps {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string | null;
  onVista: (v: Vista) => void;
  onRefresh: () => Promise<void>;
  onEliminada: () => void;
}

export default function VistaDetalle({
  camioneta,
  stock,
  empresaId,
  onVista,
  onRefresh: _onRefresh,
  onEliminada,
}: VistaDetalleProps) {
  const eliminar = async () => {
    if (!empresaId) return;
    const { data: stockActivo } = await supabase
      .from('inventario_camioneta')
      .select('id')
      .eq('camioneta_id', camioneta.id)
      .gt('cantidad', 0)
      .limit(1);
    if (stockActivo && stockActivo.length > 0) {
      toast.warning('La camioneta tiene stock. Devuelve todo a bodega antes de eliminarla.');
      return;
    }
    const ok = window.confirm(
      `¿Eliminar la camioneta "${camioneta.nombre}"?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    await supabase.from('inventario_camioneta').delete().eq('camioneta_id', camioneta.id);
    const { error } = await supabase.from('camionetas').delete().eq('id', camioneta.id);
    if (error) {
      toast.error('Error al eliminar la camioneta');
      return;
    }
    toast.success(`Camioneta "${camioneta.nombre}" eliminada`);
    onEliminada();
  };

  return (
    <>
      <SectionTitle>Stock actual</SectionTitle>
      {stock.length === 0 ? (
        <EmptyState>
          <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
          La camioneta está vacía.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {stock.map((s) => {
            const nombre = s.insumos?.nemotecnico ?? s.insumos?.cod ?? 'Insumo';
            const cls =
              s.cantidad === 0
                ? 'text-destructive'
                : s.cantidad <= 2
                ? 'text-warning'
                : 'text-success';
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold">{nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.insumos?.cod ?? ''}
                  </div>
                </div>
                <div className={cn('text-lg font-extrabold', cls)}>{s.cantidad}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 space-y-2">
        <Button className="w-full" onClick={() => onVista('carga')}>
          <Package className="h-4 w-4" />
          Cargar camioneta
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onVista('swap')}>
          <ArrowLeftRight className="h-4 w-4" />
          Registrar cambio / swap en obra
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onVista('devolucion')}>
          <ClipboardCheck className="h-4 w-4" />
          Registrar devolución a bodega
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => onVista('historial')}>
          <Clock className="h-4 w-4" />
          Ver historial de movimientos
        </Button>
        <Button
          variant="ghost"
          className="mt-3 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={eliminar}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar camioneta
        </Button>
      </div>
    </>
  );
}
