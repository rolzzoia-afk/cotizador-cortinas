import { describe, it, expect } from 'vitest';
import { construirHojaCorte, filasCorteVisibles, type FilaCorteCortina } from './pdfCorteOptimizacion';
import { buildOptimizerRows, asignarJuntoEnOrden, autoOptimizar } from './tela';
import type { PanoColmena } from './planCorte';
import type { CatalogoProductos } from './types';
import type { OT, VentanaItem } from '@/modules/ots/types';

const cat: CatalogoProductos = {
  'BK 18': { cod: 'BK 18', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: '', precio: 0, anchoRollo: 2.98 },
  'SC 64': { cod: 'SC 64', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0, anchoRollo: 2.98 },
  'DU 28': { cod: 'DU 28', producto: 'ROLLER DUO BLACKOUT PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0, anchoRollo: 2.98 },
  // Tela de rollo angosto (2,50) para ejercitar la vertical más ancha que el rollo.
  'SC 02': { cod: 'SC 02', producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 0, anchoRollo: 2.5 },
};

function ot(ventanas: VentanaItem[]): OT {
  return {
    id: 'ot1',
    estado: 'produccion',
    subEtapa: null,
    datosGenerales: { ot: '266-5', cliente: 'Constanza' },
    storeVentanas: ventanas,
    cotizacionCount: 0,
    fechaCreacion: '',
    fechaModificacion: '',
    notas: '',
    totalConIva: 0,
  };
}

describe('construirHojaCorte', () => {
  const ventanas: VentanaItem[] = [
    {
      id: 'v1',
      ubicacion: 'Living',
      codInt: 'BK 18',
      producto: 'ROLLER BLACKOUT DELUX',
      tipo: 'DELUX',
      categoria: 'ROL',
      grupoId: null,
      alto: 1.8,
      precio: 0,
      cantidad: 1,
      panos: [{ ancho: 1.4, alto: 1.8 }],
    },
    {
      id: 'v2',
      ubicacion: 'Comedor',
      codInt: 'SC 64',
      producto: 'ROLLER SCREEN PREMIUM',
      tipo: 'PREMIUM',
      categoria: 'ROL',
      grupoId: null,
      alto: 1.8,
      precio: 0,
      cantidad: 1,
      panos: [{ ancho: 1.45, alto: 1.8 }, { ancho: 1.49, alto: 1.8 }],
    },
  ];

  const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
  const hoja = construirHojaCorte(rows, [], ot(ventanas));

  it('una fila de corte por cortina con medidas en metros', () => {
    expect(hoja.cortinas).toHaveLength(3);
    const bk = hoja.cortinas[0];
    expect(bk.codInt).toBe('BK 18');
    expect(bk.tipo).toBe('DELUX'); // última palabra del producto
    expect(bk.anchoCorteTela).toBe(1.4);
    expect(bk.corteAncho35).toBe(1.365); // ancho − 3,5 cm
    expect(bk.alto).toBe(1.8);
    expect(bk.altoCorteTela).toBe(2.05); // alto + 25 cm
  });

  it('numera el paño según la letra "cortar junto" (las que se cortan juntas comparten n.º)', () => {
    // BK 18 → paño 1 (junto A); las dos SC 64 caben lado a lado → paño 2 (junto B).
    expect(hoja.cortinas.map((c) => c.pano)).toEqual([1, 2, 2]);
    expect(hoja.cortinas.map((c) => c.cortarJunto)).toEqual(['A', 'B', 'B']);
  });

  it('TOTAL PAÑOS = un grupo por letra (aquí todos de rollo, sin colmena)', () => {
    expect(hoja.totalPanos).toBe(2);
    expect(hoja.panos.map((p) => p.pano)).toEqual([1, 2]);
    expect(hoja.panos[0].tipo).toBe('ROLLER BLACKOUT DELUX'); // producto completo
    expect(hoja.panos[1].cod).toBe('SC 64');
    expect(hoja.panos.every((p) => p.colmena === '')).toBe(true); // ninguno de colmena
  });

  it('OPTIMIZADOR = metros de tela por COD_INT (suma de alto de corte de sus paños)', () => {
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['BK 18']).toBe(2.05);
    expect(m['SC 64']).toBe(2.05);
  });

  it('sin colmena, ninguna cortina trae datos de sobrante', () => {
    expect(hoja.cortinas.every((c) => c.medidaColmena === '' && c.ubicColmena === '')).toBe(true);
  });
});

