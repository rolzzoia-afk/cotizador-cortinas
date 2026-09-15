// Paso 2 del asistente: con qué receta se cobra cada familia nueva y cuál es su
// tela de referencia. Es lo que decide el precio, así que se muestra la cuenta
// tal como la va a hacer el motor.
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatCLP } from '@/lib/formatters';
import { flujoDeProducto } from '@/modules/cotizador/flujoCatalogo';
import { nombreFamilia } from '@/components/admin/precios/nombresFamilias';
import { SISTEMA_INVERTIDA_KEY } from '@/modules/cotizador/reglasPrecios';
import {
  codFamilia,
  familiasDelBorrador,
  moldeSugerido,
  moldesDisponibles,
  variantesDeMolde,
  type BorradorCategoria,
  type ContextoCategoria,
} from '@/modules/cotizador/nuevaCategoria';
import { aplicarNuevaCategoria } from '@/modules/cotizador/nuevaCategoriaAplicar';

type Props = {
  borrador: BorradorCategoria;
  ctx: ContextoCategoria;
  onChange: (patch: Partial<BorradorCategoria>) => void;
};

const NOMBRE_VARIANTE: Record<string, string> = {
  '|B': 'categoría B',
  '|INV': 'invertida',
  '|INV45': 'invertida 45 mm',
  '|45': 'tubo 45 mm',
  '|2T': 'dos telas',
  '|MET': 'cadena metálica',
};

export default function PasoCobro({ borrador: b, ctx, onChange }: Props) {
  const familias = familiasDelBorrador(b);
  const moldes = useMemo(() => moldesDisponibles(ctx.reglas, b.tipo), [ctx.reglas, b.tipo]);
  // La vista previa se hace sobre el resultado provisional: es exactamente lo
  // que va a pasar al crear, no una cuenta parecida.
  const previo = useMemo(() => aplicarNuevaCategoria(b, ctx), [b, ctx]);
  // Códigos con precio, para elegir de dónde sale la tela de una vertical.
  const conPrecio = useMemo(
    () =>
      Object.entries(ctx.catalogo)
        .filter(([, p]) => Number(p.precio) > 0)
        .map(([ci, p]) => ({ ci, etiqueta: `${ci} — ${p.producto} (${formatCLP(p.precio)}/m)` }))
        .sort((x, y) => x.ci.localeCompare(y.ci, 'es')),
    [ctx.catalogo],
  );

  if (!familias.length) {
    return (
      <p className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
        Agrega productos en el paso siguiente y acá se elige con qué se cobra cada familia.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {familias.map((cod) => {
        const molde = b.moldes[cod] || '';
        const filaRef = b.filas.find((f) => f.referencia && codFamilia(b, f) === cod);
        const ejemplo = b.filas.find((f) => codFamilia(b, f) === cod);
        const flujo = ejemplo?.codInt
          ? flujoDeProducto(
              previo.catalogo[ejemplo.codInt.toUpperCase()] ?? previo.catalogo[ejemplo.codInt],
              ejemplo.codInt.toUpperCase(),
              previo.catalogo,
              previo.reglas,
            )
          : null;
        return (
          <div key={cod} className="rounded-md border p-3">
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-xs font-semibold">{cod}</span>
              <span className="text-[11px] text-muted-foreground">
                {b.filas.filter((f) => codFamilia(b, f) === cod).length} producto(s)
              </span>
            </div>

            {b.tipo === 'vertical' ? (
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">
                    ¿De dónde sale el precio de su tela?
                  </label>
                  <select
                    value={filaRef ? '' : b.baseVerticalDe[cod] || ''}
                    disabled={!!filaRef}
                    onChange={(e) =>
                      onChange({ baseVerticalDe: { ...b.baseVerticalDe, [cod]: e.target.value } })
                    }
                    className="h-8 w-full rounded-md border bg-secondary px-2 text-xs disabled:opacity-60"
                  >
                    <option value="">Elige un código…</option>
                    {conPrecio.map((o) => (
                      <option key={o.ci} value={o.ci}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="self-end text-[11px] text-muted-foreground">
                  {filaRef
                    ? `Sale de su propia tela de referencia, ${filaRef.codInt}.`
                    : 'Las verticales no eligen receta: la arma el motor. Sus insumos VER se cobran con la tabla del sistema vertical.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-[11px] text-muted-foreground">Se cobra como…</label>
                  <select
                    value={molde}
                    onChange={(e) => onChange({ moldes: { ...b.moldes, [cod]: e.target.value } })}
                    className="h-8 w-full rounded-md border bg-secondary px-2 text-xs"
                  >
                    <option value="">Elige la familia…</option>
                    {moldes.map((m) => (
                      <option key={m} value={m}>
                        {nombreFamilia(m)}
                      </option>
                    ))}
                  </select>
                  {!molde && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ moldes: { ...b.moldes, [cod]: moldeSugerido(cod, b.tipo) } })
                      }
                      className="mt-1 text-[11px] text-accent underline"
                    >
                      Usar {nombreFamilia(moldeSugerido(cod, b.tipo))}
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {molde ? (
                    <>
                      <div>
                        Copia su lista de materiales
                        {variantesDeMolde(ctx.reglas, molde).length
                          ? ` y sus variantes (${variantesDeMolde(ctx.reglas, molde)
                              .map((v) => NOMBRE_VARIANTE[v] ?? v)
                              .join(', ')})`
                          : ''}
                        .
                      </div>
                      {ctx.reglas.sistemas[SISTEMA_INVERTIDA_KEY]?.familias.includes(molde) && (
                        <div>Se puede invertir con tubo de 63 o 45 mm, como {molde}.</div>
                      )}
                    </>
                  ) : (
                    'Sin esto, la familia se cobraría con la lista de materiales de otra cortina.'
                  )}
                </div>
              </div>
            )}

            <div className="mt-2 rounded border bg-secondary/40 p-2 text-[11px]">
              {filaRef ? (
                <span>
                  Tela de referencia: <strong className="font-mono">{filaRef.codInt}</strong> a{' '}
                  {formatCLP(filaRef.precio)}/m — es la que le fija el precio a toda la familia.
                </span>
              ) : (
                <span className="flex items-start gap-1.5 text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  Sin tela de referencia: se cobra la más cara que se venda de esta familia. Marca
                  una fila como «Ref.» en el paso siguiente para fijarla.
                </span>
              )}
              {flujo && (
                <div className="mt-1 text-muted-foreground">
                  {ejemplo?.codInt} se cotizaría con la receta{' '}
                  <strong className="font-mono">{flujo.recetaKey}</strong> y la tela a{' '}
                  {formatCLP(flujo.precioMl)}/m.
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
