// ─────────────────────────────────────────────────────────────────────
// SEGUNDA PANTALLA DEL FLUJO GUIADO: ¿qué tipo de cortina es?
//
// La grilla visual del mockup del dueño (2026-08-20): familias con silueta —
// Roller SC/BK · Dual · Dúo, Verticales, Sistemas de oscuridad, Beeblack y
// Toldos. Tocar una tarjeta elige su variante por defecto; si la familia tiene
// más de una categoría real (Dúo manual/motor, Dark 38/45…) aparecen como
// chips para afinar. Lo que la app no fabrica va deshabilitado.
//
// Las siluetas son SVG inline (mismo criterio que SelectorNuevaVentana): son
// pocas, pesan menos que un asset y siguen el color del tema.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  seccionesTipoCortina,
  type DibujoTarjeta,
  type TarjetaTipoCortina,
} from '@/modules/cotizador/wizard/selectorTipoCortina';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

type Props = {
  tipos?: readonly TipoCortina[];
  onConfirmar: (categoria: string) => void;
  onAtras: () => void;
};

/** La cadenita de mando: la columna de puntos del mockup. */
function Cadenita({ x }: { x: number }) {
  return (
    <g fill="currentColor" stroke="none">
      {Array.from({ length: 6 }, (_, i) => (
        <circle key={i} cx={x} cy={16 + i * 7} r={1.4} />
      ))}
    </g>
  );
}

/** Siluetas por familia, dibujadas a mano en el estilo del mockup. */
const SILUETAS: Record<Exclude<DibujoTarjeta, 'boton'>, JSX.Element> = {
  // Roller: el tubo arriba, el paño colgando y la cadenita al costado.
  roller: (
    <>
      <rect x={10} y={6} width={82} height={7} rx={2} />
      <rect x={14} y={13} width={74} height={43} />
      <Cadenita x={97} />
    </>
  ),
  // Dual: el mismo roller con el segundo paño a media caída por delante.
  dual: (
    <>
      <rect x={10} y={6} width={82} height={7} rx={2} />
      <rect x={14} y={13} width={74} height={43} />
      <line x1={14} y1={34} x2={88} y2={34} />
      <rect x={18} y={13} width={66} height={21} />
      <Cadenita x={97} />
    </>
  ),
  // Dúo: las bandas horizontales.
  duo: (
    <>
      <rect x={10} y={6} width={82} height={7} rx={2} />
      <rect x={14} y={13} width={74} height={43} />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={14} y={16 + i * 8.4} width={74} height={4} fill="currentColor" stroke="none" opacity={0.5} />
      ))}
      <Cadenita x={97} />
    </>
  ),
  // Vertical: el riel cabezal y las lamas colgando.
  vertical: (
    <>
      <rect x={10} y={6} width={82} height={6} rx={2} />
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={12 + i * 13} y={12} width={10} height={45} />
      ))}
    </>
  ),
  // S. Dreams: lamas de tela con la caída curva (deshabilitada por ahora).
  sdreams: (
    <>
      <rect x={10} y={6} width={82} height={6} rx={2} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${13 + i * 13} 12 h9 v40 q-4.5 6 -9 0 Z`} />
      ))}
    </>
  ),
  // Beeblack: el panal del mockup — hexágono con el plisado vertical.
  beeblack: (
    <>
      <polygon points="51,4 88,22 88,44 51,60 14,44 14,22" />
      <line x1={33} y1={13} x2={33} y2={52} />
      <line x1={51} y1={4} x2={51} y2={60} />
      <line x1={69} y1={13} x2={69} y2={52} />
    </>
  ),
  // Toldo: el tubo y el paño cayendo inclinado hacia afuera.
  toldo: (
    <>
      <rect x={10} y={6} width={82} height={7} rx={2} />
      <polygon points="14,13 88,13 78,56 24,56" />
      <line x1={24} y1={56} x2={20} y2={62} />
      <line x1={78} y1={56} x2={82} y2={62} />
    </>
  ),
};

function Tarjeta({
  tarjeta,
  activa,
  onClick,
}: {
  tarjeta: TarjetaTipoCortina;
  activa: boolean;
  onClick: () => void;
}) {
  const deshabilitada = !!tarjeta.deshabilitada;
  const boton = tarjeta.dibujo === 'boton';
  return (
    <button
      type="button"
      disabled={deshabilitada}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-md border transition-colors',
        boton ? 'justify-center px-4 py-4' : 'p-3',
        deshabilitada
          ? 'cursor-not-allowed border-border/60 bg-card/20 text-muted-foreground/50'
          : activa
            ? 'border-accent bg-accent/15 text-accent'
            : 'border-border bg-card/40 text-muted-foreground hover:border-accent/50 hover:text-foreground',
      )}
    >
      {!boton && (
        <svg viewBox="0 0 102 64" className="h-16 w-full" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            {SILUETAS[tarjeta.dibujo as Exclude<DibujoTarjeta, 'boton'>]}
          </g>
        </svg>
      )}
      <span className="text-[0.7rem] font-medium uppercase tracking-wide">{tarjeta.titulo}</span>
      {deshabilitada && (
        <span className="text-[0.62rem] text-muted-foreground/60">{tarjeta.deshabilitada}</span>
      )}
    </button>
  );
}

export function SelectorTipoCortina({ tipos, onConfirmar, onAtras }: Props) {
  const secciones = seccionesTipoCortina(tipos);
  const [tarjetaId, setTarjetaId] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('');

  const tarjetaSel = secciones
    .flatMap((s) => s.tarjetas)
    .find((t) => t.id === tarjetaId);

  const elegir = (t: TarjetaTipoCortina) => {
    setTarjetaId(t.id);
    setCategoria(t.variantes[0]?.categoria ?? '');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Selecciona el tipo de cortina</h3>
        <p className="text-[0.72rem] text-muted-foreground">
          Es el mismo «Tipo de cortina» de la ficha, elegido mirando el sistema.
        </p>
      </div>

      {secciones.map((s) => (
        <section key={s.titulo}>
          <h4 className="mb-2 rounded bg-accent/20 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-accent">
            {s.titulo}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.tarjetas.map((t) => (
              <Tarjeta key={t.id} tarjeta={t} activa={t.id === tarjetaId} onClick={() => elegir(t)} />
            ))}
          </div>
          {/* Los chips de variante de la tarjeta elegida, pegados a su sección. */}
          {tarjetaSel && tarjetaSel.variantes.length > 1 && s.tarjetas.some((t) => t.id === tarjetaSel.id) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[0.72rem] text-muted-foreground">Variante:</span>
              {tarjetaSel.variantes.map((v) => (
                <button
                  key={v.categoria}
                  type="button"
                  onClick={() => setCategoria(v.categoria)}
                  className={cn(
                    'rounded border px-2 py-1 text-[0.7rem] transition-colors',
                    categoria === v.categoria
                      ? 'border-accent bg-accent/15 font-medium text-accent'
                      : 'border-border bg-card/40 text-muted-foreground hover:border-accent/50',
                  )}
                >
                  {v.etiqueta}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="gap-1" onClick={onAtras}>
          <ArrowLeft className="h-3.5 w-3.5" /> Atrás
        </Button>
        <Button
          size="sm"
          className="gap-1"
          disabled={!categoria}
          onClick={() => categoria && onConfirmar(categoria)}
        >
          Siguiente <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
