// La cabecera del papel, lista para corregir: qué es, su número, la fecha y
// el proveedor. La lectura la propone; quien tiene el papel en la mano manda.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TIPOS_DOCUMENTO } from '@/modules/inventario/recepcion';
import type { CabeceraDocumento } from '@/modules/inventario/recepcionFactura';

export function CabeceraDocumentoForm({
  cab,
  onCambiar,
  deshabilitado,
}: {
  cab: CabeceraDocumento;
  onCambiar: (c: CabeceraDocumento) => void;
  deshabilitado?: boolean;
}) {
  const poner = (cambio: Partial<CabeceraDocumento>) => onCambiar({ ...cab, ...cambio });

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-3.5 md:grid-cols-[auto_1fr_auto]">
      <div className="space-y-1.5">
        <Label>Qué papel es</Label>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_DOCUMENTO.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => poner({ tipo: t.id })}
              disabled={deshabilitado}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[0.78rem] transition-colors',
                cab.tipo === t.id
                  ? 'border-accent bg-accent/[0.12] text-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {t.texto}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cab-numero">Número (folio)</Label>
        <Input
          id="cab-numero"
          value={cab.numero}
          onChange={(e) => poner({ numero: e.target.value })}
          disabled={deshabilitado}
          placeholder="Como viene impreso"
          className={cn('max-w-[14rem] font-mono', !cab.numero.trim() && 'border-warning/70')}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cab-fecha">Fecha del papel</Label>
        <Input
          id="cab-fecha"
          type="date"
          value={cab.fecha}
          onChange={(e) => poner({ fecha: e.target.value })}
          disabled={deshabilitado}
          className="w-[10.5rem]"
        />
      </div>
      <div className="space-y-1.5 md:col-span-1">
        <Label htmlFor="cab-rut">RUT del proveedor</Label>
        <Input
          id="cab-rut"
          value={cab.rut}
          onChange={(e) => poner({ rut: e.target.value })}
          disabled={deshabilitado}
          placeholder="76.123.456-7"
          className="max-w-[12rem] font-mono"
        />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="cab-nombre">Proveedor</Label>
        <Input
          id="cab-nombre"
          value={cab.nombre}
          onChange={(e) => poner({ nombre: e.target.value })}
          disabled={deshabilitado}
          placeholder="Razón social, como en el papel"
        />
      </div>
    </div>
  );
}

export default CabeceraDocumentoForm;
