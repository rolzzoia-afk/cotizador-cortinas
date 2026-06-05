// Diálogo modal de "Diagnóstico IA": genera un texto plano con el estado
// operacional completo para pegar en una conversación nueva con Claude.
// El texto se arma con generarTextoDiag (función pura). El diálogo solo
// maneja la UI y la copia al portapapeles.

import { useEffect, useState } from 'react';
import { Bot, Check, ClipboardCopy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CHIPS } from '../Inteligencia.config';
import { generarTextoDiag } from '../utils/generar-texto-diag';
import type { Insumo, Mov, OT, Rack } from '../Inteligencia.types';

interface DiagDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ots: OT[];
  insumos: Insumo[];
  movs: Mov[];
  racks: Rack[];
}

export default function DiagDialog({
  open,
  onOpenChange,
  ots,
  insumos,
  movs,
  racks,
}: DiagDialogProps) {
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopiado(false);
    if (ots.length === 0 && insumos.length === 0) {
      setTexto(
        'Primero presiona "Actualizar" para cargar los datos, y después genera el diagnóstico.',
      );
    } else {
      setTexto(generarTextoDiag(ots, insumos, movs, racks));
    }
  }, [open, ots, insumos, movs, racks]);

  const agregar = (q: string) => {
    const sep = '\n\n══════════════════════════════════════\nMI PREGUNTA PARA CLAUDE:\n══════════════════════════════════════\n';
    if (texto.includes('MI PREGUNTA PARA CLAUDE:')) {
      setTexto(texto.replace(/\n\n══+\nMI PREGUNTA[\s\S]*$/, sep + q));
    } else {
      setTexto(texto + sep + q);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Texto copiado');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto manualmente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Bot className="h-5 w-5 text-accent" /> Diagnóstico para Claude
            </DialogTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copiar} className="gap-1.5">
                {copiado ? (
                  <>
                    <Check className="h-4 w-4" /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="h-4 w-4" /> Copiar todo
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
          <strong>¿Cómo se usa?</strong> Copia el texto, abre una nueva conversación con Claude y
          pégalo. Luego escribe tu pregunta o problema. Claude va a tener todo el contexto de tu
          empresa para ayudarte.
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onClick={() => agregar(c.q)}
              className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:border-accent/40 hover:bg-accent/10"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          readOnly
          className="h-[55vh] w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-foreground"
        />
      </DialogContent>
    </Dialog>
  );
}
