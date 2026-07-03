import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearCatalogoExcel, diffCatalogo, aplicarCatalogo } from './importarCatalogo';
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
