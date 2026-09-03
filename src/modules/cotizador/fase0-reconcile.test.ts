import { describe, expect, it } from 'vitest';
import {
  agruparFilasPorVentana,
  construirPanosDeGrupo,
  explotarVentanasAFilas,
  type FilaReconcile,
} from './fase0-reconcile';
import type { VentanaItem } from '@/modules/ots/types';

// Generador de ids determinista para los tests.
const genIdSeq = () => {
  let n = 0;
  return () => `f${++n}`;
};

describe('explotarVentanasAFilas', () => {
  it('una fila por paño, con vid y panoIndex; ancho/alto/color por paño', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'LIVING',
      codInt: 'SC 64',
      categoria: 'ROL',
      direccion: 'CAD [IZQUIERDA]',
      sentido: 'INTERNO',
      cantidad: 3,
      color: 'NEGRO',
      alto: 2.4,
      panos: [
        { ancho: 1.5, alto: 2.4, color: 'BCO' },
        { ancho: 1.2, alto: 2.4 },
      ],
    };
    const { filas, orig } = explotarVentanasAFilas([v], genIdSeq());
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      codInt: 'SC 64', categoria: 'ROL', direccion: 'CAD [IZQUIERDA]', sentido: 'INTERNO',
      cantidad: 3, ubicacion: 'LIVING', colorAcc: 'BCO', ancho: 1.5, alto: 2.4, vid: 'v1', panoIndex: 0,
    });
    // Paño sin color propio hereda el color de la ventana.
    expect(filas[1]).toMatchObject({ colorAcc: 'NEGRO', ancho: 1.2, panoIndex: 1 });
    expect(orig['v1']).toBe(v);
  });

  // Una cotización puede empezar en Terreno (Fase 2) sin pasar por Fase 1: esas
  // ventanas nacen sin precio ni DCT%, y Fase 3 tiene que poder cotizarlas.
  it('una ventana creada en Terreno llega a Fase 3 con todo lo que se necesita', () => {
    const v: VentanaItem = {
      id: 'v-terreno',
      ubicacion: 'DORMITORIO',
      codInt: 'BK 18',
      producto: 'ROLLER BLACKOUT DELUX',
      categoria: 'ROL',
      color: 'BLANCO',
      alto: 2.3,
      cantidad: 1,
      precio: 0,
      panos: [{ ancho: 1.855, alto: 2.3, color: 'BCO', mecanismo: 'SINFLEX BLANCO [MEC 33]' }],
    };
    const { filas } = explotarVentanasAFilas([v], genIdSeq(), (cod) => (cod === 'BK 18' ? 20 : 0));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      codInt: 'BK 18',
      categoria: 'ROL',
      ubicacion: 'DORMITORIO',
      ancho: 1.855,
      alto: 2.3,
      cantidad: 1,
      vid: 'v-terreno',
      panoIndex: 0,
    });
    // Sin DCT guardado (nadie lo tecleó en terreno) cae al del catálogo.
    expect(filas[0].descuento).toBe(20);
  });

  it('ventana sin paños emite una fila (ancho 0)', () => {
    const v: VentanaItem = { id: 'v1', codInt: 'BK 18', alto: 2, panos: [] };
    const { filas } = explotarVentanasAFilas([v], genIdSeq());
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ codInt: 'BK 18', ancho: 0, alto: 2, panoIndex: 0 });
  });

  it('restaura el DCT% guardado en cada paño (0 explícito incluido)', () => {
    const v: VentanaItem = {
      id: 'v1',
      codInt: 'DU 28',
      alto: 2.3,
      panos: [
        { ancho: 1.66, alto: 2.3, descuento: 30 },
        { ancho: 1.61, alto: 2.3, descuento: 0 },
      ],
    };
    // dctPorDefecto NO debe pisar un descuento guardado (ni siquiera el 0).
    const { filas } = explotarVentanasAFilas([v], genIdSeq(), () => 99);
    expect(filas.map((f) => f.descuento)).toEqual([30, 0]);
  });

  it('paño sin DCT% guardado usa el % del catálogo (dctPorDefecto)', () => {
    const v: VentanaItem = {
      id: 'v1',
      codInt: 'DU 28',
      alto: 2.3,
      panos: [{ ancho: 1.66, alto: 2.3 }],
    };
    const dct = (ci: string) => (ci === 'DU 28' ? 30 : 0);
    expect(explotarVentanasAFilas([v], genIdSeq(), dct).filas[0].descuento).toBe(30);
    // Sin callback (p. ej. tests o catálogo aún no cargado) queda en 0.
    expect(explotarVentanasAFilas([v], genIdSeq()).filas[0].descuento).toBe(0);
  });

  it('restaura invertida solo cuando es explícita (true/false); ausente queda undefined', () => {
    const v: VentanaItem = {
      id: 'v1',
      codInt: 'SC 64',
      alto: 2,
      panos: [
        { ancho: 3.2, alto: 2, invertida: true },
        { ancho: 1.5, alto: 2, invertida: false },
        { ancho: 3.2, alto: 2 }, // sin flag → auto (no se hornea)
      ],
    };
    const { filas } = explotarVentanasAFilas([v], genIdSeq());
    expect(filas.map((f) => f.invertida)).toEqual([true, false, undefined]);
  });

  it('la línea B viaja igual: solo el flag explícito, el auto se resuelve al vuelo', () => {
    const v: VentanaItem = {
      id: 'v1',
      codInt: 'SC 64',
      alto: 2,
      panos: [
        { ancho: 1.5, alto: 2, lineaB: true },
        { ancho: 1.5, alto: 2, lineaB: false },
        { ancho: 1.5, alto: 2 }, // sin flag → lo decide la tela del catálogo
      ],
    };
    const { filas } = explotarVentanasAFilas([v], genIdSeq());
    expect(filas.map((f) => f.lineaB)).toEqual([true, false, undefined]);
  });
});

