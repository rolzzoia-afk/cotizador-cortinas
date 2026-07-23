// ─────────────────────────────────────────────────────────────────────
// PDF de la HOJA DE CORTE / OPTIMIZACIÓN DE TELAS (formulario "pañitos").
//
// Replica en PDF (apaisado, listo para imprimir) el formulario que usa el
// cortador, con todos sus bloques:
//   1. Tabla de corte — una fila por cortina (ancho/alto de corte, n.º de
//      paño, letra "cortar junto") + columnas de colmena (verde) que se
//      llenan cuando la pieza sale de un sobrante.
//   2. "TOTAL PAÑOS" — una fila por paño (cortinas que se cortan juntas);
//      los paños que salen de colmena se marcan en su columna COLMENA.
//   3. Bloque de errores (PAÑO ADICIONAL / MOTIVO: FALLA TELA · ERROR
//      CORTE) — en blanco para llenar a mano.
//   4. "OPTIMIZADOR" — metros de tela por COD_INT (auto) + PASO 1-4 a mano.
//   5. "SELLO PAÑOS".
//
// Datos: optimizador de paños (tela.ts) + Plan de Corte (planCorte.ts) para
// saber qué pieza sale de qué sobrante de colmena. Lógica pura salvo
// `generarPdfHojaCorte`, que toca el DOM (jsPDF).
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import { debeInvertirPano, type OptimizerRow } from './tela';
import { generarPlanCorte, type PanoColmena } from './planCorte';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import type { PiezaColmenaSnap } from './colmenaCorte';
import type { OT } from '@/modules/ots/types';

// ── Modelo de datos (puro, testeable) ────────────────────────────────
export type FilaCorteCortina = {
  cadena: number;
  cant: number;
  codInt: string;
  tipo: string; // corto: DELUX / PREMIUM
  anchoCorteTela: number; // m
  corteAncho35: number | ''; // m (ancho − 3,5 cm); '' en vertical (no aplica)
  alto: number; // m
  altoCorteTela: number; // m — corte real (dúo: 2×alto+0,30; resto: alto+0,25)
  pano: number; // n.º de paño (= letra "cortar junto")
  cortarJunto: string; // letra A, B, C… (el aviso "NO CABE" va en comentario)
  comentario: string; // "INVERTIDA" / "NO CABE" / "VERTICAL" / ""
  invertida: boolean;
  /** Cortina vertical: la tela se corta con el rollo girado (alto a lo ancho). */
  esVertical: boolean;
  medidaColmena: string; // "SC 64 (178X200)" si sale de sobrante
  ubicColmena: string; // ubicación del sobrante (ej. "B-42")
};

export type FilaPanoResumen = {
  pano: number;
  tipo: string; // producto completo
  cod: string;
  altoCortePano: number; // m (invertida → ancho de la cortina)
  altoMaxUtilizar: number | ''; // m (vacío en invertidas)
  invertida: boolean;
  esVertical: boolean; // el paño es de una cortina vertical (hoja separada)
  colmena: string; // "A-27 · 178X210" si el paño sale de colmena; '' si es rollo
};

/**
 * Filas de la tabla de corte que se imprimen: solo las que salen de colmena
 * (medidaColmena), van invertidas o son verticales (se cortan con el rollo
 * girado). Las cortinas de rollo normal no se muestran: el taller solo necesita
 * esta tabla para los cortes especiales.
 */
export function filasCorteVisibles(cortinas: FilaCorteCortina[]): FilaCorteCortina[] {
  return cortinas.filter((f) => f.invertida || f.esVertical || f.medidaColmena !== '');
}

export type MetrosOptimizador = { codInt: string; metros: number; esVertical: boolean };

export type HojaCorte = {
  cortinas: FilaCorteCortina[];
  panos: FilaPanoResumen[];
  totalPanos: number;
  optimizador: MetrosOptimizador[];
};

export const pieceId = (otId: string | number, ventanaId: string | number, panoIndex: number) =>
  `${otId}_${ventanaId}_p${panoIndex}`;

/**
 * IDs de pieza (pieceId) que salen de la COLMENA de paños (ya cortados de un
 * sobrante), no del rollo. Mismo criterio que `construirHojaCorte`: plan vivo
 * (sobrantes asignados) + snapshot persistido tras "confirmar corte general".
 * Se usa para NO imprimir etiqueta de esos paños (ya están cortados/etiquetados).
 */
export function piezasConOrigenColmena(
  colmenaPanos: PanoColmena[],
  ot: OT,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
): Set<string> {
  const plan = generarPlanCorte([ot], colmenaPanos, params);
  const set = new Set<string>();
  for (const g of plan.sobrantes)
    for (const pz of g.placed) if (!pz.failed) set.add(pz.id);
  for (const pid of Object.keys(piezasSnapshot ?? {})) set.add(pid);
  return set;
}

