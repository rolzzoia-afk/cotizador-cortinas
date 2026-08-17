import { describe, it, expect } from 'vitest';
import { calcularBOM, bomToOrdenMaterialesRows } from './bom';
import type { OptimizerRow } from './tela';
import type { Pano } from './types';

// ── Helpers ────────────────────────────────────────────────────────
function row(pano: Partial<Pano> = {}, opts: Partial<OptimizerRow> = {}): OptimizerRow {
  return {
    rowIdx: 1,
    cod: 'SC',
    cant: 1,
    producto: 'Roller SC',
    codInt: 'SC001',
    tipo: '',
    ancho: 1.5,
    alto: 2.0,
    anchoCm: 150,
    altoCm: 200,
    extra: 0.25,
    altoExtra: 2.25,
    altoReal: 2.25,
    altoCorte: 2.25,
    isDuo: false,
    m2: 3.375,
    anchoRollo: 2.98,
    anchoPano: 1.5,
    numeroPano: 1,
    junto: '',
    ubicacion: 'Living',
    ventanaId: 1,
    panoIndex: 0,
    pano: {
      ancho: 1.5,
      alto: 2.0,
      color: 'Blanco',
      ...pano,
    } as Pano,
    ...opts,
  };
}

// ── calcularBOM ────────────────────────────────────────────────────
describe('calcularBOM', () => {
  it('retorna [] para lista vacía', () => {
    expect(calcularBOM([])).toEqual([]);
  });

  it('acumula un tubo por cada row sin agrupar si tienen largos distintos', () => {
    const bom = calcularBOM([row({}, { anchoCm: 150 }), row({}, { anchoCm: 200 })]);
    const tubos = bom.filter((i) => i.categoria === 'TUBERÍA');
    expect(tubos).toHaveLength(2);
    expect(tubos[0].cantidad).toBe(1);
    expect(tubos[1].cantidad).toBe(1);
  });

  it('VERTICAL no emite tubería ni mecanismo (su estructura no es de bodega roller)', () => {
    const ventanas = [{ id: 1, categoria: 'VERTICAL', panos: [{ ancho: 1.5, alto: 1.8 }] }];
    const bom = calcularBOM([row()], ventanas as Parameters<typeof calcularBOM>[1]);
    expect(bom.filter((i) => i.categoria === 'TUBERÍA')).toHaveLength(0);
    expect(bom.filter((i) => i.categoria === 'MECANISMO')).toHaveLength(0);
  });

  it('VERTICAL con modelo emite los VER bajo INSUMO (carritos, cordón CALCULAR, bracket)', () => {
    const ventanas = [{
      id: 1,
      categoria: 'VERTICAL',
      color: 'Blanco',
      modelo: { sistema: 'VERTICAL', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 },
      panos: [{ ancho: 1.5, alto: 1.8, color: 'Blanco' }],
    }];
    const bom = calcularBOM([row({ color: 'Blanco' })], ventanas as Parameters<typeof calcularBOM>[1]);
    const ins = bom.filter((i) => i.categoria === 'INSUMO');
    const spec = Object.fromEntries(ins.map((i) => [i.especificacion, i]));
    // carritos ancho 1,5 → perfil 148,2 · varilla 146,5 · floor(/8) = 18, + 1 = 19.
    expect(spec.VER40?.cantidad).toBe(19); // carrito
    expect(spec.VER41?.cantidad).toBe(19); // peso lama
    expect(spec.VER45?.cantidad).toBe(19); // sujetador blanco
    expect(spec.VER37?.cantidad).toBe(1); // peso cordón
    expect(spec.VER50?.cantidad).toBe(1); // kit
    expect(spec.VER52?.cantidad).toBe(1); // peso cadena blanco
    expect(spec.VER38?.cantidad).toBe(3); // bracket = cantidadBrackets(1,5)
    // Cordón y cadena inferior → "CALCULAR" (cantidad 0).
    expect(spec.VER43?.unidad).toBe('CALCULAR');
    expect(spec.VER43?.cantidad).toBe(0);
    expect(spec.VER39?.unidad).toBe('CALCULAR');
    // Regresión: sigue sin tubería/mecanismo.
    expect(bom.filter((i) => i.categoria === 'TUBERÍA')).toHaveLength(0);
    expect(bom.filter((i) => i.categoria === 'MECANISMO')).toHaveLength(0);
  });

  // Regla del usuario 2026-08-03: la vertical SÍ lleva cadena de roller, pero
  // siempre la de 3 m y con el color de los accesorios. Y NO lleva el "Peso de
  // cadena" del roller: su peso es el VER52/VER64 del kit.
  it('VERTICAL: cadena de 3 m por color (CAD06 blanca) y NINGÚN peso de cadena de roller', () => {
    const ventanas = [{
      id: 1,
      categoria: 'VERTICAL',
      color: 'Blanco',
      modelo: { sistema: 'VERTICAL', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 },
      panos: [{ ancho: 1.5, alto: 1.8, color: 'Blanco' }],
    }];
    // El paño trae colorPeso/colorCadena (los rellena fase0-sync a TODOS) y
    // hasta un codCadena stale de cuando la ventana era ROL: se ignoran.
    const bom = calcularBOM(
      [row({ color: 'Blanco', colorPeso: 'BCO', colorCadena: 'BCO', codCadena: 'CAD16', largoCadena: '2.4mts' })],
      ventanas as Parameters<typeof calcularBOM>[1],
    );
    const cadenas = bom.filter((i) => i.categoria === 'CADENA');
    expect(cadenas).toHaveLength(1);
    expect(cadenas[0].descripcion).toBe('Cadena');
    expect(cadenas[0].especificacion).toBe('CAD06');
    expect(cadenas[0].color).toBe('BCO');
    expect(cadenas[0].cantidad).toBe(1);
    // El "Peso de cadena · BCO" sin código ya no existe (duplicaba al VER52).
    expect(bom.some((i) => i.descripcion === 'Peso de cadena')).toBe(false);
    expect(bom.some((i) => i.especificacion === 'CAD16')).toBe(false);
  });

  it('VERTICAL negra: la cadena de 3 m es CAD04', () => {
    const ventanas = [{
      id: 1,
      categoria: 'VERTICAL',
      color: 'NEGRO',
      modelo: { sistema: 'VERTICAL', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 },
      panos: [{ ancho: 1.5, alto: 1.8, color: 'NEGRO' }],
    }];
    const bom = calcularBOM([row({ color: 'NEGRO' })], ventanas as Parameters<typeof calcularBOM>[1]);
    const cadenas = bom.filter((i) => i.categoria === 'CADENA');
    expect(cadenas).toHaveLength(1);
    expect(cadenas[0].especificacion).toBe('CAD04');
    expect(cadenas[0].color).toBe('NEG');
  });

  it('BEEBLACK: sin cadena ni peso de cadena aunque el paño traiga los colores', () => {
    const ventanas = [{
      id: 1,
      categoria: 'BEEBLACK',
      color: 'Blanco',
      panos: [{ ancho: 1.5, alto: 1.8, color: 'Blanco' }],
    }];
    const bom = calcularBOM(
      [row({ color: 'Blanco', colorPeso: 'BCO', colorCadena: 'BCO' })],
      ventanas as Parameters<typeof calcularBOM>[1],
    );
    expect(bom.filter((i) => i.categoria === 'CADENA')).toHaveLength(0);
  });

  it('VERTICAL negro: peso cordón + peso cadena son VER64 → una línea consolidada ×2', () => {
    const ventanas = [{
      id: 1,
      categoria: 'VERTICAL',
      color: 'NEGRO',
      modelo: { sistema: 'VERTICAL', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 },
      panos: [{ ancho: 1.5, alto: 1.8, color: 'NEGRO' }],
    }];
    const bom = calcularBOM([row({ color: 'NEGRO' })], ventanas as Parameters<typeof calcularBOM>[1]);
    const ins = bom.filter((i) => i.categoria === 'INSUMO');
    const ver64 = ins.filter((i) => i.especificacion === 'VER64');
    expect(ver64).toHaveLength(1); // consolidado, no dos líneas
    expect(ver64[0].cantidad).toBe(2); // peso cordón (1) + peso cadena (1)
    // En negro ya no hay VER37 (el peso del cordón pasó a VER64).
    expect(ins.some((i) => i.especificacion === 'VER37')).toBe(false);
  });

  // El DARK sobre tubería 0,45 usa el kit COMPLETO de 45; el inventario emite la
  // misma línea (antes decía MEC 32 acá y tapas+pivotes allá).
  it('DARK 45: el mecanismo es el kit completo MEC 23, no el kit simple de 38', () => {
    const ventanas = [{
      id: 1, categoria: 'DARK_45mm', color: 'NEGRO',
      modelo: { sistema: 'DARK_ROLLER', diametro_tubo_mm: 45, codigos_tubo: 'E78', dcto_tubo_cm: 1.8 },
      panos: [{ ancho: 2.5, alto: 2.3, color: 'NEGRO' }],
    }];
    const bom = calcularBOM([row({ color: 'NEGRO' })], ventanas as Parameters<typeof calcularBOM>[1]);
    const mec = bom.filter((i) => i.categoria === 'MECANISMO');
    expect(mec.map((i) => i.especificacion)).toEqual(['MEC 23']);
  });

  // BEEBLACK: kit SML propio, 1 por CORTINA. El BOM debe decir lo mismo que la
  // hoja de inventario (antes ninguno de los dos lo emitía).
  it('BEEBLACK: emite su kit SML una vez por cortina, con CALCULAR en la tira y la felpa', () => {
    const ventanas = [{
      id: 1, categoria: 'BEEBLACK', color: 'NEGRO', modelo: null,
      panos: [{ ancho: 2, alto: 1.3, color: 'NEGRO' }],
    }];
    const bom = calcularBOM([row({ color: 'NEGRO' })], ventanas as Parameters<typeof calcularBOM>[1]);
    const spec = Object.fromEntries(
      bom.filter((i) => (i.especificacion || '').startsWith('SML')).map((i) => [i.especificacion, i]),
    );
    expect(spec.SML46?.cantidad).toBe(2);
    expect(spec.SML17?.cantidad).toBe(4);
    expect(spec.SML26?.cantidad).toBe(2);
    expect(spec.SML35?.cantidad).toBe(4);
    expect(spec.SML48?.cantidad).toBe(4);
    expect(spec.SML33?.unidad).toBe('CALCULAR');
    expect(spec.SML33?.cantidad).toBe(0);
    expect(spec.SML34?.unidad).toBe('CALCULAR');
  });

  it('BEEBLACK doble: el 2º paño no repite el kit y las cantidades ya vienen ×2', () => {
    const ventanas = [{
      id: 1, categoria: 'BEEBLACK', color: 'BLANCO', modelo: null,
      panos: [{ ancho: 2, alto: 1.3, color: 'BLANCO', dual: true }, { ancho: 2, alto: 1.3, color: 'BLANCO', dual: true }],
    }];
    const bom = calcularBOM(
      [
        row({ color: 'BLANCO', dual: true }, { panoIndex: 0 }),
        row({ color: 'BLANCO', dual: true }, { panoIndex: 1 }),
      ],
      ventanas as Parameters<typeof calcularBOM>[1],
    );
    const spec = Object.fromEntries(
      bom.filter((i) => (i.especificacion || '').startsWith('SML')).map((i) => [i.especificacion, i]),
    );
    expect(spec.SML45?.cantidad).toBe(4); // ×2 (una por tela)
    expect(spec.SML16?.cantidad).toBe(4); // esquineros: una sola estructura
    expect(spec.SML47?.cantidad).toBe(4); // sus tapas, tampoco doblan
  });

  it('agrupa tubos con mismo largo + spec + color', () => {
    const bom = calcularBOM([row({ color: 'Blanco' }), row({ color: 'Blanco' })]);
    const tubos = bom.filter((i) => i.categoria === 'TUBERÍA');
    expect(tubos).toHaveLength(1);
    expect(tubos[0].cantidad).toBe(2);
  });

  it('calcula largo del tubo como (anchoCm − 3.8) / 100 con 2 decimales', () => {
    const bom = calcularBOM([row({}, { anchoCm: 150 })]);
    const tubo = bom.find((i) => i.categoria === 'TUBERÍA');
    expect(tubo?.especificacion).toContain('1.46m');
  });

  it('tubo toma color de mecanismo si existe (no del paño)', () => {
    const bom = calcularBOM([
      row({ color: 'Blanco', colorMecanismo: 'Cromado' }),
    ]);
    const tubo = bom.find((i) => i.categoria === 'TUBERÍA');
    expect(tubo?.color).toBe('Cromado');
  });

  it('agrega mecanismo cuando tiene spec [X]', () => {
    const bom = calcularBOM([
      row({ mecanismo: 'Mecanismo 38mm [M38]', colorMecanismo: 'Cromado' }),
    ]);
    const mec = bom.find((i) => i.categoria === 'MECANISMO' && i.descripcion === 'Mecanismo');
    expect(mec).toBeDefined();
    expect(mec?.especificacion).toBe('M38');
    expect(mec?.color).toBe('Cromado');
    expect(mec?.cantidad).toBe(1);
  });

  it('6 paños sin mecanismo guardado pero ROL+BCO → 6× MEC 33', () => {
    const ventana = {
      id: 'v1',
      categoria: 'ROL',
      color: 'Blanco',
      panos: [{ ancho: 1.5, colorPeso: 'BCO' }],
    };
    const rows = Array.from({ length: 6 }, (_, i) =>
      row(
        { mecanismo: '', colorPeso: 'BCO' },
        { ventanaId: 'v1', rowIdx: i + 1, anchoCm: 150 },
      ),
    );
    const bom = calcularBOM(rows, [ventana as never]);
    const mec33 = bom.find(
      (i) => i.categoria === 'MECANISMO' && i.especificacion === 'MEC 33',
    );
    expect(mec33?.cantidad).toBe(6);
  });

  it('roller manual cenefa ovalada 38 BCO → MEC 39 en COMPONENTES (no kit simple 33)', () => {
    const ventana = {
      id: 'v1',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      color: 'Blanco',
      panos: [{ ancho: 2.65, colorPeso: 'BCO' }],
    };
    const rows = [
      row(
        { mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]', colorPeso: 'BCO' },
        { ventanaId: 'v1', rowIdx: 1, anchoCm: 265 },
      ),
    ];
    const bom = calcularBOM(rows, [ventana as never]);
    const mec39 = bom.find(
      (i) => i.categoria === 'MECANISMO' && i.especificacion === 'MEC 39',
    );
    expect(mec39?.cantidad).toBe(1);
    expect(
      bom.find((i) => i.categoria === 'MECANISMO' && i.especificacion === 'MEC 33'),
    ).toBeUndefined();
  });

  it('dúo manual 38 BCO → MEC 39 en COMPONENTES (no kit simple 33)', () => {
    const ventana = {
      id: 'v1',
      categoria: 'DUO_MANUAL_38mm',
      color: 'Blanco',
      panos: [{ ancho: 1.66, colorPeso: 'BCO' }],
    };
    const rows = Array.from({ length: 4 }, (_, i) =>
      row(
        { mecanismo: '', colorPeso: 'BCO' },
        { ventanaId: 'v1', rowIdx: i + 1, anchoCm: 166 },
      ),
    );
    const bom = calcularBOM(rows, [ventana as never]);
    const mec39 = bom.find(
      (i) => i.categoria === 'MECANISMO' && i.especificacion === 'MEC 39',
    );
    expect(mec39?.cantidad).toBe(4);
    expect(
      bom.find((i) => i.categoria === 'MECANISMO' && i.especificacion === 'MEC 33'),
    ).toBeUndefined();
  });

  it('sin motor: agrega cadena + peso', () => {
    const bom = calcularBOM([
      row({ largoCadena: '1.5', colorCadena: 'Blanco', colorPeso: 'Blanco' }),
    ]);
    const cadena = bom.find((i) => i.descripcion === 'Cadena');
    const peso = bom.find((i) => i.descripcion === 'Peso de cadena');
    expect(cadena?.cantidad).toBe(1);
    expect(cadena?.especificacion).toBe('1.5');
    expect(peso?.cantidad).toBe(1);
  });

  it('con codCadena: la especificación lleva el código del inventario (CAD01)', () => {
    const bom = calcularBOM([
      row({ codCadena: 'CAD01', largoCadena: '3mts', colorCadena: 'GRS' }),
    ]);
    const cadena = bom.find((i) => i.descripcion === 'Cadena');
    expect(cadena?.especificacion).toBe('CAD01');
  });

  it('con motor en categoría MANUAL: agrega cadena + peso Y el motor (van dentro del precio)', () => {
    const bom = calcularBOM([
      row({
        motorTipo: 'Somfy WireFree',
        ladoMotor: 'izq',
        largoCadena: '1.5',
        colorCadena: 'Blanco',
        colorPeso: 'Blanco',
        colorMecanismo: 'Cromado',
      }),
    ]);
    // Cadena + peso se emiten aunque el paño lleve motor.
    expect(bom.find((i) => i.descripcion === 'Cadena')?.especificacion).toBe('1.5');
    expect(bom.find((i) => i.descripcion === 'Peso de cadena')).toBeDefined();
    // Y además el motor.
    const motor = bom.find((i) => i.categoria === 'MOTOR' && i.descripcion === 'Motor');
    expect(motor).toBeDefined();
    expect(motor?.especificacion).toContain('Somfy');
    expect(motor?.especificacion).toContain('Lado izq');
    expect(motor?.color).toBe('Cromado');
  });

  it('categoría vendida como motor (…_MOTOR_…): NO agrega cadena ni peso, pero sí motor', () => {
    const ventanas = [{ id: 1, categoria: 'ROL_CENEFA_OVALADA_MOTOR_GRANDE', panos: [{ ancho: 1.5, alto: 2.0 }] }];
    const bom = calcularBOM(
      [row({ motorTipo: 'Somfy', largoCadena: '1.5', colorPeso: 'Blanco' })],
      ventanas as Parameters<typeof calcularBOM>[1],
    );
    expect(bom.find((i) => i.descripcion === 'Cadena')).toBeUndefined();
    expect(bom.find((i) => i.descripcion === 'Peso de cadena')).toBeUndefined();
    expect(bom.find((i) => i.categoria === 'MOTOR')).toBeDefined();
  });

  it('motor con control adicional + hub: agrega esos items', () => {
    const bom = calcularBOM([
      row({ motorTipo: 'Somfy', motorControlAdic: true, motorHubUsb: true }),
    ]);
    expect(bom.find((i) => i.descripcion === 'Control adicional motor')).toBeDefined();
    expect(bom.find((i) => i.descripcion === 'Hub USB motor')).toBeDefined();
  });

  it('dual: agrega Mecanismo Dual', () => {
    const bom = calcularBOM([
      row({ dual: true, mecanismo: 'M [M38]', colorMecanismo: 'Cromado' }),
    ]);
    const dual = bom.find((i) => i.descripcion === 'Mecanismo Dual');
    expect(dual).toBeDefined();
    expect(dual?.cantidad).toBe(1);
  });

  it('manillas: acumula cantidad, no cantidad de rows; código HER + descripción por color', () => {
    const bom = calcularBOM([
      row({ manillaCant: 3, manillaColor: 'Blanco' }),
      row({ manillaCant: 2, manillaColor: 'Blanco' }),
    ]);
    const manilla = bom.find((i) => i.categoria === 'MANILLA');
    expect(manilla?.cantidad).toBe(5);
    expect(manilla?.especificacion).toBe('HER48');
    expect(manilla?.descripcion).toBe('MANILLA PLANA BLANCA');
  });

  it('manillas: cant 0 no se agrega', () => {
    const bom = calcularBOM([row({ manillaCant: 0 })]);
    expect(bom.find((i) => i.categoria === 'MANILLA')).toBeUndefined();
  });

  it('cenefa "No" o ausente: no agrega', () => {
    const bom1 = calcularBOM([row({ cenefa: 'No' })]);
    const bom2 = calcularBOM([row({})]);
    expect(bom1.find((i) => i.categoria === 'CENEFA')).toBeUndefined();
    expect(bom2.find((i) => i.categoria === 'CENEFA')).toBeUndefined();
  });

  it('cenefa con tapas: cuenta 1 tapa para CON_1_TAPA, 2 para CON_2_TAPAS', () => {
    const bom1 = calcularBOM([
      row({ cenefa: 'U', cenefaTapa: 'CON_1_TAPA', colorTapa: 'Blanco' }),
    ]);
    const bom2 = calcularBOM([
      row({ cenefa: 'U', cenefaTapa: 'CON_2_TAPAS', colorTapa: 'Blanco' }),
    ]);
    expect(bom1.find((i) => i.descripcion === 'Tapa de cenefa')?.cantidad).toBe(1);
    expect(bom2.find((i) => i.descripcion === 'Tapa de cenefa')?.cantidad).toBe(2);
  });

  it('orden final: TUBERÍA primero, luego MECANISMO, luego MOTOR, etc.', () => {
    const bom = calcularBOM([
      row({
        manillaCant: 1,
        manillaColor: 'x',
        mecanismo: 'M [M1]',
        cenefa: 'U',
        colorTapa: 'Blanco',
      }),
    ]);
    const cats = bom.map((i) => i.categoria);
    expect(cats.indexOf('TUBERÍA')).toBeLessThan(cats.indexOf('MECANISMO'));
    expect(cats.indexOf('MECANISMO')).toBeLessThan(cats.indexOf('MANILLA'));
    expect(cats.indexOf('MANILLA')).toBeLessThan(cats.indexOf('CENEFA'));
  });

  it('row sin pano usa defaults y no crashea', () => {
    const r = row();
    delete r.pano;
    expect(() => calcularBOM([r])).not.toThrow();
  });
});

