// ─────────────────────────────────────────────────────────────────────
// Admin → Parámetros de cotización
//
// Permite editar por empresa los valores comerciales que antes estaban
// fijos en el código: IVA, margen de insumos, recargo tarjeta, costos de
// instalación, mano de obra y traslado. Se guardan en `configuracion`
// (clave 'parametros_cotizador') y el cotizador Fase 0 los usa al vuelo.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Calculator, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PARAMETROS_DEFAULT,
  guardarParametros,
  useParametrosCotizador,
  type ClaveNumericaParametros,
  type ParametrosCotizador,
} from '@/modules/cotizador/parametros';

type CampoDef = {
  key: ClaveNumericaParametros;
  label: string;
  hint: string;
  /** 'pct' se muestra como porcentaje (0.19 → 19); 'clp' monto; 'num' entero. */
  modo: 'pct' | 'clp' | 'num';
};

// El recargo de tarjeta (Mercado Pago / Flow) se edita en su propia sección
// "Comisiones de tarjeta de crédito", no acá.
const CAMPOS: CampoDef[] = [
  { key: 'iva', label: 'IVA (%)', hint: 'Impuesto aplicado a los totales', modo: 'pct' },
  {
    key: 'margenInsumo',
    label: 'Margen de insumos (%)',
    hint: 'Precio venta insumo = costo ÷ (1 − margen). 35 = histórico',
    modo: 'pct',
  },
  { key: 'instalacionRoller', label: 'Instalación roller/dúo ($)', hint: 'Por cortina', modo: 'clp' },
  { key: 'instalacionVertical', label: 'Instalación vertical ($)', hint: 'Por cortina', modo: 'clp' },
  { key: 'manoObraRoller', label: 'Mano de obra roller ($)', hint: 'Por cortina', modo: 'clp' },
  { key: 'manoObraDuo', label: 'Mano de obra dúo ($)', hint: 'Por cortina', modo: 'clp' },
  { key: 'manoObraVertical', label: 'Mano de obra vertical ($)', hint: 'Por cortina', modo: 'clp' },
  { key: 'traslado', label: 'Traslado ($)', hint: '1 por cada tipo de cortina cotizado', modo: 'clp' },
  {
    key: 'instalacionGratisMinCortinas',
    label: 'Instalación gratis desde (cortinas)',
    hint: 'Nº mínimo de cortinas roller/dúo para instalación gratis en RM',
    modo: 'num',
  },
  {
    key: 'instalacionDescuentoRM',
    label: 'Descuento instalación RM (%)',
    hint: '100 = gratis al llegar al mínimo de cortinas',
    modo: 'pct',
  },
  {
    key: 'instalacionDescuentoRegion',
    label: 'Descuento instalación región (%)',
    hint: '0 = se cobra completa; editable para cotizaciones a región',
    modo: 'pct',
  },
];

// margenInsumo se guarda como divisor (0.65) pero se edita como margen (35%).
function aVisible(def: CampoDef, v: number): string {
  if (def.key === 'margenInsumo') return String(Math.round((1 - v) * 1000) / 10);
  if (def.modo === 'pct') return String(Math.round(v * 1000) / 10);
  return String(v);
}

function aInterno(def: CampoDef, s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  if (def.key === 'margenInsumo') {
    if (n >= 100) return null;
    return (100 - n) / 100;
  }
  if (def.modo === 'pct') {
    // Los descuentos de instalación viven en [0,1]; rechazar > 100% para no
    // guardar datos fuera de rango en la BD (aunque el motor luego los acote).
    if (
      (def.key === 'instalacionDescuentoRM' || def.key === 'instalacionDescuentoRegion') &&
      n > 100
    ) {
      return null;
    }
    return n / 100;
  }
  if (def.modo === 'num') return Math.round(n);
  return n;
}

export function ParametrosCotizadorSection() {
  const { empresaId } = useAuth();
  const { parametros, loading, refresh } = useParametrosCotizador();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = aVisible(c, parametros[c.key]);
    setValores(v);
  }, [loading, parametros]);

  const onGuardar = async () => {
    if (!empresaId) return;
    const nuevos: ParametrosCotizador = { ...parametros };
    for (const c of CAMPOS) {
      const n = aInterno(c, valores[c.key] ?? '');
      if (n === null) {
        toast.error(`Valor inválido en "${c.label}"`);
        return;
      }
      nuevos[c.key] = n;
    }
    setSaving(true);
    try {
      await guardarParametros(empresaId, nuevos);
      await refresh();
      toast.success('Parámetros guardados. El cotizador ya los está usando.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const onRestaurar = () => {
    const v: Record<string, string> = {};
    for (const c of CAMPOS) v[c.key] = aVisible(c, PARAMETROS_DEFAULT[c.key]);
    setValores(v);
    toast.info('Valores por defecto cargados. Presiona Guardar para aplicarlos.');
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Calculator className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Parámetros de cotización</h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Valores comerciales que usa el cotizador (Fase 0) para calcular precios. Son propios de
        esta empresa: cambiarlos aquí no afecta cotizaciones ya guardadas, solo las nuevas.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS.map((c) => (
              <div key={c.key} className="space-y-1">
                <Label htmlFor={`param-${c.key}`} className="text-xs">
                  {c.label}
                </Label>
                <Input
                  id={`param-${c.key}`}
                  inputMode="decimal"
                  value={valores[c.key] ?? ''}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [c.key]: e.target.value }))
                  }
                />
                <p className="text-[12px] leading-tight text-muted-foreground">{c.hint}</p>
              </div>
            ))}
          </div>

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
        </>
      )}
    </section>
  );
}
