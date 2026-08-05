// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Tuberías (editable)
//
// El catálogo de tubos con su estado, más las reglas que deciden cuál se
// elige. Todo lo que se toca acá viaja al cotizador tal cual: no hay copia.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { Cable, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  PSEUDO_TUBERIAS,
  type ReglaTuboCategoria,
  type ReglasTuberia,
  type TuboCatalogo,
} from '@/modules/descuentos/reglas-tuberia';
import type { EstadoCatalogo } from '@/modules/descuentos/reglas-mecanismo';

const ESTADOS: Array<{ valor: EstadoCatalogo; label: string }> = [
  { valor: 'activo', label: 'Se ofrece' },
  { valor: 'oculto', label: 'Oculto (solo OTs viejas)' },
  { valor: 'opt_in', label: 'Solo con E78 activado' },
];

/** La categoría de una regla puede ser exacta o un "contiene". */
function textoCategoria(categoria: string | { includes: string }): string {
  return typeof categoria === 'string' ? categoria : `contiene «${categoria.includes}»`;
}

/** Motivos por los que la app puede elegir cada código (columna informativa). */
function motivosPorCodigo(t: ReglasTuberia, codigosDelCatalogo: string[]) {
  const filas = new Map<string, string[]>();
  const anotar = (cod: string, motivo: string) => {
    const previo = filas.get(cod.toUpperCase());
    if (previo) previo.push(motivo);
    else filas.set(cod.toUpperCase(), [motivo]);
  };
  anotar(t.reglaE02E66.codigoHasta, `38 mm hasta ${t.reglaE02E66.anchoMaxE02M} m`);
  anotar(t.reglaE02E66.codigoDesde, `38 mm sobre ${t.reglaE02E66.anchoMaxE02M} m`);
  anotar(t.regla63.codigoHasta, `63 mm hasta ${t.regla63.anchoMaxE47M} m`);
  anotar(t.regla63.codigoDesde, `63 mm sobre ${t.regla63.anchoMaxE47M} m`);
  for (const [diam, cod] of Object.entries(t.codigoPorDiametro)) {
    anotar(cod, `default de ${diam} mm`);
  }
  t.tubos45mm.forEach((cod, i) =>
    anotar(cod, i === 0 ? '45 mm (se elige solo)' : '45 mm (manual)'),
  );
  for (const r of t.reglasCategoria) anotar(r.codigo, r.descripcion || textoCategoria(r.categoria));
  for (const cod of codigosDelCatalogo) anotar(cod, 'listado en un modelo del catálogo');
  return filas;
}

type Props = {
  valor: ReglasTuberia;
  onChange: (t: ReglasTuberia) => void;
};

