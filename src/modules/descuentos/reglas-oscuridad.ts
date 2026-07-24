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

/** Perforación (anotación de taller) de un perfil: no cambia la medida. */
export type PerforacionPerfil = 'INTERNO' | 'EXTERNO';

/**
 * Montaje del perfil base (inferior) — SOLO soft light INTERNO:
 *   'DENTRO' (default) = entre los perfiles laterales → ancho − 13,3.
 *   'PARED'            = de pared a pared → ancho real completo.
 * No afecta SEMI/EXTERNO ni a Oscuranti/Dark (siguen = cenefa frontal − descuento).
 */
export type MontajeBaseOscuridad = 'DENTRO' | 'PARED';

export type PerfilesOscuridad = {
  /** Superficie (define la MEDIDA): muro = alto+10, piso = alto. Se elige en Fase 2. */
  izqMuro?: boolean;
  izqPiso?: boolean;
  derMuro?: boolean;
  derPiso?: boolean;
  infMuro?: boolean;
  infPiso?: boolean;
  /**
   * Perfil ACTIVO (lleva perfil izq/der/base), independiente de la superficie.
   * La variante en Fase 1 activa los laterales aunque la superficie (medida)
   * quede pendiente para Fase 2. Retro-compat: un perfil con muro/piso marcado
   * cuenta como activo aunque estas banderas vengan ausentes.
   */
  izqActivo?: boolean;
  derActivo?: boolean;
  infActivo?: boolean;
  /** Perforación INTERNO/EXTERNO por perfil (SEMI puede dejarla sin definir). */
  izqPerf?: PerforacionPerfil;
  derPerf?: PerforacionPerfil;
  infPerf?: PerforacionPerfil;
  /** Montaje del perfil base (soft light INTERNO): 'DENTRO' (default) = ancho − 13,3;
   *  'PARED' = ancho completo. Se elige en Fase 2; sin efecto en otras familias/variantes. */
  infMontaje?: MontajeBaseOscuridad;
};

/** Claves de SUPERFICIE de perfil (definen la medida: muro=alto+10, piso=alto). */
export type SuperficiePerfilKey =
  | 'izqMuro'
  | 'izqPiso'
  | 'derMuro'
  | 'derPiso'
  | 'infMuro'
  | 'infPiso';

/** Medidas manuales (cm) que sobreescriben la calculada de cada perfil (solo superficies). */
export type MedidasPerfilesOscuridad = Partial<Record<SuperficiePerfilKey, number>>;

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
  /** Perforación del perfil (INTERNO/EXTERNO) — anotación de taller. */
  perforacion?: PerforacionPerfil;
  /** Perfil activo pero sin superficie (muro/piso) elegida → medida pendiente (Fase 2). */
  pendienteMedida?: boolean;
};