/** Metros (m) desde cm, redondeado a 3 decimales sin ceros sobrantes. */
const aMetros = (cm: number) => parseFloat((cm / 100).toFixed(3));

/** Redondea metros a 3 decimales sin ceros sobrantes. */
const redM = (m: number) => parseFloat(m.toFixed(3));

/** Tipo corto = última palabra del producto ("ROLLER SCREEN PREMIUM" → "PREMIUM"). */
const tipoCorto = (producto: string) => {
  const partes = String(producto || '').trim().toUpperCase().split(/\s+/);
  return partes[partes.length - 1] || '';
};

/**
 * Construye la hoja de corte de UNA OT cruzando el optimizador de paños con
 * el Plan de Corte (para el origen rollo/sobrante de cada pieza).
 */
export function construirHojaCorte(
  rows: OptimizerRow[],
  colmenaPanos: PanoColmena[],
  ot: OT,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  /** Snapshot pieza→sobrante (post-confirmación): muestra el origen colmena aun
   *  cuando el sobrante ya se consumió y el plan vivo no lo re-asigna. */
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
): HojaCorte {
  const plan = generarPlanCorte([ot], colmenaPanos, params);

  // Sobrante (colmena) que recibió cada pieza (las demás salen de rollo).
  const sobranteDe = new Map<string, PanoColmena>();
  for (const g of plan.sobrantes)
    for (const pz of g.placed) if (!pz.failed) sobranteDe.set(pz.id, g.sobrante);

  // Origen colmena de una pieza: del plan vivo (sobranteDe) o, si el sobrante ya
  // se consumió tras "confirmar corte general", del snapshot persistido.
  type OrigenColmena = { cod: string; ancho: number; alto: number; ubic: string };
  const colmenaDePieza = (pid: string): OrigenColmena | null => {
    const sob = sobranteDe.get(pid);
    if (sob) return { cod: sob.cod, ancho: sob.ancho, alto: sob.alto, ubic: sob.ubicacion || '' };
    return piezasSnapshot?.[pid] ?? null;
  };

  // ¿La cortina se corta invertida (rotada)? Manda el flag de Fase 2; si no
  // está definido, se auto-marca cuando el ancho + borde supera el rollo.
  // Se compara contra `r.ancho` = ancho REAL de la pieza a lo ancho del rollo.
  // La VERTICAL NUNCA se invierte: su tela se corta en lamas de 8,9 cm que
  // siempre entran a lo ancho del rollo (una ventana ancha = más lamas, en
  // varias pasadas). Si se invirtiera, las lamas quedarían acostadas.
  const esInvertida = (r: OptimizerRow) =>
    r.esVertical ? false : (r.pano?.invertida ?? debeInvertirPano(r.ancho, r.anchoRollo, params.bordeCm));

  // Pasadas del rollo para una vertical más ancha que el rollo: se cortan las
  // lamas en varias franjas a lo largo del rollo (ceil(ancho / ancho rollo)).
  const pasadasVertical = (r: OptimizerRow) =>
    r.esVertical && r.anchoRollo > 0 && r.ancho > r.anchoRollo
      ? Math.ceil(r.ancho / r.anchoRollo)
      : 0;

  // Clave de paño por fila:
  //  · invertida → cada una su propio paño (rotada, ocupa el rollo a lo largo)
  //  · resto → letra "cortar junto" del optimizador (cortinas lado a lado)
  // (Planes antiguos podían traer junto = "RR" en varias filas: se separan por
  //  índice para que cada una quede en su propio paño y no colapsen en uno.)
  // Sufijo ·V: vertical y roller NUNCA comparten paño (van en hojas separadas).
  // Aunque el empaque ya los separa, un plan GUARDADO viejo podría traer un grupo
  // mixto; el sufijo garantiza que ningún paño quede a caballo entre las dos hojas.
  const claveJunto = (r: OptimizerRow, idx: number) => {
    const suf = r.esVertical ? '·V' : '';
    if (esInvertida(r)) return `INV#${idx}${suf}`;
    if (r.junto === 'RR') return `RR#${idx}${suf}`;
    return `${r.junto || `·${idx}`}${suf}`;
  };

  // N.º de paño por clave (orden de aparición): primera clave → 1, etc.
  const juntoNum = new Map<string, number>();
  rows.forEach((r, idx) => {
    const k = claveJunto(r, idx);
    if (!juntoNum.has(k)) juntoNum.set(k, juntoNum.size + 1);
  });
  const letra = (pano: number) =>
    pano >= 1 && pano <= 26 ? String.fromCharCode(64 + pano) : String(pano);

  // ── Bloque 1: una fila por cortina ──
  const cortinas: FilaCorteCortina[] = rows.map((r, idx) => {
    const pid = pieceId(ot.id, r.ventanaId, r.panoIndex);
    const inv = esInvertida(r);
    // Más ancha que el rollo y no rota → no cabe. El aviso va en COMENTARIO;
    // CORTAR JUNTO siempre muestra la letra del paño (nunca "RR"). La vertical
    // se excluye: nunca "no cabe" (se corta en lamas), lleva su propio aviso.
    const noCabe = !inv && !r.esVertical && r.ancho > r.anchoRollo;
    const pasadas = pasadasVertical(r);
    const pano = juntoNum.get(claveJunto(r, idx)) ?? 0;
    const colmena = colmenaDePieza(pid);
    return {
      cadena: 0,
      cant: 1,
      codInt: r.codInt,
      tipo: tipoCorto(r.producto),
      anchoCorteTela: redM(r.ancho),
      // La vertical se corta al ancho REAL: no lleva limpieza de borde, así que
      // la celda queda vacía en vez de repetir la medida de al lado.
      // OSCURIDAD: el corte real viene del despiece (ancho + TELA_ADJ), no del
      // ancho−3,5 roller (golden Soft Light interno 296,9 → 289,7).
      corteAncho35: r.esVertical
        ? ''
        : typeof r.anchoCorteTelaCm === 'number'
          ? redM(r.anchoCorteTelaCm / 100)
          : redM(r.ancho - params.descAnchoCorteCm / 100),
      alto: aMetros(r.altoCm),
      altoCorteTela: redM(r.altoCorte), // dúo: 2×alto+0,30; resto: alto+0,25
      pano,
      cortarJunto: letra(pano),
      comentario: inv
        ? 'INVERTIDA'
        : noCabe
          ? 'NO CABE'
          : r.esVertical
            ? pasadas > 1
              ? `VERTICAL · ${pasadas} PASADAS`
              : 'VERTICAL'
            : '',
      invertida: inv,
      esVertical: !!r.esVertical,
      medidaColmena: colmena ? `${colmena.cod} (${Math.round(colmena.ancho)}X${Math.round(colmena.alto)})` : '',
      ubicColmena: colmena ? colmena.ubic : '',
    };
  });

  // ── Bloque 2: una fila por paño (grupo "cortar junto"). Incluye los paños
  //    que salen de colmena — se marcan en la columna COLMENA. Antes se
  //    filtraban los grupos 100% colmena y el resumen quedaba vacío (TOTAL
  //    PAÑOS = 0) cuando toda la OT se cortaba de sobrantes. ──
  const grupos = new Map<string, { rows: OptimizerRow[]; pano: number }>();
  rows.forEach((r, idx) => {
    const k = claveJunto(r, idx);
    if (!grupos.has(k)) grupos.set(k, { rows: [], pano: juntoNum.get(k) ?? 0 });
    grupos.get(k)!.rows.push(r);
  });
  const panos: FilaPanoResumen[] = [];
  // Metros de tela por COD_INT para el OPTIMIZADOR = lo que hay que sacar del
  // ROLLO: los paños que salen de COLMENA ya están cortados y NO suman. Igual se
  // registra el COD_INT (en 0 si todos sus paños son de colmena) para que su fila
  // no desaparezca del resumen. La columna COLMENA marca cuáles salen de sobrante.
  // Clave por COD_INT + tipo (vertical/roller): una tela usada por AMBOS lados
  // suma en cada hoja con SUS propios metros (las hojas salen separadas).
  const metrosPorCod = new Map<string, { codInt: string; metros: number; esVertical: boolean }>();
  for (const { rows: grupo, pano } of grupos.values()) {
    const ref = grupo[0];
    const inv = esInvertida(ref);
    const vert = !!ref.esVertical;
    // Corte real del paño (dúo = 2×alto+0,30) vs. reserva "alto máximo a utilizar"
    // (dúo = 2×(alto+0,25)). En roller simple ambas coinciden.
    const corteReal = Math.max(...grupo.map((g) => redM(g.altoCorte)));
    const altoMax = Math.max(...grupo.map((g) => redM(g.altoReal)));
    // Ancho de la pieza a lo ancho del rollo (en la vertical ya viene invertido).
    const anchoMax = Math.max(...grupo.map((g) => redM(g.ancho)));
    // Origen colmena del paño (si alguna de sus piezas sale de un sobrante):
    // ubicación · medida, para que la cortadora sepa de dónde tomar la tela.
    let colmena = '';
    for (const g of grupo) {
      const c = colmenaDePieza(pieceId(ot.id, g.ventanaId, g.panoIndex));
      if (c) {
        const med = `${Math.round(c.ancho)}X${Math.round(c.alto)}`;
        colmena = c.ubic ? `${c.ubic} · ${med}` : med;
        break;
      }
    }
    // Los paños que salen de COLMENA no van a la tabla TOTAL PAÑOS: ya están
    // cortados, la cortadora no los corta del rollo. (Igual aparecen en la tabla
    // de corte de arriba, con su columna COLMENA.) Así TOTAL PAÑOS cuenta solo
    // los paños a cortar del rollo.
    if (!colmena) {
      panos.push({
        pano,
        tipo: ref.producto,
        cod: ref.codInt,
        altoCortePano: inv ? anchoMax : corteReal, // invertida → ancho consumido
        altoMaxUtilizar: inv ? '' : altoMax,
        invertida: inv,
        esVertical: vert,
        colmena,
      });
    }
    // Solo los paños de ROLLO suman al OPTIMIZADOR (los de colmena ya están
    // cortados). El COD_INT se registra igual —aunque sume 0— para que su fila no
    // desaparezca. La reserva por paño de rollo = "alto máximo a utilizar".
    const claveOpt = `${ref.codInt}|${vert}`;
    const prev = metrosPorCod.get(claveOpt);
    const suma = colmena ? 0 : inv ? corteReal : altoMax;
    if (prev) prev.metros += suma;
    else metrosPorCod.set(claveOpt, { codInt: ref.codInt, metros: suma, esVertical: vert });
  }
  panos.sort((a, b) => a.pano - b.pano);

  // ── Bloque 4: metros de tela por COD_INT (solo rollo; colmena descontada). ──
  const optimizador: MetrosOptimizador[] = [...metrosPorCod.values()].map((m) => ({
    codInt: m.codInt,
    metros: parseFloat(m.metros.toFixed(3)),
    esVertical: m.esVertical,
  }));

  return { cortinas, panos, totalPanos: panos.length, optimizador };
}

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaCorte = { ot: string; cliente: string; empresa?: string };

