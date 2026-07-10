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

  it('override manual: invertida=false en una ancha la marca "NO CABE"', () => {
    const ventanas = [ventBK(3.507, false)];
    const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas, cat));
    const hoja = construirHojaCorte(rows, [], ot(ventanas));
    expect(hoja.cortinas[0].invertida).toBe(false);
    expect(hoja.cortinas[0].comentario).toBe('NO CABE');
    expect(hoja.cortinas[0].cortarJunto).toBe('RR');
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

describe('filasCorteVisibles (tabla de corte solo colmena/invertidas)', () => {
  const fila = (over: Partial<FilaCorteCortina>): FilaCorteCortina =>
    ({
      cadena: 0, cant: 1, codInt: 'SC 64', tipo: 'PREMIUM',
      anchoCorteTela: 1.5, corteAncho35: 1.465, alto: 2, altoCorteTela: 2.25,
      pano: 1, cortarJunto: 'A', comentario: '', invertida: false,
      medidaColmena: '', ubicColmena: '', ...over,
    });

  it('muestra solo las filas de colmena o invertidas', () => {
    const cortinas = [
      fila({ codInt: 'A' }), // rollo normal → oculta
      fila({ codInt: 'B', invertida: true }), // invertida → visible
      fila({ codInt: 'C', medidaColmena: 'SC 64 (178X200)' }), // colmena → visible
      fila({ codInt: 'D' }), // rollo normal → oculta
    ];
    expect(filasCorteVisibles(cortinas).map((f) => f.codInt)).toEqual(['B', 'C']);
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

// La cortina sale ENTERA de colmena (sobrante). Antes el bloque TOTAL PAÑOS la
// filtraba y quedaba en 0 (OT 267-14). Ahora aparece como paño, marcada en la
// columna COLMENA, y su COD también se lista en el OPTIMIZADOR (no queda vacío).
describe('construirHojaCorte — paño de colmena en TOTAL PAÑOS (OT 267-14)', () => {
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

  it('la cortina de colmena cuenta como paño y trae la columna COLMENA (ubic · medida)', () => {
    expect(hoja.totalPanos).toBe(1);
    expect(hoja.panos[0].colmena).toBe('A-27 · 178X210');
  });

  it('en la tabla de corte también sale con su medida y ubicación de colmena', () => {
    expect(hoja.cortinas[0].medidaColmena).toBe('SC 64 (178X210)');
    expect(hoja.cortinas[0].ubicColmena).toBe('A-27');
  });

  it('OPTIMIZADOR lista el COD de colmena con sus metros (la tabla no queda vacía)', () => {
    const m = Object.fromEntries(hoja.optimizador.map((o) => [o.codInt, o.metros]));
    expect(m['SC 64']).toBe(2.05); // 1,8 + 0,25 de reserva
  });
});
