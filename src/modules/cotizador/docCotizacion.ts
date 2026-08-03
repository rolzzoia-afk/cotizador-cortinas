// ─────────────────────────────────────────────────────────────────────
// Layout del documento de cotización (Fase 1 / Fase 3).
//
// El documento es HTML que se imprime con `window.print()`, así que el layout
// es una LISTA ORDENADA de bloques en el flujo de la página, no cajas en x/y
// (eso rompería la impresión y el responsive). La única excepción son las
// imágenes FLOTANTES, que sí llevan coordenadas pero relativas a la sección
// sobre la que están ancladas: viajan con ella y por eso imprimen bien.
//
// Hay dos familias de bloques:
//
//   SECCIONES DEL SISTEMA — el contenido vivo de la app. Se reordenan, pero no
//   se ocultan ni se eliminan: sin cortinas o totales la cotización no sirve, y
//   sin catálogo no se puede cotizar. Siempre hay exactamente una de cada.
//     · datos_cliente · catalogo · cortinas · totales
//
//   BLOQUES DE CONTENIDO — los pone el admin donde quiera, y sí se ocultan,
//   eliminan y redimensionan.
//     · terminos       → los términos y condiciones (ver terminos.ts)
//     · banner_cuotas  → la píldora de cuotas con los logos de tarjeta
//     · texto          → un cuadro de texto libre del admin
//     · imagen         → una imagen (Storage o URL), con enlace opcional
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────

export type TipoSeccionDoc = 'datos_cliente' | 'catalogo' | 'cortinas' | 'totales';
export type TipoContenidoDoc = 'terminos' | 'banner_cuotas' | 'texto' | 'imagen' | 'carrusel';
export type TipoBloqueDoc = TipoSeccionDoc | TipoContenidoDoc;
export type AlineacionBloque = 'izquierda' | 'centro' | 'derecha';

/** Bloque anclado sobre una sección, en coordenadas % de esa sección. */
export type PosicionFlotante = {
  sobre: TipoSeccionDoc;
  /** Esquina superior izquierda, en % del ancho/alto de la sección (0–100). */
  x: number;
  y: number;
};

/** Una imagen del carrusel. */
export type ImagenCarrusel = { url: string; enlace?: string; alt?: string };

export type BloqueDoc = {
  id: string;
  tipo: TipoBloqueDoc;
  /** Se dibuja en el documento. Las secciones son siempre visibles. */
  visible: boolean;
  /** Ancho en %: del documento si va en el flujo, de la sección si es flotante. */
  ancho: number;
  alineacion: AlineacionBloque;
  /** Solo `texto`: el contenido (se respetan los saltos de línea). */
  texto?: string;
  /** Solo `texto`: título opcional en negrita arriba del cuadro. */
  titulo?: string;
  /** Solo `imagen`: URL pública (bucket inv-empresa-assets o externa). */
  url?: string;
  /** Solo `imagen`: si está, la imagen es un enlace a esta dirección. */
  enlace?: string;
  /** Solo `imagen`: texto alternativo. */
  alt?: string;
  /** Solo `carrusel`: las imágenes de la fila, en orden. */
  imagenes?: ImagenCarrusel[];
  /** Solo `imagen`/`carrusel`: no ocupa franja propia; flota sobre una sección. */
  flotante?: PosicionFlotante;
  /**
   * Se dibuja en la columna izquierda de la fila de TOTALES, aprovechando el
   * espacio que queda al lado del recuadro de precios. Excluyente con
   * `flotante`.
   */
  juntoATotales?: boolean;
};

export type LayoutDoc = { bloques: BloqueDoc[] };

/** Ancho mínimo/máximo de un bloque, en %. */
export const ANCHO_MIN = 10;
export const ANCHO_MAX = 100;

/** Las secciones del sistema, en el orden en que nace el documento. */
export const SECCIONES: TipoSeccionDoc[] = ['datos_cliente', 'catalogo', 'cortinas', 'totales'];
const CONTENIDOS: TipoContenidoDoc[] = [
  'terminos',
  'banner_cuotas',
  'texto',
  'imagen',
  'carrusel',
];
/** Los tipos que pueden flotar sobre una sección. */
const FLOTABLES: TipoBloqueDoc[] = ['imagen', 'carrusel'];
const ALINEACIONES: AlineacionBloque[] = ['izquierda', 'centro', 'derecha'];

export function esSeccion(tipo: TipoBloqueDoc): tipo is TipoSeccionDoc {
  return (SECCIONES as string[]).includes(tipo);
}

/** Bloque de sección con sus valores fijos (ocupa todo el ancho, siempre visible). */
function seccion(tipo: TipoSeccionDoc): BloqueDoc {
  return { id: tipo, tipo, visible: true, ancho: 100, alineacion: 'izquierda' };
}

