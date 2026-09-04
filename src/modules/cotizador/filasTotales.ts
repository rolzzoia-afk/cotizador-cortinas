// Qué filas muestra el recuadro de totales del documento de cotización.
//
// Vive acá — y no dentro de la página — porque el recuadro se dibuja en DOS
// lugares: la Fase 1/Fase 3 de verdad (`CotizadorFase0`) y la maqueta de la
// vista previa del editor de documentos (`MaquetasSecciones`). Antes cada uno
// tenía su propia lista y se fueron separando.
//
// DECISIÓN DEL DUEÑO (2026-09-04): el recuadro vuelve a ser el de la PLANILLA
// MANUAL, con las dos formas de pago desglosadas y el IVA a la vista:
//
//     SUBTOTAL PAGO TARJETA D.C   →  subtotalTarjeta  (neto × 1,138)
//     IVA 19%                     →  ivaTarjeta
//     TOT. TARJETA DE CRÉDITO     →  totalTarjeta
//     SUBTOTAL PAGO TRANSF.       →  subtotalNeto
//     IVA 19%                     →  ivaTransferencia
//     TOTAL PAGO TRANSF.          →  totalTransferencia
//
// El orden es el del Excel: primero la tarjeta, después la transferencia. Con
// el IVA desglosado la nota «Todos los precios incluyen IVA» sobra —lo dice el
// propio recuadro— y se retiró. El abono inicial sigue fuera del documento
// (`calcularTotales` lo calcula igual: esto es solo presentación).
//
// HISTORIA: entre el 2026-08-24 (PR #254) y hoy el recuadro mostró solo los dos
// montos finales, y desde el 2026-09-04 por la mañana el neto en chico. Este es
// el estado que pidió el dueño para que la app y la planilla se lean igual.

import type { TotalesCotizacion } from './preciosFase0';

export type FilaTotalDoc = {
  id: string;
  /** La etiqueta se calcula: el rótulo del IVA lleva la TASA real, que es un
   *  parámetro por empresa (`parametros.iva`) y no siempre vale 19 %. */
  label: (t: TotalesCotizacion) => string;
  valor: (t: TotalesCotizacion) => number;
  /** Se dibuja destacada: es uno de los dos montos que el cliente paga. */
  fuerte?: boolean;
  /** Línea divisoria arriba de la fila (separa los dos bloques de pago). */
  separadorAntes?: boolean;
  /** Debajo de esta fila va la leyenda de cuotas: es el monto que la explica.
   *  Antes se dibujaba al final del recuadro porque la tarjeta era la última
   *  fila; con el orden de la planilla queda al medio, y la leyenda la sigue. */
  llevaLeyendaCuotas?: boolean;
};

/** «IVA 19%» — sin decimales cuando la tasa es redonda, que es lo normal. */
export function rotuloIva(iva: number): string {
  const pct = iva * 100;
  return `IVA ${Number.isInteger(pct) ? pct : pct.toFixed(1).replace('.', ',')}%`;
}

export const FILAS_TOTALES: FilaTotalDoc[] = [
  {
    id: 'tarjetaSubtotal',
    label: () => 'Subtotal pago tarjeta d.c.',
    valor: (t) => t.subtotalTarjeta,
  },
  {
    id: 'tarjetaIva',
    label: (t) => rotuloIva(t.iva),
    valor: (t) => t.ivaTarjeta,
  },
  {
    id: 'tarjeta',
    label: () => 'Tot. tarjeta de crédito',
    valor: (t) => t.totalTarjeta,
    fuerte: true,
    llevaLeyendaCuotas: true,
  },
  {
    id: 'transferenciaSubtotal',
    label: () => 'Subtotal pago transf.',
    valor: (t) => t.subtotalNeto,
    separadorAntes: true,
  },
  {
    id: 'transferenciaIva',
    label: (t) => rotuloIva(t.iva),
    valor: (t) => t.ivaTransferencia,
  },
  {
    id: 'transferencia',
    label: () => 'Total pago transf.',
    valor: (t) => t.totalTransferencia,
    fuerte: true,
  },
];
