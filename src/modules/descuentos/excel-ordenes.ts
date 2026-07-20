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
import type { Ventana } from '@/modules/cotizador/types';
import { esCenefaCuadrada } from '@/modules/cotizador/fase2';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';
import {
  buscarAdicionalCenefaOvalada,
  cenefaOvaladaDesdeAdicional,
  esAdicionalCenefaCuadrada,
  esRollerOVertical,
  etiquetaTipInstCenefa,
  medidaCorteCenefaCuadrada,
  normalizarUbicacion,
  tiraCenefaOvalada,
  ubicPanoVentana,
} from './adicionales-cenefa';
import { colorPerfilFilaExcel } from './adicionales-perfil';
import { colorPesoInfOscuridadExcel } from './peso-oscuridad';
import {
  calcularDespiece,
  contextoDespieceDesdePano,
  COLUMNA_PESO_OSCURIDAD,
  MODELO_DESPIECE_STUB,
} from './despiece';
import { esCategoriaBeeblack } from './reglas-beeblack';

/** Columna del Excel con el color/código del peso inferior de oscuridad. */
const COLUMNA_COLOR_PESO_OSCURIDAD = 'COLOR PESO INF. SOFT LIGHT';
/** Perfil superior de cenefa profesional: misma medida que CENEFA DELANTERA. */
const COLUMNA_PERFIL_SUPERIOR = 'PERFIL SUPERIOR (CENEF.PRO)';
import { tuberiaCodigoCorto } from './reglas-tuberia';

export type OpcionesOrdenesOptimizador = {
  adicionalesFase0?: AdicionalFase0Persistido[];
};