// El OPTIMIZADOR mide los metros a sacar del ROLLO: los paños que salen de
// colmena ya están cortados, así que se descuentan (caso OT 3119: 3 rollers,
// 1 de colmena → 5,85 baja a 3,90).
describe('construirHojaCorte — OPTIMIZADOR descuenta los paños de colmena', () => {
  const mkVent = (id: string, ancho: number): VentanaItem => ({
    id,
    ubicacion: id,
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    categoria: 'ROL',
    grupoId: null,
    alto: 1.8,
    precio: 0,
    cantidad: 1,
    panos: [{ ancho, alto: 1.8 }],
  });
  // 3 rollers del mismo COD_INT, anchos que NO caben lado a lado (1,6 + 1,6 >
  // 2,98) → cada uno su propio paño, como en la OT 3119.
  const ventanas = [mkVent('LIVING-IZQ', 1.6), mkVent('LIVING-CENT', 1.6), mkVent('LIVING-DER', 1.6)];
  const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));

  it('sin colmena: suma los 3 paños (3 × 2,05 = 6,15)', () => {
    const hoja = construirHojaCorte(rows, [], ot(ventanas));
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['SC 64']).toBe(6.15);
  });

  it('con 1 paño de colmena: descuenta ese paño (6,15 − 2,05 = 4,10)', () => {
    // Snapshot pieza→sobrante. La clave es `${otId}_${ventanaId}_p${panoIndex}`;
    // acá la pieza de LIVING-IZQ (paño 0) sale de un sobrante de colmena.
    const snap = {
      'ot1_LIVING-IZQ_p0': { cod: 'MAPA M1-13', ancho: 255, alto: 202, ubic: 'RACK 1' },
    };
    const hoja = construirHojaCorte(rows, [], ot(ventanas), undefined, snap);
    // El paño de colmena (LIVING-IZQ) NO aparece en TOTAL PAÑOS: quedan 2 de rollo.
    expect(hoja.panos).toHaveLength(2);
    expect(hoja.totalPanos).toBe(2);
    expect(hoja.panos.every((p) => p.colmena === '')).toBe(true);
    // Y su metraje se descuenta del OPTIMIZADOR.
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['SC 64']).toBe(4.1);
  });

  it('si TODOS los paños salen de colmena: TOTAL PAÑOS vacío (0) y OPTIMIZADOR en 0', () => {
    const snap = {
      'ot1_LIVING-IZQ_p0': { cod: 'M1', ancho: 255, alto: 202, ubic: '' },
      'ot1_LIVING-CENT_p0': { cod: 'M2', ancho: 255, alto: 202, ubic: '' },
      'ot1_LIVING-DER_p0': { cod: 'M3', ancho: 255, alto: 202, ubic: '' },
    };
    const hoja = construirHojaCorte(rows, [], ot(ventanas), undefined, snap);
    expect(hoja.panos).toHaveLength(0);
    expect(hoja.totalPanos).toBe(0);
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['SC 64']).toBe(0);
  });
});

