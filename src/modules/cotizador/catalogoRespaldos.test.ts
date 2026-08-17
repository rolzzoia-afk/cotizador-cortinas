import { describe, expect, it } from 'vitest';
import {
  MAX_RESPALDOS_CATALOGO,
  codigosDelRespaldo,
  saneaRespaldosCatalogo,
} from './catalogoRespaldos';

const foto = (fecha: string) => ({
  fecha,
  motivo: 'antes de guardar el catálogo',
  catalogo: { 'BK 09': { cod: 'BLACKOUT_D', producto: 'ROLLER', tipo: 'DELUX', descripcion: '', precio: 27176 } },
  anchoRollo: { 'BK 09': 2.98 },
});

describe('saneaRespaldosCatalogo', () => {
  it('devuelve lista vacía ante cualquier cosa que no sea un arreglo', () => {
    for (const basura of [null, undefined, 0, 'x', {}]) {
      expect(saneaRespaldosCatalogo(basura)).toEqual([]);
    }
  });

  it('descarta las entradas sin fecha', () => {
    const r = saneaRespaldosCatalogo([foto('2026-08-11T00:00:00Z'), { motivo: 'sin fecha' }, null]);
    expect(r).toHaveLength(1);
    expect(r[0].fecha).toBe('2026-08-11T00:00:00Z');
  });

  it('recorta a las últimas 10 fotos', () => {
    const muchas = Array.from({ length: 25 }, (_, i) => foto(`2026-08-${String(i + 1).padStart(2, '0')}`));
    expect(saneaRespaldosCatalogo(muchas)).toHaveLength(MAX_RESPALDOS_CATALOGO);
  });

  it('completa los campos que falten en vez de romperse', () => {
    const [r] = saneaRespaldosCatalogo([{ fecha: '2026-08-11T00:00:00Z' }]);
    expect(r.motivo).toBe('');
    expect(r.catalogo).toEqual({});
    expect(r.anchoRollo).toEqual({});
    expect(codigosDelRespaldo(r)).toBe(0);
  });

  it('cuenta los códigos de una foto', () => {
    const [r] = saneaRespaldosCatalogo([foto('2026-08-11T00:00:00Z')]);
    expect(codigosDelRespaldo(r)).toBe(1);
    expect(r.anchoRollo['BK 09']).toBe(2.98);
  });
});