const COLUMNAS = [
  'OT',
  'COD SEC',
  'COD_INT',
  'TUBERIA',
  'UBIC.',
  'COLOR ACCESORIOS',
  'TUBO',
  'PESO',
  'CENEFA OVALADA',
  'CENEFA DELANTERA',
  COLUMNA_PERFIL_SUPERIOR,
  'CENEFA TRASERA',
  'CON TIRA',
  'PESO U',
  'PESO INTERNO',
  COLUMNA_PESO_OSCURIDAD,
  COLUMNA_COLOR_PESO_OSCURIDAD,
  'PLETINA',
  'PERFIL (IZQ) INT',
  'COLOR PERFIL',
  'PERFIL (DER) INT',
  'PERFIL BASE',
  'PERFIL SUPERIOR (ANCHO)',
  'PERFIL INFERIOR (ANCHO)',
  'PERFIL LATERAL IZQ (ALTO)',
  'PERFIL LATERAL DER (ALTO)',
  'MANILLA IZQ (ALTO)',
  'MANILLA DER (ALTO)',
  'ANCHO TELA',
  'ALTO TELA',
  'TOTAL LAMAS CORTE',
] as const;

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
function tapaCenefaDeUbic(ventanas: Ventana[], ubicAdicional: string): string {
  const key = normalizarUbicacion(ubicAdicional);
  if (!key) return '';
  for (const v of ventanas) {
    if (!esRollerOVertical(v.categoria)) continue;
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

/**
 * Filas del cuadro de cenefas cuadradas. Aplica solo si hay adicionales de
 * cenefa cuadrada Y la OT tiene cortinas roller o vertical. ANCHO INICIAL sale
 * de la cantidad declarada del adicional (×100); el TIP. INST y el ajuste del
 * ANCHO CORTE EST. salen del "Tapas" del paño (Fase 2).
 */
function filasCenefaCuadrada(
  ventanas: Ventana[],
  adicionalesFase0: AdicionalFase0Persistido[] | undefined,
): (string | number)[][] {
  const cenefas = (adicionalesFase0 ?? []).filter(
    (a) => a.codInt && a.cantidad > 0 && esAdicionalCenefaCuadrada(a.codInt),
  );
  if (cenefas.length === 0) return [];
  if (!ventanas.some((v) => esRollerOVertical(v.categoria))) return [];
  return cenefas.map((c) => {
    const anchoInicial = Math.round(c.cantidad * 100 * 10) / 10;
    const tapa = tapaCenefaDeUbic(ventanas, c.ubicacion || '');
    return [
      anchoInicial,
      c.colorAcc || '',
      c.ubicacion || '',
      'CENEFA CUADRADA',
      etiquetaTipInstCenefa(tapa),
      medidaCorteCenefaCuadrada(anchoInicial, tapa),
      '',
      '',
      '',
    ];
  });
}

// El código del tubo se toma del que REALMENTE se eligió en el paño
// (p.tuberia), no del primer código del modelo: el operario puede cambiar
// el tubo en Fase 2 y el Excel debe reflejar esa elección (igual que el PDF
// y la etiqueta). Origen único: tuberiaCodigoCorto.
function tuberiaDe(v: Ventana, tuberiaPano: string | undefined, anchoM: number): string {
  return tuberiaCodigoCorto(v.modelo, tuberiaPano, anchoM, v.categoria);
}

/** Construye las filas del Excel de órdenes (una por paño). */
export function generarOrdenesOptimizador(
  numeroOT: string,
  ventanas: Ventana[],
  opts?: OpcionesOrdenesOptimizador,
): ResultadoOrdenes {
  const advertencias: string[] = [];
  const aoa: (string | number)[][] = [[...COLUMNAS]];
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
      const fila: Record<string, string | number> = {
        OT: numeroOT,
        'COD SEC': v.categoria || '',
        // Dual: cada paño lleva SU tela; si no, la de la ventana.
        COD_INT: ((p as { codInt?: string }).codInt as string) || v.codInt || '',
        TUBERIA: esBeeblack ? '' : tuberiaDe(v, String(p.tuberia || ''), anchoM),
        'UBIC.': ubic,
        'COLOR ACCESORIOS': (p.color as string) || v.color || '',
      };
      const puedeDespiece = anchoCm > 0 && (v.modelo || esBeeblack);
      if (puedeDespiece) {
        const ctx = contextoDespieceDesdePano(v, p);
        const modelo = v.modelo ?? MODELO_DESPIECE_STUB;
        const d = calcularDespiece(modelo, anchoCm, ctx);
        for (const c of d.cortes) {
          if (c.columnaExcel && c.columnaExcel !== 'CENEFA OVALADA') {
            fila[c.columnaExcel] = c.medidaCm;
          }
        }
        if (!esBeeblack) {
        // Color/código del peso inferior de oscuridad, junto a PESO SOFT LIGHT.
        if (celdaConMedida(fila[COLUMNA_PESO_OSCURIDAD])) {
          const colorPesoVal = colorPesoInfOscuridadExcel((p.colorPeso as string) || p.color || v.color);
          if (colorPesoVal) fila[COLUMNA_COLOR_PESO_OSCURIDAD] = colorPesoVal;
        }
        const adicCenefa = buscarAdicionalCenefaOvalada(ubic, adicionalesFase0);
        if (adicCenefa) {
          const medida = cenefaOvaladaDesdeAdicional(adicCenefa, modelo, {
            anchoPanoCm: anchoCm,
            categoria: v.categoria,
            sentido: v.sentido,
          });
          if (medida != null) {
            fila['CENEFA OVALADA'] = medida;
            fila['CON TIRA'] = tiraCenefaOvalada(p.cenefaTira as string | undefined, adicCenefa.conTira);
            if (adicCenefa.colorAcc) {
              fila['COLOR ACCESORIOS'] = adicCenefa.colorAcc;
            }
          } else {
            advertencias.push(
              `"${ubic}": adicional cenefa sin ancho válido (cantidad ${adicCenefa.cantidad}).`,
            );
          }
        } else {
          const cenefaDespiece = d.cortes.find((c) => c.columnaExcel === 'CENEFA OVALADA');
          if (cenefaDespiece) {
            fila['CENEFA OVALADA'] = cenefaDespiece.medidaCm;
            fila['CON TIRA'] = tiraCenefaOvalada(p.cenefaTira as string | undefined);
          }
        }
        if (d.aproximado) {
          advertencias.push(
            `"${ubic}": sistema de oscuridad — perfiles NO incluidos, revisar manualmente.`,
          );
        }
        const colorPerfil = colorPerfilFilaExcel(adicionalesFase0, v.categoria, {
          izq: celdaConMedida(fila['PERFIL (IZQ) INT']),
          der: celdaConMedida(fila['PERFIL (DER) INT']),
          inf: celdaConMedida(fila['PERFIL BASE']),
        });
        if (colorPerfil) fila['COLOR PERFIL'] = colorPerfil;
        // Perfil superior = misma medida que cenefa delantera (CENEF.PRO).
        if (celdaConMedida(fila['CENEFA DELANTERA'])) {
          fila[COLUMNA_PERFIL_SUPERIOR] = fila['CENEFA DELANTERA'];
        }
        }
      }
      aoa.push(COLUMNAS.map((col) => fila[col] ?? ''));
    });
  }

  // Filas reales de paños (antes de anexar el cuadro de cenefas cuadradas).
  const filasPanos = aoa.length - 1;

  // Cuadro de cenefas cuadradas: misma hoja, separado por una fila en blanco
  // (la fila vacía corta la lectura automática del optimizador legacy).
  const cenefaRows = filasCenefaCuadrada(ventanas, adicionalesFase0);
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
  ws['!cols'] = [
    { wch: 7 }, { wch: 26 }, { wch: 10 }, { wch: 16 }, { wch: 18 },
    { wch: 12 }, { wch: 9 }, { wch: 9 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
    { wch: 10 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 20 }, { wch: 9 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ORDENES');
  XLSX.writeFile(wb, `ordenes_OT${numeroOT}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return res;
}
