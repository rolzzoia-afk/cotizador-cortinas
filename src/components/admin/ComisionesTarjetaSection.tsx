// ─────────────────────────────────────────────────────────────────────
// Admin → Comisiones de tarjeta de crédito
//
// Muestra y edita las comisiones de los proveedores de pago con tarjeta
// (Mercado Pago / Flow) y cuál está activo. El proveedor activo define el
// recargo del "Total tarjeta crédito" en Fase 0 y el mensaje de cuotas de
// la cotización impresa: Mercado Pago → "Hasta 12 cuotas sin interés";
// Flow → los intereses de las cuotas dependen del banco del cliente.
// Se guarda en `configuracion` (clave 'parametros_cotizador').
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { CreditCard, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  guardarParametros,
  useParametrosCotizador,
  type ParametrosCotizador,
  type ProveedorTarjeta,
} from '@/modules/cotizador/parametros';

const PROVEEDORES: {
  id: ProveedorTarjeta;
  nombre: string;
  campo: 'recargoTarjeta' | 'recargoTarjetaFlow';
  cuotas: string;
}[] = [
  {
    id: 'mercadopago',
    nombre: 'Mercado Pago (Mercado Libre)',
    campo: 'recargoTarjeta',
    cuotas: 'La cotización muestra el banner «Hasta 12 cuotas sin interés».',
  },
  {
    id: 'flow',
    nombre: 'Flow',
    campo: 'recargoTarjetaFlow',
    cuotas:
      'Sin cuotas sin interés: la cotización indica que los intereses dependen del banco del cliente.',
  },
];

// 0.138 → "13,8" (misma convención que Parámetros de cotización).
const aVisible = (v: number) => String(Math.round(v * 1000) / 10).replace('.', ',');

function aInterno(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

export function ComisionesTarjetaSection() {
  const { empresaId } = useAuth();
  const { parametros, loading, refresh } = useParametrosCotizador();
  const [proveedor, setProveedor] = useState<ProveedorTarjeta>('mercadopago');
  const [pcts, setPcts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    setProveedor(parametros.proveedorTarjeta);
    setPcts({
      recargoTarjeta: aVisible(parametros.recargoTarjeta),
      recargoTarjetaFlow: aVisible(parametros.recargoTarjetaFlow),
    });
  }, [loading, parametros]);

  const onGuardar = async () => {
    if (!empresaId) return;
    const nuevos: ParametrosCotizador = { ...parametros, proveedorTarjeta: proveedor };
    for (const p of PROVEEDORES) {
      const n = aInterno(pcts[p.campo] ?? '');
      if (n === null) {
        toast.error(`Comisión inválida en "${p.nombre}" (0 a 100%).`);
        return;
      }
      nuevos[p.campo] = n;
    }
    setSaving(true);
    try {
      await guardarParametros(empresaId, nuevos);
      await refresh();
      const activo = PROVEEDORES.find((p) => p.id === proveedor);
      toast.success(
        `Guardado. Proveedor activo: ${activo?.nombre} (recargo ${pcts[activo?.campo ?? '']}%).`,
      );
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Comisiones de tarjeta de crédito
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Comisión que cobra cada proveedor por el pago con tarjeta (recargo aplicado al «Total
        tarjeta crédito» de la cotización). El proveedor activo también define el mensaje de
        cuotas que se imprime al pie de la cotización.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PROVEEDORES.map((p) => {
              const activo = proveedor === p.id;
              return (
                <div
                  key={p.id}
                  role="radio"
                  aria-checked={activo}
                  tabIndex={0}
                  onClick={() => setProveedor(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setProveedor(p.id);
                  }}
                  className={cn(
                    'cursor-pointer rounded-lg border p-4 transition-colors',
                    activo
                      ? 'border-success bg-success/5 ring-1 ring-success'
                      : 'border-border hover:bg-secondary/40',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.nombre}</span>
                    {activo && (
                      <span className="rounded-md border border-success/40 bg-success/15 px-2 py-0.5 text-[11px] font-bold uppercase text-success">
                        Activo
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`comision-${p.id}`} className="text-xs">
                      Comisión (%)
                    </Label>
                    <Input
                      id={`comision-${p.id}`}
                      inputMode="decimal"
                      className="max-w-[120px]"
                      value={pcts[p.campo] ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setPcts((v) => ({ ...v, [p.campo]: e.target.value }))
                      }
                    />
                  </div>
                  <p className="mt-2 text-[12px] leading-tight text-muted-foreground">{p.cuotas}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={onGuardar} disabled={saving || !empresaId} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar comisiones'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Aplica a las cotizaciones nuevas de toda la empresa (las vendedoras no ven esta
              opción).
            </p>
          </div>
        </>
      )}
    </section>
  );
}
