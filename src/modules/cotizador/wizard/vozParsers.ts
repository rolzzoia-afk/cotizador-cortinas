// ─────────────────────────────────────────────────────────────────────
// LO QUE SE ENTIENDE DE LO QUE SE DICE — parte pura del asistente de voz.
//
// El reconocedor del navegador devuelve una frase suelta («un metro ochenta y
// cinco», «que sea externo», «be ka diez»). Acá se convierte en el valor que el
// wizard guarda. Todo es función pura: no hay micrófono, ni React, ni window.
//
// Regla de oro: ante la duda NO se inventa. Un parser que no está seguro
// devuelve «ambigua» (con hasta 3 candidatos, que la voz lee numerados) o
// «nada» (y se vuelve a preguntar). Escribir un dato equivocado en terreno es
// mucho peor que preguntar dos veces.
// ─────────────────────────────────────────────────────────────────────
import { esCortinaTipo } from '../flujoCatalogo';
import type { CatalogoProductos } from '../types';

/**
 * Texto sin tildes, en minúsculas y con la puntuación vuelta espacio. La coma
 * y el punto ENTRE DÍGITOS sobreviven como punto decimal («1,85» → «1.85»);
 * el resto se borra, porque el reconocedor puntúa solo y un «rodapié,» con
 * coma pegada no calzaría con ninguna opción.
 */
export function normalizarVoz(t: unknown): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1\u0000$2')
    .replace(/[^a-z0-9\u0000]+/g, ' ')
    .replace(/\u0000/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (t: string): string[] => (t ? t.split(' ').filter(Boolean) : []);

/** ¿La frase `aguja` aparece como palabra(s) completas dentro de `hay`? */
export function incluyePalabra(hay: string, aguja: string): boolean {
  if (!aguja) return false;
  return ` ${hay} `.includes(` ${aguja} `);
}

// ── Números hablados ──────────────────────────────────────────────────

const NUMERO_PALABRA: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200,
  trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600,
  setecientos: 700, ochocientos: 800, novecientos: 900,
};

/** Palabras que solo dicen la unidad: no aportan al número. */
const PALABRAS_UNIDAD = new Set([
  'metro', 'metros', 'mts', 'mt', 'm', 'centimetro', 'centimetros', 'cms', 'cm',
  'de', 'el', 'la', 'los', 'las', 'y', 'mide', 'son', 'es',
]);

/**
 * Un número dicho en palabras o en dígitos, 0-999. Suma lo que reconoce
 * («ciento ochenta y cinco» = 100 + 80 + 5) y devuelve null si aparece
 * cualquier palabra que no sea número ni unidad — así «hola» no vale 0.
 */
export function palabrasANumero(texto: string): number | null {
  const ts = tokens(normalizarVoz(texto));
  let total = 0;
  let vistos = 0;
  for (const t of ts) {
    if (PALABRAS_UNIDAD.has(t)) continue;
    if (/^\d+$/.test(t)) {
      total += parseInt(t, 10);
      vistos++;
      continue;
    }
    const n = NUMERO_PALABRA[t];
    if (n === undefined) return null;
    total += n;
    vistos++;
  }
  return vistos > 0 ? total : null;
}

/** Número → string con PUNTO decimal, que es como se guardan ancho/alto. */
export function formatearNumero(n: number): string {
  return String(Number(n.toFixed(4)));
}

/** El mismo número, pero escrito como se lee en Chile (coma decimal). */
export function numeroHablado(valor: string | number): string {
  return String(valor).replace('.', ',');
}

export type Unidad = 'm' | 'cm';

export type ResultadoMedida =
  | { ok: true; valor: string; numero: number }
  | { ok: false; motivo: 'no-numero' | 'fuera-de-rango'; numero?: number };

const RANGO: Record<Unidad, { min: number; max: number }> = {
  m: { min: 0.1, max: 10 },
  cm: { min: 1, max: 400 },
};

/**
 * Una medida dicha de cualquiera de las formas de terreno:
 * «1,85» · «185» · «uno coma ochenta y cinco» · «un metro ochenta y cinco» ·
 * «un metro y medio» · «ochenta centímetros».
 *
 * El entero suelto mayor que 10 se entiende en CENTÍMETROS («185» = 1,85 m):
 * nadie mide una cortina de 185 metros, y en terreno se dicta así.
 */
