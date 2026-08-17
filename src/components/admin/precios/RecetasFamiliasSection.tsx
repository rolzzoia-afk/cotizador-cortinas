// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Materiales por familia (las recetas)
//
// Qué lleva cada cortina y en qué cantidad: es el bloque de materiales de los
// paneles de colores del Excel, editable. Cada línea muestra su regla contada
// en castellano y, al lado, cuánto daría con una cotización de ejemplo, para
// que se vea el efecto antes de guardar.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardList, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
  sistemaDeFamilia,
  type CantidadReceta,
  type InsumoPrecio,
  type LineaReceta,
  type SistemaPrecio,
} from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

type Props = {
  recetas: Record<string, LineaReceta[]>;
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  /** Sistemas con precios y margen propios: sus familias van en su bloque. */
  sistemas: Record<string, SistemaPrecio>;
  /** Paso de lama vigente: manda las cantidades «por lama» de las verticales. */
  pasoLamaM: number;
  /** COD de familia que existen en el catálogo, para ofrecerles receta propia. */
  familiasCatalogo?: string[];
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

function Familia({ fam, lineas, insumos, margenInsumo, pasoLamaM, onChange }: {
  fam: string;
  lineas: LineaReceta[];
  insumos: Record<string, InsumoPrecio>;
  margenInsumo: number;
  /** El paso de lama vigente: manda las cantidades de tipo «por lama». */
  pasoLamaM: number;
  onChange: (l: LineaReceta[]) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const codigos = Object.keys(insumos).sort((a, b) => a.localeCompare(b, 'es'));
  const previa = materialesFamilia(lineas, EJEMPLO, insumos, margenInsumo, pasoLamaM);
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
                        {explicarCantidad(l.cantidad, pasoLamaM)}
                      </div>
                      {/* Hay líneas que parecen un error y son la réplica
                          deliberada de una fórmula equivocada del Excel: sin
                          este cartel, cualquiera las "corrige" y desalinea los
                          precios. */}
                      {l.nota && (
                        <div className="mt-1 flex max-w-[15rem] items-start gap-1 rounded border border-warning/40 bg-warning/10 p-1 text-[0.62rem] leading-snug">
                          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-warning" />
                          <span>{l.nota}</span>
                        </div>
                      )}
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

export function RecetasFamiliasSection({
  recetas,
  insumos,
  margenInsumo,
  sistemas,
  pasoLamaM,
  familiasCatalogo = [],
  onChange,
}: Props) {
  const orden = [...FAMILIAS_CON_RECETA, RECETA_VERTICAL_KEY, RECETA_DUO_GENERICO_KEY];
  const fila = (fam: string) => {
    // Una familia de sistema se cotiza con SU tabla de precios y SU margen: la
    // vista previa tiene que usar los mismos, o mostraría un total que la app
    // nunca cobra.
    const sis = sistemaDeFamilia(fam, sistemas);
    return (
      <Familia
        key={fam}
        fam={fam}
        lineas={recetas[fam] ?? []}
        insumos={sis ? { ...insumos, ...sis.insumos } : insumos}
        margenInsumo={sis?.margenInsumo ?? margenInsumo}
        pasoLamaM={pasoLamaM}
        onChange={(l) => onChange({ ...recetas, [fam]: l })}
      />
    );
  };

  // Familias de sistema y las agregadas a mano: cualquier receta que no esté en
  // el orden de siempre. Sin esto, una familia nueva quedaba invisible.
  const deSistemas = new Set(Object.values(sistemas).flatMap((s) => s.familias));
  const conocidas = new Set([...orden, ...deSistemas]);
  const extras = Object.keys(recetas)
    .filter((f) => !conocidas.has(f))
    .sort((a, b) => a.localeCompare(b, 'es'));

  // Familias que el catálogo tiene pero que no tienen receta propia: se cotizan
  // con la de respaldo, y hasta ahora no había dónde darles la suya.
  const sinReceta = familiasCatalogo
    .filter((f) => !recetas[f]?.length)
    .sort((a, b) => a.localeCompare(b, 'es'));

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
      <div className="space-y-1.5">{orden.map(fila)}</div>

      {Object.entries(sistemas).map(([clave, s]) =>
        s.familias.length ? (
          <div key={clave} className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold">
              {s.nombre}
              <span className="ml-2 font-normal text-muted-foreground">
                margen {Math.round((1 - s.margenInsumo) * 100)} %, con sus propios precios de insumo
              </span>
            </h3>
            <div className="space-y-1.5">{s.familias.map(fila)}</div>
          </div>
        ) : null,
      )}

      {extras.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1.5 text-xs font-semibold">
            Agregadas a mano
            <span className="ml-2 font-normal text-muted-foreground">
              familias que no vienen de fábrica
            </span>
          </h3>
          <div className="space-y-1.5">{extras.map(fila)}</div>
        </div>
      )}

      {sinReceta.length > 0 && (
        <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3">
          <p className="mb-2 text-xs">
            <strong>
              {sinReceta.length === 1
                ? 'Una familia del catálogo no tiene materiales propios'
                : `${sinReceta.length} familias del catálogo no tienen materiales propios`}
            </strong>
            : se cotizan con la receta de respaldo (la roller de su gama, o la de dúo si el código
            empieza con DUO). Darle la suya empieza por una copia de la de fábrica.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sinReceta.map((fam) => (
              <Button
                key={fam}
                variant="outline"
                size="sm"
                className="h-7 text-[0.7rem]"
                onClick={() =>
                  onChange({
                    ...recetas,
                    [fam]: (RECETAS_DEFAULT[fam] ?? recetas[RECETA_VERTICAL_KEY] ?? []).map((l) => ({ ...l })),
                  })
                }
              >
                <Plus className="mr-1 h-3 w-3" />
                {nombreFamilia(fam)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
