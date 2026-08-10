// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Cadenas (editable)
//
// La cadena de mando: qué cadena se elige sola según el ALTO de la cortina y el
// COLOR de los accesorios, más el catálogo de códigos CAD.
//
// El catálogo nace vacío a propósito: el largo y el color de cada código se
// vienen adivinando del texto del nemotécnico del insumo, y eso se conserva.
// Declarar una cadena acá es un OVERLAY que manda sobre esa adivinanza — por
// eso la tabla muestra en gris lo derivado y en negro lo declarado.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  LARGOS_CADENA,
  LARGO_DESCRIPCION,
  type CadenaCatalogo,
  type ReglaCadenaCategoria,
  type ReglasCadena,
  type TramoCadenaAlto,
} from '@/modules/descuentos/reglas-cadena';
import {
  textoCategoria,
  type EstadoCatalogo,
} from '@/modules/descuentos/reglas-mecanismo';
import { coloresParaUso, type ColorAccesorio } from '@/modules/descuentos/coloresAccesorio';
import { derivarLargoColor, esCadenaRoller, type CadenaInsumo } from '@/modules/cotizador/cadenas';

const ESTADOS: Array<{ valor: EstadoCatalogo; label: string }> = [
  { valor: 'activo', label: 'Se ofrece' },
  { valor: 'oculto', label: 'Oculta (solo OTs viejas)' },
];

const metros = (n: number) => String(n).replace('.', ',');

/** Fila de la tabla: lo que hay en bodega, lo declarado, o las dos cosas. */
type FilaCadena = {
  codigo: string;
  /** Nombre del insumo en bodega; vacío si la cadena solo está declarada. */
  nemotecnico: string;
  enInventario: boolean;
  agotada: boolean;
  declarada: CadenaCatalogo | null;
  /** Lo que la app usa hoy para esta cadena (declarado o derivado del texto). */
  largo: string;
  color: string;
};

/** Selector de largo de cadena (mismo control en toda la sección). */
function SelectorLargo({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (largo: string) => void;
}) {
  return (
    <select
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— sin largo —</option>
      {LARGOS_CADENA.map((l) => (
        <option key={l} value={l}>
          {LARGO_DESCRIPCION[l]}
        </option>
      ))}
    </select>
  );
}