/**
 * Layout por defecto. Los términos van EN LA FILA de los totales: ese espacio a
 * la izquierda del recuadro de precios estaba vacío y el documento queda más
 * corto.
 */
export const LAYOUT_DEFAULT: LayoutDoc = {
  bloques: [
    ...SECCIONES.map(seccion),
    {
      id: 'terminos',
      tipo: 'terminos',
      visible: true,
      ancho: 100,
      alineacion: 'izquierda',
      juntoATotales: true,
    },
    { id: 'banner', tipo: 'banner_cuotas', visible: true, ancho: 100, alineacion: 'centro' },
  ],
};

function clampAncho(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return ANCHO_MAX;
  return Math.min(ANCHO_MAX, Math.max(ANCHO_MIN, Math.round(v)));
}

function clampPct(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10));
}

/** Sanea la posición flotante; devuelve undefined si no es utilizable. */
function normalizarFlotante(raw: unknown): PosicionFlotante | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Partial<PosicionFlotante>;
  if (!f.sobre || !esSeccion(f.sobre as TipoBloqueDoc)) return undefined;
  return { sobre: f.sobre, x: clampPct(f.x), y: clampPct(f.y) };
}

/** Sanea las imágenes del carrusel: una sin URL no se puede dibujar. */
function normalizarImagenes(raw: unknown): ImagenCarrusel[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ImagenCarrusel[] = [];
  for (const i of raw) {
    if (!i || typeof i !== 'object') continue;
    const url = typeof i.url === 'string' ? i.url.trim() : '';
    if (!url) continue;
    out.push({
      url,
      enlace: typeof i.enlace === 'string' ? i.enlace.trim() || undefined : undefined,
      alt: typeof i.alt === 'string' ? i.alt : undefined,
    });
  }
  return out;
}

/**
 * Sanea lo que viene de la BD y garantiza el esqueleto del documento: las 4
 * secciones del sistema, exactamente una vez cada una. Si el layout guardado no
 * trae ninguna (formato viejo, cuando solo se configuraba el pie), se insertan
 * en su orden canónico respetando dónde estaba cada bloque de contenido: lo que
 * vivía en el encabezado queda arriba y el resto abajo.
 */
export function normalizarLayout(raw: unknown): LayoutDoc {
  const bloquesRaw = (raw as LayoutDoc | null)?.bloques;
  if (!Array.isArray(bloquesRaw)) return LAYOUT_DEFAULT;

  const bloques: BloqueDoc[] = [];
  const idsVistos = new Set<string>();
  const seccionesVistas = new Set<TipoSeccionDoc>();
  // Formato viejo: los bloques traían `zona: 'encabezado' | 'pie'`.
  const arriba: BloqueDoc[] = [];

  for (const b of bloquesRaw) {
    if (!b || typeof b !== 'object') continue;
    const tipo = String(b.tipo ?? '') as TipoBloqueDoc;
    if (!esSeccion(tipo) && !CONTENIDOS.includes(tipo as TipoContenidoDoc)) continue;

    if (esSeccion(tipo)) {
      // Una sola de cada una: las repetidas se descartan.
      if (seccionesVistas.has(tipo)) continue;
      seccionesVistas.add(tipo);
      idsVistos.add(tipo);
      bloques.push(seccion(tipo));
      continue;
    }

    let id = String(b.id ?? '').trim();
    if (!id || idsVistos.has(id)) id = `${tipo}-${bloques.length}-${arriba.length}`;
    idsVistos.add(id);
    const alineacion = ALINEACIONES.includes(b.alineacion as AlineacionBloque)
      ? (b.alineacion as AlineacionBloque)
      : 'izquierda';
    // Flotar y vivir en la fila de totales son excluyentes: si el guardado
    // trae las dos, manda la flotante (es la más específica).
    const flotante = FLOTABLES.includes(tipo) ? normalizarFlotante(b.flotante) : undefined;
    const bloque: BloqueDoc = {
      id,
      tipo,
      visible: b.visible !== false,
      ancho: clampAncho(b.ancho),
      alineacion,
      texto: typeof b.texto === 'string' ? b.texto : undefined,
      titulo: typeof b.titulo === 'string' ? b.titulo : undefined,
      url: typeof b.url === 'string' ? b.url.trim() || undefined : undefined,
      enlace: typeof b.enlace === 'string' ? b.enlace.trim() || undefined : undefined,
      alt: typeof b.alt === 'string' ? b.alt : undefined,
      imagenes: tipo === 'carrusel' ? normalizarImagenes(b.imagenes) ?? [] : undefined,
      flotante,
      juntoATotales: !flotante && b.juntoATotales === true ? true : undefined,
    };
    if ((b as { zona?: string }).zona === 'encabezado') arriba.push(bloque);
    else bloques.push(bloque);
  }

  if (!bloques.length && !arriba.length) return LAYOUT_DEFAULT;

  // Reponer las secciones que falten, en su orden canónico, antes de los
  // bloques de contenido sueltos (que es donde vivía el pie).
  if (seccionesVistas.size < SECCIONES.length) {
    const faltantes = SECCIONES.filter((s) => !seccionesVistas.has(s));
    const primeraSeccion = bloques.findIndex((b) => esSeccion(b.tipo));
    const corte = primeraSeccion === -1 ? 0 : primeraSeccion;
    bloques.splice(corte, 0, ...faltantes.map(seccion));
  }

  return { bloques: [...arriba, ...bloques] };
}

