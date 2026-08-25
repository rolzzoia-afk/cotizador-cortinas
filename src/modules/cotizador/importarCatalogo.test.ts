import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parsearCatalogoExcel,
  diffCatalogo,
  aplicarCatalogo,
  claveCatalogoCanonica,
  filasParaPlantilla,
  leerDescuento,
  normCod,
} from './importarCatalogo';
import type { CatalogoProductos } from './types';

// Arma un workbook con una hoja "Productos" como el Excel maestro:
// cabecera en una fila con relleno arriba, columnas por nombre.
function wbProductos(filas: (string | number)[][], hoja = 'Productos'): XLSX.WorkBook {
  const header = [
    'COD', 'Producto', 'COD_INT', 'Tipo', 'Descripción', 'Fecha Alta',
    'Proveedor', 'Descuento', 'Costo', 'Ganancia', 'IVA', 'Precio de Venta', 'Ancho de Paños', 'CATEGORIA',
  ];
  const aoa: (string | number)[][] = [[], [], header, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  return wb;
}
// COD, Producto, COD_INT, Tipo, Descripción, FechaAlta, Proveedor, Descuento, Costo, Gan, IVA, Precio, Ancho, Categoría
const fila = (cod: string, codint: string, tipo: string, desc: number, precio: number, ancho: number, cat = '') =>
  [cod, `PROD ${cod}`, codint, tipo, `DESC ${codint}`, 45028, 'Prov', desc, 0, 0.65, 0.19, precio, ancho, cat];

describe('parsearCatalogoExcel', () => {
  it('mapea columnas por nombre y normaliza el COD_INT', () => {
    const wb = wbProductos([
      fila('SCREEN_P', 'sc 93', 'PREMIUM', 0.2, 0, 2.98),
      fila('BLACKOUT_D', 'BK 68', 'DELUX', 0.25, 23782, 2.98),
    ]);
    const filas = parsearCatalogoExcel(wb);
    expect(filas).toHaveLength(2);
    const sc93 = filas.find((f) => f.codInt === 'SC 93'); // normalizado a mayúsculas
    expect(sc93?.producto.cod).toBe('SCREEN_P');
    expect(sc93?.producto.descuento).toBe(0.2);
    expect(sc93?.producto.precio).toBe(0);
    expect(sc93?.producto.descripcion).toBe('DESC sc 93');
    expect(sc93?.anchoRollo).toBe(2.98);
  });

  it('lee CATEGORIA (A/B) y descarta valores fuera de lista', () => {
    const wb = wbProductos([
      fila('SCREEN_P', 'SC 81', 'PREMIUM', 0.2, 23820, 2.45, 'B'),
      fila('BLACKOUT_P', 'BK 01', 'PREMIUM', 0.2, 17877, 2.48, 'a'), // normaliza a mayúsculas
      fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 21786, 2.98, 'X'), // inválida → sin categoría
      fila('SCREEN_P', 'SC 93', 'PREMIUM', 0.2, 23820, 2.98), // sin columna → sin categoría
    ]);
    const filas = parsearCatalogoExcel(wb);
    expect(filas.find((f) => f.codInt === 'SC 81')?.producto.categoria).toBe('B');
    expect(filas.find((f) => f.codInt === 'BK 01')?.producto.categoria).toBe('A');
    expect(filas.find((f) => f.codInt === 'SC 64')?.producto.categoria).toBeUndefined();
    expect(filas.find((f) => f.codInt === 'SC 93')?.producto.categoria).toBeUndefined();
  });

  it('sin hoja "Productos" cae a "DEPURADA" y luego a la primera hoja con COD_INT', () => {
    // Libro estilo TELAS DEPURADAS: un log sin COD_INT, una hoja de trabajo y DEPURADA.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Turn #', 'Date', 'User Request'], [1, 46205, 'x']]),
      'Claude Log',
    );
    const conCodInt = (codint: string, precio: number) =>
      XLSX.utils.aoa_to_sheet([
        ['COD', 'Producto', 'COD_INT', 'Tipo', 'Descripción', 'Fecha Alta', 'Proveedor', 'Descuento', 'Costo', 'Ganancia', 'IVA', 'Precio de Venta', 'Ancho de Paños', 'CATEGORIA'],
        ['SCREEN_P', 'PROD', codint, 'PREMIUM', 'DESC', 45028, 'Prov', 0.2, 0, 0.65, 0.19, precio, 2.98, 'A'],
      ]);
    XLSX.utils.book_append_sheet(wb, conCodInt('SC 01', 111), 'Hoja1');
    XLSX.utils.book_append_sheet(wb, conCodInt('SC 02', 222), 'DEPURADA');
    const filas = parsearCatalogoExcel(wb);
    expect(filas.map((f) => f.codInt)).toEqual(['SC 02']); // DEPURADA gana sobre Hoja1

    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, conCodInt('SC 03', 333), 'Otra');
    expect(parsearCatalogoExcel(wb2).map((f) => f.codInt)).toEqual(['SC 03']);
  });

  it('ignora filas sin COD_INT o sin COD y deduplica', () => {
    const wb = wbProductos([
      fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 21786, 2.98),
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
      fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 99999, 2.98), // duplicado → gana el primero
    ]);
    const filas = parsearCatalogoExcel(wb);
    expect(filas).toHaveLength(1);
    expect(filas[0].producto.precio).toBe(21786);
  });
});

