// ─────────────────────────────────────────────────────────────────────
// Tipos y helpers PUROS del catálogo de descuentos de fabricación.
// (sin React/Supabase para poder usarse en el motor de despiece y tests)
// ─────────────────────────────────────────────────────────────────────
import { tipoPorCategoria, type TipoCortina } from './tiposCortina';

export type ModeloDespiece = {
  sistema: string;
  tipo_rol: string;
  mecanismo: string;
  codigos_tubo: string;
  diametro_tubo_mm: number;
  dcto_tubo_cm: number;
  dcto_tela_cm: number;
  suma_peso_cm: number;
  dcto_cenefa_cm: number;
  dcto_cenefa_del_cm: number;
  dcto_cenefa_tra_cm: number;
  dcto_perfiles_cm: number;
  peso_interno_duo_cm: number;
  peso_u_duo_cm: number;
  ancho_max_m: number;
  activo: boolean;
  notas: string;
};

/** Clave única de un modelo dentro del catálogo. */
export function claveModelo(m: Pick<ModeloDespiece, 'sistema' | 'tipo_rol' | 'mecanismo'>): string {
  return `${m.sistema}|${m.tipo_rol}|${m.mecanismo}`;
}

/** Etiqueta corta para selects: "ROL_SIMPLE · MEC_05_LZ90_BLANCO (38mm)". */
export function etiquetaModelo(m: ModeloDespiece): string {
  const mec = m.mecanismo ? ` · ${m.mecanismo}` : '';
  const diam = m.diametro_tubo_mm > 0 ? ` (${m.diametro_tubo_mm}mm)` : '';
  return `${m.tipo_rol}${mec}${diam}`;
}

/**
 * Valida el ancho de una cortina (en METROS) contra el modelo elegido.
 * Devuelve null si está OK, o el mensaje de error si excede el máximo.
 */
export function validarAnchoModelo(m: ModeloDespiece, anchoM: number): string | null {
  if (!m.ancho_max_m || m.ancho_max_m <= 0) return null;
  if (anchoM <= m.ancho_max_m) return null;
  return `El ancho ${anchoM.toFixed(2)} m supera el máximo del modelo ${m.tipo_rol} (${m.ancho_max_m} m). No es fabricable.`;
}

// ── Mapeo categoría (cotizador Fase 0 / Fase 2) → modelos del catálogo ──
// Las categorías del cotizador (CATEGORIAS_MECANISMO) corresponden a
// sistemas/tipos del catálogo de descuentos.
type ReglaCategoria = { sistemas: string[]; tipoIncluye?: string };

const MAPEO_CATEGORIA: Record<string, ReglaCategoria> = {
  ROL: { sistemas: ['ROLLER_SIMPLE'] },
  ROL_DUAL: { sistemas: ['ROLLER_DUAL'] },
  ROL_MANUAL_CENEFA_OVALADA_38mm: { sistemas: ['CENEFA_OVALADA'], tipoIncluye: 'MANUAL_38' },
  ROL_MANUAL_CENEFA_OVALADA_45mm: { sistemas: ['CENEFA_OVALADA'], tipoIncluye: 'MANUAL_45' },
  ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO: { sistemas: ['CENEFA_OVALADA'], tipoIncluye: 'MOTOR_PEQ' },
  ROL_CENEFA_OVALADA_MOTOR_GRANDE: { sistemas: ['CENEFA_OVALADA'], tipoIncluye: 'MOTOR_GRD' },
  PLETINA_ROLLER_V: { sistemas: ['PLETINA_ROLLER'] },
  DUO_MANUAL_38mm: { sistemas: ['CENEFA_OVALADA_DUO'], tipoIncluye: 'MANUAL_38' },
  DUO_MANUAL_45mm: { sistemas: ['CENEFA_OVALADA_DUO'], tipoIncluye: 'MANUAL_45' },
  DUO_MOTOR_PEQUEÑO_38mm: { sistemas: ['CENEFA_OVALADA_DUO'], tipoIncluye: 'MOTOR_PEQ' },
  DUO_MOTOR_GRANDE_45mm: { sistemas: ['CENEFA_OVALADA_DUO'], tipoIncluye: 'MOTOR_GRD' },
  PLETINA_DUO_V: { sistemas: ['PLETINA_DUO'] },
  SOFT_LIGHT_38mm: { sistemas: ['SOFT_LIGHT', 'SOFT_LIGHT_CENEFA_CUAD'], tipoIncluye: '38mm' },
  SOFT_LIGHT_45mm: { sistemas: ['SOFT_LIGHT', 'SOFT_LIGHT_CENEFA_CUAD'], tipoIncluye: '45mm' },
  DARK_38mm: { sistemas: ['DARK_ROLLER'], tipoIncluye: '38mm' },
  DARK_45mm: { sistemas: ['DARK_ROLLER'], tipoIncluye: '45mm' },
  OSCURANTI_63mm: { sistemas: ['OSCURANTI'] },
  VERTICAL: { sistemas: ['VERTICAL'] },
};

