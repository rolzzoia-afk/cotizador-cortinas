import { describe, expect, it } from 'vitest';
import { panosDibujados, panosFisicos, type PanoDibujado } from './layoutPano';
import { PARAMETROS_CORTE_DEFAULT } from './parametrosCorte';
import type { OptimizerRow } from './tela';

const fila = (
  ubicacion: string,
  junto: string,
  numeroPano: number,
  ancho: number,
  altoCorte: number,
  extra: Partial<OptimizerRow> = {},
): OptimizerRow =>
  ({
    codInt: 'SC 65',
    producto: 'ROLLER SCREEN PREMIUM',
    ubicacion,
    junto,
    numeroPano,
    ancho,
    altoCorte,
    altoReal: altoCorte,
    anchoRollo: 2.98,
    ...extra,
  }) as unknown as OptimizerRow;

describe('panosDibujados', () => {
  it('las cortinas del mismo paño van una al lado de la otra, sin pisarse', () => {
    const panos = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
    ]);
    expect(panos).toHaveLength(1);
    const [p] = panos;
    expect(p.letra).toBe('A');
    expect(p.piezas.map((x) => x.px)).toEqual([0, 137]);
    expect(p.piezas.map((x) => x.pw)).toEqual([137, 129]);
    expect(p.altoPanoCm).toBe(256);
    expect(p.anchoRolloCm).toBe(298);
  });

  it('el alto del paño es el de la cortina MÁS ALTA del tiro', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.2, 2.05),
      fila('DORM', 'A', 1, 1.2, 2.56),
    ]);
    expect(p.altoPanoCm).toBe(256);
  });

  it('cada paño lleva su letra, la misma de la etiqueta y del Dimensionado', () => {
    const panos = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
      fila('LIVING', 'B', 2, 2.5, 2.56),
    ]);
    expect(panos.map((p) => p.letra)).toEqual(['A', 'B']);
    expect(panos.map((p) => p.piezas.length)).toEqual([2, 1]);
  });

  it('la INVERTIDA se dibuja girada: su alto viaja a lo ancho del rollo', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 3.4, 2.2, { pano: { invertida: true } as never }),
    ]);
    expect(p.piezas[0].invertida).toBe(true);
    expect(p.piezas[0].pw).toBe(220); // el alto de corte, a lo ancho
    expect(p.piezas[0].ph).toBe(340); // el ancho de la cortina, a lo largo
  });

  it('trae el orden de los cortes: dos cortinas juntas = un corte', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
    ]);
    expect(p.cortes).toHaveLength(1);
    expect(p.cortes![0].eje).toBe('longitudinal');
    expect(p.cortes![0].posicionCm).toBe(137);
  });

  it('una sola cortina no lleva cortes de separación', () => {
    const [p] = panosDibujados([fila('PPAL', 'A', 1, 1.37, 2.56)]);
    expect(p.cortes).toEqual([]);
  });

  it('las cortinas que salen de colmena no arman tiro de rollo', () => {
    // El trozo real de esas cortinas lo dibuja `panosDeColmena`, con la medida
    // del paño del rack: acá solo quedan los tiros que hay que bajar.
    const panos = panosDibujados(
      [fila('PPAL', 'A', 1, 1.37, 2.56), fila('LIVING', 'B', 2, 1.5, 2.56)],
      PARAMETROS_CORTE_DEFAULT,
      (idx) => idx === 1,
    );
    expect(panos).toHaveLength(1);
    expect(panos[0].piezas.map((p) => p.nombre)).toEqual(['PPAL']);
    expect(panos[0].colmena).toBe('');
  });

  it('el paño MIXTO ya no se pierde: la compañera de rollo sigue dibujada', () => {
    // Dos cortinas en el MISMO paño («cortar junto» A); una sale del rack. Antes
    // el paño entero se daba por de colmena y la otra no se bajaba del rollo.
    const panos = panosDibujados(
      [fila('PPAL', 'A', 1, 1.0, 2.0), fila('LIVING', 'A', 1, 1.2, 2.0)],
      PARAMETROS_CORTE_DEFAULT,
      (idx) => idx === 0,
    );
    expect(panos).toHaveLength(1);
    expect(panos[0].piezas.map((p) => p.nombre)).toEqual(['LIVING']);
  });

  it('en oscuridad manda el ancho de CORTE real, no el nominal', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 2.9, 2.5, { anchoCorteTelaCm: 299.34 }),
    ]);
    expect(p.piezas[0].anchoCm).toBe(299.3);
  });
});

