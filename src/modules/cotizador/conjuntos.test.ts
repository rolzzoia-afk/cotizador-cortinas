import { describe, expect, it } from 'vitest';
import {
  areaVentana,
  coloresPorGrupo,
  copiarFichaDesdeMayor,
  elegirVentanaMayor,
  esVentanaInvertida,
  juntarVentanas,
  limpiarGruposHuerfanos,
  quitarDeConjunto,
  COLORES_CONJUNTO,
} from './conjuntos';
import type { Pano, Ventana } from './types';

// Ventana mínima con defaults; los tests pisan lo que necesitan.
type VentanaOver = Omit<Partial<Ventana>, 'panos'> & { panos?: Partial<Pano>[] };
function mkVentana(over: VentanaOver): Ventana {
  return {
    id: over.id ?? crypto.randomUUID(),
    ubicacion: over.ubicacion ?? '',
    codInt: over.codInt ?? '',
    producto: over.producto ?? '',
    tipo: over.tipo ?? '',
    color: over.color ?? 'Blanco',
    alto: over.alto ?? 2,
    precio: over.precio ?? 0,
    cantidad: over.cantidad ?? 1,
    categoria: over.categoria ?? '',
    grupoId: over.grupoId ?? null,
    grupoOrden: over.grupoOrden ?? 0,
    ...over,
    panos: (over.panos ?? [{ ancho: 1, alto: 2 }]).map((p) => ({
      ancho: 1,
      alto: 2,
      color: '',
      ...p,
    })) as Pano[],
  };
}

describe('areaVentana / elegirVentanaMayor', () => {
  it('suma paños con fallback del alto al de la ventana; cantidad no multiplica', () => {
    const v = mkVentana({
      alto: 2,
      cantidad: 5,
      panos: [
        { ancho: 1.5, alto: 2.4 }, // 3.6
        { ancho: 1.0, alto: 0 }, // alto 0 → usa v.alto: 2.0
      ],
    });
    expect(areaVentana(v)).toBeCloseTo(5.6);
  });

  it('elige la de mayor área; empate → mayor Σ ancho; empate total → la primera', () => {
    const a = mkVentana({ id: 'a', panos: [{ ancho: 2, alto: 2 }] }); // 4
    const b = mkVentana({ id: 'b', panos: [{ ancho: 3.2, alto: 2 }] }); // 6.4
    expect(elegirVentanaMayor([a, b]).id).toBe('b');
    // Empate de área (4): c tiene más ancho total (4 vs 2).
    const c = mkVentana({ id: 'c', panos: [{ ancho: 4, alto: 1 }] });
    expect(elegirVentanaMayor([a, c]).id).toBe('c');
    // Empate total → primera.
    const a2 = mkVentana({ id: 'a2', panos: [{ ancho: 2, alto: 2 }] });
    expect(elegirVentanaMayor([a, a2]).id).toBe('a');
  });
});

describe('esVentanaInvertida', () => {
  it('auto por ancho de rollo cuando no hay flag', () => {
    expect(esVentanaInvertida(mkVentana({ panos: [{ ancho: 3.2 }] }), 2.98)).toBe(true);
    expect(esVentanaInvertida(mkVentana({ panos: [{ ancho: 1.5 }] }), 2.98)).toBe(false);
  });

  it('el flag explícito manda en ambos sentidos', () => {
    expect(
      esVentanaInvertida(mkVentana({ panos: [{ ancho: 1.5, invertida: true }] }), 2.98),
    ).toBe(true);
    expect(
      esVentanaInvertida(mkVentana({ panos: [{ ancho: 3.2, invertida: false }] }), 2.98),
    ).toBe(false);
  });

  it('basta un paño invertido entre varios', () => {
    const v = mkVentana({ panos: [{ ancho: 1 }, { ancho: 3.2 }] });
    expect(esVentanaInvertida(v, 2.98)).toBe(true);
  });
});

