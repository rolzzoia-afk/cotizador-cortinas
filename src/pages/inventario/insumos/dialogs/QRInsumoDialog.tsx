// Modal con los 2 QRs imprimibles de un insumo:
// - QR del contenedor (INS:cod) — para pegar en la caja/bolsa.
// - QR de ubicación (LOC:rack|fila|col) — para pegar en el estante.
// Formato idéntico a legacy (public/legacy/inventario.html) para que los QRs
// físicos ya pegados en el taller sigan funcionando sin re-imprimir.

import { Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Insumo, UbicacionRack } from '@/modules/inventario/helpers';

const asciiPuro = (s: string | number | null | undefined): string =>
  String(s ?? '')
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '');

function rackToQRContent(rack: string, fila: string | number, col: string): string {
  return `LOC:${asciiPuro(rack)}|${asciiPuro(fila)}|${asciiPuro(col)}`;
}

function rackToDisplayLabel(rack: string, fila: string | number, col: string): string {
  return `${String(rack ?? '').trim()} · ${String(fila ?? '').trim()}-${String(col ?? '').trim()}`;
}

interface QRInsumoDialogProps {
  insumo: Insumo | null;
  ubicaciones: UbicacionRack[];
  onClose: () => void;
}

export default function QRInsumoDialog({ insumo, ubicaciones, onClose }: QRInsumoDialogProps) {
  if (!insumo) return null;

  const rackEntry = ubicaciones.find(
    (u) => (u.codigo_insumo || '').toUpperCase() === (insumo.cod || '').toUpperCase(),
  );

  let ubicacionDisplay = '';
  let ubicacionQR = '';
  if (rackEntry) {
    ubicacionDisplay = rackToDisplayLabel(rackEntry.rack, rackEntry.fila, rackEntry.columna);
    ubicacionQR = rackToQRContent(rackEntry.rack, rackEntry.fila, rackEntry.columna);
  } else if (insumo.ubicacion) {
    ubicacionDisplay = insumo.ubicacion;
    ubicacionQR = `LOC:${asciiPuro(insumo.ubicacion)}`;
  }

  const codQR = asciiPuro(insumo.cod);
  const nombre = insumo.nemotecnico || insumo.descriptor_proveedor || insumo.cod || '';

  const imprimir = () => {
    const canvasItem = document.getElementById('qr-canvas-item') as HTMLCanvasElement | null;
    const canvasLoc = document.getElementById('qr-canvas-loc') as HTMLCanvasElement | null;
    const imgItem = canvasItem?.toDataURL() || '';
    const imgLoc = canvasLoc?.toDataURL() || '';
    const w = window.open('', '_blank', 'width=640,height=480');
    if (!w) {
      toast.error('El navegador bloqueó la ventana de impresión. Habilitá popups.');
      return;
    }
    const html = `<!doctype html><html><head><title>QR ${insumo.cod}</title>
<style>
body { font-family: sans-serif; margin: 0; padding: 20px; }
.etiqueta { display: inline-block; border: 2px solid #000; border-radius: 8px; padding: 12px 16px;
            margin: 8px; text-align: center; width: 180px; vertical-align: top; }
.etiqueta img { width: 150px; height: 150px; display: block; margin: 0 auto 6px; }
.etiqueta .titulo { font-size: 11px; font-weight: bold; margin-bottom: 2px; }
.etiqueta .sub { font-size: 9px; color: #555; }
.etiqueta .tipo { font-size: 9px; background: #f0f0f0; border-radius: 3px; padding: 1px 5px; margin-bottom: 4px; display: inline-block; }
@media print { body { padding: 0; } }
</style></head>
<body>
${imgItem ? `<div class="etiqueta">
  <div class="tipo">CAJA / CONTENEDOR</div>
  <img src="${imgItem}" alt="QR Item">
  <div class="titulo">${nombre}</div>
  <div class="sub">Código: ${insumo.cod}</div>
  <div class="sub">INS:${insumo.cod}</div>
</div>` : ''}
${imgLoc && ubicacionDisplay ? `<div class="etiqueta">
  <div class="tipo">UBICACIÓN</div>
  <img src="${imgLoc}" alt="QR Loc">
  <div class="titulo">${ubicacionDisplay}</div>
  <div class="sub">Insumo: ${insumo.cod}</div>
  <div class="sub">${ubicacionQR}</div>
</div>` : ''}
<script>window.onload = () => setTimeout(() => { window.print(); window.close(); }, 250);</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Dialog open={!!insumo} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
          <p className="text-xs text-muted-foreground">Código: {insumo.cod}</p>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
            <div className="text-[0.68rem] font-semibold uppercase text-accent">
              QR del contenedor
            </div>
            <div className="rounded bg-white p-2">
              <QRCodeCanvas id="qr-canvas-item" value={`INS:${codQR}`} size={150} level="M" />
            </div>
            <div className="font-mono text-[0.68rem] text-muted-foreground">INS:{codQR}</div>
          </div>
          {ubicacionQR && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
              <div className="text-[0.68rem] font-semibold uppercase text-warning">
                QR de ubicación
              </div>
              <div className="rounded bg-white p-2">
                <QRCodeCanvas id="qr-canvas-loc" value={ubicacionQR} size={150} level="M" />
              </div>
              <div className="text-center text-[0.68rem] text-muted-foreground">
                {ubicacionDisplay}
                {rackEntry?.almacen && <div className="opacity-70">({rackEntry.almacen})</div>}
              </div>
            </div>
          )}
          {!ubicacionQR && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/40 p-3 text-center text-[0.7rem] text-muted-foreground">
              Sin ubicación asignada — solo se imprime el QR de contenedor.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={imprimir} className="gap-1.5 bg-accent hover:bg-accent">
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
