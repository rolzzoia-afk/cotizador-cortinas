// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Categoría B (editable)
//
// La categoría B es la MISMA cortina fabricada con otro juego de herrajes. Sus
// reglas estaban repartidas entre el bloque de mecanismos, el de tuberías y los
// códigos por color, y ninguna se podía ver desde Admin: esta sección las junta.
//
// Edita tres tajadas del mismo borrador (`mecanismo`, `tuberia`, `colores`), así
// que el guardado, el respaldo y la validación son los de siempre.
// ─────────────────────────────────────────────────────────────────────
import { Layers, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  numeroMecDeChip,
  textoCategoria,
  type MatchCategoria,
  type ReglaMecLineaB,
  type ReglasMecanismo,
} from '@/modules/descuentos/reglas-mecanismo';
import type { ReglasTuberia } from '@/modules/descuentos/reglas-tuberia';
import {
  coloresParaUso,
  nombreDeColor,
  type ColorAccesorio,
  type InsumosColor,
} from '@/modules/descuentos/coloresAccesorio';
import {
  CAMPOS_ESTRUCTURA_B,
  codigoEstructuraBEfectivo,
} from '@/modules/descuentos/codigos-estructura';

/** Escribe la clave corta Y la larga, igual que los mapas de la línea A. */
function setColor(
  mapa: Record<string, number>,
  color: string,
  mec: number | null,
  largo: string,
): Record<string, number> {
  const out = { ...mapa };
  if (mec == null) {
    delete out[color];
    if (largo) delete out[largo];
  } else {
    out[color] = mec;
    if (largo) out[largo] = mec;
  }
  return out;
}

/** Lo mismo, para la lista de kits alternativos. */
function setKitsManuales(
  mapa: Record<string, readonly number[]> | undefined,
  color: string,
  kits: number[],
  largo: string,
): Record<string, readonly number[]> {
  const out = { ...(mapa ?? {}) };
  if (kits.length === 0) {
    delete out[color];
    if (largo) delete out[largo];
  } else {
    out[color] = kits;
    if (largo) out[largo] = kits;
  }
  return out;
}

type Props = {
  mecanismo: ReglasMecanismo;
  tuberia: ReglasTuberia;
  colores: readonly ColorAccesorio[];
  onChange: (patch: {
    mecanismo?: ReglasMecanismo;
    tuberia?: ReglasTuberia;
    colores?: readonly ColorAccesorio[];
  }) => void;
};

