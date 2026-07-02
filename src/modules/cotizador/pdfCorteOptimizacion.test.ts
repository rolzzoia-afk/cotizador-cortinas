import { describe, it, expect } from 'vitest';
import { construirHojaCorte } from './pdfCorteOptimizacion';
import { buildOptimizerRows, asignarJuntoEnOrden, autoOptimizar } from './tela';
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

  it('TOTAL PAÑOS = paños de rollo (un grupo por letra)', () => {
    expect(hoja.totalPanos).toBe(2);
    expect(hoja.panos.map((p) => p.pano)).toEqual([1, 2]);
    expect(hoja.panos[0].tipo).toBe('ROLLER BLACKOUT DELUX'); // producto completo
    expect(hoja.panos[1].cod).toBe('SC 64');
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
