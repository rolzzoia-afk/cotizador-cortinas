// La ficha de una recepción: el papel, a qué orden fue, qué se contó, quién
// firmó y dónde, qué no calzó, y si Gerencia ya lo tiene.
//
// Por contar → «Contar» (o «Descartar», con motivo). Contada → las
// diferencias, la firma con su ubicación y, si no llegó a Gerencia,
// «Reenviar». Con `?contar=1` abre el conteo sola: es el «Contar ahora».

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, FileImage, Loader2, MapPin, PenLine, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { useOrdenesCompra } from '@/modules/inventario/comprasStore';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import {
  etiquetaDocumento,
  etiquetaEnvio,
  etiquetaEstadoRecepcion,
  etiquetaResultado,
  fechaHoraCL,
} from '@/modules/inventario/recepcion';
import { useRecepcion } from '@/modules/inventario/recepcionesLecturaStore';
import {
  cancelarRecepcion,
  enviarRecepcionFinanzas,
  firmaDeRecepcion,
  urlFirmadaDocumento,
} from '@/modules/inventario/recepcionStore';
import { formatoGeo, urlMapaGeo } from '@/modules/visita/geo';
import { useInventario } from '../InventarioLayout';
import ContarRecepcionDialog from './ContarRecepcionDialog';
import ResumenDiferencias from './ResumenDiferencias';
import TablaLineasRecepcion from './TablaLineasRecepcion';