describe('construirHojaCorte — telas invertidas', () => {
  function ventBK(ancho: number, invertida?: boolean): VentanaItem {
    return {
      id: `v${ancho}`,
      ubicacion: 'Living',
      codInt: 'BK 18',
      producto: 'ROLLER BLACKOUT DELUX',
      tipo: 'DELUX',
      categoria: 'ROL',
      grupoId: null,
      alto: 1.8,
      precio: 0,
      cantidad: 1,
      panos: [{ ancho, alto: 1.8, ...(invertida === undefined ? {} : { invertida }) }],
    };
  }

  it('auto-marca invertida cuando el ancho supera el rollo (+borde) → COMENTARIO y paño propio', () => {
    const ventanas = [ventBK(2.969), ventBK(3.507)]; // ambas > 2,98
    const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
    const hoja = construirHojaCorte(rows, [], ot(ventanas));
    expect(hoja.cortinas.map((c) => c.invertida)).toEqual([true, true]);
    expect(hoja.cortinas.map((c) => c.comentario)).toEqual(['INVERTIDA', 'INVERTIDA']);
    // Cada invertida es su propio paño, con letra (no "RR").
    expect(hoja.cortinas.map((c) => c.cortarJunto)).toEqual(['A', 'B']);
    expect(hoja.totalPanos).toBe(2);
    // En el resumen, ALTO CORTE PAÑO de la invertida = ancho de la cortina.
    expect(hoja.panos.map((p) => p.altoCortePano)).toEqual([2.969, 3.507]);
    expect(hoja.panos.every((p) => p.altoMaxUtilizar === '')).toBe(true);
    // Metros = un paño por cortina × alto de corte (≈2,05), como el manual.
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['BK 18']).toBe(4.1);
  });

  it('override manual: invertida=false en una ancha → "NO CABE" en comentario, letra en CORTAR JUNTO', () => {
    const ventanas = [ventBK(3.507, false)];
    const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
    const hoja = construirHojaCorte(rows, [], ot(ventanas));
    expect(hoja.cortinas[0].invertida).toBe(false);
    expect(hoja.cortinas[0].comentario).toBe('NO CABE');
    // El aviso vive en COMENTARIO; CORTAR JUNTO siempre muestra letra, nunca "RR".
    expect(hoja.cortinas[0].cortarJunto).toBe('A');
  });

  it('override manual: invertida=true en una que sí cabe la fuerza invertida', () => {
    const ventanas = [ventBK(1.4, true)];
    const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
    const hoja = construirHojaCorte(rows, [], ot(ventanas));
    expect(hoja.cortinas[0].invertida).toBe(true);
    expect(hoja.cortinas[0].comentario).toBe('INVERTIDA');
  });
});

// Caso REAL de taller (OT 266-16, new.xlsx): 4 cortinas DÚO "DU 28". La tela
// dúo se corta al DOBLE. Antes la app cortaba a una capa (2,55) → tela corta.
describe('construirHojaCorte — DÚO OT 266-16 (new.xlsx)', () => {
  function ventDuo(id: string, ancho: number, alto: number): VentanaItem {
    return {
      id,
      ubicacion: id,
      codInt: 'DU 28',
      producto: 'ROLLER DUO BLACKOUT PREMIUM',
      tipo: 'PREMIUM',
      categoria: 'ROL',
      grupoId: null,
      alto,
      precio: 0,
      cantidad: 1,
      panos: [{ ancho, alto }],
    };
  }
  // anchos nominales (corte −3,5 = 1,625 / 1,575 / 0,56 / 2,145) y altos reales.
  const ventanas = [
    ventDuo('IZQ', 1.66, 2.3),
    ventDuo('DER', 1.61, 2.3),
    ventDuo('OFI', 0.595, 1.015),
    ventDuo('PPAL', 2.18, 2.3),
  ];
  const rows = autoOptimizar(buildOptimizerRows(ventanas, cat));
  const hoja = construirHojaCorte(rows, [], ot(ventanas));

  it('ALTO CORTE TELA se duplica (2×alto+0,30): tres de 4,9 y una de 2,33', () => {
    const cortes = hoja.cortinas.map((c) => c.altoCorteTela).sort((a, b) => a - b);
    expect(cortes).toEqual([2.33, 4.9, 4.9, 4.9]);
  });

  it('anida cortinas de distinto alto → 3 paños (como el taller)', () => {
    expect(hoja.totalPanos).toBe(3);
    // Cada paño: corte real 4,9 y "alto máximo a utilizar" 5,1 (=2×(alto+0,25)).
    expect(hoja.panos.map((p) => p.altoCortePano)).toEqual([4.9, 4.9, 4.9]);
    expect(hoja.panos.map((p) => p.altoMaxUtilizar)).toEqual([5.1, 5.1, 5.1]);
  });

  it('OPTIMIZADOR DU 28 = 15,3 m (3 paños × 5,1)', () => {
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['DU 28']).toBe(15.3);
  });
});

