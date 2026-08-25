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
import { InputDecimal } from '@/components/ui/input-decimal';
import { formatCLP } from '@/lib/formatters';
import {
  FAMILIAS_CON_RECETA,
  SISTEMA_CATEGORIA_B_KEY,
  SISTEMA_INVERTIDA_KEY,
  type SistemaPrecio,
} from '@/modules/cotizador/reglasPrecios';
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
  ancho: string;
  moneda?: boolean;
}> = [
  {
    campo: 'margenInsumo',
    label: 'Divisor del margen',
    ayuda: 'Los materiales se cobran a VALOR MÁXIMO ÷ este número. 0,60 = margen del 40 %.',
    ancho: 'w-24',
  },
  {
    campo: 'extraAltoM',
    label: 'Tela extra por cortina (m)',
    ayuda: 'Se suma al alto vendido para calcular la tela y los metros cuadrados.',
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
  const num = (campo: (typeof CAMPOS)[number]['campo']) => (v: number) =>
    onChange({ ...sistema, [campo]: v });
  const esCategoriaB = clave === SISTEMA_CATEGORIA_B_KEY;
  const esInvertida = clave === SISTEMA_INVERTIDA_KEY;
  // Tela de referencia por familia: las 12 de siempre más las que ya traiga guardadas.
  const familiasTela = Array.from(
    new Set([...FAMILIAS_CON_RECETA, ...Object.keys(sistema.telaPorFamilia ?? {})]),
  );
  const setTela = (fam: string, v: string) => {
    const tela = { ...(sistema.telaPorFamilia ?? {}) };
    // Vaciar la celda BORRA la tela de esa familia (vuelve a cobrar la de la
    // gama A), así que acá el vacío sí es un valor y no se puede rechazar.
    const n = parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) tela[fam] = n;
    else delete tela[fam];
    onChange({ ...sistema, telaPorFamilia: tela });
  };

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
          cortinas se les aplica todo lo demás. La categoría B es la excepción:
          no va por familia sino por la fila marcada B en la grilla. */}
      {esCategoriaB ? (
        <p className="mb-3 text-[0.7rem] text-muted-foreground">
          <span className="font-medium">Se le aplica a:</span> las cortinas marcadas{' '}
          <strong>Categoría B</strong> en la grilla de Fase 1 (por la gama de su tela o a mano),
          sea cual sea su familia. La A y la B de una misma tela se cotizan en paneles aparte;
          las recetas B se editan más abajo, en «Materiales por familia» (terminan en «· Categoría B»).
        </p>
      ) : (
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {/* La invertida también va por fila (la cortina que se corta rotada),
            pero solo en las familias que el Excel de cortinas mayores cambia
            de herraje; por eso sus familias sí se editan. */}
        {esInvertida && (
          <p className="basis-full text-[0.7rem] text-muted-foreground">
            Se le aplica a las cortinas que se cortan <strong>invertidas</strong> (más anchas que el
            rollo, o forzadas con el icono de Fase 1), solo en estas familias: las demás invertidas
            siguen con su receta de siempre. Sus recetas terminan en «· Invertida», más abajo.
          </p>
        )}
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
      )}

      <div className="flex flex-wrap items-end gap-3">
        {CAMPOS.map(({ campo, label, ancho, moneda }) => (
          <label key={campo} className="text-xs">
            <span className="mb-1 block text-muted-foreground">{label}</span>
            <InputDecimal
              value={sistema[campo]}
              onChange={num(campo)}
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

      {esCategoriaB && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">DCT % que se propone al marcar B</span>
            <InputDecimal
              value={Math.round((sistema.descuentoDefault ?? 0) * 10000) / 100}
              onChange={(n) =>
                onChange({ ...sistema, descuentoDefault: Math.max(0, Math.min(1, n / 100)) })
              }
              className="h-8 w-24 text-right text-xs"
            />
            <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
              La copia B del Excel trae 30 % en todas sus telas. Se aplica al crear la fila o al
              cambiarla de categoría; en la fila se puede pisar a mano.
            </span>
          </label>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Tela de referencia B — $ por metro, por familia (la celda «PRECIO REAL» del panel B).
              Vacío = esa familia cobra la tela de la A.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {familiasTela.map((fam) => (
                <label key={fam} className="flex items-center justify-between gap-2 text-[0.7rem]">
                  <span className="truncate">{nombreFamilia(fam)}</span>
                  <Input
                    inputMode="decimal"
                    value={sistema.telaPorFamilia?.[fam] ?? ''}
                    onChange={(e) => setTela(fam, e.target.value)}
                    className="h-7 w-24 text-right text-xs"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

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
