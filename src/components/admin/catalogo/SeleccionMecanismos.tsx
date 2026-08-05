// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Mecanismos (editable)
//
// El catálogo de kits con su estado, el mapa color → kit y las reglas que
// deciden cuál entra por ancho o por categoría.
// ─────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Plus, Settings2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import {
  MECANISMOS_DUAL,
  numeroMecDeChip,
  type EstadoCatalogo,
  type MecanismoCatalogo,
  type ReglaMecAncho,
  type ReglaMecCategoria,
  type ReglasMecanismo,
} from '@/modules/descuentos/reglas-mecanismo';
import {
  coloresParaUso,
  nombreDeColor,
  type ColorAccesorio,
} from '@/modules/descuentos/coloresAccesorio';

const ESTADOS: Array<{ valor: EstadoCatalogo; label: string }> = [
  { valor: 'activo', label: 'Se ofrece' },
  { valor: 'oculto', label: 'Oculto (solo OTs viejas)' },
  { valor: 'opt_in', label: 'Solo con E78 activado' },
];



function textoCategoria(categoria: string | { includes: string }): string {
  return typeof categoria === 'string' ? categoria : categoria.includes;
}

/** Escribe la clave corta Y la larga: el motor normaliza a cualquiera de las dos. */
function setColor(
  mapa: Record<string, number>,
  color: string,
  mec: number | null,
  largo: string,
) {
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

type Props = {
  valor: ReglasMecanismo;
  onChange: (m: ReglasMecanismo) => void;
  /** Catálogo de colores: de acá salen las columnas de los mapas por color. */
  paleta: readonly ColorAccesorio[];
};

export function SeleccionMecanismos({ valor, onChange, paleta }: Props) {
  // Los mapas por color se editan para los colores que se usan en accesorios.
  const COLORES = coloresParaUso('accesorio', paleta);
  const largoDe = (c: string) => nombreDeColor(c, paleta);
  const confirmar = useConfirm();
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoMec, setNuevoMec] = useState('');
  const [nuevoKit, setNuevoKit] = useState(true);

  const numerosDisponibles = valor.mecanismos
    .map((m) => numeroMecDeChip(m.chip))
    .filter((n): n is number => n != null);

  const setMec = (i: number, patch: Partial<MecanismoCatalogo>) =>
    onChange({
      ...valor,
      mecanismos: valor.mecanismos.map((m, k) => (k === i ? { ...m, ...patch } : m)),
    });

  const borrarMec = async (i: number) => {
    const m = valor.mecanismos[i];
    const ok = await confirmar({
      titulo: `¿Quitar «${m.chip}»?`,
      mensaje:
        'Las OTs guardadas con este kit dejarán de mostrarlo. Si solo quieres que no se ofrezca más, ponlo en «Oculto» en vez de borrarlo.',
      destructivo: true,
      confirmLabel: 'Quitar del catálogo',
    });
    if (!ok) return;
    onChange({ ...valor, mecanismos: valor.mecanismos.filter((_, k) => k !== i) });
  };

  const agregarMec = () => {
    const n = parseInt(nuevoMec, 10);
    if (!nuevoNombre.trim() || !Number.isFinite(n)) return;
    const chip = `${nuevoNombre.trim().toUpperCase()} [MEC ${n}]`;
    onChange({
      ...valor,
      mecanismos: [...valor.mecanismos, { chip, estado: 'activo' }],
      kitsInventario:
        nuevoKit && !valor.kitsInventario.includes(n)
          ? [...valor.kitsInventario, n]
          : valor.kitsInventario,
    });
    setNuevoNombre('');
    setNuevoMec('');
  };

  const selMec = (v: number | null, on: (n: number | null) => void, permiteVacio = false) => (
    <select
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={v == null ? '' : String(v)}
      onChange={(e) => on(e.target.value === '' ? null : parseInt(e.target.value, 10))}
    >
      {permiteVacio && <option value="">— sin kit —</option>}
      {v != null && !numerosDisponibles.includes(v) && (
        <option value={String(v)}>MEC {v} (no existe)</option>
      )}
      {valor.mecanismos.map((m) => {
        const n = numeroMecDeChip(m.chip);
        return n == null ? null : (
          <option key={m.chip} value={String(n)}>
            MEC {n} · {m.chip.replace(/\s*\[MEC \d+\]\s*/, '')}
          </option>
        );
      })}
    </select>
  );

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Mecanismos</h2>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Los kits que la app conoce. El texto es el que se guarda en la OT y se imprime, así que
        cambiarlo en un kit ya usado no reescribe las OTs viejas (siguen con el texto anterior, que
        se resuelve igual por su número). El orden es el del selector de Fase 2.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Chip (lo que se ve y se guarda)</th>
              <th className="px-2 py-1.5 text-left font-medium">MEC</th>
              <th className="px-2 py-1.5 text-left font-medium">Estado</th>
              <th className="px-2 py-1.5 text-left font-medium">Notas</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {valor.mecanismos.map((m, i) => {
              const n = numeroMecDeChip(m.chip);
              return (
                <tr key={`${m.chip}-${i}`} className="border-t">
                  <td className="px-2 py-1.5">
                    <Input
                      className="h-8 min-w-[16rem] text-xs"
                      value={m.chip}
                      onChange={(e) => setMec(i, { chip: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-semibold">{n ?? '—'}</td>
                  <td className="px-2 py-1.5">
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      value={m.estado}
                      onChange={(e) => setMec(i, { estado: e.target.value as EstadoCatalogo })}
                    >
                      {ESTADOS.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    {n != null && valor.kitsInventario.includes(n) && (
                      <span className="mr-1 rounded bg-success/15 px-1">kit de bodega</span>
                    )}
                    {n != null && valor.legacyReemplazar.includes(n) && (
                      <span className="rounded bg-muted px-1">se reemplaza al guardar</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Button variant="ghost" size="sm" onClick={() => borrarMec(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {MECANISMOS_DUAL.map((chip) => (
              <tr key={chip} className="border-t bg-muted/20 text-muted-foreground">
                <td className="px-2 py-1.5">{chip}</td>
                <td className="px-2 py-1.5">{numeroMecDeChip(chip)}</td>
                <td className="px-2 py-1.5" colSpan={3}>
                  Dual: el kit sale del lado y el color, no de esta tabla.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Nombre del kit nuevo</span>
          <Input
            className="h-8 min-w-[16rem] text-xs"
            placeholder="KIT REFORZADO GRIS 38MM"
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">N° MEC</span>
          <Input
            className="h-8 w-20 text-xs"
            placeholder="42"
            value={nuevoMec}
            onChange={(e) => setNuevoMec(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs">
          <input type="checkbox" checked={nuevoKit} onChange={(e) => setNuevoKit(e.target.checked)} />
          Es kit de bodega
        </label>
        <Button size="sm" onClick={agregarMec} disabled={!nuevoNombre.trim() || !nuevoMec}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar mecanismo
        </Button>
      </div>

      {/* ── Color → kit ──────────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Kit por color de accesorios</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            El default de los rollers cuando ninguna regla manda.
          </p>
          <div className="space-y-1">
            {COLORES.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-10 text-muted-foreground">{c}</span>
                {selMec(valor.colorAMec[c] ?? null, (n) =>
                  onChange({ ...valor, colorAMec: setColor(valor.colorAMec, c, n, largoDe(c)) }),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Kit reforzado por color</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            El equivalente reforzado de cada color. Al cambiar el color de accesorios de una
            cortina, un kit reforzado pasa al reforzado del color nuevo (no baja al simple). Un
            color sin kit reforzado conserva el que ya tenía.
          </p>
          <div className="space-y-1">
            {COLORES.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-10 text-muted-foreground">{c}</span>
                {selMec(
                  valor.colorAMecReforzado[c] ?? null,
                  (n) =>
                    onChange({
                      ...valor,
                      colorAMecReforzado: setColor(valor.colorAMecReforzado, c, n, largoDe(c)),
                    }),
                  true,
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Kit de cenefa ovalada por color</div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            El de bodega que llevan todas las ovaladas (38 y 45 mm) y del que salen las tapas de la
            armadura E78.
          </p>
          <div className="space-y-1">
            {COLORES.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-10 text-muted-foreground">{c}</span>
                {selMec(
                  valor.kitOvaladaPorColor[c] ?? null,
                  (n) =>
                    onChange({
                      ...valor,
                      kitOvaladaPorColor: setColor(valor.kitOvaladaPorColor, c, n, largoDe(c)),
                    }),
                  true,
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reglas por ancho ─────────────────────────────────────── */}
      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
        Reglas por ancho (mandan sobre todo lo demás)
      </h3>
      <div className="space-y-2">
        {valor.reglasAncho.map((r, i) => (
          <ReglaAnchoFila
            key={i}
            regla={r}
            indice={i}
            total={valor.reglasAncho.length}
            selMec={selMec}
            COLORES={COLORES}
            largoDe={largoDe}
            onChange={(nueva) =>
              onChange({
                ...valor,
                reglasAncho: valor.reglasAncho.map((x, k) => (k === i ? nueva : x)),
              })
            }
            onMover={(delta) => {
              const l = [...valor.reglasAncho];
              const j = i + delta;
              if (j < 0 || j >= l.length) return;
              [l[i], l[j]] = [l[j], l[i]];
              onChange({ ...valor, reglasAncho: l });
            }}
            onBorrar={() =>
              onChange({ ...valor, reglasAncho: valor.reglasAncho.filter((_, k) => k !== i) })
            }
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...valor,
              reglasAncho: [
                ...valor.reglasAncho,
                {
                  descripcion: '',
                  categoria: 'ROL',
                  anchoMinM: 3,
                  mec: numerosDisponibles[0] ?? 32,
                  tubo: '',
                  nota: '',
                },
              ],
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar regla por ancho
        </Button>
      </div>

      {/* ── Banda de oscuridad ───────────────────────────────────── */}
      <div className="mt-4 rounded-md border p-3 text-xs">
        <div className="mb-1 font-medium">Banda del tubo E78 en oscuridad de 38 mm</div>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Soft light y DARK de 38 mm no llevan kit de mecanismo: dentro de esta banda (y con el tubo
          E78 activado en la OT) lo que cambia es el <strong>modelo</strong>, que pasa a 45 mm.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          desde
          <Input
            className="h-8 w-20 text-xs"
            value={String(valor.bandaOscuridadE78.anchoMinM).replace('.', ',')}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(',', '.'));
              if (Number.isFinite(n)) {
                onChange({
                  ...valor,
                  bandaOscuridadE78: { ...valor.bandaOscuridadE78, anchoMinM: n },
                });
              }
            }}
          />
          m (exclusivo) hasta
          <Input
            className="h-8 w-20 text-xs"
            value={String(valor.bandaOscuridadE78.anchoMaxM).replace('.', ',')}
            onChange={(e) => {
              const n = parseFloat(e.target.value.replace(',', '.'));
              if (Number.isFinite(n)) {
                onChange({
                  ...valor,
                  bandaOscuridadE78: { ...valor.bandaOscuridadE78, anchoMaxM: n },
                });
              }
            }}
          />
          m (inclusive)
        </div>
      </div>

      {/* ── Reglas por categoría ─────────────────────────────────── */}
      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
        Reglas por categoría
      </h3>
      <div className="space-y-2">
        {valor.reglasCategoria.map((r, i) => (
          <ReglaCategoriaFila
            key={i}
            regla={r}
            selMec={selMec}
            COLORES={COLORES}
            largoDe={largoDe}
            onChange={(nueva) =>
              onChange({
                ...valor,
                reglasCategoria: valor.reglasCategoria.map((x, k) => (k === i ? nueva : x)),
              })
            }
            onBorrar={() =>
              onChange({
                ...valor,
                reglasCategoria: valor.reglasCategoria.filter((_, k) => k !== i),
              })
            }
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...valor,
              reglasCategoria: [
                ...valor.reglasCategoria,
                { descripcion: '', categoria: '', mec: numerosDisponibles[0] ?? 32 },
              ],
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar regla de categoría
        </Button>
      </div>

      <div className="mt-4 rounded-md border p-3 text-xs">
        <div className="mb-1 font-medium">Categorías sin mecanismo roller</div>
        <div className="text-muted-foreground">
          {valor.categoriasSinMecanismo.join(' · ')} — su estructura no es de tubo, así que ni se
          ofrece el selector ni sale kit en el inventario.
        </div>
      </div>
    </section>
  );
}

function ReglaAnchoFila({
  regla,
  indice,
  total,
  onChange,
  onBorrar,
  onMover,
  selMec,
  COLORES,
  largoDe,
}: {
  regla: ReglaMecAncho;
  indice: number;
  total: number;
  onChange: (r: ReglaMecAncho) => void;
  onBorrar: () => void;
  onMover: (delta: number) => void;
  selMec: (v: number | null, on: (n: number | null) => void, permiteVacio?: boolean) => JSX.Element;
  COLORES: readonly string[];
  largoDe: (c: string) => string;
}) {
  const porColor = regla.mecPorColor != null;
  return (
    <div className="rounded-md border p-2 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">{indice + 1}.</span>
        <Input
          className="h-8 min-w-[18rem] flex-1 text-xs"
          placeholder="Para qué sirve esta regla"
          value={regla.descripcion}
          onChange={(e) => onChange({ ...regla, descripcion: e.target.value })}
        />
        <Button variant="ghost" size="sm" disabled={indice === 0} onClick={() => onMover(-1)}>
          ↑
        </Button>
        <Button variant="ghost" size="sm" disabled={indice === total - 1} onClick={() => onMover(1)}>
          ↓
        </Button>
        <Button variant="ghost" size="sm" onClick={onBorrar}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-8 w-52 text-xs"
          placeholder="Categoría exacta"
          value={regla.categoria}
          onChange={(e) => onChange({ ...regla, categoria: e.target.value })}
        />
        <span className="text-muted-foreground">desde</span>
        <Input
          className="h-8 w-20 text-xs"
          value={String(regla.anchoMinM).replace('.', ',')}
          onChange={(e) => {
            const n = parseFloat(e.target.value.replace(',', '.'));
            if (Number.isFinite(n)) onChange({ ...regla, anchoMinM: n });
          }}
        />
        <span className="text-muted-foreground">m hasta</span>
        <Input
          className="h-8 w-20 text-xs"
          placeholder="sin tope"
          value={regla.anchoMaxM == null ? '' : String(regla.anchoMaxM).replace('.', ',')}
          onChange={(e) => {
            const txt = e.target.value.trim();
            const n = parseFloat(txt.replace(',', '.'));
            const { anchoMaxM: _quitado, ...resto } = regla;
            onChange(txt === '' || !Number.isFinite(n) ? resto : { ...regla, anchoMaxM: n });
          }}
        />
        <span className="text-muted-foreground">m · tubo</span>
        <Input
          className="h-8 w-20 text-xs"
          value={regla.tubo}
          onChange={(e) => onChange({ ...regla, tubo: e.target.value.toUpperCase() })}
        />
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!regla.requiereTuboE78}
            onChange={(e) => {
              const { requiereTuboE78: _quitado, ...resto } = regla;
              onChange(e.target.checked ? { ...regla, requiereTuboE78: true } : resto);
            }}
          />
          Solo con E78 activado
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={porColor ? 'color' : 'fijo'}
          onChange={(e) => {
            if (e.target.value === 'fijo') {
              const { mecPorColor: _q, ...resto } = regla;
              onChange({ ...resto, mec: Object.values(regla.mecPorColor ?? {})[0] ?? 32 });
            } else {
              const { mec: _q, ...resto } = regla;
              onChange({ ...resto, mecPorColor: { BCO: regla.mec ?? 32, BLANCO: regla.mec ?? 32 } });
            }
          }}
        >
          <option value="fijo">Un kit fijo</option>
          <option value="color">Un kit por color</option>
        </select>
        {porColor ? (
          COLORES.map((c) => (
            <span key={c} className="flex items-center gap-1">
              <span className="text-muted-foreground">{c}</span>
              {selMec(
                regla.mecPorColor?.[c] ?? null,
                (n) => onChange({ ...regla, mecPorColor: setColor(regla.mecPorColor ?? {}, c, n, largoDe(c)) }),
                true,
              )}
            </span>
          ))
        ) : (
          selMec(regla.mec ?? null, (n) => onChange({ ...regla, mec: n ?? undefined }))
        )}
      </div>
      <Input
        className="mt-2 h-8 w-full text-xs"
        placeholder="Nota que ve el operario en Fase 2 cuando la regla está activa"
        value={regla.nota}
        onChange={(e) => onChange({ ...regla, nota: e.target.value })}
      />
      {(regla.modeloMecPorColor || regla.categoriaModelo) && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Cruce de catálogo: la fila del modelo se busca
          {regla.categoriaModelo ? ` en «${regla.categoriaModelo}»` : ''}
          {regla.modeloMecPorColor
            ? ` con ${Object.entries(regla.modeloMecPorColor)
                .filter(([c]) => c.length === 3)
                .map(([c, m]) => `${c}→MEC ${m}`)
                .join(' · ')}`
            : ''}
          .
        </p>
      )}
    </div>
  );
}

function ReglaCategoriaFila({
  regla,
  onChange,
  onBorrar,
  selMec,
  COLORES,
  largoDe,
}: {
  regla: ReglaMecCategoria;
  onChange: (r: ReglaMecCategoria) => void;
  onBorrar: () => void;
  COLORES: readonly string[];
  largoDe: (c: string) => string;
  selMec: (v: number | null, on: (n: number | null) => void, permiteVacio?: boolean) => JSX.Element;
}) {
  const esIncluye = typeof regla.categoria !== 'string';
  const textoCat = textoCategoria(regla.categoria);
  const colores = regla.colores ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
      <Input
        className="h-8 min-w-[14rem] flex-1 text-xs"
        placeholder="Para qué sirve esta regla"
        value={regla.descripcion}
        onChange={(e) => onChange({ ...regla, descripcion: e.target.value })}
      />
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={esIncluye ? 'contiene' : 'exacta'}
        onChange={(e) =>
          onChange({
            ...regla,
            categoria: e.target.value === 'contiene' ? { includes: textoCat } : textoCat,
          })
        }
      >
        <option value="exacta">Categoría exacta</option>
        <option value="contiene">Contiene</option>
      </select>
      <Input
        className="h-8 w-52 text-xs"
        value={textoCat}
        onChange={(e) =>
          onChange({
            ...regla,
            categoria: esIncluye ? { includes: e.target.value } : e.target.value,
          })
        }
      />
      {selMec(regla.mec, (n) => onChange({ ...regla, mec: n ?? regla.mec }))}
      <span className="text-muted-foreground">colores:</span>
      {COLORES.map((c) => (
        <label key={c} className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={colores.some((x) => x.toUpperCase() === c)}
            onChange={(e) => {
              const largo = largoDe(c);
              const sin = colores.filter((x) => x !== c && x !== largo);
              const nuevos = e.target.checked ? [...sin, c, largo] : sin;
              const { colores: _q, ...resto } = regla;
              onChange(nuevos.length > 0 ? { ...regla, colores: nuevos } : resto);
            }}
          />
          {c}
        </label>
      ))}
      {colores.length === 0 && <span className="text-muted-foreground">(todos)</span>}
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={!!regla.fijo}
          onChange={(e) => {
            const { fijo: _q, ...resto } = regla;
            onChange(e.target.checked ? { ...regla, fijo: true } : resto);
          }}
        />
        Fijo
      </label>
      <Button variant="ghost" size="sm" onClick={onBorrar}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
