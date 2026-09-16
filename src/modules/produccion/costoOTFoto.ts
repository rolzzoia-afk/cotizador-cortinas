// ─────────────────────────────────────────────────────────────────────
// La FOTO del costo de una OT: lo que la pantalla «Costo total» manda a la
// base al guardar (RPC `ot_costo_guardar`, sql/20260916_costos_ot_01_foto.sql).
//
// Se guarda una foto y no un cálculo vivo: los costos de bodega y del
// catálogo cambian, y el costo de una OT es el del día en que se revisó.
// La base vuelve a hacer las cuentas con las líneas y NO guarda si no le da
// lo mismo que a la pantalla (`esperado`), así que las fórmulas de acá y las
// del SQL tienen que ser las mismas de `calcularCostoOT`.
//
// Módulo puro: sin Supabase, para que las pruebas corran en el CI.
// ─────────────────────────────────────────────────────────────────────

import { LARGO_BARRA_M, type CostoManualOT, type CostoOT } from './costoOT';

export type TipoLineaCosto = 'tela' | 'aluminio' | 'insumo';

/** Una línea tal como la recibe `ot_costo_guardar` (nombres de la columna). */
export type LineaFotoCosto = {
  tipo: TipoLineaCosto;
  codigo: string | null;
  descripcion: string | null;
  /** tela: metros del rollo · aluminio: metros cortados · insumo: unidades. */
  cantidad: number;
  unidad: 'm' | 'u';
  /** tela: metros de falla · aluminio: merma. */
  merma: number;
  fallas: number;
  panos_colmena: number;
  costo_unitario: number | null;
  fuente: 'propio' | 'referencia' | 'bodega' | 'calculo' | null;
  referencia: string | null;
};

export type FotoCostoOT = {
  manual: CostoManualOT;
  lineas: LineaFotoCosto[];
  sinCosto: { telas: string[]; aluminio: string[]; insumos: string[] };
  /** Lo que vio el administrador: la base lo compara con su propia cuenta. */
  esperado: { costoConFallas: number; gananciaReal: number };
};

/** Lo que la pantalla necesita saber de la foto ya guardada. */
export type FotoGuardada = {
  version: number;
  guardado_at: string;
  guardado_por: string | null;
  costo_con_fallas: number;
  ganancia_real: number;
  cobrado_neto: number;
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const textoONull = (v: string | undefined | null): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/** Arma lo que se manda a `ot_costo_guardar` con el cálculo que se ve en pantalla. */
export function fotoCostoOT(costo: CostoOT, manual: CostoManualOT): FotoCostoOT {
  const lineas: LineaFotoCosto[] = [
    ...costo.telas.map(
      (t): LineaFotoCosto => ({
        tipo: 'tela',
        codigo: textoONull(t.codInt),
        descripcion: textoONull(t.producto),
        cantidad: num(t.mts),
        unidad: 'm',
        merma: num(t.mtsFalla),
        fallas: Math.round(num(t.fallas)),
        panos_colmena: Math.round(num(t.panosColmena)),
        costo_unitario: t.costoM,
        fuente: t.origenCosto,
        referencia: textoONull(t.refCosto),
      }),
    ),
    ...costo.aluminio.map(
      (a): LineaFotoCosto => ({
        tipo: 'aluminio',
        codigo: textoONull(a.cod),
        descripcion: null,
        cantidad: num(a.metros),
        unidad: 'm',
        merma: num(a.merma),
        fallas: 0,
        panos_colmena: 0,
        costo_unitario: a.costoM,
        fuente: a.fuente,
        referencia: textoONull(a.detalleFuente),
      }),
    ),
    ...costo.insumos.map(
      (i): LineaFotoCosto => ({
        tipo: 'insumo',
        codigo: textoONull(i.codigo),
        descripcion: textoONull(i.descripcion),
        cantidad: num(i.cantidad),
        unidad: 'u',
        merma: 0,
        fallas: 0,
        panos_colmena: 0,
        costo_unitario: i.costoUnit,
        fuente: i.fuente,
        referencia: null,
      }),
    ),
  ];

  return {
    // El largo de la barra va siempre escrito: el que no lo tocó usó el de
    // fábrica, y la foto tiene que decir con cuál se sacó el metro.
    manual: { ...manual, largoBarraM: num(manual.largoBarraM) > 0 ? num(manual.largoBarraM) : LARGO_BARRA_M },
    lineas,
    sinCosto: {
      telas: [...costo.telasSinCosto],
      aluminio: [...costo.aluminioSinCosto],
      insumos: [...costo.insumosSinCosto],
    },
    esperado: { costoConFallas: costo.costoConFallas, gananciaReal: costo.gananciaReal },
  };
}

/**
 * ¿Lo que se ve hoy es distinto de lo guardado? Pasa cuando cambió un costo
 * de bodega, se cortó más aluminio o se editó la OT después de guardar. Se
 * compara en pesos enteros: la base redondea a dos decimales.
 */
export function fotoDesactualizada(guardada: FotoGuardada | null, costo: CostoOT): boolean {
  if (!guardada) return true;
  const distinto = (a: number, b: number) => Math.abs(num(a) - num(b)) > 1;
  return (
    distinto(guardada.costo_con_fallas, costo.costoConFallas) ||
    distinto(guardada.ganancia_real, costo.gananciaReal) ||
    distinto(guardada.cobrado_neto, costo.neto)
  );
}
