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
  type ParametrosCorte,
} from '@/modules/cotizador/parametros';

type Grupo = 'corte' | 'rollo' | 'colmena';

type CampoDef = {
  key: keyof ParametrosCorte;
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
    hint: 'Reserva extra de alto para verticales en el plan de corte.',
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
    key: 'ventanaAltoCm',
    label: 'Tolerancia de alto en sobrantes (cm)',
    hint: 'Un sobrante sirve si su alto no supera el de la pieza + este valor.',
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
];

const GRUPOS: { key: Grupo; titulo: string }[] = [
  { key: 'corte', titulo: 'Corte de telas' },
  { key: 'rollo', titulo: 'Rollo / plan de corte' },
  { key: 'colmena', titulo: 'Colmena' },
];

export function ParametrosCorteTab() {
  const { empresaId, perfil } = useAuth();
  const { parametros, loading, refresh } = useParametrosCotizador();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const puedeEditar = esRolAdmin(perfil?.rol);

  useEffect(() => {
    if (loading) return;
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = String(parametros[c.key]);
    setValores(v);
  }, [loading, parametros]);

  const onGuardar = async () => {
    if (!empresaId || !puedeEditar) return;
    const nuevos = { ...parametros };
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
