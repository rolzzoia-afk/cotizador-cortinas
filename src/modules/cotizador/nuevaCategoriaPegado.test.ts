import { describe, expect, it } from 'vitest';
import { numeroCl, parsearFilasPegadas, porcentajeCl } from './nuevaCategoriaPegado';
import { borrador, ctx } from './__fixtures__/nuevaCategoria';

const B = borrador();
const C = ctx();

// Lo que sale de copiar el rango del Excel maestro (celdas con tabulación).
const CABECERA =
  'COD\tProducto\tCOD_INT\tTipo\tDescripción\tFecha Alta\tProveedor\tDescuento\tCosto\tGanancia\tIVA\tPrecio de Venta\tAncho de Paños';
const FILA_BKD =
  'BLACKOUT_D\tROLLER BLACKOUT DELUX\tBK-D\tDELUX\tCOLOR POR DEFINIR\t12-04-2023\tProveedor 1\t25%\t22.869\t65%\t19%\t41.868\t2,95';
const FILA_BKP =
  'BLACKOUT_P\tROLLER BLACKOUT PREMIUM\tBK-P\tPREMIUM\tCOLOR POR DEFINIR\t12-04-2023\tProveedor 1\t25%\t15.966\t65%\t19%\t29.231\t2,45';

describe('numeroCl — los números como se escriben acá', () => {
  it('el punto separa los miles y la coma los decimales', () => {
    expect(numeroCl('22.869')).toBe(22869);
    expect(numeroCl('2,95')).toBe(2.95);
    expect(numeroCl('1.234.567')).toBe(1234567);
    expect(numeroCl('$ 41.868')).toBe(41868);
    expect(numeroCl('25%')).toBe(25);
  });

  it('un decimal escrito con punto igual se entiende', () => {
    expect(numeroCl('2.95')).toBe(2.95);
    expect(numeroCl('1.234,50')).toBe(1234.5);
  });

  it('lo que no es número no se inventa', () => {
    expect(numeroCl('')).toBeNull();
    expect(numeroCl('ninguno')).toBeNull();
    expect(numeroCl(null)).toBeNull();
  });

  it('un porcentaje se entiende escrito de las dos formas', () => {
    expect(porcentajeCl('25%')).toBe(25);
    expect(porcentajeCl('0,25')).toBe(25);
    expect(porcentajeCl('65')).toBe(65);
  });
});

describe('parsearFilasPegadas — pegar del Excel', () => {
  it('con cabecera lee cada columna por su nombre', () => {
    const r = parsearFilasPegadas([CABECERA, FILA_BKD, FILA_BKP].join('\n'), B, C);
    expect(r.conCabecera).toBe(true);
    expect(r.filas).toHaveLength(2);
    const [bkd] = r.filas;
    expect(bkd.codInt).toBe('BK-D');
    expect(bkd.producto).toBe('ROLLER BLACKOUT DELUX');
    expect(bkd.tipo).toBe('DELUX');
    expect(bkd.descripcion).toBe('COLOR POR DEFINIR');
    expect(bkd.fechaAlta).toBe('2023-04-12');
    expect(bkd.proveedor).toBe('Proveedor 1');
    expect(bkd.descuentoPct).toBe(25);
    expect(bkd.costo).toBe(22869);
    expect(bkd.gananciaPct).toBe(65);
    expect(bkd.precio).toBe(41868);
    expect(bkd.anchoRolloM).toBe(2.95);
  });

  it('sin cabecera se toma el orden del Excel', () => {
    const r = parsearFilasPegadas([FILA_BKD, FILA_BKP].join('\n'), B, C);
    expect(r.conCabecera).toBe(false);
    expect(r.filas.map((f) => f.codInt)).toEqual(['BK-D', 'BK-P']);
    expect(r.filas[1].costo).toBe(15966);
    expect(r.filas[1].anchoRolloM).toBe(2.45);
  });

  it('el precio pegado manda aunque no cuadre con costo ÷ ganancia', () => {
    // 15.966 ÷ 0,65 × 1,19 da 29.230, y la planilla dice 29.231.
    const r = parsearFilasPegadas([CABECERA, FILA_BKP].join('\n'), B, C);
    expect(r.filas[0].precio).toBe(29231);
    expect(r.filas[0].precioManual).toBe(true);
  });

  it('sin columna de precio lo calcula del costo', () => {
    const r = parsearFilasPegadas(
      ['COD_INT\tDescripción\tCosto', 'LN 01\tRUSTICO\t22.869'].join('\n'),
      B,
      C,
    );
    expect(r.filas[0].precio).toBe(41868);
    expect(r.filas[0].precioManual).toBe(false);
    // Lo que la planilla no trae queda con los valores de una fila nueva.
    expect(r.filas[0].tipo).toBe('PREMIUM');
    expect(r.filas[0].gananciaPct).toBe(65);
    expect(r.filas[0].fechaAlta).toBe('2026-09-14');
    expect(r.filas[0].producto).toBe('ROLLER LINO PREMIUM');
  });

  it('la familia pegada no se usa, pero se avisa', () => {
    const r = parsearFilasPegadas([CABECERA, FILA_BKD].join('\n'), B, C);
    expect(r.avisos.join(' ')).toMatch(/LINO_D/);
    expect(r.avisos.join(' ')).toMatch(/columna COD se ignora/i);
  });

  it('las líneas vacías se saltan y un texto suelto no se toma como tabla', () => {
    expect(parsearFilasPegadas([CABECERA, FILA_BKD, '', ''].join('\n'), B, C).filas).toHaveLength(1);
    expect(parsearFilasPegadas('BK-D', B, C).filas).toEqual([]);
    expect(parsearFilasPegadas('', B, C).filas).toEqual([]);
  });

  it('la gama A/B viaja si la planilla la trae', () => {
    const r = parsearFilasPegadas(
      ['COD_INT\tCATEGORIA', 'LN 01\tB', 'LN 02\tx'].join('\n'),
      B,
      C,
    );
    expect(r.filas.map((f) => f.gama)).toEqual(['B', '']);
  });
});
