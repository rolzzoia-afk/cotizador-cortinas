// ─────────────────────────────────────────────────────────────────────
// Admin → Optimizador: los cálculos de tela de una OT, en pantalla.
//
// Es el equivalente de las hojas «Optimizador» y «Optimizador Verticales»
// del Excel manual: para la OT elegida se muestran los mismos cuatro
// bloques, primero los de la hoja principal (roller y compañía) y después
// los de la hoja de verticales, que en el taller se cortan en mesa aparte.
//
//   1. Resumen del pedido — una fila por cortina con TODAS las columnas
//      intermedias (extra, alto+extra, alto real, m², ancho paño, n° paño).
//   2. Optimizador de telas — una fila por paño, con su alto a utilizar.
//   3. Total por tipo de tela — los metros agrupados por producto.
//   4. Total por COD_INT — los metros que hay que bajar de cada rollo.
//
// SOLO LECTURA: los números salen de `construirHojaCorte`, exactamente los
// mismos que imprime la hoja de corte en PDF — acá no se recalcula nada. Para
// EDITAR el plan (ancho de paño, n° de paño, letra "cortar junto") está la
// pantalla de Tela de la OT, enlazada en el encabezado.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, Loader2, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { SelectorOTs } from '@/pages/optimizador-tela/SelectorOTs';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import {
  asignarJuntoEnOrden,
  buildOptimizerRows,
  calcularPanos,
  restorePlanGuardado,
  type OptimizerRow,
} from '@/modules/cotizador/tela';
import { rowToPano, type ColmenaPanoRow, type PanoColmena } from '@/modules/cotizador/planCorte';
import {
  construirHojaCorte,
  partirHojaCorte,
  totalesPorTipoDeTela,
  type FilaCorteCortina,
  type HojaCorte,
} from '@/modules/cotizador/pdfCorteOptimizacion';
import type { OT } from '@/modules/ots/types';

