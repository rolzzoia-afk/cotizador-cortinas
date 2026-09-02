import { describe, expect, it } from 'vitest';
import { otsDelPlan, resolverOtsDelPlan, type FilaOTPlan } from './planScope';
import type { OT } from '@/modules/ots/types';

const filaOT = (
  id: string,
  dg: Record<string, unknown>,
  items: unknown[] = [{ id: 'v1' }],
  numeroOt: string | null = null,
): FilaOTPlan => ({ id, items, datos_generales: dg, numero_ot: numeroOt });

const ot = (id: string, num: string): OT =>
  ({ id, datosGenerales: { ot: num, cliente: 'X' }, storeVentanas: [{ id: 'v1' }] }) as OT;

describe('otsDelPlan', () => {
  it('deja fuera las OTs huérfanas (fantasmas que quedaron en producción)', () => {
    const salida = otsDelPlan([
      filaOT('a', { cliente: 'ANA', ot: '3189' }),
      filaOT('b', {}),
      filaOT('c', { cliente: '  ', ot: '' }),
    ]);
    expect(salida.map((o) => o.id)).toEqual(['a']);
  });

  it('deja fuera las OTs sin ventanas: no hay nada que cortar', () => {
    const salida = otsDelPlan([
      filaOT('a', { cliente: 'ANA' }, []),
      filaOT('b', { cliente: 'LUIS' }, [{ id: 'v1' }]),
    ]);
    expect(salida.map((o) => o.id)).toEqual(['b']);
  });

  it('completa el número desde la columna cuando datos_generales no lo trae', () => {
    const [o] = otsDelPlan([filaOT('a', { cliente: 'ANA' }, [{ id: 'v1' }], '3200')]);
    expect(o.datosGenerales.ot).toBe('3200');
  });

  it('no pisa el número que ya venía en datos_generales', () => {
    const [o] = otsDelPlan([filaOT('a', { cliente: 'ANA', ot: '3189-B' }, [{ id: 'v1' }], '3189')]);
    expect(o.datosGenerales.ot).toBe('3189-B');
  });
});

describe('resolverOtsDelPlan — OT abierta (comportamiento histórico)', () => {
  it('la OT desde la que se abrió el optimizador SIEMPRE entra, aunque no esté en producción', () => {
    const actual = ot('z', '3300');
    const salida = resolverOtsDelPlan([ot('a', '3189')], { otActual: actual });
    expect(salida.map((o) => o.id)).toEqual(['z', 'a']);
  });

  it('si ya venía en la lista no se duplica ni se reordena', () => {
    const prod = [ot('a', '3189'), ot('b', '3190')];
    const salida = resolverOtsDelPlan(prod, { otActual: ot('b', '3190') });
    expect(salida.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('resolverOtsDelPlan — lote', () => {
  it('el plan del lote son SOLO sus OTs', () => {
    const prod = [ot('a', '3189'), ot('b', '3190'), ot('c', '3191')];
    const salida = resolverOtsDelPlan(prod, { otIds: ['a', 'c'] });
    expect(salida.map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('una OT del lote que salió de producción NO se inyecta: el plan la omite', () => {
    const salida = resolverOtsDelPlan([ot('a', '3189')], { otIds: ['a', 'fantasma'] });
    expect(salida.map((o) => o.id)).toEqual(['a']);
  });

  it('un lote cuyas OTs ya no están en producción da un plan vacío, no uno de toda la empresa', () => {
    expect(resolverOtsDelPlan([ot('a', '3189')], { otIds: ['zzz'] })).toEqual([]);
  });
});
