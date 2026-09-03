// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Cadena metálica
//
// UNA línea para todas las familias: con qué se reemplaza la cadena plástica
// cuando una cortina se cotiza con el botón «cadena metálica» de Fase 1. No es
// una receta por familia a propósito — la cadena es la misma en la roller, en
// el dúo y en la vertical, y así una familia nueva la hereda sola.
//
// Al lado se muestra lo que costaría la plástica en el mismo ejemplo, que es
// la comparación que el vendedor necesita para explicarle el precio al cliente.
// ─────────────────────────────────────────────────────────────────────
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/formatters';
import { materialesFamilia } from '@/modules/cotizador/motorFase0';
import {
  CADENA_METALICA_DEFAULT,
  explicarCantidad,
  type InsumoPrecio,
  type LineaReceta,
} from '@/modules/cotizador/reglasPrecios';
import { EditorCantidad } from './RecetasFamiliasSection';

type Props = {
  valor: LineaReceta;
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  /** La cadena que hoy lleva la receta roller, para comparar en el ejemplo. */
  cadenaPlastica?: LineaReceta;
  onChange: (l: LineaReceta) => void;
};

/** Una sola cortina, la del ejemplo de las recetas: 1,60 × 2,30. */
const EJEMPLO = [{ ancho: 1.6, alto: 2.3 }];

export function CadenaMetalicaSection({
  valor,
  insumos,
  margenInsumo,
  cadenaPlastica,
  onChange,
}: Props) {
  const codigos = Object.keys(insumos).sort((a, b) => a.localeCompare(b, 'es'));
  const previa = materialesFamilia([valor], EJEMPLO, insumos, margenInsumo);
  const previaPlastica = cadenaPlastica
    ? materialesFamilia([cadenaPlastica], EJEMPLO, insumos, margenInsumo)
    : null;
  const esDefault = JSON.stringify(valor) === JSON.stringify(CADENA_METALICA_DEFAULT);

  return (
    <section className="rounded-md border">
      <header className="flex flex-wrap items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
        <h3 className="text-xs font-medium">Cadena metálica</h3>
        {!esDefault && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem] text-warning-foreground">
            modificada
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          en el ejemplo: {formatCLP(previa.total)}
          {previaPlastica && <> · la plástica: {formatCLP(previaPlastica.total)}</>}
        </span>
      </header>

      <div className="p-3">
        <p className="mb-2 text-[0.7rem] text-muted-foreground">
          Con qué se reemplaza la cadena de la receta cuando la cortina se cotiza con el botón de
          cadena metálica en Fase 1. Vale para todas las familias, incluida la vertical (su cadena
          inferior no se toca). El ejemplo es una cortina de 1,60 × 2,30.
        </p>

        <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
          <label className="text-xs">
            <span className="mb-0.5 block text-muted-foreground">Insumo</span>
            <select
              value={valor.insumo}
              onChange={(e) => onChange({ ...valor, insumo: e.target.value })}
              className="h-7 w-40 rounded-md border border-input bg-background px-1 font-mono text-xs"
            >
              {!insumos[valor.insumo] && (
                <option value={valor.insumo}>{valor.insumo} (sin precio)</option>
              )}
              {codigos.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="mt-0.5 block max-w-[10rem] truncate text-[0.65rem] text-muted-foreground">
              {insumos[valor.insumo]?.descripcion ?? ''}
            </span>
          </label>

          <div className="text-xs">
            <span className="mb-0.5 block text-muted-foreground">Cuánto lleva</span>
            <EditorCantidad q={valor.cantidad} onChange={(q) => onChange({ ...valor, cantidad: q })} />
            <span className="mt-0.5 block text-[0.65rem] text-muted-foreground">
              {explicarCantidad(valor.cantidad)}
            </span>
          </div>

          <label className="text-xs">
            <span className="mb-0.5 block text-muted-foreground">Precio</span>
            <select
              value={valor.precio}
              onChange={(e) => onChange({ ...valor, precio: e.target.value as 'venta' | 'costo' })}
              className="h-7 rounded-md border border-input bg-background px-1 text-xs"
            >
              <option value="venta">Con margen</option>
              <option value="costo">A costo</option>
            </select>
          </label>

          <div className="text-xs">
            <span className="mb-0.5 block text-muted-foreground">En el ejemplo</span>
            <div>{formatCLP(previa.lineas[0]?.total ?? 0)}</div>
            <span className="text-[0.65rem] text-muted-foreground">
              {(previa.lineas[0]?.cantidad ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ×{' '}
              {formatCLP(previa.lineas[0]?.precioUnit ?? 0)}
            </span>
          </div>
        </div>

        {/* El precio de CAD 13 está POR METRO y el de la plástica por cadena
            entera: cobrarla «por cortina» la dejaría MÁS BARATA que la que
            reemplaza, que es justo al revés de lo que se quiere. */}
        {valor.nota && (
          <div className="mt-3 flex max-w-2xl items-start gap-1 rounded border border-warning/40 bg-warning/10 p-1.5 text-[0.65rem] leading-snug">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" />
            <span>{valor.nota}</span>
          </div>
        )}

        {previaPlastica && previa.total <= previaPlastica.total && (
          <div className="mt-2 flex max-w-2xl items-start gap-1 rounded border border-destructive/40 bg-destructive/10 p-1.5 text-[0.65rem] leading-snug">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-destructive" />
            <span>
              Así configurada, la cadena metálica sale igual o más barata que la plástica en el
              ejemplo. Revisa la cantidad: CAD 13 se cobra POR METRO.
            </span>
          </div>
        )}

        {!esDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => onChange(CADENA_METALICA_DEFAULT)}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Volver a la de fábrica
          </Button>
        )}
      </div>
    </section>
  );
}
