// ─────────────────────────────────────────────────────────────────────
// La lista de recepciones (pestaña «Lo que llegó»): los chips y el buscador.
// ─────────────────────────────────────────────────────────────────────

import { normalizarNumeroDocumento } from './recepcion';

export type FiltroRecepciones = 'por_contar' | 'contadas' | 'con_diferencias' | 'sin_enviar' | 'todas';

export const FILTROS_RECEPCIONES: ReadonlyArray<{ id: FiltroRecepciones; texto: string }> = [
  { id: 'por_contar', texto: 'Por contar' },
  { id: 'contadas', texto: 'Contadas' },
  { id: 'con_diferencias', texto: 'Con diferencias' },
  { id: 'sin_enviar', texto: 'Sin llegar a Gerencia' },
  { id: 'todas', texto: 'Todas' },
];

type RecepcionFiltrable = {
  numero: string;
  estado: string;
  resultado: string | null;
  envio_finanzas: string | null;
  doc_numero: string;
  proveedor_nombre: string | null;
  proveedor_rut: string | null;
  orden_id: string | null;
};

/**
 * Filtra por el chip y busca por lo que se tiene en la mano: el número de la
 * recepción, el folio del papel, el proveedor (nombre o RUT) o la orden.
 * «Con diferencias» incluye las que entraron sin orden: las dos son lo que
 * Gerencia tiene que mirar.
 */
export function filtrarRecepciones<T extends RecepcionFiltrable>(
  lista: T[],
  filtro: FiltroRecepciones,
  busqueda = '',
  numeroDeOrden: (id: string) => string | undefined = () => undefined,
): T[] {
  const q = busqueda.trim().toLowerCase();
  const qDoc = normalizarNumeroDocumento(busqueda);
  return lista.filter((r) => {
    switch (filtro) {
      case 'por_contar':
        if (r.estado !== 'por_contar') return false;
        break;
      case 'contadas':
        if (r.estado !== 'contada') return false;
        break;
      case 'con_diferencias':
        if (r.estado !== 'contada' || r.resultado === 'ok') return false;
        break;
      case 'sin_enviar':
        if (r.estado !== 'contada' || r.envio_finanzas === 'enviada') return false;
        break;
      default:
        break;
    }
    if (!q) return true;
    const oc = r.orden_id ? (numeroDeOrden(r.orden_id) ?? '') : 'sin orden';
    return (
      r.numero.toLowerCase().includes(q) ||
      (qDoc !== '' && normalizarNumeroDocumento(r.doc_numero).includes(qDoc)) ||
      String(r.proveedor_nombre ?? '').toLowerCase().includes(q) ||
      String(r.proveedor_rut ?? '').toLowerCase().includes(q) ||
      oc.toLowerCase().includes(q)
    );
  });
}
