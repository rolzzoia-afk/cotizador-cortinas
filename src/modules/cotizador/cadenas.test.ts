import { describe, it, expect } from 'vitest';
import {
  esCadenaRoller,
  cadenasRoller,
  etiquetaCadena,
  resolverCodCadenaLegacy,
  resolverCodCadenaBom,
  derivarLargoColor,
  descripcionCadenaInventario,
  pesosSeleccionables,
  esPesoSeleccionable,
  textoPesoCadenaInventario,
  type CadenaInsumo,
} from './cadenas';
import { OPCIONES_LARGO_CADENA } from './fase2';

// Muestra representativa del inventario real (CAD01–CAD16).
const INV: CadenaInsumo[] = [
  { cod: 'CAD01', nemotecnico: 'CADENA INFINITA 3 METROS [GRIS]', color: 'GRIS', status: 'OK' },
  { cod: 'CAD02', nemotecnico: 'CADENA INFINITA 4 METROS [GRIS]', color: 'GRIS', status: 'OK' },
  { cod: 'CAD03', nemotecnico: 'CADENA INFINITA 4 METROS [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD04', nemotecnico: 'CADENA INFINITA 3 METROS [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD05', nemotecnico: 'CADENA INFINITA 4 METROS [BLANCO]', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD06', nemotecnico: 'CADENA INFINITA 3 METROS [BLANCO]', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD07', nemotecnico: 'CADENA INFINITA 1,2 METROS [BLANCO]', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD09', nemotecnico: 'CADENA ROLLO BLANCA 200 MT', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD11', nemotecnico: 'CADENA BLANCA 80 CM SIN FIN', color: 'BLANCO', status: 'AGOTADO' },
  // Ruido que NO debe entrar al selector roller:
  { cod: 'VER15', nemotecnico: 'CADENA CORTINA VERTICAL', color: '', status: 'AGOTADO' },
  { cod: 'PCA01', nemotecnico: 'PESO HUEVO PORTA CADENA BLANCO', color: 'BLANCO', status: 'OK' },
];

describe('esCadenaRoller', () => {
  it('acepta CAD01..CAD16 y rechaza verticales / pesos', () => {
    expect(esCadenaRoller('CAD01')).toBe(true);
    expect(esCadenaRoller('CAD16')).toBe(true);
    expect(esCadenaRoller('VER15')).toBe(false);
    expect(esCadenaRoller('PCA01')).toBe(false);
    expect(esCadenaRoller('')).toBe(false);
  });
});

describe('cadenasRoller', () => {
  it('filtra solo CAD y oculta agotadas por defecto', () => {
    const r = cadenasRoller(INV);
    expect(r.map((c) => c.cod)).toEqual([
      'CAD01', 'CAD02', 'CAD03', 'CAD04', 'CAD05', 'CAD06', 'CAD07', 'CAD09',
    ]);
  });
  it('incluye agotadas si se pide', () => {
    const r = cadenasRoller(INV, { incluirAgotadas: true });
    expect(r.some((c) => c.cod === 'CAD11')).toBe(true);
  });
});

describe('etiquetaCadena', () => {
  it('muestra nemotécnico + código', () => {
    expect(etiquetaCadena(INV[0])).toBe('CADENA INFINITA 3 METROS [GRIS] · CAD01');
  });
});

describe('resolverCodCadenaLegacy', () => {
  it('3mts + GRS → CAD01', () => {
    expect(resolverCodCadenaLegacy('3mts', 'GRS', INV)).toBe('CAD01');
  });
  it('4mts + NEG → CAD03', () => {
    expect(resolverCodCadenaLegacy('4mts', 'NEG', INV)).toBe('CAD03');
  });
  it('ROLLO + BCO → CAD09', () => {
    expect(resolverCodCadenaLegacy('ROLLO', 'BCO', INV)).toBe('CAD09');
  });
  it('1mts + BCO → CAD07', () => {
    expect(resolverCodCadenaLegacy('1mts', 'BCO', INV)).toBe('CAD07');
  });
  it('devuelve null si el color no calza con ningún largo de ese tipo', () => {
    // 4mts en color que no existe (no hay 4 METROS METAL)
    expect(resolverCodCadenaLegacy('4mts', 'MET', INV)).toBeNull();
  });
  it('devuelve null con largo desconocido', () => {
    expect(resolverCodCadenaLegacy('99mts', 'BCO', INV)).toBeNull();
  });
});

describe('resolverCodCadenaBom', () => {
  it('respeta un código CAD ya presente en la especificación', () => {
    expect(
      resolverCodCadenaBom({ descripcion: 'Cadena', especificacion: 'CAD06', color: 'BCO' }, INV),
    ).toBe('CAD06');
  });
  it('resuelve desde especificación de largo + color', () => {
    expect(
      resolverCodCadenaBom({ descripcion: 'Cadena', especificacion: '3mts', color: 'NEG' }, INV),
    ).toBe('CAD04');
  });
  it('ignora la línea de "Peso de cadena"', () => {
    expect(
      resolverCodCadenaBom({ descripcion: 'Peso de cadena', especificacion: '', color: 'BCO' }, INV),
    ).toBeNull();
  });
});

