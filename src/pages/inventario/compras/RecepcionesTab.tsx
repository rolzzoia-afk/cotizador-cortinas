// Lo que llegó: cada papel escaneado, si falta contarlo, cómo salió el conteo
// y si Gerencia ya lo tiene.
//
// «Llegó una factura» es la puerta de entrada cuando el papel llega sin que
// nadie sepa de qué orden es: primero se busca la orden, después se escanea.

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileScan } from 'lucide-react';
import { ChipBusqueda, ChipFiltro, SeparadorChips } from '@/components/inventario/ChipsFiltro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatBox } from '@/components/ui/stat-box';
import type { OrdenCompra } from '@/modules/inventario/compras';
import {
  etiquetaDocumento,
  etiquetaEnvio,
  etiquetaEstadoRecepcion,
  etiquetaResultado,
  fechaHoraCL,
  rutaFichaRecepcion,
} from '@/modules/inventario/recepcion';
import { filtrarRecepciones, FILTROS_RECEPCIONES, type FiltroRecepciones } from '@/modules/inventario/recepcionLista';
import type { RecepcionResumen } from '@/modules/inventario/recepcionesLecturaStore';
import EscanearFacturaDialog from './EscanearFacturaDialog';
import LlegoFacturaDialog from './LlegoFacturaDialog';

export function RecepcionesTab({
  recepciones,
  ordenes,
  puedeEditar,
  esAdmin,
  queryRol,
}: {
  recepciones: RecepcionResumen[];
  ordenes: OrdenCompra[];
  puedeEditar: boolean;
  esAdmin: boolean;
  queryRol: string;
}) {
  const navigate = useNavigate();
  const hayPorContar = recepciones.some((r) => r.estado === 'por_contar');
  const [filtro, setFiltro] = useState<FiltroRecepciones>(hayPorContar ? 'por_contar' : 'todas');
  const [busqueda, setBusqueda] = useState('');
  const [eligiendo, setEligiendo] = useState(false);
  // `undefined` = cerrado; `null` = sin orden de compra.
  const [escaneando, setEscaneando] = useState<OrdenCompra | null | undefined>(undefined);

  const numeroDeOrden = useMemo(() => {
    const m = new Map(ordenes.map((o) => [o.id, o.numero]));
    return (id: string) => m.get(id);
  }, [ordenes]);

  const lista = useMemo(
    () => filtrarRecepciones(recepciones, filtro, busqueda, numeroDeOrden),
    [recepciones, filtro, busqueda, numeroDeOrden],
  );

  const cuenta = (f: FiltroRecepciones) => filtrarRecepciones(recepciones, f).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatBox rotulo="Por contar" valor={cuenta('por_contar')} tono={hayPorContar ? 'accent' : 'neutro'} />
        <StatBox rotulo="Contadas" valor={cuenta('contadas')} />
        <StatBox
          rotulo="Con diferencias"
          valor={cuenta('con_diferencias')}
          tono={cuenta('con_diferencias') > 0 ? 'warning' : 'neutro'}
          hint="o sin orden"
        />
        <StatBox
          rotulo="Sin llegar a Gerencia"
          valor={cuenta('sin_enviar')}
          tono={cuenta('sin_enviar') > 0 ? 'warning' : 'neutro'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipBusqueda
          valor={busqueda}
          onChange={setBusqueda}
          etiqueta="Buscar una recepción"
          placeholder="REC, folio, proveedor u orden…"
          ancho="w-[16rem]"
        />
        <SeparadorChips />
        {FILTROS_RECEPCIONES.map((f) => (
          <ChipFiltro key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </ChipFiltro>
        ))}
        {puedeEditar && (
          <Button className="ml-auto" onClick={() => setEligiendo(true)}>
            <FileScan className="h-4 w-4" /> Llegó una factura
          </Button>
        )}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-8 text-center text-sm text-muted-foreground">
          {recepciones.length === 0
            ? 'Todavía no se recibe nada. Cuando llegue una factura, «Llegó una factura» o «Recibir mercadería» en la orden.'
            : 'Nada con ese filtro.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="h-9 px-4 text-left font-medium">Recepción</th>
                  <th className="h-9 px-3 text-left font-medium">Papel</th>
                  <th className="h-9 px-3 text-left font-medium">Proveedor</th>
                  <th className="h-9 px-3 text-left font-medium">Orden</th>
                  <th className="h-9 px-3 text-left font-medium">Estado</th>
                  <th className="h-9 px-4 text-left font-medium">Gerencia</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const est = etiquetaEstadoRecepcion(r.estado);
                  const res = etiquetaResultado(r.resultado);
                  const env = etiquetaEnvio(r.envio_finanzas);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(rutaFichaRecepcion(r.id, queryRol))}
                      className="cursor-pointer border-b border-border align-top transition-colors last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to={rutaFichaRecepcion(r.id, queryRol)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono font-semibold hover:underline"
                        >
                          {r.numero}
                        </Link>
                        <div className="text-[0.68rem] text-muted-foreground">{fechaHoraCL(r.creada_en)}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[0.78rem]">{etiquetaDocumento(r.doc_tipo, r.doc_numero)}</td>
                      <td className="px-3 py-2.5">{r.proveedor_nombre || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-[0.78rem]">
                        {r.orden_id ? (numeroDeOrden(r.orden_id) ?? '…') : <span className="text-warning">sin orden</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {est && <Badge variant={est.variante}>{est.texto}</Badge>}
                          {res && <Badge variant={res.variante}>{res.texto}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{env ? <Badge variant={env.variante}>{env.texto}</Badge> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {eligiendo && (
        <LlegoFacturaDialog
          ordenes={ordenes}
          esAdmin={esAdmin}
          onCerrar={() => setEligiendo(false)}
          onElegir={(o) => {
            setEligiendo(false);
            setEscaneando(o);
          }}
        />
      )}
      {escaneando !== undefined && (
        <EscanearFacturaDialog
          orden={escaneando}
          onCerrar={() => setEscaneando(undefined)}
          onAbierta={(id, contarAhora) => {
            setEscaneando(undefined);
            navigate(rutaFichaRecepcion(id, queryRol, contarAhora));
          }}
        />
      )}
    </div>
  );
}

export default RecepcionesTab;
