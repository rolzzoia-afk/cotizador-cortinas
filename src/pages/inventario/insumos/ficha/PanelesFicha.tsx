// Los paneles chicos de la ficha: los datos del artículo, sus ubicaciones en
// el rack, las etiquetas y el proveedor.
//
// Lo que la lámina muestra y la base todavía NO tiene (unidad de medida,
// contenido por unidad y objetivo de compra) llega con la Entrega B. Acá no
// se dibuja un campo vacío que parezca un dato.

import { Printer, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCLP, type Insumo, type UbicacionRack } from '@/modules/inventario/helpers';

export function Dato({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className="text-right text-[0.8125rem]">{valor ?? '—'}</span>
    </div>
  );
}

const oNada = (v: string | number | null | undefined) => {
  const s = String(v ?? '').trim();
  return s === '' ? <span className="text-muted-foreground">—</span> : s;
};

export function DatosArticulo({ insumo, esAdmin }: { insumo: Insumo; esAdmin: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Ficha
      </h2>
      <div className="mt-1.5 flex flex-col">
        <Dato rotulo="Categoría" valor={oNada(insumo.categoria)} />
        <Dato rotulo="Subcategoría" valor={oNada(insumo.sub_categoria)} />
        <Dato rotulo="Color" valor={oNada(insumo.color)} />
        <Dato rotulo="Proveedor" valor={oNada(insumo.proveedor)} />
        <Dato rotulo="Cód. proveedor" valor={oNada(insumo.cod_proveedor)} />
        <Dato
          rotulo="Por paquete"
          valor={<span className="font-mono">{insumo.can_x_paquete || 1}</span>}
        />
        <Dato
          rotulo="Punto de reposición"
          valor={
            (insumo.minimo || 0) > 0 ? (
              <span className="font-mono">{insumo.minimo}</span>
            ) : (
              <span className="text-muted-foreground">sin definir</span>
            )
          }
        />
        {esAdmin ? (
          <Dato
            rotulo="Costo"
            valor={
              <span className="font-mono">
                ${formatCLP(insumo.costo)}{' '}
                <Badge variant="muted" className="ml-1 align-middle">
                  solo admin
                </Badge>
              </span>
            }
          />
        ) : null}
        {insumo.comentarios ? <Dato rotulo="Comentarios" valor={insumo.comentarios} /> : null}
      </div>
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">
        La unidad de medida y el objetivo de compra se agregan con el kardex.
      </p>
    </div>
  );
}

export function UbicacionesArticulo({
  insumo,
  ubicaciones,
}: {
  insumo: Insumo;
  ubicaciones: UbicacionRack[];
}) {
  if (ubicaciones.length === 0) {
    return (
      <EmptyState
        titulo="Sin posición en el rack"
        texto={
          insumo.ubicacion
            ? `La ficha dice «${insumo.ubicacion}», pero no está tomada ninguna posición del rack.`
            : 'Este artículo no tiene ninguna posición asignada en los racks.'
        }
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-[0.8125rem]">
        <thead>
          <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
            <th className="h-9 px-3 text-left font-medium">Almacén</th>
            <th className="h-9 px-3 text-left font-medium">Rack</th>
            <th className="h-9 px-3 text-left font-medium">Fila</th>
            <th className="h-9 px-3 text-left font-medium">Columna</th>
            <th className="h-9 px-3 text-left font-medium">Notas</th>
          </tr>
        </thead>
        <tbody>
          {ubicaciones.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">{u.almacen || '—'}</td>
              <td className="px-3 py-2 font-mono font-medium">{u.rack}</td>
              <td className="px-3 py-2 font-mono">{u.fila}</td>
              <td className="px-3 py-2 font-mono">{u.columna}</td>
              <td className="px-3 py-2 text-muted-foreground">{u.notas || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EtiquetasArticulo({
  insumo,
  ubicaciones,
  onImprimir,
}: {
  insumo: Insumo;
  ubicaciones: UbicacionRack[];
  onImprimir: () => void;
}) {
  const contenedor = `INS:${String(insumo.cod ?? '').replace(/\s+/g, '')}`;
  const u = ubicaciones[0];
  const ubicacion = u ? `LOC:${u.rack}|${u.fila}|${u.columna}`.replace(/\s+/g, '') : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-[0.9375rem] font-medium">Los QR de este artículo</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Son los mismos que ya están pegados en el taller: el del contenedor va en la caja y el
          de ubicación, en el estante. El escáner del despacho lee estos dos.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
            <QrCode className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="text-xs text-muted-foreground">Contenedor</span>
            <span className="ml-auto font-mono text-[0.8125rem]">{contenedor}</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
            <QrCode className="h-4 w-4 shrink-0 text-accent" aria-hidden />
            <span className="text-xs text-muted-foreground">Ubicación</span>
            <span className="ml-auto font-mono text-[0.8125rem]">
              {ubicacion ?? <span className="text-muted-foreground">sin posición en el rack</span>}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={onImprimir}>
          <Printer className="h-4 w-4" /> Ver e imprimir
        </Button>
      </div>
    </div>
  );
}

export function ProveedorArticulo({ insumo, esAdmin }: { insumo: Insumo; esAdmin: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex flex-col">
        <Dato rotulo="Proveedor" valor={oNada(insumo.proveedor)} />
        <Dato rotulo="Código del proveedor" valor={oNada(insumo.cod_proveedor)} />
        <Dato rotulo="Descriptor del proveedor" valor={oNada(insumo.descriptor_proveedor)} />
        <Dato rotulo="Cómo se compra" valor={oNada(insumo.compra)} />
        <Dato
          rotulo="Unidades por paquete"
          valor={<span className="font-mono">{insumo.can_x_paquete || 1}</span>}
        />
        {esAdmin ? (
          <>
            <Dato
              rotulo="Costo neto"
              valor={<span className="font-mono">${formatCLP(insumo.costo)}</span>}
            />
            <Dato
              rotulo="Costo con IVA"
              valor={<span className="font-mono">${formatCLP(insumo.costo_iva)}</span>}
            />
          </>
        ) : null}
      </div>
      {!esAdmin ? (
        <p className="mt-2 text-[0.6875rem] text-muted-foreground">
          Los costos los ve solo quien administra.
        </p>
      ) : null}
    </div>
  );
}