describe('la franja que queda al costado del tiro', () => {
  it('se mide sobre el ancho ÚTIL: descuenta los dos márgenes del rollo', () => {
    // 298 nominal − 2 de márgenes − 137 de la cortina = 159, no 161.
    const [p] = panosDibujados([fila('PPAL', 'A', 1, 1.37, 2.56)]);
    expect(p.sobrante).toEqual({
      anchoCm: 159,
      altoCm: 256,
      clase: 'sobrante',
      funcional: { roller: true, vertical: true },
    });
  });

  it('lo que no alcanza para nada queda marcado como MERMA', () => {
    // 298 − 2 − (137 + 129) = 30 cm: no da ni para una vertical.
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 2.56),
    ]);
    expect(p.sobrante?.anchoCm).toBe(30);
    expect(p.sobrante?.clase).toBe('merma');
    expect(p.sobrante?.funcional).toEqual({ roller: false, vertical: false });
  });

  it('una franja angosta y larga sirve para vertical aunque no para roller', () => {
    // 298 − 2 − (103 + 103) = 90 cm de ancho por 256 de largo.
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.03, 2.56),
      fila('DORM', 'A', 1, 1.03, 2.56),
    ]);
    expect(p.sobrante?.anchoCm).toBe(90);
    expect(p.sobrante?.clase).toBe('sobrante');
    expect(p.sobrante?.funcional).toEqual({ roller: false, vertical: true });
  });

  it('bajo el mínimo manipulable no se anota nada: es recorte de mesa', () => {
    // 298 − 2 − 287 = 9 cm.
    const [p] = panosDibujados([fila('VENTANAL', 'A', 1, 2.87, 2.5)]);
    expect(p.sobrante).toBeNull();
  });

  it('una cortina de colmena no deja franja de rollo: no se bajó ningún tiro', () => {
    const panos = panosDibujados(
      [fila('PPAL', 'A', 1, 1.37, 2.56)],
      PARAMETROS_CORTE_DEFAULT,
      () => true,
    );
    expect(panos).toEqual([]);
  });
});

describe('las verticales se cortan en lamas', () => {
  const piezasVertical = [
    { componente: 'Lamas', columnaExcel: 'LAMAS', medidaCm: 29, cod: '', color: '' },
    { componente: 'Repuesto', columnaExcel: 'REPUESTO', medidaCm: 2, cod: '', color: '' },
    { componente: 'Alto final', columnaExcel: 'ALTO FINAL LAMA', medidaCm: 222, cod: '', color: '' },
  ];

  it('el despiece de la fila trae cuántas lamas salen y qué miden', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 2.4, 2.35, { esVertical: true, piezas: piezasVertical } as never),
    ]);
    expect(p.esVertical).toBe(true);
    expect(p.piezas[0].lamas).toEqual({
      total: 29,
      repuesto: 2,
      anchoLamaCm: 8.9,
      altoFinalCm: 222,
    });
  });

  it('sin despiece (OT que no pasó por Fase 2) no hay números, y no rompe', () => {
    const [p] = panosDibujados([
      fila('VENTANAL', 'A', 1, 2.4, 2.35, { esVertical: true } as never),
    ]);
    expect(p.esVertical).toBe(true);
    expect(p.piezas[0].lamas).toBeNull();
  });

  it('una roller nunca lleva lamas, aunque su despiece traiga piezas', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56, { piezas: piezasVertical } as never),
    ]);
    expect(p.piezas[0].lamas).toBeNull();
  });
});

