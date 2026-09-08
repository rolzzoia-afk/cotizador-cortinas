// Alertas y reposición: qué se está por acabar y qué hay que pedir.
//
// La lista es la misma de siempre; lo que cambia es que pedir una reposición ya
// no pasa por el `window.prompt` del navegador, que no dejaba escribir con coma
// y no mostraba cuánto había.

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { StatBox } from '@/components/ui/stat-box';
import { DialogoReposicion } from '@/components/inventario/DialogoReposicion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { calcularAlertas, getStockTotal, mesActual, type Insumo } from '@/modules/inventario/helpers';
import { useInsumos } from '@/modules/inventario/insumosStore';
import AlertasTab from '../insumos/tabs/AlertasTab';
import { useInventario } from '../InventarioLayout';

export function VistaAlertas() {
  const { queryRol, puedeEditar } = useInventario();
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const { insumos, loading, error, recargar } = useInsumos();
  const [pedido, setPedido] = useState<{ insumo: Insumo; sugerida: number } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const alertas = useMemo(() => calcularAlertas(insumos), [insumos]);
  const alertasOrdenadas = useMemo(
    () => [...alertas].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'SIN_STOCK' ? -1 : 1)),
    [alertas],
  );
  const insumoByCod = useMemo(() => {
    const m = new Map<string, Insumo>();
    for (const i of insumos) if (i.cod) m.set(i.cod, i);
    return m;
  }, [insumos]);

  const sinStock = alertas.filter((a) => a.tipo === 'SIN_STOCK').length;
  const bajoMinimo = alertas.filter((a) => a.tipo === 'STOCK_BAJO').length;
  const sinMinimo = insumos.filter((i) => !i.minimo || Number(i.minimo) <= 0).length;

  const abrirPedido = (codigo: string, falta: number) => {
    const insumo = insumoByCod.get(codigo);
    if (!insumo) return;
    setPedido({ insumo, sugerida: Math.max(1, Math.ceil(falta || 1)) });
  };

  const confirmarPedido = async (cantidad: number) => {
    if (!pedido || !empresaId) return;
    const { insumo } = pedido;
    const codigo = insumo.cod || '';
    if (!codigo) {
      toast.error('Ese artículo no tiene código: no se puede pedir.');
      return;
    }
    const nombre = insumo.nemotecnico || insumo.descriptor_proveedor || codigo;
    setGuardando(true);
    try {
      const { error: err } = await supabase.from('movimientos_insumos').insert({
        empresa_id: empresaId,
        fecha: new Date().toISOString(),
        mes: mesActual(),
        tipo: 'PEDIDO REPOSICION',
        codigo,
        producto: nombre,
        almacen: 'MP',
        // La columna es entera: un pedido de 2,5 cajas no se puede guardar.
        cantidad: Math.round(cantidad),
        responsable_entrega: 'Inventario',
        bitacora: `Pedido de reposición: ${nombre}`,
      });
      if (err) throw err;
      toast.success(`Pedido registrado: ${Math.round(cantidad)} de ${nombre}`);
      setPedido(null);
      await recargar();
    } catch (e) {
      toast.error('No se pudo registrar el pedido: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Alertas y reposición"
        hint={
          loading
            ? 'Cargando…'
            : 'Qué está por acabarse y qué hay que pedir. El punto de reposición se edita en la ficha del artículo.'
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox
          rotulo="Sin stock"
          valor={sinStock}
          tono={sinStock > 0 ? 'destructive' : 'neutro'}
          hint="frenan el armado"
        />
        <StatBox
          rotulo="Bajo mínimo"
          valor={bajoMinimo}
          tono={bajoMinimo > 0 ? 'warning' : 'neutro'}
          hint="conviene pedirlos ya"
        />
        <StatBox
          rotulo="Sin mínimo definido"
          valor={sinMinimo}
          hint="nunca van a avisar solos"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <AlertasTab
          alertasOrdenadas={alertasOrdenadas}
          insumoByCod={insumoByCod}
          onVerEnCatalogo={() => navigate(`/inventario/insumos${queryRol}`)}
          onRegistrarReposicion={puedeEditar ? abrirPedido : () => {}}
        />
      )}

      {pedido ? (
        <DialogoReposicion
          abierto
          codigo={pedido.insumo.cod || ''}
          nombre={
            pedido.insumo.nemotecnico || pedido.insumo.descriptor_proveedor || pedido.insumo.cod || ''
          }
          stockActual={getStockTotal(pedido.insumo)}
          minimo={Number(pedido.insumo.minimo || 0)}
          sugerida={pedido.sugerida}
          guardando={guardando}
          onCerrar={() => setPedido(null)}
          onConfirmar={({ cantidad }) => void confirmarPedido(cantidad)}
        />
      ) : null}
    </div>
  );
}

export default VistaAlertas;
