// Las líneas de ADICIONALES de la cotización (motores, cenefas, accesorios) tal
// como las maneja la grilla de Fase 1/3, y su ida y vuelta contra lo guardado en
// la OT (`datos_generales.adicionalesFase0`).
//
// Módulo PURO: acá no hay React ni Supabase, para que la persistencia se pueda
// probar sola. El render vive en CotizadorFase0.

import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import { COD_INSTALACION_VERTICAL } from './reglasPrecios';

export type AdicionalUI = {
  id: string;
  codInt: string;
  cantidad: number;
  descuento: number;
  ubicacion: string;
  colorAcc: string;
  /** Cenefa ovalada con tira (solo derivados de paño). */
  conTira?: boolean;
  /**
   * 'pano' = derivado de una cenefa de paño: se regenera en cada apertura.
   * Editarlo a mano lo pasa a 'manual' y deja de seguir al paño.
   */
  origen?: 'manual' | 'pano';
  /** La ubicación que tenía cuando era derivado, para no duplicar la cenefa. */
  ubicacionDerivada?: string;
  /**
   * El TIPO escrito a mano para esta línea, cuando el del catálogo se queda
   * corto: «ACCESORIO» a secas no distingue una cenefa de un motor, y el
   * cliente lee esa columna en el PDF. Vacío = manda el catálogo.
   */
  tipo?: string;
};

export const nuevoAdicional = (): AdicionalUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  cantidad: 1,
  descuento: 0,
  ubicacion: '',
  colorAcc: '',
});

export function adicionalesToPersist(list: AdicionalUI[]): AdicionalFase0Persistido[] {
  return list.map(
    ({
      id,
      codInt,
      cantidad,
      descuento,
      ubicacion,
      colorAcc,
      conTira,
      origen,
      ubicacionDerivada,
      tipo,
    }) => ({
      id,
      codInt: codInt.trim(),
      cantidad,
      descuento,
      ubicacion,
      colorAcc,
      conTira,
      origen,
      ubicacionDerivada,
      // Un tipo en blanco no se guarda: así la línea vuelve a leer el catálogo
      // en vez de quedar pegada a un rótulo vacío.
      ...(tipo?.trim() ? { tipo: tipo.trim() } : {}),
    }),
  );
}

export function adicionalesFromPersist(raw: unknown): AdicionalUI[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => {
    const row = a as Partial<AdicionalFase0Persistido>;
    return {
      id: row.id || crypto.randomUUID(),
      codInt: row.codInt || '',
      cantidad: row.cantidad ?? 1,
      descuento: row.descuento ?? 0,
      ubicacion: row.ubicacion || '',
      colorAcc: row.colorAcc || '',
      conTira: row.conTira,
      origen: row.origen,
      ubicacionDerivada: row.ubicacionDerivada,
      tipo: row.tipo,
    };
  });
}

/**
 * El TIPO que se muestra y se imprime para una línea: el escrito a mano si lo
 * hay, si no el del catálogo. Lo usan la grilla y el PDF, para que el cliente
 * lea exactamente lo mismo que la vendedora dejó escrito.
 */
export function tipoDeAdicional(
  tipoManual: string | undefined,
  tipoCatalogo: string | undefined,
): string {
  return rotuloManual(tipoManual, tipoCatalogo);
}

/**
 * El rótulo que se muestra y se imprime: el escrito a mano si lo hay, si no el
 * que calcula la app. Un texto en blanco no cuenta como escrito, así que
 * borrarlo devuelve la línea a su valor automático.
 */
export function rotuloManual(
  manual: string | undefined,
  automatico: string | undefined,
): string {
  return manual?.trim() || automatico || '';
}

/**
 * El TIPO escrito a mano para la fila de INSTALACIÓN, listo para guardar:
 * `undefined` si está en blanco, para que la fila vuelva a su texto de siempre
 * en vez de quedar pegada a un vacío.
 *
 * Es lo ÚNICO que se escribe de esa fila: el resto lo arma el motor (cuántas
 * cortinas se instalan, el mínimo de 4, el % de región) y dejarlo escribir
 * haría que dejara de cuadrar con la cotización. El descuento sí se escribe,
 * pero va aparte (`instalacionDescuentoManual`).
 */
export function instalacionTipoParaGuardar(tipo: string | undefined): string | undefined {
  return tipo?.trim() || undefined;
}

/** Lo guardado en la OT, tolerando basura (una OT vieja no trae el campo). */
export function instalacionTipoFromPersist(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

const codigo = (ci: string | undefined) => (ci || '').trim().toUpperCase();

/** El sistema de una fila de instalación incluida, para comparar sin sustos. */
const esSistemaVertical = (sistema: string) => sistema.trim().toUpperCase() === 'VERTICAL';

/**
 * ¿La cotización ya trae escrita la instalación de las verticales? Pasa al
 * importar la planilla manual, que la anota como la línea `INST-VERT`.
 */
export function hayInstalacionVerticalManual(
  adicionales: readonly { codInt: string }[],
): boolean {
  return adicionales.some((a) => codigo(a.codInt) === COD_INSTALACION_VERTICAL);
}

/**
 * Las filas de instalación INCLUIDA que hay que dibujar (en pantalla y en el
 * PDF). La app arma sola la de las verticales para que se vea que se están
 * cobrando los $40.000 de cada cortina; pero si la cotización YA trae esa
 * línea escrita —importada del Excel, donde la vendedora le pone la ubicación—
 * la automática se calla, o la instalación aparecería dos veces.
 *
 * Ninguna de las dos suma al total: la instalación vertical va dentro del
 * precio de cada cortina. Esto solo decide cuál de las dos se muestra.
 */
export function incluidasVisibles<T extends { sistema: string }>(
  incluidas: readonly T[],
  adicionales: readonly { codInt: string }[],
): T[] {
  if (!hayInstalacionVerticalManual(adicionales)) return [...incluidas];
  return incluidas.filter((p) => !esSistemaVertical(p.sistema));
}