describe('diffCatalogo', () => {
  const actual: CatalogoProductos = {
    'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: 'x', precio: 23782 },
    'SC 64': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: 'x', precio: 21786, descuento: 0.2 },
  };

  it('separa nuevos, cambios de descuento y sin-cambio', () => {
    const filas = parsearCatalogoExcel(
      wbProductos([
        fila('SCREEN_P', 'SC 93', 'PREMIUM', 0.2, 0, 2.98), // NUEVO
        fila('BLACKOUT_D', 'BK 68', 'DELUX', 0.25, 23782, 2.98), // cambia descuento (0→0.25), precio igual
        fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 21786, 2.98), // sin cambio
      ]),
    );
    const d = diffCatalogo(actual, filas);
    expect(d.nuevos.map((n) => n.codInt)).toEqual(['SC 93']);
    expect(d.cambios).toHaveLength(1);
    expect(d.cambios[0].codInt).toBe('BK 68');
    expect(d.cambios[0].cambiaDescuento).toBe(true);
    expect(d.cambios[0].cambiaPrecio).toBe(false);
    expect(d.sinCambio).toBe(1);
  });

  it('precio importado en 0 no cuenta como cambio de precio', () => {
    const filas = parsearCatalogoExcel(
      wbProductos([fila('BLACKOUT_D', 'BK 68', 'DELUX', 0, 0, 2.98)]),
    );
    const d = diffCatalogo(actual, filas);
    expect(d.cambios).toHaveLength(0);
    expect(d.sinCambio).toBe(1);
  });

  it('categoría nueva o distinta cuenta como cambio; ausente en el Excel no borra', () => {
    const conCat: CatalogoProductos = {
      ...actual,
      'SC 64': { ...actual['SC 64'], categoria: 'A' },
    };
    const filas = parsearCatalogoExcel(
      wbProductos([
        fila('BLACKOUT_D', 'BK 68', 'DELUX', 0, 23782, 2.98, 'A'), // gana categoría (antes sin)
        fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 21786, 2.98, 'B'), // A → B
      ]),
    );
    const d = diffCatalogo(conCat, filas);
    expect(d.cambios.map((c) => c.codInt).sort()).toEqual(['BK 68', 'SC 64']);
    const bk = d.cambios.find((c) => c.codInt === 'BK 68');
    expect(bk?.cambiaCategoria).toBe(true);
    expect(bk?.categoriaVieja).toBeNull();
    expect(bk?.categoriaNueva).toBe('A');
    // Sin CATEGORIA en el Excel, la categoría existente se mantiene sin marcar cambio.
    const sinCat = parsearCatalogoExcel(
      wbProductos([fila('SCREEN_P', 'SC 64', 'PREMIUM', 0.2, 21786, 2.98)]),
    );
    expect(diffCatalogo(conCat, sinCat).cambios).toHaveLength(0);
  });
});