/**
 * Regla de catálogo de una categoría. Un TIPO propio usa sus filas propias si
 * las declaró (`sistemas`), y si no hereda las de su molde.
 */
function reglaDeCategoria(
  categoria: string,
  tipos?: readonly TipoCortina[],
): ReglaCategoria | null {
  const cat = (categoria || '').trim();
  const tipo = tipoPorCategoria(cat, tipos);
  if (tipo) {
    if (tipo.sistemas && tipo.sistemas.length > 0) {
      return {
        sistemas: [...tipo.sistemas],
        ...(tipo.tipoIncluye ? { tipoIncluye: tipo.tipoIncluye } : {}),
      };
    }
    return MAPEO_CATEGORIA[tipo.base.trim()] ?? null;
  }
  return MAPEO_CATEGORIA[cat] ?? null;
}

/** true si la categoría del cotizador es roller dual (mecanismo dual [MEC 01-25]). */
export function categoriaEsDual(categoria: string, tipos?: readonly TipoCortina[]): boolean {
  const regla = reglaDeCategoria(categoria, tipos);
  return !!regla && regla.sistemas.includes('ROLLER_DUAL');
}

/**
 * ¿Esta fila del catálogo es de la LÍNEA B (gama económica)?
 *
 * La marca vive en `notas` y no en una columna nueva a propósito: la línea B no
 * cambia la forma del despiece (mismos campos, otros números), así que no
 * justifica migrar la tabla. Las filas B las crea Admin con la nota puesta.
 */
export function esFilaLineaB(m: Pick<ModeloDespiece, 'notas'>): boolean {
  return (m.notas || '').toUpperCase().includes('LINEA B');
}

/** Modelos del catálogo compatibles con una categoría del cotizador.
 *  `lineaB` separa las dos líneas: una cortina A nunca puede caer en una fila B
 *  (ni al revés) aunque el color calce, porque sus descuentos son distintos. */
export function modelosParaCategoria(
  modelos: ModeloDespiece[],
  categoria: string,
  tipos?: readonly TipoCortina[],
  lineaB?: boolean,
): ModeloDespiece[] {
  const regla = reglaDeCategoria(categoria, tipos);
  if (!regla) return [];
  const compatibles = modelos.filter(
    (m) =>
      regla.sistemas.includes(m.sistema) &&
      (!regla.tipoIncluye || m.tipo_rol.toUpperCase().includes(regla.tipoIncluye.toUpperCase())),
  );
  if (lineaB === undefined) return compatibles;
  const deLaLinea = compatibles.filter((m) => esFilaLineaB(m) === lineaB);
  // Sin filas de esa línea (catálogo sin dar de alta todavía) se devuelven
  // todas: mejor cotizar con la fila de la otra línea que quedarse sin modelo.
  return deLaLinea.length > 0 ? deLaLinea : compatibles;
}

/**
 * Elige el modelo cuyo MECANISMO coincide con el color de accesorios
 * (GRIS → MEC_13_..._GRIS, BCO → ...BLANCO, etc.). Si no hay match, el primero.
 */
export function elegirModeloPorColor(
  candidatos: ModeloDespiece[],
  color: string | null | undefined,
): ModeloDespiece | null {
  if (candidatos.length === 0) return null;
  const aliases = (() => {
    const c = (color || '').toUpperCase().trim().replace(/S$/, '');
    const norm = c === 'GRISE' ? 'GRIS' : c;
    if (!norm) return [];
    const out = [norm];
    if (norm === 'BCO') out.push('BLANCO');
    if (norm === 'GRS') out.push('GRIS');
    if (norm === 'NEG') out.push('NEGRO');
    return out;
  })();
  if (aliases.length > 0) {
    const match = candidatos.find((m) => {
      const mec = m.mecanismo.toUpperCase();
      return aliases.some((a) => mec.includes(a));
    });
    if (match) return match;
  }
  return candidatos[0];
}

/**
 * Valida un ancho (m) contra TODOS los modelos de una categoría.
 * - null: fabricable (cabe en al menos un modelo) o sin catálogo para validar.
 * - string: NINGÚN modelo de la categoría lo soporta → mensaje de error.
 */
export function validarAnchoCategoria(
  modelos: ModeloDespiece[],
  categoria: string,
  anchoM: number,
  tipos?: readonly TipoCortina[],
): string | null {
  const candidatos = modelosParaCategoria(modelos, categoria, tipos);
  if (candidatos.length === 0 || anchoM <= 0) return null;
  const maxAncho = Math.max(...candidatos.map((m) => m.ancho_max_m || 0));
  if (maxAncho <= 0 || anchoM <= maxAncho) return null;
  return `Ancho ${anchoM.toFixed(2)} m no fabricable en ${categoria} (máximo ${maxAncho} m).`;
}

/**
 * Tubo a usar según el ancho de la cortina.
 * @see reglas-tuberia.ts — editar REGLAS_TUBERIA.reglaE02E66
 */
export { codigoTuboPorAncho, REGLAS_TUBERIA, tuberiaParaPano } from './reglas-tuberia';
