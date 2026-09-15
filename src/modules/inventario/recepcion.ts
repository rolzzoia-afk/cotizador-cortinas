// ─────────────────────────────────────────────────────────────────────
// Recibir una factura (tramo 3 de Compras): lo común a los tres pasos.
//
//   1. ESCANEAR: se sube el papel, la app lo lee y lo empareja con la orden
//      (`recepcionFactura.ts`). Queda POR CONTAR: nada entra al stock.
//   2. CONTAR: alguien cuenta a mano, bueno y dañado, línea por línea.
//   3. FIRMAR: nombre, firma, fecha y ubicación. Recién ahí lo bueno entra al
//      stock y la recepción queda con su resultado (`recepcionDiferencias.ts`).
//
// Acá viven los tipos que comparten esos pasos, cómo se llama cada estado en
// pantalla, dónde se guardan los archivos y las reglas del conteo. La que
// escribe es la base (`recepcion_abrir` / `recepcion_confirmar`), que vuelve a
// validar todo: la pantalla avisa antes para que nadie firme algo que rebota.
// ─────────────────────────────────────────────────────────────────────

import type { VarianteBadge } from './badges';
import {
  formatearCantidad,
  pendienteDeLinea,
  unidadesDeInventario,
  type DominioCompra,
  type LineaOrden,
  type OrdenCompra,
} from './compras';

// ── El papel ─────────────────────────────────────────────────────────

export type TipoDocumento = 'guia' | 'factura' | 'otro';

export const TIPOS_DOCUMENTO: ReadonlyArray<{ id: TipoDocumento; texto: string }> = [
  { id: 'factura', texto: 'Factura' },
  { id: 'guia', texto: 'Guía de despacho' },
  { id: 'otro', texto: 'Otro papel' },
];

/** «Factura 261881», como lo escribe el kardex en cada ingreso. */
export function etiquetaDocumento(tipo: string | null | undefined, numero: string | null | undefined): string {
  const pref = tipo === 'guia' ? 'Guía' : tipo === 'factura' ? 'Factura' : 'Doc.';
  return `${pref} ${String(numero ?? '').trim()}`.trim();
}

/**
 * El número del papel en su forma canónica: «261.881», «0261881» y «261881»
 * son la misma factura. Espejo de `compras_doc_norm` de la base, que es la que
 * impide recibir dos veces el mismo papel.
 */
export function normalizarNumeroDocumento(numero: unknown): string {
  const limpio = String(numero ?? '')
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase();
  const sinCeros = limpio.replace(/^0+/, '');
  return sinCeros || (limpio.includes('0') ? '0' : '');
}

/** Lo que falta del papel. Vacío = se puede seguir. */
export function problemasDelPapel(d: { tipo: string; numero: string }): string[] {
  const fuera: string[] = [];
  if (!TIPOS_DOCUMENTO.some((t) => t.id === d.tipo)) fuera.push('Elige qué papel llegó.');
  if (!d.numero.trim()) fuera.push('Escribe el número del papel, como viene impreso.');
  return fuera;
}

/** Lo que falta de la firma. Vacío = se puede confirmar. */
export function problemasDeLaFirma(d: { recibe: string; hayFirma: boolean }): string[] {
  const fuera: string[] = [];
  if (!d.recibe.trim()) fuera.push('Falta el nombre de quien recibe.');
  if (!d.hayFirma) fuera.push('Falta la firma de quien recibe.');
  return fuera;
}

// ── Los estados ──────────────────────────────────────────────────────

export type EstadoRecepcion = 'por_contar' | 'contada' | 'cancelada';
export type ResultadoRecepcion = 'ok' | 'con_diferencias' | 'sin_orden';
export type EstadoEnvio = 'pendiente' | 'enviada' | 'error';

type Etiqueta = { texto: string; variante: VarianteBadge };

export const ESTADOS_RECEPCION: Readonly<Record<EstadoRecepcion, Etiqueta>> = {
  por_contar: { texto: 'Por contar', variante: 'accent' },
  contada: { texto: 'Contada', variante: 'success' },
  cancelada: { texto: 'Descartada', variante: 'muted' },
};

export const RESULTADOS_RECEPCION: Readonly<Record<ResultadoRecepcion, Etiqueta>> = {
  ok: { texto: 'Todo correcto', variante: 'success' },
  con_diferencias: { texto: 'Con diferencias', variante: 'destructive' },
  sin_orden: { texto: 'Sin orden de compra', variante: 'warning' },
};

export const ESTADOS_ENVIO: Readonly<Record<EstadoEnvio, Etiqueta>> = {
  pendiente: { texto: 'Por mandar a Gerencia', variante: 'warning' },
  enviada: { texto: 'En Gerencia', variante: 'success' },
  error: { texto: 'No llegó a Gerencia', variante: 'destructive' },
};