describe('lo que NO es cortina dentro del tiro', () => {
  it('el hueco bajo una cortina más corta se cuenta como merma', () => {
    // Tiro de 256; la de DORM 2 corta a 180 → deja 129 × 76 debajo.
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 1.8),
    ]);
    expect(p.libres).toContainEqual(
      expect.objectContaining({ x: 137, y: 180, anchoCm: 129, altoCm: 76, clase: 'merma' }),
    );
  });

  it('la franja del costado sale entera y coincide con el chip del sobrante', () => {
    const [p] = panosDibujados([fila('PPAL', 'A', 1, 1.37, 2.56), fila('DORM 2', 'A', 1, 1.29, 1.8)]);
    const franja = p.libres.find((r) => r.x === 266);
    // 298 − 2 de márgenes − 266 usados = 30 de ancho, de arriba abajo.
    expect(franja).toMatchObject({ anchoCm: 30, altoCm: 256 });
    expect(p.sobrante).toMatchObject({ anchoCm: 30, altoCm: 256 });
  });

  it('dos cortinas cortas vecinas dejan UN solo hueco ancho, no dos', () => {
    const [p] = panosDibujados([
      fila('PPAL', 'A', 1, 1.0, 2.56),
      fila('BAÑO 1', 'A', 1, 0.9, 1.5),
      fila('BAÑO 2', 'A', 1, 0.9, 1.5),
    ]);
    const huecos = p.libres.filter((r) => r.y > 0);
    expect(huecos).toHaveLength(1);
    expect(huecos[0]).toMatchObject({ x: 100, y: 150, anchoCm: 180, altoCm: 106 });
  });

  it('un hueco grande sí puede volver al rack como sobrante', () => {
    // La corta deja 140 × 250 debajo: alcanza para roller y para vertical.
    const [p] = panosDibujados([fila('VENTANAL', 'A', 1, 1.5, 5.0), fila('BAÑO', 'A', 1, 1.4, 2.5)]);
    expect(p.libres).toContainEqual(
      expect.objectContaining({
        anchoCm: 140,
        altoCm: 250,
        clase: 'sobrante',
        funcional: { roller: true, vertical: true },
      }),
    );
  });

  it('una cortina de colmena no inventa pérdida de rollo: ya estaba cortada', () => {
    const panos = panosDibujados(
      [fila('PPAL', 'A', 1, 1.37, 2.56)],
      PARAMETROS_CORTE_DEFAULT,
      () => true,
    );
    expect(panos).toEqual([]);
  });
});

describe('panosFisicos — lo que el taller cuenta como paño', () => {
  it('un tiro clásico (cortinas al hilo) es UN paño, aunque tengan altos distintos', () => {
    const panos = panosDibujados([
      fila('PPAL', 'A', 1, 1.37, 2.56),
      fila('DORM 2', 'A', 1, 1.29, 1.8),
      fila('LIVING', 'B', 2, 2.5, 2.56),
    ]);
    expect(panosFisicos(panos)).toBe(2);
  });

  it('una bajada apilada cuenta un paño por cada corte transversal de lado a lado', () => {
    // Tres bandas de ancho completo: PPAL / HIJO / VISITA → 3 paños.
    const bandas: PanoDibujado = {
      ...panosDibujados([fila('PPAL', 'A', 1, 2.75, 3.07)])[0],
      cortes: [
        { n: 1, eje: 'transversal', posicionCm: 307, region: { x: 0, y: 0, w: 298, h: 677 }, deja: ['PPAL', 'HIJO + VISITA'], girar: false },
        { n: 2, eje: 'transversal', posicionCm: 195, region: { x: 0, y: 307, w: 298, h: 370 }, deja: ['HIJO', 'VISITA'], girar: false },
      ],
    };
    expect(panosFisicos([bandas])).toBe(3);
  });

  it('un transversal DENTRO de una columna no baja un paño', () => {
    // VENTANAL + columna con BAÑO sobre COCINA: un solo trozo del rollo.
    const columna: PanoDibujado = {
      ...panosDibujados([fila('VENTANAL', 'A', 1, 1.84, 2.85)])[0],
      cortes: [
        { n: 1, eje: 'longitudinal', posicionCm: 184, region: { x: 0, y: 0, w: 298, h: 285 }, deja: ['VENTANAL', 'BAÑO + COCINA'], girar: false },
        { n: 2, eje: 'transversal', posicionCm: 125, region: { x: 184, y: 0, w: 114, h: 285 }, deja: ['BAÑO', 'COCINA'], girar: true },
      ],
    };
    expect(panosFisicos([columna])).toBe(1);
  });

  it('un paño del RACK no cuenta: ya está cortado y el rollo no se toca', () => {
    const [rollo] = panosDibujados([fila('PPAL', 'A', 1, 1.37, 2.56)]);
    const delRack: PanoDibujado = { ...rollo, letra: 'C1', colmena: 'MAPA M2-31 · 300X250' };
    expect(panosFisicos([rollo, delRack])).toBe(1);
  });

  it('sin dibujos no hay paños', () => {
    expect(panosFisicos([])).toBe(0);
  });
});
