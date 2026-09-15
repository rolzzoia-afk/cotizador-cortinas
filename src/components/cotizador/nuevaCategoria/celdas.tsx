// Las celdas de la grilla del asistente «Nueva categoría». Son campos chicos,
// de alto fijo, que se marcan en rojo (error) o ámbar (aviso) y llevan el
// motivo en el `title`, como en una planilla.
import { InputDecimal } from '@/components/ui/input-decimal';
import { cn } from '@/lib/utils';

const BASE =
  'h-7 w-full rounded-md border bg-secondary px-1.5 text-xs focus:border-accent focus:outline-none';

type Marca = { invalido?: string; aviso?: string };

const claseMarca = ({ invalido, aviso }: Marca) =>
  invalido
    ? 'border-destructive bg-destructive/10'
    : aviso
      ? 'border-warning/60 bg-warning/10'
      : 'border-border';

const titulo = ({ invalido, aviso }: Marca) => invalido || aviso || undefined;

type ComunProps = Marca & {
  className?: string;
  placeholder?: string;
  /** Para moverse con el teclado: fila y columna dentro de la grilla. */
  fila?: number;
  columna?: number;
};

export function CeldaTexto({
  valor,
  onChange,
  mono,
  mayusculas,
  ...m
}: ComunProps & {
  valor: string;
  onChange: (v: string) => void;
  mono?: boolean;
  mayusculas?: boolean;
}) {
  return (
    <input
      value={valor}
      onChange={(e) => onChange(mayusculas ? e.target.value.toUpperCase() : e.target.value)}
      placeholder={m.placeholder}
      title={titulo(m)}
      data-r={m.fila}
      data-c={m.columna}
      className={cn(BASE, claseMarca(m), mono && 'font-mono', m.className)}
    />
  );
}

export function CeldaDecimal({
  valor,
  onChange,
  ...m
}: ComunProps & { valor: number; onChange: (v: number) => void }) {
  return (
    <InputDecimal
      value={valor}
      onChange={onChange}
      placeholder={m.placeholder}
      title={titulo(m)}
      data-r={m.fila}
      data-c={m.columna}
      className={cn(BASE, 'text-right', claseMarca(m), m.className)}
    />
  );
}

export function CeldaSelect({
  valor,
  onChange,
  opciones,
  vacio,
  ...m
}: ComunProps & {
  valor: string;
  onChange: (v: string) => void;
  opciones: readonly string[];
  /** Rótulo de la opción vacía; sin él, el campo es obligatorio. */
  vacio?: string;
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      title={titulo(m)}
      data-r={m.fila}
      data-c={m.columna}
      className={cn(BASE, claseMarca(m), m.className)}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function CeldaFecha({
  valor,
  onChange,
  ...m
}: ComunProps & { valor: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      title={titulo(m)}
      data-r={m.fila}
      data-c={m.columna}
      className={cn(BASE, claseMarca(m), m.className)}
    />
  );
}

export function CeldaCheck({
  valor,
  onChange,
  etiqueta,
  ...m
}: Marca & { valor: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <input
      type="checkbox"
      checked={valor}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={etiqueta}
      title={titulo(m) ?? etiqueta}
      className={cn('h-3.5 w-3.5 accent-accent', m.invalido && 'outline outline-destructive')}
    />
  );
}
