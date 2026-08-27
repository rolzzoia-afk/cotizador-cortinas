import { describe, expect, it } from 'vitest';
import type { InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import {
  agruparParaBodega,
  claveCheckBodega,
  claveInicio,
  columnaDeGrupo,
  duracionMin,
  estadoColumna,
  qrBolsa,
  seccionDeInsumo,
} from './bodega';

let n = 0;
const ins = (over: Partial<InsumoConsolidado>): InsumoConsolidado => ({
  id: ++n,
  descripcion: 'ALGO',
  cantidad: 1,
  grupo: 'PRODUCCION',
  ...over,
});

describe('columnaDeGrupo', () => {
  it('producción e insumos comparten bolsa: los dos se usan armando', () => {
    expect(columnaDeGrupo('PRODUCCION')).toBe('ARMADO');
    expect(columnaDeGrupo('INSUMOS')).toBe('ARMADO');
  });

  it('estructura e instalación van cada una a la suya', () => {
    expect(columnaDeGrupo('ESTRUCTURA')).toBe('ESTRUCTURA');
    expect(columnaDeGrupo('INSTALACION')).toBe('INSTALACION');
  });
});

describe('seccionDeInsumo', () => {
  it('separa por prefijo del código, con o sin espacio', () => {
    expect(seccionDeInsumo('MEC 14')).toBe('Mecanismo');
    expect(seccionDeInsumo('mec14')).toBe('Mecanismo');
    expect(seccionDeInsumo('CAD 05')).toBe('Cadenas');
    expect(seccionDeInsumo('DOM 38')).toBe('Motor');
  });

  it('lo que no es kit, cadena ni motor es ferretería suelta', () => {
    expect(seccionDeInsumo('INS 95')).toBe('Insumos');
    expect(seccionDeInsumo('E02')).toBe('Insumos');
    // Las manillas y las tapas de cenefa no tienen código.
    expect(seccionDeInsumo(undefined)).toBe('Insumos');
    expect(seccionDeInsumo('')).toBe('Insumos');
  });
});

describe('claveCheckBodega', () => {
  it('el mismo código en dos bolsas son dos marcas distintas', () => {
    const tornillo = { codigo: 'INS 43', descripcion: 'TORNILLO' };
    expect(claveCheckBodega('ARMADO', tornillo)).not.toBe(
      claveCheckBodega('INSTALACION', tornillo),
    );
  });

  it('sin código usa la descripción (manillas, tapas de cenefa)', () => {
    expect(claveCheckBodega('ARMADO', { descripcion: 'MANILLA BLANCA' })).toBe(
      'ARMADO|MANILLA BLANCA',
    );
  });

  it('nunca choca con un sentinel de la columna', () => {
    const clave = claveCheckBodega('ARMADO', { codigo: 'MEC 14', descripcion: 'KIT' });
    expect(clave.startsWith('__')).toBe(false);
    expect(clave).not.toBe(claveInicio('ARMADO'));
  });
});

describe('agruparParaBodega', () => {
  const insumos = [
    ins({ codigo: 'MEC 14', descripcion: 'KIT MECANISMO', grupo: 'PRODUCCION' }),
    ins({ codigo: 'CAD 05', descripcion: 'CADENA', grupo: 'PRODUCCION' }),
    ins({ codigo: 'INS 43', descripcion: 'TOPE', grupo: 'INSUMOS' }),
    ins({ codigo: 'VER 61', descripcion: 'RIEL', grupo: 'ESTRUCTURA' }),
    ins({ codigo: 'INS 90', descripcion: 'TARUGO', grupo: 'INSTALACION' }),
    ins({ codigo: 'DOM 38', descripcion: 'MOTOR', grupo: 'PRODUCCION' }),
  ];

  it('siempre devuelve las tres columnas, en su orden', () => {
    const cols = agruparParaBodega(insumos);
    expect(cols.map((c) => c.columna)).toEqual(['ARMADO', 'ESTRUCTURA', 'INSTALACION']);
  });

  it('armado junta producción + insumos y los ordena por sección', () => {
    const [armado] = agruparParaBodega(insumos);
    expect(armado.total).toBe(4);
    expect(armado.secciones.map((s) => s.seccion)).toEqual([
      'Mecanismo',
      'Cadenas',
      'Motor',
      'Insumos',
    ]);
    expect(armado.secciones.find((s) => s.seccion === 'Insumos')?.items).toHaveLength(1);
  });

  it('una sección sin items no se dibuja', () => {
    const [, estructura] = agruparParaBodega(insumos);
    expect(estructura.secciones.map((s) => s.seccion)).toEqual(['Insumos']);
  });

  it('una columna vacía queda en cero, no desaparece', () => {
    const cols = agruparParaBodega([ins({ grupo: 'ESTRUCTURA', codigo: 'X' })]);
    expect(cols[0].total).toBe(0);
    expect(cols[0].secciones).toEqual([]);
    expect(cols[1].total).toBe(1);
  });

  it('una OT sin insumos no revienta', () => {
    expect(agruparParaBodega([]).every((c) => c.total === 0)).toBe(true);
  });
});

describe('estadoColumna', () => {
  it('sin nada marcado hay que empezar', () => {
    expect(estadoColumna(5, 0)).toBe('EMPEZAR');
  });

  it('con algo marcado está en proceso', () => {
    expect(estadoColumna(5, 3)).toBe('EN PROCESO');
  });

  it('con todo marcado está completada', () => {
    expect(estadoColumna(5, 5)).toBe('COMPLETADO');
  });

  it('una columna VACÍA no se da por completada sola', () => {
    // Si no hay nada que juntar, la bolsa no está «lista»: no existe.
    expect(estadoColumna(0, 0)).toBe('EMPEZAR');
  });
});

describe('duracionMin', () => {
  const t0 = '2026-08-27T10:00:00.000Z';
  const ahora = Date.parse('2026-08-27T10:25:00.000Z');

  it('sin inicio no hay reloj', () => {
    expect(duracionMin(undefined, undefined, ahora)).toBe(null);
  });

  it('sin fin cuenta hasta ahora: el reloj corre', () => {
    expect(duracionMin(t0, undefined, ahora)).toBe(25);
  });

  it('con fin cuenta el tramo cerrado', () => {
    expect(duracionMin(t0, '2026-08-27T10:07:00.000Z', ahora)).toBe(7);
  });

  it('una bolsa de 40 segundos no se prepara en «0 min»', () => {
    expect(duracionMin(t0, '2026-08-27T10:00:40.000Z', ahora)).toBe(1);
  });

  it('fechas rotas o al revés no muestran un número falso', () => {
    expect(duracionMin('cuando sea', undefined, ahora)).toBe(null);
    expect(duracionMin(t0, '2026-08-27T09:00:00.000Z', ahora)).toBe(null);
  });
});

describe('qrBolsa', () => {
  it('identifica la bolsa por OT y columna, en ASCII', () => {
    expect(qrBolsa('3197', 'ARMADO')).toBe('BOLSA:3197|ARMADO');
  });

  it('limpia lo que no sea ASCII imprimible', () => {
    expect(qrBolsa(' 3197-B ', 'ESTRUCTURA')).toBe('BOLSA:3197-B|ESTRUCTURA');
  });
});
