// Qué filas muestra el recuadro de totales del documento de cotización.
//
// Vive acá — y no dentro de la página — porque el recuadro se dibuja en DOS
// lugares: la Fase 1/Fase 3 de verdad (`CotizadorFase0`) y la maqueta de la
// vista previa del editor de documentos (`MaquetasSecciones`). Antes cada uno
// tenía su propia lista y se fueron separando.
//
// DECISIÓN DEL DUEÑO (2026-08-24): el cliente ve DOS montos —transferencia y
// tarjeta— y nada más. El IVA no se desglosa (va incluido y así lo dice la
// nota), el subtotal neto no se muestra y el abono inicial dejó de imprimirse
// en la cotización. `calcularTotales` los sigue calculando: esto es solo
// presentación.
//
// AJUSTE (2026-09-04): el TOTAL SIN IVA vuelve, pero en CHICO y debajo de la
// transferencia. Es el neto —la misma base de los valores unitarios de la
// tabla, que siempre fueron netos—, así que el vendedor puede cuadrar la
// columna TOTAL con el recuadro. Sigue sin desglosarse el IVA como línea
// aparte, y el abono sigue fuera.

import type { TotalesCotizacion } from './preciosFase0';

export type FilaTotalDoc = {
  id: string;
  label: string;
  valor: (t: TotalesCotizacion) => number;
  /** Se dibuja destacada (es el precio que el cliente mira primero). */
  fuerte?: boolean;
  /** Línea divisoria arriba de la fila. */
  separadorAntes?: boolean;
  /** Secundaria: chica y gris. No compite con los montos que el cliente paga. */
  tenue?: boolean;
};

export const FILAS_TOTALES: FilaTotalDoc[] = [
  {
    id: 'transferencia',
    label: 'Total transferencia',
    valor: (t) => t.totalTransferencia,
    fuerte: true,
  },
  {
    id: 'neto',
    label: 'Total sin IVA',
    valor: (t) => t.subtotalNeto,
    tenue: true,
  },
  {
    id: 'tarjeta',
    label: 'Total tarjeta crédito',
    valor: (t) => t.totalTarjeta,
    separadorAntes: true,
  },
];

/** Reemplaza al desglose del IVA: los montos de arriba ya lo traen dentro. */
export const NOTA_IVA = 'Todos los precios incluyen IVA.';
