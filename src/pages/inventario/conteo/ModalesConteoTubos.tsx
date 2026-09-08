// Los dos modales del conteo de tubos: confirmar una acción y cerrar con firma.
// Salieron del archivo de la Colmena.

import { useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';

import { Label } from '@/components/ui/label';

export function ModalAccion({
  titulo,
  descripcion,
  textareaLabel,
  textareaValor,
  setTextareaValor,
  onConfirmar,
  onCancelar,
  confirmando,
  confirmarTexto,
  confirmarColor,
  confirmarDisabled,
}: {
  titulo: string;
  descripcion: string;
  textareaLabel: string;
  textareaValor: string;
  setTextareaValor: (v: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  confirmando: boolean;
  confirmarTexto: string;
  confirmarColor: 'emerald' | 'red';
  confirmarDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onCancelar}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-sm font-semibold">{titulo}</div>
        <p className="mb-3 text-xs text-muted-foreground">{descripcion}</p>
        <Label className="text-xs text-foreground">{textareaLabel}</Label>
        <textarea
          value={textareaValor}
          onChange={(e) => setTextareaValor(e.target.value)}
          rows={3}
          autoFocus
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelar} disabled={confirmando} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onConfirmar}
            disabled={confirmando || !!confirmarDisabled}
            className={cn(
              'h-8 gap-1',
              confirmarColor === 'emerald' && 'bg-success hover:bg-success/90',
              confirmarColor === 'red' && 'bg-destructive hover:bg-destructive',
            )}
          >
            {confirmando ? 'Procesando…' : confirmarTexto}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ModalCerrarInventario({
  confirmando,
  onConfirmar,
  onCancelar,
}: {
  confirmando: boolean;
  onConfirmar: (firmaPng: string, notas: string) => void;
  onCancelar: () => void;
}) {
  const [notas, setNotas] = useState('');
  const [firmaPresente, setFirmaPresente] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  const limpiar = () => {
    sigRef.current?.clear();
    setFirmaPresente(false);
  };

  const confirmar = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.warning('Firma del admin requerida.');
      return;
    }
    const firmaPng = sigRef.current.toDataURL('image/png');
    onConfirmar(firmaPng, notas);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-sm font-semibold">Cerrar inventario</div>
        <p className="mb-3 text-xs text-muted-foreground">
          El inventario quedará archivado con el conteo final actual. Después podrás revisarlo
          en el historial pero no editarlo.
        </p>

        <Label className="text-xs text-foreground">Notas de cierre (opcional)</Label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
          className="mb-3 mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
        />

        <Label className="text-xs text-foreground">
          Firma del admin <span className="text-destructive">*</span>
        </Label>
        <div className="mt-1 overflow-hidden rounded border border-border bg-white">
          <SignatureCanvas
            ref={sigRef}
            onEnd={() => setFirmaPresente(!sigRef.current?.isEmpty())}
            canvasProps={{
              className: 'w-full',
              width: 400,
              height: 160,
              style: { width: '100%', height: 160, display: 'block' },
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[0.65rem] text-muted-foreground">
          <span>Firma con el dedo o el mouse en el área blanca.</span>
          <button
            type="button"
            onClick={limpiar}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
          >
            <Eraser className="h-3 w-3" /> Limpiar
          </button>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelar}
            disabled={confirmando}
            className="h-8 text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={confirmar}
            disabled={confirmando || !firmaPresente}
            className="h-8 gap-1 bg-success hover:bg-success/90"
          >
            {confirmando ? 'Procesando…' : 'Confirmar cierre'}
          </Button>
        </div>
      </div>
    </div>
  );
}