describe('copiarFichaDesdeMayor / juntarVentanas', () => {
  const mayor = mkVentana({
    id: 'M',
    ubicacion: 'LIVING',
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    descripcion: 'LIGHT LINEN 5%',
    categoria: 'ROL',
    color: 'NEGRO',
    sentido: 'EXTERNO',
    direccion: 'CAD [IZQUIERDA]',
    alto: 2.4,
    precio: 100,
    cantidad: 1,
    modelo: { id: 'mod1' } as never,
    panos: [
      {
        ancho: 3.2,
        alto: 2.4,
        color: 'NEG',
        tipoTela: 'SCREEN',
        mecanismo: 'MEC 33',
        tuberia: 'E02',
        cenefa: 'Ovalada',
        cenefaTira: 'CON TIRA',
        colorMecanismo: 'NEGRO',
        armado: 'Interno',
        largoCadena: '1.5mts',
        cierreAlturaCm: 120,
        perfilIzqMuroCm: 33,
        descuento: 30,
        comentarioFinal: 'ojo con el muro',
      } as Partial<Pano>,
    ],
  });
  const chica = mkVentana({
    id: 'C',
    ubicacion: 'PZA',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    tipo: 'DELUX',
    categoria: 'ROL_D',
    color: 'Blanco',
    alto: 2.0,
    precio: 40,
    cantidad: 2,
    panos: [{ ancho: 1.5, alto: 2.0, color: 'BCO', descuento: 10 } as Partial<Pano>],
  });

  it('copia la ficha de ventana y paño; conserva identidad, medidas y comercial', () => {
    const out = copiarFichaDesdeMayor(mayor, chica);
    // Ficha de ventana copiada.
    expect(out).toMatchObject({
      codInt: 'SC 64', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM',
      descripcion: 'LIGHT LINEN 5%', categoria: 'ROL', color: 'NEGRO',
      sentido: 'EXTERNO', direccion: 'CAD [IZQUIERDA]',
    });
    expect(out.modelo).toEqual({ id: 'mod1' });
    // Identidad y medidas propias intactas.
    expect(out).toMatchObject({ id: 'C', ubicacion: 'PZA', alto: 2.0, precio: 40, cantidad: 2 });
    expect(out.panos[0]).toMatchObject({ ancho: 1.5, alto: 2.0 });
    // Ficha técnica del paño copiada (incluye color de accesorios).
    expect(out.panos[0]).toMatchObject({
      tipoTela: 'SCREEN', mecanismo: 'MEC 33', tuberia: 'E02',
      cenefa: 'Ovalada', cenefaTira: 'CON TIRA', colorMecanismo: 'NEGRO',
      armado: 'Interno', color: 'NEG',
    });
    // NO copiados: dependen del alto propio / medidas de terreno / comercial.
    const p = out.panos[0] as Partial<Pano>;
    expect(p.largoCadena).toBeUndefined();
    expect(p.cierreAlturaCm).toBeUndefined();
    expect(p.perfilIzqMuroCm).toBeUndefined();
    expect(p.comentarioFinal).toBeUndefined();
    expect((p as { descuento?: number }).descuento).toBe(10);
  });

  it('valores undefined de la mayor no borran los del destino', () => {
    const m = mkVentana({ id: 'M2', codInt: 'SC 64', panos: [{ ancho: 3.2 }] });
    delete (m as Partial<Ventana>).sentido;
    const dest = mkVentana({ id: 'D', sentido: 'INTERNO', panos: [{ ancho: 1, mecanismo: 'MEC 13' } as Partial<Pano>] });
    const out = copiarFichaDesdeMayor(m, dest);
    expect(out.sentido).toBe('INTERNO');
    expect(out.panos[0].mecanismo).toBe('MEC 13');
  });

  it('destino con más paños que la mayor usa el paño 0 como referencia', () => {
    const dest = mkVentana({
      id: 'D3',
      panos: [{ ancho: 1 }, { ancho: 1.2 }],
    });
    const out = copiarFichaDesdeMayor(mayor, dest);
    expect(out.panos).toHaveLength(2);
    expect(out.panos[1]).toMatchObject({ ancho: 1.2, mecanismo: 'MEC 33' });
  });

  it('juntarVentanas: grupoId/grupoOrden a todos e invertida true en todos los paños', () => {
    const out = juntarVentanas([chica, mayor], 'g1');
    expect(out.map((v) => v.grupoId)).toEqual(['g1', 'g1']);
    expect(out.map((v) => v.grupoOrden)).toEqual([1, 2]);
    // La chica heredó la ficha de la mayor.
    expect(out[0].codInt).toBe('SC 64');
    expect(out[0].ubicacion).toBe('PZA');
    // Invertida explícita en TODOS (incluida la mayor).
    expect(out.every((v) => v.panos.every((p) => p.invertida === true))).toBe(true);
    // No muta los originales.
    expect(chica.grupoId).toBeNull();
    expect(mayor.panos[0].invertida).toBeUndefined();
  });
});

