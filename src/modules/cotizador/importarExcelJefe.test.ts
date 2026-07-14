import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearExcelJefe } from './importarExcelJefe';

// Encabezados tal cual la planilla del jefe (ej. RAUL LABBE.xlsx).
const HEADER = ['LUGAR', 'MODELO', 'COLOR ACCESORIO', 'COLOR CADENA', 'ANCHO', 'ALTO'];

function libro(filas: unknown[][], antesDelHeader: unknown[][] = [], hoja = 'Hoja1') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([...antesDelHeader, HEADER, ...filas]),
    hoja,
  );
  return wb;
}

describe('parsearExcelJefe', () => {
  it('mapea las columnas del proyecto; LUGAR numérico → texto, ANCHO/ALTO → metros', () => {
    const wb = libro([
      [601, 'SCREEN', 'BLANCO', 'BLANCO', '0.98', '2.44'],
    ]);
    const filas = parsearExcelJefe(wb);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toEqual({
      lugar: '601',
      modelo: 'SCREEN',
      colorAccesorio: 'BLANCO',
      colorCadena: 'BLANCO',
      ancho: 0.98,
      alto: 2.44,
    });
  });

  it('acepta punto decimal, coma decimal es-CL y números nativos en las medidas', () => {
    const wb = libro([
      ['A', 'SCREEN', 'BLANCO', 'BLANCO', '1.06', '2.44'], // punto
      ['B', 'SCREEN', 'BLANCO', 'BLANCO', '2,44', '1,6'], // coma es-CL
      ['C', 'SCREEN', 'BLANCO', 'BLANCO', 0.35, 1.44], // nativos
    ]);
    const filas = parsearExcelJefe(wb);
    expect(filas.map((f) => [f.ancho, f.alto])).toEqual([
      [1.06, 2.44],
      [2.44, 1.6],
      [0.35, 1.44],
    ]);
  });

  it('tolera filas de título arriba del header', () => {
    const wb = libro(
      [[601, 'SCREEN', 'BLANCO', 'BLANCO', '0.98', '2.44']],
      [['PROYECTO RAUL LABBE'], [], ['Detalle de cortinas']],
    );
    const filas = parsearExcelJefe(wb);
    expect(filas).toHaveLength(1);
    expect(filas[0].lugar).toBe('601');
  });

  it('busca la tabla en cualquier hoja del libro', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['notas del proyecto']]), 'Portada');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([HEADER, [602, 'BLACKOUT', 'NEGRO', 'NEGRO', '1.20', '2.44']]),
      'Datos',
    );
    const filas = parsearExcelJefe(wb);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ lugar: '602', modelo: 'BLACKOUT', colorAccesorio: 'NEGRO' });
  });

  it('acepta el header alternativo "LUGAR / ÁREA" y "COLOR ACCESORIOS"', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['LUGAR / ÁREA', 'MODELO', 'COLOR ACCESORIOS', 'COLOR CADENA', 'ANCHO', 'ALTO'],
        ['LIVING', 'SCREEN', 'GRIS', 'GRIS', '1.50', '2.00'],
      ]),
      'Hoja1',
    );
    const filas = parsearExcelJefe(wb);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ lugar: 'LIVING', colorAccesorio: 'GRIS' });
  });

  it('salta filas totalmente vacías intermedias', () => {
    const wb = libro([
      [601, 'SCREEN', 'BLANCO', 'BLANCO', '0.98', '2.44'],
      ['', '', '', '', '', ''],
      [602, 'SCREEN', 'BLANCO', 'BLANCO', '1.06', '2.44'],
    ]);
    const filas = parsearExcelJefe(wb);
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.lugar)).toEqual(['601', '602']);
  });

  it('sin columnas reconocibles → []', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['FOO', 'BAR', 'BAZ'], [1, 2, 3]]),
      'Hoja1',
    );
    expect(parsearExcelJefe(wb)).toEqual([]);
  });
});
