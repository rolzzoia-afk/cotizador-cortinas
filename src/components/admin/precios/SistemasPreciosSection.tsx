// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Sistemas con reglas propias
//
// El beeblack no se cotiza como una roller: tiene otro margen, otra mano de
// obra, otro traslado, un metro entero de tela extra en vez de 25 cm y dos
// valores de instalación distintos. En el Excel eso vive en una COPIA aparte
// del archivo; acá son datos editables, para que no haya que mantener dos
// planillas.
//
// Componente controlado: el borrador y el guardado viven en
// `ReglasPreciosSection`, igual que las demás secciones de esta pantalla.
// ─────────────────────────────────────────────────────────────────────
import { Layers, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import type { SistemaPrecio } from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

type Props = {
  valor: Record<string, SistemaPrecio>;
  /** COD de familia que existen en el catálogo, para poder asignarlas. */
  familiasCatalogo?: string[];
  onChange: (v: Record<string, SistemaPrecio>) => void;
};

/** Los campos numéricos, con el texto que explica para qué sirve cada uno. */
const CAMPOS: Array<{
  campo: keyof Pick<
    SistemaPrecio,
    'margenInsumo' | 'extraAltoM' | 'manoObra' | 'traslado' | 'instalacionEmbebida' | 'instalacionLinea'
  >;
  label: string;
  ayuda: string;
  step?: string;
  ancho: string;
  moneda?: boolean;
}> = [
  {
    campo: 'margenInsumo',
    label: 'Divisor del margen',
    ayuda: 'Los materiales se cobran a VALOR MÁXIMO ÷ este número. 0,60 = margen del 40 %.',
    step: '0.01',
    ancho: 'w-24',
  },
  {
    campo: 'extraAltoM',
    label: 'Tela extra por cortina (m)',
    ayuda: 'Se suma al alto vendido para calcular la tela y los metros cuadrados.',
    step: '0.01',
    ancho: 'w-28',
  },
  {
    campo: 'manoObra',
    label: 'Mano de obra por cortina',
    ayuda: 'Se cobra una vez por cada cortina de la familia.',
    ancho: 'w-32',
    moneda: true,
  },
  {
    campo: 'traslado',
    label: 'Traslado por familia',
    ayuda: 'Uno solo por familia, no por cortina.',
    ancho: 'w-32',
    moneda: true,
  },
  {
    campo: 'instalacionEmbebida',
    label: 'Instalación incluida en el precio',
    ayuda:
      'Va DENTRO del valor unitario de cada cortina, aunque la fila de instalación salga gratis. ' +
      'La única excepción es marcar la cotización «sin instalación»: ahí no se cobra en ninguna parte.',
    ancho: 'w-32',
    moneda: true,
  },
  {
    campo: 'instalacionLinea',
    label: 'Instalación que se cobra aparte',
    ayuda:
      'Lo que sale en la fila de instalación cuando la cotización no llega al mínimo de cortinas ' +
      'para que sea gratis, y también en las cotizaciones de región (ahí con el descuento de región).',
    ancho: 'w-32',
    moneda: true,
  },
];

function Sistema({
  clave,
  sistema,
  familiasDisponibles,
  onChange,
}: {
  clave: string;
  sistema: SistemaPrecio;
  /** COD de familia que existen en el catálogo y no están tomadas por otro sistema. */
  familiasDisponibles: string[];
  onChange: (s: SistemaPrecio) => void;
}) {
  const num = (campo: (typeof CAMPOS)[number]['campo']) => (v: string) =>
    onChange({ ...sistema, [campo]: Number(v) });

  const quitarFamilia = (fam: string) =>
    onChange({ ...sistema, familias: sistema.familias.filter((f) => f !== fam) });
  const agregarFamilia = (fam: string) => {
    const f = fam.trim();
    if (!f || sistema.familias.includes(f)) return;
    onChange({ ...sistema, familias: [...sistema.familias, f] });
  };

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold">{sistema.nombre}</span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">{clave}</span>
      </div>

      {/* Qué familias cotiza. Se edita acá porque es lo que decide a qué
          cortinas se les aplica todo lo demás. */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[0.7rem] text-muted-foreground">Se le aplica a:</span>
        {sistema.familias.map((fam) => (
          <span
            key={fam}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[0.7rem]"
          >
            {nombreFamilia(fam)}
            <button
              type="button"
              onClick={() => quitarFamilia(fam)}
              className="text-muted-foreground hover:text-destructive"
              title={`Sacar ${fam} de este sistema`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {sistema.familias.length === 0 && (
          <span className="text-[0.7rem] text-warning">
            Sin familias: este sistema no se le aplica a ninguna cortina.
          </span>
        )}
        {familiasDisponibles.length > 0 && (
          <select
            value=""
            onChange={(e) => agregarFamilia(e.target.value)}
            className="h-6 rounded border bg-background px-1 text-[0.7rem]"
            title="Agregar una familia a este sistema"
          >
            <option value="">+ agregar familia…</option>
            {familiasDisponibles.map((f) => (
              <option key={f} value={f}>
                {nombreFamilia(f)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {CAMPOS.map(({ campo, label, step, ancho, moneda }) => (
          <label key={campo} className="text-xs">
            <span className="mb-1 block text-muted-foreground">{label}</span>
            <Input
              type="number"
              step={step}
              value={String(sistema[campo])}
              onChange={(e) => num(campo)(e.target.value)}
              className={`h-8 ${ancho} text-right text-xs`}
            />
            {moneda && (
              <span className="mt-0.5 block text-right text-[0.65rem] text-muted-foreground">
                {formatCLP(Math.round(sistema[campo]))}
              </span>
            )}
          </label>
        ))}
      </div>

      <ul className="mt-2 ml-4 list-disc space-y-0.5 text-[0.7rem] text-muted-foreground">
        {CAMPOS.map(({ campo, label, ayuda }) => (
          <li key={campo}>
            <strong>{label}:</strong> {ayuda}
          </li>
        ))}
      </ul>

      {Object.keys(sistema.insumos).length > 0 && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Además tiene <strong>{Object.keys(sistema.insumos).length} precios de insumo propios</strong>,
          que se editan más abajo: ahí se ve cuáles pisan al precio general (la publicidad y los
          materiales varios valen distinto acá que en una roller).
        </p>
      )}
    </div>
  );
}

export function SistemasPreciosSection({ valor, familiasCatalogo = [], onChange }: Props) {
  const claves = Object.keys(valor).sort((a, b) => a.localeCompare(b, 'es'));
  if (!claves.length) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Layers className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold text-muted-foreground">Sistemas con reglas propias</h2>
        </header>
        <p className="text-xs text-muted-foreground">
          No hay ninguno. Todas las cortinas se cotizan con los parámetros generales.
        </p>
      </section>
    );
  }
  // Una familia solo puede estar en un sistema (si estuviera en dos, ganaría el
  // primero y nadie podría verlo). Las que ya están tomadas no se ofrecen.
  const tomadas = new Set(claves.flatMap((k) => valor[k].familias));
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Layers className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Sistemas con reglas propias</h2>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Cortinas que no se cotizan como una roller. Estos valores <strong>reemplazan</strong> a los
        de la pestaña de parámetros para las familias que se nombran en cada sistema; el resto de
        las cortinas no se entera.
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Los sistemas se crean desde el código, no desde acá: acá se ajustan sus números y a qué
        familias se les aplica. Sacarle todas las familias a un sistema equivale a apagarlo.
      </p>
      <div className="space-y-3">
        {claves.map((k) => (
          <Sistema
            key={k}
            clave={k}
            sistema={valor[k]}
            familiasDisponibles={familiasCatalogo.filter((f) => !tomadas.has(f))}
            onChange={(s) => onChange({ ...valor, [k]: s })}
          />
        ))}
      </div>
    </section>
  );
}
