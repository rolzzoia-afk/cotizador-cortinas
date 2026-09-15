// El esquema de lo que la lectura devuelve, las instrucciones al modelo y la
// validación de la respuesta.
//
// SIN PRECIOS POR CONSTRUCCIÓN: el esquema no tiene ningún campo de plata, así
// que el modelo no tiene dónde ponerlos. La factura sí los trae, pero se queda
// como archivo en el bucket privado; lo leído lo ve el taller entero.
//
// El espejo del lado del navegador es `ExtraccionFactura` en
// `src/modules/inventario/recepcionFactura.ts`.

export const TIPOS_DOCUMENTO = ["factura", "guia", "boleta", "nota_credito", "otro"] as const;

const textoONulo = (description: string) => ({
  anyOf: [{ type: "string" }, { type: "null" }],
  description,
});
const numeroONulo = (description: string) => ({
  anyOf: [{ type: "number" }, { type: "null" }],
  description,
});

// Structured outputs: `additionalProperties: false` en todo objeto, todo en
// `required` (lo opcional va con `null`), y sin `minimum`/`maxLength`, que la
// API no admite.
export const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_documento", "motivo_no_documento", "proveedor", "documento", "lineas", "advertencias"],
  properties: {
    es_documento: {
      type: "boolean",
      description: "true si es una factura, guía de despacho, boleta o nota de crédito de un proveedor",
    },
    motivo_no_documento: textoONulo("Si no es un documento de compra, qué es. null si lo es."),
    proveedor: {
      type: "object",
      additionalProperties: false,
      required: ["nombre", "rut"],
      properties: {
        nombre: textoONulo("Razón social del EMISOR (el proveedor), no del cliente"),
        rut: textoONulo("RUT del emisor tal como viene impreso, con puntos y guion"),
      },
    },
    documento: {
      type: "object",
      additionalProperties: false,
      required: ["tipo", "numero", "fecha", "orden_compra_ref"],
      properties: {
        tipo: { type: "string", enum: TIPOS_DOCUMENTO },
        numero: textoONulo("Folio o número del documento, tal como viene impreso"),
        fecha: {
          anyOf: [{ type: "string", format: "date" }, { type: "null" }],
          description: "Fecha de emisión en formato YYYY-MM-DD",
        },
        orden_compra_ref: textoONulo("Número de orden de compra si el documento la menciona (OC, O.C., Ref.)"),
      },
    },
    lineas: {
      type: "array",
      description: "Una entrada por cada línea de producto, en el orden del papel",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["posicion", "codigo", "descripcion", "cantidad", "unidad", "unidades_por_paquete", "es_cargo"],
        properties: {
          posicion: { type: "integer", description: "1, 2, 3… en el orden del papel" },
          codigo: textoONulo("Código del artículo tal como viene impreso; null si no trae"),
          descripcion: { type: "string", description: "Descripción del artículo, sin precios" },
          cantidad: numeroONulo("Unidades facturadas (no el contenido del paquete); null si es ilegible"),
          unidad: textoONulo("Unidad impresa (UN, MT, ROLLO, CAJA…); null si no trae"),
          unidades_por_paquete: numeroONulo("Contenido del paquete SOLO si viene impreso ([x 50], x60, [150 MTS.])"),
          es_cargo: { type: "boolean", description: "true para FLETE, DESPACHO, EMBALAJE, SERVICIO y similares" },
        },
      },
    },
    advertencias: {
      type: "array",
      items: { type: "string" },
      description: "Lo que no se pudo leer bien, en español, una frase por problema",
    },
  },
} as const;

