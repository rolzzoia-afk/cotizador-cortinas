// El botón de emergencia que lleva cada pantalla del taller.
//
// No resuelve el problema: deja constancia de que existe, con quién lo vio y
// en qué OT. El encargado de producción lo lee en la bandeja de avisos.

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCrearAviso } from '@/modules/produccion/avisos';
import { LABEL_AREA } from '@/modules/produccion/constants';
import type { AreaProduccion } from '@/modules/produccion/types';

export default function BotonEmergencia({
  area,
  ot,
}: {
  area: AreaProduccion;
  /** OT en la que se está trabajando. Puede ir vacía: el aviso igual sirve. */
  ot: string;
}) {
  const { crear } = useCrearAviso();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    setEnviando(true);
    try {
      await crear(mensaje, area, ot);
      toast.success('Aviso enviado al encargado de producción.');
      setMensaje('');
      setAbierto(false);
    } catch (e) {
      toast.error('No se pudo enviar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAbierto(true)}
        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
      >
        <TriangleAlert className="mr-1.5 h-4 w-4" />
        Avisar un problema
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Avisar un problema</DialogTitle>
            <DialogDescription>
              {LABEL_AREA[area]}
              {ot.trim() ? ` · OT ${ot.trim()}` : ' · sin OT'}. Cuenta qué pasó: el encargado de
              producción lo ve en la bandeja de avisos.
            </DialogDescription>
          </DialogHeader>

          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Falta el tubo E39 para la cortina del living…"
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={enviar} disabled={enviando || !mensaje.trim()}>
              {enviando ? 'Enviando…' : 'Enviar aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
