// ─────────────────────────────────────────────────────────────────────
// Genera el EXCEL DE ÓRDENES para el Optimizador desde las ventanas de
// la OT, con las medidas de corte calculadas por el motor de despiece.
// Reemplaza la planilla manual de descuentos (causa de los cortes +3mm).
//
// El formato replica el que el optimizador legacy ya sabe leer
// (detectarColumnasExcel + multi-corte): OT, COD SEC, TUBERIA (extrae el
// código del último segmento tras "_"), UBIC., COLOR ACCESORIOS y una
// columna por componente (TUBO, PESO, CENEFA OVALADA, CON TIRA, PESO U,
// PESO INTERNO, PESO SOFT LIGHT, PLETINA).
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { CatalogoProductos, Pano, Ventana } from '@/modules/cotizador/types';
import { esLineaB } from '@/modules/cotizador/lineaB';
import { esCenefaCuadrada } from '@/modules/cotizador/fase2';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import {
  buscarAdicionalCenefaOvalada,
  candidatosCenefaEnUbic,
  cenefaAdicionalEsDelPano,
  cenefaOvaladaDesdeAdicional,
  esAdicionalCenefaCuadrada,
  esRollerOVertical,
  etiquetaTipInstCenefa,
  medidaCorteCenefaCuadrada,
  normalizarUbicacion,
  tiraCenefaOvalada,
  ubicPanoVentana,
} from './adicionales-cenefa';
import { colorAccesoriosDePano } from './chips';
import { colorPerfilFilaExcel, colorPerfilSistemaDesdeAdicional } from './adicionales-perfil';
import { colorPesoInfOscuridadExcel } from './peso-oscuridad';
import { esCategoriaPletina, esCategoriaVertical } from './reglas-mecanismo';
import {
  calcularDespiece,
  contextoDespieceDesdePano,
  COLUMNA_PESO_OSCURIDAD,
  MODELO_DESPIECE_STUB,
} from './despiece';
import { esCategoriaBeeblack } from './reglas-beeblack';
import type { FormulasFamilias } from './formulasFamilias';
import type { ParametrosCorte } from '@/modules/cotizador/parametrosCorte';

/** Columna del Excel con el color/código del peso inferior de oscuridad. */
const COLUMNA_COLOR_PESO_OSCURIDAD = 'COLOR PESO INF. SOFT LIGHT';
/** Perfil superior de cenefa profesional (oscuranti): rectangular 50×25
 *  E50/E49/E52, misma medida que CENEFA DELANTERA. Lo emite el despiece. */
const COLUMNA_PERFIL_SUPERIOR = 'PERFIL SUPERIOR (CENEF.PRO)';
import { tuberiaCodigoCorto } from './reglas-tuberia';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from './reglasSeleccion';
import type { TipoCortina } from './tiposCortina';

export type OpcionesOrdenesOptimizador = {
  adicionalesFase0?: AdicionalFase0Persistido[];
  /** Parámetros de corte de la empresa (hoy los usa el despiece vertical). */
  params?: ParametrosCorte;
  /** Fórmulas de corte editadas en Admin (sin esto, las de fábrica). */
  formulas?: FormulasFamilias;
  /** Reglas de tubería/mecanismo editadas en Admin (sin esto, las de fábrica). */
  reglas?: ReglasSeleccion;
  /** Catálogo de telas: resuelve la categoría (A o B) de cada paño para la
   *  columna CATEGORIA, que le dice al optimizador de qué barra cortar. */
  catalogo?: CatalogoProductos;
};