const num = (v: number) => String(parseFloat(v.toFixed(3))).replace('.', ',');

type RGB = [number, number, number];
const C_DARK: RGB = [60, 60, 66];
const C_GREEN: RGB = [112, 173, 71];
const C_BLUE: RGB = [142, 169, 219];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [140, 140, 148];
// Paleta de fondo por paño (para agrupar visualmente "cortar junto").
const PALETA: RGB[] = [
  [217, 217, 217],
  [252, 228, 214],
  [226, 239, 218],
  [221, 235, 247],
  [255, 242, 204],
  [237, 237, 237],
];

/**
 * Dibuja texto dentro de una celda. `fit: 'wrap'` (cabeceras) parte en dos
 * líneas si no cabe; `fit: 'shrink'` (datos) mantiene UNA línea achicando la
 * fuente hasta que entre — así letras y números salen al tamaño máximo y
 * solo los textos largos se reducen.
 */
function celdaTexto(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'center' | 'left'; fit?: 'wrap' | 'shrink' } = {},
) {
  const { size = 6, bold = false, color = [20, 20, 25], align = 'center', fit = 'wrap' } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const maxW = w - 1.5;
  const tx = align === 'left' ? x + 1 : x + w / 2;
  const alignOpt = align === 'left' ? ('left' as const) : ('center' as const);
  if (fit === 'shrink') {
    let sz = size;
    doc.setFontSize(sz);
    let txt = s;
    while (sz > 4.5 && doc.getTextWidth(txt) > maxW) {
      sz -= 0.3;
      doc.setFontSize(sz);
    }
    while (txt.length > 1 && doc.getTextWidth(txt) > maxW) txt = txt.slice(0, -1);
    doc.text(txt, tx, y, { align: alignOpt });
    return;
  }
  doc.setFontSize(size);
  doc.text(s, tx, y, { align: alignOpt, maxWidth: maxW });
}

