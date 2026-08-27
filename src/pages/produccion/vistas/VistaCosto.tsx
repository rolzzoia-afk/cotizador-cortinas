// Costo total de la OT — solo administradores.
//
// Es la única pantalla del taller que mira plata: cuánta tela y cuánto aluminio
// se consumieron DE VERDAD, con las fallas, contra lo que se cobró.
//
// Lo que se puede calcular se calcula (metros del optimizador, cortes de la
// colmena, insumos de la hoja de inventario). Lo que solo sabe una persona
// —mano de obra, auto, TAG y las fallas de tela— se escribe a mano y queda
// guardado en la OT. Nada se inventa: lo que no tiene costo cargado sale
// nombrado como hueco y suma $0.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InputDecimal } from '@/components/ui/input-decimal';
import { formatCLP } from '@/lib/formatters';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { precioMlPorCod } from '@/modules/cotizador/motorFase0';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useReglasPrecios } from '@/modules/cotizador/reglasPreciosStore';
import type { OT } from '@/modules/ots/types';
import {
  MARGEN_SANO,
  LARGO_BARRA_M,
  calcularCostoOT,
  type CostoManualOT,
} from '@/modules/produccion/costoOT';
import {
  useConsumoAluminio,
  useCostosBodega,
  useGuardarCostosOT,
  useHojaCorte,
  useInsumosOT,
} from '@/modules/produccion/hooks';

const m2 = (n: number) => n.toFixed(2).replace('.', ',');

/** Un número grande con su rótulo, para la barra de arriba. */
function Indicador({
  label,
  valor,
  detalle,
  tono,
}: {
  label: string;
  valor: string;
  detalle?: string;
  tono?: string;
}) {
  return (
    <div className="min-w-[9rem] flex-1 rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', tono)}>{valor}</p>
      {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
    </div>
  );
}

/**
 * Los códigos de una tabla que quedaron sin costo, al pie y en gris.
 *
 * Antes esto era un cartel amarillo arriba de todo. Se sacó: la fila ya dice
 * «sin costo» en su propia línea, y un aviso permanente por tres tornillos que
 * no llegan al 1 % del costo es de los que se dejan de mirar. Acá queda el
 * dato, sin alarma, junto a lo que nombra.
 */
function PieSinCosto({ codigos, donde }: { codigos: string[]; donde: string }) {
  if (codigos.length === 0) return null;
  return (
    <p className="border-t p-2 text-[11px] text-muted-foreground">
      Sin costo (suman $0): <span className="font-mono">{codigos.slice(0, 8).join(', ')}</span>
      {codigos.length > 8 && ` y ${codigos.length - 8} más`}. {donde}
    </p>
  );
}

function FilaMonto({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCLP(valor)}</span>
    </div>
  );
}

/** Campo de plata que se escribe a mano. */
function CampoManual({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <InputDecimal value={valor} onChange={onChange} className="h-7 w-28 text-right text-xs" />
    </label>
  );
}

