// ─────────────────────────────────────────────────────────────────────
// El MODELO de la hoja de corte de telas: qué se corta, de qué paño sale
// cada cortina y cuántos metros hay que bajar del rollo.
//
// Vivía dentro de `pdfCorteOptimizacion.ts`, que lo dibujaba derecho en un
// PDF. La pantalla del taller (/produccion → Paños) necesita exactamente lo
// mismo, y arrastrar jsPDF —400 KB— hasta una tablet del galpón solo para
// leer una tabla no tiene sentido. Es un traslado literal: si esto cambia,
// cambia el papel que el cortador tiene en la mano.
//
// Datos: optimizador de paños (tela.ts) + Plan de Corte (planCorte.ts) para
// saber qué pieza sale de qué sobrante de colmena. Módulo PURO.
// ─────────────────────────────────────────────────────────────────────
import { debeInvertirPano, type OptimizerRow } from './tela';
import { letraPano } from './letras';
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

export type TotalPorTela = { producto: string; metros: number; esVertical: boolean };

/**
 * Agrupa los metros del bloque OPTIMIZADOR por NOMBRE DE PRODUCTO: dos COD_INT
 * distintos de la misma tela (ej. dos partidas del mismo blackout) se suman en
 * una sola fila, que es como se compra la tela. Roller y vertical NO se mezclan
 * aunque compartan producto: cada hoja del Excel lleva su propio total.
 */
export function totalesPorTipoDeTela(
  optimizador: MetrosOptimizador[],
  nombreDe: (codInt: string) => string,
): TotalPorTela[] {
  const acc = new Map<string, TotalPorTela>();
  for (const o of optimizador) {
    const producto = nombreDe(o.codInt) || o.codInt;
    const clave = `${producto}|${o.esVertical}`;
    const prev = acc.get(clave);
    if (prev) prev.metros += o.metros;
    else acc.set(clave, { producto, metros: o.metros, esVertical: o.esVertical });
  }
  return [...acc.values()].map((t) => ({ ...t, metros: parseFloat(t.metros.toFixed(3)) }));
}

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

/**
 * Ancho (m) que la pieza consume a lo ancho del rollo: el de CORTE real cuando
 * el despiece lo entrega (oscuridad — Soft Light / Oscuranti / Dark, donde la
 * tela sale MÁS ancha que el nominal en semi/externo) y el ancho nominal en el
 * resto. En roller el corte es ancho−3,5 (menor que el nominal), así que seguir
 * con el nominal es lo conservador y no se toca.
 */