describe('quitarDeConjunto / limpiarGruposHuerfanos', () => {
  it('grupo de 2: quitar una disuelve el grupo entero', () => {
    const vs = [
      mkVentana({ id: 'a', grupoId: 'g', grupoOrden: 1 }),
      mkVentana({ id: 'b', grupoId: 'g', grupoOrden: 2 }),
      mkVentana({ id: 'c' }),
    ];
    const out = quitarDeConjunto(vs, 'a');
    expect(out.map((v) => v.grupoId)).toEqual([null, null, null]);
    expect(out.map((v) => v.grupoOrden)).toEqual([0, 0, 0]);
  });

  it('grupo de 3: quitar una deja 2 con grupoOrden recompactado', () => {
    const vs = [
      mkVentana({ id: 'a', grupoId: 'g', grupoOrden: 1 }),
      mkVentana({ id: 'b', grupoId: 'g', grupoOrden: 2 }),
      mkVentana({ id: 'c', grupoId: 'g', grupoOrden: 3 }),
    ];
    const out = quitarDeConjunto(vs, 'b');
    expect(out.find((v) => v.id === 'a')).toMatchObject({ grupoId: 'g', grupoOrden: 1 });
    expect(out.find((v) => v.id === 'b')).toMatchObject({ grupoId: null, grupoOrden: 0 });
    expect(out.find((v) => v.id === 'c')).toMatchObject({ grupoId: 'g', grupoOrden: 2 });
  });

  it('limpiar tras eliminar: el miembro restante de un grupo de 2 queda libre', () => {
    const vs = [
      mkVentana({ id: 'a', grupoId: 'g', grupoOrden: 1 }),
      mkVentana({ id: 'x' }),
    ];
    const out = limpiarGruposHuerfanos(vs);
    expect(out[0]).toMatchObject({ grupoId: null, grupoOrden: 0 });
    // Las sin grupo no se tocan (misma referencia).
    expect(out[1]).toBe(vs[1]);
  });
});

describe('coloresPorGrupo', () => {
  it('asigna índices por orden de aparición y el 7º repite color (módulo 6)', () => {
    const vs = [
      mkVentana({ grupoId: 'g1' }),
      mkVentana({}),
      mkVentana({ grupoId: 'g2' }),
      mkVentana({ grupoId: 'g1' }),
      mkVentana({ grupoId: 'g3' }),
    ];
    const m = coloresPorGrupo(vs);
    expect(m.get('g1')).toBe(0);
    expect(m.get('g2')).toBe(1);
    expect(m.get('g3')).toBe(2);
    expect(m.size).toBe(3);
    // El 7º grupo (índice 6) repite el color del primero.
    expect(COLORES_CONJUNTO[6 % COLORES_CONJUNTO.length]).toBe(COLORES_CONJUNTO[0]);
  });
});