export function SeleccionTuberias({ valor, onChange }: Props) {
  const confirmar = useConfirm();
  const { modelos } = useDescuentosModelo();
  const [nuevo, setNuevo] = useState<TuboCatalogo | null>(null);

  const codigosDelCatalogo = useMemo(
    () => [
      ...new Set(
        modelos
          .flatMap((m) => m.codigos_tubo.split(/[;,]/))
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      ),
    ],
    [modelos],
  );
  const motivos = useMemo(
    () => motivosPorCodigo(valor, codigosDelCatalogo),
    [valor, codigosDelCatalogo],
  );

  const setTubo = (i: number, patch: Partial<TuboCatalogo>) => {
    onChange({
      ...valor,
      tubos: valor.tubos.map((t, k) => (k === i ? { ...t, ...patch } : t)),
    });
  };

  const borrarTubo = async (i: number) => {
    const t = valor.tubos[i];
    const ok = await confirmar({
      titulo: `¿Quitar el tubo ${t.codigo}?`,
      mensaje:
        'Las OTs guardadas con este tubo dejarán de reconocerlo. Si solo quieres que no se ofrezca más, ponlo en «Oculto» en vez de borrarlo.',
      destructivo: true,
      confirmLabel: 'Quitar del catálogo',
    });
    if (!ok) return;
    onChange({ ...valor, tubos: valor.tubos.filter((_, k) => k !== i) });
  };

  const agregar = () => {
    if (!nuevo) return;
    onChange({ ...valor, tubos: [...valor.tubos, { ...nuevo, codigo: nuevo.codigo.toUpperCase() }] });
    setNuevo(null);
  };

  const opcionesCodigo = valor.tubos.map((t) => t.codigo);

  const selCodigo = (v: string, on: (cod: string) => void, id?: string) => (
    <select
      id={id}
      className="h-8 rounded-md border bg-background px-2 text-xs"
      value={v}
      onChange={(e) => on(e.target.value)}
    >
      {!opcionesCodigo.includes(v) && <option value={v}>{v} (no existe)</option>}
      {opcionesCodigo.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  const num = (v: number, on: (n: number) => void) => (
    <Input
      className="h-8 w-20 text-xs"
      value={String(v).replace('.', ',')}
      onChange={(e) => {
        const n = parseFloat(e.target.value.replace(',', '.'));
        if (Number.isFinite(n)) on(n);
      }}
    />
  );

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Cable className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Tuberías</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() =>
            setNuevo({
              codigo: '',
              descripcion: '',
              diametroMm: 38,
              espesorMm: null,
              estado: 'activo',
              autoPorAncho: true,
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar tubería
        </Button>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Los tubos que la app conoce. <strong>Oculto</strong> deja de ofrecerlo en Fase 2 pero las OTs
        que ya lo tienen guardado lo siguen mostrando. <strong>Auto</strong> significa que las reglas
        pueden ponerlo y cambiarlo solas; sin auto, si alguien lo elige a mano nadie se lo pisa.
      </p>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Código</th>
              <th className="px-2 py-1.5 text-left font-medium">Descripción (lo que se ve)</th>
              <th className="px-2 py-1.5 text-left font-medium">Ø mm</th>
              <th className="px-2 py-1.5 text-left font-medium">Espesor</th>
              <th className="px-2 py-1.5 text-left font-medium">Estado</th>
              <th className="px-2 py-1.5 text-left font-medium">Auto</th>
              <th className="px-2 py-1.5 text-left font-medium">Cuándo se usa</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {valor.tubos.map((t, i) => (
              <tr key={`${t.codigo}-${i}`} className="border-t align-top">
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 w-20 text-xs font-semibold"
                    value={t.codigo}
                    onChange={(e) => setTubo(i, { codigo: e.target.value.toUpperCase() })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 min-w-[15rem] text-xs"
                    value={t.descripcion}
                    onChange={(e) => setTubo(i, { descripcion: e.target.value })}
                  />
                </td>
                <td className="px-2 py-1.5">{num(t.diametroMm, (n) => setTubo(i, { diametroMm: n }))}</td>
                <td className="px-2 py-1.5">
                  <Input
                    className="h-8 w-20 text-xs"
                    placeholder="—"
                    value={t.espesorMm == null ? '' : String(t.espesorMm).replace('.', ',')}
                    onChange={(e) => {
                      const txt = e.target.value.trim();
                      const n = parseFloat(txt.replace(',', '.'));
                      setTubo(i, { espesorMm: txt === '' || !Number.isFinite(n) ? null : n });
                    }}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={t.estado}
                    onChange={(e) => setTubo(i, { estado: e.target.value as EstadoCatalogo })}
                  >
                    {ESTADOS.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={t.autoPorAncho}
                    onChange={(e) => setTubo(i, { autoPorAncho: e.target.checked })}
                  />
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {[...new Set(motivos.get(t.codigo.toUpperCase()) ?? [])].join(' · ') || '—'}
                </td>
                <td className="px-2 py-1.5">
                  <Button variant="ghost" size="sm" onClick={() => borrarTubo(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {PSEUDO_TUBERIAS.map((p) => (
              <tr key={p} className="border-t bg-muted/20 text-muted-foreground">
                <td className="px-2 py-1.5 font-semibold">{p}</td>
                <td className="px-2 py-1.5" colSpan={6}>
                  Estructural (no es un tubo): siempre disponible, no se edita.
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nuevo && (
        <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3">
          <div className="mb-2 text-xs font-medium">Tubería nueva</div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Código</span>
              <Input
                className="h-8 w-24 text-xs"
                placeholder="E90"
                value={nuevo.codigo}
                onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value.toUpperCase() })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">
                Descripción (la ve el operario)
              </span>
              <Input
                className="h-8 min-w-[16rem] text-xs"
                placeholder="E90 - TUBO Ø 45 mm reforzado"
                value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">Ø mm</span>
              {num(nuevo.diametroMm, (n) => setNuevo({ ...nuevo, diametroMm: n }))}
            </label>
            <Button
              size="sm"
              onClick={agregar}
              disabled={
                !nuevo.codigo.trim() ||
                !nuevo.descripcion.trim() ||
                valor.tubos.some((t) => t.codigo.toUpperCase() === nuevo.codigo.toUpperCase())
              }
            >
              Agregar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNuevo(null)}>
              Cancelar
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Después de agregarlo, decide dónde se usa: la lista de 45 mm, el tubo por defecto de su
            diámetro o una regla por categoría. Un tubo que ninguna regla nombra solo se puede elegir
            a mano en Fase 2.
          </p>
        </div>
      )}

      {/* ── Reglas por ancho ─────────────────────────────────────── */}
      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
        Qué tubo entra según el ancho
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Tubo de {valor.reglaE02E66.diametroMm} mm</div>
          <div className="flex flex-wrap items-center gap-2">
            hasta
            {num(valor.reglaE02E66.anchoMaxE02M, (n) =>
              onChange({ ...valor, reglaE02E66: { ...valor.reglaE02E66, anchoMaxE02M: n } }),
            )}
            m →
            {selCodigo(valor.reglaE02E66.codigoHasta, (c) =>
              onChange({ ...valor, reglaE02E66: { ...valor.reglaE02E66, codigoHasta: c } }),
            )}
            · sobre ese ancho →
            {selCodigo(valor.reglaE02E66.codigoDesde, (c) =>
              onChange({ ...valor, reglaE02E66: { ...valor.reglaE02E66, codigoDesde: c } }),
            )}
          </div>
        </div>
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Tubo de {valor.regla63.diametroMm} mm</div>
          <div className="flex flex-wrap items-center gap-2">
            hasta
            {num(valor.regla63.anchoMaxE47M, (n) =>
              onChange({ ...valor, regla63: { ...valor.regla63, anchoMaxE47M: n } }),
            )}
            m →
            {selCodigo(valor.regla63.codigoHasta, (c) =>
              onChange({ ...valor, regla63: { ...valor.regla63, codigoHasta: c } }),
            )}
            · sobre ese ancho →
            {selCodigo(valor.regla63.codigoDesde, (c) =>
              onChange({ ...valor, regla63: { ...valor.regla63, codigoDesde: c } }),
            )}
          </div>
        </div>
      </div>

      {/* ── Defaults por diámetro y lista de 45 mm ───────────────── */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Tubo por defecto de cada diámetro</div>
          <div className="space-y-1">
            {Object.entries(valor.codigoPorDiametro).map(([diam, cod]) => (
              <div key={diam} className="flex items-center gap-2">
                <span className="w-14 text-muted-foreground">{diam} mm</span>
                {selCodigo(cod, (c) =>
                  onChange({
                    ...valor,
                    codigoPorDiametro: { ...valor.codigoPorDiametro, [Number(diam)]: c },
                  }),
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border p-3 text-xs">
          <div className="mb-2 font-medium">Tubos de 45 mm (el primero se elige solo)</div>
          <div className="space-y-1">
            {valor.tubos45mm.map((cod, i) => (
              <div key={`${cod}-${i}`} className="flex items-center gap-2">
                <span className="w-6 text-muted-foreground">{i + 1}.</span>
                {selCodigo(cod, (c) =>
                  onChange({
                    ...valor,
                    tubos45mm: valor.tubos45mm.map((x, k) => (k === i ? c : x)),
                  }),
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={i === 0}
                  onClick={() => {
                    const l = [...valor.tubos45mm];
                    [l[i - 1], l[i]] = [l[i], l[i - 1]];
                    onChange({ ...valor, tubos45mm: l });
                  }}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...valor, tubos45mm: valor.tubos45mm.filter((_, k) => k !== i) })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  ...valor,
                  tubos45mm: [...valor.tubos45mm, valor.tubos[0]?.codigo ?? ''],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Reglas por categoría ─────────────────────────────────── */}
      <h3 className="mb-2 mt-5 text-[11px] font-semibold uppercase text-muted-foreground">
        Categorías con tubo fijo
      </h3>
      <div className="space-y-2">
        {valor.reglasCategoria.map((r, i) => (
          <ReglaTuboFila
            key={i}
            regla={r}
            selCodigo={selCodigo}
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
                {
                  descripcion: '',
                  categoria: { includes: '' },
                  codigo: valor.tubos[0]?.codigo ?? '',
                },
              ],
            })
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Agregar regla de categoría
        </Button>
      </div>
    </section>
  );
}

function ReglaTuboFila({
  regla,
  onChange,
  onBorrar,
  selCodigo,
}: {
  regla: ReglaTuboCategoria;
  onChange: (r: ReglaTuboCategoria) => void;
  onBorrar: () => void;
  selCodigo: (v: string, on: (c: string) => void) => JSX.Element;
}) {
  const esIncluye = typeof regla.categoria !== 'string';
  const textoCat = typeof regla.categoria === 'string' ? regla.categoria : regla.categoria.includes;
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
        placeholder="OSCURANTI"
        value={textoCat}
        onChange={(e) =>
          onChange({
            ...regla,
            categoria: esIncluye ? { includes: e.target.value } : e.target.value,
          })
        }
      />
      <span className="text-muted-foreground">→ tubo</span>
      {selCodigo(regla.codigo, (c) => onChange({ ...regla, codigo: c }))}
      <Button variant="ghost" size="sm" onClick={onBorrar}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