export function parsearMedida(texto: string, unidad: Unidad): ResultadoMedida {
  const n = normalizarVoz(texto);
  if (!n) return { ok: false, motivo: 'no-numero' };

  let resto = n;
  const medio = /\b(y )?medi[oa]\b/.test(resto);
  if (medio) resto = resto.replace(/\b(y )?medi[oa]\b/g, ' ').replace(/\s+/g, ' ').trim();

  const dijoCm = /\b(centimetros?|cms?|cm)\b/.test(resto);
  const dijoM = !dijoCm && /\b(metros?|mts?|mt|m)\b/.test(resto);

  let numero: number | null = null;
  // El hablante dio decimales de forma explícita: no hay que interpretar nada.
  let explicito = false;

  const mDec = resto.match(/(\d+)\s*[.,]\s*(\d+)/);
  if (mDec) {
    numero = parseFloat(`${mDec[1]}.${mDec[2]}`);
    explicito = true;
  }

  if (numero === null) {
    const mCon = resto.match(/^(.*?)\b(?:coma|punto|con)\b(.*)$/);
    if (mCon) {
      const a = palabrasANumero(mCon[1]);
      const b = palabrasANumero(mCon[2]);
      if (a !== null && b !== null) {
        // «cero coma cero cinco»: el cero inicial de los decimales se pierde al
        // sumar, así que se repone a mano.
        const ceros = /^cero\b/.test(mCon[2].trim()) ? '0' : '';
        numero = parseFloat(`${a}.${ceros}${b}`);
        explicito = true;
      }
    }
  }

  if (numero === null) {
    const mMet = resto.match(/^(.*?)\b(?:metros?|mts?|mt|m)\b(.*)$/);
    if (mMet) {
      const a = palabrasANumero(mMet[1]);
      const b = mMet[2].trim() ? palabrasANumero(mMet[2]) : null;
      if (a !== null && b !== null) {
        numero = parseFloat(`${a}.${b}`);
        explicito = true;
      } else if (a !== null) {
        numero = a;
      }
    }
  }

  if (numero === null) numero = palabrasANumero(resto);
  if (numero === null || !Number.isFinite(numero)) return { ok: false, motivo: 'no-numero' };
  if (medio) numero += 0.5;

  if (unidad === 'm') {
    if (dijoCm) numero = numero / 100;
    else if (!explicito && !dijoM && Number.isInteger(numero) && numero > 10) numero = numero / 100;
  } else if (dijoM || (explicito && !dijoCm && numero <= 10)) {
    numero = numero * 100;
  }

  const { min, max } = RANGO[unidad];
  if (numero < min || numero > max) return { ok: false, motivo: 'fuera-de-rango', numero };
  return { ok: true, numero, valor: formatearNumero(numero) };
}

export type ResultadoEntero = { ok: true; valor: number } | { ok: false };

/** Una cantidad: «dos», «3», «ninguna» (=0). «muchas» no es un número. */
export function parsearEntero(texto: string): ResultadoEntero {
  const n = normalizarVoz(texto);
  if (!n) return { ok: false };
  if (!/\d/.test(n) && /\b(ningun[oa]s?|ninguno|nada|no|cero)\b/.test(n)) {
    return { ok: true, valor: 0 };
  }
  const v = palabrasANumero(n);
  if (v === null || v < 0) return { ok: false };
  return { ok: true, valor: Math.round(v) };
}

// ── Opciones de una lista ─────────────────────────────────────────────

export type OpcionVoz = { value: string; label: string; sinonimos?: string[] };

export type MatchOpcion =
  | { tipo: 'unica'; opcion: OpcionVoz }
  | { tipo: 'ambigua'; opciones: OpcionVoz[] }
  | { tipo: 'nada' };

/** Todo lo que puede decirse para elegir una opción. */
function candidatos(o: OpcionVoz): string[] {
  return [o.value, o.label, ...(o.sinonimos ?? [])]
    .map((c) => normalizarVoz(c))
    .filter(Boolean);
}

function puntajeCandidato(cand: string, texto: string): number {
  if (!cand) return 0;
  if (cand === texto) return 100;
  // Lo dicho contiene la opción entera («que sea externo» → Externo). Gana la
  // opción más larga: «cuadrada a muro» le gana a «cuadrada» a secas.
  if (incluyePalabra(texto, cand)) return 80 + Math.min(15, cand.length * 0.3);
  // Lo dicho es un pedazo de la opción («cuadrada» → «cuadrada a muro»): sirve,
  // pero empata con las hermanas y por eso queda ambiguo.
  if (incluyePalabra(cand, texto)) return 60 + Math.min(10, texto.length * 0.2);
  const tc = tokens(cand);
  const tt = tokens(texto);
  if (tc.length === 0 || tt.length === 0) return 0;
  const comunes = tc.filter((t) => tt.includes(t)).length;
  if (comunes === 0) return 0;
  return (comunes / Math.max(tc.length, tt.length)) * 50;
}

/**
 * Qué opción de la lista se dijo. Devuelve «ambigua» cuando dos opciones
 * empatan (decir «cuadrada» con «Cuadrada a muro» y «Cuadrada a techo» en la
 * lista) para que la voz lea los candidatos y el vendedor elija por número.
 */
