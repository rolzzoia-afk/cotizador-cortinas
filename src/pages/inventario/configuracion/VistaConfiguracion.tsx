// Configuración del módulo. Por ahora dos cosas: los racks tal como están
// definidos (solo lectura) y los interruptores del módulo.
//
// Almacenes, unidades y validadores editables llegan con las tablas de la
// Entrega C; hoy los almacenes son texto suelto en cada fila.

import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { ETIQUETAS_ALMACEN } from '@/modules/inventario/almacenes';
import type { FlagsInventario } from '@/modules/inventario/flags';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { RACKS_LIBERADO, RACKS_MATERIAS_PRIMAS } from '@/modules/inventario/rackConfig';

function TablaRacks({ titulo, racks }: { titulo: string; racks: typeof RACKS_LIBERADO }) {
  const celdas = racks.reduce((n, r) => n + r.filas * r.columnas.length, 0);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <h2 className="font-serif text-[0.9375rem] font-medium">{titulo}</h2>
        <Badge variant="muted" className="ml-auto">
          {racks.length} racks · {celdas.toLocaleString('es-CL')} posiciones
        </Badge>
      </div>
      <table className="w-full text-[0.8125rem]">
        <thead>
          <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="h-9 px-4 text-left font-medium">Rack</th>
            <th className="h-9 px-4 text-right font-medium">Filas</th>
            <th className="h-9 px-4 text-left font-medium">Columnas</th>
          </tr>
        </thead>
        <tbody>
          {racks.map((r) => (
            <tr key={r.nombre} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{r.nombre}</td>
              <td className="px-4 py-2 text-right font-mono">{r.filas}</td>
              <td className="px-4 py-2 font-mono text-muted-foreground">
                {r.columnas.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ROTULOS_FLAGS: Array<{ id: keyof FlagsInventario; titulo: string; detalle: string }> = [
  {
    id: 'kardexRpc',
    titulo: 'Registrar los movimientos en la base',
    detalle:
      'Hoy el stock se ajusta desde el navegador con dos escrituras sueltas: si dos personas registran a la vez, una se pierde. Con esto encendido lo hace la base en una sola operación.',
  },
  {
    id: 'dualWrite',
    titulo: 'Escribir también en el registro viejo',
    detalle:
      'Copia de respaldo mientras conviven los dos registros, para que ninguna pantalla quede ciega.',
  },
  {
    id: 'bloqueoDirecto',
    titulo: 'Rechazar escrituras que no pasen por la base',
    detalle: 'Primero se avisa en un registro aparte; recién después se bloquea.',
  },
  {
    id: 'compras',
    titulo: 'Mostrar Compras',
    detalle: 'Proveedores, órdenes de compra y recepción de facturas. Espera a la jefatura.',
  },
];

export function VistaConfiguracion() {
  const { flags, loading } = useFlagsInventario();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Configuración"
        hint="Cómo está armada la bodega por dentro. Los racks se cambian en el código; los almacenes y las unidades pasan a ser editables en la próxima entrega."
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-[0.9375rem] font-medium">Interruptores del módulo</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          El cambio de cómo se guarda el stock se enciende por partes y se puede apagar en el
          acto. Todavía no hay nada que encender: se activan cuando el registro nuevo esté en la
          base.
        </p>
        <div className="mt-3 flex flex-col divide-y divide-border">
          {ROTULOS_FLAGS.map((f) => (
            <div key={f.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-[0.845rem] font-medium">{f.titulo}</div>
                <p className="mt-0.5 text-xs text-muted-foreground">{f.detalle}</p>
              </div>
              <Badge
                variant={flags[f.id] ? 'success' : 'muted'}
                className="ml-auto mt-0.5 shrink-0"
              >
                {loading ? '…' : flags[f.id] ? 'Encendido' : 'Apagado'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-[0.9375rem] font-medium">Almacenes</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          El mismo lugar se escribe hoy de cuatro maneras según la pantalla que lo haya guardado.
          Estos son los nombres únicos con los que el sistema los reconoce ahora.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(ETIQUETAS_ALMACEN).map(([codigo, nombre]) => (
            <Badge key={codigo} variant="outline">
              <span className="font-mono font-semibold">{codigo}</span>
              <span className="text-muted-foreground">{nombre}</span>
            </Badge>
          ))}
          <Badge variant="outline">
            <span className="font-mono font-semibold">CAM-n</span>
            <span className="text-muted-foreground">una por camioneta</span>
          </Badge>
        </div>
      </div>

      <TablaRacks titulo="Racks de Liberado" racks={RACKS_LIBERADO} />
      <TablaRacks titulo="Racks de Materias primas" racks={RACKS_MATERIAS_PRIMAS} />
    </div>
  );
}

export default VistaConfiguracion;
