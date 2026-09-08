// Modal con los 2 QR de una tela: QR del rollo (TEL:codigo) + QR de la
// posición física (LOC:posicion|almacen). El QR de posición solo aparece
// si la tela está cargada en un slot del rack.

import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { telaToQRContent } from '@/modules/telas/rackMaps';
import type { Colmena, Tela } from '../Telas.types';

interface QRTelaDialogProps {
  tela: Tela;
  colmena: Colmena;
  onClose: () => void;
}

export default function QRTelaDialog({ tela, colmena, onClose }: QRTelaDialogProps) {
  const entrada = Object.entries(colmena).find(([, data]) => data.codigo === tela.codigo);
  const posicion = entrada ? entrada[0] : null;
  const almacen = entrada ? entrada[1].almacen : null;

  const codSafe = (tela.codigo || '').replace(/[^\x20-\x7E]/g, '').trim();

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-accent" />
            {tela.nemotecnico || tela.codigo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Código: {tela.codigo}
            {tela.tipo ? ` · Tipo: ${tela.tipo}` : ''}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-black">
            <QRCodeSVG value={`TEL:${codSafe}`} size={160} level="M" />
            <div className="text-center text-[11px] font-semibold">TEL:{codSafe}</div>
          </div>
          {posicion && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-black">
              <QRCodeSVG value={telaToQRContent(posicion, almacen)} size={160} level="M" />
              <div className="text-center text-[11px] font-semibold">
                Pos. {posicion}
                {almacen ? ` · ${almacen}` : ''}
              </div>
            </div>
          )}
        </div>

        {!posicion && (
          <p className="text-center text-xs text-muted-foreground">
            Sin posición física asignada aún. El QR de ubicación aparece cuando la tela está
            cargada en un slot del rack.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
