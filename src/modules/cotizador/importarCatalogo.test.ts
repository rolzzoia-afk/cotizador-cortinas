import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearCatalogoExcel, diffCatalogo, aplicarCatalogo } from './importarCatalogo';
import type { CatalogoProductos } from './types';

// Arma un workbook con una hoja "Productos" como el Excel maestro:
// cabecera en una fila con relleno arriba, columnas por nombre.
function wbProductos(filas: (string | number)[][]): XLSX.WorkBook {
  const header = [
    'COD', 'Producto', 'COD_INT', 'Tipo', 'Descripción', 'Fecha Alta',
    'Proveedor', 'Descuento', 'Costo', 'Ganancia', 'IVA', 'Precio de Venta', 'Ancho de Paños',
  ];
  const aoa: (string | number)[][] = [[], [], header, ...filas];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  return wb;
}
// COD, Producto, COD_INT, Tipo, Descripción, FechaAlta, Proveedor, Descuento, Costo, Gan, IVA, Precio, Ancho
const fila = (cod: string, codint: string, tipo: string, desc: number, precio: number, ancho: number) =>
  [cod, `PROD ${cod}`, codint, tipo, `DESC ${codint}`, 45028, 'Prov', desc, 0, 0.65, 0.19, precio, ancho];

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
});

describe('aplicarCatalogo', () => {
  it('agrega nuevos, mergea existentes y no pisa precio válido con 0', () => {
    const actual: CatalogoProductos = {
      'BK 68': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: 'x', precio: 23782, colorGrupo: 'negro' },
    };
    const filas = parsearCatalogoExcel(
      wbProductos([
        fila('SCREEN_P', 'SC 93', 'PREMIUM', 0.2, 0, 2.98), // nuevo, precio 0
        fila('BLACKOUT_D', 'BK 68', 'DELUX', 0.25, 0, 3.0), // precio 0 → no pisa 23782
      ]),
    );
    const { catalogo, anchoRollo } = aplicarCatalogo(actual, {}, filas);
    expect(catalogo['SC 93'].descuento).toBe(0.2);
    expect(catalogo['SC 93'].precio).toBe(0); // hereda arquetipo al cotizar
    expect(catalogo['BK 68'].precio).toBe(23782); // no pisado con 0
    expect(catalogo['BK 68'].descuento).toBe(0.25); // sí actualiza descuento
    expect(catalogo['BK 68'].colorGrupo).toBe('negro'); // preserva campo previo
    expect(anchoRollo['SC 93']).toBe(2.98);
  });
});