// Caso dorado: planilla manual "PAÑOS VERTICAL" de la OT 2923 (ROSSANA), tela
// SC 34-V de 2,12 × 2,34 → ANCHO 2,12 (sin −3,5) · ALTO CORTE TELA REAL 2,39
// (alto+5) · ALTO REAL / OPTIMIZADOR 2,59 (alto+25, la reserva del roller).
describe('construirHojaCorte — VERTICAL (OT 2923 ROSSANA)', () => {
  const ventanas: VentanaItem[] = [
    {
      id: 'vv', ubicacion: 'LIVING -G1', codInt: 'SC 64',
      producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', categoria: 'VERTICAL',
      grupoId: null, alto: 2.34, precio: 0, cantidad: 1,
      panos: [{ ancho: 2.12, alto: 2.34 }],
    },
  ];
  const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
  const hoja = construirHojaCorte(rows, [], ot(ventanas));

  it('la tela se corta al ancho REAL y la celda del −3,5 queda vacía', () => {
    const [c] = hoja.cortinas;
    expect(c.anchoCorteTela).toBe(2.12); // ancho real, sin limpieza de borde
    expect(c.corteAncho35).toBe(''); // no aplica a la vertical
    expect(c.alto).toBe(2.34);
    expect(c.altoCorteTela).toBe(2.39); // alto + extraVertical (5 cm)
  });

  it('no se marca INVERTIDA, pero sí se identifica como vertical', () => {
    const [c] = hoja.cortinas;
    expect(c.invertida).toBe(false);
    expect(c.esVertical).toBe(true);
    expect(c.comentario).toBe('VERTICAL');
  });

  it('el paño corta 2,39 y reserva 2,59 (alto+25, igual que el roller)', () => {
    expect(hoja.panos[0].altoCortePano).toBe(2.39);
    expect(hoja.panos[0].altoMaxUtilizar).toBe(2.59);
    expect(hoja.optimizador.find((o) => o.codInt === 'SC 64')?.metros).toBe(2.59);
  });
});

// Vertical MÁS ANCHA que el rollo (SALON 2,80 en un rollo de 2,50): nunca se
// invierte (la tela va en lamas), el aviso dice cuántas pasadas del rollo lleva
// y el paño conserva su alto/reserva de vertical (alto+5 / alto+25).
describe('construirHojaCorte — VERTICAL más ancha que el rollo', () => {
  const ventanas: VentanaItem[] = [
    {
      id: 'salon', ubicacion: 'SALON ANCHO', codInt: 'SC 02',
      producto: 'CORTINA VERTICAL SCREEN PREMIUM', tipo: 'PREMIUM', categoria: 'VERTICAL',
      grupoId: null, alto: 2.4, precio: 0, cantidad: 1,
      panos: [{ ancho: 2.8, alto: 2.4 }],
    },
  ];
  const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
  const hoja = construirHojaCorte(rows, [], ot(ventanas));

  it('NO se marca INVERTIDA ni NO CABE: avisa las pasadas (2,80 / 2,50 → 2 PASADAS)', () => {
    const [c] = hoja.cortinas;
    expect(c.invertida).toBe(false);
    expect(c.esVertical).toBe(true);
    expect(c.comentario).toBe('VERTICAL · 2 PASADAS');
    expect(c.anchoCorteTela).toBe(2.8); // ancho real
    expect(c.corteAncho35).toBe(''); // sin −3,5 en vertical
  });

  it('el paño conserva su alto/reserva de vertical (2,45 / 2,65), no el ancho invertido', () => {
    expect(hoja.panos[0].altoCortePano).toBe(2.45); // alto + 5
    expect(hoja.panos[0].altoMaxUtilizar).toBe(2.65); // alto + 25
  });
});

