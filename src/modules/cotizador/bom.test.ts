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

  it('con motor: NO agrega cadena ni peso, pero sí motor', () => {
    const bom = calcularBOM([
      row({
        motorTipo: 'Somfy WireFree',
        ladoMotor: 'izq',
        largoCadena: '1.5',
        colorMecanismo: 'Cromado',
      }),
    ]);
    expect(bom.find((i) => i.descripcion === 'Cadena')).toBeUndefined();
    expect(bom.find((i) => i.descripcion === 'Peso de cadena')).toBeUndefined();
    const motor = bom.find((i) => i.categoria === 'MOTOR' && i.descripcion === 'Motor');
    expect(motor).toBeDefined();
    expect(motor?.especificacion).toContain('Somfy');
    expect(motor?.especificacion).toContain('Lado izq');
    expect(motor?.color).toBe('Cromado');
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

  it('manillas: acumula cantidad, no cantidad de rows', () => {
    const bom = calcularBOM([
      row({ manillaCant: 3, manillaColor: 'Blanco' }),
      row({ manillaCant: 2, manillaColor: 'Blanco' }),
    ]);
    const manilla = bom.find((i) => i.categoria === 'MANILLA');
    expect(manilla?.cantidad).toBe(5);
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

  it('motor DOM41 + domótica: kit DOM por cortina + 1 solo DOM43 por OT', () => {
    const bom = calcularBOM(
      [
        row({ motorModelo: 'DOM41', motorDomotica: true }),
        row({ motorModelo: 'DOM41', motorDomotica: true }),
      ],
      vent('ROL', 'BCO'),
    );
    expect(bom.find((i) => i.especificacion === 'DOM41')?.cantidad).toBe(2);
    const dom43 = bom.filter((i) => i.especificacion === 'DOM43');
    expect(dom43).toHaveLength(1);
    expect(dom43[0].cantidad).toBe(1);
    // Motor reemplaza la cadena.
    expect(bom.find((i) => i.categoria === 'CADENA')).toBeUndefined();
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
