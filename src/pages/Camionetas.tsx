// Orquestador de la pantalla Camionetas.
//
// Pantalla mobile-first con 6 vistas que se alternan según el state local
// `vista`: lista (main) → detalle → carga / swap / devolución / historial.
// Cada vista vive en su archivo bajo ./camionetas/vistas/.

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

import type { Camioneta, StockItem, Vista } from './camionetas/Camionetas.types';
import VistaMain from './camionetas/vistas/VistaMain';
import VistaDetalle from './camionetas/vistas/VistaDetalle';
import VistaCarga from './camionetas/vistas/VistaCarga';
import VistaSwap from './camionetas/vistas/VistaSwap';
import VistaDevolucion from './camionetas/vistas/VistaDevolucion';
import VistaHistorial from './camionetas/vistas/VistaHistorial';

export function Camionetas() {
  const { empresaId } = useAuth();
  const [vista, setVista] = useState<Vista>('main');
  const [camionetaActual, setCamionetaActual] = useState<Camioneta | null>(null);
  const [stockCamioneta, setStockCamioneta] = useState<StockItem[]>([]);
  const [abrirNueva, setAbrirNueva] = useState(false);

  const volverMain = () => {
    setCamionetaActual(null);
    setStockCamioneta([]);
    setVista('main');
  };

  const refrescarStock = async () => {
    if (!camionetaActual) return;
    const { data } = await supabase
      .from('inventario_camioneta')
      .select('*, insumos(nemotecnico, cod)')
      .eq('camioneta_id', camionetaActual.id)
      .gt('cantidad', 0)
      .order('cantidad', { ascending: false });
    setStockCamioneta((data as StockItem[]) ?? []);
  };

  const abrirCamioneta = async (c: Camioneta) => {
    setCamionetaActual(c);
    setVista('detalle');
  };

  useEffect(() => {
    if (vista === 'detalle') refrescarStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camionetaActual, vista]);

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-2">
        {vista !== 'main' && (
          <Button size="sm" variant="ghost" onClick={volverMain}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Truck className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-lg font-bold">
            {vista === 'main'
              ? 'Camionetas'
              : camionetaActual
                ? `🚐 ${camionetaActual.nombre}`
                : 'Camionetas'}
          </h1>
          {vista !== 'main' && camionetaActual?.patente && (
            <p className="text-xs text-muted-foreground">{camionetaActual.patente}</p>
          )}
        </div>
        {vista === 'main' && (
          <Button onClick={() => setAbrirNueva(true)} size="sm">
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        )}
      </header>

      {vista === 'main' && (
        <VistaMain
          empresaId={empresaId}
          onAbrir={abrirCamioneta}
          abrirNueva={abrirNueva}
          setAbrirNueva={setAbrirNueva}
        />
      )}
      {vista === 'detalle' && camionetaActual && (
        <VistaDetalle
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onVista={setVista}
          onRefresh={refrescarStock}
          onEliminada={volverMain}
        />
      )}
      {vista === 'carga' && camionetaActual && empresaId && (
        <VistaCarga
          camioneta={camionetaActual}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'swap' && camionetaActual && empresaId && (
        <VistaSwap
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'devolucion' && camionetaActual && empresaId && (
        <VistaDevolucion
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'historial' && camionetaActual && <VistaHistorial camioneta={camionetaActual} />}
    </div>
  );
}
