// ─────────────────────────────────────────────────────────────────────
// REGLAS DE SISTEMAS DE OSCURIDAD — fuente: SISTEMAS OSCURIDAD.xlsx
//
// Cada sistema (Soft Light 38/45, Soft Light con cenefa cuadrada,
// Oscuranti, Dark) tiene 3 variantes de instalación: INTERNO / SEMI /
// EXTERNO. Cada variante define las medidas de corte de sus componentes
// y 6 PERFILES con interruptor ON/OFF (izq/der/inferior, a muro o piso).
//
// Todas las medidas se expresan como AJUSTE NETO sobre el ANCHO (cm) salvo
// los perfiles laterales, que se calculan sobre el ALTO (cm). Los ajustes
// fueron extraídos celda por celda del Excel y validados en los tests
// dorados (reglas-oscuridad.test.ts). Si la planilla cambia, editar SOLO
// las tablas de abajo.
//
// Mapeo a columnas del Excel de órdenes (las reconoce el optimizador
// legacy en COLUMNAS_CORTE):
//   Tubo            → TUBO
//   Peso            → PESO SOFT LIGHT
//   Cenefa Delantera→ CENEFA DELANTERA
//   Cenefa Trasera  → CENEFA TRASERA
//   Perfil izq      → PERFIL (IZQ) INT
//   Perfil der      → PERFIL (DER) INT
//   Perfil inferior → PERFIL BASE
//   Tela / Velcro   → '' (viaja por el flujo de telas)
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────

export type VarianteOscuridad = 'INTERNO' | 'SEMI' | 'EXTERNO';

export type FamiliaOscuridad =
  | 'SOFT_LIGHT_38'
  | 'SOFT_LIGHT_45'
  | 'SOFT_LIGHT_CC' // Soft Light con cenefa cuadrada (38 y 45 son idénticas)
  | 'OSCURANTI'
  | 'DARK';

export type PerfilesOscuridad = {
  izqMuro?: boolean;
  izqPiso?: boolean;
  derMuro?: boolean;
  derPiso?: boolean;
  infMuro?: boolean;
  infPiso?: boolean;
};

/** Medidas manuales (cm) que sobreescriben la calculada de cada perfil. */
export type MedidasPerfilesOscuridad = Partial<Record<keyof PerfilesOscuridad, number>>;

/** Devuelve el override si es un número válido (> 0); si no, la medida calculada. */
function aplicarOverride(calculada: number, override: number | undefined): number {
  return typeof override === 'number' && Number.isFinite(override) && override > 0
    ? r1(override)
    : calculada;
}

export type CorteOscuridad = {
  componente: string;
  /** Columna del Excel de órdenes ('' = no viaja, va por flujo de telas). */
  columnaExcel: string;
  medidaCm: number;
  /** true si proviene de un perfil con interruptor ON/OFF. */
  perfil?: boolean;
};

export const PERFILES_OSCURIDAD: Array<{ key: keyof PerfilesOscuridad; label: string }> = [
  { key: 'izqMuro', label: 'Perfil izquierdo a Muro' },
  { key: 'izqPiso', label: 'Perfil izquierdo a Piso' },
  { key: 'derMuro', label: 'Perfil derecho a Muro' },
  { key: 'derPiso', label: 'Perfil derecho a Piso' },
  { key: 'infMuro', label: 'Perfil inferior a Muro' },
  { key: 'infPiso', label: 'Perfil inferior al Piso' },
];

export const VARIANTES_OSCURIDAD: VarianteOscuridad[] = ['INTERNO', 'SEMI', 'EXTERNO'];

const r1 = (n: number) => Math.round(n * 10) / 10;

const VI: Record<VarianteOscuridad, number> = { INTERNO: 0, SEMI: 1, EXTERNO: 2 };