export function SeleccionCategoriaB({ mecanismo, tuberia, colores, onChange }: Props) {
  const COLORES = coloresParaUso('accesorio', colores);
  const largoDe = (c: string) => nombreDeColor(c, colores);
  const lineaB = mecanismo.lineaB;

  const numerosDisponibles = mecanismo.mecanismos
    .map((m) => numeroMecDeChip(m.chip))
    .filter((n): n is number => n != null);

  const setLineaB = (patch: Partial<typeof lineaB>) =>
    onChange({ mecanismo: { ...mecanismo, lineaB: { ...lineaB, ...patch } } });

  const setRegla = (i: number, patch: Partial<ReglaMecLineaB>) =>
    setLineaB({ reglas: lineaB.reglas.map((r, k) => (k === i ? { ...r, ...patch } : r)) });

  const moverRegla = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= lineaB.reglas.length) return;
    const out = [...lineaB.reglas];
    [out[i], out[j]] = [out[j], out[i]];
    setLineaB({ reglas: out });
  };

  const setBanda = (patch: Partial<ReglasTuberia['reglaLineaB']>) =>
    onChange({ tuberia: { ...tuberia, reglaLineaB: { ...tuberia.reglaLineaB, ...patch } } });

  /** Setea (o borra, con texto vacío) un código de estructura B de un color. */
  const setCodigoColor = (codigo: string, campo: keyof InsumosColor, texto: string) => {
    onChange({
      colores: colores.map((c) => {
        if (c.codigo !== codigo) return c;
        const insumos: InsumosColor = { ...(c.insumos ?? {}) };
        const v = texto.trim().toUpperCase();
        if (v) insumos[campo] = v as never;
        else delete insumos[campo];
        return { ...c, insumos };
      }),
    });
  };

  const selMec = (v: number | null, on: (n: number | null) => void, permiteVacio = true) => (
    <select
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={v == null ? '' : String(v)}
      onChange={(e) => on(e.target.value === '' ? null : parseInt(e.target.value, 10))}
    >
      {permiteVacio && <option value="">— sin kit —</option>}
      {v != null && !numerosDisponibles.includes(v) && (
        <option value={String(v)}>MEC {v} (no existe)</option>
      )}
      {mecanismo.mecanismos.map((m) => {
        const n = numeroMecDeChip(m.chip);
        return n == null ? null : (
          <option key={m.chip} value={String(n)}>
            MEC {n} · {m.chip.replace(/\s*\[MEC \d+\]\s*/, '')}
          </option>
        );
      })}
    </select>
  );

  const selTubo = (v: string, on: (cod: string) => void) => (
    <select
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={v}
      onChange={(e) => on(e.target.value)}
    >
      {!tuberia.tubos.some((t) => t.codigo === v) && <option value={v}>{v} (no existe)</option>}
      {tuberia.tubos.map((t) => (
        <option key={t.codigo} value={t.codigo}>
          {t.codigo}
        </option>
      ))}
    </select>
  );

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Layers className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Categoría B (gama económica)
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        La misma cortina fabricada con otro juego de herrajes. Una cortina entra en categoría B
        cuando su tela es de gama B (o cuando se marca a mano en el paño), pero{' '}
        <strong>solo en las categorías listadas acá abajo</strong>: en el resto, la gama de la tela
        no cambia nada. Un color <strong>sin receta no cae a los kits de la línea A</strong>: se
        queda sin kit y Fase 2 bloquea la OT hasta corregirlo.
      </p>

      {/* ── Kits por categoría y color ───────────────────────────── */}
      <h3 className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
        Qué kit lleva cada categoría
      </h3>
      <div className="space-y-3">
        {lineaB.reglas.map((r, i) => (
          <div key={i} className="rounded-md border p-3 text-xs">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Input
                className="h-8 min-w-[16rem] flex-1 text-xs"
                placeholder="Para qué sirve esta regla"
                value={r.descripcion}
                onChange={(e) => setRegla(i, { descripcion: e.target.value })}
              />
              <MatchCategoriaEditor
                valor={r.categoria}
                onChange={(categoria) => setRegla(i, { categoria })}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={i === 0}
                onClick={() => moverRegla(i, -1)}
                title="Subir (gana la primera que calza)"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={i === lineaB.reglas.length - 1}
                onClick={() => moverRegla(i, 1)}
                title="Bajar"
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLineaB({ reglas: lineaB.reglas.filter((_, k) => k !== i) })}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {COLORES.map((c) => {
                const manuales = [...(r.kitsManualesPorColor?.[c] ?? [])];
                return (
                  <div key={c} className="flex flex-wrap items-center gap-2">
                    <span className="w-10 text-muted-foreground">{c}</span>
                    {selMec(r.mecPorColor[c] ?? null, (n) =>
                      setRegla(i, {
                        mecPorColor: setColor(r.mecPorColor, c, n, largoDe(c)),
                      }),
                    )}
                    {manuales.map((n, k) => (
                      <span key={`${n}-${k}`} className="flex items-center gap-1">
                        <span className="text-muted-foreground">o</span>
                        {selMec(
                          n,
                          (nuevo) =>
                            setRegla(i, {
                              kitsManualesPorColor: setKitsManuales(
                                r.kitsManualesPorColor,
                                c,
                                nuevo == null
                                  ? manuales.filter((_, j) => j !== k)
                                  : manuales.map((x, j) => (j === k ? nuevo : x)),
                                largoDe(c),
                              ),
                            }),
                          true,
                        )}
                      </span>
                    ))}
                    {r.mecPorColor[c] != null && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-[11px]"
                        title="Agregar un kit alternativo que el operario pueda elegir a mano"
                        onClick={() =>
                          setRegla(i, {
                            kitsManualesPorColor: setKitsManuales(
                              r.kitsManualesPorColor,
                              c,
                              [...manuales, r.mecPorColor[c]],
                              largoDe(c),
                            ),
                          })
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              El primer kit es el que se pone solo; los demás quedan a mano en el selector de Fase 2.
            </p>
          </div>
        ))}
        {lineaB.reglas.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-[11px] text-muted-foreground">
            Sin reglas, ninguna cortina entra en categoría B: la gama de la tela solo pinta el
            distintivo de la grilla.
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setLineaB({
              reglas: [...lineaB.reglas, { descripcion: '', categoria: '', mecPorColor: {} }],
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar categoría
        </Button>
      </div>

      {/* ── Banda de tubo + códigos de bodega ────────────────────── */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Qué tubo entra según el ancho</div>
          <div className="flex flex-wrap items-center gap-2">
            hasta
            <Input
              className="h-8 w-20 text-xs"
              value={String(tuberia.reglaLineaB.anchoMaxM).replace('.', ',')}
              onChange={(e) => {
                const n = parseFloat(e.target.value.replace(',', '.'));
                if (Number.isFinite(n)) setBanda({ anchoMaxM: n });
              }}
            />
            m →{selTubo(tuberia.reglaLineaB.codigoHasta, (c) => setBanda({ codigoHasta: c }))}
            · sobre ese ancho →
            {selTubo(tuberia.reglaLineaB.codigoDesde, (c) => setBanda({ codigoDesde: c }))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">pero solo donde la categoría</span>
            <MatchCategoriaEditor
              valor={tuberia.reglaLineaB.categoriaDesde}
              onChange={(categoriaDesde) => setBanda({ categoriaDesde })}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            El tubo ancho existe solo en esa categoría. En las demás, la categoría B usa el tubo
            angosto en todo su rango y lo que la corta es el ancho máximo de su fila del catálogo.
            La categoría B no participa de ninguna otra regla por ancho.
          </p>
        </div>

        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Código de bodega de los kits</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Solo para los kits cuyo código no es MEC&lt;nn&gt;. Con esto la línea del inventario
            calza con la tabla de insumos.
          </p>
          <div className="space-y-1">
            {Object.entries(lineaB.codigoInsumoPorMec).map(([num, cod]) => (
              <div key={num} className="flex items-center gap-2">
                <span className="w-16 text-muted-foreground">MEC {num}</span>
                <Input
                  className="h-8 w-32 text-xs"
                  placeholder="MEC44-B"
                  value={cod}
                  onChange={(e) =>
                    setLineaB({
                      codigoInsumoPorMec: {
                        ...lineaB.codigoInsumoPorMec,
                        [Number(num)]: e.target.value.toUpperCase(),
                      },
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const out = { ...lineaB.codigoInsumoPorMec };
                    delete out[Number(num)];
                    setLineaB({ codigoInsumoPorMec: out });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <NuevoCodigoInsumo
              onAgregar={(num, cod) =>
                setLineaB({ codigoInsumoPorMec: { ...lineaB.codigoInsumoPorMec, [num]: cod } })
              }
            />
          </div>
        </div>
      </div>

      {/* ── Códigos de estructura por color ──────────────────────── */}
      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
        Con qué se fabrica cada color
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Las piezas cuyo código cambia respecto de la línea A. Vacío significa que se usa el código
        de fábrica que se ve de fondo; sin código de fábrica, la pieza sale con su color y sin
        código de bodega.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Color</th>
              {CAMPOS_ESTRUCTURA_B.map((c) => (
                <th key={String(c.campo)} className="px-2 py-1.5 text-left font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COLORES.map((cod) => {
              const color = colores.find((c) => c.codigo === cod);
              return (
                <tr key={cod} className="border-t">
                  <td className="px-2 py-1.5 font-semibold">{cod}</td>
                  {CAMPOS_ESTRUCTURA_B.map((campo) => (
                    <td key={String(campo.campo)} className="px-2 py-1.5">
                      <Input
                        className="h-8 w-28 text-xs"
                        placeholder={campo.fabrica[largoDe(cod).toUpperCase()] || '—'}
                        value={String(color?.insumos?.[campo.campo] ?? '')}
                        onChange={(e) => setCodigoColor(cod, campo.campo, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Colores con kit de categoría B:{' '}
        {(() => {
          const conKit = COLORES.filter((c) =>
            lineaB.reglas.some((r) => r.mecPorColor[c] != null),
          );
          if (conKit.length === 0) return 'ninguno.';
          return conKit
            .map((c) => {
              const piezas = CAMPOS_ESTRUCTURA_B.filter(
                (campo) => codigoEstructuraBEfectivo(campo.campo, largoDe(c), colores) !== '',
              ).length;
              return `${c} (${piezas} de ${CAMPOS_ESTRUCTURA_B.length} piezas con código)`;
            })
            .join(' · ');
        })()}
      </p>
    </section>
  );
}

/** Selector de categoría con sus tres modos: exacta, contiene y empieza con. */
function MatchCategoriaEditor({
  valor,
  onChange,
}: {
  valor: MatchCategoria;
  onChange: (m: MatchCategoria) => void;
}) {
  const texto = textoCategoria(valor);
  const modo =
    typeof valor === 'string' ? 'exacta' : 'empiezaCon' in valor ? 'empiezaCon' : 'contiene';
  const armar = (m: string, t: string): MatchCategoria =>
    m === 'contiene' ? { includes: t } : m === 'empiezaCon' ? { empiezaCon: t } : t;
  return (
    <>
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={modo}
        onChange={(e) => onChange(armar(e.target.value, texto))}
      >
        <option value="exacta">Categoría exacta</option>
        <option value="contiene">Contiene</option>
        <option value="empiezaCon">Empieza con</option>
      </select>
      <Input
        className="h-8 w-52 text-xs"
        placeholder="ROL"
        value={texto}
        onChange={(e) => onChange(armar(modo, e.target.value))}
      />
    </>
  );
}

function NuevoCodigoInsumo({ onAgregar }: { onAgregar: (num: number, cod: string) => void }) {
  return (
    <form
      className="flex items-center gap-2 pt-1"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const num = parseInt((form.elements.namedItem('mec') as HTMLInputElement).value, 10);
        const cod = (form.elements.namedItem('cod') as HTMLInputElement).value.trim().toUpperCase();
        if (!Number.isFinite(num) || !cod) return;
        onAgregar(num, cod);
        form.reset();
      }}
    >
      <Input name="mec" className="h-8 w-16 text-xs" placeholder="MEC n" />
      <Input name="cod" className="h-8 w-32 text-xs" placeholder="MEC44-B" />
      <Button type="submit" variant="ghost" size="sm">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </form>
  );
}
