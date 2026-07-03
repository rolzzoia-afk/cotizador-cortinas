// ─────────────────────────────────────────────────────────────────────
// Importador masivo del catálogo del cotizador desde el Excel maestro
// (hoja "Productos"). Trae códigos + precio de venta + descuento + ancho de
// rollo por COD_INT, para dar de alta códigos faltantes (ej. SC 93) y alinear
// precios/descuentos con la planilla.
//
// Módulo PURO (parseo + diff), sin React/Supabase: la escritura vive en el
// diálogo (ImportarCatalogoDialog) usando guardarCatalogoProductos.
//
// Columnas esperadas en la hoja "Productos" (se mapean por nombre de cabecera,
// robusto a corrimientos): COD, Producto, COD_INT, Tipo, Descripción,
// Descuento (0–1), Precio de Venta (CLP/m), Ancho de Paños (m),
// CATEGORIA ('A' | 'B', opcional — planilla TELAS DEPURADAS).
// Si el libro no tiene hoja "Productos" se busca "DEPURADA" y, en último
// término, la primera hoja que tenga una cabecera COD_INT.
// ─────────────────────────────────────────────────────────────────────
import * as XLSX from 'xlsx';
import type { WorkBook } from 'xlsx';
import type { CatalogoProductos, Producto } from './types';

export type FilaCatalogo = { codInt: string; producto: Producto; anchoRollo: number | null };

/** Normaliza un COD_INT: trim, colapsa espacios, mayúsculas (claves tipo "BK 13"). */
const normCod = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
/** Normaliza una cabecera: minúsculas sin acentos, para mapear columnas. */
const normHeader = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Localiza la fila de cabecera (la que tiene COD_INT) y mapea columnas por nombre. */
function mapaColumnas(rows: unknown[][]): { headerIdx: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    const hasCodInt = r.some((c) => {
      const h = normHeader(c);
      return h === 'cod_int' || h === 'cod int';
    });
    if (hasCodInt) {
      const col: Record<string, number> = {};
      r.forEach((c, j) => {
        const h = normHeader(c);
        if (h && !(h in col)) col[h] = j;
      });
      return { headerIdx: i, col };
    }
  }
  return null;
}

/** Parsea la hoja "Productos" (o "DEPURADA", o la primera con COD_INT) a filas de catálogo. */
export function parsearCatalogoExcel(wb: WorkBook, hoja = 'Productos'): FilaCatalogo[] {
  const porNombre = [hoja, 'DEPURADA']
    .map(
      (h) =>
        wb.SheetNames.find((n) => n === h) ??
        wb.SheetNames.find((n) => normHeader(n) === normHeader(h)),
    )
    .filter((n): n is string => !!n);
  const candidatas = [...porNombre, ...wb.SheetNames.filter((n) => !porNombre.includes(n))];
  let rows: unknown[][] = [];
  let m: ReturnType<typeof mapaColumnas> = null;
  for (const nombre of candidatas) {
    const r = XLSX.utils.sheet_to_json(wb.Sheets[nombre], {
      header: 1,
      raw: true,
      defval: '',
    }) as unknown[][];
    const mapa = mapaColumnas(r);
    if (mapa) {
      rows = r;
      m = mapa;
      break;
    }
  }
  if (!m) return [];
  const { headerIdx, col } = m;
  const cell = (r: unknown[], name: string) => (col[name] != null ? r[col[name]] : undefined);
  const out: FilaCatalogo[] = [];
  const vistos = new Set<string>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const codInt = normCod(cell(r, 'cod_int') ?? cell(r, 'cod int'));
    const cod = String(cell(r, 'cod') ?? '').trim();
    if (!codInt || !cod) continue;
    if (vistos.has(codInt)) continue; // primera aparición gana
    vistos.add(codInt);
    const precio = Number(cell(r, 'precio de venta')) || 0;
    const descRaw = Number(cell(r, 'descuento'));
    const descuento = Number.isFinite(descRaw) ? Math.max(0, Math.min(1, descRaw)) : 0;
    const anchoRollo = Number(cell(r, 'ancho de panos')) || null;
    const catRaw = normCod(cell(r, 'categoria'));
    const categoria = catRaw === 'A' || catRaw === 'B' ? catRaw : undefined;
    const producto: Producto = {
      cod,
      producto: String(cell(r, 'producto') ?? '').trim(),
      tipo: String(cell(r, 'tipo') ?? '').trim(),
      descripcion: String(cell(r, 'descripcion') ?? '').trim(),
      precio,
      descuento,
      ...(anchoRollo ? { anchoRollo } : {}),
      ...(categoria ? { categoria } : {}),
    };
    out.push({ codInt, producto, anchoRollo });
  }
  return out;
}