// Ajuste neto sobre el ANCHO por [INTERNO, SEMI, EXTERNO].
const CENEFA_ADJ: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [-1.2, 6.6, 13.2],
  SOFT_LIGHT_45: [-1.2, 6.6, 13.2],
  SOFT_LIGHT_CC: [-0.3, 7.5, 15.8],
  OSCURANTI: [-0.3, 7.5, 15.8],
  DARK: [-0.3, 7.5, 15.8],
};
const TUBO_ADJ: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [-3.0, 4.8, 11.4],
  SOFT_LIGHT_45: [-1.2, 6.6, 13.2],
  SOFT_LIGHT_CC: [-6.1, 1.5, 9.4],
  OSCURANTI: [-6.1, 1.5, 9.4],
  DARK: [-6.1, 1.5, 9.4],
};
const PESO_ADJ: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [-7.0, 0.8, 7.4],
  SOFT_LIGHT_45: [-7.0, 0.8, 7.4],
  SOFT_LIGHT_CC: [-6.5, 1.1, 9.0],
  OSCURANTI: [-6.5, 1.1, 9.0],
  DARK: [-6.5, 1.1, 9.0],
};
const TELA_ADJ: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [-7.2, 0.6, 7.2],
  SOFT_LIGHT_45: [-7.2, 0.6, 7.2],
  SOFT_LIGHT_CC: [-6.7, 0.9, 8.8],
  OSCURANTI: [-6.7, 0.9, 8.8],
  DARK: [-6.7, 0.9, 8.8],
};
// Cenefa trasera (solo DARK): cenefa delantera − 1.
const CENEFA_TRASERA_DESC = 1;
// Perfil inferior: cenefa delantera − descuento por familia y variante [INTERNO, SEMI, EXTERNO].
const INF_DESC: Record<FamiliaOscuridad, [number, number, number]> = {
  SOFT_LIGHT_38: [12.6, 6.3, 12.6],
  SOFT_LIGHT_45: [12.6, 6.3, 12.6],
  SOFT_LIGHT_CC: [12.6, 6.3, 12.6],
  OSCURANTI: [13, 6.3, 12.6],
  DARK: [12.6, 6.3, 12.6],
};
// Perfiles laterales (sobre el ALTO): a muro suma 10, a piso sin ajuste.
const PERFIL_LATERAL_MURO_SUMA = 10;
// Alto de la tira de velcro (DARK): fijo.
const ALTO_TELA_VELCRO_CM = 15;

const CON_CENEFA_DELANTERA: FamiliaOscuridad[] = ['SOFT_LIGHT_CC', 'OSCURANTI', 'DARK'];

export function esFamiliaConCenefaCuadrada(familia: FamiliaOscuridad): boolean {
  return CON_CENEFA_DELANTERA.includes(familia);
}

function descPerfilInferior(familia: FamiliaOscuridad, variante: VarianteOscuridad): number {
  return INF_DESC[familia][VI[variante]];
}

/** Deriva la familia de oscuridad desde la categoría del cotizador + tipo de cenefa del paño. */
export function familiaOscuridad(
  categoria: string | undefined | null,
  cenefaTipo?: string | null,
): FamiliaOscuridad | null {
  const cat = (categoria || '').trim().toUpperCase();
  const esCuadrada = (cenefaTipo || '').trim().toUpperCase() === 'CUADRADA';
  if (cat === 'SOFT_LIGHT_38MM') return esCuadrada ? 'SOFT_LIGHT_CC' : 'SOFT_LIGHT_38';
  if (cat === 'SOFT_LIGHT_45MM') return esCuadrada ? 'SOFT_LIGHT_CC' : 'SOFT_LIGHT_45';
  if (cat === 'DARK_38MM' || cat === 'DARK_45MM') return 'DARK';
  if (cat === 'OSCURANTI_63MM') return 'OSCURANTI';
  return null;
}

/** Normaliza el texto de variante (acepta sentido Fase 0 / selección Fase 2). */
export function normalizarVarianteOscuridad(
  valor: string | undefined | null,
  fallback: VarianteOscuridad = 'INTERNO',
): VarianteOscuridad {
  const v = (valor || '').trim().toUpperCase();
  if (v.includes('SEMI')) return 'SEMI';
  if (v.includes('EXTERNO')) return 'EXTERNO';
  if (v.includes('INTERNO')) return 'INTERNO';
  return fallback;
}

/** Medida de cenefa frontal (delantera) del sistema — base para el perfil inferior. */
export function cenefaFrontOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
): number {
  return r1(anchoCm + CENEFA_ADJ[familia][VI[variante]]);
}

/** Medida (cm) de UN perfil individual, esté ON u OFF (para mostrar en la UI). */
export function medidaPerfilOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  key: keyof PerfilesOscuridad,
  anchoCm: number,
  altoCm: number,
): number {
  if (key === 'izqMuro' || key === 'derMuro') return r1(altoCm + PERFIL_LATERAL_MURO_SUMA);
  if (key === 'izqPiso' || key === 'derPiso') return r1(altoCm);
  // inferior (muro/piso): cenefa frontal − descuento de variante
  return r1(cenefaFrontOscuridad(familia, variante, anchoCm) - descPerfilInferior(familia, variante));
}