export const COLUMNAS = [
  'OT',
  'COD SEC',
  'COD_INT',
  'TUBERIA',
  'UBIC.',
  'COLOR ACCESORIOS',
  // Categoría de fabricación: 'B' = gama económica (otras barras de peso y
  // cenefa). El optimizador la lee para elegir la barra; vacío = categoría A.
  'CATEGORIA',
  'TUBO',
  'PESO',
  'CENEFA OVALADA',
  'CENEFA DELANTERA',
  COLUMNA_PERFIL_SUPERIOR,
  'CENEFA TRASERA',
  // Cenefa cuadrada suelta (adicional CENF C de roller/vertical): una fila
  // propia por cenefa con la medida de corte, para que el optimizador la corte
  // de la barra E29/E30/E31. Antes solo iba en el cuadro informativo de abajo
  // — que el optimizador saltea — y esa estructura no se cortaba nunca.
  'CENEFA CUADRADA',
  'CON TIRA',
  'PESO U',
  'PESO INTERNO',
  COLUMNA_PESO_OSCURIDAD,
  COLUMNA_COLOR_PESO_OSCURIDAD,
  'PLETINA',
  'TELA Y PLETINA',
  'PERFIL (IZQ) INT',
  'PERF. (IZQ)',
  'COLOR PERFIL',
  'PERFIL (DER) INT',
  'PERF. (DER)',
  'PERFIL BASE',
  'PERF. BASE',
  // Separadores (E41/E42/E43): TODOS opcionales, se piden por paño. El superior
  // no es exclusivo de oscuranti ni automático — el perfil rectangular 50×25 que
  // sí va siempre en oscuranti es PERFIL SUPERIOR (CENEF.PRO), más arriba.
  'SEPARADOR (IZQ)',
  'SEPARADOR (DER)',
  'SEPARADOR BASE',
  'SEPARADOR SUPERIOR',
  'PERFIL SUPERIOR (ANCHO)',
  'PERFIL INFERIOR (ANCHO)',
  'PERFIL LATERAL IZQ (ALTO)',
  'PERFIL LATERAL DER (ALTO)',
  'MANILLA IZQ (ALTO)',
  'MANILLA DER (ALTO)',
  'ANCHO TELA',
  'ALTO MESA DE CORTE',
  'ALTO TELA',
  'TOTAL LAMAS CORTE',
  // ── VERTICAL (lamas): al optimizador de ESTRUCTURA solo van los dos cortes de
  //    aluminio (perfil cabezal + varilla). Carritos/lamas/repuesto/alto de la
  //    tela son cantidades/medidas de referencia — viven en el Cálculo General,
  //    NO en este Excel (el optimizador de estructura las ignora).
  'PERFIL CABEZAL',
  'VARILLA',
] as const;

/** Extra de la pletina DÚO sobre el alto para la mesa de corte (cm). */
const EXTRA_MESA_PLETINA_DUO_CM = 10;

/** Columna de PERFORACIÓN (INTERNO/EXTERNO) que acompaña a cada columna de perfil. */
const PERF_POR_PERFIL: Record<string, string> = {
  'PERFIL (IZQ) INT': 'PERF. (IZQ)',
  'PERFIL (DER) INT': 'PERF. (DER)',
  'PERFIL BASE': 'PERF. BASE',
};

/**
 * Rótulos que se MUESTRAN en el encabezado del Excel (fila 0). La CLAVE interna
 * de cada columna (routing de cortes/perforación en `fila[...]`, `columnaExcel`,
 * `PERF_POR_PERFIL`) NO cambia — solo el texto visible. El optimizador legacy
 * detecta las columnas por este rótulo (ver optimizador.html: COLUMNAS_CORTE y
 * los `buscar` de COLUMNAS_ESPECIFICAS).
 */
const ENCABEZADOS_DISPLAY: Record<string, string> = {
  'PERFIL (IZQ) INT': 'PERFIL (IZQ)',
  'PERFIL (DER) INT': 'PERFIL (DER)',
  'PERF. (IZQ)': 'TIPO DE PERFORACIÓN (IZQ)',
  'PERF. (DER)': 'TIPO DE PERFORACIÓN (DER)',
  'PERF. BASE': 'TIPO DE PERFORACIÓN (BASE)',
};

function celdaConMedida(val: string | number | undefined): boolean {
  return val !== undefined && val !== '' && val !== 0;
}