export const PERFILES_OSCURIDAD: Array<{ key: SuperficiePerfilKey; label: string }> = [
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
  // Soft light 45 mm (0,45_1,2mm) BLANCO: tubo = cenefa − 3,1 (fórmula usuario 2026-07-24).
  SOFT_LIGHT_45: [-4.3, 3.5, 10.1],
  SOFT_LIGHT_CC: [-6.1, 1.5, 9.4],
  OSCURANTI: [-6.1, 1.5, 9.4],
  DARK: [-6.1, 1.5, 9.4],
};
// Tubo con accesorios NEGROS. Único caso donde el corte de oscuridad depende del
// color: en el 45 mm el tubo es cenefa − 2,9 (en vez de − 3,1 del blanco), o sea
// +0,2 sobre la tabla blanca. La tela se compensa (tubo − 3,1) y queda idéntica.
// El resto de familias/colores usa TUBO_ADJ (fallback en cortesOscuridad).
const TUBO_ADJ_NEGRO: Partial<Record<FamiliaOscuridad, [number, number, number]>> = {
  SOFT_LIGHT_45: [-4.1, 3.7, 10.3],
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
// Soft light: el perfil base NO se mide sobre la cenefa sino sobre el ANCHO REAL
// directo, con un ajuste neto por variante y montaje (dentro de los laterales /
// pared a pared). SEMI no tiene montaje "dentro" (DENTRO: null) → siempre pared
// a pared. (INTERNO: −13,3 dentro / +0 pared · EXTERNO: +0,08 dentro (0,8 mm) /
// +14 pared · SEMI: +7,5 siempre.)
const INF_SOFTLIGHT_ADJ: Record<VarianteOscuridad, { DENTRO: number | null; PARED: number }> = {
  INTERNO: { DENTRO: -13.3, PARED: 0 },
  SEMI: { DENTRO: null, PARED: 7.5 },
  EXTERNO: { DENTRO: 0.08, PARED: 14 },
};
const FAMILIAS_SOFT_LIGHT: FamiliaOscuridad[] = ['SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC'];
/** ¿Es un sistema soft light (38/45/cenefa cuadrada)? (No Oscuranti/Dark.) */
export function esFamiliaSoftLight(familia: FamiliaOscuridad): boolean {
  return FAMILIAS_SOFT_LIGHT.includes(familia);
}
/** ¿Los accesorios del paño son negros? (Elige la tabla de tubo del 45 mm.) */
export function esColorAccesoriosNegro(valor: string | null | undefined): boolean {
  return (valor || '').trim().toUpperCase().startsWith('NEG');
}
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
  // Prefijo: cubre 'Cuadrada a muro' / 'a techo' y el 'Cuadrada' legacy.
  const esCuadrada = (cenefaTipo || '').trim().toUpperCase().startsWith('CUADRADA');
  if (cat === 'SOFT_LIGHT_38MM') return esCuadrada ? 'SOFT_LIGHT_CC' : 'SOFT_LIGHT_38';
  if (cat === 'SOFT_LIGHT_45MM') return esCuadrada ? 'SOFT_LIGHT_CC' : 'SOFT_LIGHT_45';
  if (cat === 'DARK_38MM' || cat === 'DARK_45MM') return 'DARK';
  if (cat === 'OSCURANTI_63MM') return 'OSCURANTI';
  return null;
}

/**
 * Familia de oscuridad EFECTIVA según el diámetro de tubo ya resuelto: un soft
 * light 38 mm montado sobre tubo de 45 mm (banda 2,2–3,0 m con el toggle E78 de
 * la OT) usa el corte de tubo de 45 mm. El único descuento que difiere entre
 * SOFT_LIGHT_38 y _45 es el TUBO (cenefa/tela/peso/perfiles son idénticos), así
 * que el diámetro del modelo/tubo es el único lever. El resto de familias (CC,
 * DARK, OSCURANTI, soft light 45 nativo) se devuelven sin tocar.
 */
export function familiaOscuridadConDiametro(
  categoria: string | undefined | null,
  cenefaTipo: string | undefined | null,
  diametroTuboMm?: number | null,
): FamiliaOscuridad | null {
  const fam = familiaOscuridad(categoria, cenefaTipo);
  return fam === 'SOFT_LIGHT_38' && diametroTuboMm === 45 ? 'SOFT_LIGHT_45' : fam;
}

/** Normaliza el texto de perforación de un perfil ('INTERNO'|'EXTERNO'|undefined). */
export function normalizarPerforacion(
  valor: string | undefined | null,
): PerforacionPerfil | undefined {
  const v = (valor || '').trim().toUpperCase();
  if (v.includes('EXTERNO') || v === 'EXT') return 'EXTERNO';
  if (v.includes('INTERNO') || v === 'INT') return 'INTERNO';
  return undefined;
}

/** Normaliza el montaje del perfil base ('PARED'|'DENTRO'|undefined = default DENTRO). */
export function normalizarMontajeBase(
  valor: string | undefined | null,
): MontajeBaseOscuridad | undefined {
  const v = (valor || '').trim().toUpperCase();
  if (v.startsWith('PARED')) return 'PARED';
  if (v.startsWith('DENTRO')) return 'DENTRO';
  return undefined;
}

/** Familias cuyos LATERALES son parte física del sistema (siempre presentes). */
const CON_LATERALES_SIEMPRE: FamiliaOscuridad[] = ['SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC', 'DARK'];

/**
 * Aplica los defaults de perfiles que impone la VARIANTE (asignada en Fase 1):
 * en soft light / dark los dos LATERALES van siempre activos y su perforación
 * (INTERNO/EXTERNO) sale de la variante (SEMI = sin definir). Los flags que el
 * paño ya trae (Fase 2) mandan; solo se rellenan los que están sin definir. El
 * perfil base (inferior) NO se activa por defecto (se elige en Fase 2).
 */