function etiquetaDe<K extends string>(
  mapa: Readonly<Record<K, Etiqueta>>,
  valor: string | null | undefined,
): Etiqueta | null {
  if (!valor) return null;
  return mapa[valor as K] ?? { texto: valor, variante: 'muted' };
}

export const etiquetaEstadoRecepcion = (v: string | null | undefined) => etiquetaDe(ESTADOS_RECEPCION, v);
export const etiquetaResultado = (v: string | null | undefined) => etiquetaDe(RESULTADOS_RECEPCION, v);
export const etiquetaEnvio = (v: string | null | undefined) => etiquetaDe(ESTADOS_ENVIO, v);

// ── Cómo se emparejó una línea del papel ─────────────────────────────

export type Vinculo = 'interno' | 'codigo' | 'aprendida' | 'descripcion' | 'manual';
export type MotivoExclusion = 'no_inventario' | 'no_identificado' | 'otro';

export const TEXTO_VINCULO: Readonly<Record<Vinculo, string>> = {
  interno: 'por el código de la orden',
  codigo: 'por el código del proveedor',
  aprendida: 'aprendido de antes',
  descripcion: 'por la descripción',
  manual: 'elegido a mano',
};

export const TEXTO_EXCLUSION: Readonly<Record<MotivoExclusion, string>> = {
  no_inventario: 'No es inventario',
  no_identificado: 'No se sabe qué es',
  otro: 'No se recibe',
};

// ── Qué líneas de la orden se pueden recibir ─────────────────────────

/** Las líneas a las que todavía les falta algo. */
export function lineasPorRecibir(orden: OrdenCompra): LineaOrden[] {
  return (orden.lineas ?? []).filter(
    (l) =>
      (l.estado_linea === 'pendiente' || l.estado_linea === 'parcial') && pendienteDeLinea(l) > 0,
  );
}

/**
 * Una línea sin artículo del catálogo NO se puede recibir: no hay a qué
 * artículo sumarle el stock.
 */
export function motivoNoRecibible(l: LineaOrden): string | null {
  if (!l.item_cod || !l.dominio) return 'Sin artículo del catálogo: vincúlala en la ficha de la orden';
  return null;
}

// ── Una línea mientras se cuenta ─────────────────────────────────────

/**
 * Una línea del papel (o una que llegó sin facturar) con lo contado. Las
 * cantidades van en la unidad de la ORDEN, como dice el papel.
 */
