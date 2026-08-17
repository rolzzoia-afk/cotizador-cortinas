// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Materiales por familia (las recetas)
//
// Qué lleva cada cortina y en qué cantidad: es el bloque de materiales de los
// paneles de colores del Excel, editable. Cada línea muestra su regla contada
// en castellano y, al lado, cuánto daría con una cotización de ejemplo, para
// que se vea el efecto antes de guardar.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardList, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import { materialesFamilia } from '@/modules/cotizador/motorFase0';
import {
  FAMILIAS_CON_RECETA,
  RECETAS_DEFAULT,
  RECETA_DUO_GENERICO_KEY,
  RECETA_VERTICAL_KEY,
  explicarCantidad,
  type CantidadReceta,
  type InsumoPrecio,
  type LineaReceta,
} from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

type Props = {
  recetas: Record<string, LineaReceta[]>;
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  onChange: (r: Record<string, LineaReceta[]>) => void;
};

const TIPOS: { tipo: CantidadReceta['tipo']; label: string }[] = [
  { tipo: 'porCortina', label: 'Por cortina' },
  { tipo: 'sumaAnchos', label: 'Por metro de ancho' },
  { tipo: 'sumaAltos', label: 'Por metro de alto' },
  { tipo: 'fijo', label: 'Cantidad fija' },
  { tipo: 'porCortinaCuadrado', label: 'Cortinas al cuadrado' },
  { tipo: 'lamas', label: 'Por lama (vertical)' },
];

/** Cotización de ejemplo para la vista previa: dos cortinas, una ancha y una angosta. */
const EJEMPLO = [
  { ancho: 1.6, alto: 2.3 },
  { ancho: 2.4, alto: 2.3 },
];

function cambiarTipo(tipo: CantidadReceta['tipo']): CantidadReceta {
  switch (tipo) {
    case 'fijo': return { tipo: 'fijo', cantidad: 1 };
    case 'sumaAnchos': return { tipo: 'sumaAnchos' };
    case 'sumaAltos': return { tipo: 'sumaAltos' };
    case 'porCortinaCuadrado': return { tipo: 'porCortinaCuadrado' };
    case 'lamas': return { tipo: 'lamas' };
    default: return { tipo: 'porCortina' };
  }
}

function EditorCantidad({ q, onChange }: { q: CantidadReceta; onChange: (q: CantidadReceta) => void }) {
  const num = (v: string) => (v === '' ? undefined : Number(v));
  const filtro = 'filtroAncho' in q ? q.filtroAncho : undefined;
  const aceptaFiltro = q.tipo === 'porCortina' || q.tipo === 'sumaAnchos';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <select
        value={q.tipo}
        onChange={(e) => onChange(cambiarTipo(e.target.value as CantidadReceta['tipo']))}
        className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
      >
        {TIPOS.map((t) => (
          <option key={t.tipo} value={t.tipo}>{t.label}</option>
        ))}
      </select>

      {q.tipo === 'fijo' ? (
        <Input
          type="number" step="0.01" value={String(q.cantidad)}
          onChange={(e) => onChange({ tipo: 'fijo', cantidad: Number(e.target.value) })}
          className="h-7 w-16 text-xs" title="Cantidad"
        />
      ) : (
        <Input
          type="number" step="0.01" value={q.factor === undefined ? '' : String(q.factor)}
          onChange={(e) => onChange({ ...q, factor: num(e.target.value) } as CantidadReceta)}
          placeholder="×1" className="h-7 w-14 text-xs" title="Multiplicador"
        />
      )}

      {q.tipo === 'sumaAnchos' && (
        <Input
          type="number" step="0.01" value={q.masFijoM === undefined ? '' : String(q.masFijoM)}
          onChange={(e) => onChange({ ...q, masFijoM: num(e.target.value) })}
          placeholder="+0 m" className="h-7 w-16 text-xs" title="Metros fijos que se suman"
        />
      )}

      {aceptaFiltro && (
        <>
          <Input
            type="number" step="0.01" value={filtro?.min === undefined ? '' : String(filtro.min)}
            onChange={(e) => onChange({ ...q, filtroAncho: { ...filtro, min: num(e.target.value) } } as CantidadReceta)}
            placeholder="desde" className="h-7 w-16 text-xs" title="Ancho desde (m)"
          />
          <Input
            type="number" step="0.01" value={filtro?.max === undefined ? '' : String(filtro.max)}
            onChange={(e) => onChange({ ...q, filtroAncho: { ...filtro, max: num(e.target.value) } } as CantidadReceta)}
            placeholder="hasta" className="h-7 w-16 text-xs" title="Ancho hasta (m)"
          />
        </>
      )}
    </div>
  );
}