describe('agruparFilasPorVentana', () => {
  it('agrupa por vid y ordena por panoIndex; filas sin vid quedan solas', () => {
    const filas: FilaReconcile[] = [
      { id: 'a', vid: 'v1', panoIndex: 1, codInt: 'X', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1, alto: 1, descuento: 0 },
      { id: 'b', vid: 'v1', panoIndex: 0, codInt: 'X', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1, alto: 1, descuento: 0 },
      { id: 'c', codInt: 'Y', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1, alto: 1, descuento: 0 },
      { id: 'd', codInt: 'Z', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1, alto: 1, descuento: 0 },
    ];
    const grupos = agruparFilasPorVentana(filas);
    expect(grupos).toHaveLength(3);
    // grupo v1 con los 2 paños ordenados por panoIndex (b antes que a).
    expect(grupos[0].vid).toBe('v1');
    expect(grupos[0].filas.map((f) => f.id)).toEqual(['b', 'a']);
    // filas sin vid: una ventana nueva cada una.
    expect(grupos[1].vid).toBeUndefined();
    expect(grupos[2].vid).toBeUndefined();
  });
});

describe('construirPanosDeGrupo', () => {
  it('preserva la ficha rica del paño original y solo actualiza ancho/alto/color', () => {
    const origPanos = [
      { ancho: 9, alto: 9, color: 'X', mecanismo: 'MEC 33', tuberia: 'E02', cenefa: 'Ovalada' },
      { ancho: 9, alto: 9, color: 'X', mecanismo: 'MEC 32' },
    ];
    const filas: FilaReconcile[] = [
      { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: 'BCO', ancho: 1.5, alto: 2.4, descuento: 0 },
      { id: 'b', vid: 'v1', panoIndex: 1, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.2, alto: 2.4, descuento: 0 },
    ];
    const panos = construirPanosDeGrupo(filas, origPanos);
    expect(panos[0]).toMatchObject({ mecanismo: 'MEC 33', tuberia: 'E02', cenefa: 'Ovalada', ancho: 1.5, alto: 2.4, color: 'BCO' });
    // color vacío en la fila conserva el color original del paño.
    expect(panos[1]).toMatchObject({ mecanismo: 'MEC 32', ancho: 1.2, color: 'X' });
  });

  it('grupo nuevo (sin origPanos) crea paños con sus colores derivados', () => {
    const filas: FilaReconcile[] = [
      { id: 'a', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: 'NEG', ancho: 2, alto: 2, descuento: 0 },
    ];
    expect(construirPanosDeGrupo(filas, undefined)).toEqual([
      {
        ancho: 2,
        alto: 2,
        color: 'NEG',
        colorMecanismo: 'NEG',
        colorPeso: 'NEG',
        colorCadena: 'NEG',
        descuento: 0,
      },
    ]);
  });

  // El bug: cambiar el color en la cotización de una OT ya guardada no llegaba
  // a Fase 2 ni al BOM, porque `colorAccesoriosDePano` mira colorMecanismo
  // ANTES que color, y ese seguía con el valor viejo.
  describe('cambio de color de accesorios desde la cotización', () => {
    const filaColor = (colorAcc: string): FilaReconcile[] => [
      { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc, ancho: 2.2, alto: 2.5, descuento: 0 },
    ];

    it('propaga el color nuevo a mecanismo, peso y cadena', () => {
      const orig = [
        { ancho: 2.2, alto: 2.5, color: 'BCO', colorMecanismo: 'BCO', colorPeso: 'BCO', colorCadena: 'BCO', mecanismo: 'MEC 33' },
      ];
      expect(construirPanosDeGrupo(filaColor('NEG'), orig)[0]).toMatchObject({
        color: 'NEG',
        colorMecanismo: 'NEG',
        colorPeso: 'NEG',
        colorCadena: 'NEG',
      });
    });

    it('sin cambio de color respeta los colores editados a mano en terreno', () => {
      const orig = [
        { ancho: 2.2, alto: 2.5, color: 'BCO', colorMecanismo: 'BCO', colorPeso: 'NEG', colorCadena: 'BCO' },
      ];
      // El resolutor da BCO (manda colorMecanismo) y la fila trae BCO: no toca nada.
      expect(construirPanosDeGrupo(filaColor('BCO'), orig)[0]).toMatchObject({
        colorPeso: 'NEG',
      });
    });

    it('compara contra el color RESUELTO, no contra pano.color', () => {
      // Paño incoherente de una OT vieja: color BCO pero mecanismo NEG (manda NEG).
      const orig = [{ ancho: 2.2, alto: 2.5, color: 'BCO', colorMecanismo: 'NEG' }];
      // La fila pide BCO → sí es un cambio real respecto del resuelto (NEG).
      expect(construirPanosDeGrupo(filaColor('BCO'), orig)[0]).toMatchObject({
        colorMecanismo: 'BCO',
        colorCadena: 'BCO',
      });
    });

    it('nombre largo y código corto son el mismo color: no fuerza cambio', () => {
      const orig = [{ ancho: 2.2, alto: 2.5, color: 'BLANCO', colorMecanismo: 'BCO', colorPeso: 'NEG' }];
      expect(construirPanosDeGrupo(filaColor('BLANCO'), orig)[0]).toMatchObject({
        colorPeso: 'NEG',
      });
    });
  });

  it('guarda el DCT% de la fila en el paño', () => {
    const filas: FilaReconcile[] = [
      { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.5, alto: 2.4, descuento: 30 },
    ];
    const panos = construirPanosDeGrupo(filas, [{ ancho: 9, alto: 9, mecanismo: 'MEC 33' }]);
    expect(panos[0]).toMatchObject({ mecanismo: 'MEC 33', descuento: 30 });
  });

  it('escribe invertida solo si es explícita; con undefined preserva la del paño original', () => {
    const filas: FilaReconcile[] = [
      { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 3.2, alto: 2, descuento: 0, invertida: false },
      { id: 'b', vid: 'v1', panoIndex: 1, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.5, alto: 2, descuento: 0 },
      { id: 'c', vid: 'v1', panoIndex: 2, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.5, alto: 2, descuento: 0 },
    ];
    const panos = construirPanosDeGrupo(filas, [
      { ancho: 9, alto: 9, invertida: true }, // la fila la apaga explícitamente
      { ancho: 9, alto: 9, invertida: true }, // la fila no opina → se preserva
      { ancho: 9, alto: 9 }, // nunca hubo flag → sigue sin flag (auto)
    ]);
    expect(panos[0].invertida).toBe(false);
    expect(panos[1].invertida).toBe(true);
    expect('invertida' in panos[2]).toBe(false);
  });

  it('escribe lineaB solo si es explícita; con undefined preserva la del paño', () => {
    const base = { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.5, alto: 2, descuento: 0 };
    const filas: FilaReconcile[] = [
      { ...base, lineaB: false },
      { ...base, id: 'b', panoIndex: 1 },
      { ...base, id: 'c', panoIndex: 2 },
    ];
    const panos = construirPanosDeGrupo(filas, [
      { ancho: 9, alto: 9, lineaB: true }, // la fila la pasa a línea A
      { ancho: 9, alto: 9, lineaB: true }, // la fila no opina → se preserva
      { ancho: 9, alto: 9 }, // nunca hubo flag → sigue en auto por la tela
    ]);
    expect(panos[0].lineaB).toBe(false);
    expect(panos[1].lineaB).toBe(true);
    expect('lineaB' in panos[2]).toBe(false);
  });

  it('la cadena metálica viaja igual: apagarla en la grilla apaga la del paño', () => {
    const base = { id: 'a', vid: 'v1', panoIndex: 0, codInt: '', categoria: '', direccion: '', sentido: '', cantidad: 1, ubicacion: '', colorAcc: '', ancho: 1.5, alto: 2, descuento: 0 };
    const filas: FilaReconcile[] = [
      { ...base, cadenaMetalica: false },
      { ...base, id: 'b', panoIndex: 1, cadenaMetalica: true },
      { ...base, id: 'c', panoIndex: 2 },
    ];
    const panos = construirPanosDeGrupo(filas, [
      { ancho: 9, alto: 9, cadenaMetalica: true }, // la grilla la apaga
      { ancho: 9, alto: 9 }, // la grilla la enciende
      { ancho: 9, alto: 9, cadenaMetalica: true }, // la fila no opina → se preserva
    ]);
    expect(panos[0].cadenaMetalica).toBe(false);
    expect(panos[1].cadenaMetalica).toBe(true);
    expect(panos[2].cadenaMetalica).toBe(true);
  });

  it('explotar lee la cadena metálica del paño y deja undefined si no la trae', () => {
    const { filas } = explotarVentanasAFilas(
      [
        {
          id: 'v1',
          ubicacion: 'PZA',
          alto: 2,
          cantidad: 1,
          panos: [
            { ancho: 1, alto: 2, color: 'BCO', cadenaMetalica: true },
            { ancho: 1, alto: 2, color: 'BCO' },
          ],
        } as VentanaItem,
      ],
      (() => {
        let n = 0;
        return () => `id${n++}`;
      })(),
    );
    expect(filas[0].cadenaMetalica).toBe(true);
    expect(filas[1].cadenaMetalica).toBeUndefined();
  });
});

