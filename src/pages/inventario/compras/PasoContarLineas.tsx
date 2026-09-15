// Contar a mano lo que llegó, línea por línea.
//
// Tres números por línea, en la unidad de la ORDEN: lo que faltaba de la orden
// (PEDIDO), lo que dice el papel (FACTURADO, corregible) y lo que se contó,
// BUENO y DAÑADO. Lo dañado no entra al stock. Si algo está mal, una foto y
// una nota: es lo que Gerencia va a ver.
//
// Lo normal es que llegue todo: un botón copia lo facturado y se corrige lo
// raro. Lo que llegó sin estar en el papel se agrega abajo.

import { useState } from 'react';
import { Camera, Loader2, PackageCheck, Plus, StickyNote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { formatearCantidad, pendienteDeLinea, type OrdenCompra } from '@/modules/inventario/compras';
import {
  llegoTodoLoFacturado,
  motivoNoRecibible,
  TEXTO_EXCLUSION,
  unidadesQueEntran,
  type LineaConteo,
} from '@/modules/inventario/recepcion';
import type { ArticuloCatalogo } from '@/modules/inventario/recepcionCatalogo';
import { subirFotoLinea } from '@/modules/inventario/recepcionStore';
import BuscadorArticulo from './BuscadorArticulo';

export function PasoContarLineas({
  lineas,
  orden,
  catalogo,
  recepcionId,
  deshabilitado,
  onCambiar,
}: {
  lineas: LineaConteo[];
  orden: OrdenCompra | null;
  catalogo: ArticuloCatalogo[];
  recepcionId: string;
  deshabilitado?: boolean;
  onCambiar: (l: LineaConteo[]) => void;
}) {
  const { empresaId } = useAuth();
  const [agregando, setAgregando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [conNota, setConNota] = useState<Set<string>>(new Set());
  const porId = new Map((orden?.lineas ?? []).map((l) => [l.id, l]));

  const cambiar = (id: string, cambio: Partial<LineaConteo>) =>
    onCambiar(lineas.map((l) => (l.id === id ? { ...l, ...cambio } : l)));

  const agregarNueva = (base: Pick<LineaConteo, 'orden_linea_id' | 'dominio' | 'item_cod' | 'factor' | 'fact_descripcion'>) => {
    const pos = Math.max(0, ...lineas.map((l) => l.posicion)) + 1;
    onCambiar([
      ...lineas,
      {
        ...base,
        id: `nueva-${Date.now()}`,
        nueva: true,
        posicion: pos,
        origen: 'manual',
        fact_codigo: null,
        fact_cantidad: 0,
        vinculo: 'manual',
        accion: 'recibir',
        motivo_exclusion: null,
        cantidad_buena: 0,
        cantidad_danada: 0,
        nota: null,
        fotos: [],
      },
    ]);
    setAgregando(false);
    setBuscando(false);
  };

  const subirFoto = async (id: string, archivo: File | null) => {
    if (!archivo || !empresaId) return;
    setSubiendo(id);
    try {
      const path = await subirFotoLinea(empresaId, recepcionId, archivo);
      const l = lineas.find((x) => x.id === id);
      if (l) cambiar(id, { fotos: [...l.fotos, path] });
      setConNota((s) => new Set(s).add(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
          En la unidad de la orden. Lo <b className="font-medium text-foreground">dañado</b> no entra al stock y la
          orden lo sigue esperando. Si algo no calza, saca una foto: la ve Gerencia.
        </p>
        <Button variant="outline" size="sm" onClick={() => onCambiar(llegoTodoLoFacturado(lineas))} disabled={deshabilitado}>
          <PackageCheck className="h-4 w-4" /> Llegó todo lo facturado
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[780px] text-[0.8125rem]">
          <thead>
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-9 px-3 text-left font-medium">Línea</th>
              <th className="h-9 w-[76px] px-2 text-right font-medium">Pedido</th>
              <th className="h-9 w-[96px] px-2 text-center font-medium">Facturado</th>
              <th className="h-9 w-[96px] px-2 text-center font-medium">Bueno</th>
              <th className="h-9 w-[96px] px-2 text-center font-medium">Dañado</th>
              <th className="h-9 w-[92px] px-2 text-right font-medium">Entra</th>
              <th className="h-9 w-[84px] px-2" />
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const ol = l.orden_linea_id ? porId.get(l.orden_linea_id) : undefined;
              const excluida = l.accion === 'excluir';
              const fact = Number(l.fact_cantidad ?? 0);
              const contado = l.cantidad_buena + l.cantidad_danada;
              const calza = excluida || (l.origen === 'factura' ? Math.abs(contado - fact) < 1e-9 : contado === 0);
              const entra = unidadesQueEntran(l);
              const verNota = conNota.has(l.id) || !!l.nota || l.fotos.length > 0 || l.cantidad_danada > 0;
              return (
                <tr key={l.id} className={cn('border-b border-border align-top last:border-0', excluida && 'bg-secondary/30 text-muted-foreground')}>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[0.72rem] text-muted-foreground">{l.posicion}</span>
                      <span className="font-mono font-medium">{l.item_cod || l.fact_codigo || '—'}</span>
                      {l.origen === 'manual' && <Badge variant="warning">sin facturar</Badge>}
                      {excluida && <Badge variant="muted">{TEXTO_EXCLUSION[l.motivo_exclusion ?? 'otro']}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{l.fact_descripcion || ol?.descripcion || '—'}</div>
                    {!excluida && orden && !l.orden_linea_id && (
                      <div className="text-[0.68rem] text-warning">La orden no pide este artículo.</div>
                    )}
                    {verNota && !excluida && (
                      <Input
                        value={l.nota ?? ''}
                        onChange={(e) => cambiar(l.id, { nota: e.target.value })}
                        disabled={deshabilitado}
                        placeholder="Qué pasó (caja rota, otro color…)"
                        className="mt-1.5 h-7 text-[0.72rem]"
                      />
                    )}
                    {l.fotos.length > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
                        {l.fotos.length === 1 ? '1 foto' : `${l.fotos.length} fotos`} ·
                        <button type="button" className="underline" onClick={() => cambiar(l.id, { fotos: l.fotos.slice(0, -1) })}>
                          quitar la última
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">
                    {ol ? formatearCantidad(pendienteDeLinea(ol)) : '—'}
                    {ol?.unidad && <div className="font-sans text-[0.66rem] text-muted-foreground">{ol.unidad}</div>}
                  </td>
                  <td className="px-2 py-1.5">
                    {l.origen === 'manual' ? (
                      <div className="pt-1.5 text-center font-mono text-muted-foreground">0</div>
                    ) : (
                      <InputDecimal
                        value={fact}
                        onChange={(v) => cambiar(l.id, { fact_cantidad: v >= 0 ? v : 0 })}
                        disabled={deshabilitado || excluida}
                        aria-label={`Facturado de la línea ${l.posicion}`}
                        className="mx-auto h-8 w-[80px] px-2 text-center font-mono text-[0.78rem]"
                      />
                    )}
                  </td>
                  {(['cantidad_buena', 'cantidad_danada'] as const).map((campo) => (
                    <td key={campo} className="px-2 py-1.5">
                      <InputDecimal
                        value={l[campo]}
                        onChange={(v) => cambiar(l.id, { [campo]: v > 0 ? v : 0 })}
                        disabled={deshabilitado || excluida}
                        aria-label={`${campo === 'cantidad_buena' ? 'Bueno' : 'Dañado'} de la línea ${l.posicion}`}
                        className={cn(
                          'mx-auto h-8 w-[80px] px-2 text-center font-mono text-[0.78rem]',
                          !calza && 'border-warning/70',
                          campo === 'cantidad_danada' && l.cantidad_danada > 0 && 'border-destructive/60',
                        )}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-mono">
                    {entra > 0 ? (
                      <>
                        +{formatearCantidad(entra)}
                        <span className="ml-1 font-sans text-[0.66rem] text-muted-foreground">{l.dominio === 'tela' ? 'm' : 'un'}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      {!excluida && (
                        <>
                          <label
                            title="Sacar una foto del problema"
                            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            {subiendo === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="sr-only"
                              disabled={deshabilitado || subiendo !== null}
                              onChange={(e) => void subirFoto(l.id, e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <button
                            type="button"
                            title="Agregar una nota"
                            onClick={() => setConNota((s) => new Set(s).add(l.id))}
                            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {l.nueva && (
                        <button
                          type="button"
                          title="Quitar"
                          onClick={() => onCambiar(lineas.filter((x) => x.id !== l.id))}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!agregando ? (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          disabled={deshabilitado}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[0.78rem] text-muted-foreground hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar algo que llegó sin estar en el papel
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="text-xs font-medium">¿Qué llegó sin facturar?</div>
          <div className="flex flex-wrap gap-1.5">
            {(orden?.lineas ?? [])
              .filter((ol) => ol.estado_linea !== 'cancelada' && !motivoNoRecibible(ol))
              .map((ol) => (
                <button
                  key={ol.id}
                  type="button"
                  onClick={() =>
                    agregarNueva({
                      orden_linea_id: ol.id,
                      dominio: ol.dominio ?? null,
                      item_cod: ol.item_cod ?? null,
                      factor: ol.factor || 1,
                      fact_descripcion: ol.descripcion ?? null,
                    })
                  }
                  className="rounded-full border border-border px-2.5 py-1 text-[0.74rem] hover:bg-secondary"
                >
                  <span className="font-mono">{ol.item_cod}</span> · {(ol.descripcion ?? '').slice(0, 32)}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setBuscando(true)}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-[0.74rem] text-muted-foreground hover:bg-secondary"
            >
              Otro artículo del catálogo…
            </button>
            <button type="button" onClick={() => setAgregando(false)} className="px-2 text-[0.74rem] text-muted-foreground underline">
              Cancelar
            </button>
          </div>
          {buscando && (
            <BuscadorArticulo
              catalogo={catalogo}
              onCancelar={() => setBuscando(false)}
              onElegir={(a) =>
                agregarNueva({ orden_linea_id: null, dominio: a.dominio, item_cod: a.cod, factor: 1, fact_descripcion: a.nombre })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

export default PasoContarLineas;