describe('derivarLargoColor', () => {
  it('CAD01 → 3mts / GRS', () => {
    expect(derivarLargoColor('CAD01', INV)).toEqual({ largoCadena: '3mts', colorCadena: 'GRS' });
  });
  it('CAD05 → 4mts / BCO', () => {
    expect(derivarLargoColor('CAD05', INV)).toEqual({ largoCadena: '4mts', colorCadena: 'BCO' });
  });
  it('CAD16 (2.4 metros) → 2.4mts, y el radio de Fase 2 lo ofrece', () => {
    const inv = [
      ...INV,
      { cod: 'CAD16', nemotecnico: 'CADENA INFINITA 2.4 METROS [NEGRO]', color: 'NEGRO', status: 'OK' },
    ];
    const { largoCadena } = derivarLargoColor('CAD16', inv);
    expect(largoCadena).toBe('2.4mts');
    // Regresión: derivarLargoColor producía '2.4mts' pero OPCIONES_LARGO_CADENA
    // no lo tenía, así que el valor no se podía mostrar/elegir en el editor.
    expect(OPCIONES_LARGO_CADENA).toContain(largoCadena);
  });
});

describe('pesos de cadena', () => {
  const PESOS: CadenaInsumo[] = [
    { cod: 'PCA01', nemotecnico: 'PESO HUEVO PORTA CADENA BLANCO', color: 'BLANCO', status: 'OK' },
    { cod: 'PCA02', nemotecnico: 'PESO PORTA CADENA BLANCO / OVALADO', color: 'BLANCO', status: 'OK' },
    { cod: 'PCA04', nemotecnico: 'PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM', color: 'TRANSPARENTE', status: 'OK' },
    { cod: 'CAD01', nemotecnico: 'CADENA INFINITA 3 METROS [GRIS]', color: 'GRIS', status: 'OK' },
  ];
  it('solo ofrece PCA01 y PCA04, en ese orden', () => {
    expect(pesosSeleccionables(PESOS).map((p) => p.cod)).toEqual(['PCA01', 'PCA04']);
  });
  it('esPesoSeleccionable acepta solo PCA01/PCA04', () => {
    expect(esPesoSeleccionable('PCA01')).toBe(true);
    expect(esPesoSeleccionable('PCA04')).toBe(true);
    expect(esPesoSeleccionable('PCA02')).toBe(false);
    expect(esPesoSeleccionable('CAD01')).toBe(false);
  });
});

describe('textoPesoCadenaInventario', () => {
  const PESOS: CadenaInsumo[] = [
    { cod: 'PCA01', nemotecnico: 'PESO HUEVO PORTA CADENA BLANCO', color: 'BLANCO', status: 'OK' },
    { cod: 'PCA04', nemotecnico: 'PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM', color: 'TRANSPARENTE', status: 'OK' },
  ];

  it('usa codPeso de Fase 2 (nemotécnico del inventario)', () => {
    expect(textoPesoCadenaInventario({ codPeso: 'PCA01' }, PESOS)).toBe(
      'PESO HUEVO PORTA CADENA BLANCO',
    );
    expect(textoPesoCadenaInventario({ codPeso: 'PCA04' }, PESOS)).toContain('TRANSPARENTE');
  });

  it('sin codPeso cae a colorPeso (OTs viejas)', () => {
    expect(textoPesoCadenaInventario({ colorPeso: 'TRANSPARENTE' })).toBe('TRANSPARENTE');
    expect(textoPesoCadenaInventario({ colorPeso: 'BCO' })).toBe('BLANCO');
  });

  it('normaliza el código con espacios ("PCA 04" == "PCA04")', () => {
    expect(textoPesoCadenaInventario({ codPeso: 'PCA 04' })).toBe(
      'PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM',
    );
  });
});

describe('descripcionCadenaInventario', () => {
  it('compone código + nombre + color: "[CAD05] CADENA INFINITA 4 METROS GRIS"', () => {
    expect(
      descripcionCadenaInventario({ codCadena: 'CAD05', largoCadena: '4mts', colorCadena: 'GRS' }),
    ).toBe('[CAD05] CADENA INFINITA 4 METROS GRIS');
  });

  it('normaliza el código con espacios y sin color no lo agrega', () => {
    expect(descripcionCadenaInventario({ codCadena: 'CAD 03', largoCadena: '4mts' })).toBe(
      '[CAD03] CADENA INFINITA 4 METROS',
    );
  });

  it('ROLLO usa "CADENA ROLLO"', () => {
    expect(descripcionCadenaInventario({ codCadena: 'CAD10', largoCadena: 'ROLLO', colorCadena: 'NEG' })).toBe(
      '[CAD10] CADENA ROLLO NEGRO',
    );
  });

  it('sin codCadena (motor / OT vieja) devuelve el largo tal cual', () => {
    expect(descripcionCadenaInventario({ largoCadena: '4mts' })).toBe('4mts');
    expect(descripcionCadenaInventario({})).toBe('');
  });
});
