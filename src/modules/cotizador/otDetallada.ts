// ─────────────────────────────────────────────────────────────────────
// La OT DETALLADA: el texto que va bajo el título del PDF del cliente y en la
// celda OT CLIENTE («N° COTJS - 07979-5 -1 - VISITA-VERTICALES Y DUAL CON
// CENEFA CUADRADA»).
//
// En la planilla lo escribe la vendedora a mano; acá se propone armado con lo
// que la cotización YA sabe —número, si hubo visita, qué cortinas y qué
// adicionales— y queda editable: la propuesta es un punto de partida, no una
// regla. Por eso el texto es deliberadamente conservador: nombra solo lo que
// se puede deducir sin equivocarse.
//
// Módulo PURO: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────

/** Lo mínimo que hace falta de cada línea para nombrarla. */
export type ItemOtDetallada = {
  /** La familia del catálogo (DUOBK_P, BLACKOUT_V_S, CENF C…). */
  cod: string;
  /** El nombre del producto («ROLLER DUO BLACKOUT PREMIUM»). */
  nombre: string;
};

export type EntradaOtDetallada = {
  /** El N° de la OT tal como se muestra («3201», «COTJS - 07979-5 -1»). */
  numero: string;
  /**
   * El nombre de quien cotiza: de ahí salen las dos letras del folio
   * («Antonio Pascuzzo» → COT**AP**). Vacío = el folio va sin «COT».
   */
  vendedor: string;
  /** La cotización viene de una visita a terreno. */
  conVisita: boolean;
  cortinas: ItemOtDetallada[];
  adicionales: ItemOtDetallada[];
};

const may = (s: string): string =>
  String(s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Cómo se llama cada tipo de cortina en el texto. El ORDEN manda: la primera
 * que calza es la que nombra a la línea (una vertical blackout es «VERTICALES»,
 * no «BLACKOUT»), y es también el orden en que salen en el texto, para que la
 * misma cotización proponga siempre lo mismo.
 */
const TIPOS: Array<{ nombre: string; calza: (cod: string, nombre: string) => boolean }> = [
  // Vertical y dúo se deducen como en el motor (ver flujoCatalogo.ts).
  { nombre: 'VERTICALES', calza: (c, n) => /(_V_|-V$|-V-)/.test(c) || n.includes('VERTICAL') },
  { nombre: 'DUAL', calza: (c, n) => c.startsWith('DUO') || n.includes('DUO') },
  { nombre: 'BEEBLACK', calza: (c, n) => c.startsWith('BEE') || n.includes('BEEBLACK') },
  { nombre: 'OSCURIDAD', calza: (_c, n) => n.includes('OSCURIDAD') || n.includes('OSCURANTI') },
  { nombre: 'DARK', calza: (_c, n) => n.includes('DARK') },
  { nombre: 'SOFT LIGHT', calza: (_c, n) => n.includes('SOFT LIGHT') },
  { nombre: 'SCREEN', calza: (_c, n) => n.includes('SCREEN') },
  { nombre: 'BLACKOUT', calza: (_c, n) => n.includes('BLACKOUT') },
];

const esCenefa = (cod: string, nombre: string): boolean =>
  cod.includes('CENF') || nombre.includes('CENEFA');

/** Los adicionales que cambian lo que se fabrica y por eso se nombran. */
const EXTRAS: Array<{ nombre: string; calza: (cod: string, nombre: string) => boolean }> = [
  // Los códigos son «CENF C» y «CENF O»: la letra suelta del final es la que
  // manda (`CENF` tiene una C adentro, así que no sirve un `includes`).
  {
    nombre: 'CENEFA CUADRADA',
    calza: (c, n) => esCenefa(c, n) && (/\bC$/.test(c) || n.includes('CUADRAD')),
  },
  {
    nombre: 'CENEFA OVALADA',
    calza: (c, n) => esCenefa(c, n) && (/\bO$/.test(c) || n.includes('OVALAD')),
  },
  { nombre: 'MOTOR', calza: (c, n) => c.includes('MOTOR') || n.includes('MOTOR') },
];

/**
 * Las dos letras del folio: la inicial del nombre y la del apellido, como se
 * escriben hoy («Antonio Pascuzzo» → «AP», y por eso los COTAP de la carpeta
 * de referencias). Un nombre de una sola palabra no permite distinguir nombre
 * de apellido: se usan sus dos primeras letras para no romper el formato.
 * Vacío si no hay nada usable — mejor un folio sin letras que letras inventadas.
 */
export function inicialesVendedor(nombre: string): string {
  const palabras = may(nombre)
    .split(/[\s.]+/)
    .filter((p) => /^[A-ZÑ]/.test(p));
  if (!palabras.length) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 2);
  return palabras[0][0] + palabras[palabras.length - 1][0];
}

/** El tipo con el que se nombra una cortina; '' si no calza con ninguno. */
export function tipoDeItem(item: ItemOtDetallada): string {
  const cod = may(item.cod);
  const nombre = may(item.nombre);
  return TIPOS.find((t) => t.calza(cod, nombre))?.nombre ?? '';
}

/**
 * El folio como se escribe en la cotización: «N° COT» + las dos letras de quien
 * vende + el número de la OT («N° COTAP - 3201»). El número NO se inventa acá:
 * es el mismo con el que la app crea la OT, para que el documento del cliente y
 * la OT no puedan decir cosas distintas.
 */
export function folioOtDetallada(numero: string, vendedor: string): string {
  const n = String(numero ?? '').trim();
  if (!n) return '';
  // Un número tecleado a mano que ya viene con el folio completo se respeta.
  if (may(n).includes('COT')) return may(n).startsWith('N°') ? n : `N° ${n}`;
  const iniciales = inicialesVendedor(vendedor);
  return iniciales ? `N° COT${iniciales} - ${n}` : `N° ${n}`;
}

/**
 * El texto propuesto. Vacío si la cotización todavía no dice nada (sin número,
 * sin cortinas y sin adicionales nombrables): más vale dejar el campo en blanco
 * que proponer un «N° -» que la vendedora tenga que borrar.
 */
export function otDetalladaSugerida(e: EntradaOtDetallada): string {
  const tipos: string[] = [];
  for (const t of TIPOS) {
    if (e.cortinas.some((c) => tipoDeItem(c) === t.nombre)) tipos.push(t.nombre);
  }
  // Una cortina que no calza con ningún tipo conocido igual tiene que aparecer.
  if (!tipos.length && e.cortinas.length) tipos.push('CORTINAS');

  const extras: string[] = [];
  for (const x of EXTRAS) {
    if (e.adicionales.some((a) => x.calza(may(a.cod), may(a.nombre)))) extras.push(x.nombre);
  }

  const partes: string[] = [];
  const folio = folioOtDetallada(e.numero, e.vendedor);
  if (folio) partes.push(folio);
  if (e.conVisita) partes.push('VISITA');
  const que = [tipos.join(' Y '), extras.length ? `CON ${extras.join(' Y ')}` : '']
    .filter(Boolean)
    .join(' ');
  if (que) partes.push(que);
  // Solo el número (sin nada que describir) no es una OT detallada: es el folio,
  // que ya sale en su celda.
  return partes.length && que ? partes.join(' - ') : '';
}