describe('aplicarCatalogo', () => {
  it('agrega nuevos, mergea existentes y no pisa precio válido con 0', () => {
    const actual: CatalogoProductos = {
      'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: 'x', precio: 23782, colorGrupo: 'negro', categoria: 'A' },
    };
    const filas = parsearCatalogoExcel(
      wbProductos([
        fila('SCREEN_P', 'SC 93', 'PREMIUM', 0.2, 0, 2.98, 'B'), // nuevo, precio 0
        fila('BLACKOUT_D', 'BK 68', 'DELUX', 0.25, 0, 3.0), // precio 0 → no pisa 23782
      ]),
    );
    const { catalogo, anchoRollo } = aplicarCatalogo(actual, {}, filas);
    expect(catalogo['SC 93'].descuento).toBe(0.2);
    expect(catalogo['SC 93'].precio).toBe(0); // hereda arquetipo al cotizar
    expect(catalogo['SC 93'].categoria).toBe('B');
    expect(catalogo['BK 68'].precio).toBe(23782); // no pisado con 0
    expect(catalogo['BK 68'].descuento).toBe(0.25); // sí actualiza descuento
    expect(catalogo['BK 68'].colorGrupo).toBe('negro'); // preserva campo previo
    expect(catalogo['BK 68'].categoria).toBe('A'); // sin CATEGORIA en el Excel no se borra
    expect(anchoRollo['SC 93']).toBe(2.98);
  });
});