function rect(doc: jsPDF, x: number, y: number, w: number, h: number, fill?: RGB) {
  if (fill) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.rect(x, y, w, h, 'F');
  }
  doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
}

/** Tema visual de una sección de la hoja de corte: clásica o VERTICAL. */
type TemaCorte = {
  titulo: string; // título del encabezado
  banner?: string; // franja de aviso bajo el encabezado (solo vertical)
  colorTitulo: RGB;
  tituloTotalPanos: string;
  tituloSello: string;
};

const C_GREEN_VERT: RGB = [56, 118, 29]; // verde de las verticales (bloque/etiqueta)

/**
 * Parte una hoja de corte en `principal` (roller/todo lo no-vertical) y
 * `vertical`. Conserva los números de paño GLOBALES (con huecos por lado, para
 * que las etiquetas de paño sigan coincidiendo) y recalcula `totalPanos` por lado.
 */
export function partirHojaCorte(hoja: HojaCorte): { principal: HojaCorte; vertical: HojaCorte } {
  const lado = (esV: boolean): HojaCorte => {
    const panos = hoja.panos.filter((p) => p.esVertical === esV);
    return {
      cortinas: hoja.cortinas.filter((c) => c.esVertical === esV),
      panos,
      totalPanos: panos.length,
      optimizador: hoja.optimizador.filter((o) => o.esVertical === esV),
    };
  };
  return { principal: lado(false), vertical: lado(true) };
}

