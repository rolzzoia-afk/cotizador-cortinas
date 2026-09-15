// Pegar filas del Excel en la grilla del asistente «Nueva categoría».
//
// Se acepta lo que sale de copiar un rango: celdas separadas por tabulación,
// con o sin la fila de cabecera. Con cabecera se mapea con los MISMOS nombres
// que entiende el importador de Excel (`mapearCabeceras`), así «DCTO» significa
// lo mismo en los dos lados; sin cabecera se toma el orden del Excel maestro.
//
// Módulo PURO, sin React ni Supabase.
import { leerFechaAlta, mapearCabeceras, type CampoCatalogo } from './importarCatalogo';
import {
  codFamilia,
  filaNueva,
  nombreProductoSugerido,
  precioDesdeCosto,
  recalcularFila,
  type BorradorCategoria,
  type ContextoCategoria,
  type FilaProductoNueva,
} from './nuevaCategoria';

type CampoPegado = CampoCatalogo | 'codInt';

/**
 * El orden de las columnas del Excel maestro, que es el mismo de la grilla. Se
 * usa cuando el pegado no trae cabecera. `null` = la columna IVA, que se ignora
 * a propósito: el IVA es uno por empresa, no un dato de cada tela.
 */
export const COLUMNAS_PEGADO: readonly (CampoPegado | null)[] = [
  'cod',
  'producto',
  'codInt',
  'tipo',
  'descripcion',
  'fechaAlta',
  'proveedor',
  'descuento',
  'costo',
  'ganancia',
  null,
  'precio',
  'anchoRollo',
];

export type FilasPegadas = {
  filas: FilaProductoNueva[];
  avisos: string[];
  conCabecera: boolean;
  /** Los campos que se reconocieron, para poder decirlo en pantalla. */
  campos: CampoPegado[];
};

/**
 * Un número escrito como acá: «22.869» son veintidós mil ochocientos sesenta y
 * nueve, y «2,95» son dos coma noventa y cinco. Cuando vienen los dos signos,
 * el último es el decimal.
 */
export function numeroCl(bruto: unknown): number | null {
  let s = String(bruto ?? '').trim().replace(/[\s$%]/g, '');
  if (!s) return null;
  const negativo = s.startsWith('-');
  if (negativo) s = s.slice(1);
  if (!/^[\d.,]+$/.test(s)) return null;
  const coma = s.lastIndexOf(',');
  const punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma >= 0) {
    s = s.replace(',', '.');
  } else if (punto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** Un porcentaje venga como «25», «25 %» o «0,25». */
export function porcentajeCl(bruto: unknown): number | null {
  const n = numeroCl(bruto);
  if (n == null) return null;
  return n > 0 && n <= 1 ? n * 100 : n;
}

/** ¿Vale la pena tratar este texto como filas pegadas? */
const pareceTabla = (lineas: string[]) => lineas.some((l) => l.includes('\t'));

export function parsearFilasPegadas(
  texto: string,
  b: BorradorCategoria,
  ctx: ContextoCategoria,
): FilasPegadas {
  const vacio: FilasPegadas = { filas: [], avisos: [], conCabecera: false, campos: [] };
  const lineas = String(texto ?? '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (!lineas.length || !pareceTabla(lineas)) return vacio;

  const primera = lineas[0].split('\t');
  const porCabecera = mapearCabeceras(primera);
  // Una fila de datos no reconoce dos cabeceras por casualidad; una de verdad
  // casi siempre trae COD_INT.
  const conCabecera = porCabecera.has('codInt') || porCabecera.size >= 2;

  const columnas = new Map<CampoPegado, number>();
  if (conCabecera) {
    for (const [campo, j] of porCabecera) columnas.set(campo, j);
  } else {
    COLUMNAS_PEGADO.forEach((campo, j) => {
      if (campo && j < primera.length) columnas.set(campo, j);
    });
  }
  if (!columnas.size) return vacio;

  const avisos: string[] = [];
  const filas: FilaProductoNueva[] = [];
  const cuerpo = conCabecera ? lineas.slice(1) : lineas;

  cuerpo.forEach((linea, i) => {
    const celdas = linea.split('\t');
    const val = (campo: CampoPegado): string => {
      const j = columnas.get(campo);
      return j != null ? (celdas[j] ?? '').trim() : '';
    };
    const trae = (campo: CampoPegado) => columnas.has(campo) && val(campo) !== '';

    const tipo = trae('tipo') ? val('tipo').toUpperCase() : undefined;
    const partida = filaNueva(b, ctx, tipo);

    const costo = numeroCl(val('costo'));
    const ganancia = porcentajeCl(val('ganancia'));
    const descuento = porcentajeCl(val('descuento'));
    const ancho = numeroCl(val('anchoRollo'));
    const precio = numeroCl(val('precio'));
    const gama = val('categoria').toUpperCase();

    const fila: FilaProductoNueva = {
      ...partida,
      codInt: val('codInt').trim().replace(/\s+/g, ' ').toUpperCase(),
      producto: trae('producto') ? val('producto') : nombreProductoSugerido(b, partida.tipo),
      productoAuto: !trae('producto'),
      descripcion: val('descripcion'),
      fechaAlta: leerFechaAlta(val('fechaAlta')) ?? partida.fechaAlta,
      proveedor: val('proveedor'),
      descuentoPct: descuento ?? partida.descuentoPct,
      costo: costo ?? 0,
      gananciaPct: ganancia ?? partida.gananciaPct,
      gama: gama === 'A' || gama === 'B' ? gama : '',
      anchoRolloM: ancho ?? 0,
      precio: precio ?? 0,
      // Un precio pegado manda: puede no cuadrar con costo ÷ ganancia (el Excel
      // tiene precios redondeados a mano) y no es cosa nuestra corregirlo.
      precioManual: !!precio && precio > 0,
    };
    const lista = fila.precioManual
      ? fila
      : { ...fila, precio: precioDesdeCosto(fila.costo, fila.gananciaPct / 100, ctx.parametros.iva) };

    const codPegado = val('cod').trim().toUpperCase();
    if (codPegado && codPegado !== codFamilia(b, lista)) {
      avisos.push(
        `Fila ${i + 1}: traía la familia «${codPegado}» y se va a usar «${codFamilia(b, lista)}».`,
      );
    }
    filas.push(recalcularFila(lista, b, ctx));
  });

  if (columnas.has('cod')) {
    // El COD se deriva del tipo de cada fila; el pegado solo sirve para avisar.
    avisos.push('La columna COD se ignora: la familia la arma el asistente.');
  }
  return { filas, avisos, conCabecera, campos: [...columnas.keys()] };
}