export function FichaRecepcion() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { queryRol, puedeEditar } = useInventario();
  const { flags } = useFlagsInventario();
  const ordenes = useOrdenesCompra(flags.compras);
  const { recepcion: rec, loading, error, recargar } = useRecepcion(id);
  const [contando, setContando] = useState(false);
  const [ocupado, setOcupado] = useState<'' | 'descartar' | 'enviar' | 'papel' | 'firma'>('');
  const [firma, setFirma] = useState<string | null>(null);

  const orden = useMemo(
    () => (rec?.orden_id ? (ordenes.ordenes.find((o) => o.id === rec.orden_id) ?? null) : null),
    [ordenes.ordenes, rec?.orden_id],
  );

  // «Contar ahora»: se abre sola, una vez, cuando ya están la recepción y la orden.
  useEffect(() => {
    if (params.get('contar') !== '1' || !rec || ordenes.loading) return;
    if (rec.estado === 'por_contar' && puedeEditar) setContando(true);
    const p = new URLSearchParams(params);
    p.delete('contar');
    setParams(p, { replace: true });
  }, [params, rec, ordenes.loading, puedeEditar, setParams]);

  const volver = `/inventario/compras${queryRol}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !rec) {
    return (
      <div className="flex flex-col gap-3">
        <Link to={volver} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Compras
        </Link>
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error || 'Esa recepción no existe o no es de esta empresa.'}
        </div>
      </div>
    );
  }

  const est = etiquetaEstadoRecepcion(rec.estado);
  const res = etiquetaResultado(rec.resultado);
  const env = etiquetaEnvio(rec.envio_finanzas);
  const contada = rec.estado === 'contada';

  const descartar = async () => {
    const ok = await confirmar({
      titulo: `Descartar ${rec.numero}`,
      mensaje:
        'Se descarta sin contar: no entra nada al stock y el mismo papel se puede volver a escanear. ' +
        'El archivo queda guardado como respaldo.',
      confirmLabel: 'Descartar',
      destructivo: true,
    });
    if (!ok) return;
    const motivo = window.prompt('¿Por qué se descarta? (queda escrito)');
    if (!motivo || !motivo.trim()) {
      toast.warning('Sin motivo no se descarta.');
      return;
    }
    setOcupado('descartar');
    try {
      await cancelarRecepcion(rec.id, motivo.trim());
      toast.success(`${rec.numero} descartada.`);
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado('');
    }
  };

  const reenviar = async () => {
    setOcupado('enviar');
    try {
      await enviarRecepcionFinanzas(rec.id);
      toast.success('Se le mandó a Gerencia.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado('');
      await recargar();
    }
  };

  const verPapel = async () => {
    setOcupado('papel');
    const url = await urlFirmadaDocumento(rec.doc_path);
    setOcupado('');
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('No se pudo abrir el papel.');
  };

  const verFirma = async () => {
    if (firma) {
      setFirma(null);
      return;
    }
    setOcupado('firma');
    try {
      setFirma(await firmaDeRecepcion(rec.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Link to={volver} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Compras
      </Link>

      {/* ── Cabecera ── */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold">{rec.numero}</h1>
              {est && <Badge variant={est.variante}>{est.texto}</Badge>}
              {res && <Badge variant={res.variante}>{res.texto}</Badge>}
              {env && <Badge variant={env.variante}>{env.texto}</Badge>}
            </div>
            <div className="mt-1 font-mono text-sm">{etiquetaDocumento(rec.doc_tipo, rec.doc_numero)}</div>
            <div className="text-sm">
              {rec.proveedor_nombre || 'Sin proveedor'}
              {rec.proveedor_rut && <span className="ml-2 font-mono text-[0.72rem] text-muted-foreground">{rec.proveedor_rut}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => void verPapel()} disabled={ocupado !== ''}>
              <FileImage className="h-4 w-4" /> Ver el papel
            </Button>
            {rec.estado === 'por_contar' && puedeEditar && (
              <>
                <Button onClick={() => setContando(true)} disabled={ordenes.loading}>
                  <ClipboardCheck className="h-4 w-4" /> Contar
                </Button>
                <Button variant="ghost" onClick={() => void descartar()} disabled={ocupado !== ''}>
                  <Trash2 className="h-4 w-4" /> Descartar
                </Button>
              </>
            )}
            {contada && rec.envio_finanzas !== 'enviada' && puedeEditar && (
              <Button onClick={() => void reenviar()} disabled={ocupado !== ''}>
                {ocupado === 'enviar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {rec.envio_finanzas === 'error' ? 'Reenviar a Gerencia' : 'Mandar a Gerencia'}
              </Button>
            )}
          </div>
        </div>

        <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-[0.78rem] md:grid-cols-4">
          <Dato rotulo="Orden de compra">
            {orden ? (
              <Link to={`/inventario/compras/${orden.id}${queryRol}`} className="font-mono underline underline-offset-2">
                {orden.numero}
              </Link>
            ) : rec.orden_id ? (
              '…'
            ) : (
              <span className="text-warning">sin orden</span>
            )}
          </Dato>
          <Dato rotulo="Fecha del papel">{fechaHoraCL(rec.doc_fecha, false)}</Dato>
          <Dato rotulo="Escaneada">
            {fechaHoraCL(rec.creada_en)}
            {rec.escaneada_por && <div className="text-[0.68rem] text-muted-foreground">{rec.escaneada_por}</div>}
          </Dato>
          <Dato rotulo="Contada">
            {fechaHoraCL(rec.contada_en)}
            {rec.contada_por && <div className="text-[0.68rem] text-muted-foreground">{rec.contada_por}</div>}
          </Dato>
        </dl>

        {rec.estado === 'cancelada' && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            <b className="font-medium text-foreground">Descartada</b> el {fechaHoraCL(rec.cancelada_en)} por{' '}
            {rec.cancelada_por || '—'}: {rec.cancelada_motivo}
          </p>
        )}
        {rec.escaneo_error && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Sin lectura automática: {rec.escaneo_error}
          </p>
        )}
        {rec.envio_finanzas === 'error' && rec.envio_finanzas_detalle && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-destructive">
            No llegó a Gerencia ({rec.envio_finanzas_intentos} {rec.envio_finanzas_intentos === 1 ? 'intento' : 'intentos'}):{' '}
            {rec.envio_finanzas_detalle}
          </p>
        )}
      </div>

      {contada && (
        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">Lo que no calzó</h2>
          <ResumenDiferencias diferencias={rec.diferencias} />
        </section>
      )}

      <TablaLineasRecepcion lineas={rec.lineas} lineasOrden={orden?.lineas ?? []} contada={contada} />

      {contada && (
        <section className="rounded-lg border border-border bg-card p-4 text-[0.8125rem]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              Recibió <b className="font-medium">{rec.recibe_nombre}</b> el {fechaHoraCL(rec.contada_en)}
            </span>
            {rec.firma_geo ? (
              <a
                href={urlMapaGeo(rec.firma_geo)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
              >
                <MapPin className="h-3.5 w-3.5" /> {formatoGeo(rec.firma_geo)}
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Sin ubicación: {rec.firma_geo_motivo || 'no se registró'}
              </span>
            )}
            <button
              onClick={() => void verFirma()}
              disabled={ocupado !== ''}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary"
            >
              <PenLine className="h-3.5 w-3.5" /> {firma ? 'Ocultar firma' : 'Ver firma'}
            </button>
          </div>
          {rec.notas && <p className="mt-2 text-xs text-muted-foreground">Notas: {rec.notas}</p>}
          {firma && (
            <img src={firma} alt={`Firma de ${rec.recibe_nombre}`} className="mt-2.5 h-28 rounded-md border border-border bg-white object-contain" />
          )}
        </section>
      )}

      {contando && (
        <ContarRecepcionDialog
          recepcion={rec}
          orden={orden}
          onCerrar={() => setContando(false)}
          onContada={async () => {
            setContando(false);
            await Promise.all([recargar(), ordenes.recargar()]);
          }}
        />
      )}
    </div>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.68rem] uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default FichaRecepcion;
