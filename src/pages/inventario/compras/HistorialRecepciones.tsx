// Los papeles que llegaron para una orden: cada recepción con su estado, cómo
// salió el conteo y si Gerencia ya la tiene. El detalle —líneas, firma,
// ubicación, diferencias— está en la ficha de cada una.
//
// Es la respuesta a «¿esto ya llegó?» sin abrir el kardex.

import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatearCantidad } from '@/modules/inventario/compras';
import {
  etiquetaDocumento,
  etiquetaEnvio,
  etiquetaEstadoRecepcion,
  etiquetaResultado,
  fechaHoraCL,
  rutaFichaRecepcion,
} from '@/modules/inventario/recepcion';
import type { RecepcionResumen } from '@/modules/inventario/recepcionesLecturaStore';

export function HistorialRecepciones({
  recepciones,
  loading,
  error,
  queryRol,
}: {
  recepciones: RecepcionResumen[];
  loading: boolean;
  error: string | null;
  queryRol: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo lo recibido…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-2.5 text-xs">{error}</div>
    );
  }
  if (recepciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
        Lo que llegó · {recepciones.length === 1 ? '1 papel' : `${recepciones.length} papeles`}
      </h2>
      {recepciones.map((r) => {
        const est = etiquetaEstadoRecepcion(r.estado);
        const res = etiquetaResultado(r.resultado);
        const env = etiquetaEnvio(r.envio_finanzas);
        return (
          <Link
            key={r.id}
            to={rutaFichaRecepcion(r.id, queryRol)}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-accent"
          >
            <span className="font-mono text-sm font-semibold">{r.numero}</span>
            <span className="font-mono text-[0.8125rem]">{etiquetaDocumento(r.doc_tipo, r.doc_numero)}</span>
            {est && <Badge variant={est.variante}>{est.texto}</Badge>}
            {res && <Badge variant={res.variante}>{res.texto}</Badge>}
            {env && r.estado === 'contada' && <Badge variant={env.variante}>{env.texto}</Badge>}
            <span className="text-xs text-muted-foreground">
              {r.estado === 'contada'
                ? `${fechaHoraCL(r.contada_en)} · recibió ${r.recibe_nombre ?? '—'}` +
                  (r.unidades_ingresadas > 0 ? ` · entraron ${formatearCantidad(r.unidades_ingresadas)}` : '')
                : `escaneada ${fechaHoraCL(r.creada_en)}`}
            </span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </Link>
        );
      })}
    </div>
  );
}

export default HistorialRecepciones;