export type ResultadoOrdenes = {
  aoa: (string | number)[][];
  filas: number;
  advertencias: string[];
};

// Cuadro "CENEFAS CUADRADAS PARA VERTICALES O ROLLER" que se anexa a la hoja
// de órdenes (regla del negocio). Las 3 últimas columnas van en blanco: las
// completa el cortador a mano.
const CENEFA_CUADRADA_TITULO = 'CENEFAS CUADRADAS PARA VERTICALES O ROLLER';
const CENEFA_CUADRADA_COLUMNAS = [
  'ANCHO INICIAL',
  'COLOR',
  'UBICACIÓN',
  'PRODUCTO',
  'TIP. INST',
  'ANCHO CORTE EST.',
  'MEDIDA DE SOBRANTE [ ANCHO ]',
  '¿SE UTILIZÓ SOBRANTE DE COLMENA?',
  'DE SER ASÍ, INDICA DE QUÉ COLMENA',
] as const;

// TIP. INST de una cenefa: sale del campo "Tapas" (cenefaTapa) del paño con
// cenefa cuadrada cuya UBIC. corresponde al adicional (fuente única en Fase 2).
// La UBIC. del adicional suele ser general ("LIVING") y la del paño específica
// ("LIVING-G1"), por eso se matchea por prefijo.
function tapaCenefaDeUbic(
  ventanas: Ventana[],
  ubicAdicional: string,
  tipos?: readonly TipoCortina[],
): string {
  const key = normalizarUbicacion(ubicAdicional);
  if (!key) return '';
  for (const v of ventanas) {
    if (!esRollerOVertical(v.categoria, tipos)) continue;
    const panos = v.panos || [];
    for (let i = 0; i < panos.length; i++) {
      const p = panos[i];
      if (!esCenefaCuadrada(p.cenefa as string)) continue;
      const ubic = normalizarUbicacion(ubicPanoVentana(v.ubicacion || '', i, panos.length));
      if (ubic === key || ubic.startsWith(key)) return (p.cenefaTapa as string) || '';
    }
  }
  return '';
}

/** Una cenefa cuadrada de la OT, con su medida de corte ya calculada. */
type CenefaCuadradaOT = {
  anchoInicial: number;
  color: string;
  ubicacion: string;
  tapa: string;
  codInt: string;
  corte: number;
};

/**
 * Las cenefas cuadradas de la OT (adicionales de Fase 1). Aplica solo si hay
 * adicionales de cenefa cuadrada Y la OT tiene cortinas roller o vertical.
 * ANCHO INICIAL sale de la cantidad declarada del adicional (×100); el
 * TIP. INST y el ajuste del ANCHO CORTE EST. salen del "Tapas" del paño
 * (Fase 2). Fuente única para el cuadro informativo Y las filas de corte.
 */
function cenefasCuadradasDeOT(
  ventanas: Ventana[],
  adicionalesFase0: AdicionalFase0Persistido[] | undefined,
  formulas?: FormulasFamilias,
  tipos?: readonly TipoCortina[],
): CenefaCuadradaOT[] {
  const cenefas = (adicionalesFase0 ?? []).filter(
    (a) => a.codInt && a.cantidad > 0 && esAdicionalCenefaCuadrada(a.codInt),
  );
  if (cenefas.length === 0) return [];
  if (!ventanas.some((v) => esRollerOVertical(v.categoria, tipos))) return [];
  return cenefas.map((c) => {
    const anchoInicial = Math.round(c.cantidad * 100 * 10) / 10;
    const tapa = tapaCenefaDeUbic(ventanas, c.ubicacion || '', tipos);
    return {
      anchoInicial,
      color: c.colorAcc || '',
      ubicacion: c.ubicacion || '',
      tapa,
      codInt: c.codInt,
      corte: medidaCorteCenefaCuadrada(anchoInicial, tapa, formulas),
    };
  });
}