export function aplicarDefaultsPerfiles(
  base: PerfilesOscuridad,
  familia: FamiliaOscuridad | null,
  variante: VarianteOscuridad,
): PerfilesOscuridad {
  if (!familia || !CON_LATERALES_SIEMPRE.includes(familia)) return base;
  const perfVariante: PerforacionPerfil | undefined =
    variante === 'INTERNO' ? 'INTERNO' : variante === 'EXTERNO' ? 'EXTERNO' : undefined;
  return {
    ...base,
    izqActivo: base.izqActivo ?? true,
    derActivo: base.derActivo ?? true,
    izqPerf: base.izqPerf ?? perfVariante,
    derPerf: base.derPerf ?? perfVariante,
  };
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

/**
 * Medida (cm) del perfil BASE (inferior). En soft light se mide sobre el ANCHO
 * REAL directo con un ajuste por variante y montaje (ver INF_SOFTLIGHT_ADJ):
 *   INTERNO: dentro = ancho − 13,3 · pared = ancho.
 *   EXTERNO: dentro = ancho + 0,08 · pared = ancho + 14.
 *   SEMI:    siempre pared a pared = ancho + 7,5 (no tiene "dentro").
 * Oscuranti/Dark = cenefa frontal − descuento de variante.
 */
export function medidaPerfilBaseOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  montaje?: MontajeBaseOscuridad,
): number {
  if (esFamiliaSoftLight(familia)) {
    const adj = INF_SOFTLIGHT_ADJ[variante];
    // SEMI (DENTRO null) → siempre pared a pared; INTERNO/EXTERNO default DENTRO.
    const delta = adj.DENTRO === null || montaje === 'PARED' ? adj.PARED : adj.DENTRO;
    return r1(anchoCm + delta);
  }
  return r1(cenefaFrontOscuridad(familia, variante, anchoCm) - descPerfilInferior(familia, variante));
}

/** ¿Se ofrece el selector Dentro/Pared del perfil base? Soft light salvo SEMI (fijo). */
export function montajeBaseDisponible(
  familia: FamiliaOscuridad | null,
  variante: VarianteOscuridad,
): boolean {
  return !!familia && esFamiliaSoftLight(familia) && INF_SOFTLIGHT_ADJ[variante].DENTRO !== null;
}

/** Medida (cm) de UN perfil individual, esté ON u OFF (para mostrar en la UI). */
export function medidaPerfilOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  key: SuperficiePerfilKey,
  anchoCm: number,
  altoCm: number,
  infMontaje?: MontajeBaseOscuridad,
): number {
  if (key === 'izqMuro' || key === 'derMuro') return r1(altoCm + PERFIL_LATERAL_MURO_SUMA);
  if (key === 'izqPiso' || key === 'derPiso') return r1(altoCm);
  // inferior (muro/piso): soft light INTERNO usa montaje; resto = cenefa − descuento.
  return medidaPerfilBaseOscuridad(familia, variante, anchoCm, infMontaje);
}

/**
 * Calcula los cortes de un sistema de oscuridad.
 * @param familia   sistema (ver familiaOscuridad)
 * @param variante  INTERNO | SEMI | EXTERNO
 * @param anchoCm   ancho nominal (cm)
 * @param altoCm    alto nominal (cm) — necesario para perfiles laterales
 * @param perfiles  interruptores ON/OFF
 * @param medidas   overrides manuales de medida por perfil
 * @param colorAccesorios color de accesorios (solo el TUBO del 45 mm difiere: negro = cenefa − 2,9)
 */