export type LineaConteo = {
  /** El id de la base; las agregadas al contar llevan uno provisorio y `nueva`. */
  id: string;
  nueva?: boolean;
  posicion: number;
  origen: 'factura' | 'manual';
  fact_codigo: string | null;
  fact_descripcion: string | null;
  /** Lo FACTURADO. En las que llegaron sin facturar es 0. */
  fact_cantidad: number | null;
  fact_unidad?: string | null;
  orden_linea_id: string | null;
  dominio: DominioCompra | null;
  item_cod: string | null;
  factor: number;
  vinculo?: Vinculo | null;
  accion: 'recibir' | 'excluir';
  motivo_exclusion: MotivoExclusion | null;
  cantidad_buena: number;
  cantidad_danada: number;
  nota: string | null;
  fotos: string[];
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Lo que entra al kardex por una línea, en unidades del catálogo. */
export function unidadesQueEntran(l: Pick<LineaConteo, 'accion' | 'cantidad_buena' | 'factor'>): number {
  if (l.accion !== 'recibir') return 0;
  return unidadesDeInventario(num(l.cantidad_buena), l.factor);
}

/**
 * «Llegó todo lo facturado»: cada línea que se recibe queda con lo facturado,
 * todo bueno. Es el caso de todos los días; lo raro se corrige en la fila.
 * Las que llegaron sin facturar no se tocan: no hay papel contra qué copiar.
 */
export function llegoTodoLoFacturado(lineas: LineaConteo[]): LineaConteo[] {
  return lineas.map((l) =>
    l.accion === 'recibir' && l.origen === 'factura'
      ? { ...l, cantidad_buena: r3(num(l.fact_cantidad)), cantidad_danada: 0 }
      : l,
  );
}

/**
 * Lo que impide confirmar el conteo, una frase por problema y nombrando la
 * línea. Las diferencias NO están acá: un faltante se puede firmar, y es
 * justamente lo que se le reporta a Gerencia.
 */
export function problemasDelConteo(lineas: LineaConteo[]): string[] {
  const fuera: string[] = [];
  for (const l of lineas) {
    const nombre = `Línea ${l.posicion}`;
    if (num(l.cantidad_buena) < 0 || num(l.cantidad_danada) < 0) {
      fuera.push(`${nombre}: una cantidad no puede ser negativa.`);
      continue;
    }
    if (l.accion === 'excluir') {
      if (!l.motivo_exclusion) fuera.push(`${nombre}: falta decir por qué no se recibe.`);
      continue;
    }
    if (!l.item_cod || !l.dominio) {
      fuera.push(`${nombre}: no tiene artículo del catálogo, no se puede recibir.`);
      continue;
    }
    const unid = unidadesQueEntran(l);
    if (l.dominio === 'insumo' && !Number.isInteger(r3(unid))) {
      fuera.push(
        `${nombre} (${l.item_cod}): da ${formatearCantidad(unid)} unidades y los insumos entran enteros.`,
      );
    }
    if (l.origen === 'manual' && num(l.cantidad_buena) + num(l.cantidad_danada) === 0) {
      fuera.push(`${nombre} (${l.item_cod}): anota cuánto llegó, o quítala.`);
    }
  }
  return fuera;
}

/**
 * Lo que viaja a `recepcion_confirmar`. Van TODAS las líneas: la base rechaza
 * un conteo al que le falta una, porque se leería como «llegó 0».
 *
 * `esperado` es lo que faltaba de la línea de la orden cuando se abrió la
 * pantalla: si alguien recibió en el medio, la base lo nota y no deja firmar
 * sobre números viejos.
 */
export function lineasParaConfirmar(
  lineas: LineaConteo[],
  orden: OrdenCompra | null,
): Array<Record<string, unknown>> {
  const pendiente = new Map((orden?.lineas ?? []).map((l) => [l.id, pendienteDeLinea(l)]));
  return lineas.map((l) => {
    const comun = {
      buena: l.accion === 'recibir' ? r3(num(l.cantidad_buena)) : 0,
      danada: l.accion === 'recibir' ? r3(num(l.cantidad_danada)) : 0,
      esperado: l.orden_linea_id ? (pendiente.get(l.orden_linea_id) ?? null) : null,
      nota: l.nota?.trim() || null,
      fotos: l.fotos,
    };
    if (l.nueva) {
      return {
        ...comun,
        nueva: l.orden_linea_id
          ? { orden_linea_id: l.orden_linea_id, descripcion: l.fact_descripcion }
          : { dominio: l.dominio, item_cod: l.item_cod, factor: l.factor, descripcion: l.fact_descripcion },
      };
    }
    return {
      ...comun,
      linea_id: l.id,
      facturado: l.fact_cantidad,
      accion: l.accion,
      motivo_exclusion: l.accion === 'excluir' ? l.motivo_exclusion : null,
    };
  });
}

// ── Dónde se guardan los archivos ────────────────────────────────────

/**
 * `{empresa}/{carpeta}/{momento}-{azar}.{ext}` en el bucket privado. La
 * primera carpeta TIENE que ser la empresa —es lo que exige la política del
 * bucket y lo que revisa la base— y el nombre no se repite nunca, porque el
 * bucket no deja reemplazar un archivo: es el respaldo de lo que entró.
 *
 * Carpetas: el id de la orden (o `sin-orden`) para el papel, y
 * `recepciones/{id}` para las fotos de las líneas.
 */
export function rutaArchivoRecepcion(
  empresaId: string,
  carpeta: string,
  nombreArchivo: string,
  ahora: number = Date.now(),
  azar: string = Math.random().toString(36).slice(2, 8),
): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(String(nombreArchivo ?? ''));
  const ext = m ? m[1].toLowerCase() : 'jpg';
  const limpia = String(carpeta ?? '')
    .split('/')
    .map((p) => p.replace(/[^A-Za-z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/');
  return `${empresaId}/${limpia || 'sin-carpeta'}/${ahora}-${azar}.${ext}`;
}

/**
 * La ficha de una recepción, conservando el `?rol=` de «ver como». Con
 * `contar`, la ficha abre el conteo sola: es el «Contar ahora» del escaneo.
 */
export function rutaFichaRecepcion(id: string, queryRol = '', contar = false): string {
  const q = new URLSearchParams(queryRol.replace(/^\?/, ''));
  if (contar) q.set('contar', '1');
  const s = q.toString();
  return `/inventario/compras/recepciones/${id}${s ? `?${s}` : ''}`;
}

/** «11-09-2026 15:21», en la hora de Chile. `—` si no hay fecha. */
export function fechaHoraCL(iso: string | null | undefined, conHora = true): string {
  // Una fecha sola («2026-09-10», la del papel) no tiene hora: pasarla por
  // `Date` la lee como medianoche UTC, y en Chile saldría el día anterior.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (soloFecha) return `${soloFecha[3]}-${soloFecha[2]}-${soloFecha[1]}`;
  const t = Date.parse(String(iso ?? ''));
  if (Number.isNaN(t)) return '—';
  return new Date(t)
    .toLocaleString('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      // 24 horas siempre: según el motor, es-CL sale a veces con «p. m.».
      ...(conHora ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
    })
    .replace(',', '');
}

/** HEIC/HEIF: el iPhone los saca así y la lectura automática no los abre. */
export function esHeic(archivo: { name?: string; type?: string }): boolean {
  return (
    /image\/hei[cf]/i.test(String(archivo.type ?? '')) || /\.(heic|heif)$/i.test(String(archivo.name ?? ''))
  );
}
