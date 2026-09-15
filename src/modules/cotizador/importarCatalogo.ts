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

/** Los campos del catálogo que una planilla puede traer. */
export type CampoCatalogo =
  | 'cod'
  | 'producto'
  | 'tipo'
  | 'descripcion'
  | 'precio'
  | 'costo'
  | 'descuento'
  | 'anchoRollo'
  | 'categoria'
  | 'fechaAlta'
  | 'proveedor'
  | 'ganancia'
  | 'categoriaFabricacion';

export type FilaCatalogo = {
  codInt: string;
  producto: Producto;
  anchoRollo: number | null;
  /**
   * Qué columnas traía DE VERDAD la planilla. Sin esto, subir un Excel de solo
   * descuentos borraba el producto, el tipo y la descripción de cada código que
   * tocaba, porque el objeto `producto` siempre lleva esas claves (en vacío).
   * `undefined` = se aplica todo (una fila armada a mano, como en los tests).
   */
  campos?: readonly CampoCatalogo[];
  /** El descuento venía en 0-100 y se convirtió a fracción (30 → 0,3). */
  descuentoEraPorcentaje?: boolean;
};

/** Normaliza un COD_INT: trim, colapsa espacios, mayúsculas (claves tipo "BK 13"). */
export const normCod = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Clave REAL del catálogo para un COD_INT tecleado/importado, tolerante a
 * mayúsculas y a los espacios del código: las llaves llevan espacio ("DOM 42")
 * pero las planillas de insumos escriben "DOM42". Prioridad: coincidencia exacta
 * → normalizada (trim/espacios/mayúsculas) → sin espacios. `null` si no existe.
 */
export function claveCatalogoCanonica(
  catalogo: CatalogoProductos,
  texto: string | undefined | null,
): string | null {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return null;
  if (catalogo[crudo]) return crudo;
  const buscado = normCod(crudo);
  const sinEspacios = buscado.replace(/\s+/g, '');
  let porSinEspacios: string | null = null;
  for (const k of Object.keys(catalogo)) {
    const n = normCod(k);
    if (n === buscado) return k;
    if (!porSinEspacios && n.replace(/\s+/g, '') === sinEspacios) porSinEspacios = k;
  }
  return porSinEspacios;
}
/** Normaliza una cabecera: minúsculas sin acentos, para mapear columnas. */
export const normHeader = (s: unknown) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Qué campo del catálogo trae cada columna de una fila de cabeceras. Lo usa el
 * importador de Excel y también el pegado del asistente de categoría nueva, para
 * que «DCTO» signifique lo mismo en los dos lados.
 */
export function mapearCabeceras(celdas: readonly unknown[]): Map<CampoCatalogo | 'codInt', number> {
  const col: Record<string, number> = {};
  celdas.forEach((c, j) => {
    const h = normHeader(c);
    if (h && !(h in col)) col[h] = j;
  });
  const out = new Map<CampoCatalogo | 'codInt', number>();
  for (const campo of Object.keys(ALIAS) as Array<CampoCatalogo | 'codInt'>) {
    for (const alias of ALIAS[campo]) {
      if (col[alias] != null) {
        out.set(campo, col[alias]);
        break;
      }
    }
  }
  return out;
}

/**
 * Los nombres con los que cada columna puede venir escrita. Las planillas que
 * arma la gente a mano no dicen «descuento» a secas: dicen «DCTO», «% DCTO» o
 * «DESCUENTO %», y sin estos alias la columna se ignoraba en silencio.
 */