export function matchOpcion(texto: string, opciones: readonly OpcionVoz[]): MatchOpcion {
  const t = normalizarVoz(texto);
  if (!t || opciones.length === 0) return { tipo: 'nada' };
  const puntajes = opciones
    .map((o) => ({ o, p: Math.max(0, ...candidatos(o).map((c) => puntajeCandidato(c, t))) }))
    .filter((x) => x.p >= 20)
    .sort((a, b) => b.p - a.p);
  if (puntajes.length === 0) return { tipo: 'nada' };
  if (puntajes.length === 1 || puntajes[0].p - puntajes[1].p >= 15) {
    return { tipo: 'unica', opcion: puntajes[0].o };
  }
  return { tipo: 'ambigua', opciones: puntajes.slice(0, 3).map((x) => x.o) };
}

/** «la primera», «dos», «el tercero» → 1 / 2 / 3. Null si no es un ordinal. */
export function parsearOrdinal(texto: string): number | null {
  const t = normalizarVoz(texto);
  if (!t) return null;
  if (/\b(primer[oa]?|1|un[oa]?)\b/.test(t)) return 1;
  if (/\b(segund[oa]|2|dos)\b/.test(t)) return 2;
  if (/\b(tercer[oa]?|3|tres)\b/.test(t)) return 3;
  return null;
}

// ── Comandos ──────────────────────────────────────────────────────────

export type ComandoVoz =
  | 'siguiente'
  | 'anterior'
  | 'repetir'
  | 'saltar'
  | 'corregir'
  | 'parar'
  | 'si'
  | 'no';

const FRASES_COMANDO: { comando: ComandoVoz; frases: string[]; soloConfirmacion?: boolean }[] = [
  { comando: 'siguiente', frases: ['siguiente', 'avanza', 'avanzar', 'sigue', 'seguir', 'continuar', 'continua', 'listo', 'ya esta'] },
  { comando: 'anterior', frases: ['anterior', 'atras', 'volver', 'vuelve', 'para atras', 'retroceder'] },
  { comando: 'repetir', frases: ['repetir', 'repite', 'de nuevo', 'otra vez', 'no te entendi', 'que dijiste'] },
  { comando: 'saltar', frases: ['saltar', 'salta', 'saltalo', 'omitir', 'omite', 'despues', 'mas tarde', 'no se'] },
  { comando: 'parar', frases: ['parar', 'detener', 'deten', 'apagar', 'apaga', 'silencio', 'basta', 'ya no', 'terminar', 'termina'] },
  { comando: 'corregir', frases: ['corregir', 'corrige', 'cambiar', 'cambia', 'modificar', 'editar'] },
  { comando: 'si', frases: ['si', 'correcto', 'asi es', 'exacto', 'dale'], soloConfirmacion: true },
  { comando: 'no', frases: ['no', 'incorrecto', 'esta mal'], soloConfirmacion: true },
];

export type ResultadoComando = { comando: ComandoVoz; resto: string };

/**
 * ¿Lo dicho es una orden para el asistente y no el valor de un campo?
 *
 * Se acepta la frase COMPLETA o el comienzo de la frase, nunca en medio: así
 * «derecha» no se confunde con «de nuevo» y «pieza dos» no se confunde con
 * nada. En los campos de texto libre (ubicación, comentario) el llamador pide
 * `soloExacto`, porque ahí cualquier palabra puede ser parte de la respuesta
 * («para el living» no es «parar»).
 */
export function parsearComando(
  texto: string,
  opts: { enConfirmacion?: boolean; soloExacto?: boolean } = {},
): ResultadoComando | null {
  const t = normalizarVoz(texto);
  if (!t) return null;
  for (const { comando, frases, soloConfirmacion } of FRASES_COMANDO) {
    if (soloConfirmacion && !opts.enConfirmacion) continue;
    for (const f of frases) {
      if (t === f) return { comando, resto: '' };
      if (!opts.soloExacto && t.startsWith(`${f} `)) {
        return { comando, resto: t.slice(f.length + 1).trim() };
      }
    }
  }
  return null;
}

// ── Códigos de tela ───────────────────────────────────────────────────

const LETRA_HABLADA: Record<string, string> = {
  a: 'A', be: 'B', ce: 'C', de: 'D', e: 'E', efe: 'F', ge: 'G', hache: 'H',
  i: 'I', jota: 'J', ka: 'K', ca: 'K', ele: 'L', eme: 'M', ene: 'N', o: 'O',
  pe: 'P', cu: 'Q', erre: 'R', ere: 'R', ese: 'S', te: 'T', u: 'U', uve: 'V',
  ve: 'V', equis: 'X', ye: 'Y', zeta: 'Z', ceta: 'Z',
};

const NOMBRES_LETRA = Object.keys(LETRA_HABLADA).sort((a, b) => b.length - a.length);