/**
 * Mueve un bloque (por id) antes de otro, o al final si no se da referencia.
 * Es lo que hace el drag & drop del editor; va por id y no por índice porque el
 * editor esconde bloques (las flotantes no se listan en el flujo).
 */
export function moverBloqueA(bloques: BloqueDoc[], id: string, antesDeId?: string): BloqueDoc[] {
  const movido = bloques.find((b) => b.id === id);
  if (!movido || antesDeId === id) return bloques;
  const resto = bloques.filter((b) => b.id !== id);
  const idx = antesDeId ? resto.findIndex((b) => b.id === antesDeId) : -1;
  if (idx === -1) resto.push(movido);
  else resto.splice(idx, 0, movido);
  return resto;
}

/** Bloque nuevo del tipo pedido, con valores razonables. */
export function bloqueNuevo(tipo: TipoContenidoDoc, sufijo: string): BloqueDoc {
  const base = {
    id: `${tipo}-${sufijo}`,
    tipo,
    visible: true,
    ancho: 100,
    alineacion: 'izquierda' as const,
  };
  if (tipo === 'texto') return { ...base, titulo: '', texto: '' };
  if (tipo === 'imagen') {
    return { ...base, ancho: 50, alineacion: 'centro', url: '', enlace: '', alt: '' };
  }
  if (tipo === 'carrusel') {
    // Nace ocupando el hueco libre de los datos del cliente (a la derecha, bajo
    // Instalación/Envío), que es para lo que se pidió. Desde ahí se arrastra y
    // se redimensiona como cualquier flotante.
    return { ...base, ancho: 60, imagenes: [], flotante: { sobre: 'datos_cliente', x: 35, y: 50 } };
  }
  if (tipo === 'banner_cuotas') return { ...base, alineacion: 'centro' };
  return base;
}

/** Posición inicial de un bloque al volverlo flotante: arriba a la derecha. */
export const FLOTANTE_INICIAL: Omit<PosicionFlotante, 'sobre'> = { x: 60, y: 5 };

/** Etiqueta legible del tipo, para el editor. */
export const LABEL_TIPO: Record<TipoBloqueDoc, string> = {
  datos_cliente: 'Datos del cliente',
  catalogo: 'Catálogo de productos',
  cortinas: 'Cortinas y adicionales',
  totales: 'Totales',
  terminos: 'Términos y condiciones',
  banner_cuotas: 'Banner de cuotas',
  texto: 'Cuadro de texto',
  imagen: 'Imagen',
  carrusel: 'Carrusel de imágenes',
};

/** ¿Este tipo de bloque puede flotar sobre una sección? */
export function puedeFlotar(tipo: TipoBloqueDoc): boolean {
  return FLOTABLES.includes(tipo);
}

/** Clase de alineación (flex) para el contenedor del bloque. */
export function claseAlineacion(a: AlineacionBloque): string {
  return a === 'centro' ? 'justify-center' : a === 'derecha' ? 'justify-end' : 'justify-start';
}

/** Las imágenes y carruseles flotantes anclados a una sección. */
export function flotantesDe(bloques: BloqueDoc[], sobre: TipoSeccionDoc): BloqueDoc[] {
  return bloques.filter((b) => b.visible && b.flotante?.sobre === sobre);
}

/** Los bloques que comparten fila con el recuadro de totales. */
export function bloquesJuntoATotales(bloques: BloqueDoc[]): BloqueDoc[] {
  return bloques.filter((b) => b.juntoATotales && !b.flotante);
}

/**
 * Los bloques que ocupan una franja propia en el flujo del documento: todos
 * menos los que se dibujan en otro lado (flotantes y los de la fila de totales).
 */
export function bloquesEnFlujo(bloques: BloqueDoc[]): BloqueDoc[] {
  return bloques.filter((b) => !b.flotante && !b.juntoATotales);
}
