// Modal de detalle de una celda del rack (rack/fila/columna). Muestra
// el insumo en esa posición (si hay) + foto + stats + acciones rápidas.

import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type Insumo, getStockTotal } from '@/modules/inventario/helpers';
import InfoCell from '../components/InfoCell';

interface CellRackDialogProps {
  cellModal: { rack: string; fila: number; col: string } | null;
  onClose: () => void;
  codigoPorSlot: (rack: string, fila: number, col: string) => string | null;
  insumoByCod: Map<string, Insumo>;
  onVerEnCatalogo: (codigo: string) => void;
  onRegistrarEntrada: (codigo: string) => void;
}

export default function CellRackDialog({
  cellModal,
  onClose,
  codigoPorSlot,
  insumoByCod,
  onVerEnCatalogo,
  onRegistrarEntrada,
}: CellRackDialogProps) {
  return (
    <Dialog open={!!cellModal} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {cellModal ? `${cellModal.col}${cellModal.fila} — ${cellModal.rack}` : ''}
          </DialogTitle>
        </DialogHeader>
        {cellModal &&
          (() => {
            const codigo = codigoPorSlot(cellModal.rack, cellModal.fila, cellModal.col);
            const ins = codigo ? insumoByCod.get(codigo) : undefined;
            if (!codigo) {
              return (
                <div className="py-6 text-center text-muted-foreground">
                  <Package className="mx-auto mb-2 h-8 w-8 opacity-60" />
                  Posición vacía
                </div>
              );
            }
            return (
              <div className="py-1">
                {ins?.foto_url && (
                  <img
                    src={ins.foto_url}
                    alt=""
                    className="mx-auto mb-3 max-h-48 rounded border border-border object-contain"
                  />
                )}
                <div className="rounded-lg bg-card p-3">
                  <div className="font-mono text-lg font-semibold text-accent">{codigo}</div>
                  <div className="text-sm text-foreground">
                    {ins ? ins.nemotecnico || ins.descriptor_proveedor || '—' : 'Sin datos'}
                  </div>
                </div>
                {ins && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <InfoCell label="Stock">{getStockTotal(ins)}</InfoCell>
                    <InfoCell label="Mínimo">{ins.minimo || 0}</InfoCell>
                    <InfoCell label="Color">{ins.color || '—'}</InfoCell>
                    <InfoCell label="Categoría">{ins.categoria || '—'}</InfoCell>
                  </div>
                )}
                {ins && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onClose();
                        onVerEnCatalogo(codigo);
                      }}
                    >
                      Ver en catálogo
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        onClose();
                        onRegistrarEntrada(codigo);
                      }}
                    >
                      Registrar entrada
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
      </DialogContent>
    </Dialog>
  );
}