/**
 * Palabra que se arma COMPLETA pegando nombres de letras («beca» = be + ca →
 * BK): así escribe el reconocedor un deletreo rápido. Devuelve null si sobra
 * cualquier pedazo, para no convertir palabras normales en códigos («casa» no
 * se puede armar y queda fuera).
 */
function pegadoALetras(t: string): string | null {
  if (!/^[a-z]{2,10}$/.test(t)) return null;
  const resolver = (resto: string): string | null => {
    if (!resto) return '';
    for (const nombre of NOMBRES_LETRA) {
      if (resto.startsWith(nombre)) {
        const cola = resolver(resto.slice(nombre.length));
        if (cola !== null) return LETRA_HABLADA[nombre] + cola;
      }
    }
    return null;
  };
  return resolver(t);
}

/**
 * Grupo de consonantes sin vocal («sc», «bk»): el reconocedor escribió las
 * letras dichas tal cual, pegadas («sc-de» → SC + D). La «y» queda fuera
 * porque es la conjunción, no una letra deletreada.
 */
function grupoDeConsonantes(t: string): string | null {
  return /^[b-df-hj-np-tv-xz]{1,4}$/.test(t) ? t.toUpperCase() : null;
}

/**
 * El código deletreado en voz alta: «be ka diez» → «BK 10». Devuelve '' si no
 * se deletreó nada (entonces el ranking usa la frase tal cual).
 */
export function deletreoACodigo(texto: string): string {
  const ts = tokens(normalizarVoz(texto));
  const partes: string[] = [];
  let letras = '';
  let huboLetras = false;
  const cerrarLetras = () => {
    if (letras) {
      partes.push(letras);
      huboLetras = true;
      letras = '';
    }
  };
  for (const t of ts) {
    if (/^[a-z]{1,5}$/.test(t) && LETRA_HABLADA[t]) {
      letras += LETRA_HABLADA[t];
      continue;
    }
    const n = /^\d+$/.test(t) ? parseInt(t, 10) : NUMERO_PALABRA[t];
    if (n !== undefined && n !== null) {
      cerrarLetras();
      partes.push(String(n));
      continue;
    }
    const pegadas = grupoDeConsonantes(t) ?? pegadoALetras(t);
    if (pegadas) {
      letras += pegadas;
      continue;
    }
    cerrarLetras();
  }
  cerrarLetras();
  return huboLetras ? partes.join(' ') : '';
}

export type OpcionTela = { codInt: string; producto: string };

export type MatchTela =
  | { tipo: 'unica'; opcion: OpcionTela }
  | { tipo: 'ambigua'; opciones: OpcionTela[] }
  | { tipo: 'nada' };

function puntajeTela(codInt: string, producto: string, dicho: string): number {
  const cod = normalizarVoz(codInt);
  const codSin = cod.replace(/ /g, '');
  const dichoSin = dicho.replace(/ /g, '');
  if (cod === dicho) return 100;
  if (codSin === dichoSin) return 95;
  if (codSin.startsWith(dichoSin) && dichoSin.length >= 2) return 80;
  const prod = normalizarVoz(producto);
  if (!prod || !dicho) return 0;
  const td = tokens(dicho);
  const comunes = td.filter((t) => incluyePalabra(prod, t)).length;
  if (comunes === 0) return 0;
  return 60 * (comunes / td.length);
}

/**
 * Qué tela del catálogo se dijo. Solo mira las que se pueden vender como
 * cortina (las mismas que ofrece el selector de Fase 2), y prueba tanto la
 * frase tal cual como el código deletreado.
 */
export function parsearCodigoTela(texto: string, catalogo: CatalogoProductos): MatchTela {
  const dicho = normalizarVoz(texto);
  if (!dicho) return { tipo: 'nada' };
  const deletreo = normalizarVoz(deletreoACodigo(texto));
  const entradas = Object.entries(catalogo).filter(([, p]) => esCortinaTipo(p?.tipo));
  const puntajes = entradas
    .map(([codInt, p]) => {
      const producto = p?.producto || '';
      const puntaje = Math.max(
        puntajeTela(codInt, producto, dicho),
        deletreo ? puntajeTela(codInt, producto, deletreo) : 0,
      );
      return { opcion: { codInt, producto }, puntaje };
    })
    .filter((x) => x.puntaje >= 40)
    .sort((a, b) => b.puntaje - a.puntaje || a.opcion.codInt.localeCompare(b.opcion.codInt));
  if (puntajes.length === 0) return { tipo: 'nada' };
  if (
    puntajes[0].puntaje >= 80 &&
    (puntajes.length === 1 || puntajes[0].puntaje - puntajes[1].puntaje >= 15)
  ) {
    return { tipo: 'unica', opcion: puntajes[0].opcion };
  }
  return { tipo: 'ambigua', opciones: puntajes.slice(0, 3).map((x) => x.opcion) };
}
