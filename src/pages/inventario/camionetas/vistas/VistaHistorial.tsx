// Vista de historial: últimos 80 movimientos de la camioneta con color por
// tipo y badges del módulo Camionetas.config.

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../components/EmptyState';
import { TIPO_BADGE, TIPO_LABEL } from '../Camionetas.config';
import type { Camioneta, Movimiento } from '../Camionetas.types';

const BORDER_COLOR: Record<Movimiento['tipo'], string> = {
  carga: '#3b82f6',
  uso: '#22c55e',
  swap_salida: '#f97316',
  swap_entrada: '#f59e0b',
  devolucion: '#a78bfa',
  defectuoso: '#ef4444',
};

interface VistaHistorialProps {
  camioneta: Camioneta;
}

export default function VistaHistorial({ camioneta }: VistaHistorialProps) {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('movimientos_camioneta')
        .select('*, insumos(nemotecnico, cod)')
        .eq('camioneta_id', camioneta.id)
        .order('created_at', { ascending: false })
        .limit(80);
      setMovs((data as Movimiento[]) ?? []);
      setLoading(false);
    };
    run();
  }, [camioneta.id]);

  if (loading) return <EmptyState>Cargando historial…</EmptyState>;
  if (movs.length === 0)
    return (
      <EmptyState>
        <Clock className="mx-auto mb-3 h-10 w-10 opacity-40" />
        Sin movimientos aún.
      </EmptyState>
    );

  return (
    <div className="space-y-2">
      {movs.map((m) => {
        const nombre = m.insumos?.nemotecnico ?? m.insumos?.cod ?? m.insumo_id;
        const fecha = new Date(m.created_at).toLocaleString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div
            key={m.id}
            className="rounded-lg border-l-4 bg-card px-4 py-2.5"
            style={{ borderLeftColor: BORDER_COLOR[m.tipo] }}
          >
            <div className="flex items-center gap-2">
              <Badge variant={TIPO_BADGE[m.tipo]}>{TIPO_LABEL[m.tipo]}</Badge>
              <span className="text-xs text-muted-foreground">×{m.cantidad}</span>
            </div>
            <div className="mt-1 text-sm font-semibold">{nombre}</div>
            {m.motivo && (
              <div className="text-xs italic text-muted-foreground">"{m.motivo}"</div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {fecha}
              {m.registrado_por ? ` · ${m.registrado_por}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