// ── Insumos de instalación (categoría INSUMO) ──────────────────────
const vent = (categoria: string, color = 'Blanco') =>
  [{ id: 1, categoria, color }] as unknown as Parameters<typeof calcularBOM>[1];

describe('calcularBOM — insumos de instalación', () => {
  it('roller emite tapas de peso por color + 2 tornillos TOR02, categoría INSUMO tras CENEFA', () => {
    const bom = calcularBOM([row({ color: 'BCO' })], vent('ROL', 'BCO'));
    const ins = bom.filter((i) => i.categoria === 'INSUMO');
    const specs = ins.map((i) => i.especificacion);
    expect(specs).toEqual(['TAP19', 'TAP01', 'TOR02']);
    expect(ins.find((i) => i.especificacion === 'TOR02')?.cantidad).toBe(2);
    // INSUMO va después de todo lo demás salvo OTRO.
    const cats = bom.map((i) => i.categoria);
    expect(cats.lastIndexOf('CENEFA')).toBeLessThan(cats.indexOf('INSUMO'));
  });

  it('cenefa ovalada 1,5 m: 3 brackets BRA01 + tornillos (2 tapas + 6 ovalada = 8)', () => {
    const bom = calcularBOM(
      [row({ color: 'NEG', cenefa: 'Ovalada', bracketTipo: 'CORTO' })],
      vent('ROL_MANUAL_CENEFA_OVALADA_38mm', 'NEG'),
    );
    const ins = bom.filter((i) => i.categoria === 'INSUMO');
    expect(ins.find((i) => i.especificacion === 'BRA01')?.cantidad).toBe(3);
    expect(ins.find((i) => i.especificacion === 'TOR02')?.cantidad).toBe(8);
  });

  it('vulcanita roller sin cenefa → 4 tarugos TAR01', () => {
    const bom = calcularBOM([row({ color: 'BCO', materialTipo: 'VULCANITA' })], vent('ROL', 'BCO'));
    expect(bom.find((i) => i.especificacion === 'TAR01')?.cantidad).toBe(4);
  });

  it('motor DOM41 + domótica sin hub vendido: NO aparecen hub ni router', () => {
    const bom = calcularBOM(
      [
        row({ motorModelo: 'DOM41', motorDomotica: true }),
        row({ motorModelo: 'DOM41', motorDomotica: true }),
      ],
      vent('ROL', 'BCO'),
    );
    expect(bom.find((i) => i.especificacion === 'DOM41')?.cantidad).toBe(2);
    // El control NO es automático: sin pedirlo en Fase 2 no sale.
    expect(bom.find((i) => i.especificacion === 'DOM42')).toBeUndefined();
    // Regla 2026-07-30: el hub y el router salen de lo VENDIDO en Fase 1, ya no
    // "1 por OT" por el solo hecho de que una cortina tenga domótica.
    expect(bom.find((i) => i.especificacion === 'DOM43')).toBeUndefined();
    expect(bom.find((i) => i.especificacion === 'DOM05')).toBeUndefined();
    // Motor reemplaza la cadena.
    expect(bom.find((i) => i.categoria === 'CADENA')).toBeUndefined();
  });

  it('2 hubs vendidos en Fase 1 → 2 DOM43 + 2 DOM05 (router) + 2 DOM33 (adaptador)', () => {
    const bom = calcularBOM(
      [row({ motorModelo: 'DOM38', motorDomotica: true })],
      vent('ROL', 'BCO'),
      false,
      [{ codInt: 'DOM 43', cantidad: 2, descuento: 0, ubicacion: 'DORM' }],
    );
    const cant = (cod: string) => bom.find((i) => i.especificacion === cod)?.cantidad;
    expect(cant('DOM43')).toBe(2);
    expect(cant('DOM05')).toBe(2);
    expect(cant('DOM33')).toBe(2);
    // DOM38 = DOM34: el kit del paño ya puso su cable, no se duplica.
    expect(cant('DOM34')).toBe(1);
  });

  it('mecanismo dual: una sola línea "Mecanismo Dual" con la spec del chip [MEC 01]', () => {
    const bom = calcularBOM(
      [row({ dual: true, mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', colorMecanismo: 'BCO' })],
      vent('ROL_DUAL', 'BCO'),
    );
    const mecs = bom.filter((i) => i.categoria === 'MECANISMO');
    expect(mecs).toHaveLength(1);
    expect(mecs[0].descripcion).toBe('Mecanismo Dual');
    expect(mecs[0].especificacion).toBe('MEC 01');
  });

  it('dual 2 paños misma ventana: UN Mecanismo Dual, 2 cadenas/pesos, 4 tapas, tarugos 1 juego', () => {
    const p = (codInt: string): Partial<Pano> => ({
      dual: true,
      mecanismo: 'DUAL DERECHO BLANCO [MEC 01]',
      colorMecanismo: 'BCO',
      color: 'BCO',
      codCadena: 'CAD03',
      codPeso: 'PCA04',
      colorPeso: 'BCO',
      materialTipo: 'VULCANITA',
      codInt,
    });
    const bom = calcularBOM(
      [
        row(p('SC 68'), { ventanaId: 1, panoIndex: 0, anchoCm: 160 }),
        row(p('BK 69'), { ventanaId: 1, panoIndex: 1, anchoCm: 160 }),
      ],
      vent('ROL_DUAL', 'BCO'),
    );
    // 1 kit de mecanismo dual (no ×2 paños).
    const mecs = bom.filter((i) => i.categoria === 'MECANISMO');
    expect(mecs).toHaveLength(1);
    expect(mecs[0].cantidad).toBe(1);
    // 2 tubos, 2 cadenas, 2 pesos (un juego por paño).
    expect(bom.filter((i) => i.categoria === 'TUBERÍA').reduce((s, t) => s + t.cantidad, 0)).toBe(2);
    expect(bom.find((i) => i.descripcion === 'Cadena')?.cantidad).toBe(2);
    expect(bom.find((i) => i.descripcion === 'Peso de cadena')?.cantidad).toBe(2);
    // Tapas de peso: 4 (2 por paño). Tarugos: 1 juego (solo el paño 0 → 4, no 8).
    const tapas = bom.filter((i) => i.categoria === 'INSUMO' && (i.especificacion || '').startsWith('TAP'));
    expect(tapas.reduce((s, t) => s + t.cantidad, 0)).toBe(4);
    const tarugos = bom.filter((i) => i.categoria === 'INSUMO' && (i.especificacion || '').startsWith('TAR'));
    expect(tarugos.reduce((s, t) => s + t.cantidad, 0)).toBe(4);
  });
});

// ── bomToOrdenMaterialesRows ──────────────────────────────────────
describe('bomToOrdenMaterialesRows', () => {
  it('mapea a shape de orden_materiales con orden + estado pendiente', () => {
    const rows = bomToOrdenMaterialesRows(
      [
        {
          categoria: 'TUBERÍA',
          descripcion: 'Tubo',
          especificacion: '1.46m',
          color: 'Blanco',
          cantidad: 2,
          unidad: 'unid.',
        },
      ],
      'emp-1',
      'ot-1',
    );
    expect(rows).toEqual([
      {
        empresa_id: 'emp-1',
        ot_id: 'ot-1',
        orden: 1,
        categoria: 'TUBERÍA',
        descripcion: 'Tubo',
        especificacion: '1.46m',
        color: 'Blanco',
        cantidad_req: 2,
        unidad: 'unid.',
        cantidad_despachada: 0,
        estado: 'pendiente',
      },
    ]);
  });

  it('orden es correlativo 1..n', () => {
    const rows = bomToOrdenMaterialesRows(
      [
        { categoria: 'A', descripcion: 'a', cantidad: 1, unidad: 'u' },
        { categoria: 'B', descripcion: 'b', cantidad: 1, unidad: 'u' },
        { categoria: 'C', descripcion: 'c', cantidad: 1, unidad: 'u' },
      ],
      'e',
      'o',
    );
    expect(rows.map((r) => r.orden)).toEqual([1, 2, 3]);
  });

  it('especificacion/color vacíos → null en DB', () => {
    const rows = bomToOrdenMaterialesRows(
      [{ categoria: 'A', descripcion: 'a', cantidad: 1, unidad: 'u' }],
      'e',
      'o',
    );
    expect(rows[0].especificacion).toBeNull();
    expect(rows[0].color).toBeNull();
  });
});

describe('calcularBOM — MEC 06 con cadena incorporada (2026-08-14)', () => {
  it('un paño con MEC 06 y cadena guardada NO emite línea de CADENA (el peso sí)', () => {
    const rows = [
      row({
        mecanismo: 'LZ50 BLANCO [MEC 06]',
        codCadena: 'CAD01',
        largoCadena: '1mts',
        colorCadena: 'BCO',
        codPeso: 'PCA01',
        color: 'BCO',
      }),
    ];
    const bom = calcularBOM(rows as never);
    expect(bom.some((b) => b.descripcion === 'Cadena')).toBe(false);
    expect(bom.find((b) => b.descripcion === 'Peso de cadena')?.especificacion).toBe('PCA01');
  });

  it('con otro kit la cadena sale como siempre (regresión)', () => {
    const rows = [
      row({ mecanismo: 'KIT [MEC 33]', codCadena: 'CAD01', codPeso: 'PCA04', color: 'BCO' }),
    ];
    const bom = calcularBOM(rows as never);
    expect(bom.some((b) => b.descripcion === 'Cadena')).toBe(true);
  });
});