const anchoConsumidoM = (r: OptimizerRow) =>
  typeof r.anchoCorteTelaCm === 'number' ? redM(r.anchoCorteTelaCm / 100) : redM(r.ancho);

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
  // Se compara contra el ancho CONSUMIDO (el de corte real en oscuridad, el
  // nominal en el resto): un externo de 2,90 nominal corta 2,9934 de tela y
  // tampoco entra a lo ancho del rollo.
  // La VERTICAL NUNCA se invierte: su tela se corta en lamas de 8,9 cm que
  // siempre entran a lo ancho del rollo (una ventana ancha = más lamas, en
  // varias pasadas). Si se invirtiera, las lamas quedarían acostadas.
  const esInvertida = (r: OptimizerRow) =>
    r.esVertical
      ? false
      : (r.pano?.invertida ?? debeInvertirPano(anchoConsumidoM(r), r.anchoRollo, params.bordeCm));

  // Pasadas del rollo para una vertical más ancha que el rollo: se cortan las
  // lamas en varias franjas a lo largo del rollo (ceil(ancho / ancho rollo)).
  const pasadasVertical = (r: OptimizerRow) =>
    r.esVertical && r.anchoRollo > 0 && r.ancho > r.anchoRollo
      ? Math.ceil(r.ancho / r.anchoRollo)
      : 0;

  // Clave de paño por fila:
  //  · invertida → cada una su propio paño (rotada, ocupa el rollo a lo largo)
  //  · resto → letra "cortar junto" del optimizador + N° DE PAÑO. La letra sola
  //    no basta: los planes GUARDADOS antes del arreglo de letras daban la
  //    vuelta en la Z, y en una OT con >26 paños la misma letra nombraba paños
  //    DISTINTOS — la hoja los fusionaba y reservaba un tercio de la tela
  //    (OT 268-6: 88 cortinas de 2 m → decía 26 paños). Con el n° en la clave,
  //    la misma letra con n° distinto son paños distintos; con el mismo n° (o
  //    ambos vacíos, como en los grupos armados a mano solo por letra) se
  //    siguen cortando juntos.
  // (Planes antiguos podían traer junto = "RR" —la marca de «no cabe»— en varias
  //  filas SIN n° de paño: se separan por índice para que cada una quede en su
  //  propio paño y no colapsen en uno. Con n° de paño ya no hace falta: hoy
  //  "RR" es la letra legítima del paño 44 —A…Z, AA, BB… RR— y sus filas deben
  //  cortarse juntas como cualquier otra.)
  // Sufijo ·V: vertical y roller NUNCA comparten paño (van en hojas separadas).
  // Aunque el empaque ya los separa, un plan GUARDADO viejo podría traer un grupo
  // mixto; el sufijo garantiza que ningún paño quede a caballo entre las dos hojas.
  const claveJunto = (r: OptimizerRow, idx: number) => {
    const suf = r.esVertical ? '·V' : '';
    if (esInvertida(r)) return `INV#${idx}${suf}`;
    const sinNumero = r.numeroPano == null || r.numeroPano === '';
    if (r.junto === 'RR' && sinNumero) return `RR#${idx}${suf}`;
    return `${r.junto || `·${idx}`}#${String(r.numeroPano ?? '')}${suf}`;
  };

  // N.º de paño por clave (orden de aparición): primera clave → 1, etc.
  const juntoNum = new Map<string, number>();
  rows.forEach((r, idx) => {
    const k = claveJunto(r, idx);
    if (!juntoNum.has(k)) juntoNum.set(k, juntoNum.size + 1);
  });
  const letra = letraPano; // …Z, AA, BB… — mismas letras que asigna el optimizador

  // ── Bloque 1: una fila por cortina ──
  const cortinas: FilaCorteCortina[] = rows.map((r, idx) => {
    const pid = pieceId(ot.id, r.ventanaId, r.panoIndex);
    const inv = esInvertida(r);
    // Más ancha que el rollo y no rota → no cabe. El aviso va en COMENTARIO;
    // CORTAR JUNTO siempre muestra la letra del paño (nunca "RR"). La vertical
    // se excluye: nunca "no cabe" (se corta en lamas), lleva su propio aviso.
    const noCabe = !inv && !r.esVertical && anchoConsumidoM(r) > r.anchoRollo;
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
    // En oscuridad manda el ancho de CORTE real (mayor que el nominal en
    // semi/externo): un paño invertido se corta a ESA medida, no a la nominal.
    const anchoMax = Math.max(...grupo.map((g) => anchoConsumidoM(g)));
    // ¿El grupo trae ancho de corte propio del despiece (oscuridad)? Solo en ese
    // caso el total del OPTIMIZADOR usa el ancho consumido para las invertidas.
    const conCorteTela = grupo.some((g) => typeof g.anchoCorteTelaCm === 'number');
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
    // Paño INVERTIDO de oscuridad: el rollo se baja a lo largo del ANCHO de
    // corte real (lo mismo que muestra TOTAL PAÑOS), no del alto. En roller se
    // mantiene el criterio manual de siempre (alto de corte).
    const claveOpt = `${ref.codInt}|${vert}`;
    const prev = metrosPorCod.get(claveOpt);
    const suma = colmena ? 0 : inv ? (conCorteTela ? anchoMax : corteReal) : altoMax;
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