export const SISTEMA = `Lees documentos de compra de proveedores chilenos para la bodega de un taller de cortinas (Cortinas Rolzzo). La bodega usa lo que extraes para CONTAR a mano lo que llegó, así que cada línea tiene que corresponder a una línea del papel.

Reglas que no se rompen:
- NUNCA extraigas precios, descuentos, netos, IVA ni totales. No hay campo para eso, y tampoco los escribas dentro de la descripción ni de las advertencias.
- Una entrada por cada línea de producto, en el mismo orden que el papel. No inventes líneas ni juntes dos en una. Si una cantidad o un código no se lee, pon null y agrega una advertencia que diga en qué línea.
- "cantidad" son las unidades FACTURADAS (lo que se cobra), no el contenido del paquete. Si la línea dice "5 CAJA [x 50]", la cantidad es 5 y unidades_por_paquete es 50. unidades_por_paquete va SOLO si está impreso ([x 50], x60, [150 MTS.]); si no, null.
- En las boletas y facturas de impresora térmica (punto de venta), el código del artículo suele ir en una fila y la descripción en la fila siguiente (a veces con códigos numéricos de 12 dígitos): son UNA sola línea, júntalas.
- Marca es_cargo=true en FLETE, DESPACHO, ENVÍO, EMBALAJE, SERVICIO, RECARGO y similares: se cobran pero no son mercadería.
- El proveedor es el EMISOR del documento, no el cliente (el cliente es Rolzzo). El RUT va tal como está impreso.
- Si la capa de texto de un PDF trae acentos o letras rotas, confía en lo que se VE.
- Tipo: "factura" (factura electrónica), "guia" (guía de despacho), "boleta", "nota_credito" u "otro".
- Si menciona una orden de compra (OC, O.C., Orden de compra, Ref.), copia su número en orden_compra_ref.
- Si la imagen no es un documento de compra (una foto de otra cosa, un papel en blanco), es_documento=false, explica qué es en motivo_no_documento y deja las líneas vacías.

Las advertencias van en español neutro, cortas, una por problema.`;

// ── Validar lo que volvió ─────────────────────────────────────────────

export type LineaExtraida = {
  posicion: number;
  codigo: string | null;
  descripcion: string;
  cantidad: number | null;
  unidad: string | null;
  unidades_por_paquete: number | null;
  es_cargo: boolean;
};

export type ExtraccionFactura = {
  es_documento: boolean;
  motivo_no_documento: string | null;
  proveedor: { nombre: string | null; rut: string | null };
  documento: {
    tipo: (typeof TIPOS_DOCUMENTO)[number];
    numero: string | null;
    fecha: string | null;
    orden_compra_ref: string | null;
  };
  lineas: LineaExtraida[];
  advertencias: string[];
};

const MAX_LINEAS = 300;

function texto(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

function numero(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
}

// Por si un monto se cuela en la descripción pese a las instrucciones:
// «$ 12.990» o «$12990» no le sirven a la bodega y no se muestran al taller.
const MONTO = /\$\s?[\d.,]+/g;

/**
 * Deja la respuesta con la forma exacta del esquema, sin campos de más, con
 * los números como números y sin montos. Lo que no sirve se descarta en vez
 * de romper la lectura entera.
 */
export function validarExtraccion(raw: unknown): ExtraccionFactura {
  const r = (raw ?? {}) as Record<string, unknown>;
  const prov = (r.proveedor ?? {}) as Record<string, unknown>;
  const doc = (r.documento ?? {}) as Record<string, unknown>;
  const tipo = TIPOS_DOCUMENTO.includes(doc.tipo as (typeof TIPOS_DOCUMENTO)[number])
    ? (doc.tipo as (typeof TIPOS_DOCUMENTO)[number])
    : "otro";
  const fecha = texto(doc.fecha, 10);

  const lineas: LineaExtraida[] = [];
  for (const x of Array.isArray(r.lineas) ? r.lineas : []) {
    if (lineas.length >= MAX_LINEAS) break;
    const l = (x ?? {}) as Record<string, unknown>;
    const descripcion = (texto(l.descripcion, 300) ?? "").replace(MONTO, "").replace(/\s+/g, " ").trim();
    const codigo = texto(l.codigo, 80);
    if (!descripcion && !codigo) continue;
    lineas.push({
      posicion: lineas.length + 1,
      codigo,
      descripcion,
      cantidad: numero(l.cantidad),
      unidad: texto(l.unidad, 20),
      unidades_por_paquete: numero(l.unidades_por_paquete),
      es_cargo: l.es_cargo === true,
    });
  }

  return {
    es_documento: r.es_documento !== false,
    motivo_no_documento: texto(r.motivo_no_documento),
    proveedor: { nombre: texto(prov.nombre, 200), rut: texto(prov.rut, 20) },
    documento: {
      tipo,
      numero: texto(doc.numero, 40),
      fecha: fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
      orden_compra_ref: texto(doc.orden_compra_ref, 40),
    },
    lineas,
    advertencias: (Array.isArray(r.advertencias) ? r.advertencias : [])
      .map((a) => (texto(a, 300) ?? "").replace(MONTO, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 20),
  };
}