function Familia({ fam, lineas, insumos, margenInsumo, onChange }: {
  fam: string;
  lineas: LineaReceta[];
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  onChange: (l: LineaReceta[]) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const codigos = Object.keys(insumos).sort((a, b) => a.localeCompare(b, 'es'));
  const previa = materialesFamilia(lineas, EJEMPLO, insumos, margenInsumo);
  const esDefault = JSON.stringify(lineas) === JSON.stringify(RECETAS_DEFAULT[fam]);

  const editarLinea = (i: number, patch: Partial<LineaReceta>) =>
    onChange(lineas.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        {abierta ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="font-medium">{nombreFamilia(fam)}</span>
        <span className="text-muted-foreground">{lineas.length} materiales</span>
        {!esDefault && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem] text-warning-foreground">
            modificada
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          ejemplo: {formatCLP(previa.total)}
        </span>
      </button>

      {abierta && (
        <div className="border-t p-3">
          <p className="mb-2 text-[0.7rem] text-muted-foreground">
            La columna de la derecha es lo que costaría esta familia con dos cortinas de ejemplo
            (1,60 × 2,30 y 2,40 × 2,30), para ver el efecto de un cambio antes de guardarlo.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-1 py-1 text-left font-medium">Insumo</th>
                  <th className="px-1 py-1 text-left font-medium">Cuánto lleva</th>
                  <th className="px-1 py-1 text-left font-medium">Precio</th>
                  <th className="px-1 py-1 text-right font-medium">En el ejemplo</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="px-1 py-1.5">
                      <select
                        value={l.insumo}
                        onChange={(e) => editarLinea(i, { insumo: e.target.value })}
                        className="h-7 w-32 rounded-md border border-input bg-background px-1 font-mono text-xs"
                      >
                        {!insumos[l.insumo] && <option value={l.insumo}>{l.insumo} (sin precio)</option>}
                        {codigos.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="mt-0.5 max-w-[8rem] truncate text-[0.65rem] text-muted-foreground">
                        {insumos[l.insumo]?.descripcion ?? ''}
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <EditorCantidad q={l.cantidad} onChange={(q) => editarLinea(i, { cantidad: q })} />
                      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {explicarCantidad(l.cantidad)}
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <select
                        value={l.precio}
                        onChange={(e) => editarLinea(i, { precio: e.target.value as 'venta' | 'costo' })}
                        className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value="venta">Con margen</option>
                        <option value="costo">A costo</option>
                      </select>
                    </td>
                    <td className="px-1 py-1.5 text-right">
                      <div>{formatCLP(previa.lineas[i]?.total ?? 0)}</div>
                      <div className="text-[0.65rem] text-muted-foreground">
                        {(previa.lineas[i]?.cantidad ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ×{' '}
                        {formatCLP(previa.lineas[i]?.precioUnit ?? 0)}
                      </div>
                    </td>
                    <td className="px-1 py-1.5">
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={() => onChange(lineas.filter((_, j) => j !== i))}
                        title="Quitar este material"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => onChange([...lineas, { insumo: codigos[0] ?? '', precio: 'venta', cantidad: { tipo: 'porCortina' } }])}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar material
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => onChange(RECETAS_DEFAULT[fam] ?? [])}
              disabled={esDefault || !RECETAS_DEFAULT[fam]}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Volver a la de fábrica
            </Button>
            <span className="ml-auto text-xs font-medium">
              Total del ejemplo: {formatCLP(previa.total)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecetasFamiliasSection({ recetas, insumos, margenInsumo, onChange }: Props) {
  const orden = [...FAMILIAS_CON_RECETA, RECETA_VERTICAL_KEY, RECETA_DUO_GENERICO_KEY];
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <ClipboardList className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Materiales por familia</h2>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Lo que lleva cada cortina y en qué cantidad. Ojo: esto cambia el precio de{' '}
        <strong>todas</strong> las cortinas de la familia, también las de las cotizaciones que se
        vuelvan a abrir. La receta de <em>dúo sin receta propia</em> es un respaldo: solo se usa si
        aparece un dúo con un código que no está en esta lista.
      </p>
      <div className="space-y-1.5">
        {orden.map((fam) => (
          <Familia
            key={fam}
            fam={fam}
            lineas={recetas[fam] ?? []}
            insumos={insumos}
            margenInsumo={margenInsumo}
            onChange={(l) => onChange({ ...recetas, [fam]: l })}
          />
        ))}
      </div>
    </section>
  );
}
