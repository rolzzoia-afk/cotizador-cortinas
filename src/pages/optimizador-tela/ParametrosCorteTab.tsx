// ─────────────────────────────────────────────────────────────────────
// Optimizador de Tela → tab "Parámetros de corte"
//
// Edita por empresa los valores de corte/dimensionado que antes estaban
// fijos en el código y que en el Excel del taller eran celdas seteables:
// extras de alto (roller/dúo/vertical), descuento de ancho, reglas del
// rollo y mínimos de colmena. Se guardan junto al resto de parámetros en
// `configuracion` (clave 'parametros_cotizador').
//
// Solo admin/superadmin puede editar; los demás roles del módulo ven los
// valores en solo lectura.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PARAMETROS_CORTE_DEFAULT,
  guardarParametros,
  useParametrosCotizador,
  normalizarParametros,
  type ModoCorte,
  type ParametrosCorte,
} from '@/modules/cotizador/parametros';

type Grupo = 'corte' | 'rollo' | 'colmena' | 'sobrantes';

/** Los campos con caja de texto son los numéricos; `usarColmenaPanos` es un
 *  interruptor y se dibuja aparte, al final del grupo Colmena. */
type ClaveNumericaCorte = {
  [K in keyof ParametrosCorte]: ParametrosCorte[K] extends number ? K : never;
}[keyof ParametrosCorte];

type CampoDef = {
  key: ClaveNumericaCorte;
  label: string;
  hint: string;
  grupo: Grupo;
  /** Cambia el precio de las cotizaciones nuevas de Fase 0. */
  afectaPrecio?: boolean;
};