// El COD_INT del catálogo lleva espacio ("DOM 42") pero las planillas de insumos
// lo escriben pegado ("DOM42"): al teclearlo o importarlo hay que resolver igual.
describe('claveCatalogoCanonica', () => {
  const cat: CatalogoProductos = {
    'DOM 42': { cod: 'ACCESORIO', producto: 'CONTROL 15 CANALES', tipo: 'ACCESORIO', descripcion: '', precio: 35000 },
    'SC 64': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0 },
  };

  it('coincidencia exacta', () => {
    expect(claveCatalogoCanonica(cat, 'DOM 42')).toBe('DOM 42');
  });

  it('sin espacio y en minúsculas resuelve a la llave real', () => {
    expect(claveCatalogoCanonica(cat, 'DOM42')).toBe('DOM 42');
    expect(claveCatalogoCanonica(cat, 'dom42')).toBe('DOM 42');
    expect(claveCatalogoCanonica(cat, 'dom 42')).toBe('DOM 42');
    expect(claveCatalogoCanonica(cat, '  DOM   42 ')).toBe('DOM 42');
  });

  it('sin match o vacío → null', () => {
    expect(claveCatalogoCanonica(cat, 'DOM 99')).toBeNull();
    expect(claveCatalogoCanonica(cat, '')).toBeNull();
    expect(claveCatalogoCanonica(cat, undefined)).toBeNull();
  });

  it('normCod: trim, colapsa espacios y mayúsculas', () => {
    expect(normCod('  sc   64 ')).toBe('SC 64');
    expect(normCod(null)).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Subir un Excel con SOLO los descuentos: es lo que la vendedora hace cuando
// cambia el % a muchas telas de una vez. Antes esa planilla borraba el
// producto, el tipo y la descripción de cada código que tocaba.
// ─────────────────────────────────────────────────────────────────────
describe('planilla de solo descuentos', () => {
  /** Un libro con las columnas que se le pasen, nada más. */
  function wbSuelto(header: string[], filas: (string | number)[][]): XLSX.WorkBook {
    const ws = XLSX.utils.aoa_to_sheet([header, ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    return wb;
  }

  const CAT: CatalogoProductos = {
    'BK 68': {
      cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX',
      descripcion: 'IGUAZU CRUDO 1903', precio: 23782, descuento: 0.2, categoria: 'A',
    },
  };

  it('sin la columna COD igual actualiza un código que ya existe', () => {
    const wb = wbSuelto(['COD_INT', 'DESCUENTO %'], [['BK 68', 35]]);
    const filas = parsearCatalogoExcel(wb);
    expect(filas).toHaveLength(1);
    const d = diffCatalogo(CAT, filas);
    expect(d.cambios).toHaveLength(1);
    expect(d.cambios[0].cambiaDescuento).toBe(true);
    expect(d.cambios[0].descuentoNuevo).toBeCloseTo(0.35, 6);
  });

  it('NO borra producto, tipo ni descripción', () => {
    const wb = wbSuelto(['COD_INT', 'DESCUENTO %'], [['BK 68', 35]]);
    const { catalogo } = aplicarCatalogo(CAT, {}, parsearCatalogoExcel(wb));
    expect(catalogo['BK 68'].producto).toBe('ROLLER BLACKOUT DELUX');
    expect(catalogo['BK 68'].tipo).toBe('DELUX');
    expect(catalogo['BK 68'].descripcion).toBe('IGUAZU CRUDO 1903');
    expect(catalogo['BK 68'].cod).toBe('BLACKOUT_D');
    expect(catalogo['BK 68'].categoria).toBe('A');
    expect(catalogo['BK 68'].precio).toBe(23782);
    expect(catalogo['BK 68'].descuento).toBeCloseTo(0.35, 6);
  });

  it('un precio ausente no se reporta como «baja a 0»', () => {
    const wb = wbSuelto(['COD_INT', 'DESCUENTO %'], [['BK 68', 35]]);
    const d = diffCatalogo(CAT, parsearCatalogoExcel(wb));
    expect(d.cambios[0].cambiaPrecio).toBe(false);
  });

  it('un código que no existe y viene sin COD se ignora con motivo', () => {
    const wb = wbSuelto(['COD_INT', 'DESCUENTO %'], [['BK 99', 35]]);
    const d = diffCatalogo(CAT, parsearCatalogoExcel(wb));
    expect(d.nuevos).toHaveLength(0);
    expect(d.ignorados).toHaveLength(1);
    expect(d.ignorados[0].codInt).toBe('BK 99');
    expect(d.ignorados[0].motivo).toContain('COD');
  });

  it('acepta los nombres con los que se escribe la columna a mano', () => {
    for (const cabecera of ['DCTO', '% DCTO', 'DESCUENTO %', 'DCT %', 'Descuento']) {
      const wb = wbSuelto(['COD_INT', cabecera], [['BK 68', 35]]);
      const filas = parsearCatalogoExcel(wb);
      expect(filas[0]?.producto.descuento, cabecera).toBeCloseTo(0.35, 6);
    }
  });
});

describe('leerDescuento — 0-1 o 0-100', () => {
  it('una fracción se deja como está', () => {
    expect(leerDescuento(0.3)).toEqual({ descuento: 0.3, eraPorcentaje: false });
    expect(leerDescuento(0.05)).toEqual({ descuento: 0.05, eraPorcentaje: false });
  });

  // El 1 es 100 %: es lo que ya significa en el catálogo (la instalación
  // regalada viene con descuento 1).
  it('el 1 es el 100 %, no el 1 %', () => {
    expect(leerDescuento(1)).toEqual({ descuento: 1, eraPorcentaje: false });
  });

  it('sobre 1 se lee como porcentaje y se avisa', () => {
    expect(leerDescuento(30)).toEqual({ descuento: 0.3, eraPorcentaje: true });
    expect(leerDescuento(100)).toEqual({ descuento: 1, eraPorcentaje: true });
  });

  it('vacío, texto o negativo → sin descuento', () => {
    expect(leerDescuento('').descuento).toBe(0);
    expect(leerDescuento('ninguno').descuento).toBe(0);
    expect(leerDescuento(-5).descuento).toBe(0);
  });
});

describe('filasParaPlantilla', () => {
  const CAT: CatalogoProductos = {
    'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BK DELUX', tipo: 'DELUX', descripcion: 'X', precio: 23782, descuento: 0.25 },
  };

  it('baja el catálogo con las cabeceras que el importador entiende', () => {
    const [f] = filasParaPlantilla(CAT, { 'BK 68': 2.98 });
    expect(f.COD_INT).toBe('BK 68');
    expect(f.COD).toBe('BLACKOUT_D');
    expect(f['DESCUENTO %']).toBe(25);
    expect(f['ANCHO DE PAÑOS']).toBe(2.98);
  });

  // Lo que se baja tiene que poder volver a subirse sin cambiar nada.
  it('ida y vuelta: bajar y volver a importar no mueve el catálogo', () => {
    const ws = XLSX.utils.json_to_sheet(filasParaPlantilla(CAT, {}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    const d = diffCatalogo(CAT, parsearCatalogoExcel(wb));
    expect(d.cambios).toHaveLength(0);
    expect(d.nuevos).toHaveLength(0);
    expect(d.sinCambio).toBe(1);
  });
});
