// ─────────────────────────────────────────────────────────────────────
// El kardex: cómo se le habla a `inventario_registrar` y cómo se lee lo que
// contesta.
//
// Todo lo de este archivo es cuenta pura, sin base de datos: arma las líneas
// que se le mandan a la función, traduce los tipos y los almacenes que usan
// las pantallas viejas, y convierte los códigos de error en algo que una
// persona pueda leer. La plomería está en `kardexStore.ts`.
//
// La función de la base es la ÚNICA que puede mover stock. Acá no se calcula
// ningún saldo a propósito: la cuenta la hace ella, con el artículo bloqueado,
// y devuelve en cuánto quedó. Si esta capa también calculara, tarde o temprano
// las dos cuentas dirían cosas distintas.
// ─────────────────────────────────────────────────────────────────────

/** Los tipos que entiende el kardex. */
export type TipoKardex =
  | 'INGRESO'
  | 'SALIDA'
  | 'TRASLADO'
  | 'DEVOLUCION'
  | 'AJUSTE'
  | 'MERMA'
  | 'CONTEO';

/** Los códigos de almacén: los mismos que en la base. */
export type CodigoAlmacen = 'MP' | 'LIB' | 'MERMA' | `CAM-${number}`;

export type LineaKardex = {
  dominio: 'insumo' | 'tela';
  item_cod: string;
  tipo: TipoKardex;
  cantidad: number;
  /** De dónde sale. En una salida se puede omitir: se reparte solo. */
  origen?: string;
  /** A dónde va. En una salida no se pone. */
  destino?: string;
  motivo?: string;
  referencia_tipo?:
    | 'ot'
    | 'plan_corte'
    | 'recepcion'
    | 'orden_compra'
    | 'conteo'
    | 'camioneta'
    | 'migracion'
    | 'apertura'
    | 'manual';
  referencia_id?: string;
  ot?: string;
  area?: string;
  responsable?: string;
  recibe?: string;
  notas?: string;
};

export type OpcionesKardex = {
  lote_id?: string;
  /** Solo un administrador puede dejar un saldo en negativo. */
  forzar_negativo?: boolean;
  /** Una salida sin origen saca de Liberado antes que de Materias primas. */
  liberado_primero?: boolean;
};

/** Un renglón del libro, tal como lo devuelve la función. */
export type MovimientoRegistrado = {
  id: string;
  item_cod: string;
  tipo: TipoKardex;
  origen: string | null;
  destino: string | null;
  cantidad: number;
  saldo_mp: number;
  saldo_liberado: number;
  saldo_origen_post: number | null;
  saldo_destino_post: number | null;
  desde_liberado: number;
  desde_materias_primas: number;
};

export type RespuestaKardex = {
  lote_id: string;
  movimientos: MovimientoRegistrado[];
};

// ─────────────────────────────────────────────────────────────────────
// Los errores, en palabras
// ─────────────────────────────────────────────────────────────────────

/**
 * La función levanta errores con un código propio (IN001…IN008) para que acá se
 * pueda decir algo útil en vez de mostrar el mensaje crudo de Postgres.
 *
 * El mensaje de la base ya viene escrito para leerse (trae el saldo real, el
 * código del artículo): cuando lo hay, se prefiere ese. El texto de acá es el
 * respaldo, y para IN003 se agrega qué se puede hacer.
 */