// Metros con 3 decimales, como la hoja de corte; m² con 2.
const m3 = (n: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const m2f = (n: number) =>
  n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TH = 'whitespace-nowrap p-1.5 text-[0.62rem] font-medium uppercase tracking-wide';

function Bloque({
  titulo,
  extra,
  children,
}: {
  titulo: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <strong className="text-sm">{titulo}</strong>
        {extra && <span className="text-[0.68rem] text-muted-foreground">{extra}</span>}
      </div>
      <div className="max-h-[460px] overflow-auto">{children}</div>
    </div>
  );
}

/** Una de las dos hojas del Excel: resumen + paños + totales. */
function HojaOptimizador({
  titulo,
  filas,
  lado,
  parametros,
  nombreDe,
  verde,
}: {
  titulo: string;
  filas: { r: OptimizerRow; c: FilaCorteCortina | undefined }[];
  lado: HojaCorte;
  parametros: Parameters<typeof calcularPanos>[1];
  nombreDe: (codInt: string) => string;
  verde?: boolean;
}) {
  const totalTelas = useMemo(
    () => totalesPorTipoDeTela(lado.optimizador, nombreDe),
    [lado.optimizador, nombreDe],
  );
  const totalM2 = useMemo(
    () => calcularPanos(filas.map((f) => f.r), parametros).totalM2,
    [filas, parametros],
  );
  const metrosTotales = lado.optimizador.reduce((s, o) => s + o.metros, 0);
  // Paños que salen de la colmena: ya están cortados, no entran a TOTAL PAÑOS
  // ni suman metros de rollo (por eso el bloque 2 puede verse "corto").
  const deColmena = filas.filter((f) => f.c?.medidaColmena).length;

  return (
    <section className="space-y-3">
      <h3
        className={`flex items-center gap-2 text-base font-semibold ${
          verde ? 'text-emerald-500' : 'text-accent'
        }`}
      >
        <Scissors className="h-4 w-4" />
        {titulo}
      </h3>

      {/* 1 · Resumen del pedido */}
      <Bloque
        titulo="Resumen del pedido"
        extra={`${filas.length} cortina${filas.length !== 1 ? 's' : ''} · ${m2f(totalM2)} m²`}
      >
        <table className="w-full text-[0.7rem]">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className={`${TH} text-left`}>Cod</th>
              <th className={`${TH} text-center`}>Cant</th>
              <th className={`${TH} text-left`}>Producto</th>
              <th className={`${TH} text-left`}>CodInt</th>
              <th className={`${TH} text-left`}>Tipo</th>
              <th className={`${TH} text-right`}>Ancho (m)</th>
              <th className={`${TH} text-right`}>Alto (m)</th>
              <th className={`${TH} text-right`}>Extra</th>
              <th className={`${TH} text-right`}>Alto+Extra</th>
              <th className={`${TH} text-right`}>Alto Real</th>
              <th className={`${TH} text-right`}>M²</th>
              <th className={`${TH} text-right`}>Ancho Rollo</th>
              <th className={`${TH} text-right`}>Ancho Paño</th>
              <th className={`${TH} text-center`}>N° Paño</th>
              <th className={`${TH} text-center`}>Junto</th>
              <th className={`${TH} text-left`}>Obs.</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ r, c }, idx) => (
              <tr key={idx} className="border-t border-border hover:bg-card">
                <td className="p-1.5 font-mono">{r.cod}</td>
                <td className="p-1.5 text-center">{r.cant}</td>
                <td className="max-w-[160px] truncate p-1.5" title={r.producto}>
                  {r.producto}
                </td>
                <td className="p-1.5 font-mono text-muted-foreground">{r.codInt}</td>
                <td className="p-1.5 text-muted-foreground">{r.tipo}</td>
                <td className="p-1.5 text-right tabular-nums">{r.ancho.toFixed(4)}</td>
                <td className="p-1.5 text-right tabular-nums">{r.alto.toFixed(4)}</td>
                <td className="p-1.5 text-right tabular-nums">{r.extra.toFixed(2)}</td>
                <td className="p-1.5 text-right tabular-nums">{r.altoExtra.toFixed(4)}</td>
                <td className="p-1.5 text-right tabular-nums">{r.altoReal.toFixed(4)}</td>
                <td className="p-1.5 text-right tabular-nums">{r.m2.toFixed(4)}</td>
                <td className="p-1.5 text-right tabular-nums text-muted-foreground">
                  {r.anchoRollo.toFixed(2)}
                </td>
                <td className="p-1.5 text-right tabular-nums">{r.anchoPano.toFixed(4)}</td>
                <td className="p-1.5 text-center tabular-nums">{c?.pano || r.numeroPano || '—'}</td>
                <td className="p-1.5 text-center font-bold">{c?.cortarJunto || r.junto || '—'}</td>
                <td className="whitespace-nowrap p-1.5 text-[0.65rem]">
                  {c?.comentario && (
                    <span
                      className={
                        c.comentario === 'NO CABE' ? 'font-bold text-destructive' : 'text-warning'
                      }
                    >
                      {c.comentario}
                    </span>
                  )}
                  {c?.medidaColmena && (
                    <span className="ml-1 text-emerald-500">
                      {c.medidaColmena}
                      {c.ubicColmena ? ` · ${c.ubicColmena}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloque>

      {/* 2 · Optimizador de telas (un paño por fila) */}
      <Bloque
        titulo="Optimizador de telas"
        extra={
          <>
            {lado.totalPanos} paño{lado.totalPanos !== 1 ? 's' : ''} a cortar del rollo
            {deColmena > 0 && ` · ${deColmena} pieza(s) salen de la colmena`}
          </>
        }
      >
        {lado.panos.length === 0 ? (
          <p className="p-4 text-center text-[0.72rem] text-muted-foreground">
            Ningún paño se corta del rollo
            {deColmena > 0 ? ': todos salen de sobrantes de la colmena.' : '.'}
          </p>
        ) : (
          <table className="w-full text-[0.7rem]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className={`${TH} text-center`}>Paño</th>
                <th className={`${TH} text-left`}>Producto</th>
                <th className={`${TH} text-left`}>CodInt</th>
                <th className={`${TH} text-right`}>Alto a utilizar (m)</th>
                <th className={`${TH} text-left`}>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {lado.panos.map((p) => (
                <tr key={p.pano} className="border-t border-border hover:bg-card">
                  <td className="p-1.5 text-center font-bold tabular-nums">{p.pano}</td>
                  <td className="max-w-[220px] truncate p-1.5" title={p.tipo}>
                    {p.tipo}
                  </td>
                  <td className="p-1.5 font-mono text-muted-foreground">{p.cod}</td>
                  <td className="p-1.5 text-right tabular-nums">
                    {p.altoMaxUtilizar === '' ? m3(p.altoCortePano) : m3(p.altoMaxUtilizar)}
                  </td>
                  <td className="whitespace-nowrap p-1.5 text-[0.65rem] text-warning">
                    {p.invertida ? 'INVERTIDA · es el ancho consumido del rollo' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Bloque>

      <div className="grid gap-3 md:grid-cols-2">
        {/* 3 · Total por tipo de tela */}
        <Bloque titulo="Total por tipo de tela">
          <table className="w-full text-[0.72rem]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className={`${TH} text-left`}>Producto</th>
                <th className={`${TH} text-right`}>Metros</th>
              </tr>
            </thead>
            <tbody>
              {totalTelas.map((t) => (
                <tr key={t.producto} className="border-t border-border">
                  <td className="p-1.5">{t.producto}</td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">{m3(t.metros)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-border font-semibold">
              <tr>
                <td className="p-1.5 text-right">Total</td>
                <td className="p-1.5 text-right tabular-nums text-success">{m3(metrosTotales)}</td>
              </tr>
            </tfoot>
          </table>
        </Bloque>

        {/* 4 · Total por COD_INT */}
        <Bloque titulo="Total por COD_INT">
          <table className="w-full text-[0.72rem]">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className={`${TH} text-left`}>CodInt</th>
                <th className={`${TH} text-left`}>Producto</th>
                <th className={`${TH} text-right`}>Total a utilizar</th>
              </tr>
            </thead>
            <tbody>
              {lado.optimizador.map((o) => (
                <tr key={o.codInt} className="border-t border-border">
                  <td className="p-1.5 font-mono">{o.codInt}</td>
                  <td className="max-w-[180px] truncate p-1.5" title={nombreDe(o.codInt)}>
                    {nombreDe(o.codInt)}
                  </td>
                  <td className="p-1.5 text-right font-semibold tabular-nums">
                    {m3(o.metros)}
                    {o.metros === 0 && (
                      <span className="ml-1 text-[0.62rem] font-normal text-emerald-500">
                        (todo de colmena)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloque>
      </div>
    </section>
  );
}

export function OptimizadorOTSection() {
  const { empresaId } = useAuth();
  const [ot, setOt] = useState<OT | null>(null);

  const { catalogo, loading: loadingCat } = useCatalogoProductos();
  const { parametros, loading: loadingParams } = useParametrosCotizador();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const { reglas, loading: loadingReglas } = useReglasSeleccion();

  // Sobrantes disponibles de la colmena de paños: los mismos que mira la hoja
  // de corte para saber qué pieza sale de un sobrante y no del rollo.
  const [colmena, setColmena] = useState<PanoColmena[] | null>(null);
  useEffect(() => {
    if (!empresaId || !ot) return;
    let vivo = true;
    setColmena(null);
    supabase
      .from('colmena_panos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('disponible', true)
      .then(({ data }) => {
        if (vivo) setColmena(((data || []) as ColmenaPanoRow[]).map(rowToPano));
      });
    return () => {
      vivo = false;
    };
  }, [empresaId, ot]);

  // Misma receta que Fase 4: nunca calcular con los defaults de fábrica.
  const plan = useMemo(() => {
    if (!ot || loadingCat || loadingParams || loadingFormulas || loadingReglas) return null;
    const fresh = buildOptimizerRows(ot.storeVentanas, catalogo, parametros, formulas, reglas);
    if (fresh.length === 0) return { rows: [] as OptimizerRow[], automatico: false };
    const guardado = ot.datosGenerales?.optimizerRows;
    const restored = restorePlanGuardado(fresh, guardado);
    const tieneJunto = restored.some((r) => r.junto && r.junto !== '' && r.junto !== '?');
    return {
      rows: tieneJunto ? restored : asignarJuntoEnOrden(restored),
      automatico: !tieneJunto,
    };
  }, [ot, loadingCat, catalogo, loadingParams, parametros, loadingFormulas, formulas, loadingReglas, reglas]);

  const hoja = useMemo(() => {
    if (!ot || !plan || plan.rows.length === 0 || colmena === null) return null;
    return construirHojaCorte(
      plan.rows,
      colmena,
      ot,
      parametros,
      ot.datosGenerales?.corteGeneralColmena?.piezas,
    );
  }, [ot, plan, colmena, parametros]);

  const nombreDe = useMemo(
    () => (codInt: string) => catalogo[codInt]?.producto ?? codInt,
    [catalogo],
  );

  if (!ot) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Optimizador de la OT</h2>
          <p className="text-sm text-muted-foreground">
            Elige una OT para ver cómo se arman sus cálculos de tela: el resumen del pedido, los
            paños y los metros por tipo de tela — las mismas hojas «Optimizador» y «Optimizador
            Verticales» del Excel manual.
          </p>
        </div>
        <SelectorOTs onSelect={setOt} />
      </div>
    );
  }

  const dg = ot.datosGenerales || {};
  const partes = hoja ? partirHojaCorte(hoja) : null;
  const filasConCorte = plan && hoja
    ? plan.rows.map((r, i) => ({ r, c: hoja.cortinas[i] }))
    : [];
  const filasPrincipal = filasConCorte.filter((f) => !f.c?.esVertical);
  const filasVertical = filasConCorte.filter((f) => f.c?.esVertical);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            OT <span className="font-mono">{dg.ot || ot.id}</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dg.cliente || '(sin cliente)'}
            </span>
          </h2>
          <p className="text-[0.72rem] text-muted-foreground">
            Solo lectura: los mismos números que imprime la hoja de corte. Para cambiar paños o
            letras, entra a la pantalla de Tela.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to={`/ots/${ot.id}/tela`} className="flex items-center gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Abrir en Tela
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOt(null)}>
            Elegir otra OT
          </Button>
        </div>
      </div>

      {plan && plan.automatico && plan.rows.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-[0.75rem]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            Esta OT no tiene un plan de paños guardado: se muestra el <strong>automático</strong>{' '}
            (el mismo que propone el optimizador). Si en Tela se guarda otro agrupado, estos números
            cambian.
          </span>
        </div>
      )}

      {!plan || colmena === null ? (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Calculando la OT…
        </div>
      ) : plan.rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Esta OT no tiene paños: agrega ventanas en Fase 2 para que haya algo que optimizar.
        </p>
      ) : (
        <div className="space-y-6">
          {filasPrincipal.length > 0 && partes && (
            <HojaOptimizador
              titulo="Optimizador"
              filas={filasPrincipal}
              lado={partes.principal}
              parametros={parametros}
              nombreDe={nombreDe}
            />
          )}
          {filasVertical.length > 0 && partes && (
            <HojaOptimizador
              titulo="Optimizador Verticales"
              filas={filasVertical}
              lado={partes.vertical}
              parametros={parametros}
              nombreDe={nombreDe}
              verde
            />
          )}
        </div>
      )}
    </div>
  );
}
