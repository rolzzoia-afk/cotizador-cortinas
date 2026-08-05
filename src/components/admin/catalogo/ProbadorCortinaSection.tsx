// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Probar una cortina
//
// El banco de pruebas: se arma una cortina imaginaria y se ve, al instante,
// TODO lo que la app decidiría con la configuración GUARDADA — el modelo, el
// kit (y por qué regla), el tubo, la cadena, cada corte con su código de
// bodega y los insumos del paño.
//
// No recalcula nada por su cuenta: llama a las mismas funciones que Fase 2 y
// Fase 4 (ver probadorCortina.ts). Sirve para comprobar un cambio del catálogo
// sin tener que crear una OT de prueba y recorrer las cuatro fases.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { categoriasFase1ConTipos } from '@/modules/cotizador/categorias';
import { OPCIONES_CENEFA } from '@/modules/cotizador/fase2';
import { coloresParaUso } from '@/modules/descuentos/coloresAccesorio';
import {
  VARIANTES_OSCURIDAD,
  familiaOscuridad,
  type VarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import {
  esCadenaRoller,
  type CadenaInsumo,
} from '@/modules/cotizador/cadenas';
import { resolverCortinaDePrueba } from '@/modules/cotizador/probadorCortina';

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function ProbadorCortinaSection() {
  const { modelos, loading: loadingModelos } = useDescuentosModelo();
  const { reglas, loading: loadingReglas } = useReglasSeleccion();
  const { formulas, loading: loadingFormulas } = useFormulasFamilias();
  const [cadenas, setCadenas] = useState<CadenaInsumo[]>([]);

  const [categoria, setCategoria] = useState('ROL');
  const [ancho, setAncho] = useState('1,50');
  const [alto, setAlto] = useState('2,40');
  const [color, setColor] = useState('BCO');
  const [cenefa, setCenefa] = useState('No');
  const [variante, setVariante] = useState<VarianteOscuridad>('INTERNO');
  const [usarE78, setUsarE78] = useState(false);

  // Cadenas del inventario, para probar la auto-selección por alto y color
  // (mismo criterio que Fase 2: solo las CAD de roller).
  useEffect(() => {
    supabase
      .from('insumos')
      .select('cod, nemotecnico, color')
      .then(({ data }) => {
        if (data) setCadenas((data as CadenaInsumo[]).filter((i) => esCadenaRoller(i.cod)));
      });
  }, []);

  const cargando = loadingModelos || loadingReglas || loadingFormulas;

  const grupos = useMemo(() => categoriasFase1ConTipos(reglas.tipos), [reglas.tipos]);
  const colores = useMemo(
    () => coloresParaUso('accesorio', reglas.colores),
    [reglas.colores],
  );
  const esOscuridad = useMemo(
    () => !!familiaOscuridad(categoria, cenefa, reglas.tipos),
    [categoria, cenefa, reglas.tipos],
  );

  const num = (v: string) => parseFloat(v.replace(',', '.')) || 0;

  const r = useMemo(() => {
    if (cargando) return null;
    return resolverCortinaDePrueba(
      {
        categoria,
        anchoM: num(ancho),
        altoM: num(alto),
        color,
        cenefa,
        variante: esOscuridad ? variante : undefined,
        usarTuboE78: usarE78,
      },
      { modelos, reglas, formulas, cadenas },
    );
  }, [
    cargando,
    categoria,
    ancho,
    alto,
    color,
    cenefa,
    variante,
    esOscuridad,
    usarE78,
    modelos,
    reglas,
    formulas,
    cadenas,
  ]);

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Probar una cortina</h2>
      </header>
      <p className="mb-4 text-xs text-muted-foreground">
        Arma una cortina de prueba y mira qué decide la app con lo que hay guardado ahora mismo: el
        modelo, el kit y por qué regla lo eligió, el tubo, la cadena, cada corte con su código y los
        insumos que bajarían a bodega. Es lo mismo que saldría en una OT real, sin tener que crear
        una. Si cambias algo más abajo, guarda y esto se actualiza solo.
      </p>

      {/* ── Entradas ─────────────────────────────────────────────── */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Categoría</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {grupos.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Ancho (m)</span>
          <Input className="h-9 text-xs" value={ancho} onChange={(e) => setAncho(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Alto (m)</span>
          <Input className="h-9 text-xs" value={alto} onChange={(e) => setAlto(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Color de accesorios</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            {colores.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Cenefa</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-xs"
            value={cenefa}
            onChange={(e) => setCenefa(e.target.value)}
          >
            {OPCIONES_CENEFA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {esOscuridad && (
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Instalación</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-xs"
              value={variante}
              onChange={(e) => setVariante(e.target.value as VarianteOscuridad)}
            >
              {VARIANTES_OSCURIDAD.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-end gap-2 pb-2 text-xs">
          <input
            type="checkbox"
            checked={usarE78}
            onChange={(e) => setUsarE78(e.target.checked)}
          />
          Tubo E78 activado en la OT
        </label>
      </div>

      {cargando && <p className="text-xs text-muted-foreground">Cargando la configuración…</p>}

      {r && (
        <>
          {/* ── Lo que la app decide ───────────────────────────── */}
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Tarjeta titulo="Modelo de fabricación">
              {r.modelo ? (
                <>
                  <div className="font-medium">{r.modelo.tipo_rol}</div>
                  <div className="text-muted-foreground">
                    {r.modelo.mecanismo || '—'} · {r.modelo.diametro_tubo_mm} mm
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">sin fila en el catálogo</span>
              )}
            </Tarjeta>
            <Tarjeta titulo="Kit de mecanismo">
              <div className="font-medium">{r.kit || '— lo elige el vendedor —'}</div>
              <div className="text-muted-foreground">{r.reglaKit}</div>
            </Tarjeta>
            <Tarjeta titulo="Tubería">
              <div className="font-medium">{r.tubo || '—'}</div>
            </Tarjeta>
            <Tarjeta titulo="Cadena automática">
              {r.cadena ? (
                <>
                  <div className="font-medium">{r.cadena.cod}</div>
                  <div className="text-muted-foreground">
                    {r.cadena.largo} · {r.cadena.color}
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground">la elige el vendedor</span>
              )}
            </Tarjeta>
          </div>

          {r.avisos.length > 0 && (
            <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" />
                Revisa esto
              </div>
              <ul className="ml-4 list-disc space-y-0.5">
                {r.avisos.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {/* ── Cortes ─────────────────────────────────────── */}
            <div className="rounded-md border p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                Cortes (lo que va al taller)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 pr-2 text-left font-medium">Pieza</th>
                      <th className="py-1 pr-2 text-right font-medium">Medida</th>
                      <th className="py-1 text-left font-medium">Código</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.cortes.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-2">{c.componente}</td>
                        <td className="py-1 pr-2 text-right font-mono">{fmt(c.medidaCm)}</td>
                        <td className="py-1 font-mono text-muted-foreground">{c.cod || '—'}</td>
                      </tr>
                    ))}
                    {r.cortes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-2 text-muted-foreground">
                          Sin cortes: revisa la medida y el catálogo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Insumos ────────────────────────────────────── */}
            <div className="rounded-md border p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                Insumos de bodega (por paño)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[11px] uppercase text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-1 pr-2 text-left font-medium">Código</th>
                      <th className="py-1 pr-2 text-left font-medium">Descripción</th>
                      <th className="py-1 text-right font-medium">Cant.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.insumos.map((i, k) => (
                      <tr key={k} className="border-t">
                        <td className="py-1 pr-2 font-mono">{i.codigo || '—'}</td>
                        <td className="py-1 pr-2">{i.descripcion}</td>
                        <td className="py-1 text-right">{i.cantidad}</td>
                      </tr>
                    ))}
                    {r.insumos.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-2 text-muted-foreground">
                          Esta cortina no lleva insumos de bodega por paño.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="mb-1 text-[11px] uppercase text-muted-foreground">{titulo}</div>
      {children}
    </div>
  );
}
