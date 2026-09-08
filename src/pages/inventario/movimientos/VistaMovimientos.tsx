// Kardex: todo lo que entró, salió o se movió.
//
// Con el interruptor `kardexRpc` encendido aparece el LIBRO: un solo registro
// para insumos y telas, con el saldo que quedó después de cada movimiento.
// Apagado —y siempre, en las otras dos pestañas— están los dos registros
// viejos, que siguen ahí para poder mirar lo de antes.

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
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import TablaKardex from './TablaKardex';
import { useInventario } from '../InventarioLayout';

type Pestana = 'libro' | 'insumos' | 'telas';

export function VistaMovimientos() {
  useInventario(); // asegura que la vista corre dentro del layout del módulo
  const { empresaId } = useAuth();
  const { flags, loading: cargandoFlags } = useFlagsInventario();
  // Con el libro encendido, es lo primero que se ve; los registros viejos
  // quedan a un clic, para consultar lo de antes.
  const [pestana, setPestana] = useState<Pestana | null>(null);
  const activa: Pestana = pestana ?? (flags.kardexRpc ? 'libro' : 'insumos');
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
  const cargando = activa === 'insumos' ? insumos.loading : activa === 'telas' ? telas.loading : false;
  const error = activa === 'insumos' ? insumos.error : activa === 'telas' ? telas.error : null;

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

      {!flags.kardexRpc && !cargandoFlags && (
        <div className="rounded-lg border border-accent/35 bg-accent/[0.09] px-4 py-3 text-xs leading-relaxed">
          Los movimientos de insumos y de telas todavía se guardan por separado, y ninguno dice en
          cuánto quedó el artículo. Para tener el registro único hay que encender «Registrar los
          movimientos en la base», en Inventario → Configuración.
        </div>
      )}

      <div className="flex items-center gap-5 border-b border-border">
        {flags.kardexRpc && (
          <TabButton
            variante="subrayado"
            active={activa === 'libro'}
            onClick={() => setPestana('libro')}
          >
            Libro
          </TabButton>
        )}
        <TabButton
          variante="subrayado"
          active={activa === 'insumos'}
          onClick={() => setPestana('insumos')}
          badge={
            <Badge variant="muted">{insumos.movimientos.length.toLocaleString('es-CL')}</Badge>
          }
        >
          {flags.kardexRpc ? 'Insumos (registro viejo)' : 'Insumos'}
        </TabButton>
        <TabButton
          variante="subrayado"
          active={activa === 'telas'}
          onClick={() => setPestana('telas')}
          badge={<Badge variant="muted">{telas.movimientos.length.toLocaleString('es-CL')}</Badge>}
        >
          {flags.kardexRpc ? 'Telas (registro viejo)' : 'Telas'}
        </TabButton>
      </div>

      {activa === 'libro' ? (
        <TablaKardex />
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : cargando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : activa === 'insumos' ? (
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
