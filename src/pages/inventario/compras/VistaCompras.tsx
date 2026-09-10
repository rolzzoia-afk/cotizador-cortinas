// Compras (lámina «Compras»).
//
// El circuito completo, y de dónde sale cada pieza:
//
//   Inventario ve los faltantes  →  levanta una SOLICITUD  →  Gerencia la
//   recibe en Rolzzo-Finanzas  →  emite y aprueba la ORDEN DE COMPRA  →  la
//   bodega la ve en espera  →  llega la mercadería  →  la recibe pieza por pieza
//
// Las órdenes NACEN EN OTRO SISTEMA: acá vive una copia de trabajo que se
// refresca desde allá. Por eso no hay «nueva orden»: eso lo hace Gerencia.
//
// SIN MONTOS: en la copia no hay ninguna columna de plata, así que esta
// pantalla se le puede mostrar al taller completo.
//
// Con el interruptor apagado se muestra el aviso de siempre y ninguna de las
// funciones de la base deja escribir nada.

import { useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { esRolAdmin } from '@/lib/roles';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { useOrdenesCompra, useProveedoresCompras, useSolicitudes } from '@/modules/inventario/comprasStore';
import { useInventario } from '../InventarioLayout';
import OrdenesTab from './OrdenesTab';
import ProveedoresTab from './ProveedoresTab';
import SolicitudesTab from './SolicitudesTab';

type Pestana = 'solicitudes' | 'ordenes' | 'proveedores';

export function VistaCompras() {
  const { queryRol, puedeEditar, rol } = useInventario();
  const { flags, loading: cargandoFlags } = useFlagsInventario();
  const encendido = flags.compras;
  // Hablar con Finanzas y editar los alias es de administración: es la puerta
  // a otro sistema y a datos que la bodega no puede arreglar sola.
  const esAdmin = esRolAdmin(rol);

  const [tab, setTab] = useState<Pestana>('ordenes');

  const solicitudes = useSolicitudes(encendido);
  const ordenes = useOrdenesCompra(encendido);
  const proveedores = useProveedoresCompras(encendido);

  const recargarTodo = async () => {
    await Promise.all([solicitudes.recargar(), ordenes.recargar(), proveedores.recargar()]);
  };

  if (cargandoFlags) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!encendido) {
    return <ComprasApagado />;
  }

  const abierta = solicitudes.abierta;
  const error = solicitudes.error || ordenes.error || proveedores.error;
  const cargando = solicitudes.loading || ordenes.loading;

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        miga="Inventario"
        titulo="Compras"
        hint="Bodega pide lo que falta, Gerencia emite la orden, y acá se ve qué está por llegar."
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={tab === 'solicitudes'}
          onClick={() => setTab('solicitudes')}
          badge={
            abierta ? (
              <Badge variant="accent">{(abierta.lineas ?? []).length}</Badge>
            ) : (
              <Badge variant="muted">{solicitudes.solicitudes.length}</Badge>
            )
          }
        >
          Lo que pedimos
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'ordenes'}
          onClick={() => setTab('ordenes')}
          badge={<Badge variant={tab === 'ordenes' ? 'accent' : 'muted'}>{ordenes.ordenes.length}</Badge>}
        >
          Órdenes de compra
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'proveedores'}
          onClick={() => setTab('proveedores')}
          badge={<Badge variant="muted">{proveedores.proveedores.length}</Badge>}
        >
          Proveedores
        </TabButton>
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === 'solicitudes' ? (
        <SolicitudesTab
          solicitudes={solicitudes.solicitudes}
          puedeEditar={puedeEditar}
          queryRol={queryRol}
          onCambio={recargarTodo}
        />
      ) : tab === 'ordenes' ? (
        <OrdenesTab
          ordenes={ordenes.ordenes}
          ultimaSync={ordenes.ultimaSync}
          errorSync={ordenes.errorSync}
          puedeSincronizar={esAdmin}
          queryRol={queryRol}
          onCambio={recargarTodo}
        />
      ) : (
        <ProveedoresTab
          proveedores={proveedores.proveedores}
          ordenes={ordenes.ordenes}
          puedeEditar={esAdmin}
          onCambio={recargarTodo}
        />
      )}
    </div>
  );
}

/**
 * Con el interruptor apagado: el alcance acordado, sin datos de mentira. Una
 * pantalla con órdenes inventadas se lee como si el módulo funcionara.
 */
function ComprasApagado() {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-warning/35 bg-warning/[0.09] px-4 py-3 text-xs leading-relaxed">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <b className="font-semibold">El módulo está construido, pero apagado.</b> Se enciende en
          Inventario → Configuración → Interruptores, y antes hay que correr los dos SQL y dejar
          configurada la llave del proyecto de Finanzas.
        </span>
        <Badge variant="warning">Apagado</Badge>
      </div>

      <PageHeader
        miga="Inventario"
        titulo="Compras"
        hint="Bodega pide lo que falta, Gerencia emite la orden, y acá se ve qué está por llegar."
      />

      <div className="grid gap-2.5 lg:grid-cols-3">
        <Paso numero={1} titulo="Bodega pide">
          Lo que está bajo el mínimo se marca en Alertas y se suma a una solicitud. Se revisa,
          se agrupa por proveedor y se manda a Gerencia.
        </Paso>
        <Paso numero={2} titulo="Gerencia compra">
          La orden se emite y se aprueba en Finanzas, que es donde vive la plata. Acá llega una
          copia <b className="font-medium text-foreground">sin montos</b>, con lo que hay que
          esperar.
        </Paso>
        <Paso numero={3} titulo="Bodega recibe">
          Llega el camión, se busca la orden por el número de guía y se recibe pieza por pieza.
          Entra al stock por el mismo camino que todo lo demás.
        </Paso>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
        <b className="font-medium text-foreground">Lo que falta para encenderlo:</b> correr{' '}
        <span className="font-mono">sql/finanzas/20260911_bodega_contrato.sql</span> en el proyecto
        de Rolzzo-Finanzas, <span className="font-mono">sql/20260911_compras_01_solicitudes_ordenes.sql</span>{' '}
        en el nuestro, y configurar los secretos{' '}
        <span className="font-mono">FINANZAS_URL</span> y{' '}
        <span className="font-mono">FINANZAS_SERVICE_KEY</span>.
      </div>
    </div>
  );
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/[0.15] font-mono text-[0.72rem] font-semibold text-accent">
          {numero}
        </span>
        <b className="text-[0.84rem] font-medium">{titulo}</b>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export default VistaCompras;