/**
 * Genera y descarga UN solo PDF de la hoja de corte para la OT dada. Si la OT
 * tiene cortinas verticales, el mismo PDF trae DOS secciones continuas: la hoja
 * clásica (roller/etc.) y a continuación la "HOJA DE CORTE DE PAÑO VERTICAL",
 * cada una con su encabezado en sus páginas. Solo-vertical o solo-roller → una
 * sección. El taller corta las verticales en mesa aparte, así que ningún paño
 * queda a caballo entre las dos secciones (ver empaque por `esVertical` en tela.ts).
 */
export function generarPdfHojaCorte(
  rows: OptimizerRow[],
  colmenaPanos: PanoColmena[],
  ot: OT,
  meta: MetaCorte,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  piezasSnapshot?: Record<string, PiezaColmenaSnap>,
): void {
  if (!rows || rows.length === 0) {
    throw new Error('No hay paños. Guarda el plan en Tela primero.');
  }
  const hoja = construirHojaCorte(rows, colmenaPanos, ot, params, piezasSnapshot);
  const { principal, vertical } = partirHojaCorte(hoja);

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const hayPrincipal = principal.cortinas.length > 0;
  const hayVertical = vertical.cortinas.length > 0;

  if (hayPrincipal) {
    renderHojaCorte(doc, principal, meta, {
      titulo: 'HOJA DE CORTE PAÑO',
      colorTitulo: [30, 30, 38],
      tituloTotalPanos: 'TOTAL PAÑOS',
      tituloSello: 'SELLO PAÑOS',
    });
  }
  if (hayVertical) {
    // La sección vertical parte en página propia, a continuación de la clásica.
    if (hayPrincipal) doc.addPage();
    renderHojaCorte(doc, vertical, meta, {
      titulo: 'HOJA DE CORTE DE PAÑO VERTICAL',
      banner: 'PAÑOS / COLMENA SOLO PARA CORTINAS VERTICALES',
      colorTitulo: C_GREEN_VERT,
      // El recuadro es de 16 mm: "TOTAL PAÑOS VERTICALES" se trunca. La franja
      // verde de arriba ya deja claro que son verticales, así que va corto.
      tituloTotalPanos: 'TOTAL PAÑOS',
      tituloSello: 'SELLO PAÑOS VERTICALES',
    });
  }
  // Un solo archivo; si la OT es SOLO vertical, el nombre lo dice.
  doc.save(hayPrincipal ? `Corte_OT${meta.ot}.pdf` : `Corte_Vertical_OT${meta.ot}.pdf`);
}

/** Render de UNA sección de la hoja de corte (clásica o vertical, según `tema`)
 *  sobre el doc compartido, empezando en la página actual. No guarda. */