const ALIAS: Record<CampoCatalogo | 'codInt', string[]> = {
  codInt: ['cod_int', 'cod int', 'codint'],
  cod: ['cod', 'codigo', 'familia'],
  producto: ['producto'],
  tipo: ['tipo'],
  descripcion: ['descripcion', 'diseno', 'diseño'],
  precio: ['precio de venta', 'precio', 'precio venta', '$/m', '$ /m', 'valor'],
  // El Excel maestro trae «Costo» entre el descuento y la ganancia. Hasta ahora
  // se leía y se botaba; es lo que le cuesta a la empresa un metro de tela.
  costo: ['costo', 'costo neto', 'costo unitario', 'costo x metro', 'costo por metro'],
  descuento: ['descuento', 'dcto', 'dcto %', '% dcto', 'descuento %', '% descuento', 'dct %', 'dct'],
  anchoRollo: ['ancho de panos', 'ancho de paños', 'ancho rollo', 'rollo', 'ancho'],
  categoria: ['categoria', 'gama'],
  // Las cuatro columnas del Excel maestro que hasta ahora se leían y se
  // botaban. El IVA sigue afuera a propósito: es uno por empresa
  // (`parametros.iva`), no un dato de cada tela.
  fechaAlta: ['fecha alta', 'fecha de alta', 'alta'],
  proveedor: ['proveedor'],
  ganancia: ['ganancia', 'ganancia %', '% ganancia', 'margen'],
  categoriaFabricacion: [
    'categoria fabricacion',
    'categoria de fabricacion',
    'cod sec',
    'fabricacion',
  ],
};

/** Los campos que se copian al producto, en el orden en que se escriben. */
const CAMPOS_CATALOGO: readonly CampoCatalogo[] = [
  'cod', 'producto', 'tipo', 'descripcion', 'precio', 'costo', 'descuento',
  'anchoRollo', 'categoria', 'fechaAlta', 'proveedor', 'ganancia',
  'categoriaFabricacion',
];

/** Localiza la fila de cabecera (la que tiene COD_INT). */
function mapaColumnas(rows: unknown[][]): { headerIdx: number; cabecera: unknown[] } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    const hasCodInt = r.some((c) => {
      const h = normHeader(c);
      return h === 'cod_int' || h === 'cod int';
    });
    if (hasCodInt) return { headerIdx: i, cabecera: r };
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
  const { headerIdx, cabecera } = m;
  const columnas = mapearCabeceras(cabecera);
  const cell = (r: unknown[], campo: CampoCatalogo | 'codInt') => {
    const j = columnas.get(campo);
    return j != null ? r[j] : undefined;
  };
  // Solo se toca lo que la planilla trae: un Excel de puros descuentos no puede
  // dejar sin producto ni descripción a los códigos que actualiza.
  const campos = CAMPOS_CATALOGO.filter((c) => columnas.has(c));

  const out: FilaCatalogo[] = [];
  const vistos = new Set<string>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const codInt = normCod(cell(r, 'codInt'));
    // El COD (la familia) ya no es obligatorio: sin él la fila solo puede
    // ACTUALIZAR un código que ya existe, nunca crear uno (una tela sin familia
    // no se sabe cotizar). `diffCatalogo` se encarga de eso.
    const cod = String(cell(r, 'cod') ?? '').trim();
    if (!codInt) continue;
    if (vistos.has(codInt)) continue; // primera aparición gana
    vistos.add(codInt);
    const precio = Number(cell(r, 'precio')) || 0;
    const costo = Number(cell(r, 'costo')) || 0;
    const { descuento, eraPorcentaje } = leerDescuento(cell(r, 'descuento'));
    const anchoRollo = Number(cell(r, 'anchoRollo')) || null;
    const catRaw = normCod(cell(r, 'categoria'));
    const categoria = catRaw === 'A' || catRaw === 'B' ? catRaw : undefined;
    const fechaAlta = leerFechaAlta(cell(r, 'fechaAlta'));
    const proveedor = String(cell(r, 'proveedor') ?? '').trim();
    const ganancia = leerGanancia(cell(r, 'ganancia'));
    const categoriaFabricacion = String(cell(r, 'categoriaFabricacion') ?? '').trim();
    const producto: Producto = {
      cod,
      producto: String(cell(r, 'producto') ?? '').trim(),
      tipo: String(cell(r, 'tipo') ?? '').trim(),
      descripcion: String(cell(r, 'descripcion') ?? '').trim(),
      precio,
      descuento,
      ...(costo ? { costo } : {}),
      ...(anchoRollo ? { anchoRollo } : {}),
      ...(categoria ? { categoria } : {}),
      ...(fechaAlta ? { fechaAlta } : {}),
      ...(proveedor ? { proveedor } : {}),
      ...(ganancia ? { ganancia } : {}),
      ...(categoriaFabricacion ? { categoriaFabricacion } : {}),
    };
    out.push({
      codInt,
      producto,
      anchoRollo,
      campos,
      ...(eraPorcentaje ? { descuentoEraPorcentaje: true } : {}),
    });
  }
  return out;
}

