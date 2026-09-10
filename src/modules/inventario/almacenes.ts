// ─────────────────────────────────────────────────────────────────────
// Un solo nombre para cada almacén.
//
// El mismo lugar físico se escribe hoy de cuatro maneras distintas según la
// pantalla que lo haya guardado:
//   · movimientos e insumos      → 'MP' | 'LIBERADO'
//   · mapa de racks              → 'MATERIAS_PRIMAS' | 'LIBERADO'
//   · telas y etiquetas P-touch  → 'MATERIAS PRIMAS' (con espacio)
//   · colmena de paños           → 'GALPON' | 'LIBERADO' | 'ROLZZO'
//
// Nadie los traducía, así que filtrar por almacén dejaba filas afuera sin
// avisar. Acá se decide el código canónico; la función `normalizar_almacen()`
// del SQL (Entrega B) usa exactamente esta misma tabla.
// ─────────────────────────────────────────────────────────────────────

/** Código canónico de un almacén. Los `CAM-n` se arman por camioneta. */
export type CodigoAlmacen = 'MP' | 'LIB' | 'MERMA' | 'GALPON' | 'ROLZZO' | (string & {});

/** Cómo se llama cada almacén en pantalla. */
export const ETIQUETAS_ALMACEN: Record<string, string> = {
  MP: 'Materias primas',
  LIB: 'Liberado',
  MERMA: 'Merma',
  GALPON: 'Galpón',
  ROLZZO: 'Rolzzo',
};

// Cada grafía que existe hoy en la base, mapeada a su código.
const SINONIMOS: Record<string, CodigoAlmacen> = {
  MP: 'MP',
  'MATERIAS PRIMAS': 'MP',
  MATERIAS_PRIMAS: 'MP',
  MATERIASPRIMAS: 'MP',
  'MATERIA PRIMA': 'MP',
  LIB: 'LIB',
  LIBERADO: 'LIB',
  LIBERADOS: 'LIB',
  MERMA: 'MERMA',
  MERMAS: 'MERMA',
  GALPON: 'GALPON',
  ROLZZO: 'ROLZZO',
};

/** Quita tildes, espacios de sobra y lo deja en mayúsculas. */
function limpiar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Devuelve el código canónico de un almacén, o `undefined` si el texto no
 * corresponde a ninguno conocido.
 *
 * Nunca inventa: un texto raro devuelve `undefined` para que la pantalla lo
 * muestre tal cual y se note, en vez de esconderlo en un almacén equivocado.
 */
export function normalizarAlmacen(texto: string | null | undefined): CodigoAlmacen | undefined {
  const t = limpiar(String(texto ?? ''));
  if (!t) return undefined;
  const directo = SINONIMOS[t];
  if (directo) return directo;
  // Camionetas: 'CAM-1', 'CAM 1', 'CAMIONETA 1' → 'CAM-1'.
  const cam = t.match(/^(?:CAM|CAMIONETA)[\s-]*(\d+)$/);
  if (cam) return `CAM-${cam[1]}`;
  return undefined;
}

/** ¿Este código es el de una camioneta? */
export function esAlmacenCamioneta(codigo: string | null | undefined): boolean {
  return /^CAM-\d+$/.test(
    String(codigo ?? '')
      .trim()
      .toUpperCase(),
  );
}

/** Nombre para mostrar. Un código desconocido se muestra tal cual llegó. */
export function etiquetaAlmacen(codigo: string | null | undefined): string {
  const c = String(codigo ?? '')
    .trim()
    .toUpperCase();
  if (!c) return '—';
  if (ETIQUETAS_ALMACEN[c]) return ETIQUETAS_ALMACEN[c];
  const cam = c.match(/^CAM-(\d+)$/);
  if (cam) return `Camioneta ${cam[1]}`;
  return c;
}

/**
 * Qué columna de `insumos` guarda el saldo de este almacén. Las camionetas no
 * tienen columna: viven en `inventario_camioneta`.
 */
export function columnaStock(
  codigo: string | null | undefined,
): 'stock_mp' | 'stock_liberado' | undefined {
  const c = normalizarAlmacen(codigo);
  if (c === 'MP') return 'stock_mp';
  if (c === 'LIB') return 'stock_liberado';
  return undefined;
}
