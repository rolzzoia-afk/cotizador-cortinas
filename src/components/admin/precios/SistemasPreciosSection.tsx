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
import { Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import type { SistemaPrecio } from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

type Props = {
  valor: Record<string, SistemaPrecio>;
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
    ayuda: 'Va DENTRO del valor unitario de cada cortina, se cobre o no la fila de instalación.',
    ancho: 'w-32',
    moneda: true,
  },
  {
    campo: 'instalacionLinea',
    label: 'Instalación que se cobra aparte',
    ayuda:
      'Lo que sale en la fila de instalación cuando la cotización no llega al mínimo de cortinas para que sea gratis.',
    ancho: 'w-32',
    moneda: true,
  },
];

function Sistema({
  clave,
  sistema,
  onChange,
}: {
  clave: string;
  sistema: SistemaPrecio;
  onChange: (s: SistemaPrecio) => void;
}) {
  const num = (campo: (typeof CAMPOS)[number]['campo']) => (v: string) =>
    onChange({ ...sistema, [campo]: Number(v) });

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <span className="text-xs font-semibold">{sistema.nombre}</span>
        <span className="font-mono text-[0.65rem] text-muted-foreground">{clave}</span>
        <span className="text-[0.7rem] text-muted-foreground">
          {sistema.familias.length
            ? `Se le aplica a: ${sistema.familias.map(nombreFamilia).join(' · ')}`
            : 'Sin familias asignadas: no se le aplica a ninguna cortina.'}
        </span>
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

export function SistemasPreciosSection({ valor, onChange }: Props) {
  const claves = Object.keys(valor).sort((a, b) => a.localeCompare(b, 'es'));
  if (!claves.length) return null;
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
      <div className="space-y-3">
        {claves.map((k) => (
          <Sistema
            key={k}
            clave={k}
            sistema={valor[k]}
            onChange={(s) => onChange({ ...valor, [k]: s })}
          />
        ))}
      </div>
    </section>
  );
}
