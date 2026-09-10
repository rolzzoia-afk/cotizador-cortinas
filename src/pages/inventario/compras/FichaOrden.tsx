// La ficha de una orden de compra: qué trae, qué llegó y qué falta.
//
// Es la pantalla que se abre con el papel en la mano. Lo importante de acá es
// la columna «Artículo nuestro»: la orden habla en códigos de Finanzas y del
// proveedor, y el kardex habla en códigos del catálogo. Casi todas las líneas
// se vinculan solas por el código interno; la que no, se resuelve UNA vez y
// queda aprendida para la próxima orden del mismo proveedor.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PackageCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { esRolAdmin } from '@/lib/roles';
import {
  ESTADOS_LINEA_ORDEN,
  etiquetaOrden,
  formatearCantidad,
  pendienteDeLinea,
  progresoDeOrden,
  textoConversion,
  textoEspera,
  type LineaOrden,
} from '@/modules/inventario/compras';
import { cerrarOrden, useOrdenesCompra } from '@/modules/inventario/comprasStore';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { useInventario } from '../InventarioLayout';
import VincularArticulo from './VincularArticulo';

export function FichaOrden() {
  const { id } = useParams<{ id: string }>();
  const { queryRol, puedeEditar, rol } = useInventario();
  const { flags } = useFlagsInventario();
  const { ordenes, loading, error, recargar } = useOrdenesCompra(flags.compras);
  const [cerrando, setCerrando] = useState(false);

  const orden = useMemo(() => ordenes.find((o) => o.id === id), [ordenes, id]);
  const progreso = useMemo(() => (orden ? progresoDeOrden(orden) : null), [orden]);
  const esAdmin = esRolAdmin(rol);

  const cerrar = async () => {
    if (!orden) return;
    const ok = await confirmar({
      titulo: `Cerrar ${orden.numero} con faltantes`,
      mensaje:
        `Quedan ${progreso?.pendientes ?? 0} línea${progreso?.pendientes === 1 ? '' : 's'} sin recibir. ` +
        'Cerrarla significa que ya no van a llegar, y deja de aparecer entre las que se esperan.\n\n' +
        'Se anota el motivo, para que en tres meses se sepa qué pasó.',
      confirmLabel: 'Cerrar la orden',
    });
    if (!ok) return;
    const motivo = window.prompt('¿Por qué se cierra? (queda escrito en la orden)');
    if (!motivo || !motivo.trim()) {
      toast.warning('Sin motivo no se cierra.');
      return;
    }
    setCerrando(true);
    try {
      const n = await cerrarOrden(orden.id, motivo.trim());
      toast.success(`${orden.numero} cerrada. ${n} línea${n === 1 ? '' : 's'} como faltante.`);
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCerrando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !orden) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          to={`/inventario/compras${queryRol}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Compras
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error || 'Esa orden no existe o no es de esta empresa.'}
        </div>
      </div>
    );
  }

  const est = etiquetaOrden(orden.estado);
  const abierta = orden.estado === 'en_espera' || orden.estado === 'recibida_parcial';

  return (
    <div className="flex flex-col gap-3.5">
      <Link
        to={`/inventario/compras${queryRol}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Compras
      </Link>

      {/* ── Cabecera ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold">{orden.numero}</h1>
              <Badge variant={est.variante}>{est.texto}</Badge>
              {orden.estado_finanzas && (
                <span className="text-[0.72rem] text-muted-foreground">
                  en Finanzas: {orden.estado_finanzas}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm">{orden.proveedor_nombre || 'Sin proveedor'}</div>
            {orden.proveedor_rut && (
              <div className="font-mono text-[0.72rem] text-muted-foreground">
                {orden.proveedor_rut}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {puedeEditar && abierta && (
              <Button disabled title="Llega en la siguiente entrega">
                <PackageCheck className="h-4 w-4" />
                Recibir mercadería
              </Button>
            )}
            {esAdmin && abierta && (progreso?.pendientes ?? 0) > 0 && (
              <button
                onClick={() => void cerrar()}
                disabled={cerrando}
                className="rounded-lg border border-border px-3 py-2 text-[0.8125rem] transition-colors hover:bg-secondary"
              >
                {cerrando ? 'Cerrando…' : 'Cerrar con faltantes'}
              </button>
            )}
          </div>
        </div>

        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-[0.78rem] md:grid-cols-4">
          <Dato rotulo="Aprobada" valor={fechaLarga(orden.aprobada_en)} />
          <Dato rotulo="Aprobada por" valor={orden.aprobada_por} />
          <Dato rotulo="Se espera" valor={textoEspera(orden)} />
          <Dato rotulo="Guía de despacho" valor={orden.guia} mono />
          <Dato
            rotulo={orden.factura_tipo || 'Factura'}
            valor={orden.factura_folio}
            hint={orden.factura_folio ? 'cargada en Finanzas' : undefined}
            mono
          />
          <Dato rotulo="Pedida por" valor={orden.solicitado_por} />
          <Dato
            rotulo="Nació de"
            valor={orden.solicitud_ref}
            hint={orden.solicitud_ref ? 'solicitud de bodega' : undefined}
          />
          <Dato
            rotulo="Recibido"
            valor={progreso ? `${progreso.completas} de ${progreso.lineas} líneas` : '—'}
          />
          <Dato rotulo="Emitida" valor={fechaLarga(orden.fecha_emision)} />
        </dl>

        {orden.comentarios && (
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            <b className="font-medium text-foreground">Comentarios de la orden:</b>{' '}
            {orden.comentarios}
          </p>
        )}
        {orden.cerrada_motivo && (
          <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            <b className="font-medium text-foreground">Cerrada con faltantes:</b>{' '}
            {orden.cerrada_motivo}
          </p>
        )}
      </div>

      {orden.conflicto === 'anulada_con_recepcion' && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] px-4 py-3 text-xs leading-relaxed">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <b className="font-semibold">Finanzas anuló esta orden, pero acá ya se recibió
            material.</b>{' '}
            No se tocó nada: lo que entró al stock sigue entrado. Hay que decidir a mano qué se hace
            —devolver, ajustar o dejarla cerrada— porque borrarla dejaría stock sin respaldo.
          </span>
        </div>
      )}

      {(progreso?.sinVincular ?? 0) > 0 && (
        <div className="rounded-lg border border-warning/35 bg-warning/[0.09] px-4 py-2.5 text-xs leading-relaxed">
          <b className="font-semibold">
            {progreso?.sinVincular} línea{progreso?.sinVincular === 1 ? '' : 's'} sin artículo.
          </b>{' '}
          Hay que decir a qué artículo del catálogo corresponde cada una antes de poder recibirla.
          Se hace una vez: la próxima orden de este proveedor las reconoce solas.
        </div>
      )}

      {/* ── Las líneas ── */}
      <TablaLineas
        lineas={orden.lineas ?? []}
        puedeEditar={puedeEditar}
        onVinculada={recargar}
      />
    </div>
  );
}

function TablaLineas({
  lineas,
  puedeEditar,
  onVinculada,
}: {
  lineas: LineaOrden[];
  puedeEditar: boolean;
  onVinculada: () => Promise<void>;
}) {
  if (lineas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Esta orden no trae líneas. Puede ser que Finanzas todavía no las tenga cargadas.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-4 text-left font-medium">#</th>
              <th className="h-9 px-3 text-left font-medium">Lo que dice la orden</th>
              <th className="h-9 px-3 text-left font-medium">Artículo nuestro</th>
              <th className="h-9 px-3 text-right font-medium">Pedido</th>
              <th className="h-9 px-3 text-right font-medium">Recibido</th>
              <th className="h-9 px-3 text-right font-medium">Falta</th>
              <th className="h-9 px-4 text-left font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const e = ESTADOS_LINEA_ORDEN[l.estado_linea] ?? {
                texto: l.estado_linea,
                variante: 'muted' as const,
              };
              const falta = pendienteDeLinea(l);
              return (
                <tr key={l.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{l.posicion}</td>
                  <td className="px-3 py-2.5">
                    <div>{l.descripcion || '—'}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[0.68rem] text-muted-foreground">
                      {l.codigo_interno && <span>interno {l.codigo_interno}</span>}
                      {l.codigo_proveedor && <span>proveedor {l.codigo_proveedor}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <VincularArticulo
                      linea={l}
                      puedeEditar={puedeEditar}
                      onVinculada={onVinculada}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="font-mono">{formatearCantidad(l.cantidad_pedida)}</div>
                    {l.factor > 1 && (
                      <div className="text-[0.68rem] text-muted-foreground">
                        {textoConversion(l.cantidad_pedida, l.factor, l.unidad)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatearCantidad(l.cantidad_recibida)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {falta > 0 ? formatearCantidad(falta) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={e.variante}>{e.texto}</Badge>
                    {l.nota && (
                      <div className="mt-1 text-[0.68rem] text-muted-foreground">{l.nota}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Dato({
  rotulo,
  valor,
  hint,
  mono,
}: {
  rotulo: string;
  valor?: string | null;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</dt>
      <dd className={mono ? 'font-mono' : undefined}>
        {valor || '—'}
        {hint && <span className="ml-1 text-[0.68rem] text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

function fechaLarga(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return '—';
  return new Date(t).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default FichaOrden;