const CAMPOS: CampoDef[] = [
  // ── Corte de telas ──
  {
    key: 'extraAltoCm',
    label: 'Extra de alto (cm)',
    hint: 'Se suma al alto de corte de cada cortina (roller y otros).',
    grupo: 'corte',
    afectaPrecio: true,
  },
  {
    key: 'extraDuoCm',
    label: 'Extra dúo (cm)',
    hint: 'Dúo: corte real de tela = 2×alto + este valor. También fija la reserva de colmena.',
    grupo: 'corte',
  },
  {
    key: 'extraMesaDuoCm',
    label: 'Extra mesa dúo (cm)',
    hint: 'Dúo: ALTO MESA DE CORTE = alto + este valor (tela doblada en la mesa). Solo afecta el PDF Dimensionado.',
    grupo: 'corte',
  },
  {
    key: 'extraVerticalCm',
    label: 'Extra vertical (cm)',
    hint: 'Vertical: alto de corte de la tela = alto real + este valor. También es la reserva de alto en el plan de corte.',
    grupo: 'corte',
  },
  {
    key: 'dctoAltoFinalVerticalCm',
    label: 'Descuento alto final vertical (cm)',
    hint: 'Vertical: alto final de la lama terminada = alto de corte − este valor.',
    grupo: 'corte',
  },
  {
    key: 'descAnchoCorteCm',
    label: 'Descuento de ancho (cm)',
    hint: 'Ancho de corte = ancho nominal − este valor (limpieza de borde).',
    grupo: 'corte',
  },
  // ── Rollo / plan de corte ──
  {
    key: 'anchoRolloDefaultM',
    label: 'Ancho de rollo por defecto (m)',
    hint: 'Se usa cuando el producto no tiene ancho de rollo en el catálogo.',
    grupo: 'rollo',
  },
  {
    key: 'anchoRolloPlanCm',
    label: 'Ancho del rollo en plan de corte (cm)',
    hint: 'Ancho físico del rollo; el útil descuenta 2× el margen.',
    grupo: 'rollo',
  },
  {
    key: 'margenRolloCm',
    label: 'Margen del rollo (cm)',
    hint: 'Margen de corte por lado del rollo.',
    grupo: 'rollo',
  },
  {
    key: 'bordeCm',
    label: 'Limpieza de bordes (cm)',
    hint: 'Se suma al ancho de cada pieza que se corta del rollo (Regla 5).',
    grupo: 'rollo',
  },
  {
    key: 'ahorroMinRotacionCm',
    label: 'Ahorro mínimo para rotar (cm)',
    hint: 'Solo se propone rotar piezas si el layout rotado ahorra al menos esto de rollo.',
    grupo: 'rollo',
  },
  // ── Colmena ──
  {
    key: 'colmenaMinAnchoCm',
    label: 'Mínimo de ancho colmena (cm)',
    hint: 'Bajo este mínimo el remanente se registra como merma, no como colmena.',
    grupo: 'colmena',
  },
  {
    key: 'colmenaMinAltoCm',
    label: 'Mínimo de alto colmena (cm)',
    hint: 'Bajo este mínimo el remanente se registra como merma, no como colmena.',
    grupo: 'colmena',
  },
  {
    key: 'diasAlertaColmena',
    label: 'Alerta de antigüedad (días)',
    hint: 'Una colmena disponible sin uso por más de estos días pasa a "en alerta".',
    grupo: 'colmena',
  },
  {
    key: 'colmenaPenalidadNuevoPanoCm2',
    label: 'Penalidad por paño nuevo (cm²)',
    hint: 'Cuánto "cuesta" dejar otro paño en el rack. Sube este valor para gastar los paños justos aunque quede más merma; en 0 solo manda la merma.',
    grupo: 'colmena',
  },
  // ── Sobrantes del corte (módulo Producción) ──
  {
    key: 'funcionalRollerMinAnchoCm',
    label: 'Roller: ancho mínimo (cm)',
    hint: 'Desde acá el sobrante se marca FUNCIONAL PARA ROLLER en su etiqueta.',
    grupo: 'sobrantes',
  },
  {
    key: 'funcionalRollerMinAltoCm',
    label: 'Roller: alto mínimo (cm)',
    hint: 'Va junto con el ancho: tienen que cumplirse los dos.',
    grupo: 'sobrantes',
  },
  {
    key: 'funcionalVerticalMinAnchoCm',
    label: 'Vertical: ancho mínimo (cm)',
    hint: 'La vertical acepta trozos más angostos: se corta en lamas.',
    grupo: 'sobrantes',
  },
  {
    key: 'funcionalVerticalMinAltoCm',
    label: 'Vertical: alto mínimo (cm)',
    hint: 'Pero necesita más largo que la roller.',
    grupo: 'sobrantes',
  },
];

const GRUPOS: { key: Grupo; titulo: string }[] = [
  { key: 'corte', titulo: 'Corte de telas' },
  { key: 'rollo', titulo: 'Rollo / plan de corte' },
  { key: 'colmena', titulo: 'Colmena' },
  { key: 'sobrantes', titulo: 'Sobrantes del corte (módulo Producción)' },
];

