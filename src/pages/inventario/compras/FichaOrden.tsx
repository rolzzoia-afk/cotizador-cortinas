// La ficha de una orden de compra: qué trae, qué llegó y qué falta.
//
// Es la pantalla que se abre con el papel en la mano. Lo importante de acá es
// la columna «Artículo nuestro»: la orden habla en códigos de Finanzas y del
// proveedor, y el kardex habla en códigos del catálogo. Casi todas las líneas
// se vinculan solas por el código interno; la que no, se resuelve UNA vez y
// queda aprendida para la próxima orden del mismo proveedor.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PackageCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { esRolAdmin } from '@/lib/roles';
import { etiquetaOrden, progresoDeOrden, textoEspera } from '@/modules/inventario/compras';
import { cerrarOrden, useOrdenesCompra } from '@/modules/inventario/comprasStore';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { lineasPorRecibir, motivoNoRecibible, rutaFichaRecepcion } from '@/modules/inventario/recepcion';
import { useRecepcionesDeOrden } from '@/modules/inventario/recepcionesLecturaStore';
import { useInventario } from '../InventarioLayout';
import EscanearFacturaDialog from './EscanearFacturaDialog';
import HistorialRecepciones from './HistorialRecepciones';
import TablaLineasOrden from './TablaLineasOrden';

export function FichaOrden() {
  const { id } = useParams<{ id: string }>();
  const { queryRol, puedeEditar, rol } = useInventario();
  const { flags } = useFlagsInventario();
  const { ordenes, loading, error, recargar } = useOrdenesCompra(flags.compras);
  const recepciones = useRecepcionesDeOrden(id);
  const navigate = useNavigate();
  const [cerrando, setCerrando] = useState(false);
  const [recibiendo, setRecibiendo] = useState(false);

  const orden = useMemo(() => ordenes.find((o) => o.id === id), [ordenes, id]);
  const progreso = useMemo(() => (orden ? progresoDeOrden(orden) : null), [orden]);
  // Las que se pueden recibir de verdad: con algo pendiente Y con artículo.
  const recibibles = useMemo(
    () => (orden ? lineasPorRecibir(orden).filter((l) => !motivoNoRecibible(l)).length : 0),
    [orden],
  );
  const esAdmin = esRolAdmin(rol);
  const porContar = recepciones.recepciones.filter((r) => r.estado === 'por_contar');

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
              <Button
                onClick={() => setRecibiendo(true)}
                disabled={recibibles === 0}
                title={
                  recibibles === 0
                    ? 'Las líneas que faltan no tienen artículo: vincúlalas primero'
                    : undefined
                }
              >
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

      {porContar.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-accent/40 bg-accent/[0.07] px-4 py-2.5 text-xs leading-relaxed">
          <b className="font-semibold">Hay papeles escaneados que falta contar:</b>
          {porContar.map((r) => (
            <Link key={r.id} to={rutaFichaRecepcion(r.id, queryRol)} className="font-mono underline underline-offset-2">
              {r.numero}
            </Link>
          ))}
          <span className="text-muted-foreground">Hasta contarlos y firmar, no entra nada al stock.</span>
        </div>
      )}

      {/* ── Las líneas ── */}
      <TablaLineasOrden lineas={orden.lineas ?? []} puedeEditar={puedeEditar} onVinculada={recargar} />

      <HistorialRecepciones
        recepciones={recepciones.recepciones}
        loading={recepciones.loading}
        error={recepciones.error}
        queryRol={queryRol}
      />

      {recibiendo && (
        <EscanearFacturaDialog
          orden={orden}
          onCerrar={() => setRecibiendo(false)}
          onAbierta={(recepcionId, contarAhora) => {
            setRecibiendo(false);
            navigate(rutaFichaRecepcion(recepcionId, queryRol, contarAhora));
          }}
        />
      )}
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
