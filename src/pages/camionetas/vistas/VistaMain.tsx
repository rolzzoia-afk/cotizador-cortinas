// Vista principal: lista de camionetas activas con un resumen de stock.

import { useEffect, useState } from 'react';
import { BoxIcon, Car, ChevronRight, Package, Truck, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../components/EmptyState';
import NuevaCamionetaDialog from '../components/NuevaCamionetaDialog';
import type { Camioneta, StockItem } from '../Camionetas.types';

interface VistaMainProps {
  empresaId: string | null;
  onAbrir: (c: Camioneta) => void;
  abrirNueva: boolean;
  setAbrirNueva: (v: boolean) => void;
}

export default function VistaMain({
  empresaId,
  onAbrir,
  abrirNueva,
  setAbrirNueva,
}: VistaMainProps) {
  const [cams, setCams] = useState<Camioneta[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, StockItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data: camsData } = await supabase
      .from('camionetas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activa', true)
      .order('nombre');
    const list = (camsData as Camioneta[]) ?? [];
    setCams(list);

    if (list.length > 0) {
      const { data: stockData } = await supabase
        .from('inventario_camioneta')
        .select('id, camioneta_id, insumo_id, cantidad')
        .in('camioneta_id', list.map((c) => c.id));
      const map = new Map<string, StockItem[]>();
      for (const s of (stockData as StockItem[]) ?? []) {
        if (!map.has(s.camioneta_id)) map.set(s.camioneta_id, []);
        map.get(s.camioneta_id)!.push(s);
      }
      setStockMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  if (loading) return <EmptyState>Cargando camionetas…</EmptyState>;

  if (cams.length === 0) {
    return (
      <>
        <EmptyState>
          <Truck className="mx-auto mb-3 h-10 w-10 opacity-40" />
          No hay camionetas registradas.
          <p className="mt-2 text-xs">Toca + para agregar la primera.</p>
        </EmptyState>
        <NuevaCamionetaDialog
          open={abrirNueva}
          onOpenChange={setAbrirNueva}
          empresaId={empresaId}
          onCreada={cargar}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {cams.map((cam) => {
          const stock = stockMap.get(cam.id) ?? [];
          const totalItems = stock.reduce((s, x) => s + x.cantidad, 0);
          const tipos = stock.filter((s) => s.cantidad > 0).length;
          return (
            <button
              key={cam.id}
              onClick={() => onAbrir(cam)}
              className="w-full cursor-pointer rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🚐</div>
                <div className="flex-1">
                  <div className="text-base font-bold">{cam.nombre}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {cam.patente && (
                      <>
                        <Car className="mr-1 inline h-3 w-3" />
                        {cam.patente}
                      </>
                    )}
                    {cam.instalador && (
                      <>
                        {' · '}
                        <User className="mr-1 inline h-3 w-3" />
                        {cam.instalador}
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tipos === 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" />
                    Vacía
                  </Badge>
                ) : (
                  <>
                    <Badge variant="success" className="gap-1">
                      <BoxIcon className="h-3 w-3" />
                      {tipos} tipo{tipos > 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="success" className="gap-1">
                      {totalItems} unidades
                    </Badge>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <NuevaCamionetaDialog
        open={abrirNueva}
        onOpenChange={setAbrirNueva}
        empresaId={empresaId}
        onCreada={cargar}
      />
    </>
  );
}
