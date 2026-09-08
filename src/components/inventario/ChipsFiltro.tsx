// La fila de filtros del inventario (láminas «Kardex», «Telas», «Insumos»).
//
// Todos los submódulos filtran con la misma fila de chips: interruptores para
// lo que se enciende y se apaga, desplegables con pinta de chip para lo que
// elige entre varios, y un buscador. Vive acá para que las tres pantallas se
// vean iguales sin copiarse el CSS.
//
// Un chip encendido se distingue por color Y por peso de letra: en la pantalla
// del galpón, con sol de frente, el color solo no alcanza.

import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASE_CHIP =
  'inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-border bg-background/50 text-[0.78rem] text-muted-foreground transition-colors';
const CHIP_ACTIVO = 'border-accent bg-accent/[0.12] font-medium text-accent';

/** Un chip que se enciende y se apaga. */
export function ChipFiltro({
  activo,
  children,
  onClick,
  titulo,
}: {
  activo?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={activo}
      className={cn(BASE_CHIP, 'px-3', activo && CHIP_ACTIVO)}
    >
      {children}
    </button>
  );
}

/** Un desplegable con la misma pinta que los chips. */
export function ChipSelect({
  valor,
  onChange,
  children,
  etiqueta,
}: {
  valor: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  /** Cómo lo nombra un lector de pantalla; no se ve. */
  etiqueta: string;
}) {
  return (
    <div className={cn(BASE_CHIP, 'relative', valor && CHIP_ACTIVO)}>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-label={etiqueta}
        className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 text-inherit outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3" />
    </div>
  );
}

/** El buscador de la fila. */
export function ChipBusqueda({
  valor,
  onChange,
  placeholder,
  etiqueta,
  ancho = 'w-[150px]',
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  etiqueta: string;
  /** Clase de ancho del input; el kardex lo quiere más angosto que telas. */
  ancho?: string;
}) {
  return (
    <div className={cn(BASE_CHIP, 'pl-2.5', valor && 'border-accent')}>
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className={cn(
          'h-full bg-transparent px-2 text-foreground outline-none placeholder:text-muted-foreground',
          ancho,
        )}
      />
    </div>
  );
}

/** El interruptor con su texto, el de la derecha de la fila. */
export function InterruptorFiltro({
  activo,
  onChange,
  children,
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-muted-foreground">
      {children}
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          'relative inline-block h-[22px] w-[38px] shrink-0 rounded-full transition-colors',
          activo ? 'bg-accent' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-card transition-all',
            activo ? 'right-[2px]' : 'left-[2px]',
          )}
        />
      </span>
    </label>
  );
}

/** La rayita que separa un grupo de chips del siguiente. */
export function SeparadorChips() {
  return <span className="mx-1 h-[22px] w-px bg-border" />;
}