describe('round-trip explotar → agrupar → construir paños', () => {
  it('una ventana de 3 paños vuelve a ser una ventana de 3 paños con su ficha', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'PZA',
      alto: 2,
      cantidad: 1,
      panos: [
        { ancho: 1.0, alto: 2, color: 'BCO', mecanismo: 'MEC 33', descuento: 30, invertida: true },
        { ancho: 1.1, alto: 2, color: 'BCO', mecanismo: 'MEC 33', descuento: 15, invertida: false },
        { ancho: 1.2, alto: 2, color: 'BCO', mecanismo: 'MEC 33', descuento: 0 },
      ],
    };
    const { filas, orig } = explotarVentanasAFilas([v], genIdSeq());
    const grupos = agruparFilasPorVentana(filas);
    expect(grupos).toHaveLength(1);
    const panos = construirPanosDeGrupo(grupos[0].filas, orig[grupos[0].vid!].panos as never);
    expect(panos).toHaveLength(3);
    expect(panos.map((p) => p.ancho)).toEqual([1.0, 1.1, 1.2]);
    expect(panos.every((p) => (p as { mecanismo?: string }).mecanismo === 'MEC 33')).toBe(true);
    // El DCT% por paño sobrevive el ciclo completo guardar → reabrir.
    expect(panos.map((p) => (p as { descuento?: number }).descuento)).toEqual([30, 15, 0]);
    // El flag invertida también: explícitos intactos, ausente sigue ausente.
    expect(panos.map((p) => (p as { invertida?: boolean }).invertida)).toEqual([
      true,
      false,
      undefined,
    ]);
  });
});
