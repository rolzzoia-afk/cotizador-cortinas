// Registrar un seguimiento como lo anota el Excel: POR DÓNDE (llamada,
// WhatsApp, mail, Instagram) y QUÉ RESPONDIÓ. Las respuestas rápidas son las
// frases de siempre («Se deja audio», «Actualiza cotización»…) y ya traen el
// resultado que entiende la cadencia 1-2-3. Lo usan la bandeja, la ficha y la
// planilla.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MEDIOS,
  MEDIO_LABEL,
  RESPUESTAS_RAPIDAS,
  registrarSeguimiento,
} from '@/modules/leads/seguimientos';
import {
  SEG_RESULTADO_LABEL,
  type Medio,
  type SeguimientoResultado,
} from '@/modules/leads/types';

const RESULTADOS: SeguimientoResultado[] = ['no_respondio', 'respondio', 'agendo_visita', 'cerro', 'no_interesado'];

type Props = {
  leadId: string;
  /** Etapa pendiente de la cadencia (1-3), o null si será un seguimiento extra. */
  etapa: number | null;
  onRegistrado: () => void | Promise<void>;
};

export function RegistrarSeguimientoForm({ leadId, etapa, onRegistrado }: Props) {
  const [medio, setMedio] = useState<Medio>('whatsapp');
  const [resultado, setResultado] = useState<SeguimientoResultado>('no_respondio');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      await registrarSeguimiento(leadId, resultado, nota.trim() || null, medio);
      if (resultado === 'cerro') toast.success('¡Cierre registrado! Recuerda marcar el cliente como Ganado.');
      else if (resultado === 'agendo_visita') toast.success('Visita agendada. Actualiza el estado del cliente.');
      else if (resultado === 'no_interesado') toast.info('Registrado. Puedes marcarlo como Perdido.');
      else toast.success('Seguimiento registrado');
      setNota('');
      await onRegistrado();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const chip = (activo: boolean) =>
    cn(
      'rounded-full border px-2 py-0.5 text-[12px] transition-colors',
      activo
        ? 'border-accent bg-accent/15 font-semibold text-accent'
        : 'border-border bg-card text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/40 p-2.5 text-left">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {etapa ? `Seguimiento ${etapa} de 3` : 'Seguimiento extra'} · ¿por dónde?
      </div>
      <div className="flex flex-wrap gap-1">
        {MEDIOS.map((m) => (
          <button key={m} type="button" onClick={() => setMedio(m)} className={chip(medio === m)}>
            {MEDIO_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">¿Qué respondió?</div>
      <div className="flex flex-wrap gap-1">
        {RESPUESTAS_RAPIDAS.map((r) => (
          <button
            key={r.etiqueta}
            type="button"
            onClick={() => {
              setResultado(r.resultado);
              setNota(r.nota);
            }}
            className={chip(nota === r.nota && resultado === r.resultado)}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      <select
        value={resultado}
        onChange={(e) => setResultado(e.target.value as SeguimientoResultado)}
        aria-label="Resultado para la cadencia"
        className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        {RESULTADOS.map((r) => (
          <option key={r} value={r}>
            {SEG_RESULTADO_LABEL[r]}
          </option>
        ))}
      </select>
      <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" />
      <Button size="sm" className="w-full gap-1.5" onClick={guardar} disabled={guardando}>
        {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Guardar seguimiento
      </Button>
    </div>
  );
}
