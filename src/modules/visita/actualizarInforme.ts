// ─────────────────────────────────────────────────────────────────────
// PONER AL DÍA UN INFORME YA ESCRITO, SIN PISAR LO ESCRITO.
//
// El problema real: se arma el informe, la IA le agrega lo conversado en la
// visita, y RECIÉN DESPUÉS alguien carga en Admin la foto referencial de los
// pasos de luz o la ficha de una tela. Hasta acá la única salida era «Armar
// desde la orden», que rehace el informe entero — con la foto, sí, pero
// perdiendo los párrafos de lo que se habló en la casa. Elegir entre la foto y
// lo conversado es una disyuntiva falsa.
//
// Este módulo es ESTRICTAMENTE ADITIVO. No borra una línea, no reescribe una
// frase, no reordena nada: solo mete lo que falta. Es la única forma de que sea
// seguro apretarlo sobre un informe que alguien ya editó a mano.
//
// Cómo ubica cada foto: el esqueleto dice, además de la foto, la línea de texto
// de la que cuelga (su ANCLA). Si esa línea está en el informe, la foto entra
// justo debajo; si el texto de esa parte cambió tanto que el ancla ya no está,
// la foto NO se inventa un lugar — se cuenta como «sin ubicar» y se avisa. Un
// informe con una foto en el lugar equivocado es peor que uno sin la foto.
//
// Módulo PURO (sin React ni Supabase).
// ─────────────────────────────────────────────────────────────────────
import { fotosDelInforme, lineaFoto, urlDeLineaFoto } from './imagenesInforme';

export type ResultadoActualizacion = {
  texto: string;
  /** Fotos que entraron en su lugar. */
  fotosAgregadas: number;
  /** Fotos cuya ancla ya no está en el informe: hay que ponerlas a mano. */
  fotosSinUbicar: number;
  /** Bloques fijos que no estaban y se agregaron al final. */
  bloquesAgregados: number;
};

/** Una foto del esqueleto junto a la línea de texto de la que cuelga. */
type FotoAnclada = { url: string; ancla: string };

/**
 * Recorre un texto armado por la app y devuelve cada foto con su ancla: la
 * última línea de TEXTO que la precede. Dos fotos seguidas comparten ancla, y
 * entran en ese mismo orden.
 */
function fotosAncladas(texto: string): FotoAnclada[] {
  const out: FotoAnclada[] = [];
  let ancla = '';
  for (const linea of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const url = urlDeLineaFoto(linea);
    if (url) {
      if (ancla) out.push({ url, ancla });
      continue;
    }
    if (linea.trim()) ancla = linea.trim();
  }
  return out;
}

/**
 * Mete el marcador debajo de su ancla, detrás de las fotos que ya cuelgan de
 * ella (así dos fotos de una misma intro conservan su orden). Devuelve false si
 * el ancla no está en el informe.
 */
function insertarBajoAncla(lineas: string[], ancla: string, marcador: string): boolean {
  const i = lineas.findIndex((l) => l.trim() === ancla);
  if (i < 0) return false;
  let j = i + 1;
  while (j < lineas.length && urlDeLineaFoto(lineas[j])) j++;
  lineas.splice(j, 0, marcador);
  return true;
}

const primeraLinea = (texto: string): string =>
  texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';

/**
 * Agrega al informe lo que le falta respecto del esqueleto y de los bloques de
 * Admin: las fotos nuevas en su lugar, y los bloques que todavía no están.
 *
 * Un bloque se reconoce por su PRIMERA línea. Si ya está —aunque alguien le haya
 * corregido una coma más abajo— no se toca ni se duplica; si no está (Admin lo
 * creó después de armar el informe), se agrega al final, que es donde va.
 */
export function actualizarFotosYBloques(
  textoActual: string,
  esqueleto: string,
  bloques: readonly string[],
): ResultadoActualizacion {
  const base = String(textoActual ?? '').replace(/\r\n?/g, '\n');
  const lineas = base.split('\n');
  let bloquesAgregados = 0;

  // ── Bloques que faltan por completo, al final ──
  for (const bloque of bloques) {
    const cabeza = primeraLinea(bloque);
    if (!cabeza) continue;
    if (lineas.some((l) => l.trim() === cabeza)) continue;
    if (lineas.length && lineas[lineas.length - 1].trim()) lineas.push('');
    lineas.push(...bloque.split('\n'));
    bloquesAgregados += 1;
  }

  // ── Fotos que faltan, cada una bajo su ancla ──
  // Se buscan en el esqueleto Y en los bloques: una foto de un bloque que ya
  // estaba en el informe también tiene que poder entrar.
  const yaEstan = new Set(fotosDelInforme(lineas.join('\n')));
  let fotosAgregadas = 0;
  let fotosSinUbicar = 0;
  for (const { url, ancla } of fotosAncladas([esqueleto, ...bloques].join('\n\n'))) {
    if (yaEstan.has(url)) continue;
    if (insertarBajoAncla(lineas, ancla, lineaFoto(url))) {
      yaEstan.add(url);
      fotosAgregadas += 1;
    } else {
      fotosSinUbicar += 1;
    }
  }

  return { texto: lineas.join('\n'), fotosAgregadas, fotosSinUbicar, bloquesAgregados };
}