/** Editor de una escalera por alto: la general y la propia de una categoría. */
function EditorEscalera({
  tramos,
  onChange,
}: {
  tramos: readonly TramoCadenaAlto[];
  onChange: (t: TramoCadenaAlto[]) => void;
}) {
  const set = (i: number, patch: Partial<TramoCadenaAlto>) =>
    onChange(tramos.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  return (
    <div className="space-y-1.5">
      {[...tramos]
        .map((t, i) => ({ t, i }))
        .sort((a, b) => b.t.altoMinM - a.t.altoMinM)
        .map(({ t, i }) => (
          <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
            <span className="text-muted-foreground">Desde</span>
            <Input
              className="h-8 w-20 text-xs"
              value={metros(t.altoMinM)}
              onChange={(e) => {
                const n = parseFloat(e.target.value.replace(',', '.'));
                if (Number.isFinite(n)) set(i, { altoMinM: n });
              }}
            />
            <span className="text-muted-foreground">m de alto →</span>
            <SelectorLargo valor={t.largo} onChange={(largo) => set(i, { largo })} />
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onChange(tramos.filter((_, k) => k !== i))}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange([...tramos, { altoMinM: 1, largo: '3mts' }])}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Agregar tramo
      </Button>
    </div>
  );
}

/** Por qué la app puede elegir cada código (columna informativa). */
function motivosPorFila(fila: FilaCadena, r: ReglasCadena): string[] {
  const out: string[] = [];
  if (r.verticalDefault === fila.codigo) out.push('vertical (por defecto)');
  for (const [color, cod] of Object.entries(r.verticalPorColor)) {
    if (cod === fila.codigo) out.push(`vertical ${color.toLowerCase()}`);
  }
  if (!fila.largo) {
    if (out.length === 0) out.push('sin largo: no se elige sola');
    return out;
  }
  for (const rc of r.reglasCategoria) {
    const nombre = rc.descripcion || textoCategoria(rc.categoria);
    if (rc.largo === fila.largo) out.push(nombre);
    const tramoCat = [...(rc.tramosAlto ?? [])]
      .sort((a, b) => b.altoMinM - a.altoMinM)
      .find((t) => t.largo === fila.largo);
    if (tramoCat) out.push(`${nombre}: alto ≥ ${metros(tramoCat.altoMinM)} m`);
  }
  const tramos = [...r.tramosAlto].sort((a, b) => b.altoMinM - a.altoMinM);
  for (const t of tramos) {
    if (t.largo === fila.largo) out.push(`alto ≥ ${metros(t.altoMinM)} m`);
  }
  if (out.length === 0) out.push('solo a mano');
  else if (fila.color) out.push(`accesorios ${fila.color}`);
  return out;
}

type Props = {
  valor: ReglasCadena;
  onChange: (r: ReglasCadena) => void;
  paleta: readonly ColorAccesorio[];
};

export function SeleccionCadenas({ valor, onChange, paleta }: Props) {
  const { empresaId } = useAuth();
  const confirmar = useConfirm();
  const [insumos, setInsumos] = useState<CadenaInsumo[]>([]);
  const [nueva, setNueva] = useState<CadenaCatalogo | null>(null);

  // El inventario real: sin él la tabla no puede mostrar qué existe en bodega.
  useEffect(() => {
    if (!empresaId) return;
    supabase
      .from('insumos')
      .select('cod,nemotecnico,color,status')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        if (data) setInsumos((data as CadenaInsumo[]).filter((i) => esCadenaRoller(i.cod, valor)));
      });
    // Se recarga si cambia el catálogo: una cadena declarada nueva puede no
    // calzar el patrón CAD y aparecer recién ahora.
  }, [empresaId, valor]);

  const filas = useMemo<FilaCadena[]>(() => {
    const porCodigo = new Map<string, FilaCadena>();
    for (const i of insumos) {
      const cod = (i.cod || '').trim().toUpperCase();
      if (!cod) continue;
      const d = derivarLargoColor(cod, insumos, valor);
      porCodigo.set(cod, {
        codigo: cod,
        nemotecnico: (i.nemotecnico || '').trim(),
        enInventario: true,
        agotada: (i.status || '').toUpperCase() === 'AGOTADO',
        declarada: null,
        largo: d.largoCadena,
        color: d.colorCadena,
      });
    }
    for (const c of valor.cadenas) {
      const previa = porCodigo.get(c.codigo);
      porCodigo.set(c.codigo, {
        codigo: c.codigo,
        nemotecnico: previa?.nemotecnico || c.descripcion || '',
        enInventario: !!previa?.enInventario,
        agotada: !!previa?.agotada,
        declarada: c,
        largo: c.largo,
        color: c.color,
      });
    }
    return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [insumos, valor]);

  /** Escribe (o crea) la declaración de un código. */
  const declarar = (fila: FilaCadena, patch: Partial<CadenaCatalogo>) => {
    const idx = valor.cadenas.findIndex((c) => c.codigo === fila.codigo);
    const base: CadenaCatalogo = fila.declarada ?? {
      codigo: fila.codigo,
      largo: fila.largo,
      color: fila.color,
      estado: 'activo',
    };
    const siguiente = { ...base, ...patch };
    const cadenas =
      idx >= 0
        ? valor.cadenas.map((c, k) => (k === idx ? siguiente : c))
        : [...valor.cadenas, siguiente];
    onChange({ ...valor, cadenas });
  };

  const quitarDeclaracion = async (cod: string) => {
    const ok = await confirmar({
      titulo: `Quitar «${cod}» del catálogo`,
      mensaje:
        'La app vuelve a deducir su largo y color del nombre del insumo. Si querés que deje de ofrecerse, usá Oculta en vez de quitarla.',
      confirmLabel: 'Quitar',
      destructivo: true,
    });
    if (!ok) return;
    onChange({ ...valor, cadenas: valor.cadenas.filter((c) => c.codigo !== cod) });
  };

  const agregar = () => {
    if (!nueva) return;
    const codigo = nueva.codigo.trim().toUpperCase();
    if (!codigo) return;
    onChange({ ...valor, cadenas: [...valor.cadenas, { ...nueva, codigo }] });
    setNueva(null);
  };

  const selLargo = (v: string, on: (l: string) => void) => (
    <SelectorLargo valor={v} onChange={on} />
  );

  const coloresAcc = useMemo(() => coloresParaUso('accesorio', paleta), [paleta]);
  const codigosCadena = useMemo(() => filas.map((f) => f.codigo), [filas]);

  const selCodigo = (v: string, on: (c: string) => void) => (
    <select
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={v}
      onChange={(e) => on(e.target.value)}
    >
      {!codigosCadena.includes(v) && <option value={v}>{v} (no existe)</option>}
      {codigosCadena.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  const setReglaCat = (i: number, patch: Partial<ReglaCadenaCategoria>) => {
    onChange({
      ...valor,
      reglasCategoria: valor.reglasCategoria.map((r, k) => (k === i ? { ...r, ...patch } : r)),
    });
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Link2 className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Cadenas</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setNueva({ codigo: '', largo: '4mts', color: 'BCO', estado: 'activo' })}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar cadena
        </Button>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        La cadena que sube y baja la cortina. Se elige sola por el <strong>alto</strong> y el{' '}
        <strong>color de los accesorios</strong>. Lo que ves en gris lo deduce la app del nombre del
        insumo; si lo corriges, queda fijo. <strong>Oculta</strong> deja de ofrecerla en Fase 2, pero
        las OTs que ya la tienen la siguen mostrando.
      </p>

      {/* ── Catálogo ──────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Código</th>
              <th className="px-2 py-1.5 text-left font-medium">Nombre en bodega</th>
              <th className="px-2 py-1.5 text-left font-medium">Largo</th>
              <th className="px-2 py-1.5 text-left font-medium">Color</th>
              <th className="px-2 py-1.5 text-left font-medium">Estado</th>
              <th className="px-2 py-1.5 text-left font-medium">Cuándo se usa</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  No hay cadenas en el inventario. Agregá una acá o cargalas en Inventario.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.codigo} className="border-t align-top">
                <td className="px-2 py-1.5 font-semibold">
                  {f.codigo}
                  {!f.enInventario && (
                    <div className="text-[10px] font-normal text-warning">no está en Inventario</div>
                  )}
                  {f.agotada && (
                    <div className="text-[10px] font-normal text-muted-foreground">agotada</div>
                  )}
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{f.nemotecnico || '—'}</td>
                <td className={`px-2 py-1.5 ${f.declarada ? '' : 'opacity-70'}`}>
                  {selLargo(f.largo, (largo) => declarar(f, { largo }))}
                </td>
                <td className={`px-2 py-1.5 ${f.declarada ? '' : 'opacity-70'}`}>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={f.color}
                    onChange={(e) => declarar(f, { color: e.target.value })}
                  >
                    <option value="">— sin color —</option>
                    {!coloresAcc.includes(f.color) && f.color && (
                      <option value={f.color}>{f.color}</option>
                    )}
                    {coloresAcc.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={f.declarada?.estado ?? 'activo'}
                    onChange={(e) => declarar(f, { estado: e.target.value as EstadoCatalogo })}
                  >
                    {ESTADOS.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {motivosPorFila(f, valor).join(' · ')}
                </td>
                <td className="px-2 py-1.5">
                  {f.declarada && (
                    <Button variant="ghost" size="sm" onClick={() => quitarDeclaracion(f.codigo)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nueva && (
        <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3">
          <div className="mb-2 text-xs font-medium">Cadena nueva</div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Input
              className="h-8 w-28 text-xs font-semibold"
              placeholder="CAD21"
              value={nueva.codigo}
              onChange={(e) => setNueva({ ...nueva, codigo: e.target.value.toUpperCase() })}
            />
            <Input
              className="h-8 min-w-[16rem] flex-1 text-xs"
              placeholder="Cómo se llama (si aún no está en Inventario)"
              value={nueva.descripcion ?? ''}
              onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })}
            />
            {selLargo(nueva.largo, (largo) => setNueva({ ...nueva, largo }))}
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={nueva.color}
              onChange={(e) => setNueva({ ...nueva, color: e.target.value })}
            >
              {coloresAcc.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={agregar} disabled={!nueva.codigo.trim()}>
              Agregar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNueva(null)}>
              Cancelar
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Esto la declara para el cálculo. Para que Fase 2 la ofrezca y la bodega la descuente, el
            código también tiene que existir como insumo en <strong>Inventario</strong>.
          </p>
        </div>
      )}

      {/* ── Escalera por alto ─────────────────────────────────────── */}
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold">Qué largo según el alto</h3>
        <EditorEscalera
          tramos={valor.tramosAlto}
          onChange={(tramosAlto) => onChange({ ...valor, tramosAlto })}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Gana el tramo más alto que la cortina alcance. Bajo el tramo más chico no se elige ninguna:
          la pone el vendedor.
        </p>
      </div>

      {/* ── Reglas por categoría ──────────────────────────────────── */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-xs font-semibold">Reglas por tipo de cortina</h3>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() =>
              onChange({
                ...valor,
                reglasCategoria: [
                  ...valor.reglasCategoria,
                  { descripcion: '', categoria: '', largo: '3mts' },
                ],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Agregar regla
          </Button>
        </div>
        <div className="space-y-1.5">
          {valor.reglasCategoria.map((r, i) => {
            const modo =
              typeof r.categoria === 'string'
                ? 'exacta'
                : 'empiezaCon' in r.categoria
                  ? 'empiezaCon'
                  : 'includes';
            const txt = textoCategoria(r.categoria);
            const conEscalera = !!r.tramosAlto?.length;
            return (
              <div key={i} className="rounded-md border p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 min-w-[14rem] flex-1 text-xs"
                  placeholder="Para qué sirve esta regla"
                  value={r.descripcion}
                  onChange={(e) => setReglaCat(i, { descripcion: e.target.value })}
                />
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={modo}
                  onChange={(e) => {
                    const m = e.target.value;
                    setReglaCat(i, {
                      categoria:
                        m === 'exacta' ? txt : m === 'includes' ? { includes: txt } : { empiezaCon: txt },
                    });
                  }}
                >
                  <option value="exacta">Categoría exacta</option>
                  <option value="includes">Contiene</option>
                  <option value="empiezaCon">Empieza con</option>
                </select>
                <Input
                  className="h-8 w-40 text-xs"
                  placeholder="DUO"
                  value={txt}
                  onChange={(e) => {
                    const v2 = e.target.value.toUpperCase();
                    setReglaCat(i, {
                      categoria:
                        modo === 'exacta'
                          ? v2
                          : modo === 'includes'
                            ? { includes: v2 }
                            : { empiezaCon: v2 },
                    });
                  }}
                />
                <span className="text-muted-foreground">→</span>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={conEscalera ? 'escalera' : 'fijo'}
                  onChange={(e) =>
                    setReglaCat(
                      i,
                      e.target.value === 'escalera'
                        ? { largo: undefined, tramosAlto: [...valor.tramosAlto] }
                        : { largo: r.largo || '3mts', tramosAlto: undefined },
                    )
                  }
                >
                  <option value="fijo">Siempre el mismo largo</option>
                  <option value="escalera">Escalera propia por alto</option>
                </select>
                {!conEscalera && (
                  <SelectorLargo
                    valor={r.largo ?? ''}
                    onChange={(largo) => setReglaCat(i, { largo })}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    onChange({
                      ...valor,
                      reglasCategoria: valor.reglasCategoria.filter((_, k) => k !== i),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                </div>
                {conEscalera && (
                  <div className="mt-2 border-l-2 pl-3">
                    <EditorEscalera
                      tramos={r.tramosAlto ?? []}
                      onChange={(tramosAlto) => setReglaCat(i, { tramosAlto })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {valor.reglasCategoria.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Sin reglas: todas las cortinas usan la escalera por alto.
            </p>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Una regla con escalera propia <strong>reemplaza</strong> a la general para ese tipo de
          cortina: si la cortina no alcanza ningún tramo suyo, la cadena la pone el vendedor.
        </p>
      </div>

      {/* ── Vertical ──────────────────────────────────────────────── */}
      <div className="mt-5">
        <h3 className="mb-2 text-xs font-semibold">Cortina vertical</h3>
        <div className="rounded-md border p-2 text-xs">
          <p className="mb-2 text-[11px] text-muted-foreground">
            La vertical lleva siempre el mismo largo: el alto no la cambia, solo el color.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Largo</span>
            {selLargo(valor.verticalLargo, (verticalLargo) => onChange({ ...valor, verticalLargo }))}
            <span className="ml-3 text-muted-foreground">Por defecto</span>
            {selCodigo(valor.verticalDefault, (verticalDefault) =>
              onChange({ ...valor, verticalDefault }),
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {coloresAcc.map((c) => {
              const actual = valor.verticalPorColor[c] ?? valor.verticalDefault;
              return (
                <label key={c} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{c}</span>
                  {selCodigo(actual, (cod) => {
                    const mapa = { ...valor.verticalPorColor };
                    if (cod === valor.verticalDefault) delete mapa[c];
                    else mapa[c] = cod;
                    onChange({ ...valor, verticalPorColor: mapa });
                  })}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
