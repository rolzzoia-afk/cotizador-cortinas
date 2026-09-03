import { describe, it, expect } from 'vitest';
import {
  COD_PESO_AUTO,
  codCadenaDelPano,
  codPesoAuto,
  esCadenaMetalica,
  esCadenaRoller,
  llevaCadenaMetalica,
  metrosCadenaMetalica,
  patchCadenaMetalica,
  textoCadenaMetalica,
  codCadenaVertical,
  colorCadenaVertical,
  largoCadenaAuto,
  cadenasRoller,
  codCadenaAutoPorAlto,
  codCadenaPorLargoColor,
  etiquetaCadena,
  resolverCodCadenaLegacy,
  resolverCodCadenaBom,
  derivarLargoColor,
  descripcionCadenaInventario,
  pesosSeleccionables,
  esPesoSeleccionable,
  textoPesoCadenaInventario,
  TOPES_POR_CADENA,
  codTopeAuto,
  esTopeCadena,
  esTopeSeleccionable,
  topesSeleccionables,
  textoTopeInventario,
  type CadenaInsumo,
} from './cadenas';
import { OPCIONES_LARGO_CADENA } from './fase2';
import { REGLAS_CADENA, type ReglasCadena } from '@/modules/descuentos/reglas-cadena';

// Inventario para las reglas de auto-selección, con el lineup vigente desde el
// 2026-08-10: 1,2 m (60 cm) · 1,6 m (80 cm) · 2,4 m · 3 m · 4 m. Las de 1,40 m
// (70 cm) quedaron agotadas y solo se resuelven en OTs viejas.
const INV_AUTO: CadenaInsumo[] = [
  { cod: 'CAD03', nemotecnico: 'CADENA INFINITA 4 METROS [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD04', nemotecnico: 'CADENA INFINITA 3 METROS [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD06', nemotecnico: 'CADENA INFINITA 3 METROS [BLANCO]', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD08', nemotecnico: 'CADENA INFINITA 1,2 METROS - 60 CM [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD12', nemotecnico: 'CADENA INFINITA 1,6 METROS - 80 CM [NEGRO]', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD14', nemotecnico: 'CADENA 2.4 MTS NEGRA', color: 'NEGRO', status: 'OK' },
  { cod: 'CAD16', nemotecnico: 'CADENA 2.4 MTS BLANCA', color: 'BLANCO', status: 'OK' },
  { cod: 'CAD17', nemotecnico: 'CADENA INFINITA 1,2 METROS - 60 CM [GRIS]', color: 'GRIS', status: 'OK' },
  { cod: 'CAD18', nemotecnico: 'CADENA NEGRO - 1,40 MTS (70 CM) SIN FIN', color: 'NEGRO', status: 'AGOTADO' },
  { cod: 'CAD20', nemotecnico: 'CADENA 2.4 MTS - GRIS', color: 'GRIS', status: 'OK' },
  { cod: 'CAD21', nemotecnico: 'CADENA INFINITA 1,6 METROS - 80 CM [GRIS]', color: 'GRIS', status: 'OK' },
];

describe('derivarLargoColor: lineup vigente y legacy', () => {
  it('la de 1,40 m (agotada) se sigue resolviendo en OTs viejas', () => {
    expect(derivarLargoColor('CAD18', INV_AUTO)).toEqual({ largoCadena: '1.4mts', colorCadena: 'NEG' });
  });
  it('"1,6 METROS - 80 CM" es el largo interno 0.75 (80 cm de caída)', () => {
    expect(derivarLargoColor('CAD12', INV_AUTO)).toEqual({ largoCadena: '0.75', colorCadena: 'NEG' });
    expect(derivarLargoColor('CAD21', INV_AUTO)).toEqual({ largoCadena: '0.75', colorCadena: 'GRS' });
  });
  it('"1,2 METROS - 60 CM" es el largo interno 1mts', () => {
    expect(derivarLargoColor('CAD08', INV_AUTO)).toEqual({ largoCadena: '1mts', colorCadena: 'NEG' });
    expect(derivarLargoColor('CAD17', INV_AUTO)).toEqual({ largoCadena: '1mts', colorCadena: 'GRS' });
  });
});

describe('codCadenaAutoPorAlto', () => {
  it('roller por alto: 2,5→4m · 1,6→3m · 1,0→2,4m · 0,6→1,2m', () => {
    expect(codCadenaAutoPorAlto(2.5, 'NEG', 'ROL', INV_AUTO)).toBe('CAD03');
    expect(codCadenaAutoPorAlto(1.6, 'BCO', 'ROL', INV_AUTO)).toBe('CAD06');
    expect(codCadenaAutoPorAlto(1.0, 'NEG', 'ROL', INV_AUTO)).toBe('CAD14');
    // El peldaño bajo pedía la de 1,40 m hasta que bodega la dio de baja.
    expect(codCadenaAutoPorAlto(0.6, 'NEG', 'ROL', INV_AUTO)).toBe('CAD08');
  });
  it('el dúo tiene escalera propia (regla del dueño 2026-08-10)', () => {
    // Caso de la OT 268-4: un dúo de 1,93 m salía con la cadena corta de 70 cm.
    expect(codCadenaAutoPorAlto(1.93, 'BCO', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD06');
    // ≥2,1 → 4 m · ≥1,6 → 3 m · ≥1,4 → 2,4 m · ≥0,9 → 1,6 m · ≥0,6 → 1,2 m.
    expect(codCadenaAutoPorAlto(2.2, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD03');
    expect(codCadenaAutoPorAlto(1.6, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD04');
    expect(codCadenaAutoPorAlto(1.4, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD14');
    expect(codCadenaAutoPorAlto(0.9, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD12');
    expect(codCadenaAutoPorAlto(0.6, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD08');
    // Bajo el último peldaño del dúo la elige el vendedor: NO cae a la del roller.
    expect(codCadenaAutoPorAlto(0.55, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBeNull();
  });
  it('un dúo de 1,3 m usa 1,6 m; un roller del mismo alto usa 2,4 m', () => {
    expect(codCadenaAutoPorAlto(1.3, 'NEG', 'DUO_MANUAL_38mm', INV_AUTO)).toBe('CAD12');
    expect(codCadenaAutoPorAlto(1.3, 'NEG', 'ROL', INV_AUTO)).toBe('CAD14');
  });
  it('la pletina de dúo NO entra en la escalera del dúo (no empieza con DUO)', () => {
    expect(codCadenaAutoPorAlto(1.3, 'NEG', 'PLETINA_DUO_V', INV_AUTO)).toBe('CAD14');
  });
  // Fase 2 conserva el largo elegido cuando solo cambia el color de accesorios
  // (codCadenaPorLargoColor). Con el lineup nuevo, un paño viejo de 1,40 m ya no
  // encuentra pareja en ningún color → devuelve null y la cadena se recalcula
  // por la escalera, en vez de caer a una más corta del mismo código reasignado.
  it('el largo 1,40 m ya no existe en el inventario vigente', () => {
    expect(codCadenaPorLargoColor('1.4mts', 'BCO', INV_AUTO)).toBeNull();
    expect(codCadenaPorLargoColor('1.4mts', 'NEG', INV_AUTO)).toBeNull(); // CAD18 agotada
    // Los largos vigentes sí resuelven.
    expect(codCadenaPorLargoColor('0.75', 'GRS', INV_AUTO)).toBe('CAD21');
    expect(codCadenaPorLargoColor('1mts', 'GRS', INV_AUTO)).toBe('CAD17');
  });

  it('gris corto roller → 2,4 gris (CAD20)', () => {
    expect(codCadenaAutoPorAlto(1.0, 'GRS', 'ROL', INV_AUTO)).toBe('CAD20');
  });
  it('MET/CAFÉ → null; alto <0,5 → null', () => {
    expect(codCadenaAutoPorAlto(1.5, 'MET', 'ROL', INV_AUTO)).toBeNull();
    expect(codCadenaAutoPorAlto(0.4, 'NEG', 'ROL', INV_AUTO)).toBeNull();
  });
});

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

// ── Catálogo editable (Admin → Catálogo técnico → Cadenas) ───────────
// Las reglas viajan por parámetro con default: sin nada guardado, todo lo de
// arriba sigue igual. Estos casos prueban lo que cambia al editarlas.
describe('reglas de cadena editables', () => {
  it('mover un tramo cambia la cadena que se elige sola', () => {
    // De fábrica, 1,90 m cae en el tramo de 1,4 → cadena de 3 m.
    expect(codCadenaAutoPorAlto(1.9, 'BCO', 'ROL', INV_AUTO)).toBe('CAD06');
    // Bajando el tramo de los 4 m a 1,8 → la misma cortina pasa a 4 m.
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      tramosAlto: [
        { altoMinM: 1.8, largo: '4mts' },
        { altoMinM: 1.4, largo: '3mts' },
        { altoMinM: 0.8, largo: '2.4mts' },
      ],
    };
    const inv = [
      ...INV_AUTO,
      { cod: 'CAD05', nemotecnico: 'CADENA INFINITA 4 METROS [BLANCO]', color: 'BLANCO', status: 'OK' },
    ];
    expect(codCadenaAutoPorAlto(1.9, 'BCO', 'ROL', inv, undefined, reglas)).toBe('CAD05');
  });

  it('una regla por categoría gana sobre la escalera, con match "empieza con"', () => {
    // De fábrica el dúo trae escalera propia: 2,5 m alcanza su tramo de 2,1.
    expect(largoCadenaAuto(2.5, 'DUOBK')?.largo).toBe('4mts');
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      reglasCategoria: [
        { descripcion: 'Dúo: cadena corta', categoria: { empiezaCon: 'DUO' }, largo: '1.4mts' },
      ],
    };
    // DUOBK arranca con DUO → la regla lo agarra.
    expect(largoCadenaAuto(2.5, 'DUOBK', undefined, reglas)?.largo).toBe('1.4mts');
    // PLETINA_DUO_V contiene "DUO" pero no empieza con él: manda el alto.
    expect(largoCadenaAuto(2.5, 'PLETINA_DUO_V', undefined, reglas)?.largo).toBe('4mts');
  });

  it('la escalera de una categoría REEMPLAZA a la general', () => {
    // Un dúo de 1,5 m: su escalera propia da 2,4 m; la general daría 3 m.
    expect(largoCadenaAuto(1.5, 'DUO_MANUAL_38mm')?.largo).toBe('2.4mts');
    expect(largoCadenaAuto(1.5, 'ROL')?.largo).toBe('3mts');
    // Bajo el último tramo del dúo NO se cae al peldaño del roller.
    expect(largoCadenaAuto(0.55, 'DUO_MANUAL_38mm')).toBeNull();
    expect(largoCadenaAuto(0.55, 'ROL')?.largo).toBe('1mts');
  });

  it('el motivo dice por qué se eligió ese largo', () => {
    expect(largoCadenaAuto(2.5, 'ROL')?.motivo).toContain('desde 2 m');
    expect(largoCadenaAuto(0.3, 'ROL')).toBeNull(); // bajo el tramo más chico
    // Con escalera propia el motivo nombra la regla Y el tramo que ganó.
    const motivoDuo = largoCadenaAuto(1.5, 'DUO_MANUAL_38mm')?.motivo ?? '';
    expect(motivoDuo).toContain('Dúo');
    expect(motivoDuo).toContain('desde 1,4 m');
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      reglasCategoria: [
        { descripcion: 'Dúo: cadena corta', categoria: { empiezaCon: 'DUO' }, largo: '1.4mts' },
      ],
    };
    expect(largoCadenaAuto(2.5, 'DUOBK', undefined, reglas)?.motivo).toContain('Dúo');
  });

  it('una cadena declarada manda sobre el nombre del insumo', () => {
    // El nemotécnico no deja adivinar nada: sin declararla, sale sin largo.
    const inv: CadenaInsumo[] = [
      { cod: 'CAD90', nemotecnico: 'CADENA ESPECIAL PEDIDO', color: 'DORADO', status: 'OK' },
    ];
    expect(derivarLargoColor('CAD90', inv)).toEqual({ largoCadena: '', colorCadena: 'DORADO' });

    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      cadenas: [{ codigo: 'CAD90', largo: '4mts', color: 'DORADO', estado: 'activo' }],
    };
    expect(derivarLargoColor('CAD90', inv, reglas)).toEqual({
      largoCadena: '4mts',
      colorCadena: 'DORADO',
    });
    // Y ya se elige sola para una cortina alta de accesorios dorados.
    expect(codCadenaAutoPorAlto(2.4, 'DORADO', 'ROL', inv, undefined, reglas)).toBe('CAD90');
  });

  it('una cadena oculta sale del selector pero las OTs viejas la siguen resolviendo', () => {
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      cadenas: [{ codigo: 'CAD06', largo: '3mts', color: 'BCO', estado: 'oculto' }],
    };
    expect(cadenasRoller(INV_AUTO, {}, reglas).map((c) => c.cod)).not.toContain('CAD06');
    // Se sigue resolviendo: una OT guardada con CAD06 no pierde su cadena.
    expect(derivarLargoColor('CAD06', INV_AUTO, reglas)).toEqual({
      largoCadena: '3mts',
      colorCadena: 'BCO',
    });
    // Y deja de auto-seleccionarse (ya no está entre las ofrecidas).
    expect(codCadenaAutoPorAlto(1.5, 'BCO', 'ROL', INV_AUTO, undefined, reglas)).toBeNull();
  });

  it('la cadena de la vertical es editable por color', () => {
    expect(codCadenaVertical('NEG')).toBe('CAD04');
    expect(codCadenaVertical('BCO')).toBe('CAD06');
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      verticalPorColor: { NEG: 'CAD03', NEGRO: 'CAD03' },
      verticalDefault: 'CAD05',
    };
    expect(codCadenaVertical('NEG', reglas)).toBe('CAD03');
    expect(codCadenaVertical('GRS', reglas)).toBe('CAD05'); // cae al default
    expect(colorCadenaVertical('GRS', reglas)).toBe('BCO');
  });

  it('un código declarado que no calza el patrón CAD igual es cadena de roller', () => {
    expect(esCadenaRoller('CADENA-X')).toBe(false);
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      cadenas: [{ codigo: 'CADENA-X', largo: '3mts', color: 'BCO', estado: 'activo' }],
    };
    expect(esCadenaRoller('CADENA-X', reglas)).toBe(true);
  });
});

describe('codPesoAuto — el peso de cadena por gama', () => {
  it('gama A: PCA04 transparente (el de siempre)', () => {
    expect(codPesoAuto(false)).toBe('PCA04');
    expect(codPesoAuto(undefined)).toBe('PCA04');
    expect(codPesoAuto(false)).toBe(COD_PESO_AUTO);
  });

  it('gama B: SIEMPRE PCA01 blanco, sea cual sea el color de accesorios', () => {
    expect(codPesoAuto(true)).toBe('PCA01');
  });
});

describe('codTopeAuto — el tope de cadena por color de accesorios', () => {
  it('los cuatro colores que se venden tienen su tope', () => {
    expect(codTopeAuto('BCO')).toBe('TOP01');
    expect(codTopeAuto('GRS')).toBe('TOP04');
    expect(codTopeAuto('NEG')).toBe('TOP05');
    expect(codTopeAuto('MET')).toBe('TOP06');
  });

  it('acepta el nombre largo y los plurales tecleados en Fase 1', () => {
    expect(codTopeAuto('BLANCO')).toBe('TOP01');
    expect(codTopeAuto('NEGROS')).toBe('TOP05');
    expect(codTopeAuto('grises')).toBe('TOP04');
    expect(codTopeAuto('METAL')).toBe('TOP06');
  });

  it('a diferencia de la cadena, el METÁLICO sí tiene tope propio', () => {
    // `colorCadenaCorto('MET')` devuelve '' (no hay cadena metálica), pero el
    // tope TOP06 existe y se vende: por eso el tope tiene su propia tabla.
    expect(codTopeAuto('MET')).toBe('TOP06');
  });

  it('un color sin tope catalogado no inventa uno: lo elige el vendedor', () => {
    expect(codTopeAuto('CAFÉ')).toBeNull();
    expect(codTopeAuto('DORADO')).toBeNull();
    expect(codTopeAuto('')).toBeNull();
    expect(codTopeAuto(null)).toBeNull();
  });

  it('el catálogo de colores pisa la tabla de fábrica', () => {
    const colores = [
      { codigo: 'NEG', nombre: 'NEGRO', usos: {}, insumos: { topeCadena: 'TOP 99' } },
      { codigo: 'DOR', nombre: 'DORADO', usos: {}, insumos: { topeCadena: 'TOP90' } },
    ] as unknown as Parameters<typeof codTopeAuto>[1];
    expect(codTopeAuto('NEG', colores)).toBe('TOP99'); // sin espacios, como el stock
    expect(codTopeAuto('DOR', colores)).toBe('TOP90'); // color nuevo, sin tabla de fábrica
  });

  it('van 2 por cadena', () => {
    expect(TOPES_POR_CADENA).toBe(2);
  });
});

describe('topes: identificación y selector', () => {
  const inventario: CadenaInsumo[] = [
    { cod: 'TOP05', nemotecnico: 'TOPES NEGROS - ROLZZO', color: '' },
    { cod: 'TOP01', nemotecnico: 'TOPES /F-22 BLANCOS', color: 'BLANCO' },
    { cod: 'CAD06', nemotecnico: 'CADENA 3 METROS BLANCA', color: 'BLANCO' },
  ];

  it('reconoce los códigos TOP y no confunde a la cadena', () => {
    expect(esTopeCadena('TOP05')).toBe(true);
    expect(esTopeCadena('TOP 05')).toBe(true);
    expect(esTopeCadena('CAD06')).toBe(false);
    expect(esTopeCadena('TOPE')).toBe(false);
  });

  it('el selector ofrece los topes en su orden, sin la cadena', () => {
    expect(topesSeleccionables(inventario).map((i) => i.cod)).toEqual(['TOP01', 'TOP05']);
    expect(esTopeSeleccionable('TOP02')).toBe(false); // agotado: no se ofrece
  });

  it('el texto del inventario prefiere el nemotécnico del stock', () => {
    expect(textoTopeInventario('TOP05', inventario)).toBe('TOPES NEGROS - ROLZZO');
    // Sin catálogo cargado cae a la etiqueta conocida, nunca al código pelado.
    expect(textoTopeInventario('TOP06')).toBe('TOPES METALICOS - ROLZZO');
    expect(textoTopeInventario('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────
// CADENA METÁLICA (CAD13): el rollo que el taller corta a medida. No entra en
// la selección automática por largo + color; la manda el botón de Fase 1.
// ─────────────────────────────────────────────────────────────────────
describe('cadena metálica', () => {
  const CON_METALICA: CadenaInsumo[] = [
    ...INV_AUTO,
    { cod: 'CAD13', nemotecnico: 'CADENA ROLLO METALICA', color: 'METAL', status: 'AGOTADO' },
  ];

  it('reconoce el código con y sin espacio, y no confunde a las plásticas', () => {
    expect(esCadenaMetalica('CAD13')).toBe(true);
    expect(esCadenaMetalica('CAD 13')).toBe(true);
    expect(esCadenaMetalica('cad13')).toBe(true);
    expect(esCadenaMetalica('CAD03')).toBe(false);
    expect(esCadenaMetalica('')).toBe(false);
    expect(esCadenaMetalica(undefined)).toBe(false);
  });

  it('el flag manda, pero un CAD13 elegido a mano también cuenta', () => {
    expect(llevaCadenaMetalica({ cadenaMetalica: true })).toBe(true);
    expect(llevaCadenaMetalica({ codCadena: 'CAD13' })).toBe(true);
    expect(llevaCadenaMetalica({ cadenaMetalica: false, codCadena: 'CAD06' })).toBe(false);
    expect(llevaCadenaMetalica({})).toBe(false);
    expect(llevaCadenaMetalica(null)).toBe(false);
  });

  it('se corta a 2 × el alto (la cadena hace un lazo)', () => {
    expect(metrosCadenaMetalica(2.3)).toBe(4.6);
    expect(metrosCadenaMetalica(1.75)).toBe(3.5);
    expect(metrosCadenaMetalica(0)).toBe(0);
    // Con otro factor (si el dueño lo cambia en Admin) sigue la misma cuenta.
    expect(metrosCadenaMetalica(2, 3)).toBe(6);
  });

  it('se ofrece en el selector AUNQUE esté agotada (su stock son rollos)', () => {
    const cods = cadenasRoller(CON_METALICA).map((c) => c.cod);
    expect(cods).toContain('CAD13');
    // La agotada plástica sigue escondida: ahí el «agotado» sí significa algo.
    expect(cods).not.toContain('CAD18');
  });

  it('se puede esconder declarándola oculta en el catálogo técnico', () => {
    const reglas: ReglasCadena = {
      ...REGLAS_CADENA,
      cadenas: [{ codigo: 'CAD13', largo: 'ROLLO', color: 'MET', estado: 'oculto' }],
    };
    expect(cadenasRoller(CON_METALICA, {}, reglas).map((c) => c.cod)).not.toContain('CAD13');
  });

  it('la cadena de un paño: la metálica manda sobre la automática por alto', () => {
    const conFlag = codCadenaDelPano({ cadenaMetalica: true }, 2.3, 'NEG', 'ROL', CON_METALICA);
    expect(conFlag).toBe('CAD13');
    // Sin flag, la de siempre: 2,3 m de alto → la de 4 m del color que toca.
    expect(codCadenaDelPano({}, 2.3, 'NEG', 'ROL', CON_METALICA)).toBe('CAD03');
    // Y nunca sale sola: el color METAL no tiene cadena automática.
    expect(codCadenaAutoPorAlto(2.3, 'MET', 'ROL', CON_METALICA)).toBeNull();
  });

  it('los tres campos del paño y el texto del taller', () => {
    expect(patchCadenaMetalica()).toEqual({
      codCadena: 'CAD13',
      largoCadena: 'ROLLO',
      colorCadena: 'MET',
    });
    expect(textoCadenaMetalica(2.3)).toBe('METÁLICA 4,6 M');
    expect(textoCadenaMetalica(0)).toBe('METÁLICA');
  });

  it('en la hoja de inventario se describe con sus metros, no con un largo', () => {
    expect(descripcionCadenaInventario({ codCadena: 'CAD13' }, 4.6)).toBe(
      '[CAD13] CADENA METÁLICA 4,6 M',
    );
    // Sin metros (una OT vieja) no se inventa un número.
    expect(descripcionCadenaInventario({ codCadena: 'CAD13' })).toBe('[CAD13] CADENA METÁLICA');
  });
});