export default function VistaCosto({ ot, otCargada }: { ot: string; otCargada: OT | null }) {
  const { parametros } = useParametrosCotizador();
  const { reglas } = useReglasPrecios();
  // El catálogo trae el costo por metro de cada tela (columna Costo del Excel).
  const { catalogo } = useCatalogoProductos();
  const { hoja, loading: cargandoHoja } = useHojaCorte(otCargada);
  const { insumos, loading: cargandoInsumos } = useInsumosOT(otCargada);
  const { consumo, loading: cargandoAluminio } = useConsumoAluminio(ot);
  const { costos } = useCostosBodega(!!ot);
  const { guardar } = useGuardarCostosOT(ot);

  const [manual, setManual] = useState<CostoManualOT>({});
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Lo tecleado no se pisa con lo cargado: la OT se relee sola (al cerrar un
  // área, al volver a la pestaña) y eso borraría lo que se está escribiendo.
  // La llave es el ID de la OT, no el número tecleado: mientras la nueva OT
  // viaja, `otCargada` todavía es la anterior, y sembrar con esa dejaría los
  // costos de otra orden marcados como si fueran de esta.
  const otSembrada = useRef<string | null>(null);

  useEffect(() => {
    if (!otCargada || otSembrada.current === otCargada.id) return;
    otSembrada.current = otCargada.id;
    setManual(otCargada.datosGenerales?.costosOT ?? {});
    setSucio(false);
  }, [otCargada]);

  const editar = (cambio: Partial<CostoManualOT>) => {
    setManual((m) => ({ ...m, ...cambio }));
    setSucio(true);
  };

  const editarFalla = (cod: string, campo: 'fallas' | 'mts', valor: number) => {
    setManual((m) => {
      const filas = [...(m.fallasTelas || [])];
      const i = filas.findIndex((f) => f.cod === cod);
      if (i >= 0) filas[i] = { ...filas[i], [campo]: valor };
      else filas.push({ cod, [campo]: valor });
      return { ...m, fallasTelas: filas };
    });
    setSucio(true);
  };

  // Con qué tela se le fija el precio a un código. Es el MISMO motor que cotiza,
  // así que el costo hereda por donde hereda el precio.
  const telaReferencia = useMemo(
    () => (codInt: string) =>
      precioMlPorCod(catalogo[codInt]?.cod || codInt, catalogo, reglas).arquetipo,
    [catalogo, reglas],
  );

  const costo = useMemo(
    () =>
      calcularCostoOT({
        optimizador: hoja?.optimizador ?? [],
        catalogo,
        telaReferencia,
        aluminio: consumo,
        insumos,
        precioCalculo: reglas.insumos,
        bodega: costos,
        totalConIva: otCargada?.totalConIva ?? 0,
        iva: parametros.iva,
        colmena: otCargada?.datosGenerales?.corteGeneralColmena?.piezas,
        manual,
      }),
    [hoja, catalogo, telaReferencia, consumo, insumos, reglas, costos, otCargada, parametros, manual],
  );

  const guardarManual = async () => {
    setGuardando(true);
    try {
      await guardar(manual);
      setSucio(false);
      toast.success('Costos guardados en la OT.');
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para ver cuánto costó.
      </p>
    );
  }

  if (!otCargada) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        La OT {ot} no está en el sistema.
      </p>
    );
  }

  const cargando = cargandoHoja || cargandoInsumos || cargandoAluminio;
  const margenSano = costo.margen != null && costo.margen >= MARGEN_SANO;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Solo la ve un administrador. Los metros y los materiales son los que consumió esta OT de
          verdad; la mano de obra y las fallas se escriben a mano.
        </p>
        <Button size="sm" onClick={guardarManual} disabled={!sucio || guardando}>
          <Save className="mr-1.5 h-4 w-4" />
          {guardando ? 'Guardando…' : sucio ? 'Guardar' : 'Guardado ✓'}
        </Button>
      </div>

      {cargando && <p className="text-sm text-muted-foreground">Juntando lo que consumió la OT…</p>}

      {/* Información OT */}
      <div className="flex flex-wrap gap-2">
        <Indicador label="Cobrado (neto)" valor={formatCLP(costo.neto)} detalle="sin IVA" />
        <Indicador
          label="Costo de la OT"
          valor={formatCLP(costo.costoConFallas)}
          detalle={costo.perdidaFallas > 0 ? `incluye ${formatCLP(costo.perdidaFallas)} de fallas` : undefined}
        />
        <Indicador
          label="Ganancia real"
          valor={formatCLP(costo.gananciaReal)}
          detalle={costo.perdidaFallas > 0 ? `antes de fallas: ${formatCLP(costo.ganancia)}` : undefined}
          tono={costo.gananciaReal >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <Indicador
          label="Margen"
          valor={costo.margen == null ? '—' : `${(costo.margen * 100).toFixed(1).replace('.', ',')} %`}
          detalle={costo.margen == null ? 'la OT no tiene total cargado' : `sano desde ${MARGEN_SANO * 100} %`}
          tono={costo.margen == null ? '' : margenSano ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Telas */}
        <section className="rounded-lg border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b p-3">
            <strong className="text-sm">Telas</strong>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCLP(costo.totalTelas)}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Código</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mts</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Paños que salieron de un retazo">
                    Colmena
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium">Fallas</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mts falla</th>
                  <th className="px-2 py-1.5 text-right font-medium">Total</th>
                  <th className="px-2 py-1.5 text-right font-medium">$/m</th>
                  <th className="px-2 py-1.5 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody>
                {costo.telas.map((t) => (
                  <tr key={t.codInt} className="border-t">
                    <td className="px-2 py-1">
                      <span className="font-mono font-semibold">{t.codInt}</span>
                      <div className="text-[10px] text-muted-foreground">{t.producto}</div>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{m2(t.mts)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {t.panosColmena || '—'}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <InputDecimal
                        value={t.fallas}
                        onChange={(n) => editarFalla(t.codInt, 'fallas', n)}
                        className="h-7 w-16 text-right text-xs"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <InputDecimal
                        value={t.mtsFalla}
                        onChange={(n) => editarFalla(t.codInt, 'mts', n)}
                        className="h-7 w-16 text-right text-xs"
                      />
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{m2(t.total)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {t.costoM == null ? (
                        <span className="text-warning">sin costo</span>
                      ) : (
                        <>
                          {formatCLP(t.costoM)}
                          {t.refCosto && (
                            <div className="text-[10px] text-muted-foreground">
                              de <span className="font-mono">{t.refCosto}</span>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {formatCLP(t.costo)}
                      {t.perdida > 0 && (
                        <div className="text-[10px] text-red-400">−{formatCLP(t.perdida)} falla</div>
                      )}
                    </td>
                  </tr>
                ))}
                {costo.telas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                      Esta OT no tiene tela optimizada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {costo.telas.some((t) => t.panosColmena > 0) && (
            <p className="border-t p-2 text-[11px] text-muted-foreground">
              Los paños de «Colmena» salieron de retazos ya cortados: no bajaron del rollo, así que
              no están en los metros ni en el costo.
            </p>
          )}
          <PieSinCosto
            codigos={costo.telasSinCosto}
            donde="El COSTO por metro (que no es el precio de venta) se carga en Admin → Precios → Catálogo de productos, o subiendo el Excel maestro."
          />
        </section>

        {/* Costo de la OT */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b p-3">
            <strong className="text-sm">Costo de la OT</strong>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCLP(costo.costoConFallas)}
            </span>
          </header>
          <FilaMonto label="Telas" valor={costo.totalTelas} />
          <FilaMonto label="Aluminio" valor={costo.totalAluminio} />
          <FilaMonto label="Insumos" valor={costo.totalInsumos} />
          <CampoManual
            label="Mano de obra"
            valor={manual.manoObra ?? 0}
            onChange={(n) => editar({ manoObra: n })}
          />
          <CampoManual label="Auto" valor={manual.auto ?? 0} onChange={(n) => editar({ auto: n })} />
          <CampoManual label="TAG" valor={manual.tag ?? 0} onChange={(n) => editar({ tag: n })} />
          <CampoManual label="Otros" valor={manual.otros ?? 0} onChange={(n) => editar({ otros: n })} />
          {costo.perdidaFallas > 0 && (
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-xs">
              <span className="text-red-400">Pérdida por fallas</span>
              <span className="tabular-nums text-red-400">{formatCLP(costo.perdidaFallas)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCLP(costo.costoConFallas)}</span>
          </div>
          <label className="block border-t p-3">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Largo de la barra de aluminio
            </span>
            <InputDecimal
              value={manual.largoBarraM ?? LARGO_BARRA_M}
              onChange={(n) => editar({ largoBarraM: n })}
              className="h-7 w-24 text-right text-xs"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Metros. La bodega guarda lo que cuesta una barra entera; con esto se saca el metro.
            </p>
          </label>
          <label className="block border-t p-3">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Nota
            </span>
            <textarea
              value={manual.nota ?? ''}
              onChange={(e) => editar({ nota: e.target.value })}
              rows={2}
              placeholder="Se rehízo un paño por falla del rollo…"
              className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"
            />
          </label>
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Aluminio */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b p-3">
            <div>
              <strong className="text-sm">Aluminio cortado</strong>
              <p className="text-[11px] text-muted-foreground">Del historial de la colmena</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCLP(costo.totalAluminio)}
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Código</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mts</th>
                  <th className="px-2 py-1.5 text-right font-medium">Merma</th>
                  <th className="px-2 py-1.5 text-left font-medium">$/m</th>
                  <th className="px-2 py-1.5 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody>
                {costo.aluminio.map((a) => (
                  <tr key={a.cod} className="border-t">
                    <td className="px-2 py-1 font-mono">{a.cod}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{m2(a.metros)}</td>
                    <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">
                      {a.merma > 0 ? m2(a.merma) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-1 text-[11px]',
                        a.costoM == null ? 'text-warning' : 'text-muted-foreground',
                      )}
                    >
                      {a.detalleFuente}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatCLP(a.costo)}</td>
                  </tr>
                ))}
                {costo.aluminio.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                      No hay cortes de aluminio registrados para la OT {ot}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PieSinCosto
            codigos={costo.aluminioSinCosto}
            donde="El costo del perfil sale de la ficha del insumo en Inventario."
          />
        </section>

        {/* Insumos */}
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b p-3">
            <div>
              <strong className="text-sm">Insumos</strong>
              <p className="text-[11px] text-muted-foreground">Los de la hoja de inventario</p>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCLP(costo.totalInsumos)}
            </span>
          </header>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Insumo</th>
                  <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                  <th className="px-2 py-1.5 text-right font-medium">Unitario</th>
                  <th className="px-2 py-1.5 text-right font-medium">Costo</th>
                </tr>
              </thead>
              <tbody>
                {costo.insumos.map((i, n) => (
                  <tr key={`${i.codigo || i.descripcion}-${n}`} className="border-t">
                    <td className="px-2 py-1">
                      {i.codigo && <span className="font-mono font-semibold">[{i.codigo}] </span>}
                      {i.descripcion}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{i.cantidad}</td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {i.costoUnit == null ? (
                        <span className="text-warning">sin costo</span>
                      ) : (
                        <span title={i.fuente === 'bodega' ? 'Costo de bodega' : 'Valor del cálculo'}>
                          {formatCLP(i.costoUnit)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">{formatCLP(i.costo)}</td>
                  </tr>
                ))}
                {costo.insumos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                      Esta OT no tiene insumos calculados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PieSinCosto
            codigos={costo.insumosSinCosto}
            donde="El costo del insumo sale de su ficha en Inventario."
          />
        </section>
      </div>
    </div>
  );
}
