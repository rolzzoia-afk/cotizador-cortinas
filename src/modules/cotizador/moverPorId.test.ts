import { describe, expect, it } from 'vitest';
import { moverBloqueDeVentana, moverPorId } from './moverPorId';

const ids = (l: { id: string }[]) => l.map((x) => x.id).join(',');
const lista = (...xs: string[]) => xs.map((id) => ({ id }));

describe('moverPorId', () => {
  const L = lista('a', 'b', 'c', 'd');

  it('mueve un elemento antes de otro', () => {
    expect(ids(moverPorId(L, 'd', 'b'))).toBe('a,d,b,c');
    expect(ids(moverPorId(L, 'a', 'd'))).toBe('b,c,a,d');
  });

  it('sin referencia lo manda al final', () => {
    expect(ids(moverPorId(L, 'b'))).toBe('a,c,d,b');
  });

  it('soltarlo sobre sí mismo o mover un id que no existe devuelve el MISMO array', () => {
    // Por referencia: quien llama lo usa para no marcarse como modificado.
    expect(moverPorId(L, 'b', 'b')).toBe(L);
    expect(moverPorId(L, 'z', 'b')).toBe(L);
  });

  it('no muta la lista original', () => {
    const original = [...L];
    moverPorId(L, 'a', 'c');
    expect(L).toEqual(original);
  });
});

describe('moverBloqueDeVentana', () => {
  // Una ventana de dos paños (un dual) son dos filas seguidas con el mismo
  // `vid`: separarlas rompería el re-agrupado al guardar.
  const L = [
    { id: 'a', vid: 'v1' },
    { id: 'b', vid: 'v1' },
    { id: 'c' },
    { id: 'd', vid: 'v2' },
  ];

  it('arrastrar un paño se lleva TODA su ventana', () => {
    expect(ids(moverBloqueDeVentana(L, 'a', 'd'))).toBe('c,a,b,d');
    expect(ids(moverBloqueDeVentana(L, 'b', 'd'))).toBe('c,a,b,d');
  });

  it('una fila suelta se mueve sola', () => {
    expect(ids(moverBloqueDeVentana(L, 'c', 'a'))).toBe('c,a,b,d');
  });

  it('soltarla dentro de su propia ventana devuelve el mismo array', () => {
    expect(moverBloqueDeVentana(L, 'a', 'b')).toBe(L);
  });

  it('sin referencia el bloque entero va al final', () => {
    expect(ids(moverBloqueDeVentana(L, 'a'))).toBe('c,d,a,b');
  });

  it('soltar sobre un paño inserta antes de TODA esa ventana', () => {
    const M = [{ id: 'c' }, { id: 'a', vid: 'v1' }, { id: 'b', vid: 'v1' }];
    expect(ids(moverBloqueDeVentana(M, 'c', 'b'))).toBe('c,a,b');
  });

  it('un id que no existe no rompe nada', () => {
    expect(moverBloqueDeVentana(L, 'z', 'a')).toBe(L);
  });
});