const EPS_PRECIO = 0.5; // pesos: ignora diferencias de redondeo
const EPS_DCTO = 0.001;

export type CambioExistente = {
  codInt: string; // clave real del catálogo (respeta may/min existente)
  producto: Producto;
  anchoRollo: number | null;
  precioViejo: number;
  precioNuevo: number;
  descuentoViejo: number;
  descuentoNuevo: number;
  categoriaVieja: string | null;
  categoriaNueva: string | null;
  cambiaPrecio: boolean;
  cambiaDescuento: boolean;
  cambiaCategoria: boolean;
};

export type DiffCatalogo = {
  nuevos: FilaCatalogo[];
  cambios: CambioExistente[];
  sinCambio: number;
};

/**
 * Compara el catálogo actual con las filas importadas (por COD_INT
 * case-insensitive) y separa códigos nuevos de cambios en precio/descuento.
 * Un precio importado en 0 NO cuenta como cambio (esos códigos heredan el
 * precio del arquetipo de familia al cotizar).
 */
export function diffCatalogo(actual: CatalogoProductos, filas: FilaCatalogo[]): DiffCatalogo {
  const idx = new Map<string, string>(); // NORMKEY → clave real
  for (const k of Object.keys(actual)) idx.set(normCod(k), k);
  const nuevos: FilaCatalogo[] = [];
  const cambios: CambioExistente[] = [];
  let sinCambio = 0;
  for (const f of filas) {
    const realKey = idx.get(normCod(f.codInt));
    if (!realKey) {
      nuevos.push(f);
      continue;
    }
    const prev = actual[realKey];
    const precioViejo = Number(prev.precio) || 0;
    const precioNuevo = f.producto.precio;
    const descuentoViejo = Number(prev.descuento) || 0;
    const descuentoNuevo = Number(f.producto.descuento) || 0;
    const categoriaVieja = prev.categoria || null;
    const categoriaNueva = f.producto.categoria || null;
    const cambiaPrecio = precioNuevo > 0 && Math.abs(precioViejo - precioNuevo) > EPS_PRECIO;
    const cambiaDescuento = Math.abs(descuentoViejo - descuentoNuevo) > EPS_DCTO;
    // Una categoría ausente en el Excel no borra la existente (merge conservador).
    const cambiaCategoria = categoriaNueva != null && categoriaNueva !== categoriaVieja;
    if (cambiaPrecio || cambiaDescuento || cambiaCategoria) {
      cambios.push({
        codInt: realKey,
        producto: f.producto,
        anchoRollo: f.anchoRollo,
        precioViejo,
        precioNuevo,
        descuentoViejo,
        descuentoNuevo,
        categoriaVieja,
        categoriaNueva,
        cambiaPrecio,
        cambiaDescuento,
        cambiaCategoria,
      });
    } else {
      sinCambio++;
    }
  }
  return { nuevos, cambios, sinCambio };
}

/**
 * Aplica las filas ACEPTADAS sobre el catálogo actual y devuelve el catálogo y
 * el mapa de ancho de rollo resultantes (no muta los originales). Para códigos
 * existentes hace merge (preserva colorGrupo u otros campos); nunca pisa un
 * precio válido con 0.
 */
export function aplicarCatalogo(
  actual: CatalogoProductos,
  anchoActual: Record<string, number>,
  aceptados: FilaCatalogo[],
): { catalogo: CatalogoProductos; anchoRollo: Record<string, number> } {
  const catalogo: CatalogoProductos = { ...actual };
  const anchoRollo: Record<string, number> = { ...anchoActual };
  const idx = new Map<string, string>();
  for (const k of Object.keys(actual)) idx.set(normCod(k), k);
  for (const f of aceptados) {
    const key = idx.get(normCod(f.codInt)) ?? f.codInt;
    const prev = catalogo[key];
    const merged: Producto = { ...(prev ?? {}), ...f.producto };
    if (!(f.producto.precio > 0) && prev && Number(prev.precio) > 0) {
      merged.precio = prev.precio; // no pisar un precio válido con 0
    }
    catalogo[key] = merged;
    if (f.anchoRollo && f.anchoRollo > 0) anchoRollo[key] = f.anchoRollo;
  }
  return { catalogo, anchoRollo };
}
