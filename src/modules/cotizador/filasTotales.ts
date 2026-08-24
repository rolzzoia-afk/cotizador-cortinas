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

import type { TotalesCotizacion } from './preciosFase0';

export type FilaTotalDoc = {
  id: string;
  label: string;
  valor: (t: TotalesCotizacion) => number;
  /** Se dibuja destacada (es el precio que el cliente mira primero). */
  fuerte?: boolean;
  /** Línea divisoria arriba de la fila. */
  separadorAntes?: boolean;
};

export const FILAS_TOTALES: FilaTotalDoc[] = [
  {
    id: 'transferencia',
    label: 'Total transferencia',
    valor: (t) => t.totalTransferencia,
    fuerte: true,
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
