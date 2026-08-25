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
import { AlertTriangle, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import { PanelFamilia, m2, nombresDePiezas } from '@/components/cotizador/DesglosePrecio';
import { useAnchoRollo, useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { claveCatalogoCanonica } from '@/modules/cotizador/importarCatalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { esCortinaTipo } from '@/modules/cotizador/flujoCatalogo';
import { anchoEmpaquePeorCasoM } from '@/modules/cotizador/empaqueFase0';
import { debeInvertirPano, resolverAnchoRollo } from '@/modules/cotizador/tela';
import { gamaTelaEsB } from '@/modules/cotizador/lineaB';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { categoriasParaSelect } from '@/modules/descuentos/tiposCortina';
import { cotizarFase0, textoInstalacion } from '@/modules/cotizador/motorFase0';
import type { ReglasPrecios } from '@/modules/cotizador/reglasPrecios';

type FilaPrueba = {
  id: string;
  codInt: string;
  /**
   * Categoría de cortina. Solo importa en oscuridad y beeblack, donde la tela
   * se corta a otra medida según el montaje: sin ella no se puede reproducir el
   * consumo real de esas cortinas. Vacía = se cotiza con el ancho nominal.
   */
  categoria: string;
  ancho: number;
  alto: number;
  cantidad: number;
  descuento: number; // 0-100
};

const nuevaFila = (codInt = ''): FilaPrueba => ({
  id: Math.random().toString(36).slice(2),
  codInt,
  categoria: '',
  ancho: 1.5,
  alto: 2.3,
  cantidad: 1,
  descuento: 0,
});

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
  const { reglas: reglasSeleccion } = useReglasSeleccion();
  const { formulas } = useFormulasFamilias();
  const [filas, setFilas] = useState<FilaPrueba[]>([nuevaFila()]);
  const [region, setRegion] = useState(false);
  const [sinInstalacion, setSinInstalacion] = useState(false);
  const categorias = useMemo(
    () => categoriasParaSelect(reglasSeleccion.tipos),
    [reglasSeleccion.tipos],
  );

  // Solo telas de CORTINA: las mismas que Fase 1 deja elegir como cortina. Antes
  // el filtro era una lista de códigos escrita a mano acá, distinta de la del
  // motor, y dejaba entrar adicionales.
  //
  // Las telas SIN precio también entran: preguntar «cuánto vale la BK 10» y que
  // el código no aparezca no explica nada; el desglose dice justamente que su
  // familia no tiene tela con precio.
  const telas = useMemo(
    () =>
      Object.entries(catalogo)
        .filter(([, p]) => esCortinaTipo(p?.tipo))
        .map(([codInt, p]) => ({
          codInt,
          etiqueta: `${p.producto ?? ''}${p.descripcion ? ` · ${p.descripcion}` : ''}`.slice(0, 60),
          cod: p.cod,
        }))
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
        // Igual que Fase 1: en oscuridad y beeblack la tela se corta a otra
        // medida según el montaje, que recién se sabe en Fase 2, así que se
        // empaqueta con el PEOR caso. Sin categoría no aplica y devuelve
        // undefined, o sea el ancho nominal.
        anchoEmpaqueM: anchoEmpaquePeorCasoM(f.categoria, f.ancho, formulas, reglasSeleccion.tipos),
        // Corte invertido automático (la cortina no entra en el rollo), la
        // misma regla que la grilla de Fase 1; el probador no tiene el forzado.
        invertida: debeInvertirPano(
          f.ancho,
          resolverAnchoRollo(f.codInt, anchoRollo, catalogo, parametros.anchoRolloDefaultM),
        ),
        // Categoría B por la gama de la tela (el probador no tiene el forzado).
        lineaB: gamaTelaEsB(f.codInt, catalogo),
      })),
      catalogo,
      anchoRollo,
      [],
      parametros,
      region,
      sinInstalacion,
      reglas,
    );
  }, [
    validas, catalogo, anchoRollo, parametros, reglas, hayErrores,
    region, sinInstalacion, formulas, reglasSeleccion.tipos,
  ]);

  const editar = (id: string, patch: Partial<FilaPrueba>) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  // «bk10» → «BK 10»: la llave real del catálogo, igual que en Fase 1.
  const canonizar = (ci: string) => claveCatalogoCanonica(catalogo, ci) ?? ci;

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <FlaskConical className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Probar una cotización</h2>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        Arma una cotización de mentira y muestra de dónde sale cada peso. Calcula con la misma
        función que cotiza de verdad, usando las <strong>reglas que hay en pantalla</strong> aunque
        no estén guardadas, así se ve el efecto de un cambio antes de aplicarlo. La mano de obra, el
        traslado, la instalación y el IVA salen de «Parámetros de cotización»{' '}
        <strong>ya guardados</strong>: si los acabas de editar más abajo, guarda para verlos acá.
      </p>

      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={region} onChange={(e) => setRegion(e.target.checked)} />
          Cotización de región
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={sinInstalacion}
            onChange={(e) => setSinInstalacion(e.target.checked)}
          />
          Sin instalación (el cliente retira)
        </label>
      </div>

      {/* Sugerencias del buscador: el código y, al lado, de qué tela se trata. */}
      <datalist id="probador-telas">
        {telas.map((t) => (
          <option key={t.codInt} value={t.codInt}>
            {t.etiqueta}
          </option>
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Tela</th>
              <th className="px-2 py-1.5 text-left font-medium">Categoría</th>
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
                {/* Escribir el código, no bajar una lista de mil telas: la
                    pregunta de verdad es «cuánto vale la BK 10 y por qué». */}
                <td className="px-2 py-1">
                  <Input
                    list="probador-telas"
                    value={f.codInt}
                    onChange={(e) => editar(f.id, { codInt: canonizar(e.target.value) })}
                    placeholder="ej. BK 10"
                    className="h-7 w-40 font-mono text-xs uppercase"
                  />
                  <div className="mt-0.5 max-w-[16rem] truncate text-[0.65rem] text-muted-foreground">
                    {f.codInt
                      ? (catalogo[f.codInt]?.producto ?? 'ese código no está en el catálogo')
                      : ''}
                  </div>
                </td>
                <td className="px-2 py-1">
                  <select
                    value={f.categoria}
                    onChange={(e) => editar(f.id, { categoria: e.target.value })}
                    className="h-7 w-44 rounded-md border border-input bg-background px-1 text-xs"
                    title="Solo cambia el cálculo en oscuridad y beeblack, donde la tela se corta según el montaje"
                  >
                    <option value="">— sin categoría —</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>{c}</option>
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
          {resultado.avisos.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                El motor no pudo resolver todo
              </div>
              <ul className="ml-4 list-disc space-y-0.5">
                {resultado.avisos.map((a, i) => <li key={i}>{a.mensaje}</li>)}
              </ul>
            </div>
          )}

          {resultado.familias.map((f) => (
            <PanelFamilia
              key={f.clave}
              f={f}
              // Los paños apuntan a todas las cortinas de la familia: la tarifa
              // de cada panel se calcula con todas, se cobre con él o no.
              piezas={nombresDePiezas(resultado.lineas.filter((l) => l.cod === f.cod))}
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
            {/* La fila de instalación se muestra SIEMPRE que haya cortinas
                instalables: con total 0 hay que decir por qué es gratis, no
                hacerla desaparecer. */}
            {resultado.instalacion.cantidad > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Instalación ({textoInstalacion(resultado.instalacion, parametros.instalacionGratisMinCortinas)})
                  </span>
                  <span>
                    {resultado.instalacion.total > 0
                      ? formatCLP(resultado.instalacion.total)
                      : resultado.instalacion.sinInstalacion
                        ? '—'
                        : 'GRATIS'}
                  </span>
                </div>
                {/* Los tramos: con dos sistemas en juego el precio por cortina
                    no es uno solo (roller 17.500 vs beeblack 35.000). */}
                {resultado.instalacion.partes.map((p) => (
                  <div key={p.sistema} className="flex justify-between pl-3 text-[0.7rem] text-muted-foreground">
                    <span>
                      {p.sistema}: {p.cantidad} × {formatCLP(p.precioUnit)}
                      {p.siempreSeCobra && p.total > 0 && ' (se cobra siempre)'}
                    </span>
                    <span>{formatCLP(p.total)}</span>
                  </div>
                ))}
              </>
            )}
            {/* Lo que ya está cobrado dentro de cada valor unitario: no suma al
                subtotal, pero se está cobrando y hay que poder verlo. */}
            {resultado.instalacion.incluidas.map((p) => (
              <div key={`incl-${p.sistema}`} className="flex justify-between text-[0.7rem] text-muted-foreground">
                <span>
                  Instalación {p.sistema}: {p.cantidad} × {formatCLP(p.precioUnit)} (ya incluida en
                  el valor unitario)
                </span>
                <span>{formatCLP(p.total)}</span>
              </div>
            ))}
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
