// Kardex: todo lo que entró, salió o se movió.
//
// En esta entrega son las dos listas que ya existían —insumos y telas— puestas
// una al lado de la otra. El kardex de verdad, con un solo registro para las
// dos y el saldo después de cada movimiento, llega con la RPC de la Entrega B.

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { useAuth } from '@/lib/auth';
import { esEntrada, type Movimiento } from '@/modules/inventario/helpers';
import { useInsumos } from '@/modules/inventario/insumosStore';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import MovimientosInsumosTab from '../insumos/tabs/MovimientosTab';
import MovimientosTelasTab from '../telas/tabs/MovimientosTab';
import DetalleMovDialog from '../insumos/dialogs/DetalleMovDialog';
import { useInventario } from '../InventarioLayout';

type Pestana = 'insumos' | 'telas';

export function VistaMovimientos() {
  useInventario(); // asegura que la vista corre dentro del layout del módulo
  const { empresaId } = useAuth();
  const [pestana, setPestana] = useState<Pestana>('insumos');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [detalle, setDetalle] = useState<Movimiento | null>(null);

  const insumos = useInsumos();
  const telas = useDatosTelas();

  const movimientosFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    return insumos.movimientos.filter((m) => {
      if (filtroTipo && m.tipo !== filtroTipo) return false;
      if (!q) return true;
      return (
        (m.codigo || '').toUpperCase().includes(q) ||
        (m.producto || '').toUpperCase().includes(q) ||
        (m.ot || '').toUpperCase().includes(q)
      );
    });
  }, [insumos.movimientos, busqueda, filtroTipo]);

  const hoy = new Date().toISOString().split('T')[0];
  const deHoy = insumos.movimientos.filter((m) => (m.fecha || '').startsWith(hoy));
  const cargando = pestana === 'insumos' ? insumos.loading : telas.loading;
  const error = pestana === 'insumos' ? insumos.error : telas.error;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Kardex"
        hint={
          insumos.loading
            ? 'Cargando…'
            : `${deHoy.length} movimientos hoy · ${deHoy.filter((m) => esEntrada(m.tipo)).length} entradas · se muestran los últimos 500`
        }
      />

      <div className="rounded-lg border border-accent/35 bg-accent/[0.09] px-4 py-3 text-xs leading-relaxed">
        Los movimientos de insumos y de telas todavía se guardan por separado.
        El registro único —con el saldo que queda después de cada movimiento y el
        histórico de tubos y paños en solo lectura— llega en la próxima entrega.
      </div>

      <div className="flex items-center gap-5 border-b border-border">
        <TabButton
          variante="subrayado"
          active={pestana === 'insumos'}
          onClick={() => setPestana('insumos')}
          badge={
            <Badge variant="muted">{insumos.movimientos.length.toLocaleString('es-CL')}</Badge>
          }
        >
          Insumos
        </TabButton>
        <TabButton
          variante="subrayado"
          active={pestana === 'telas'}
          onClick={() => setPestana('telas')}
          badge={<Badge variant="muted">{telas.movimientos.length.toLocaleString('es-CL')}</Badge>}
        >
          Telas
        </TabButton>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : cargando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pestana === 'insumos' ? (
        <MovimientosInsumosTab
          movimientosFiltrados={movimientosFiltrados}
          busquedaMov={busqueda}
          setBusquedaMov={setBusqueda}
          filtroTipoMov={filtroTipo}
          setFiltroTipoMov={setFiltroTipo}
          // Registrar un movimiento se hace desde Insumos, que es donde está el
          // artículo y su saldo. Acá solo se mira lo que ya pasó.
          onNuevoMov={() => {}}
          onSeleccionar={setDetalle}
        />
      ) : (
        <MovimientosTelasTab
          movimientos={telas.movimientos}
          telas={telas.telas}
          validadores={telas.validadores}
          empresaId={empresaId || ''}
          onReload={telas.recargar}
        />
      )}

      {detalle ? <DetalleMovDialog mov={detalle} onClose={() => setDetalle(null)} /> : null}
    </div>
  );
}

export default VistaMovimientos;