/**
 * El descuento de una celda, venga como fracción (0,3) o como porcentaje (30).
 * Antes todo se acotaba a [0,1] a secas, así que una planilla con «30» —lo más
 * natural de escribir— dejaba la tela con 100 % de descuento y a $0.
 * El 1 se lee como 100 %: es lo que ya significa en el catálogo (la fila de
 * instalación regalada viene con `descuento: 1`).
 */
/**
 * La fecha de alta de una celda, como 'AAAA-MM-DD'. El Excel la manda de tres
 * formas distintas según cómo esté formateada la columna: un número de serie
 * (45028), el texto chileno «12-04-2023» o un ISO. Lo que no se entiende se
 * descarta: una fecha inventada es peor que ninguna.
 */
export function leerFechaAlta(bruto: unknown): string | undefined {
  if (bruto == null || bruto === '') return undefined;
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) {
    return iso(bruto.getFullYear(), bruto.getMonth() + 1, bruto.getDate());
  }
  if (typeof bruto === 'number' && Number.isFinite(bruto) && bruto > 0) {
    const f = XLSX.SSF.parse_date_code(bruto);
    return f ? iso(f.y, f.m, f.d) : undefined;
  }
  const s = String(bruto).trim();
  const isoDirecto = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoDirecto) return isoDirecto[0].slice(0, 10);
  // dd-mm-aaaa o dd/mm/aaaa (lo que escribe la gente acá).
  const chileno = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(s);
  if (chileno) {
    const d = Number(chileno[1]);
    const m = Number(chileno[2]);
    const y = Number(chileno[3]) < 100 ? 2000 + Number(chileno[3]) : Number(chileno[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return iso(y, m, d);
  }
  return undefined;
}

/**
 * La ganancia (el DIVISOR del precio) de una celda: «65», «65 %» y «0,65» son
 * lo mismo. Fuera de (0, 1] no se acepta: ahí el precio saldría disparado o
 * negativo, y es mejor dejar el que trae la planilla.
 */
export function leerGanancia(bruto: unknown): number | undefined {
  if (bruto == null || bruto === '') return undefined;
  const n = Number(String(bruto).replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const frac = n > 1 ? n / 100 : n;
  return frac > 0 && frac <= 1 ? frac : undefined;
}

export function leerDescuento(bruto: unknown): { descuento: number; eraPorcentaje: boolean } {
  const n = Number(bruto);
  if (!Number.isFinite(n) || n <= 0) return { descuento: 0, eraPorcentaje: false };
  if (n <= 1) return { descuento: n, eraPorcentaje: false };
  return { descuento: Math.min(1, n / 100), eraPorcentaje: true };
}

const EPS_PRECIO = 0.5; // pesos: ignora diferencias de redondeo
const EPS_DCTO = 0.001;

export type CambioExistente = {
  codInt: string; // clave real del catálogo (respeta may/min existente)
  producto: Producto;
  anchoRollo: number | null;
  /** Las columnas que traía la planilla: viajan hasta `aplicarCatalogo`. */
  campos?: readonly CampoCatalogo[];
  precioViejo: number;
  precioNuevo: number;
  costoViejo: number;
  costoNuevo: number;
  descuentoViejo: number;
  descuentoNuevo: number;
  categoriaVieja: string | null;
  categoriaNueva: string | null;
  cambiaPrecio: boolean;
  cambiaCosto: boolean;
  cambiaDescuento: boolean;
  cambiaCategoria: boolean;
  /** Cambia algo de la ficha: fecha de alta, proveedor, ganancia o categoría
   *  de fabricación. Van juntas porque ninguna mueve un peso. */
  cambiaFicha: boolean;
};

export type DiffCatalogo = {
  nuevos: FilaCatalogo[];
  cambios: CambioExistente[];
  sinCambio: number;
  /** Filas que no se pueden aplicar, con el motivo, para decirlo en pantalla. */
  ignorados: Array<{ codInt: string; motivo: string }>;
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
  const ignorados: Array<{ codInt: string; motivo: string }> = [];
  let sinCambio = 0;
  const trae = (f: FilaCatalogo, campo: CampoCatalogo) => !f.campos || f.campos.includes(campo);
  for (const f of filas) {
    const realKey = idx.get(normCod(f.codInt));
    if (!realKey) {
      // Sin COD no hay familia, y sin familia no se sabe con qué receta ni con
      // qué tela cotizarlo: se puede actualizar un código, no inventarlo.
      if (!f.producto.cod) {
        ignorados.push({
          codInt: f.codInt,
          motivo: 'no está en el catálogo y la planilla no trae la columna COD (la familia)',
        });
        continue;
      }
      nuevos.push(f);
      continue;
    }
    const prev = actual[realKey];
    const precioViejo = Number(prev.precio) || 0;
    const precioNuevo = f.producto.precio;
    const costoViejo = Number(prev.costo) || 0;
    const costoNuevo = Number(f.producto.costo) || 0;
    const descuentoViejo = Number(prev.descuento) || 0;
    const descuentoNuevo = Number(f.producto.descuento) || 0;
    const categoriaVieja = prev.categoria || null;
    const categoriaNueva = f.producto.categoria || null;
    // Una columna que la planilla NO trae no cambia nada: un Excel de solo
    // descuentos no puede reportar «precio 27.176 → 0».
    const cambiaPrecio =
      trae(f, 'precio') && precioNuevo > 0 && Math.abs(precioViejo - precioNuevo) > EPS_PRECIO;
    // Mismo trato que el precio: el Excel maestro trae la columna «Costo» en 0
    // para casi todo, y un 0 no puede borrar un costo ya cargado a mano.
    const cambiaCosto =
      trae(f, 'costo') && costoNuevo > 0 && Math.abs(costoViejo - costoNuevo) > EPS_PRECIO;
    const cambiaDescuento =
      trae(f, 'descuento') && Math.abs(descuentoViejo - descuentoNuevo) > EPS_DCTO;
    // Una categoría ausente en el Excel no borra la existente (merge conservador).
    const cambiaCategoria =
      trae(f, 'categoria') && categoriaNueva != null && categoriaNueva !== categoriaVieja;
    // La ficha (fecha de alta, proveedor, ganancia, categoría de fabricación):
    // un valor ausente en la planilla tampoco borra el que ya está.
    const cambiaFicha = (['fechaAlta', 'proveedor', 'ganancia', 'categoriaFabricacion'] as const).some(
      (c) => {
        if (!trae(f, c)) return false;
        const nuevo = f.producto[c];
        return nuevo != null && nuevo !== '' && nuevo !== prev[c];
      },
    );
    if (cambiaPrecio || cambiaCosto || cambiaDescuento || cambiaCategoria || cambiaFicha) {
      cambios.push({
        codInt: realKey,
        producto: f.producto,
        anchoRollo: f.anchoRollo,
        campos: f.campos,
        precioViejo,
        precioNuevo,
        costoViejo,
        costoNuevo,
        descuentoViejo,
        descuentoNuevo,
        categoriaVieja,
        categoriaNueva,
        cambiaPrecio,
        cambiaCosto,
        cambiaDescuento,
        cambiaCategoria,
        cambiaFicha,
      });
    } else {
      sinCambio++;
    }
  }
  return { nuevos, cambios, sinCambio, ignorados };
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
    // Solo se escriben las columnas que la planilla traía. Con el spread
    // completo, un Excel de puros descuentos dejaba en blanco el producto, el
    // tipo y la descripción de cada código que tocaba: `f.producto` SIEMPRE
    // lleva esas claves, aunque el Excel no tuviera esas columnas.
    const soloEstos = f.campos;
    const entrante: Partial<Producto> = soloEstos
      ? Object.fromEntries(
          soloEstos
            .filter((c) => c in f.producto)
            .map((c) => [c, (f.producto as Record<string, unknown>)[c]]),
        )
      : f.producto;
    const merged: Producto = { ...(prev ?? {}), ...entrante } as Producto;
    if (!(f.producto.precio > 0) && prev && Number(prev.precio) > 0) {
      merged.precio = prev.precio; // no pisar un precio válido con 0
    }
    if (!(Number(f.producto.costo) > 0) && prev && Number(prev.costo) > 0) {
      merged.costo = prev.costo; // ídem con el costo por metro
    }
    catalogo[key] = merged;
    if (f.anchoRollo && f.anchoRollo > 0) anchoRollo[key] = f.anchoRollo;
  }
  return { catalogo, anchoRollo };
}

/**
 * El catálogo actual como filas para bajarlo a Excel: la vendedora edita la
 * columna de descuentos sobre esto y lo vuelve a subir. Las cabeceras son las
 * que el importador reconoce.
 */
/**
 * Una MUESTRA chica del catálogo para el archivo de ejemplo: un código por
 * familia, con precio, hasta `max` filas. Se toma del catálogo de verdad a
 * propósito — así el ejemplo se puede subir tal cual y la app responde «0
 * cambios», que es la forma de probar la importación sin tocar nada.
 */
export function filasEjemplo(
  catalogo: CatalogoProductos,
  anchoRollo: Record<string, number> = {},
  max = 6,
): Array<Record<string, string | number>> {
  const todas = filasParaPlantilla(catalogo, anchoRollo);
  const porFamilia = new Map<string, Record<string, string | number>>();
  for (const f of todas) {
    const familia = String(f.COD || '');
    // Una fila sin familia o sin precio no enseña nada: no se puede crear ni
    // se le nota el cambio de descuento.
    if (!familia || !(Number(f['PRECIO DE VENTA']) > 0)) continue;
    if (!porFamilia.has(familia)) porFamilia.set(familia, f);
    if (porFamilia.size >= max) break;
  }
  return porFamilia.size > 0 ? [...porFamilia.values()] : todas.slice(0, max);
}

/**
 * La hoja «Instrucciones» del archivo de ejemplo, en filas de celdas.
 *
 * Los nombres de columna van con viñeta a propósito: si alguien borra la hoja
 * «Productos», el importador busca la primera hoja con una cabecera COD_INT, y
 * un «COD_INT» pelado acá la convertiría en esa hoja.
 */
export const INSTRUCCIONES_IMPORTACION: string[][] = [
  ['CÓMO IMPORTAR EL CATÁLOGO DE PRODUCTOS'],
  [],
  ['Esta planilla es un EJEMPLO. Los códigos de la hoja «Productos» son reales y traen'],
  ['los valores que el sistema tiene hoy.'],
  ['Súbela tal como está y la app dirá «0 cambios»: sirve para probar sin miedo.'],
  ['Cambia un descuento, vuelve a subirla, y vas a ver ese único cambio en el resumen.'],
  [],
  ['REGLAS'],
  ['1', 'La hoja se tiene que llamar «Productos» (también se acepta «DEPURADA»).'],
  ['2', 'La única columna obligatoria es el código interno. Es la que dice a qué producto le cambias algo.'],
  ['3', 'Solo se modifica lo que la planilla traiga: si borras la columna del precio, los precios quedan como están.'],
  ['4', 'El descuento se puede escribir 30 o 0,3. Las dos formas significan 30 %.'],
  ['5', 'Para CREAR un código nuevo también tiene que venir la familia (BLACKOUT_P, SCREEN_P…). Sin ella el código se ignora y la app avisa cuál quedó fuera.'],
  ['6', 'Las filas de más o los códigos que no existan no rompen nada: quedan listados aparte.'],
  ['7', 'Antes de guardar ves el resumen de lo nuevo y lo que cambia, y puedes desmarcar lo que no quieras aplicar.'],
  ['8', 'Cada importación deja un respaldo, así que siempre se puede volver atrás.'],
  [],
  ['LAS COLUMNAS QUE LA APP RECONOCE'],
  ['Columna', 'Qué es', 'También se acepta escrita así'],
  ['• COD_INT', 'El código del producto. OBLIGATORIA.', 'COD INT · CODINT'],
  ['• COD', 'La familia. Obligatoria solo para códigos nuevos.', 'CODIGO · FAMILIA'],
  ['• PRODUCTO', 'El nombre comercial de la tela.', ''],
  ['• TIPO', 'PREMIUM, DELUX, STANDARD, BASIC…', ''],
  ['• DESCRIPCION', 'El diseño o el color.', 'DISEÑO'],
  ['• PRECIO DE VENTA', 'Precio por metro, en pesos.', 'PRECIO · $/M · VALOR'],
  [
    '• COSTO',
    'Lo que nos cuesta un metro, con IVA. No cotiza: sale en el Costo total de producción.',
    'COSTO NETO · COSTO POR METRO',
  ],
  ['• DESCUENTO %', 'El descuento: 30 o 0,3.', 'DCTO · % DCTO · DESCUENTO'],
  ['• ANCHO DE PAÑOS', 'Ancho del rollo en metros.', 'ANCHO ROLLO · ROLLO · ANCHO'],
  ['• CATEGORIA', 'A o B.', 'GAMA'],
  ['• FECHA ALTA', 'Cuándo entró el código. 12-04-2023 o 2023-04-12.', 'FECHA DE ALTA · ALTA'],
  ['• PROVEEDOR', 'Quién vende la tela.', ''],
  ['• GANANCIA %', 'El margen con que se sacó el precio: 65 o 0,65.', 'MARGEN'],
  [
    '• CATEGORIA FABRICACION',
    'Con qué categoría nace la cortina (ROL, VERTICAL…).',
    'COD SEC · FABRICACION',
  ],
  [],
  ['El IVA no es columna: es uno solo para la empresa y se configura en Admin → Precios.'],
];

export function filasParaPlantilla(
  catalogo: CatalogoProductos,
  anchoRollo: Record<string, number> = {},
): Array<Record<string, string | number>> {
  return Object.entries(catalogo)
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([codInt, p]) => ({
      COD: p.cod ?? '',
      COD_INT: codInt,
      PRODUCTO: p.producto ?? '',
      TIPO: p.tipo ?? '',
      DESCRIPCION: p.descripcion ?? '',
      'PRECIO DE VENTA': Number(p.precio) || 0,
      COSTO: Number(p.costo) || 0,
      // En porcentaje, que es como la gente lo escribe; el importador lo
      // reconoce igual (ver `leerDescuento`).
      'DESCUENTO %': Math.round((Number(p.descuento) || 0) * 1000) / 10,
      'ANCHO DE PAÑOS': Number(anchoRollo[codInt] ?? p.anchoRollo) || '',
      CATEGORIA: p.categoria ?? '',
      // La ficha. La fecha va como texto ISO: `leerFechaAlta` la reconoce, así
      // que bajar la plantilla y volver a subirla sigue dando «0 cambios».
      'FECHA ALTA': p.fechaAlta ?? '',
      PROVEEDOR: p.proveedor ?? '',
      'GANANCIA %': p.ganancia ? Math.round(p.ganancia * 1000) / 10 : '',
      'CATEGORIA FABRICACION': p.categoriaFabricacion ?? '',
    }));
}
