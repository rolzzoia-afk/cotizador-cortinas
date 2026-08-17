// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Probar una cotización
//
// El equivalente del banco de pruebas del catálogo técnico, pero de precios:
// arma una cotización imaginaria y muestra CÓMO se llega a cada valor, con la
// misma forma que los paneles de colores del Excel.
//
// Regla de oro (igual que el probador de cortinas): acá no se recalcula nada
// por cuenta propia. Se llama a `cotizarFase0`, la misma función que cotiza de
// verdad. Si este panel y una cotización real no coinciden, el problema está en
// el motor, no en esta vista.
//
// Usa el BORRADOR, no lo guardado: así se ve el efecto de un cambio antes de
// aplicarlo.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import { useAnchoRollo, useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { cotizarFase0, type ResultadoFamilia } from '@/modules/cotizador/motorFase0';
import type { ReglasPrecios } from '@/modules/cotizador/reglasPrecios';

type FilaPrueba = {
  id: string;
  codInt: string;
  ancho: number;
  alto: number;
  cantidad: number;
  descuento: number; // 0-100
};

const nuevaFila = (codInt = ''): FilaPrueba => ({
  id: Math.random().toString(36).slice(2),
  codInt,
  ancho: 1.5,
  alto: 2.3,
  cantidad: 1,
  descuento: 0,
});

const m2 = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
const mts = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 3 });

function PanelFamilia({ f, lineas }: { f: ResultadoFamilia; lineas: { i: number; codInt: string; ancho: number; alto: number }[] }) {
  const nombreCortina = (i: number) => {
    const l = lineas[i];
    return l ? `${l.codInt} ${m2(l.ancho)}×${m2(l.alto)}` : `cortina ${i + 1}`;
  };
  return (
    <div className="rounded-md border">
      <header className="flex flex-wrap items-baseline gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold">{f.cod}</span>
        <span className="text-xs text-muted-foreground">
          {f.piezas} {f.piezas === 1 ? 'cortina' : 'cortinas'} · {m2(f.m2Total)} m²
        </span>
        {!f.exacto && (
          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[0.65rem]">
            sin receta propia: se usa la de respaldo
          </span>
        )}
      </header>

      <div className="grid gap-3 p-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-[0.7rem] font-semibold uppercase text-muted-foreground">
            Tela — {mts(f.metrosTela)} m × {formatCLP(f.precioMl)}
          </h4>
          <p className="mb-1.5 text-[0.7rem] text-muted-foreground">
            Precio por metro tomado de <span className="font-mono">{f.arquetipoCodInt || '—'}</span>.
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
          <h4 className="mb-1 text-[0.7rem] font-semibold uppercase text-muted-foreground">Materiales</h4>
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-[0.7rem]">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr>
                  <th className="py-0.5 text-left font-medium">Insumo</th>
                  <th className="py-0.5 text-left font-medium">Cuánto</th>
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
          ({formatCLP(f.costoTotal)} ÷ {m2(f.m2Total)} m²). Cada cortina de esta familia se cobra a
          este valor por sus metros cuadrados.
        </span>
      </div>
    </div>
  );
}