export function ParametrosCorteTab() {
  const { empresaId, perfil } = useAuth();
  const { parametros, loading, refresh } = useParametrosCotizador();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [usarColmena, setUsarColmena] = useState(true);
  const [permiteGiro, setPermiteGiro] = useState(true);
  const [modoCorte, setModoCorte] = useState<ModoCorte>('guillotina');
  const [saving, setSaving] = useState(false);
  const puedeEditar = esRolAdmin(perfil?.rol);

  useEffect(() => {
    if (loading) return;
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = String(parametros[c.key]);
    setValores(v);
    setUsarColmena(parametros.usarColmenaPanos !== false);
    setPermiteGiro(parametros.colmenaPermiteGiro !== false);
    setModoCorte(parametros.modoCorte === 'multieje' ? 'multieje' : 'guillotina');
  }, [loading, parametros]);

  const onGuardar = async () => {
    if (!empresaId || !puedeEditar) return;
    const nuevos = {
      ...parametros,
      usarColmenaPanos: usarColmena,
      colmenaPermiteGiro: permiteGiro,
      modoCorte,
    };
    for (const c of CAMPOS) {
      const n = parseFloat((valores[c.key] ?? '').replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) {
        toast.error(`Valor inválido en "${c.label}"`);
        return;
      }
      nuevos[c.key] = n;
    }
    setSaving(true);
    try {
      // normalizar aplica los clamps (rollo > 2×margen, días enteros, etc.)
      await guardarParametros(empresaId, normalizarParametros(nuevos));
      await refresh();
      toast.success('Parámetros de corte guardados. El optimizador ya los usa.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const onRestaurar = () => {
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = String(PARAMETROS_CORTE_DEFAULT[c.key]);
    setValores(v);
    setUsarColmena(PARAMETROS_CORTE_DEFAULT.usarColmenaPanos);
    setPermiteGiro(PARAMETROS_CORTE_DEFAULT.colmenaPermiteGiro);
    setModoCorte(PARAMETROS_CORTE_DEFAULT.modoCorte);
    toast.info('Valores por defecto cargados. Presiona Guardar para aplicarlos.');
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-accent" />
        <h2 className="text-sm font-semibold text-muted-foreground">Parámetros de corte</h2>
      </header>

      <p className="mb-1 text-xs text-muted-foreground">
        Reglas de dimensionado que antes vivían en la planilla Excel del taller. Son propias de
        esta empresa y las usan el optimizador de tela, el plan de corte desde colmena y las
        hojas de corte/cálculo general.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        Los cambios aplican al reabrir el optimizador o el plan de una OT; los planes ya
        impresos no se recalculan solos.
      </p>

      {!puedeEditar && (
        <p className="mb-4 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Solo administradores pueden editar estos valores. Los ves en modo lectura.
        </p>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          {GRUPOS.map((g) => (
            <div key={g.key} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {g.titulo}
              </h3>
              {/* Estas cuatro medidas son la pregunta del cortador —«¿para qué
                  alcanza este trozo?»— y por eso van aparte de los mínimos de
                  colmena de arriba, que son la regla del inventario. */}
              {g.key === 'sobrantes' && (
                <p className="mb-3 text-[12px] leading-tight text-muted-foreground">
                  Al cerrar un corte en Producción, cada trozo que sobra se mide contra esto: si
                  alcanza para una roller o para una vertical entra a la colmena con su etiqueta;
                  si no alcanza para ninguna de las dos, se anota como merma. El cortador puede
                  corregir la marca antes de imprimir.
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPOS.filter((c) => c.grupo === g.key).map((c) => (
                  <div key={c.key} className="space-y-1">
                    <Label htmlFor={`corte-${c.key}`} className="flex items-center gap-1.5 text-xs">
                      {c.label}
                      {c.afectaPrecio && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                          <AlertTriangle className="h-3 w-3" /> afecta precio
                        </span>
                      )}
                    </Label>
                    <Input
                      id={`corte-${c.key}`}
                      inputMode="decimal"
                      disabled={!puedeEditar}
                      value={valores[c.key] ?? ''}
                      onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
                      className={c.afectaPrecio ? 'border-warning/50' : undefined}
                    />
                    <p className="text-[12px] leading-tight text-muted-foreground">
                      {c.hint}
                      {c.afectaPrecio && ' Cambia el precio de cotizaciones nuevas en Fase 0.'}
                    </p>
                  </div>
                ))}
              </div>

              {/* Interruptor: es el único parámetro que no es un número, y
                  decide si el plan de corte puede reutilizar la colmena. */}
              {g.key === 'colmena' && (
                <label
                  className={`mt-4 flex items-start gap-2.5 rounded-md border p-3 text-xs ${
                    usarColmena ? 'border-border bg-secondary/30' : 'border-warning/50 bg-warning/10'
                  } ${puedeEditar ? 'cursor-pointer' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!puedeEditar}
                    checked={usarColmena}
                    onChange={(e) => setUsarColmena(e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">Usar colmena de paños en el optimizador</span>
                    <span className="block text-[12px] leading-tight text-muted-foreground">
                      Apagado, el plan de corte ignora la colmena y corta todo de rollo nuevo,
                      aunque haya paños disponibles. Los sobrantes se siguen registrando como
                      inventario físico: esto solo decide si se usan.
                    </span>
                    {!usarColmena && (
                      <span className="mt-1 flex items-center gap-1 font-semibold text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        Los planes nuevos cortarán solo tela nueva.
                      </span>
                    )}
                  </span>
                </label>
              )}

              {/* Giro dentro del paño: igual que en el rollo, se propone y el
                  operario lo autoriza cortina por cortina. */}
              {g.key === 'colmena' && (
                <label
                  className={`mt-3 flex items-start gap-2.5 rounded-md border border-border bg-secondary/30 p-3 text-xs ${
                    puedeEditar ? 'cursor-pointer' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!puedeEditar || !usarColmena}
                    checked={permiteGiro && usarColmena}
                    onChange={(e) => setPermiteGiro(e.target.checked)}
                  />
                  <span>
                    <span className="font-semibold">Permitir giro en la colmena</span>
                    <span className="block text-[12px] leading-tight text-muted-foreground">
                      Deja que el plan proponga una cortina acostada cuando así entra en un paño
                      que derecha no la recibe. El operario la autoriza una por una antes de
                      cortar, igual que en el rollo. Las verticales nunca se giran.
                    </span>
                  </span>
                </label>
              )}

              {/* Con qué máquina se corta: decide qué acomodos puede proponer el
                  plan. Tampoco es un número, va aparte de los campos. */}
              {g.key === 'rollo' && (
                <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3 text-xs">
                  <p className="font-semibold">Cómo corta la mesa</p>
                  <p className="mb-2 text-[12px] leading-tight text-muted-foreground">
                    Un acomodo que la máquina no puede ejecutar no ahorra tela: obliga al operario
                    a improvisar. Esto decide qué acomodos propone el plan de corte.
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          v: 'guillotina' as const,
                          t: 'Mesa actual — corta de punta a punta',
                          d: 'Cada corte cruza la tela completa y la otra dirección se consigue girando el paño. El plan solo propone acomodos que se pueden ir partiendo en dos, y muestra el orden de los cortes.',
                        },
                        {
                          v: 'multieje' as const,
                          t: 'Cortadora automática — corta en todos los ejes',
                          d: 'La CNC corta cualquier acomodo sin girar la tela: aprovecha ~2 % más de tela, pero un plan así NO se puede ejecutar en las mesas de hoy.',
                        },
                      ] satisfies { v: ModoCorte; t: string; d: string }[]
                    ).map((o) => (
                      <label
                        key={o.v}
                        className={`flex items-start gap-2.5 rounded-md border p-2 ${
                          modoCorte === o.v ? 'border-accent bg-accent/10' : 'border-border'
                        } ${puedeEditar ? 'cursor-pointer' : ''}`}
                      >
                        <input
                          type="radio"
                          name="modo-corte"
                          className="mt-0.5"
                          disabled={!puedeEditar}
                          checked={modoCorte === o.v}
                          onChange={() => setModoCorte(o.v)}
                        />
                        <span>
                          <span className="font-semibold">{o.t}</span>
                          <span className="block text-[12px] leading-tight text-muted-foreground">
                            {o.d}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {modoCorte === 'multieje' && (
                    <p className="mt-2 flex items-center gap-1 font-semibold text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      Solo con la cortadora automática andando.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}

          {puedeEditar && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={onGuardar} disabled={saving || !empresaId} size="sm">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Guardando…' : 'Guardar parámetros'}
              </Button>
              <Button onClick={onRestaurar} variant="secondary" size="sm" disabled={saving}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restaurar defaults
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
