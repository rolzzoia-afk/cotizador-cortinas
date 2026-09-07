// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Tubo de la invertida (45 mm)
//
// Igual que la cadena metálica: NO es una receta por familia, es un RECAMBIO
// que se le aplica encima a la receta que la cascada ya resolvió. La invertida
// de fábrica va con el tubo de 63 mm (`E 47`) y su kit (`MEC 28`); cuando el
// vendedor elige 45 mm en la grilla, esos dos códigos se cambian por los de
// acá. Así vale para las cuatro familias invertidas de una vez y ninguna
// empresa tiene que migrar las recetas `|INV` que ya tenga guardadas.
//
// Las cantidades NO se tocan: el tubo se cobra por metro lineal y el kit por
// cortina, igual que los del 63. Lo único que cambia es el código y su precio.
// ─────────────────────────────────────────────────────────────────────
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/formatters';
import {
  TUBO_INVERTIDA_45_DEFAULT,
  type InsumoPrecio,
  type RecambioInsumo,
} from '@/modules/cotizador/reglasPrecios';

type Props = {
  valor: RecambioInsumo[];
  /** Tabla general: es de donde salen los precios de los códigos del 45. */
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  onChange: (v: RecambioInsumo[]) => void;
};

export function TuboInvertidaSection({ valor, insumos, margenInsumo, onChange }: Props) {
  const codigos = Object.keys(insumos).sort((a, b) => a.localeCompare(b, 'es'));
  const esDefault = JSON.stringify(valor) === JSON.stringify(TUBO_INVERTIDA_45_DEFAULT);
  const precio = (cod: string) => (insumos[cod]?.valorMaximo ?? 0) / margenInsumo;
  const cambiar = (i: number, campo: 'de' | 'a', v: string) =>
    onChange(valor.map((r, j) => (j === i ? { ...r, [campo]: v.toUpperCase().trim() } : r)));

  return (
    <section className="rounded-md border">
      <header className="flex flex-wrap items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
        <h3 className="text-xs font-medium">Invertida con tubo de 45 mm</h3>
        {!esDefault && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem] text-warning-foreground">
            modificada
          </span>
        )}
      </header>

      <div className="p-3">
        <p className="mb-2 max-w-3xl text-[0.7rem] text-muted-foreground">
          Qué códigos cambia una cortina invertida cuando se elige el tubo de{' '}
          <strong>45 mm</strong> en vez del de 63 (el menú del botón INVERTIDA de Fase 1). Las
          cantidades no cambian: el tubo se sigue cobrando por metro lineal y el kit por cortina.
          Solo aplica a las familias que van al sistema INVERTIDA; en las demás, invertir no cambia
          el herraje.
        </p>

        <div className="space-y-2">
          {valor.map((r, i) => (
            <div key={`${r.de}-${i}`} className="flex flex-wrap items-end gap-2 text-xs">
              <label>
                <span className="mb-0.5 block text-muted-foreground">Con 63 mm lleva</span>
                <select
                  value={r.de}
                  onChange={(e) => cambiar(i, 'de', e.target.value)}
                  className="h-7 w-36 rounded-md border border-input bg-background px-1 font-mono text-xs"
                >
                  {!codigos.includes(r.de) && <option value={r.de}>{r.de}</option>}
                  {codigos.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <span className="pb-1.5 text-muted-foreground">→</span>
              <label>
                <span className="mb-0.5 block text-muted-foreground">Con 45 mm lleva</span>
                <select
                  value={r.a}
                  onChange={(e) => cambiar(i, 'a', e.target.value)}
                  className="h-7 w-36 rounded-md border border-input bg-background px-1 font-mono text-xs"
                >
                  {!codigos.includes(r.a) && <option value={r.a}>{r.a} (sin precio)</option>}
                  {codigos.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <div className="pb-0.5 text-[0.65rem] text-muted-foreground">
                {formatCLP(precio(r.de))} → {formatCLP(precio(r.a))} por unidad
                <span className="ml-1 block max-w-[16rem] truncate">
                  {insumos[r.a]?.descripcion ?? ''}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => onChange(valor.filter((_, j) => j !== i))}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>

        {valor.some((r) => !insumos[r.a]) && (
          <div className="mt-2 flex max-w-2xl items-start gap-1 rounded border border-destructive/40 bg-destructive/10 p-1.5 text-[0.65rem] leading-snug">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-destructive" />
            <span>
              Hay un código de reemplazo sin precio en la tabla general: esa línea se cobraría en
              $0 en toda invertida de 45 mm.
            </span>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...valor, { de: '', a: '' }])}
          >
            Agregar recambio
          </Button>
          {!esDefault && (
            <Button variant="ghost" size="sm" onClick={() => onChange(TUBO_INVERTIDA_45_DEFAULT)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Volver al de fábrica
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
