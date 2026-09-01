// Lo que se VE del asistente de voz: la pregunta en grande, en qué está
// (hablando / escuchando / pensando), lo último que se escuchó, y los
// candidatos cuando la respuesta quedó ambigua — que también se pueden tocar,
// por si el ruido del terreno no deja entenderse.
import { Ear, Loader2, Mic, MicOff, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { EstadoVoz } from '@/modules/cotizador/wizard/maquinaVoz';

const ESTADO_TEXTO: Record<EstadoVoz['fase'], string> = {
  apagado: 'Apagado',
  hablando: 'Hablando…',
  escuchando: 'Te escucho…',
  interpretando: 'Anotando…',
  desambiguando: 'Te escucho…',
  esperandoOrden: 'Di «siguiente» para avanzar',
  pausado: 'En pausa — toca el micrófono',
};

export function PanelVoz({
  estado,
  voces,
  vozActual,
  onCambiarVoz,
  onElegirCandidato,
  onEscucharAhora,
  onApagar,
}: {
  estado: EstadoVoz;
  voces: { name: string; lang: string; natural: boolean }[];
  vozActual: string;
  onCambiarVoz: (nombre: string) => void;
  onElegirCandidato: (i: number) => void;
  onEscucharAhora: () => void;
  onApagar: () => void;
}) {
  if (estado.fase === 'apagado') return null;
  const escuchando = estado.fase === 'escuchando' || estado.fase === 'desambiguando';
  const Icono =
    estado.fase === 'hablando'
      ? Volume2
      : escuchando
        ? Ear
        : estado.fase === 'pausado'
          ? MicOff
          : Loader2;

  return (
    <div className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[0.68rem] text-accent">
            <Icono
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                escuchando && 'animate-pulse',
                estado.fase === 'interpretando' && 'animate-spin',
              )}
            />
            <span>{ESTADO_TEXTO[estado.fase]}</span>
          </div>
          {estado.pregunta && (
            <p className="mt-1 text-[0.9rem] font-semibold leading-snug text-foreground">
              {estado.pregunta}
            </p>
          )}
          {estado.dicho && (
            <p className="mt-0.5 truncate text-[0.7rem] italic text-muted-foreground">
              «{estado.dicho}»
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* La salida de emergencia: si el navegador no abre el micrófono
              solo, un toque siempre lo abre. */}
          {!escuchando && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 gap-1 px-2 text-[0.68rem]"
              onClick={onEscucharAhora}
              title="Abrir el micrófono ahora mismo"
            >
              <Mic className="h-3.5 w-3.5" /> Hablar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[0.68rem]"
            onClick={onApagar}
            title="Apagar el asistente de voz"
          >
            <MicOff className="h-3.5 w-3.5" /> Parar
          </Button>
        </div>
      </div>

      {estado.candidatos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {estado.candidatos.map((c, i) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => onElegirCandidato(i)}
              className="rounded border border-accent/50 bg-card px-2 py-1 text-[0.7rem] text-foreground hover:bg-accent/20"
              title={`Di «${i + 1}» o tócalo`}
            >
              <span className="mr-1 font-mono text-accent">{i + 1}</span>
              {c.etiqueta}
            </button>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[0.66rem] text-muted-foreground">
        Puedes decir «saltar», «corregir ancho», «anterior», «siguiente» o «parar».
      </p>

      {voces.length > 1 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.66rem] text-muted-foreground">Voz</span>
          <select
            value={vozActual}
            onChange={(e) => onCambiarVoz(e.target.value)}
            className="max-w-[260px] flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-[0.66rem] text-foreground"
            title="La voz con la que guía la app. Queda guardada en este equipo."
          >
            {voces.map((v) => (
              <option key={v.name} value={v.name}>
                {v.natural ? '★ ' : ''}
                {v.name}
              </option>
            ))}
          </select>
          <span className="text-[0.62rem] text-muted-foreground">★ = las que suenan natural</span>
        </div>
      )}
    </div>
  );
}

/**
 * El botón del micrófono, para el encabezado del paso. Dice en qué está DE
 * VERDAD: un botón que decía «Escuchando» mientras el parlante hablaba hacía
 * hablarle a una pared.
 */
export function BotonVoz({
  soportado,
  fase,
  onClick,
}: {
  soportado: boolean;
  fase: EstadoVoz['fase'];
  onClick: () => void;
}) {
  const encendida = fase !== 'apagado';
  const escuchando = fase === 'escuchando' || fase === 'desambiguando';
  const etiqueta =
    fase === 'apagado'
      ? 'Dictar'
      : fase === 'pausado'
        ? 'Seguir'
        : fase === 'hablando'
          ? 'Hablando'
          : escuchando
            ? 'Escuchando'
            : 'Anotando';
  return (
    <Button
      type="button"
      variant={escuchando ? 'default' : 'outline'}
      size="sm"
      className="h-7 gap-1 px-2 text-[0.68rem]"
      onClick={onClick}
      title={
        !soportado
          ? 'Este navegador no puede escuchar: usa Chrome para dictar'
          : fase === 'pausado'
            ? 'Seguir dictando'
            : encendida
              ? 'Apagar el asistente de voz'
              : 'Completar este paso hablando'
      }
    >
      {escuchando ? (
        <Mic className="h-3.5 w-3.5 animate-pulse" />
      ) : (
        <MicOff className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{etiqueta}</span>
    </Button>
  );
}
