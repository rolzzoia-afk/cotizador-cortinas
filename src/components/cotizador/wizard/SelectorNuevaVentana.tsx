// ─────────────────────────────────────────────────────────────────────
// LO PRIMERO DEL FLUJO GUIADO: ¿qué vamos a cargar?
//
// El vendedor mira el muro antes de medir. Ahí ya sabe cuántas cortinas van y
// si la ventana es recta o va en ángulo, y son las dos cosas que la app le
// preguntaba tarde: la cantidad no se preguntaba nunca (había que apretar
// «Nueva» N veces) y la forma no existía.
//
// Las siluetas son las del mockup, dibujadas a mano: son cuatro formas fijas y
// un SVG inline pesa menos que un asset y sigue el color del tema.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FORMAS_VENTANA,
  MAX_TARJETAS_ESTANDAR,
  MAX_VENTANAS_ESTANDAR,
  type SeleccionVentanas,
} from '@/modules/cotizador/wizard/selectorVentanas';
import type { FormaVentana } from '@/modules/cotizador/types';

type Props = {
  onConfirmar: (sel: SeleccionVentanas) => void;
  onAtras: () => void;
};

/** Silueta de una ventana estándar de N hojas: el rectángulo dividido. */
function SiluetaEstandar({ n }: { n: number }) {
  const ancho = 100;
  const alto = 62;
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-16 w-full" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width={ancho - 2}
        height={alto - 2}
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {Array.from({ length: n - 1 }, (_, i) => {
        const x = ((i + 1) * ancho) / n;
        return (
          <line key={i} x1={x} y1="1" x2={x} y2={alto - 1} stroke="currentColor" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}

/** Las cuatro especiales, en perspectiva como el mockup. */
const SILUETAS_ESPECIALES: Record<FormaVentana, JSX.Element> = {
  // Bow window: dos alas abiertas hacia el observador.
  bow: (
    <polyline points="8,58 26,44 26,10 74,10 74,44 92,58" fill="none" strokeWidth="1.5" />
  ),
  // Ventana en L: un ala y el frente.
  ele: <polyline points="14,56 34,42 34,10 86,10 86,52" fill="none" strokeWidth="1.5" />,
  // Ventana en U: tres caras, las laterales hacia atrás.
  u: <polyline points="10,10 10,52 34,44 76,44 100,52 100,10" fill="none" strokeWidth="1.5" />,
  triangular: <polygon points="12,10 12,52 94,52" fill="none" strokeWidth="1.5" />,
};

function Tarjeta({
  activa,
  onClick,
  titulo,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-md border p-3 transition-colors',
        activa
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-card/40 text-muted-foreground hover:border-accent/50 hover:text-foreground',
      )}
    >
      {children}
      <span className="text-[0.7rem] font-medium uppercase tracking-wide">{titulo}</span>
    </button>
  );
}

export function SelectorNuevaVentana({ onConfirmar, onAtras }: Props) {
  const [sel, setSel] = useState<SeleccionVentanas | null>(null);
  // Más de 4 cortinas en una ventana es raro pero pasa (un ventanal corrido):
  // se escribe la cantidad en vez de llenar la pantalla de tarjetas.
  const [masAbierto, setMasAbierto] = useState(false);
  const [masCantidad, setMasCantidad] = useState('5');

  const estandarActiva = (n: number) => sel?.tipo === 'estandar' && sel.cantidad === n;

  const elegirMas = (valor: string) => {
    const n = parseInt(valor, 10);
    if (!Number.isFinite(n) || n < 1) {
      setMasCantidad(valor);
      setSel(null);
      return;
    }
    // Se acota a la vista, no en silencio: si escribió 20 tiene que ver que se
    // van a cargar 12, no descubrirlo cuando falten ocho cortinas.
    const acotado = Math.min(MAX_VENTANAS_ESTANDAR, n);
    setMasCantidad(String(acotado));
    setSel({ tipo: 'estandar', cantidad: acotado });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h3 className="text-sm font-semibold">¿Qué vas a cargar?</h3>
        <p className="text-[0.72rem] text-muted-foreground">
          Elige cuántas cortinas van en esta ventana, o el modelo si la ventana va en ángulo.
        </p>
      </div>

      {/* ── Estándar ── */}
      <section>
        <h4 className="mb-2 rounded bg-accent/20 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-accent">
          Ventanas estándar
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: MAX_TARJETAS_ESTANDAR }, (_, i) => i + 1).map((n) => (
            <Tarjeta
              key={n}
              activa={estandarActiva(n)}
              onClick={() => {
                setMasAbierto(false);
                setSel({ tipo: 'estandar', cantidad: n });
              }}
              titulo={n === 1 ? '1 ventana' : `${n} ventanas`}
            >
              <SiluetaEstandar n={n} />
            </Tarjeta>
          ))}
          <Tarjeta
            activa={masAbierto}
            onClick={() => {
              setMasAbierto(true);
              elegirMas(masCantidad);
            }}
            titulo="Agregar ventanas"
          >
            <span className="flex h-16 items-center">
              <Plus className="h-7 w-7" />
            </span>
          </Tarjeta>
        </div>
        {masAbierto && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[0.72rem] text-muted-foreground">¿Cuántas?</span>
            <Input
              autoFocus
              inputMode="numeric"
              value={masCantidad}
              onChange={(e) => elegirMas(e.target.value)}
              className="h-8 w-20 border-border bg-secondary text-center"
            />
            <span className="text-[0.68rem] text-muted-foreground">
              hasta {MAX_VENTANAS_ESTANDAR}
            </span>
          </div>
        )}
        <p className="mt-2 text-[0.68rem] text-muted-foreground">
          Cada una es una cortina aparte con su propia medida. Cargas la primera y las demás salen
          con la misma ficha: solo les tomas las medidas.
        </p>
      </section>

      {/* ── Especiales ── */}
      <section>
        <h4 className="mb-2 rounded bg-accent/20 px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-accent">
          Ventanas especiales
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMAS_VENTANA.map((f) => (
            <Tarjeta
              key={f.id}
              activa={sel?.tipo === 'especial' && sel.forma === f.id}
              onClick={() => {
                setMasAbierto(false);
                setSel({ tipo: 'especial', forma: f.id });
              }}
              titulo={f.etiqueta}
            >
              <svg viewBox="0 0 110 62" className="h-16 w-full text-current" aria-hidden="true">
                <g stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
                  {SILUETAS_ESPECIALES[f.id]}
                </g>
              </svg>
              <span className="text-[0.65rem] text-muted-foreground">
                {f.panos === 1 ? '1 paño' : `${f.panos} paños`}
              </span>
            </Tarjeta>
          ))}
        </div>
        <p className="mt-2 text-[0.68rem] text-muted-foreground">
          Es UNA cortina con un paño por cara. Si el tipo de ventana no aparece, tómalo como una
          ventana individual.
        </p>
      </section>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" className="gap-1" onClick={onAtras}>
          <ArrowLeft className="h-3.5 w-3.5" /> Atrás
        </Button>
        <Button
          size="sm"
          className="gap-1"
          disabled={!sel}
          onClick={() => sel && onConfirmar(sel)}
        >
          Siguiente <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
