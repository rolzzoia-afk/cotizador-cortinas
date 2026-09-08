// ─────────────────────────────────────────────────────────────────────
// EL BOTÓN QUE PINTA UNA FILA DE LA COTIZACIÓN.
//
// Va junto al asa de arrastre, en la primera celda de cada fila de la grilla de
// Fase 1/3 — tanto en las cortinas como en los adicionales. Abre una paleta
// cerrada de ocho pasteles (los mismos que las vendedoras usan en la planilla) y
// «Sin color». Lo elegido viaja a la OT y se imprime en el PDF del cliente.
//
// El menú flotante está hecho a mano, como el del tubo de la invertida: el
// proyecto no tiene Popover de shadcn y no vale la pena traerlo por esto.
// ─────────────────────────────────────────────────────────────────────
import { Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PALETA_FILA,
  estiloFilaPintada,
  nombreColorFila,
} from '@/modules/cotizador/coloresFila';

type Props = {
  /** Color actual de la fila (hex) o vacío si no está pintada. */
  color?: string;
  /** ¿Está abierto el menú de ESTA fila? Lo maneja la grilla, para que solo
   *  haya uno abierto a la vez. */
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  /** `undefined` = sin color. */
  onElegir: (hex: string | undefined) => void;
};

export function BotonColorFila({ color, abierto, onAbrir, onCerrar, onElegir }: Props) {
  const estilo = estiloFilaPintada(color);
  return (
    <div className="relative print:hidden">
      <button
        type="button"
        title={`Pintar la fila (${nombreColorFila(color)})`}
        aria-label={`Pintar la fila. Color actual: ${nombreColorFila(color)}`}
        onClick={() => (abierto ? onCerrar() : onAbrir())}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
          estilo ? 'border-black/20' : 'border-border text-muted-foreground hover:text-foreground',
        )}
        style={estilo ? { backgroundColor: estilo.backgroundColor } : undefined}
      >
        {!estilo && <Palette className="h-3 w-3" />}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={onCerrar} />
          <div className="absolute left-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-md border bg-popover text-left shadow-lg">
            <div className="border-b px-2 py-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">
              Color de la fila
            </div>
            <div className="grid grid-cols-4 gap-1 p-2">
              {PALETA_FILA.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.nombre}
                  aria-label={c.nombre}
                  onClick={() => {
                    onElegir(c.hex);
                    onCerrar();
                  }}
                  className={cn(
                    'h-6 w-6 rounded-md border border-black/20',
                    (color || '').toUpperCase() === c.hex.toUpperCase() &&
                      'ring-2 ring-foreground ring-offset-1 ring-offset-popover',
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onElegir(undefined);
                onCerrar();
              }}
              className="block w-full border-t px-2 py-1.5 text-left text-xs hover:bg-accent/60"
            >
              Sin color
            </button>
          </div>
        </>
      )}
    </div>
  );
}
