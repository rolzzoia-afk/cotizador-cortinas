// Las solicitudes de reposición: lo que bodega le pide a Gerencia.
//
// La de arriba es la que se está armando. Se le suman líneas desde Alertas, el
// catálogo o la ficha de un artículo, se revisa acá y se manda. Debajo va el
// historial, para saber qué pasó con lo que se pidió antes.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { formatearCantidad } from '@/modules/inventario/compras';
import {
  agruparPorProveedor,
  etiquetaSolicitud,
  type Solicitud,
} from '@/modules/inventario/comprasSolicitud';
import {
  cancelarSolicitud,
  enviarSolicitud,
  quitarLineaSolicitud,
} from '@/modules/inventario/comprasStore';

export function SolicitudesTab({
  solicitudes,
  puedeEditar,
  queryRol,
  onCambio,
}: {
  solicitudes: Solicitud[];
  puedeEditar: boolean;
  queryRol: string;
  onCambio: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);

  const abierta = useMemo(() => solicitudes.find((s) => s.estado === 'borrador'), [solicitudes]);
  const historial = useMemo(
    () => solicitudes.filter((s) => s.estado !== 'borrador'),
    [solicitudes],
  );

  const mandar = async () => {
    if (!abierta) return;
    const lineas = abierta.lineas ?? [];
    const grupos = agruparPorProveedor(lineas);
    const ok = await confirmar({
      titulo: `Mandar ${abierta.numero} a Gerencia`,
      // Que Gerencia va a emitir UNA orden por proveedor no es obvio: quien
      // manda 12 líneas de 4 proveedores tiene que saber que van a volver 4
      // órdenes distintas, en 4 momentos distintos.
      mensaje:
        `${lineas.length} ${lineas.length === 1 ? 'artículo' : 'artículos'} de ` +
        `${grupos.length} ${grupos.length === 1 ? 'proveedor' : 'proveedores'}. ` +
        `Gerencia arma una orden de compra por proveedor, así que puede volver en ${grupos.length} ` +
        `${grupos.length === 1 ? 'orden' : 'órdenes'} separadas.\n\n` +
        'Después de mandarla ya no se le pueden sacar líneas.',
      confirmLabel: 'Mandar a Gerencia',
    });
    if (!ok) return;
    setEnviando(true);
    try {
      const r = await enviarSolicitud(abierta.id);
      toast.success(`${r.numero} está con Gerencia: ${r.lineas} artículos.`, {
        // Con destino local hay que decir DÓNDE la ve Gerencia: si no, bodega
        // se queda esperando que alguien reciba algo que nadie va a recibir.
        description: r.destino === 'local' ? r.aviso : undefined,
      });
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      await onCambio();
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async (lineaId: string, nombre: string) => {
    setQuitando(lineaId);
    try {
      const r = await quitarLineaSolicitud(lineaId);
      toast.success(r.borrada ? 'La solicitud quedó vacía y se cerró.' : `${nombre} fuera del pedido.`);
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setQuitando(null);
    }
  };

  const cancelar = async () => {
    if (!abierta) return;
    const ok = await confirmar({
      titulo: `Cancelar ${abierta.numero}`,
      mensaje: 'Se descarta el pedido completo. Los artículos se pueden volver a marcar en Alertas.',
      confirmLabel: 'Cancelar el pedido',
      destructivo: true,
    });
    if (!ok) return;
    try {
      await cancelarSolicitud(abierta.id);
      toast.success('Pedido cancelado.');
      await onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* ── La que se está armando ── */}
      {abierta ? (
        <div className="overflow-hidden rounded-lg border border-accent/40 bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="font-serif text-[0.9375rem] font-medium">
              {abierta.numero} · armando
            </h2>
            <span className="text-xs text-muted-foreground">
              {(abierta.lineas ?? []).length} artículo
              {(abierta.lineas ?? []).length === 1 ? '' : 's'}
            </span>
            {puedeEditar && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => void cancelar()}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[0.72rem] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Descartar
                </button>
                <Button onClick={() => void mandar()} disabled={enviando}>
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Mandar a Gerencia
                </Button>
              </div>
            )}
          </div>

          {abierta.error_envio && (
            <div className="flex items-start gap-2 border-b border-border bg-destructive/[0.08] px-4 py-2.5 text-xs leading-relaxed">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>
                <b className="font-semibold">No se pudo mandar.</b> {abierta.error_envio} El pedido
                quedó guardado: se puede volver a intentar.
              </span>
            </div>
          )}

          {(abierta.lineas ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              El pedido está vacío. Se le suman artículos desde Alertas o desde la ficha de cada uno.
            </div>
          ) : (
            agruparPorProveedor(abierta.lineas ?? []).map((g) => (
              <div key={g.proveedor}>
                <div className="border-b border-border bg-secondary/40 px-4 py-1 text-[0.68rem] uppercase tracking-[0.08em] text-muted-foreground">
                  {g.proveedor} · {g.lineas.length}
                </div>
                <table className="w-full text-[0.8125rem]">
                  <tbody>
                    {g.lineas.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">
                          <span className="font-mono font-medium">{l.item_cod}</span>
                          {l.dominio === 'tela' && (
                            <Badge variant="muted" className="ml-2">
                              tela
                            </Badge>
                          )}
                          <div className="text-[0.72rem] text-muted-foreground">
                            {l.nombre || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[0.72rem] text-muted-foreground">
                          {l.motivo === 'bajo_minimo' ? (
                            <>
                              bajo el mínimo
                              {l.stock_al_pedir != null && l.minimo_al_pedir != null && (
                                <> · había {formatearCantidad(l.stock_al_pedir)} de {formatearCantidad(l.minimo_al_pedir)}</>
                              )}
                            </>
                          ) : (
                            'pedido a mano'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatearCantidad(l.cantidad)}{' '}
                          <span className="text-[0.72rem] text-muted-foreground">
                            {l.unidad || 'un'}
                          </span>
                        </td>
                        <td className="w-10 px-3 py-2 text-right">
                          {puedeEditar && (
                            <button
                              onClick={() => void quitar(l.id, l.item_cod)}
                              disabled={quitando === l.id}
                              aria-label={`Sacar ${l.item_cod} del pedido`}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              {quitando === l.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay ningún pedido armándose.{' '}
          <Link to={`/inventario/alertas${queryRol}`} className="text-accent hover:underline">
            Ir a Alertas
          </Link>{' '}
          para marcar lo que falta.
        </div>
      )}

      {/* ── Lo que ya se mandó ── */}
      {historial.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <h2 className="px-4 py-3 font-serif text-[0.9375rem] font-medium">
            Pedidos anteriores
          </h2>
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="h-9 px-4 text-left font-medium">Número</th>
                <th className="h-9 px-3 text-left font-medium">Mandado</th>
                <th className="h-9 px-3 text-right font-medium">Artículos</th>
                <th className="h-9 px-3 text-left font-medium">En qué quedó</th>
                <th className="h-9 px-4 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((s) => {
                const est = etiquetaSolicitud(s.estado);
                const ocs = [
                  ...new Set((s.lineas ?? []).map((l) => l.oc_numero).filter(Boolean)),
                ] as string[];
                return (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-mono font-medium">{s.numero}</td>
                    <td className="px-3 py-2 font-mono text-[0.72rem] text-muted-foreground">
                      {s.enviada_en ? new Date(s.enviada_en).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{(s.lineas ?? []).length}</td>
                    <td className="px-3 py-2 text-[0.72rem] text-muted-foreground">
                      {s.motivo_rechazo
                        ? s.motivo_rechazo
                        : ocs.length > 0
                          ? `Órdenes ${ocs.join(' · ')}`
                          : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={est.variante}>{est.texto}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SolicitudesTab;
