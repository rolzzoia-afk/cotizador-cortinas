// Lo que viaja a la bandeja de Gerencia, armado por LISTA BLANCA: solo los
// campos nombrados acá, nunca «toda la fila». Una columna nueva en la
// recepción no llega a Finanzas hasta que alguien la agregue a propósito.
//
// Puro (sin Deno ni red) para poder probarlo aparte.

type Fila = Record<string, unknown>;

export type RutasCopiadas = {
  documento: string | null;
  firma: string | null;
  /** ruta en la bodega → ruta en Finanzas */
  fotos: Map<string, string>;
};

const txt = (v: unknown) => (v == null || v === "" ? null : String(v));
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

function fotosCopiadas(v: unknown, rutas: RutasCopiadas): string[] {
  return (Array.isArray(v) ? v : [])
    .map((p) => rutas.fotos.get(String(p)))
    .filter((p): p is string => !!p);
}

/** Todas las fotos que hay que copiar: las de las líneas y las de las diferencias. */
export function fotosDeRecepcion(rec: Fila, lineas: Fila[]): string[] {
  const todas = new Set<string>();
  for (const l of lineas) for (const p of (l.fotos_paths as unknown[]) ?? []) todas.add(String(p));
  for (const d of (Array.isArray(rec.diferencias) ? rec.diferencias : []) as Fila[]) {
    for (const p of (d.fotos as unknown[]) ?? []) todas.add(String(p));
  }
  return [...todas].filter(Boolean);
}

const PLATA = /(precio|monto|total|neto|iva|costo|valor|descuento)/i;

/** Ninguna CLAVE del envío puede llamarse como un monto (la bandeja también lo rechaza). */
export function clavesDePlata(v: unknown, camino = ""): string[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => clavesDePlata(x, `${camino}[${i}]`));
  if (v && typeof v === "object") {
    return Object.entries(v as Fila).flatMap(([k, x]) => [
      ...(PLATA.test(k) ? [`${camino}.${k}`] : []),
      ...clavesDePlata(x, `${camino}.${k}`),
    ]);
  }
  return [];
}

export function armarPayload(entrada: {
  rec: Fila;
  lineas: Fila[];
  orden: { numero: string; finanzas_id: string | null } | null;
  lineasOrden: Fila[];
  rutas: RutasCopiadas;
}): Fila {
  const { rec, lineas, orden, lineasOrden, rutas } = entrada;
  const porId = new Map(lineasOrden.map((l) => [String(l.id), l]));
  const diferencias = (Array.isArray(rec.diferencias) ? rec.diferencias : []) as Fila[];

  return {
    id: rec.id,
    origen: "bodega-rolzzo",
    version: 1,
    numero: rec.numero,
    orden: orden ? { finanzas_id: orden.finanzas_id, numero: orden.numero } : null,
    proveedor: { rut: txt(rec.proveedor_rut), nombre: txt(rec.proveedor_nombre) },
    documento: {
      tipo: rec.doc_tipo,
      numero: rec.doc_numero,
      fecha: txt(rec.doc_fecha),
      path: rutas.documento,
      mime: txt(rec.doc_mime),
    },
    resultado: rec.resultado,
    errores: diferencias.filter((d) => d.gravedad === "error").length,
    avisos: diferencias.filter((d) => d.gravedad === "aviso").length,
    diferencias: diferencias.map((d) => ({
      tipo: d.tipo,
      gravedad: d.gravedad,
      texto: d.texto,
      posicion: num(d.posicion),
      articulo: txt(d.articulo),
      esperado: num(d.esperado),
      facturado: num(d.facturado),
      contado: num(d.contado),
      nota: txt(d.nota),
      fotos: fotosCopiadas(d.fotos, rutas),
    })),
    lineas: lineas.map((l) => {
      const ol = l.orden_linea_id ? porId.get(String(l.orden_linea_id)) : undefined;
      return {
        posicion: num(l.posicion),
        origen: l.origen,
        factura: {
          codigo: txt(l.fact_codigo),
          descripcion: txt(l.fact_descripcion),
          cantidad: num(l.fact_cantidad),
          unidad: txt(l.fact_unidad),
        },
        articulo: l.item_cod ? { dominio: l.dominio, item_cod: l.item_cod, factor: num(l.factor) } : null,
        orden_linea: ol
          ? {
            posicion: num(ol.posicion),
            codigo_interno: txt(ol.codigo_interno),
            codigo_proveedor: txt(ol.codigo_proveedor),
            descripcion: txt(ol.descripcion),
            pedido: num(ol.cantidad_pedida),
          }
          : null,
        contado: { bueno: num(l.cantidad_buena), danado: num(l.cantidad_danada) },
        unidades_ingresadas: num(l.unidades_ingresadas),
        accion: l.accion,
        motivo_exclusion: txt(l.motivo_exclusion),
        nota: txt(l.nota),
        fotos: fotosCopiadas(l.fotos_paths, rutas),
      };
    }),
    recibio: {
      nombre: txt(rec.recibe_nombre),
      fecha: txt(rec.contada_en),
      usuario: txt(rec.contada_por),
      geo: rec.firma_geo ?? null,
      geo_motivo: txt(rec.firma_geo_motivo),
    },
    firma_path: rutas.firma,
    fotos_paths: [...rutas.fotos.values()],
    escaneada_en: txt(rec.creada_en),
    escaneada_por: txt(rec.escaneada_por),
    contada_en: txt(rec.contada_en),
    notas: txt(rec.notas),
    kardex: { lote_id: txt(rec.lote_id), unidades_ingresadas: num(rec.unidades_ingresadas) },
  };
}