function renderHojaCorte(doc: jsPDF, hoja: HojaCorte, meta: MetaCorte, tema: TemaCorte): void {
  const W = 297;
  const M = 6;
  const BOTTOM = 210 - M; // límite inferior útil de la página
  let y = M;

  // ── Encabezado (se repite en cada página; numeración continua del doc) ──
  const encabezado = () => {
    const pagina = doc.getNumberOfPages();
    y = M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(tema.colorTitulo[0], tema.colorTitulo[1], tema.colorTitulo[2]);
    doc.text(`${tema.titulo} — OT ${meta.ot}`, M, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 25);
    doc.text(meta.cliente || '', M, y + 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(150, 150, 158);
    doc.text(meta.empresa || `Página ${pagina}`, W - M, y + 5, { align: 'right' });
    if (meta.empresa) {
      doc.setFontSize(7);
      doc.text(`Página ${pagina}`, W - M, y + 9, { align: 'right' });
    }
    y += 13;
    // Franja de aviso (solo hoja vertical): repite en cada página que estos
    // paños/colmenas son EXCLUSIVAMENTE para cortinas verticales.
    if (tema.banner) {
      rect(doc, M, y, W - 2 * M, 6.5, C_GREEN_VERT);
      celdaTexto(doc, tema.banner, M, W - 2 * M, y + 4.6, { size: 9.5, bold: true, color: C_WHITE });
      y += 9;
    }
  };
  // Cotizaciones largas: cuando una tabla no cabe, sigue en una página nueva
  // repitiendo su cabecera (antes se dibujaba de corrido y se cortaba).
  const nuevaPagina = () => {
    doc.addPage();
    encabezado();
  };
  encabezado();

  // ── BLOQUE 1: tabla de corte ──
  const cols: { key: keyof FilaCorteCortina | 'serial'; label: string; w: number; head: RGB }[] = [
    { key: 'cadena', label: 'CADENA', w: 11, head: C_DARK },
    { key: 'cant', label: 'CANT', w: 9, head: C_DARK },
    { key: 'codInt', label: 'COD INT', w: 14, head: C_DARK },
    { key: 'tipo', label: 'TIPO', w: 15, head: C_DARK },
    { key: 'anchoCorteTela', label: 'ANCHO CORTE TELA', w: 21, head: C_DARK },
    { key: 'corteAncho35', label: 'CORTE ANCHO -3,5', w: 21, head: C_DARK },
    { key: 'alto', label: 'ALTO', w: 11, head: C_DARK },
    { key: 'altoCorteTela', label: 'ALTO CORTE TELA', w: 18, head: C_DARK },
    { key: 'pano', label: 'PAÑO', w: 10, head: C_DARK },
    { key: 'cortarJunto', label: 'CORTAR JUNTO', w: 14, head: C_DARK },
    { key: 'comentario', label: 'COMENTARIO', w: 18, head: C_DARK },
    { key: 'medidaColmena', label: 'MEDIDA COLMENA', w: 28, head: C_GREEN },
    { key: 'serial', label: 'COD. SERIAL', w: 16, head: C_GREEN },
    { key: 'ubicColmena', label: 'UBICACIÓN COLMENA', w: 22, head: C_GREEN },
    { key: 'serial', label: 'SOBRANTE / COLMENA', w: 16, head: C_BLUE },
    { key: 'serial', label: 'AUTORIZACIÓN OPTIM.', w: 21, head: C_BLUE },
  ];

  // La tabla ocupa TODO el ancho útil: los anchos base se escalan
  // proporcionalmente para darle aire a la letra más grande.
  const anchoUtil = W - 2 * M;
  const sumaW = cols.reduce((s, c) => s + c.w, 0);
  for (const c of cols) c.w = (c.w * anchoUtil) / sumaW;

  const x0 = M;
  const headH = 14;
  // Rótulo de cabecera: achica la fuente hasta que la palabra más larga
  // quepa en la columna (el wrap de jsPDF parte palabras a la mitad) y
  // centra verticalmente cuando queda en una sola línea.
  const rotuloCabecera = (label: string, cx: number, w: number, color: RGB) => {
    const maxW = w - 1.5;
    doc.setFont('helvetica', 'bold');
    let sz = 8.5;
    doc.setFontSize(sz);
    const palabraMax = () =>
      Math.max(...label.split(/\s+/).map((p) => doc.getTextWidth(p)));
    while (sz > 5 && palabraMax() > maxW) {
      sz -= 0.3;
      doc.setFontSize(sz);
    }
    const unaLinea = doc.getTextWidth(label) <= maxW;
    celdaTexto(doc, label, cx, w, y + (unaLinea ? 8.8 : 5), { size: sz, bold: true, color });
  };
  const cabeceraTabla = () => {
    let cx = x0;
    for (const c of cols) {
      rect(doc, cx, y, c.w, headH, c.head);
      const txtColor: RGB = c.head === C_BLUE ? [30, 30, 40] : C_WHITE;
      rotuloCabecera(c.label, cx, c.w, txtColor);
      cx += c.w;
    }
    y += headH;
  };
  // BLOQUE 1 solo con las cortinas que salen de colmena o van invertidas. Si
  // ninguna califica, se omite toda la tabla (el resto de bloques sigue igual).
  const visibles = filasCorteVisibles(hoja.cortinas);
  if (visibles.length > 0) {
    cabeceraTabla();

    // Filas de datos (color por paño)
    const rowH = 12.5;
    for (const fila of visibles) {
      if (y + rowH > BOTTOM) {
        nuevaPagina();
        cabeceraTabla();
      }
      const fill = PALETA[(fila.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
      let cx = x0;
      for (const c of cols) {
        rect(doc, cx, y, c.w, rowH, fill);
        let val = '';
        if (c.key === 'serial') val = '';
        else {
          const raw = fila[c.key as keyof FilaCorteCortina];
          // Las columnas de medida van formateadas; '' (vertical sin −3,5) se
          // deja en blanco en vez de pasarlo por `num`.
          if (c.key === 'anchoCorteTela' || c.key === 'corteAncho35' || c.key === 'alto' || c.key === 'altoCorteTela')
            val = raw === '' ? '' : num(raw as number);
          else val = raw === 0 ? '0' : String(raw ?? '');
        }
        if (val) {
          const bold = c.key === 'cortarJunto' || c.key === 'pano' || c.key === 'comentario';
          celdaTexto(doc, val, cx, c.w, y + 8.5, { size: c.key === 'comentario' ? 10 : 13, bold, fit: 'shrink' });
        }
        cx += c.w;
      }
      y += rowH;
    }
  }

  // ── BLOQUE 2 (izq): TOTAL PAÑOS ── y ── BLOQUE 3 (der): errores ──
  // Comparten filas (una por paño): se dibujan en paralelo, con salto de
  // página conjunto repitiendo ambas cabeceras.
  // Layout fijo pedido por el taller: la primera página es SOLO la tabla de
  // corte; TOTAL PAÑOS/errores parten siempre en página nueva aunque sobre
  // espacio.
  const totalW = 16;
  // cols2 debe caber en el tramo [M+totalW+1 .. t3x) = 23..150 = 127 mm, si no
  // la última columna (COLMENA) queda tapada por la tabla de errores (cols3).
  const cols2 = [
    { label: 'PAÑOS', w: 11, k: 'pano' as const },
    { label: 'TIPO', w: 34, k: 'tipo' as const },
    { label: 'COD', w: 15, k: 'cod' as const },
    { label: 'ALTO CORTE PAÑO', w: 22, k: 'altoCortePano' as const },
    { label: 'ALTO MÁXIMO A UTILIZAR', w: 23, k: 'altoMaxUtilizar' as const },
    { label: 'COLMENA', w: 22, k: 'colmena' as const },
  ];
  // COD. SERIAL va al mismo ancho que MOTIVO (38). cols3 debe caber en
  // [t3x .. W−M] = 150..291 = 141 mm, así que se achican las vecinas.
  const cols3 = [
    { label: 'PAÑO ADICIONAL', w: 22 },
    { label: 'MTS PAÑO ADIC.', w: 17 },
    { label: 'COD. SERIAL', w: 38 },
    { label: 'MOTIVO', w: 38 },
    { label: 'RESPONSABLE DE ERROR', w: 25 },
  ];
  const t3x = 150;
  const rowH23 = 11.5;
  let y23Box = 0; // borde inferior del recuadro TOTAL PAÑOS (por página)
  const cabecera23 = () => {
    rect(doc, M, y, totalW, 12, C_DARK);
    celdaTexto(doc, tema.tituloTotalPanos, M, totalW, y + 7.6, { size: 6.5, bold: true, color: C_WHITE, fit: 'shrink' });
    rect(doc, M, y + 12, totalW, 18);
    celdaTexto(doc, String(hoja.totalPanos), M, totalW, y + 24.4, { size: 26, bold: true, fit: 'shrink' });
    y23Box = y + 30;
    // Rótulo centrado en la celda de 12 mm: achica la fuente hasta que la
    // palabra más larga entre (evita cortarla, p. ej. "PAÑOS") y decide 1 o 2
    // líneas por el ANCHO real del texto, no por su cantidad de caracteres.
    const rotulo = (label: string, tx: number, w: number) => {
      const maxW = w - 1.5;
      doc.setFont('helvetica', 'bold');
      let sz = 8;
      doc.setFontSize(sz);
      const palabraMax = () => Math.max(...label.split(/\s+/).map((p) => doc.getTextWidth(p)));
      while (sz > 5 && palabraMax() > maxW) {
        sz -= 0.3;
        doc.setFontSize(sz);
      }
      const unaLinea = doc.getTextWidth(label) <= maxW;
      celdaTexto(doc, label, tx, w, y + (unaLinea ? 7.6 : 4.4), { size: sz, bold: true, color: C_WHITE });
    };
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      rotulo(c.label, tx, c.w);
      tx += c.w;
    }
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, 12, C_DARK);
      rotulo(c.label, tx, c.w);
      tx += c.w;
    }
    y += 12;
  };
  // TOTAL PAÑOS parte en página nueva salvo que la tabla de corte se haya
  // omitido (sin colmena ni invertidas): entonces empieza en la página 1.
  if (visibles.length > 0) nuevaPagina();
  cabecera23();
  for (const p of hoja.panos) {
    if (y + rowH23 > BOTTOM) {
      nuevaPagina();
      cabecera23();
    }
    const fill = PALETA[(p.pano - 1 + PALETA.length) % PALETA.length] || PALETA[0];
    // Fila bloque 2 (resumen del paño)
    let tx = M + totalW + 1;
    for (const c of cols2) {
      rect(doc, tx, y, c.w, rowH23, fill);
      let val = '';
      if (c.k === 'colmena') val = p.colmena;
      else if (c.k === 'altoCortePano') val = num(p.altoCortePano);
      else if (c.k === 'altoMaxUtilizar') val = p.altoMaxUtilizar === '' ? '' : num(p.altoMaxUtilizar);
      else val = String(p[c.k] ?? '');
      if (val)
        celdaTexto(doc, val, tx, c.w, y + 7.8, {
          size: c.k === 'colmena' ? 9 : 12,
          align: c.k === 'tipo' ? 'left' : 'center',
          fit: 'shrink',
        });
      tx += c.w;
    }
    // Fila bloque 3 (errores, para llenar a mano)
    tx = t3x;
    for (const c of cols3) {
      rect(doc, tx, y, c.w, rowH23);
      if (c.label === 'MOTIVO') {
        // Dos opciones con su círculo (radio) para marcar a mano, apiladas
        // para que el rótulo salga grande.
        doc.setDrawColor(90, 90, 100);
        doc.setLineWidth(0.25);
        doc.circle(tx + 3, y + 3.4, 1.3);
        celdaTexto(doc, 'FALLA TELA', tx + 5.2, 30, y + 4.6, { size: 8, align: 'left', fit: 'shrink' });
        doc.circle(tx + 3, y + 8.2, 1.3);
        celdaTexto(doc, 'ERROR CORTE', tx + 5.2, 30, y + 9.4, { size: 8, align: 'left', fit: 'shrink' });
      }
      tx += c.w;
    }
    y += rowH23;
  }
  // No pisar el recuadro grande TOTAL PAÑOS cuando hay pocas filas.
  y = Math.max(y, y23Box);

  // ── BLOQUE 4: OPTIMIZADOR + SELLO (se mueve entero a otra página si no cabe) ──
  const hOpt = 14 + Math.max(1, hoja.optimizador.length) * 11.5;
  y += 6;
  if (y + Math.max(hOpt, 40) > BOTTOM) nuevaPagina();
  const yAbajo = y;
  drawOptimizador(doc, M, yAbajo, hoja);

  // ── SELLO PAÑOS (abajo der) ──
  doc.setDrawColor(120, 120, 130);
  doc.setLineWidth(0.5);
  doc.roundedRect(180, yAbajo, 100, 40, 4, 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(150, 150, 158);
  doc.text(tema.tituloSello, 230, yAbajo + 23, { align: 'center' });
}

function drawOptimizador(doc: jsPDF, x: number, y: number, hoja: HojaCorte) {
  const cols = [
    { label: 'COD_INT', w: 18 },
    { label: 'OPTIMIZADOR', w: 22 },
    { label: 'PASO 1: CANT P. INICIAL', w: 24 },
    { label: 'PASO 2: CANT P. OPTIMIZADA', w: 24 },
    { label: 'PASO 3: FINAL REVISIÓN P. REAL', w: 26 },
    { label: 'PASO 4: VERIFICADO', w: 22 },
  ];
  let tx = x;
  for (const c of cols) {
    rect(doc, tx, y, c.w, 14, C_DARK);
    celdaTexto(doc, c.label, tx, c.w, y + (c.label.length > 16 ? 5 : 8.8), {
      size: 8,
      bold: true,
      color: C_WHITE,
    });
    tx += c.w;
  }
  let ry = y + 14;
  const rowH = 11.5;
  const filas = hoja.optimizador.length ? hoja.optimizador : [{ codInt: '', metros: 0, esVertical: false }];
  for (const f of filas) {
    tx = x;
    for (const c of cols) {
      rect(doc, tx, ry, c.w, rowH);
      if (c.label === 'COD_INT' && f.codInt) celdaTexto(doc, f.codInt, tx, c.w, ry + 7.8, { size: 12, bold: true, fit: 'shrink' });
      else if (c.label === 'OPTIMIZADOR' && f.codInt) celdaTexto(doc, num(f.metros), tx, c.w, ry + 7.8, { size: 12, fit: 'shrink' });
      tx += c.w;
    }
    ry += rowH;
  }
}
