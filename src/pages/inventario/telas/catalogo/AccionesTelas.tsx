// Los botones del encabezado del catálogo de telas (lámina «Telas»).
//
// La lámina deja tres a la vista. Las que se usan una vez al mes —exportar la
// base para el P-touch, combinar dos códigos en una etiqueta, clonar un código
// de cortina— viven en los menús: siguen estando, pero no compiten por la
// atención con «Nueva tela».

import { FileUp, Layers, MoreHorizontal, Plus, Printer, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ItemMenu, MenuAcciones, SeparadorMenu } from '@/components/inventario/MenuAcciones';

export function AccionesTelas({
  marcadas,
  visibles,
  puedeEditar,
  verMontos,
  onImprimirCatalogo,
  onCombinar,
  onExportarPtouch,
  onImportar,
  onNueva,
  onClonar,
}: {
  /** Cuántas telas están marcadas con la casilla. */
  marcadas: number;
  /** Cuántas se ven con los filtros puestos. */
  visibles: number;
  puedeEditar: boolean;
  /** Importar y clonar tocan precios: solo quien ve la plata. */
  verMontos: boolean;
  onImprimirCatalogo: () => void;
  onCombinar: () => void;
  onExportarPtouch: () => void;
  onImportar: () => void;
  onNueva: () => void;
  onClonar: () => void;
}) {
  return (
    <>
      <MenuAcciones
        etiqueta="Etiquetas"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary"
        disparador={
          <>
            <Tags className="h-4 w-4" />
            Etiquetas
          </>
        }
      >
        <ItemMenu
          onClick={onImprimirCatalogo}
          hint={
            marcadas > 0
              ? `Una por cada una de las ${marcadas} marcadas`
              : `Una por cada una de las ${visibles.toLocaleString('es-CL')} que se ven ahora`
          }
        >
          <Printer className="h-3.5 w-3.5" /> Etiqueta de catálogo
        </ItemMenu>
        <ItemMenu
          onClick={onCombinar}
          deshabilitado={marcadas < 2}
          hint={
            marcadas < 2
              ? 'Marca dos o más telas en la tabla'
              : 'Los códigos juntos en una sola etiqueta; el resto sale de la primera que marcaste'
          }
        >
          <Layers className="h-3.5 w-3.5" /> Combinar las marcadas en una
        </ItemMenu>
        <SeparadorMenu />
        <ItemMenu
          onClick={onExportarPtouch}
          hint="El Excel que el P-touch Editor lee como base de datos"
        >
          <Tags className="h-3.5 w-3.5" /> Exportar para la Brother
        </ItemMenu>
      </MenuAcciones>

      {puedeEditar && (
        <>
          {verMontos && (
            <Button variant="outline" onClick={onImportar}>
              <FileUp className="h-4 w-4" />
              Importar catálogo
            </Button>
          )}
          <Button onClick={onNueva}>
            <Plus className="h-4 w-4" />
            Nueva tela
          </Button>
          {verMontos && (
          <MenuAcciones
            etiqueta="Más acciones del catálogo"
            className="rounded-lg border border-border p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            disparador={<MoreHorizontal className="h-4 w-4" />}
          >
            <ItemMenu
              onClick={onClonar}
              hint="Un código de cortina nuevo que hereda la familia de uno que ya existe, para cotizar"
            >
              Clonar un código de cortina
            </ItemMenu>
          </MenuAcciones>
          )}
        </>
      )}
    </>
  );
}

export default AccionesTelas;
