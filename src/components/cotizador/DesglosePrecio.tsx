// ─────────────────────────────────────────────────────────────────────
// DESGLOSE DEL PRECIO de una familia: de dónde sale cada peso.
//
// Es el panel de colores del Excel hecho pantalla. Lo comparten el probador de
// Admin y el botón «Ver cómo se armó el precio» de Fase 1, para que la
// vendedora y quien edita los precios vean exactamente lo mismo.
//
// Solo dibuja: todo lo que muestra sale de `ResultadoFamilia`, que arma
// `cotizarFase0`. Si algo no cuadra, el problema está en el motor.
// ─────────────────────────────────────────────────────────────────────
import { AlertTriangle } from 'lucide-react';
import { formatCLP } from '@/lib/formatters';
import type { ResultadoFamilia } from '@/modules/cotizador/motorFase0';

export const m2 = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
export const mts = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 3 });

/**
 * Nombre de cada PIEZA de la familia, en el mismo orden en que el motor las
 * expande: una fila con cantidad 3 son 3 piezas seguidas. Los paños apuntan a
 * ese índice, no al de la fila — mezclarlos corría los nombres en cuanto había
 * una cantidad mayor que 1.
 */
export function nombresDePiezas(
  lineas: { codInt: string; ancho: number; alto: number; cantidad: number }[],
): string[] {
  const out: string[] = [];
  for (const l of lineas) {
    const n = Math.max(1, l.cantidad);
    for (let k = 0; k < n; k++) {
      out.push(`${l.codInt} ${m2(l.ancho)}×${m2(l.alto)}${n > 1 ? ` (${k + 1}/${n})` : ''}`);
    }
  }
  return out;
}

/**
 * Cómo están configuradas las cortinas con las que se calculó la tarifa del
 * panel: es lo que los botones de la grilla deciden fila por fila.
 */
export function comoSiFueran(
  f: Pick<ResultadoFamilia, 'lineaB' | 'invertida' | 'segundaTela'>,
): string {
  if (f.segundaTela) return 'la 2.ª tela de un doble';
  if (f.lineaB && f.invertida) return 'de categoría B e invertidas';
  if (f.lineaB) return 'de categoría B';
  if (f.invertida) return 'invertidas';
  return 'de categoría A y derechas';
}

/** De dónde salió el $/m de la familia, en castellano. */
export function origenDelPrecioMl(f: ResultadoFamilia): string {
  switch (f.motivoPrecioMl) {
    case 'sistema':
      return `tecleado para el sistema ${f.sistema ?? 'con reglas propias'} (Admin → Precios → Sistemas)`;
    case 'base':
      return `de ${f.arquetipoCodInt}, la tela base de las verticales de esta familia`;
    case 'arquetipo':
      return `de ${f.arquetipoCodInt}, la tela de referencia de la familia`;
    case 'maximo':
      return 'la tela MÁS CARA de la familia (la familia no tiene tela de referencia)';
    default:
      return 'ninguna tela de la familia tiene precio: la tela se cotiza en $0';
  }
}

/** «4.462,5 ÷ 0,65 = 6.865» — la cuenta con la que se cobra un insumo. */
export function formulaPrecioInsumo(
  l: { precio: 'venta' | 'costo'; precioUnit: number },
  margenInsumo: number,
): string {
  const unit = formatCLP(l.precioUnit);
  if (l.precio === 'costo') return `${unit} (a costo, sin margen)`;
  const valorMaximo = (l.precioUnit * margenInsumo).toLocaleString('es-CL', {
    maximumFractionDigits: 2,
  });
  return `${valorMaximo} ÷ ${margenInsumo.toLocaleString('es-CL')} = ${unit}`;
}