/**
 * Calcula los cortes de un sistema de oscuridad.
 * @param familia   sistema (ver familiaOscuridad)
 * @param variante  INTERNO | SEMI | EXTERNO
 * @param anchoCm   ancho nominal (cm)
 * @param altoCm    alto nominal (cm) — necesario para perfiles laterales
 * @param perfiles  interruptores ON/OFF
 */
export function cortesOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  altoCm: number,
  perfiles: PerfilesOscuridad = {},
  medidas: MedidasPerfilesOscuridad = {},
): CorteOscuridad[] {
  const cortes: CorteOscuridad[] = [];
  if (!anchoCm || anchoCm <= 0) return cortes;
  const vi = VI[variante];
  const conCenefaCuad = CON_CENEFA_DELANTERA.includes(familia);
  const cenefaFront = r1(anchoCm + CENEFA_ADJ[familia][vi]);

  if (conCenefaCuad) {
    cortes.push({ componente: 'Cenefa Delantera', columnaExcel: 'CENEFA DELANTERA', medidaCm: cenefaFront });
    if (familia === 'DARK') {
      cortes.push({
        componente: 'Cenefa Trasera',
        columnaExcel: 'CENEFA TRASERA',
        medidaCm: r1(cenefaFront - CENEFA_TRASERA_DESC),
      });
      cortes.push({ componente: 'Ancho Tela Velcro', columnaExcel: '', medidaCm: cenefaFront });
      cortes.push({ componente: 'Alto Tela Velcro', columnaExcel: '', medidaCm: ALTO_TELA_VELCRO_CM });
    }
  } else {
    // Soft Light "normal": la cenefa frontal viaja por el adicional CENF O
    // (columna CENEFA OVALADA), por eso aquí va sin columna de Excel.
    cortes.push({ componente: 'Cenefa', columnaExcel: '', medidaCm: cenefaFront });
  }

  cortes.push({ componente: 'Tubo', columnaExcel: 'TUBO', medidaCm: r1(anchoCm + TUBO_ADJ[familia][vi]) });
  cortes.push({ componente: 'Tela (ancho)', columnaExcel: '', medidaCm: r1(anchoCm + TELA_ADJ[familia][vi]) });
  cortes.push({ componente: 'Peso', columnaExcel: 'PESO SOFT LIGHT', medidaCm: r1(anchoCm + PESO_ADJ[familia][vi]) });

  // ── Perfiles (ON/OFF) ──
  // Laterales sobre el ALTO; colapsamos muro/piso por lado (muro tiene
  // prioridad) porque cada columna del Excel admite una sola medida.
  const altoOk = altoCm > 0;
  const lateralMuro = r1(altoCm + PERFIL_LATERAL_MURO_SUMA);
  const lateralPiso = r1(altoCm);
  const inferior = r1(cenefaFront - descPerfilInferior(familia, variante));
  if (perfiles.izqMuro && altoOk) {
    cortes.push({ componente: 'Perfil izquierdo a Muro', columnaExcel: 'PERFIL (IZQ) INT', medidaCm: aplicarOverride(lateralMuro, medidas.izqMuro), perfil: true });
  } else if (perfiles.izqPiso && altoOk) {
    cortes.push({ componente: 'Perfil izquierdo a Piso', columnaExcel: 'PERFIL (IZQ) INT', medidaCm: aplicarOverride(lateralPiso, medidas.izqPiso), perfil: true });
  }
  if (perfiles.derMuro && altoOk) {
    cortes.push({ componente: 'Perfil derecho a Muro', columnaExcel: 'PERFIL (DER) INT', medidaCm: aplicarOverride(lateralMuro, medidas.derMuro), perfil: true });
  } else if (perfiles.derPiso && altoOk) {
    cortes.push({ componente: 'Perfil derecho a Piso', columnaExcel: 'PERFIL (DER) INT', medidaCm: aplicarOverride(lateralPiso, medidas.derPiso), perfil: true });
  }
  // Inferior sobre la cenefa frontal (muro y piso miden igual).
  if (perfiles.infMuro || perfiles.infPiso) {
    const nombre = perfiles.infMuro ? 'Perfil inferior a Muro' : 'Perfil inferior al Piso';
    const override = perfiles.infMuro ? medidas.infMuro : medidas.infPiso;
    cortes.push({ componente: nombre, columnaExcel: 'PERFIL BASE', medidaCm: aplicarOverride(inferior, override), perfil: true });
  }

  return cortes;
}
