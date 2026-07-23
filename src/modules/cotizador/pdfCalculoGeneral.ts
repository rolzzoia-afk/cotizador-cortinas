// ─────────────────────────────────────────────────────────────────────
// PDF "CALCULO GENERAL" — hoja maestra que junta TODO el despiece de la OT.
//
// Una fila por cortina (paño) con las columnas de identidad (producto, ubic,
// medidas) + el despiece calculado por el MISMO motor que el Excel de órdenes
// (calcularDespiece), agrupado por SISTEMA (Roller/Blackout, Soft Light,
// Oscuranti, Dark, Beeblack).
//
// Dinámico: cada bloque de sistema aparece solo si la OT tiene ese producto, y
// dentro de cada bloque/columna se ocultan las que quedan sin datos.
//
// Lógica pura salvo `generarPdfCalculoGeneral`, que toca el DOM (jsPDF).
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import type { Ventana } from '@/modules/cotizador/types';
import type { CatalogoProductos } from '@/modules/cotizador/types';
import {
  calcularDespiece,
  contextoDespieceDesdePano,
  MODELO_DESPIECE_STUB,
} from '@/modules/descuentos/despiece';
import { familiaOscuridad, normalizarVarianteOscuridad } from '@/modules/descuentos/reglas-oscuridad';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { esCategoriaPletina, esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { descripcionTuberia, tuberiaCodigoCorto } from '@/modules/descuentos/reglas-tuberia';
import { tiraCenefaOvalada, ubicPanoVentana } from '@/modules/descuentos/adicionales-cenefa';
import { mecanismoParaPano } from '@/modules/descuentos/chips';
import { OPCIONES_MECANISMO_RESOLUCION } from './fase2';
import { colorPesoCadena } from './cadenas';
import { telaDePano } from './telaPano';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';

type RGB = [number, number, number];

export type BloqueSistema = { key: string; label: string; color: RGB };

const BLOQUES: Record<string, BloqueSistema> = {
  ROLLER: { key: 'ROLLER', label: 'ROLLER SCREEN O BLACKOUT', color: [112, 48, 160] },
  SOFT: { key: 'SOFT', label: 'SOFT LIGHT', color: [31, 78, 121] },
  OSCU: { key: 'OSCU', label: 'OSCURANTI', color: [192, 80, 77] },
  DARK: { key: 'DARK', label: 'DARK', color: [55, 55, 60] },
  BEEBLACK: { key: 'BEEBLACK', label: 'BEEBLACK', color: [51, 63, 80] },
  VERTICAL: { key: 'VERTICAL', label: 'VERTICAL', color: [56, 118, 29] },
};

function bloqueDe(categoria: string | undefined, cenefaTipo: string | undefined): BloqueSistema {
  if (esCategoriaVertical(categoria)) return BLOQUES.VERTICAL;
  if (esCategoriaBeeblack(categoria)) return BLOQUES.BEEBLACK;
  const fam = familiaOscuridad(categoria, cenefaTipo);
  if (fam === 'OSCURANTI') return BLOQUES.OSCU;
  if (fam === 'DARK') return BLOQUES.DARK;
  if (fam) return BLOQUES.SOFT; // SOFT_LIGHT_38/45/CC
  return BLOQUES.ROLLER;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: number) => String(parseFloat(v.toFixed(2))).replace('.', ',');

/** ¿La celda tiene dato? (vacío, 0 o undefined = sin dato → se oculta). */
function conDato(v: string | number | undefined): boolean {
  return v !== undefined && v !== '' && v !== 0;
}

export type FilaCalculo = {
  codSec: string;
  tuberia: string;
  /** tipo_rol del modelo (ROL_MANUAL_CENEFA_OV…) — columna TIPO del inventario. */
  tipoRol: string;
  codMecanismo: string;
  accionamiento: string;
  pesoCadena: string;
  // Campos crudos de cadena/peso: el inventario (Fase 4) compone con ellos su
  // descripción larga; el Cálculo General usa las versiones compactas de arriba.
  codCadena: string;
  largoCadena: string;
  colorCadena: string;
  codPeso: string;
  suplementos: string;
  manillas: string;
  /** Letra de "cortar junto" (A/B/RR…) para la columna CONJUNTO PAÑOS del Dimensionado. */
  conjunto: string;
  cant: number;
  producto: string;
  codInt: string;
  descripcion: string;
  ubic: string;
  colorAcc: string;
  cadena: string;
  armado: string;
  anchoMts: number;
  altoMts: number;
  anchoCorteCm: number;
  altoRollerCm: number;
  altoDuoCm: number;
  bloque: string; // key del BloqueSistema
  despiece: Map<string, number | string>; // componente → medida/valor
};

export type ColumnaCalculo = {
  key: string;
  label: string;
  /** Bloque al que pertenece (undefined = columna de identidad). */
  bloque?: BloqueSistema;
};

export type CalculoGeneral = {
  filas: FilaCalculo[];
  /** Columnas de identidad visibles (con datos). */
  identidad: ColumnaCalculo[];
  /** Bloques de sistema presentes, con sus columnas (con datos). */
  bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[];
};

// Columnas de identidad que SÍ importan (orden y etiquetas según la hoja
// manual); se ocultan las que quedan sin datos. Las demás columnas que el
// motor calcula (codSec, codMecanismo, accionamiento, pesoCadena, suplementos,
// manillas, ancho corte / alto roller / alto duo) se siguen computando en
// FilaCalculo —las usa el INVENTARIO— pero NO se muestran en el Cálculo general.
const IDENTIDAD: { key: keyof FilaCalculo; label: string }[] = [
  { key: 'tuberia', label: 'TUBERIA' },
  { key: 'cant', label: 'CANT' },
  { key: 'producto', label: 'PRODUCTO' },
  { key: 'codInt', label: 'COD_IN' },
  { key: 'descripcion', label: 'DESCRIPCIÓN' },
  { key: 'ubic', label: 'UBIC.' },
  { key: 'colorAcc', label: 'COLOR ACCESORIOS' },
  { key: 'cadena', label: 'CADENA/CIERRE' },
  { key: 'armado', label: 'ARMADO' },
  { key: 'anchoMts', label: 'ANCHO REAL' },
  { key: 'altoMts', label: 'ALTO REAL' },
];

const NUM_IDENTIDAD = new Set<keyof FilaCalculo>(['anchoMts', 'altoMts']);

/** Construye los datos de la hoja CALCULO GENERAL para las ventanas de una OT. */
export function construirCalculoGeneral(
  ventanas: Ventana[],
  catalogo: CatalogoProductos = {},
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  /** Letras de "cortar junto" por pieza (`${ventanaId}_${panoIndex}` → letra). */
  juntoPorPieza?: Map<string, string>,
  /** Dimensionado: en filas dúo reemplaza la columna ALTO por ALTO MESA DE CORTE.
   *  usarTuboE78: habilita la banda 2,2–3,0 m (kit 45 mm/E78) para esta OT. */
  opts?: { altoMesaCorteDuo?: boolean; usarTuboE78?: boolean },
): CalculoGeneral {
  const filas: FilaCalculo[] = [];

  for (const v of ventanas) {
    const panos = v.panos || [];
    panos.forEach((p, i) => {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const altoM = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
      const anchoCm = anchoM * 100;
      const altoCm = altoM * 100;
      const esBee = esCategoriaBeeblack(v.categoria);
      const bloque = bloqueDe(v.categoria, p.cenefa as string);

      const famOscFila = familiaOscuridad(v.categoria, p.cenefa as string | undefined);
      const despiece = new Map<string, number | string>();
      if (anchoCm > 0 && (v.modelo || esBee)) {
        const ctx = contextoDespieceDesdePano(v, p, {
          verticalExtraAltoCm: params.extraVerticalCm,
          verticalDctoAltoFinalCm: params.dctoAltoFinalVerticalCm,
        });
        const modelo = v.modelo ?? MODELO_DESPIECE_STUB;
        const d = calcularDespiece(modelo, anchoCm, ctx);
        // Oscuridad: los dos perfiles laterales van juntos en UNA columna PERFIL
        // LATERAL (medida + perforación, "210 INT / 200 EXT"); el inferior en
        // PERFIL BASE. Se acumulan aquí porque son cortes separados.
        const perfLateral: string[] = [];
        for (const c of d.cortes) {
          // Token de perfil: medida (o "definir F2" si falta) + perforación INT/EXT.
          const perfTag =
            c.perforacion === 'INTERNO' ? ' INT' : c.perforacion === 'EXTERNO' ? ' EXT' : '';
          if (/^Perfil (izquierdo|derecho)/.test(c.componente)) {
            const med = c.pendienteMedida ? 'definir F2' : String(c.medidaCm);
            perfLateral.push(`${med}${perfTag}`.trim());
            continue;
          }
          if (/^Perfil inferior/.test(c.componente)) {
            const med = c.pendienteMedida ? 'definir F2' : String(c.medidaCm);
            despiece.set('PERFIL BASE', `${med}${perfTag}`.trim());
            continue;
          }
          if (c.medidaCm <= 0) continue;
          let comp = c.componente.toUpperCase();
          // La CENEFA OVALADA se separa en dos columnas según la tira de aluminio
          // del paño: "CENEFA OVALADA (CON TIRA)" / "(SIN TIRA)". La medida de
          // corte es la misma; solo cambia la etiqueta. Cada paño llena una.
          if (comp === 'CENEFA OVALADA') {
            comp = `CENEFA OVALADA (${tiraCenefaOvalada(p.cenefaTira as string | undefined)})`;
          }
          // Oscuridad: "TELA (ANCHO)" se muestra como TELA (como la planilla manual).
          if (comp === 'TELA (ANCHO)' && famOscFila) comp = 'TELA';
          despiece.set(comp, c.medidaCm);
        }
        if (perfLateral.length > 0) {
          // Si izq y der miden/perforan igual, no repetir el token.
          const uniq = perfLateral.every((t) => t === perfLateral[0]) ? [perfLateral[0]] : perfLateral;
          despiece.set('PERFIL LATERAL', uniq.join(' / '));
        }
      }
      // Soft light: cada fila muestra SU tipo (variante INTERNO/SEMI/EXTERNO) en
      // una columna propia, al final del bloque. Independiente de la caída (ARMADO).
      if (bloque.key === 'SOFT') {
        despiece.set(
          'TIPO SOFT LIGHT',
          normalizarVarianteOscuridad(
            (p as { oscuridadVariante?: string }).oscuridadVariante ??
              (v as { oscuridadVariante?: string }).oscuridadVariante ??
              (v.sentido as string),
            'INTERNO',
          ),
        );
      }
      // Dúo: se detecta SOLO por producto, igual que el corte real (tela.ts
      // `isDuo`). NO por categoría: hay familias "DUO_MOTOR_*"/"DUO_MANUAL_*" que
      // quedan aplicadas a un roller simple (screen con motor), y ahí la tela se
      // corta simple — el dimensionado debe coincidir con el corte, no con la
      // etiqueta de la categoría.
      // Tela por paño: en dual cada paño trae SU tela; si no, la de la ventana.
      const tela = telaDePano(v, p as { codInt?: string; producto?: string; descripcion?: string });
      const esDuoFila = (tela.producto || '').toUpperCase().includes('DUO');
      const cierreCm = parseFloat(String(p.cierreAlturaCm ?? ''));
      if (esDuoFila && cierreCm > 0) despiece.set('CIERRE DE ALTURA', r1(cierreCm));
      // Columna ALTO del Excel manual: alto de CORTE de la tela del sistema
      // (dúo = 2×alto + extraDuo; resto = alto + extraAlto). Va al final del
      // bloque, igual que en la hoja manual.
      // Pletina/velcro: la tela se corta a la medida EXACTA (no lleva la vuelta
      // del tubo del roller ni el doblez extra del dúo). El ALTO MESA DE CORTE
      // del dúo sí conserva el +extraMesaDuo (=10, la mitad del alto doblado).
      // VERTICAL: el alto de corte NO es alto+25 sino alto+extraVertical, y ya
      // viene del despiece como ALTO DE CORTE (junto con ALTO FINAL), así que
      // la columna ALTO genérica se omite para no mostrar una medida falsa.
      const esVerticalFila = esCategoriaVertical(v.categoria);
      const esPletinaFila = esCategoriaPletina(v.categoria);
      const altoRollerCm = esVerticalFila
        ? r1(altoCm + params.extraVerticalCm)
        : r1(altoCm + (esPletinaFila ? 0 : params.extraAltoCm));
      const altoDuoCm = r1(altoCm * 2 + (esPletinaFila ? 0 : params.extraDuoCm));
      // Oscuridad: el alto de la tela ya viaja como columna ALTO TELA (alto+25)
      // desde el despiece; la columna ALTO genérica se omite para no duplicarla.
      if (altoCm > 0 && !esVerticalFila && !famOscFila) {
        if (opts?.altoMesaCorteDuo && esDuoFila) {
          // Dimensionado: la tela dúo se corta DOBLADA en la mesa, así que en vez
          // del ALTO se muestra ALTO MESA DE CORTE = alto + extraMesaDuo (la mitad
          // del alto de tela), igual que la hoja dúo del Excel manual.
          despiece.set('ALTO MESA DE CORTE', r1(altoCm + params.extraMesaDuoCm));
        } else {
          despiece.set('ALTO', esDuoFila ? altoDuoCm : altoRollerCm);
        }
      }

      const codCadena = (p.codCadena as string) || '';
      const largoCadena = String(p.largoCadena ?? '');
      const codPeso = (p.codPeso as string) || '';
      // Color PROPIO del peso de cadena (PCA04→TRANSPARENTE), no el de accesorios.
      const colorPeso = colorPesoCadena(p);
      const manillaCant = Number(p.manillaCant) || 0;
      // COD MECANISMO = el kit que entrega bodega, resuelto con el MISMO motor
      // que la hoja de Fase 4 (regla de categoría → kit inventario por color
      // 32/33/34, pisando los MEC legacy del modelo Excel como MEC_05/MEC_10).
      // Si no resuelve a un chip, cae al id del modelo (comportamiento previo).
      const mecChip = mecanismoParaPano(
        { ...p, mecanismo: p.mecanismo as string },
        v.color as string,
        v.modelo,
        OPCIONES_MECANISMO_RESOLUCION,
        v.categoria,
        anchoM,
        opts?.usarTuboE78 ?? false,
      );
      const codMecanismo =
        [mecChip, (p.colorMecanismo as string) || ''].filter(Boolean).join(' ') ||
        (v.modelo?.mecanismo as string) ||
        (p.mecanismo as string) ||
        '';

      filas.push({
        codSec: v.categoria || '',
        // Descripción larga del tubo ("E02-TUBO 1.2 / Ø 38 mm"). El código
        // compacto sigue en tuberiaCodigoCorto para Excel/etiqueta/tela.
        tuberia: esBee
          ? ''
          : descripcionTuberia(tuberiaCodigoCorto(v.modelo, String(p.tuberia || ''), anchoM, v.categoria)),
        tipoRol: (v.modelo?.tipo_rol as string) || '',
        codMecanismo,
        accionamiento: codCadena
          ? `[${codCadena}] ${largoCadena}`.trim()
          : largoCadena,
        pesoCadena: codPeso ? `[${codPeso}] ${colorPeso}`.trim() : colorPeso,
        codCadena,
        largoCadena,
        colorCadena: String(p.colorCadena ?? ''),
        codPeso,
        suplementos: (p.suplementos as string) || '',
        manillas: manillaCant > 0 ? `${manillaCant} ${(p.manillaColor as string) || ''}`.trim() : '',
        conjunto: juntoPorPieza?.get(`${v.id}_${i}`) ?? '',
        cant: 1,
        producto: tela.producto || '',
        codInt: tela.codInt || '',
        descripcion: catalogo[tela.codInt]?.descripcion || tela.descripcion || '',
        ubic: ubicPanoVentana(v.ubicacion || '', i, panos.length),
        colorAcc: (p.color as string) || v.color || '',
        cadena: (v.direccion as string) || '',
        armado: (p.armado as string) || (v.sentido as string) || '',
        anchoMts: r1(anchoM * 1000) / 1000,
        altoMts: r1(altoM * 1000) / 1000,
        anchoCorteCm: r1(anchoCm),
        altoRollerCm,
        // Corte real del paño dúo (2×alto+extraDuo), alineado con tela.ts y el Excel.
        altoDuoCm,
        bloque: bloque.key,
        despiece,
      });
    });
  }

  // Columnas de identidad con datos.
  const identidad: ColumnaCalculo[] = IDENTIDAD.filter((c) =>
    filas.some((f) => conDato(f[c.key] as string | number)),
  ).map((c) => ({ key: c.key, label: c.label }));

  // Bloques de sistema presentes, en orden fijo, con sus columnas de despiece
  // (solo las que tienen datos en alguna cortina de ese sistema).
  const ordenBloques = ['ROLLER', 'SOFT', 'OSCU', 'DARK', 'BEEBLACK', 'VERTICAL'];
  const bloques: { sistema: BloqueSistema; columnas: ColumnaCalculo[] }[] = [];
  for (const bk of ordenBloques) {
    const sistema = BLOQUES[bk];
    const filasBloque = filas.filter((f) => f.bloque === bk);
    if (filasBloque.length === 0) continue;
    // Columnas = componentes con datos, en orden de aparición.
    const cols: string[] = [];
    for (const f of filasBloque) {
      for (const col of f.despiece.keys()) {
        if (!cols.includes(col) && filasBloque.some((g) => conDato(g.despiece.get(col)))) {
          cols.push(col);
        }
      }
    }
    if (cols.length === 0) continue;
    // Al final del bloque (como en la hoja manual): primero ALTO MESA DE CORTE
    // (dúo del Dimensionado), luego ALTO TELA (oscuridad), ALTO y, cerrando el
    // bloque soft light, el TIPO DE SOFT.LIGHT (variante por fila).
    for (const colFin of ['ALTO MESA DE CORTE', 'ALTO TELA', 'ALTO', 'TIPO SOFT LIGHT']) {
      const idx = cols.indexOf(colFin);
      if (idx >= 0) {
        cols.splice(idx, 1);
        cols.push(colFin);
      }
    }
    bloques.push({
      sistema,
      columnas: cols.map((col) => ({
        key: col,
        label: col === 'TIPO SOFT LIGHT' ? 'TIPO DE SOFT.LIGHT' : col,
        bloque: sistema,
      })),
    });
  }

  return { filas, identidad, bloques };
}

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaCalculo = { ot: string; cliente?: string };

const C_DARK: RGB = [60, 60, 66];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [150, 150, 158];

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: RGB) {
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
}