export function PanelFamilia({ f, piezas }: { f: ResultadoFamilia; piezas: string[] }) {
  const nombreCortina = (i: number) => piezas[i] ?? `cortina ${i + 1}`;
  // La tarifa se calcula con TODA la familia configurada como este panel; si
  // no todas se cobran acá, se dice, para que el 4 cortinas del encabezado
  // no se lea como «cuatro B» cuando la B es una.
  const mixta = f.piezasCobradas < f.piezas;
  return (
    <div className="rounded-md border">
      <header className="flex flex-wrap items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold">{f.cod}</span>
        {f.lineaB && (
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] text-amber-700">
            Categoría B: sus herrajes, su mano de obra y su tela de referencia
          </span>
        )}
        {f.segundaTela && (
          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[0.65rem] text-violet-700">
            2.ª tela del doble: sin riel — los 4 perfiles los paga la primera tela de la ventana
          </span>
        )}
        {f.invertida && (
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[0.65rem] text-sky-700">
            {f.sistemaInvertida
              ? 'Invertida: tela a lo largo del rollo (ancho + extra), tubo 63 mm y kit MEC 28, mano de obra y traslado propios'
              : 'Invertida: tela a lo largo del rollo (ancho + extra), un tiro por cortina; herraje de siempre'}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {mixta ? (
            <>
              tarifa calculada con las {f.piezas} cortinas de la familia ({m2(f.m2Total)} m²) como si
              todas fueran {comoSiFueran(f)} · se cobra a{' '}
              {f.piezasCobradas === 1 ? '1 cortina' : `${f.piezasCobradas} cortinas`} (
              {m2(f.m2Cobrados)} m²)
            </>
          ) : (
            <>
              {f.piezas} {f.piezas === 1 ? 'cortina' : 'cortinas'} · {m2(f.m2Total)} m²
            </>
          )}
        </span>
        {f.sistema && (
          <span className="rounded bg-success/20 px-1.5 py-0.5 text-[0.65rem]">
            sistema {f.sistema}: margen, mano de obra e instalación propios
          </span>
        )}
        {!f.exacto && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem]">
            {f.lineaB
              ? 'receta B transcrita del Excel, sin cotización real que la valide todavía'
              : f.invertida
                ? 'receta de invertida sin cotización real que la valide todavía'
                : 'sin receta propia: se usa la de respaldo'}
          </span>
        )}
      </header>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-[0.7rem] font-semibold uppercase text-muted-foreground">
            Tela — {mts(f.metrosTela)} m × {formatCLP(f.precioMl)}
          </h4>
          <p className="mb-1.5 text-[0.7rem] text-muted-foreground">
            Precio por metro {origenDelPrecioMl(f)}.
          </p>
          {f.panos.length > 0 ? (
            <table className="w-full text-[0.7rem]">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-0.5 text-left font-medium">Paño</th>
                  <th className="py-0.5 text-left font-medium">Se cortan juntas</th>
                  <th className="py-0.5 text-right font-medium">Alto que manda</th>
                </tr>
              </thead>
              <tbody>
                {f.panos.map((p) => (
                  <tr key={p.letra} className="border-t">
                    <td className="py-0.5 font-medium">{p.letra}</td>
                    <td className="py-0.5">{p.cortinas.map(nombreCortina).join(' + ')}</td>
                    <td className="py-0.5 text-right">{mts(p.alto)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : f.lamas ? (
            <p className="text-[0.7rem] text-muted-foreground">
              {m2(f.lamas.total)} lamas en total, y de cada pasada del rollo salen{' '}
              {f.lamas.porPasada} → {mts(f.metrosTela)} m de tela. Se cobra la fracción de pasada
              que se usa, sin saltar al paño entero.
              {f.lamas.minimoUnaPasada && ' Con el piso de una pasada completa por cortina.'}
            </p>
          ) : (
            <p className="text-[0.7rem] text-muted-foreground">
              Las verticales no comparten paño: cada una paga paños enteros de su ancho de rollo,
              como en la planilla.
            </p>
          )}
          <p className="mt-1.5 text-xs font-medium">Tela: {formatCLP(f.costoTela)}</p>
        </div>

        <div>
          <h4 className="mb-1 text-[0.7rem] font-semibold uppercase text-muted-foreground">
            Materiales — receta <span className="font-mono normal-case">{f.claveReceta}</span>
          </h4>
          <p className="mb-1.5 text-[0.7rem] text-muted-foreground">
            Cada material se cobra a su <strong>VALOR MÁXIMO ÷ {f.margenInsumo.toLocaleString('es-CL')}</strong>{' '}
            (margen del {Math.round((1 - f.margenInsumo) * 100)} %), salvo los marcados «a costo».
          </p>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-[0.7rem]">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr>
                  <th className="py-0.5 text-left font-medium">Insumo</th>
                  <th className="py-0.5 text-left font-medium">Cuánto</th>
                  <th className="py-0.5 text-right font-medium">Precio unit.</th>
                  <th className="py-0.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {f.materiales.map((l, i) => (
                  <tr key={`${l.insumo}-${i}`} className="border-t">
                    <td className="py-0.5">
                      <span className="font-mono">{l.insumo}</span>
                      {l.precio === 'costo' && (
                        <span className="ml-1 text-[0.6rem] text-muted-foreground">a costo</span>
                      )}
                      {l.descripcion && (
                        <div className="text-[0.6rem] text-muted-foreground">{l.descripcion}</div>
                      )}
                    </td>
                    <td className="py-0.5 text-muted-foreground">
                      {m2(l.cantidad)} — {l.regla}
                      {l.nota && (
                        <div className="mt-0.5 flex items-start gap-1 text-[0.6rem] text-warning">
                          <AlertTriangle className="mt-px h-2.5 w-2.5 shrink-0" />
                          <span>{l.nota}</span>
                        </div>
                      )}
                    </td>
                    <td
                      className="py-0.5 text-right text-muted-foreground"
                      title={formulaPrecioInsumo(l, f.margenInsumo)}
                    >
                      {formulaPrecioInsumo(l, f.margenInsumo)}
                    </td>
                    <td className="py-0.5 text-right">{formatCLP(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs font-medium">Materiales: {formatCLP(f.costoMateriales)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 border-t px-3 py-2 text-xs sm:grid-cols-3">
        <span className="text-muted-foreground">Mano de obra</span>
        <span className="text-right sm:text-left">{formatCLP(f.manoObra)}</span>
        <span className="hidden sm:block" />
        <span className="text-muted-foreground">Traslado</span>
        <span className="text-right sm:text-left">{formatCLP(f.traslado)}</span>
        <span className="hidden sm:block" />
        {f.regalo > 0 && (
          <>
            <span className="text-muted-foreground">Regalo</span>
            <span className="text-right sm:text-left">{formatCLP(f.regalo)}</span>
            <span className="hidden sm:block" />
          </>
        )}
        <span className="font-medium">Costo total</span>
        <span className="text-right font-medium sm:text-left">{formatCLP(f.costoTotal)}</span>
        <span className="hidden sm:block" />
      </div>

      <div className="border-t bg-success/10 px-3 py-2 text-xs">
        <strong>Valor del m² = {formatCLP(f.precioM2)}</strong>{' '}
        <span className="text-muted-foreground">
          ({formatCLP(f.costoTotal)} ÷ {m2(f.m2Total)} m²).
        </span>
        {/* El último paso, el que faltaba: de la tarifa al precio de la fila.
            Sin esto había que abrir el probador de Admin para verlo. */}
        <div className="mt-1 text-muted-foreground">
          Y cada cortina paga <strong>sus metros cuadrados × {formatCLP(f.precioM2)}</strong>
          {f.instalacionEmbebida > 0 ? (
            <>
              {' '}
              <strong>+ {formatCLP(f.instalacionEmbebida)}</strong> de instalación, que va DENTRO
              del valor unitario.
            </>
          ) : (
            <> (sin instalación: no se cobra ni acá ni en la fila de abajo).</>
          )}{' '}
          El DCT % de la fila se aplica al final, sobre ese valor unitario.
        </div>
        <div className="mt-1 text-[0.7rem] text-muted-foreground">
          Los m² de cada cortina son ancho × (alto vendido + {mts(f.extraAltoM)} m
          {f.extraAltoM > 0 ? ' de tela extra' : ''}
          ). La tela se acuesta en un rollo de {mts(f.anchoRolloM)} m.
        </div>
      </div>
    </div>
  );
}
