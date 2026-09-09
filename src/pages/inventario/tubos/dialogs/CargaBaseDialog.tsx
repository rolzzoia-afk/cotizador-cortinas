// «Carga base»: el inventario inicial de tubería, desde el encabezado de la
// pantalla de Tubos.
//
// Envuelve la sección que ya vive en Admin → Sistema en vez de copiarla: es la
// misma operación y tiene sus propias confirmaciones. Acá solo se le pone una
// puerta desde donde se trabaja con los tubos.

import { InventoryBaselineSection } from '@/components/admin/InventoryBaselineSection';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CargaBaseDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Carga base de tubería</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-muted-foreground">
          El inventario inicial de la colmena. Es la misma operación de Admin → Sistema; el
          optimizador sigue siendo el único que mueve los tubos después.
        </p>
        <InventoryBaselineSection />
      </DialogContent>
    </Dialog>
  );
}

export default CargaBaseDialog;