/**
 * Envuelve una etiqueta en varias líneas que caben en `maxW`, quebrando por
 * espacios y por "/". `medir(s)` da el ancho del texto (mm). Se usa para las
 * cabeceras: mantienen el tamaño fijo (como "TUBERIA") y bajan de línea en vez
 * de encogerse. Puro y testeable (medidor inyectable).
 */
export function envolverEtiqueta(
  medir: (s: string) => number,
  label: string,
  maxW: number,
): string[] {
  const tokens = label
    .split(/\s+/)
    .flatMap((w) => {
      const partes = w.split('/');
      return partes.map((p, i) => (i < partes.length - 1 ? `${p}/` : p));
    })
    .filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const t of tokens) {
    const sep = !cur || cur.endsWith('/') ? '' : ' ';
    const probe = `${cur}${sep}${t}`;
    if (!cur || medir(probe) <= maxW) cur = probe;
    else {
      lines.push(cur);
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [label];
}

/**
 * Cabecera de columna a tamaño FIJO (9, el de "TUBERIA"), envuelta en varias
 * líneas si no cabe — para que todas las cabeceras luzcan igual, en vez de que
 * `celda` encoja las etiquetas largas.
 */
function celdaCabecera(doc: jsPDF, label: string, x: number, w: number, yTop: number, h: number) {
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  const maxW = w - 1.4;
  let size = 9;
  doc.setFontSize(size);
  let lines = envolverEtiqueta((s) => doc.getTextWidth(s), label, maxW);
  // Palabra sola que no cabe (ej. "ACCESORIOS"/"COD_IN" en columnas angostas):
  // achica la fuente de la cabecera hasta que entre — nunca recorta.
  while (size > 6 && lines.some((ln) => doc.getTextWidth(ln) > maxW)) {
    size -= 0.5;
    doc.setFontSize(size);
    lines = envolverEtiqueta((s) => doc.getTextWidth(s), label, maxW);
  }
  const lineH = size * 0.39;
  let y = yTop + (h - lines.length * lineH) / 2 + size * 0.28;
  for (const ln of lines) {
    doc.text(ln, x + w / 2, y, { align: 'center' });
    y += lineH;
  }
}

/** Peso (ancho relativo) de cada columna: texto largo más ancho. */
function pesoColumna(key: string, esDespiece: boolean): number {
  if (key === 'ALTO MESA DE CORTE') return 1.6; // etiqueta larga
  if (key.startsWith('CENEFA OVALADA')) return 1.55; // etiqueta larga (con/sin tira)
  // Columnas de oscuridad con contenido largo: se ensanchan para que el texto
  // entre completo ("283,6 INT" / "260 EXT / 250 EXT" / "EXTERNO").
  if (key === 'PERFIL LATERAL') return 1.95;
  if (key === 'PERFIL BASE') return 1.75;
  if (key === 'TIPO SOFT LIGHT') return 1.8;
  if (esDespiece) return 1.15;
  switch (key) {
    case 'codMecanismo':
      return 2.6;
    case 'producto':
      return 2.4;
    case 'descripcion':
      return 1.9;
    case 'accionamiento':
    case 'pesoCadena':
    case 'suplementos':
      return 1.8;
    case 'ubic':
    case 'cadena':
      return 1.7;
    case 'tuberia':
      return 2.4; // descripción larga del tubo ("E02-TUBO 1.2 / Ø 38 mm")
    case 'colorAcc':
      return 1.1; // angosta: valores cortos (BLANCO/NEGRO); la cabecera se achica si hace falta
    case 'armado':
    case 'manillas':
    case 'conjunto':
      return 1.1;
    case 'codInt':
      return 0.72; // angosta: "SC 02"; la cabecera "COD_IN" se achica si no cabe
    case 'codSec':
      return 0.9;
    case 'cant':
      return 0.6;
    default:
      return 1.0; // numéricas
  }
}

/** Variante de la hoja: mismo motor, distinto título y columnas visibles. */
export type VarianteHojaCalculo = {
  titulo: string;
  archivo: string;
  /** Columnas de identidad que se OMITEN (keys de FilaCalculo). */
  sinIdentidad?: ReadonlySet<string>;
  /** Componentes de despiece que se OMITEN (por label del bloque). */
  sinDespiece?: (label: string) => boolean;
  /** Agrega al final la columna CONJUNTO PAÑOS (letras de cortar junto). */
  conjuntoPanos?: boolean;
  /** En filas dúo, reemplaza la columna ALTO por ALTO MESA DE CORTE (tela doblada). */
  altoMesaCorteDuo?: boolean;
};

const VARIANTE_CALCULO_GENERAL: VarianteHojaCalculo = {
  titulo: 'CÁLCULO GENERAL',
  archivo: 'CalculoGeneral',
};

/**
 * DIMENSIONADO: la hoja del cálculo general reducida a lo que usa la mesa de
 * dimensionado de tela — identidad de la cortina + medidas de corte de tela.
 * Fuera: tubería, color accesorios, cadena/cierre, armado, medidas de
 * levantamiento (ANCHO/ALTO mts), los cortes de metal (TUBO y PESO*, más el
 * PERFIL CABEZAL / VARILLA / CARRITOS de la vertical) y la CENEFA OVALADA
 * (no se dimensiona en esta mesa).
 */
// Metal y ferretería de la vertical: no se dimensionan en la mesa de tela.
// LAMAS, REPUESTO y ALTO DE CORTE sí quedan (la mesa corta la pieza con el
// alto de corte); el ALTO FINAL de la lama es dato del Cálculo General.
const SIN_DIMENSIONADO_VERTICAL = new Set([
  'PERFIL CABEZAL',
  'VARILLA',
  'CARRITOS',
  'ALTO FINAL',
]);

// Piezas de TALLER de los sistemas de oscuridad (Soft Light / Oscuranti / Dark):
// la cenefa (soft light "normal") y los perfiles los corta el taller, no la mesa
// de tela. La mesa solo ve TELA + ALTO TELA. (CENEFA DELANTERA/TRASERA de las
// familias con cenefa cuadrada mantienen su comportamiento previo.)
const SIN_DIMENSIONADO_OSCURIDAD = new Set([
  'CENEFA', 'PERFIL LATERAL', 'PERFIL BASE', 'TIPO DE SOFT.LIGHT',
]);

export const VARIANTE_DIMENSIONADO: VarianteHojaCalculo = {
  titulo: 'DIMENSIONADO',
  archivo: 'Dimensionado',
  sinIdentidad: new Set(['tuberia', 'colorAcc', 'cadena', 'armado', 'anchoMts', 'altoMts']),
  sinDespiece: (label) =>
    label === 'TUBO' || label === 'PESO' || label.startsWith('PESO ') ||
    label.startsWith('CENEFA OVALADA') || // incluye "(CON/SIN TIRA)"
    SIN_DIMENSIONADO_VERTICAL.has(label) ||
    SIN_DIMENSIONADO_OSCURIDAD.has(label),
  conjuntoPanos: true,
  altoMesaCorteDuo: true,
};

/** Aplica la variante a las columnas (puro, para test). */
export function aplicarVariante(
  data: CalculoGeneral,
  variante: VarianteHojaCalculo,
): Pick<CalculoGeneral, 'identidad' | 'bloques'> {
  const identidad = data.identidad.filter((c) => !variante.sinIdentidad?.has(c.key));
  const bloques = data.bloques
    .map((b) => ({
      ...b,
      columnas: b.columnas.filter((c) => !variante.sinDespiece?.(c.label)),
    }))
    .filter((b) => b.columnas.length > 0);
  return { identidad, bloques };
}

/** Genera y descarga el PDF CALCULO GENERAL de la OT. */
export function generarPdfCalculoGeneral(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  usarTuboE78 = false,
): void {
  renderHojaCalculo(ventanas, catalogo, meta, params, VARIANTE_CALCULO_GENERAL, undefined, usarTuboE78);
}

/** Genera y descarga el PDF DIMENSIONADO (cálculo general solo-tela). */
export function generarPdfDimensionado(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  juntoPorPieza?: Map<string, string>,
  usarTuboE78 = false,
): void {
  renderHojaCalculo(ventanas, catalogo, meta, params, VARIANTE_DIMENSIONADO, juntoPorPieza, usarTuboE78);
}

function renderHojaCalculo(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaCalculo,
  params: ParametrosCorte,
  variante: VarianteHojaCalculo,
  juntoPorPieza?: Map<string, string>,
  usarTuboE78 = false,
): void {
  if (!ventanas || ventanas.length === 0) {
    throw new Error('No hay ventanas en la OT.');
  }
  const data = construirCalculoGeneral(ventanas, catalogo, params, juntoPorPieza, {
    altoMesaCorteDuo: variante.altoMesaCorteDuo,
    usarTuboE78,
  });
  if (data.filas.length === 0) throw new Error('No hay cortinas para calcular.');
  const { identidad, bloques } = aplicarVariante(data, variante);

  // Identidad + (Dimensionado) CONJUNTO PAÑOS: columnas comunes a TODAS las
  // secciones, con anchos GLOBALES para que queden alineadas verticalmente.
  const identCols: ColumnaCalculo[] = variante.conjuntoPanos
    ? [...identidad, { key: 'conjunto', label: 'CONJUNTO PAÑOS' }]
    : identidad;

  // Una SECCIÓN por sistema presente (orden fijo, verticales al final), con SUS
  // filas y SOLO sus columnas de despiece. Un bloque sin columnas (despiece
  // vacío o filtrado por la variante) igual arma su sección: sus filas se
  // muestran solo con identidad.
  const colsPorBloque = new Map(bloques.map((b) => [b.sistema.key, b.columnas]));
  const secciones: { sistema: BloqueSistema; columnas: ColumnaCalculo[]; filas: FilaCalculo[] }[] = [];
  for (const bk of ['ROLLER', 'SOFT', 'OSCU', 'DARK', 'BEEBLACK', 'VERTICAL']) {
    const filasBloque = data.filas.filter((f) => f.bloque === bk);
    if (filasBloque.length === 0) continue;
    secciones.push({ sistema: BLOQUES[bk], columnas: colsPorBloque.get(bk) ?? [], filas: filasBloque });
  }

  // A3 apaisado (420 × 297).
  const doc = new jsPDF('l', 'mm', 'a3');
  const PW = 420;
  const PH = 297;
  const M = 6;
  const usable = PW - M * 2;
  const BOTTOM = PH - M;

  // Anchos de IDENTIDAD globales: ocupan la fracción que deja libre la sección
  // con MÁS despiece; el resto ("área de despiece") lo reparte cada sección
  // entre SUS columnas, llenándola completa. Así la identidad queda alineada
  // entre secciones y cada banda ocupa todo el ancho útil.
  const identPesos = identCols.map((c) => pesoColumna(String(c.key), false));
  const sumIdent = identPesos.reduce((a, b) => a + b, 0) || 1;
  const despiecePeso = (columnas: ColumnaCalculo[]) =>
    columnas.reduce((s, c) => s + pesoColumna(c.key, true), 0);
  const despieceMax = Math.max(0.001, ...secciones.map((sec) => despiecePeso(sec.columnas)));
  const identTotal = (usable * sumIdent) / (sumIdent + despieceMax);
  const identWidths = identPesos.map((p) => (identTotal * p) / sumIdent);
  const despieceArea = usable - identTotal;
  const despX0 = M + identTotal;
  const identXs: number[] = [];
  {
    let ax = M;
    for (const w of identWidths) {
      identXs.push(ax);
      ax += w;
    }
  }

  const bannerH = 9;
  const superH = 8;
  const headH = 15; // cabeceras largas se envuelven a 2-3 líneas
  const rowH = 11;
  const SIZE_TEXTO = 8.5; // identidad (texto) — tamaño fijo, uniforme
  const SIZE_NUM = 12; // despiece (números / variante) — tamaño fijo, uniforme
  const VERDE: RGB = [112, 173, 71];
  const VERDE_TXT: RGB = [22, 46, 20];

  let y = M;
  let pagina = 0;

  // Celda a tamaño FIJO (nunca encoge): lo que no cabe se recorta con "…".
  const celdaFija = (
    txt: string,
    x: number,
    w: number,
    yText: number,
    size: number,
    o: { bold?: boolean; color?: RGB } = {},
  ) => {
    if (!txt) return;
    doc.setFont('helvetica', o.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const c = o.color ?? [25, 25, 30];
    doc.setTextColor(c[0], c[1], c[2]);
    let t = txt;
    const maxW = w - 1.4;
    if (doc.getTextWidth(t) > maxW) {
      while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
      t += '…';
    }
    doc.text(t, x + w / 2, yText, { align: 'center' });
  };

  const encabezado = () => {
    pagina += 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 38);
    doc.text(variante.titulo, M, y + 5);
    // Número de OT grande y destacado.
    doc.setFontSize(24);
    doc.text(`OT ${meta.ot}`, M + 62, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('FECHA OT: ___/___/____      RESPONSABLE OT: __________', M + 130, y + 5);
    if (meta.cliente) doc.text(meta.cliente, PW - M, y + 5, { align: 'right' });
    doc.setFontSize(7);
    doc.text(`Página ${pagina}`, PW - M, y + 9, { align: 'right' });
    y += 10;
  };

  encabezado();

  for (const sec of secciones) {
    // Reparte el área de despiece entre las columnas de ESTA sección.
    const despPesos = sec.columnas.map((c) => pesoColumna(c.key, true));
    const sumDesp = despPesos.reduce((a, b) => a + b, 0) || 1;
    const despWidths = despPesos.map((p) => (despieceArea * p) / sumDesp);
    const despWtot = despWidths.reduce((a, b) => a + b, 0);
    const despXs: number[] = [];
    {
      let ax = despX0;
      for (const w of despWidths) {
        despXs.push(ax);
        ax += w;
      }
    }

    // Banner + súper-cabecera + cabeceras de columna de la sección (se repiten
    // al saltar de página dentro de la sección).
    const cabecerasSeccion = () => {
      rect(doc, M, y, usable, bannerH, [22, 22, 26]);
      celdaFija(sec.sistema.label, M, usable, y + 6.2, 15, { bold: true, color: C_WHITE });
      y += bannerH;
      if (despWtot > 0) {
        rect(doc, despX0, y, despWtot, superH, sec.sistema.color);
        celdaFija(sec.sistema.label, despX0, despWtot, y + 5.4, 9, { bold: true, color: C_WHITE });
      }
      y += superH;
      identCols.forEach((c, i) => {
        rect(doc, identXs[i], y, identWidths[i], headH, C_DARK);
        celdaCabecera(doc, c.label, identXs[i], identWidths[i], y, headH);
      });
      sec.columnas.forEach((c, j) => {
        // La cabecera de TIPO DE SOFT.LIGHT va del color del sistema (como sus
        // vecinas); solo las CELDAS de esa columna llevan el verde de resalte.
        rect(doc, despXs[j], y, despWidths[j], headH, sec.sistema.color);
        celdaCabecera(doc, c.label, despXs[j], despWidths[j], y, headH);
      });
      y += headH;
    };

    // Una sección nueva que ni siquiera cabe con 1 fila salta de página antes.
    if (y + bannerH + superH + headH + rowH > BOTTOM) {
      doc.addPage();
      y = M;
      encabezado();
    }
    cabecerasSeccion();

    for (const f of sec.filas) {
      if (y + rowH > BOTTOM) {
        doc.addPage();
        y = M;
        encabezado();
        cabecerasSeccion();
      }
      // Identidad (texto de tamaño uniforme).
      identCols.forEach((c, i) => {
        rect(doc, identXs[i], y, identWidths[i], rowH);
        const raw = f[c.key as keyof FilaCalculo];
        let val: string;
        if (NUM_IDENTIDAD.has(c.key as keyof FilaCalculo)) {
          // ANCHO/ALTO mts a 3 decimales (la medida de levantamiento real).
          val =
            c.key === 'anchoMts' || c.key === 'altoMts'
              ? (raw as number).toFixed(3).replace('.', ',')
              : num(raw as number);
        } else val = raw === 0 ? '' : String(raw ?? '');
        celdaFija(val, identXs[i], identWidths[i], y + 7.4, SIZE_TEXTO);
      });
      // Despiece (números de tamaño uniforme; TIPO DE SOFT.LIGHT en verde).
      sec.columnas.forEach((c, j) => {
        const esTipo = c.key === 'TIPO SOFT LIGHT';
        const raw = f.despiece.get(c.key);
        const val = typeof raw === 'number' ? num(raw) : String(raw ?? '');
        rect(doc, despXs[j], y, despWidths[j], rowH, esTipo && val ? VERDE : undefined);
        celdaFija(
          val,
          despXs[j],
          despWidths[j],
          y + 7.4,
          SIZE_NUM,
          esTipo && val ? { bold: true, color: VERDE_TXT } : {},
        );
      });
      y += rowH;
    }
    y += 2.5; // separación entre secciones
  }

  doc.save(`${variante.archivo}_OT${meta.ot}.pdf`);
}
