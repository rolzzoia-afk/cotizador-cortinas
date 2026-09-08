import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearTerminosExcel } from './importarTerminosExcel';

/** Un workbook de una sola hoja armado desde una matriz. */
function libro(aoa: unknown[][], nombre = 'Formato de Cotizacion'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nombre);
  return wb;
}

// La forma REAL de «12. COTIZACION ALBERTO - VISITA.xlsm»: el rótulo en la
// columna 1, el número de cada término en esa misma columna y el texto en la 2
// —salvo el 27, que cae en la 5—, la numeración con un hueco (falta el 8), el
// texto repetido en dos columnas por celdas combinadas, el recuadro de totales
// a la derecha y el cierre en «NUESTROS PROYECTOS Y PRODUCTOS».
const PLANILLA: unknown[][] = [
  [null, 'DETALLE', null, null, null, null],
  [null, 'TÉRMINOS Y CONDICIONES GENERALES:', null, null, null, null,
    ...Array(9).fill(null), 'SUBTOTAL PAGO TARJETA D.C.', null, 1635409.96],
  [null, '1.', 'Instalación GRATIS mínimo de 4 cortinas.', null, null,
    'Instalación GRATIS mínimo de 4 cortinas.', ...Array(9).fill(null), 'IVA', 0.19, 310727.89],
  [null, '2.', 'Los valores pueden cambiar sin previo aviso.', null, null, null,
    ...Array(9).fill(null), 'TOT. TARJETA DE CRÉDITO', null, 1946137.86],
  // Salto de numeración: en la planilla real falta el 8 y la lista sigue.
  [null, '9.', 'DARK ROLLER se instala entre 18 a 25 días hábiles.'],
  [null, 10, 'Screen mayor a 2,00 mts suele deshilachar.'],
  // El texto en la columna 5 (celda combinada distinta).
  [null, '27.', null, null, null, 'Las cenefas sin tira pueden tener rayas de fábrica.'],
  [null, 'NUESTROS PROYECTOS Y PRODUCTOS'],
  [null, 'Esto ya no es un término y no se lee.'],
];

describe('parsearTerminosExcel', () => {
  const r = parsearTerminosExcel(libro(PLANILLA))!;

  it('encuentra el rótulo y lee los términos en orden', () => {
    expect(r.hoja).toBe('Formato de Cotizacion');
    expect(r.filaAncla).toBe(2);
    expect(r.terminos).toEqual([
      'Instalación GRATIS mínimo de 4 cortinas.',
      'Los valores pueden cambiar sin previo aviso.',
      'DARK ROLLER se instala entre 18 a 25 días hábiles.',
      'Screen mayor a 2,00 mts suele deshilachar.',
      'Las cenefas sin tira pueden tener rayas de fábrica.',
    ]);
  });

  it('no se trae el recuadro de totales que está a la derecha', () => {
    expect(r.terminos.join(' ')).not.toContain('TARJETA D.C.');
    expect(r.terminos.join(' ')).not.toContain('IVA');
  });

  it('para en «NUESTROS PROYECTOS» y no sigue leyendo', () => {
    expect(r.terminos).toHaveLength(5);
  });

  it('junta los espacios de más y no repite un término escrito dos veces', () => {
    const wb = libro([
      [null, 'TERMINOS Y CONDICIONES:'],
      [null, '1.', '  Pago:   50%  para   iniciar. '],
      [null, '2.', 'PAGO: 50% PARA INICIAR.'],
    ]);
    expect(parsearTerminosExcel(wb)!.terminos).toEqual(['Pago: 50% para iniciar.']);
  });

  it('busca en todas las hojas: la vendedora renombra su copia', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Insumos']]), 'Insumos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(PLANILLA), 'COTIZACION ALBERTO');
    expect(parsearTerminosExcel(wb)?.hoja).toBe('COTIZACION ALBERTO');
  });

  it('una planilla sin el rótulo devuelve null (y no un array vacío)', () => {
    expect(parsearTerminosExcel(libro([['A', 'B'], [1, 2]]))).toBeNull();
  });

  it('el rótulo sin ninguna fila numerada abajo tampoco cuenta', () => {
    expect(parsearTerminosExcel(libro([[null, 'TÉRMINOS Y CONDICIONES:'], [null, 'nada']]))).toBeNull();
  });
});