describe('filasCorteVisibles (tabla de corte solo colmena/invertidas/verticales)', () => {
  const fila = (over: Partial<FilaCorteCortina>): FilaCorteCortina =>
    ({
      cadena: 0, cant: 1, codInt: 'SC 64', tipo: 'PREMIUM',
      anchoCorteTela: 1.5, corteAncho35: 1.465, alto: 2, altoCorteTela: 2.25,
      pano: 1, cortarJunto: 'A', comentario: '', invertida: false, esVertical: false,
      medidaColmena: '', ubicColmena: '', ...over,
    });

  it('muestra solo las filas de colmena, invertidas o verticales', () => {
    const cortinas = [
      fila({ codInt: 'A' }), // rollo normal → oculta
      fila({ codInt: 'B', invertida: true }), // invertida → visible
      fila({ codInt: 'C', medidaColmena: 'SC 64 (178X200)' }), // colmena → visible
      fila({ codInt: 'D' }), // rollo normal → oculta
      fila({ codInt: 'E', esVertical: true }), // vertical (rollo girado) → visible
    ];
    expect(filasCorteVisibles(cortinas).map((f) => f.codInt)).toEqual(['B', 'C', 'E']);
  });

  it('todas normales → lista vacía (el PDF omite la tabla de corte)', () => {
    expect(filasCorteVisibles([fila({}), fila({})])).toEqual([]);
  });
});

// #26: tras "Confirmar corte general" el sobrante queda disponible=false y el
// plan vivo no lo re-asigna; el snapshot persistido mantiene el origen colmena.
describe('construirHojaCorte — snapshot de colmena (#26)', () => {
  const ventCol: VentanaItem = {
    id: 'vcol', ubicacion: 'Living', codInt: 'SC 64', producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM', categoria: 'ROL', grupoId: null, alto: 1.8, precio: 0, cantidad: 1,
    panos: [{ ancho: 1.45, alto: 1.8 }],
  };
  const rows = asignarJuntoEnOrden(buildOptimizerRows([ventCol], cat));
  const otObj = ot([ventCol]);

  it('sin snapshot y sin colmena viva → la fila no es visible', () => {
    expect(filasCorteVisibles(construirHojaCorte(rows, [], otObj).cortinas)).toEqual([]);
  });
  it('con snapshot persistido → fila visible con medida/ubic de colmena', () => {
    const snap = { [`${otObj.id}_vcol_p0`]: { cod: 'SC 64', ancho: 178, alto: 200, ubic: 'RACK1' } };
    const vis = filasCorteVisibles(construirHojaCorte(rows, [], otObj, undefined, snap).cortinas);
    expect(vis).toHaveLength(1);
    expect(vis[0].medidaColmena).toBe('SC 64 (178X200)');
    expect(vis[0].ubicColmena).toBe('RACK1');
  });
});

// La cortina sale ENTERA de colmena (sobrante). Ya está cortada, así que NO va a
// la tabla TOTAL PAÑOS (no se corta del rollo); sí aparece en la tabla de corte
// de arriba con su columna COLMENA. Su COD se lista en el OPTIMIZADOR con 0.
describe('construirHojaCorte — paño de colmena NO va a TOTAL PAÑOS (OT 267-14)', () => {
  const ventCol: VentanaItem = {
    id: 'vcol', ubicacion: 'Living', codInt: 'SC 64', producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM', categoria: 'ROL', grupoId: null, alto: 1.8, precio: 0, cantidad: 1,
    panos: [{ ancho: 1.45, alto: 1.8 }],
  };
  const rows = asignarJuntoEnOrden(buildOptimizerRows([ventCol], cat));
  const otObj = ot([ventCol]);
  // Sobrante que calza por Regla 2 (alto 210 ∈ [205, 235]; ancho 178 ≥ 145).
  const colmena: PanoColmena[] = [
    { _docId: 's1', cod: 'SC 64', ancho: 178, alto: 210, ubicacion: 'A-27', tipo: 'SOBRANTE', creadoEn: '' },
  ];
  const hoja = construirHojaCorte(rows, colmena, otObj);

  it('la cortina de colmena NO aparece en TOTAL PAÑOS (se corta de sobrante, no del rollo)', () => {
    expect(hoja.totalPanos).toBe(0);
    expect(hoja.panos).toHaveLength(0);
  });

  it('pero sí sale en la tabla de corte, con su medida y ubicación de colmena', () => {
    expect(hoja.cortinas[0].medidaColmena).toBe('SC 64 (178X210)');
    expect(hoja.cortinas[0].ubicColmena).toBe('A-27');
  });

  it('OPTIMIZADOR lista el COD aunque su paño sea de colmena, pero con 0 metros (descontado del rollo)', () => {
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    // Único paño y sale de colmena → 0 metros de rollo, pero la fila igual aparece.
    expect(m['SC 64']).toBe(0);
  });
});