/** Filas del cuadro informativo de cenefas cuadradas (lo completa el cortador). */
function filasCenefaCuadrada(cenefas: CenefaCuadradaOT[]): (string | number)[][] {
  return cenefas.map((c) => [
    c.anchoInicial,
    c.color,
    c.ubicacion,
    'CENEFA CUADRADA',
    etiquetaTipInstCenefa(c.tapa),
    c.corte,
    '',
    '',
    '',
  ]);
}

// El código del tubo se toma del que REALMENTE se eligió en el paño
// (p.tuberia), no del primer código del modelo: el operario puede cambiar
// el tubo en Fase 2 y el Excel debe reflejar esa elección (igual que el PDF
// y la etiqueta). Origen único: tuberiaCodigoCorto.
function tuberiaDe(
  v: Ventana,
  tuberiaPano: string | undefined,
  anchoM: number,
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  lineaB = false,
): string {
  return tuberiaCodigoCorto(v.modelo, tuberiaPano, anchoM, v.categoria, reglas.tuberia, lineaB);
}

/** Construye las filas del Excel de órdenes (una por paño). */
export function generarOrdenesOptimizador(
  numeroOT: string,
  ventanas: Ventana[],
  opts?: OpcionesOrdenesOptimizador,
): ResultadoOrdenes {
  const advertencias: string[] = [];
  const aoa: (string | number)[][] = [COLUMNAS.map((c) => ENCABEZADOS_DISPLAY[c] ?? c)];
  const adicionalesFase0 = opts?.adicionalesFase0;

  for (const v of ventanas) {
    const panos = v.panos || [];
    const esBeeblack = esCategoriaBeeblack(v.categoria);
    if (!v.modelo && !esBeeblack) {
      advertencias.push(
        `"${v.ubicacion || v.id}" no tiene modelo de fabricación: va sin medidas de corte (completar en Fase 2).`,
      );
    }
    panos.forEach((p, i) => {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const anchoCm = anchoM * 100;
      const ubic = ubicPanoVentana(v.ubicacion || '', i, panos.length);
      const lineaB = esLineaB(p as Pano, v.codInt, opts?.catalogo, v.categoria, opts?.reglas?.mecanismo, opts?.reglas?.tipos);
      const fila: Record<string, string | number> = {
        OT: numeroOT,
        'COD SEC': v.categoria || '',
        // Dual: cada paño lleva SU tela; si no, la de la ventana.
        COD_INT: ((p as { codInt?: string }).codInt as string) || v.codInt || '',
        TUBERIA: esBeeblack ? '' : tuberiaDe(v, String(p.tuberia || ''), anchoM, opts?.reglas, lineaB),
        'UBIC.': ubic,
        // Mismo resolutor que Fase 2 y el BOM: `p.color` a secas se
        // desalineaba del resto cuando el paño traía colorMecanismo propio.
        'COLOR ACCESORIOS': colorAccesoriosDePano(p, v.color),
        // Solo la categoría B se marca: el optimizador lee la celda vacía como A.
        CATEGORIA: lineaB ? 'B' : '',
      };
      const puedeDespiece = anchoCm > 0 && (v.modelo || esBeeblack);
      if (puedeDespiece) {
        const ctx = contextoDespieceDesdePano(v, p, {
          verticalExtraAltoCm: opts?.params?.extraVerticalCm,
          verticalDctoAltoFinalCm: opts?.params?.dctoAltoFinalVerticalCm,
          formulas: opts?.formulas,
          tipos: opts?.reglas?.tipos,
          // Para que el PESO INTERNO se rotule con el código de SU línea
          // (E13 en la A; E79-B/E71-B por color en la B).
          lineaB,
          colores: opts?.reglas?.colores,
        });
        const modelo = v.modelo ?? MODELO_DESPIECE_STUB;
        const d = calcularDespiece(modelo, anchoCm, ctx);
        // Vertical: al Excel de órdenes (optimizador de estructura) solo van los
        // cortes de aluminio; el resto del despiece (carritos/lamas/alto de tela)
        // es referencia y no debe ensuciar el archivo.
        const esVert = esCategoriaVertical(v.categoria);
        // BEEBLACK doble (screen + blackout): UNA estructura y DOS telas. El 2º
        // paño trae solo su tela, así que no repite los PERFILES — mismo criterio
        // que el dual roller con las fijaciones (bom.ts `omitirFijaciones`). Las
        // MANILLAS sí pasan: hay una por tela y su toggle vive en cada paño, así
        // que la del blackout (paño 2) se perdía y el taller no la cortaba.
        const bbSegundaTela = esBeeblack && !!p.dual && i > 0;
        const esCorteManilla = (col: string) => col.startsWith('MANILLA ');
        for (const c of d.cortes) {
          if (!c.columnaExcel || c.columnaExcel === 'CENEFA OVALADA') continue;
          if (bbSegundaTela && !esCorteManilla(c.columnaExcel)) continue;
          if (esVert && c.columnaExcel !== 'PERFIL CABEZAL' && c.columnaExcel !== 'VARILLA') continue;
          // Perfil de oscuridad sin superficie (muro/piso) elegida: medida pendiente
          // → celda vacía + advertencia (se llena en Fase 2). Los demás cortes van.
          if (c.medidaCm <= 0) continue;
          fila[c.columnaExcel] = c.medidaCm;
        }
        // Perforación (INTERNO/EXTERNO) de los perfiles de oscuridad → columnas
        // PERF. El taller las lee junto a la medida. Advertencia si un perfil está
        // activo pero le falta la medida (superficie) o la perforación (SEMI). Los
        // separadores no llevan perforación: solo avisan si les falta la medida.
        for (const c of d.cortes) {
          const esSeparador = c.columnaExcel.startsWith('SEPARADOR');
          const perfCol = PERF_POR_PERFIL[c.columnaExcel];
          if (!perfCol && !esSeparador) continue;
          if (perfCol && c.perforacion) fila[perfCol] = c.perforacion;
          const faltaPerf = !esSeparador && !c.perforacion;
          if (c.pendienteMedida || faltaPerf) {
            const falta = [
              c.pendienteMedida ? (esSeparador ? 'medida' : 'medida (muro/piso/marco)') : null,
              faltaPerf ? 'perforación (int/ext)' : null,
            ]
              .filter(Boolean)
              .join(' y ');
            advertencias.push(`"${ubic}": perfil ${c.componente} — definir ${falta} en Fase 2.`);
          }
        }
        // Pletina (velcro): altos exactos como el Excel manual. Roller → ALTO
        // TELA = alto; dúo → ALTO TELA = 2×alto y ALTO MESA DE CORTE = alto + 10.
        if (esCategoriaPletina(v.categoria, opts?.reglas?.tipos)) {
          const altoP = Math.round((parseFloat(String(v.alto ?? p.alto ?? 0)) || 0) * 100);
          if (modelo.sistema === 'PLETINA_DUO') {
            fila['ALTO TELA'] = altoP * 2;
            fila['ALTO MESA DE CORTE'] = altoP + EXTRA_MESA_PLETINA_DUO_CM;
          } else {
            fila['ALTO TELA'] = altoP;
          }
        }
        // BEEBLACK: sus perfiles y separadores también se cortan por COLOR PERFIL
        // en el optimizador, pero no pasan por los adicionales de perfil de la
        // oscuridad: el color sale del propio paño.
        if (esBeeblack) {
          const colorBb = String((p.color as string) || v.color || '').trim();
          if (colorBb && d.cortes.some((c) => c.columnaExcel && c.medidaCm > 0)) {
            fila['COLOR PERFIL'] = colorBb;
          }
        }
        if (!esBeeblack) {
        // Color/código del peso inferior de oscuridad, junto a PESO SOFT LIGHT.
        if (celdaConMedida(fila[COLUMNA_PESO_OSCURIDAD])) {
          const colorPesoVal = colorPesoInfOscuridadExcel((p.colorPeso as string) || p.color || v.color, opts?.reglas?.colores);
          if (colorPesoVal) fila[COLUMNA_COLOR_PESO_OSCURIDAD] = colorPesoVal;
        }
        // La cenefa comprada es de UNA cortina: con varias en la misma UBIC. se
        // resuelve por categoría (la que la lleva por diseño se la queda) y, si
        // empatan, por el ancho más parecido a la cantidad del adicional.
        const adicCenefa = buscarAdicionalCenefaOvalada(ubic, adicionalesFase0);
        const candidatosCenefa = candidatosCenefaEnUbic(ubic, ventanas);
        const cenefaEsDeEstaCortina =
          !!adicCenefa &&
          cenefaAdicionalEsDelPano(
            adicCenefa,
            { ventanaId: String(v.id ?? ''), panoIndex: i },
            candidatosCenefa,
            opts?.reglas?.tipos,
          );
        if (adicCenefa && cenefaEsDeEstaCortina && candidatosCenefa.length > 1) {
          advertencias.push(
            `"${ubic}": ${candidatosCenefa.length} cortinas comparten esa ubicación y hay una sola cenefa comprada — se asignó a "${v.codInt || v.categoria || 'esta cortina'}" (${anchoM} m). Si va en otra, separa las ubicaciones en la cotización.`,
          );
        }
        if (adicCenefa && cenefaEsDeEstaCortina) {
          // La variante va en el MISMO orden que el despiece de este paño
          // (despiece.ts): si no, la cenefa del adicional salía INTERNO y el
          // tubo/peso EXTERNO para la misma cortina (OT 3196).
          const medida = cenefaOvaladaDesdeAdicional(
            adicCenefa,
            modelo,
            {
              anchoPanoCm: anchoCm,
              categoria: v.categoria,
              oscuridadVariante:
                (p.oscuridadVariante as string | undefined) ?? v.oscuridadVariante,
              sentido: v.sentido,
              tipos: opts?.reglas?.tipos,
            },
            opts?.formulas,
          );
          if (medida != null) {
            fila['CENEFA OVALADA'] = medida;
            fila['CON TIRA'] = tiraCenefaOvalada(p.cenefaTira as string | undefined, adicCenefa.conTira, lineaB);
            if (adicCenefa.colorAcc) {
              fila['COLOR ACCESORIOS'] = adicCenefa.colorAcc;
            }
          } else {
            advertencias.push(
              `"${ubic}": adicional cenefa sin ancho válido (cantidad ${adicCenefa.cantidad}).`,
            );
          }
        } else {
          // Soft Light "normal": el motor de oscuridad ya emite la cenefa con
          // columna CENEFA OVALADA, así que SIEMPRE viaja al Excel aunque no haya
          // un adicional CENF O (la corta el taller). CC/Dark van por otra columna.
          const cenefaDespiece = d.cortes.find((c) => c.columnaExcel === 'CENEFA OVALADA');
          if (cenefaDespiece) {
            fila['CENEFA OVALADA'] = cenefaDespiece.medidaCm;
            fila['CON TIRA'] = tiraCenefaOvalada(p.cenefaTira as string | undefined, undefined, lineaB);
          }
        }
        if (d.aproximado) {
          advertencias.push(
            `"${ubic}": sistema de oscuridad — perfiles NO incluidos, revisar manualmente.`,
          );
        }
        // El PERFIL SUPERIOR (oscuranti, rectangular 50×25) también necesita COLOR
        // PERFIL para que el optimizador le asigne E50/E49/E52, aunque los laterales
        // estén pendientes: habilita la búsqueda por los tres lados (izq → der → inf).
        const perfilSup = celdaConMedida(fila[COLUMNA_PERFIL_SUPERIOR]);
        const perfilesActivos = {
          izq: celdaConMedida(fila['PERFIL (IZQ) INT']) || celdaConMedida(fila['SEPARADOR (IZQ)']) || perfilSup,
          der: celdaConMedida(fila['PERFIL (DER) INT']) || celdaConMedida(fila['SEPARADOR (DER)']) || perfilSup,
          inf: celdaConMedida(fila['PERFIL BASE']) || celdaConMedida(fila['SEPARADOR BASE']) || perfilSup,
        };
        // El DARK no se compra por lado: su adicional es UNO por ventana
        // («SISTEMA DARK ROLLER», con su color), así que cuando no hay un
        // P-IZQ/P-DER/P-INF que mande, el color sale de ahí. Sin ninguno de los
        // dos la celda queda vacía y el taller usa COLOR ACCESORIOS, como antes.
        const colorPerfil =
          colorPerfilFilaExcel(adicionalesFase0, v.categoria, perfilesActivos) ||
          (perfilesActivos.izq || perfilesActivos.der || perfilesActivos.inf
            ? colorPerfilSistemaDesdeAdicional(adicionalesFase0, ubic)
            : '');
        if (colorPerfil) fila['COLOR PERFIL'] = colorPerfil;
        }
      }
      aoa.push(COLUMNAS.map((col) => fila[col] ?? ''));
    });
  }

  // Las cenefas cuadradas sueltas TAMBIÉN son cortes: cada una entra como fila
  // de la tabla principal (columna CENEFA CUADRADA + COLOR PERFIL) para que el
  // optimizador la corte de la barra E29/E30/E31. El cuadro de abajo es solo
  // informativo y el optimizador lo saltea a propósito.
  const cenefas = cenefasCuadradasDeOT(ventanas, adicionalesFase0, opts?.formulas, opts?.reglas?.tipos);
  for (const c of cenefas) {
    const fila: Record<string, string | number> = {
      OT: numeroOT,
      'COD SEC': 'CENEFA CUADRADA',
      COD_INT: c.codInt,
      'UBIC.': c.ubicacion,
      'COLOR PERFIL': c.color,
      'CENEFA CUADRADA': c.corte,
    };
    aoa.push(COLUMNAS.map((col) => fila[col] ?? ''));
  }

  // Filas reales de cortes (antes de anexar el cuadro informativo).
  const filasPanos = aoa.length - 1;

  // Cuadro de cenefas cuadradas: misma hoja, separado por una fila en blanco.
  // OJO: la fila vacía NO corta la lectura del optimizador legacy (solo la
  // saltea); lo que corta es el TÍTULO — el optimizador hace break al verlo
  // (optimizador.html v5.19). Si se renombra el título, ajustar allá también.
  const cenefaRows = filasCenefaCuadrada(cenefas);
  if (cenefaRows.length) {
    aoa.push([]);
    aoa.push([CENEFA_CUADRADA_TITULO]);
    aoa.push([...CENEFA_CUADRADA_COLUMNAS]);
    for (const r of cenefaRows) aoa.push(r);
  }

  return { aoa, filas: filasPanos, advertencias };
}

/** Descarga el Excel de órdenes. */
export function descargarExcelOrdenes(
  numeroOT: string,
  ventanas: Ventana[],
  opts?: OpcionesOrdenesOptimizador,
): ResultadoOrdenes {
  const res = generarOrdenesOptimizador(numeroOT, ventanas, opts);
  const ws = XLSX.utils.aoa_to_sheet(res.aoa);
  // Un ancho por columna, en el MISMO orden que COLUMNAS (posicional).
  ws['!cols'] = [
    { wch: 7 }, { wch: 26 }, { wch: 10 }, { wch: 16 }, { wch: 18 },
    { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 10 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 20 }, { wch: 9 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    // Beeblack (perfiles / manillas / tela / lamas)
    { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 17 },
    { wch: 17 }, { wch: 11 }, { wch: 18 }, { wch: 10 }, { wch: 17 },
    // Vertical (solo perfil cabezal + varilla)
    { wch: 15 }, { wch: 9 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ORDENES');
  XLSX.writeFile(wb, `ordenes_OT${numeroOT}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return res;
}
