// ─────────────────────────────────────────────────────────────────────
// La lista de cortinas de una OT, para el control final de Prueba.
//
// Cada PAÑO es una cortina física: una ventana de 3 paños son 3 roller que se
// prueban por separado (suben, bajan, la cadena corre). Por eso la lista no es
// una fila por ventana.
//
// La identidad es la MISMA que usa la hoja del cálculo general
// (`${ventanaId}_${panoIndex}`), así que una cortina se llama igual en
// Dimensionado, en Armado y en Prueba.
// ─────────────────────────────────────────────────────────────────────

import type { OT, VentanaItem } from '@/modules/ots/types';

export type CortinaPrueba = {
  piezaId: string;
  ubicacion: string;
  producto: string;
  codInt: string;
  /** Medidas en metros, como se levantaron. 0 = sin dato. */
  ancho: number;
  alto: number;
  color: string;
  /** «2 de 3» cuando la ventana lleva varios paños; vacío si es una sola. */
  rotulo: string;
};

const numero = (v: unknown): number => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const texto = (v: unknown): string => String(v ?? '').trim();

export function cortinasDeOT(ot: OT | null): CortinaPrueba[] {
  if (!ot) return [];
  const fuera: CortinaPrueba[] = [];
  for (const v of (ot.storeVentanas || []) as VentanaItem[]) {
    const panos = v.panos && v.panos.length > 0 ? v.panos : [{ ancho: 0, alto: v.alto ?? 0 }];
    panos.forEach((p, i) => {
      fuera.push({
        piezaId: `${v.id}_${i}`,
        ubicacion: texto(v.ubicacion) || 'Sin ubicación',
        producto: texto(v.producto),
        codInt: texto(v.codInt),
        ancho: numero(p.ancho),
        alto: numero(p.alto ?? v.alto),
        color: texto(p.color) || texto(v.color),
        rotulo: panos.length > 1 ? `${i + 1} de ${panos.length}` : '',
      });
    });
  }
  return fuera;
}
