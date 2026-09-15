// «¿A qué corresponde esta línea del papel?»
//
// Un desplegable con las líneas de la orden, más tres salidas: otro artículo
// del catálogo (llegó algo que la orden no pide), «no es inventario» (flete,
// despacho) y «no se sabe qué es». Debajo, POR QUÉ quedó emparejada así: lo
// que calzó por código se puede dejar; lo propuesto por la descripción hay
// que mirarlo.

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InputDecimal } from '@/components/ui/input-decimal';
import { cn } from '@/lib/utils';
import { formatearCantidad, pendienteDeLinea, type OrdenCompra } from '@/modules/inventario/compras';
import { motivoNoRecibible, TEXTO_EXCLUSION, TEXTO_VINCULO } from '@/modules/inventario/recepcion';
import type { ArticuloCatalogo } from '@/modules/inventario/recepcionCatalogo';
import type { LineaRevision } from '@/modules/inventario/recepcionFactura';
import { pareceTela } from '@/modules/inventario/recepcionTexto';
import BuscadorArticulo from './BuscadorArticulo';

const OTRO = '__otro';
const NO_INVENTARIO = '__no_inventario';
const NO_IDENTIFICADO = '__no_identificado';

function valorActual(l: LineaRevision): string {
  if (l.accion === 'excluir') return l.motivo_exclusion === 'no_identificado' ? NO_IDENTIFICADO : NO_INVENTARIO;
  if (l.orden_linea_id) return l.orden_linea_id;
  if (l.item_cod) return OTRO;
  return '';
}

export function EmparejarLineaFactura({
  linea,
  orden,
  catalogo,
  deshabilitado,
  onCambiar,
}: {
  linea: LineaRevision;
  orden: OrdenCompra | null;
  catalogo: ArticuloCatalogo[];
  deshabilitado?: boolean;
  onCambiar: (l: LineaRevision) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const lineasOrden = (orden?.lineas ?? []).filter((l) => l.estado_linea !== 'cancelada');
  const valor = valorActual(linea);

  const elegir = (v: string) => {
    if (v === OTRO) {
      setBuscando(true);
      return;
    }
    setBuscando(false);
    if (v === NO_INVENTARIO || v === NO_IDENTIFICADO) {
      onCambiar({
        ...linea,
        accion: 'excluir',
        motivo_exclusion: v === NO_IDENTIFICADO ? 'no_identificado' : 'no_inventario',
        orden_linea_id: null,
        vinculo: null,
        confianza: null,
      });
      return;
    }
    const ol = lineasOrden.find((l) => l.id === v);
    if (!ol) {
      onCambiar({ ...linea, accion: 'recibir', motivo_exclusion: null, orden_linea_id: null, dominio: null, item_cod: null, vinculo: null, confianza: null });
      return;
    }
    onCambiar({
      ...linea,
      accion: 'recibir',
      motivo_exclusion: null,
      orden_linea_id: ol.id,
      dominio: ol.dominio ?? null,
      item_cod: ol.item_cod ?? null,
      factor: ol.factor || 1,
      // Elegido por una persona: queda aprendido para la próxima factura.
      vinculo: 'manual',
      confianza: null,
    });
  };

  const olActual = linea.orden_linea_id ? lineasOrden.find((l) => l.id === linea.orden_linea_id) : null;
  const bloqueo = olActual ? motivoNoRecibible(olActual) : null;
  const suelto = linea.accion === 'recibir' && !linea.orden_linea_id && !!linea.item_cod;

  return (
    <div className="flex min-w-[14rem] flex-col gap-1">
      <select
        value={valor}
        onChange={(e) => elegir(e.target.value)}
        disabled={deshabilitado}
        aria-label={`A qué corresponde la línea ${linea.posicion}`}
        className={cn(
          'w-full rounded-md border bg-card px-2 py-1.5 text-[0.78rem]',
          valor === '' || bloqueo ? 'border-warning/70' : 'border-border',
        )}
      >
        <option value="">¿Cuál? Elige…</option>
        {lineasOrden.length > 0 && (
          <optgroup label={`Líneas de ${orden?.numero ?? 'la orden'}`}>
            {lineasOrden.map((l) => {
              const falta = pendienteDeLinea(l);
              return (
                <option key={l.id} value={l.id}>
                  {`#${l.posicion} · ${l.item_cod || l.codigo_interno || '¿?'} · ${(l.descripcion ?? '').slice(0, 40)}${
                    falta > 0 ? ` (faltan ${formatearCantidad(falta)})` : ' (completa)'
                  }${motivoNoRecibible(l) ? ' · sin artículo' : ''}`}
                </option>
              );
            })}
          </optgroup>
        )}
        <optgroup label="Otra cosa">
          <option value={OTRO}>
            {suelto ? `Artículo del catálogo: ${linea.item_cod}` : 'Otro artículo del catálogo…'}
          </option>
          <option value={NO_INVENTARIO}>{TEXTO_EXCLUSION.no_inventario} (flete, despacho…)</option>
          <option value={NO_IDENTIFICADO}>{TEXTO_EXCLUSION.no_identificado}</option>
        </optgroup>
      </select>

      {buscando && (
        <BuscadorArticulo
          catalogo={catalogo}
          inicial={linea.codigo || linea.descripcion}
          dominioPreferido={pareceTela(linea.descripcion) ? 'tela' : 'insumo'}
          onCancelar={() => setBuscando(false)}
          onElegir={(a) => {
            setBuscando(false);
            onCambiar({
              ...linea,
              accion: 'recibir',
              motivo_exclusion: null,
              orden_linea_id: null,
              dominio: a.dominio,
              item_cod: a.cod,
              factor: 1,
              vinculo: 'manual',
              confianza: null,
            });
          }}
        />
      )}

      {/* Por qué quedó así */}
      {linea.accion === 'recibir' && linea.vinculo && (
        <div className="flex flex-wrap items-center gap-1 text-[0.68rem] text-muted-foreground">
          {linea.vinculo === 'descripcion' ? (
            <Badge variant="warning">
              propuesta por la descripción{linea.confianza != null ? ` (${Math.round(linea.confianza * 100)} %)` : ''}: revísala
            </Badge>
          ) : (
            <span>{TEXTO_VINCULO[linea.vinculo]}</span>
          )}
        </div>
      )}
      {bloqueo && <p className="text-[0.68rem] text-warning">{bloqueo}</p>}
      {linea.duplicada && (
        <p className="text-[0.68rem] text-muted-foreground">Otra línea del papel va a la misma de la orden: se suman.</p>
      )}
      {suelto && orden && (
        <p className="flex items-start gap-1 text-[0.68rem] text-warning">
          <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
          La orden no pide {linea.item_cod}: entra igual y se le avisa a Gerencia.
        </p>
      )}
      {suelto && (
        <label className="flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
          Unidades nuestras por cada una del papel
          <InputDecimal
            value={linea.factor}
            onChange={(v) => onCambiar({ ...linea, factor: v > 0 ? v : 1 })}
            disabled={deshabilitado}
            className="h-7 w-16 px-1.5 text-center text-[0.72rem]"
          />
        </label>
      )}
    </div>
  );
}

export default EmparejarLineaFactura;
