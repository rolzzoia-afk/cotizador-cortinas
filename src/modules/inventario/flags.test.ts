import { describe, expect, it } from 'vitest';
import { FLAGS_APAGADOS, problemasDeFlags, sanearFlags } from './flags';

describe('sanearFlags — no confiar en lo guardado', () => {
  it('lee los cuatro interruptores', () => {
    expect(
      sanearFlags({ kardexRpc: true, dualWrite: true, bloqueoDirecto: false, compras: true }),
    ).toEqual({ kardexRpc: true, dualWrite: true, bloqueoDirecto: false, compras: true });
  });

  it('acepta el JSON como texto, que es como viene de la base', () => {
    expect(sanearFlags('{"kardexRpc":true}')).toEqual({ ...FLAGS_APAGADOS, kardexRpc: true });
  });

  // Solo `true` enciende. Un 1, un "true" o un "sí" NO alcanzan: estos
  // interruptores cambian cómo se mueve el stock de la empresa.
  it('cualquier cosa que no sea exactamente true queda apagada', () => {
    for (const v of [1, '1', 'true', 'sí', {}, [], 'on']) {
      expect(sanearFlags({ kardexRpc: v }).kardexRpc, JSON.stringify(v)).toBe(false);
    }
  });

  it('un JSON roto o vacío deja todo apagado', () => {
    for (const v of ['', '{no es json', null, undefined, 42, [], 'null']) {
      expect(sanearFlags(v), String(v)).toEqual(FLAGS_APAGADOS);
    }
  });

  it('devuelve una copia, no la constante compartida', () => {
    expect(sanearFlags(null)).not.toBe(FLAGS_APAGADOS);
  });
});

describe('problemasDeFlags — combinaciones que dejarían el taller parado', () => {
  it('bloquear la escritura directa sin kardex dejaría a todos sin mover stock', () => {
    const p = problemasDeFlags({ ...FLAGS_APAGADOS, bloqueoDirecto: true });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('nadie podría mover stock');
  });

  it('la escritura doble sin kardex no tiene sentido', () => {
    expect(problemasDeFlags({ ...FLAGS_APAGADOS, dualWrite: true })).toHaveLength(1);
  });

  it('con el kardex encendido las dos son válidas', () => {
    expect(
      problemasDeFlags({
        kardexRpc: true,
        dualWrite: true,
        bloqueoDirecto: true,
        compras: false,
      }),
    ).toEqual([]);
  });

  it('todo apagado se puede guardar: es como está hoy', () => {
    expect(problemasDeFlags(FLAGS_APAGADOS)).toEqual([]);
  });

  it('compras no depende de los otros', () => {
    expect(problemasDeFlags({ ...FLAGS_APAGADOS, compras: true })).toEqual([]);
  });
});