export function cortesOscuridad(
  familia: FamiliaOscuridad,
  variante: VarianteOscuridad,
  anchoCm: number,
  altoCm: number,
  perfiles: PerfilesOscuridad = {},
  medidas: MedidasPerfilesOscuridad = {},
  colorAccesorios?: string | null,
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
    // Soft Light "normal": la cenefa frontal la corta el taller y SIEMPRE viaja
    // al Excel de órdenes (columna CENEFA OVALADA, código E26/27/28 por color).
    // Un adicional CENF O, si existe, sobreescribe esta medida en excel-ordenes.
    cortes.push({ componente: 'Cenefa', columnaExcel: 'CENEFA OVALADA', medidaCm: cenefaFront });
  }

  // Tubo: en el 45 mm con accesorios negros usa la tabla NEGRA (cenefa − 2,9);
  // el resto de familias/colores cae al fallback blanco.
  const tuboAdj =
    (esColorAccesoriosNegro(colorAccesorios) ? TUBO_ADJ_NEGRO[familia] : undefined) ?? TUBO_ADJ[familia];
  cortes.push({ componente: 'Tubo', columnaExcel: 'TUBO', medidaCm: r1(anchoCm + tuboAdj[vi]) });
  cortes.push({ componente: 'Tela (ancho)', columnaExcel: '', medidaCm: r1(anchoCm + TELA_ADJ[familia][vi]) });
  cortes.push({ componente: 'Peso', columnaExcel: 'PESO SOFT LIGHT', medidaCm: r1(anchoCm + PESO_ADJ[familia][vi]) });

  // ── Perfiles (activos) ──
  // La MEDIDA depende de la superficie (muro = alto+10, piso = alto); la
  // PERFORACIÓN (INT/EXT) es una anotación de taller aparte. Un perfil puede
  // estar ACTIVO (asignado en Fase 1) con la superficie/medida pendiente para
  // Fase 2. Retro-compat: muro/piso marcado implica activo.
  const altoOk = altoCm > 0;
  const lateralMuro = r1(altoCm + PERFIL_LATERAL_MURO_SUMA);
  const lateralPiso = r1(altoCm);
  // Soft light INTERNO: ancho − 13,3 (dentro de laterales) o ancho (pared a pared);
  // resto de variantes/familias = cenefa frontal − descuento de variante.
  const inferior = medidaPerfilBaseOscuridad(familia, variante, anchoCm, perfiles.infMontaje);

  // Un lateral: elige superficie (muro gana), aplica override y anota perforación.
  const emitLateral = (
    activo: boolean | undefined,
    muro: boolean | undefined,
    piso: boolean | undefined,
    columna: string,
    lado: 'izquierdo' | 'derecho',
    override: number | undefined,
    perf: PerforacionPerfil | undefined,
  ) => {
    if (!(activo || muro || piso) || !altoOk) return;
    const superficie = muro ? 'muro' : piso ? 'piso' : null;
    const overrideOk = typeof override === 'number' && Number.isFinite(override) && override > 0;
    // Sin superficie ni override → medida pendiente (se llena en Fase 2).
    const pendienteMedida = superficie === null && !overrideOk;
    const base = superficie === 'piso' ? lateralPiso : lateralMuro; // default muro al mostrar
    const nombre =
      superficie === 'piso'
        ? `Perfil ${lado} a Piso`
        : superficie === 'muro'
          ? `Perfil ${lado} a Muro`
          : `Perfil ${lado}`;
    cortes.push({
      componente: nombre,
      columnaExcel: columna,
      medidaCm: pendienteMedida ? 0 : aplicarOverride(base, override),
      perfil: true,
      perforacion: perf,
      pendienteMedida,
    });
  };
  emitLateral(perfiles.izqActivo, perfiles.izqMuro, perfiles.izqPiso, 'PERFIL (IZQ) INT', 'izquierdo', perfiles.izqMuro ? medidas.izqMuro : medidas.izqPiso, perfiles.izqPerf);
  emitLateral(perfiles.derActivo, perfiles.derMuro, perfiles.derPiso, 'PERFIL (DER) INT', 'derecho', perfiles.derMuro ? medidas.derMuro : medidas.derPiso, perfiles.derPerf);

  // Inferior (perfil base): sobre la cenefa frontal (muro y piso miden igual).
  const infActivo = perfiles.infActivo || perfiles.infMuro || perfiles.infPiso;
  if (infActivo) {
    const superficie = perfiles.infMuro ? 'muro' : perfiles.infPiso ? 'piso' : null;
    const override = perfiles.infMuro ? medidas.infMuro : medidas.infPiso;
    const overrideOk = typeof override === 'number' && Number.isFinite(override) && override > 0;
    const pendienteMedida = superficie === null && !overrideOk;
    const nombre =
      superficie === 'piso' ? 'Perfil inferior al Piso' : superficie === 'muro' ? 'Perfil inferior a Muro' : 'Perfil inferior';
    // Soft light SEMI: el perfil base SIEMPRE va con perforación EXTERNA (no se elige).
    const infPerf =
      esFamiliaSoftLight(familia) && variante === 'SEMI' ? 'EXTERNO' : perfiles.infPerf;
    cortes.push({
      componente: nombre,
      columnaExcel: 'PERFIL BASE',
      medidaCm: pendienteMedida ? 0 : aplicarOverride(inferior, override),
      perfil: true,
      perforacion: infPerf,
      pendienteMedida,
    });
  }

  return cortes;
}
