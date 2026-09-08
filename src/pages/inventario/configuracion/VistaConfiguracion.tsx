// Configuración del módulo. Por ahora dos cosas: los racks tal como están
// definidos (solo lectura) y los interruptores del módulo.
//
// Almacenes, unidades y validadores editables llegan con las tablas de la
// Entrega C; hoy los almacenes son texto suelto en cada fila.

import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { ETIQUETAS_ALMACEN } from '@/modules/inventario/almacenes';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { RACKS_LIBERADO, RACKS_MATERIAS_PRIMAS } from '@/modules/inventario/rackConfig';
import { useInventario } from '../InventarioLayout';
import InterruptoresSection from './InterruptoresSection';
import SaldosVsKardexSection from './SaldosVsKardexSection';

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

export function VistaConfiguracion() {
  const { flags } = useFlagsInventario();
  const { puedeEditar } = useInventario();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Configuración"
        hint="Cómo está armada la bodega por dentro. Los racks se cambian en el código; los almacenes y las unidades pasan a ser editables en la próxima entrega."
      />

      <InterruptoresSection puedeEditar={puedeEditar} />
      <SaldosVsKardexSection activo={flags.kardexRpc} />

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