export function ProbadorCotizacionSection({
  reglas,
  hayErrores,
}: {
  reglas: ReglasPrecios;
  hayErrores: boolean;
}) {
  const { catalogo, loading } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();
  const { parametros } = useParametrosCotizador();
  const [filas, setFilas] = useState<FilaPrueba[]>([nuevaFila()]);

  const telas = useMemo(
    () =>
      Object.entries(catalogo)
        .filter(([, p]) => Number(p?.precio) > 0 && !/^(ACCESORIO|INSTALACION|INST)$/i.test(String(p?.cod ?? '')))
        .map(([codInt, p]) => ({ codInt, etiqueta: `${codInt} — ${p.producto ?? ''}`.slice(0, 52), cod: p.cod }))
        .sort((a, b) => a.codInt.localeCompare(b.codInt, 'es')),
    [catalogo],
  );

  const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);
  const resultado = useMemo(() => {
    if (hayErrores || !validas.length) return null;
    return cotizarFase0(
      validas.map((f) => ({
        codInt: f.codInt, ancho: f.ancho, alto: f.alto,
        cantidad: f.cantidad, descuento: f.descuento / 100,
      })),
      catalogo,
      anchoRollo,
      [],
      parametros,
      false,
      false,
      reglas,
    );
  }, [validas, catalogo, anchoRollo, parametros, reglas, hayErrores]);

  const editar = (id: string, patch: Partial<FilaPrueba>) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <FlaskConical className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Probar una cotización</h2>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Arma una cotización de mentira y muestra de dónde sale cada peso. Usa lo que hay{' '}
        <strong>en pantalla</strong>, incluso sin guardar, así se puede ver el efecto de un cambio
        antes de aplicarlo. Calcula con la misma función que cotiza de verdad.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Tela</th>
              <th className="px-2 py-1.5 text-left font-medium">Ancho (m)</th>
              <th className="px-2 py-1.5 text-left font-medium">Alto (m)</th>
              <th className="px-2 py-1.5 text-left font-medium">Cant.</th>
              <th className="px-2 py-1.5 text-left font-medium">Dcto %</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-2 py-1">
                  <select
                    value={f.codInt}
                    onChange={(e) => editar(f.id, { codInt: e.target.value })}
                    className="h-7 w-64 rounded-md border border-input bg-background px-1 text-xs"
                  >
                    <option value="">— elegir tela —</option>
                    {telas.map((t) => (
                      <option key={t.codInt} value={t.codInt}>{t.etiqueta}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1">
                  <Input type="number" step="0.01" value={String(f.ancho)}
                    onChange={(e) => editar(f.id, { ancho: Number(e.target.value) })}
                    className="h-7 w-20 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" step="0.01" value={String(f.alto)}
                    onChange={(e) => editar(f.id, { alto: Number(e.target.value) })}
                    className="h-7 w-20 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" value={String(f.cantidad)}
                    onChange={(e) => editar(f.id, { cantidad: Math.max(1, Number(e.target.value)) })}
                    className="h-7 w-16 text-xs" />
                </td>
                <td className="px-2 py-1">
                  <Input type="number" value={String(f.descuento)}
                    onChange={(e) => editar(f.id, { descuento: Number(e.target.value) })}
                    className="h-7 w-16 text-xs" />
                </td>
                <td className="px-1 py-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                    onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}
                    disabled={filas.length === 1}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" className="mt-2"
        onClick={() => setFilas((fs) => [...fs, nuevaFila(fs[fs.length - 1]?.codInt)])}>
        <Plus className="mr-1 h-3.5 w-3.5" />
        Agregar cortina
      </Button>

      {hayErrores && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          Hay errores más abajo: se corrigen y vuelve el cálculo.
        </p>
      )}
      {loading && <p className="mt-3 text-xs text-muted-foreground">Cargando el catálogo de telas…</p>}
      {!hayErrores && !loading && !validas.length && (
        <p className="mt-3 text-xs text-muted-foreground">Elige una tela para ver el cálculo.</p>
      )}

      {resultado && (
        <div className="mt-4 space-y-3">
          {resultado.familias.map((f) => (
            <PanelFamilia
              key={f.cod}
              f={f}
              lineas={resultado.lineas
                .map((l, i) => ({ i, codInt: l.codInt, ancho: l.ancho, alto: l.alto, cod: l.cod }))
                .filter((l) => l.cod === f.cod)}
            />
          ))}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Cortina</th>
                  <th className="px-2 py-1.5 text-right font-medium">m²</th>
                  <th className="px-2 py-1.5 text-right font-medium">× valor m²</th>
                  <th className="px-2 py-1.5 text-right font-medium">+ instalación</th>
                  <th className="px-2 py-1.5 text-right font-medium">Valor unitario</th>
                  <th className="px-2 py-1.5 text-right font-medium">Dcto</th>
                  <th className="px-2 py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {resultado.lineas.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">
                      <span className="font-mono">{l.codInt}</span> {m2(l.ancho)}×{m2(l.alto)}
                      {l.cantidad > 1 && <span className="text-muted-foreground"> ×{l.cantidad}</span>}
                    </td>
                    <td className="px-2 py-1 text-right">{m2(l.m2)}</td>
                    <td className="px-2 py-1 text-right">{formatCLP(l.precioM2)}</td>
                    <td className="px-2 py-1 text-right">{formatCLP(l.instalacionEmbebida)}</td>
                    <td className="px-2 py-1 text-right font-medium">{formatCLP(l.valorUnit)}</td>
                    <td className="px-2 py-1 text-right">
                      {l.descuento ? `${Math.round(l.descuento * 100)} %` : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-medium">{formatCLP(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-0.5 rounded-md border bg-card/40 p-3 text-xs">
            {resultado.instalacion.total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Instalación ({resultado.instalacion.cantidad} bajo el mínimo)
                </span>
                <span>{formatCLP(resultado.instalacion.total)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal neto</span>
              <span>{formatCLP(resultado.totales.subtotalNeto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span>{formatCLP(resultado.totales.ivaTransferencia)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total transferencia</span>
              <span>{formatCLP(resultado.totales.totalTransferencia)}</span>
            </div>
            <div className="flex justify-between border-t pt-0.5 text-muted-foreground">
              <span>Total tarjeta</span>
              <span>{formatCLP(resultado.totales.totalTarjeta)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