export function mensajeErrorKardex(code: string | undefined, mensaje?: string): string {
  const detalle = (mensaje || '').trim();
  switch (code) {
    case 'IN001':
      return 'Se cerró la sesión. Vuelve a entrar y repite el movimiento.';
    case 'IN002':
      return detalle || 'Ese código no está en el catálogo.';
    case 'IN003':
      return detalle
        ? `${detalle}. Puedes sacar solo lo que hay, registrar primero el ingreso que falta, o contar el artículo.`
        : 'No alcanza el stock para ese movimiento.';
    case 'IN004':
      return 'Hay un conteo abierto sobre este artículo: no se puede mover hasta que se cierre.';
    case 'IN005':
      return detalle || 'Los datos del movimiento no son válidos.';
    case 'IN006':
      return detalle || 'El movimiento no dice bien de dónde sale o a dónde va.';
    case 'IN007':
      return detalle || 'Tu rol no puede hacer ese movimiento.';
    case 'IN008':
      return 'El stock solo se puede mover desde las pantallas del inventario.';
    default:
      return detalle || 'No se pudo registrar el movimiento.';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Traducciones desde lo viejo
// ─────────────────────────────────────────────────────────────────────

/**
 * Los almacenes se escriben de cuatro maneras distintas según qué pantalla
 * guardó la fila. Acá se llevan todas al código de la base.
 *
 * Devuelve `undefined` ante lo que no reconoce, en vez de adivinar: un
 * almacén adivinado mueve stock del lugar equivocado.
 */
export function almacenKardex(texto: string | null | undefined): string | undefined {
  const t = String(texto || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!t) return undefined;
  if (t === 'MP' || t === 'MATERIAS_PRIMAS' || t === 'MATERIAS PRIMAS') return 'MP';
  if (t === 'LIB' || t === 'LIBERADO') return 'LIB';
  if (t === 'MERMA') return 'MERMA';
  const cam = t.match(/^CAM-?\s?(\d+)$/);
  if (cam) return `CAM-${Number(cam[1])}`;
  return undefined;
}

/**
 * El tipo del kardex que corresponde a un tipo de los registros viejos.
 *
 * `null` = ese tipo NO mueve stock y por lo tanto no va al kardex. El caso real
 * es «PEDIDO REPOSICION»: es un pedido, no un movimiento, y hoy ensucia el
 * registro de movimientos como si algo hubiera entrado o salido.
 */
export function tipoKardexDesdeLegacy(tipo: string): TipoKardex | null {
  const t = String(tipo || '').trim().toUpperCase();
  if (t === 'NUEVO INGRESO' || t === 'INGRESO') return 'INGRESO';
  if (t === 'SALIDA PRODUCCION' || t === 'SALIDA') return 'SALIDA';
  if (t === 'DEVOLUCION') return 'DEVOLUCION';
  if (t === 'AJUSTE') return 'AJUSTE';
  if (t === 'MERMA') return 'MERMA';
  if (t === 'TRASLADO') return 'TRASLADO';
  if (t === 'CONTEO') return 'CONTEO';
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Armar las líneas
// ─────────────────────────────────────────────────────────────────────

export type EntradaManual = {
  tipo: string;
  codigo: string;
  cantidad: string | number;
  almacen: string;
  ot?: string;
  responsable_entrega?: string;
  recepcion?: string;
  bitacora?: string;
};

/**
 * La línea que reemplaza al movimiento manual de la pantalla de Insumos y de la
 * ficha del artículo.
 *
 * Una SALIDA lleva el almacén como ORIGEN; un ingreso o una devolución, como
 * DESTINO. Mandarlo al revés lo rechaza la función (IN006), que es justo lo que
 * se quiere: antes ese campo era una etiqueta suelta que no decidía nada.
 */
export function lineaDeMovimientoManual(entrada: EntradaManual): LineaKardex | { error: string } {
  const codigo = String(entrada.codigo || '').trim();
  if (!codigo) return { error: 'Selecciona un insumo' };

  const tipo = tipoKardexDesdeLegacy(entrada.tipo);
  if (!tipo) return { error: `«${entrada.tipo}» no mueve stock: no se registra en el kardex.` };

  const cantidad = Number(String(entrada.cantidad).replace(',', '.')) || 0;
  if (cantidad <= 0) return { error: 'La cantidad debe ser mayor a 0' };

  const almacen = almacenKardex(entrada.almacen);
  if (!almacen) return { error: `No reconozco el almacén «${entrada.almacen}»` };

  const linea: LineaKardex = {
    dominio: 'insumo',
    item_cod: codigo,
    tipo,
    cantidad,
    referencia_tipo: entrada.ot ? 'ot' : 'manual',
  };
  if (tipo === 'SALIDA' || tipo === 'MERMA') linea.origen = almacen;
  else linea.destino = almacen;

  if (entrada.ot && entrada.ot.trim()) linea.ot = entrada.ot.trim();
  if (entrada.responsable_entrega) linea.responsable = entrada.responsable_entrega;
  if (entrada.recepcion) linea.recibe = entrada.recepcion;
  if (entrada.bitacora && entrada.bitacora.trim()) linea.notas = entrada.bitacora.trim();
  return linea;
}

export type ItemDespacho = {
  codigo: string;
  cantidad: number;
};

/**
 * Las líneas de un despacho de OT: una por material, TODAS en la misma llamada.
 *
 * Van juntas a propósito. Hoy son N escrituras sueltas y, si la quinta falla,
 * las cuatro anteriores ya descontaron: la OT queda a medio despachar sin que
 * nadie lo sepa. La función las hace o no las hace.
 *
 * Ninguna lleva origen: la función saca de Liberado y sigue por Materias
 * primas, que es lo que hace el taller.
 */
export function lineasDeDespacho(
  items: ItemDespacho[],
  ctx: { ot?: string; responsable?: string; recibe?: string; area?: string },
): LineaKardex[] {
  return items
    .filter((i) => String(i.codigo || '').trim() && Number(i.cantidad) > 0)
    .map((i) => {
      const linea: LineaKardex = {
        dominio: 'insumo',
        item_cod: String(i.codigo).trim(),
        tipo: 'SALIDA',
        cantidad: Number(i.cantidad),
        referencia_tipo: 'ot',
      };
      if (ctx.ot) {
        linea.ot = ctx.ot;
        linea.referencia_id = ctx.ot;
      }
      if (ctx.responsable) linea.responsable = ctx.responsable;
      if (ctx.recibe) linea.recibe = ctx.recibe;
      if (ctx.area) linea.area = ctx.area;
      return linea;
    });
}

/**
 * Cargar, devolver o dar de baja material de una camioneta.
 *
 * Cargar y devolver son TRASLADOS entre la bodega y la camioneta, no salidas:
 * el material sigue siendo de la empresa, solo cambió de lugar. Antes esto
 * escribía en `insumos.stock_total`, que es una columna CALCULADA, y la base
 * descartaba la escritura sin decir nada — por eso la camioneta figuraba con
 * cero movimientos aunque se usara todos los días.
 */
export function lineasDeCamioneta(
  accion: 'cargar' | 'devolver' | 'baja',
  camioneta: string,
  items: ItemDespacho[],
  ctx: { responsable?: string; motivo?: string } = {},
): LineaKardex[] {
  const cam = almacenKardex(camioneta);
  return items
    .filter((i) => String(i.codigo || '').trim() && Number(i.cantidad) > 0)
    .map((i) => {
      const base: LineaKardex = {
        dominio: 'insumo',
        item_cod: String(i.codigo).trim(),
        tipo: accion === 'baja' ? 'MERMA' : 'TRASLADO',
        cantidad: Number(i.cantidad),
        referencia_tipo: 'camioneta',
        referencia_id: camioneta,
      };
      if (accion === 'cargar') {
        base.origen = 'MP';
        base.destino = cam;
      } else if (accion === 'devolver') {
        base.origen = cam;
        base.destino = 'MP';
      } else {
        base.origen = cam;
      }
      if (ctx.responsable) base.responsable = ctx.responsable;
      if (ctx.motivo) base.motivo = ctx.motivo;
      return base;
    });
}

/**
 * La línea de un movimiento de metros de tela.
 *
 * Dos cosas que la pantalla de hoy deja a medias y acá hay que resolver:
 *
 *  - Un TRASLADO tiene un solo campo de almacén. Se toma como el DESTINO y el
 *    origen es la otra bodega, que es lo que dice el título de la pantalla
 *    («Traslado MP ↔ Liberado»).
 *  - Un AJUSTE no dice si suma o resta. Adivinarlo sería mover metros para el
 *    lado equivocado, así que se exige `sentido`.
 */
export function lineaDeTela(entrada: {
  codigo: string;
  tipo: string;
  metros: string | number;
  almacen?: string;
  /** Solo para AJUSTE: si los metros entran o salen. */
  sentido?: 'suma' | 'resta';
  ot?: string;
  responsable?: string;
  notas?: string;
}): LineaKardex | { error: string } {
  const codigo = String(entrada.codigo || '').trim();
  if (!codigo) return { error: 'Selecciona una tela' };

  const tipo = tipoKardexDesdeLegacy(entrada.tipo);
  if (!tipo) return { error: `«${entrada.tipo}» no mueve stock: no se registra en el kardex.` };

  // La tela se mide en metros y sí admite decimales: acá la coma es coma.
  const metros = Number(String(entrada.metros).replace(',', '.')) || 0;
  if (metros <= 0) return { error: 'Los metros deben ser mayores a 0' };

  const linea: LineaKardex = {
    dominio: 'tela',
    item_cod: codigo,
    tipo,
    cantidad: metros,
    referencia_tipo: entrada.ot ? 'ot' : 'manual',
  };
  const almacen = almacenKardex(entrada.almacen);

  if (tipo === 'TRASLADO') {
    if (almacen !== 'MP' && almacen !== 'LIB') {
      return { error: 'Un traslado va entre Materias primas y Liberado.' };
    }
    linea.destino = almacen;
    linea.origen = almacen === 'MP' ? 'LIB' : 'MP';
  } else if (tipo === 'AJUSTE') {
    if (!entrada.sentido) {
      return { error: 'Indica si el ajuste suma o resta metros.' };
    }
    if (entrada.sentido === 'suma') linea.destino = almacen || 'MP';
    else linea.origen = almacen || 'MP';
  } else if (tipo === 'SALIDA' || tipo === 'MERMA') {
    // Una salida sin almacén se reparte sola: no hace falta elegirlo.
    if (almacen) linea.origen = almacen;
  } else {
    linea.destino = almacen || 'MP';
  }

  if (entrada.ot && entrada.ot.trim()) linea.ot = entrada.ot.trim();
  if (entrada.responsable) linea.responsable = entrada.responsable;
  if (entrada.notas && entrada.notas.trim()) linea.notas = entrada.notas.trim();
  return linea;
}

// ─────────────────────────────────────────────────────────────────────
// Leer lo que contestó
// ─────────────────────────────────────────────────────────────────────

/**
 * Qué pasó, en una frase, para el aviso de pantalla.
 *
 * Interesa sobre todo el caso de la salida repartida: la persona pidió sacar 20
 * y salieron 15 de Liberado y 5 de Materias primas. Antes eso lo decidía ella a
 * mano; ahora lo decide la base, así que hay que contárselo.
 */
export function resumenDeMovimientos(r: RespuestaKardex | null | undefined): string {
  const movs = r?.movimientos || [];
  if (movs.length === 0) return 'No se registró ningún movimiento.';

  const porArticulo = new Map<string, MovimientoRegistrado[]>();
  for (const m of movs) {
    const lista = porArticulo.get(m.item_cod) || [];
    lista.push(m);
    porArticulo.set(m.item_cod, lista);
  }

  if (porArticulo.size === 1) {
    const [cod, lista] = [...porArticulo.entries()][0];
    if (lista.length > 1 && lista.every((m) => m.tipo === 'SALIDA')) {
      const partes = lista.map((m) => `${m.cantidad} de ${etiquetaAlmacenCorta(m.origen)}`);
      return `${cod}: salieron ${partes.join(' y ')}.`;
    }
    const m = lista[0];
    return `${cod}: ${m.cantidad} ${describeSentido(m)}.`;
  }

  const repartidos = [...porArticulo.values()].filter((l) => l.length > 1).length;
  const cola = repartidos > 0 ? ` (${repartidos} salieron de dos bodegas)` : '';
  return `${porArticulo.size} artículos movidos${cola}.`;
}

function describeSentido(m: MovimientoRegistrado): string {
  if (m.origen && m.destino) {
    return `de ${etiquetaAlmacenCorta(m.origen)} a ${etiquetaAlmacenCorta(m.destino)}`;
  }
  if (m.destino) return `a ${etiquetaAlmacenCorta(m.destino)}`;
  if (m.origen) return `desde ${etiquetaAlmacenCorta(m.origen)}`;
  return 'registrados';
}

export function etiquetaAlmacenCorta(codigo: string | null | undefined): string {
  const c = String(codigo || '').toUpperCase();
  if (c === 'MP') return 'materias primas';
  if (c === 'LIB') return 'liberado';
  if (c === 'MERMA') return 'merma';
  if (c.startsWith('CAM-')) return `camioneta ${c.slice(4)}`;
  return c || 'ningún lado';
}

/**
 * Un renglón del kardex con la forma del registro viejo, para que las tablas
 * que ya existen lo muestren sin tocarlas.
 *
 * Es una traducción de ida y vuelta: mientras convivan los dos registros, la
 * pantalla no tiene por qué saber cuál de los dos escribió.
 */
export function comoMovimientoViejo(
  m: MovimientoRegistrado,
  extra: { producto?: string | null; ot?: string | null; responsable?: string | null; notas?: string | null },
  fecha: Date = new Date(),
): {
  id: string;
  fecha: string;
  mes: string;
  tipo: string;
  codigo: string;
  producto: string | null;
  almacen: string | null;
  cantidad: number;
  ot: string | null;
  responsable_entrega: string | null;
  recepcion: string | null;
  bitacora: string | null;
} {
  return {
    id: m.id,
    fecha: fecha.toISOString(),
    mes: MESES_KARDEX[fecha.getMonth()],
    tipo: m.tipo === 'INGRESO' ? 'NUEVO INGRESO' : m.tipo === 'SALIDA' ? 'SALIDA PRODUCCION' : m.tipo,
    codigo: m.item_cod,
    producto: extra.producto ?? null,
    almacen: m.origen || m.destino || null,
    cantidad: m.cantidad,
    ot: extra.ot ?? null,
    responsable_entrega: extra.responsable ?? null,
    recepcion: null,
    bitacora: extra.notas ?? null,
  };
}

const MESES_KARDEX = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

/** Los saldos que quedaron, para refrescar la pantalla sin recargar. */
export function saldosFinales(
  r: RespuestaKardex | null | undefined,
): Map<string, { stock_mp: number; stock_liberado: number }> {
  const saldos = new Map<string, { stock_mp: number; stock_liberado: number }>();
  // Se recorre en orden: el ÚLTIMO movimiento de cada artículo es el que manda,
  // porque los anteriores son saldos intermedios de la misma llamada.
  for (const m of r?.movimientos || []) {
    saldos.set(m.item_cod, { stock_mp: m.saldo_mp, stock_liberado: m.saldo_liberado });
  }
  return saldos;
}
