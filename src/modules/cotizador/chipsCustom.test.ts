import { describe, expect, it, vi } from 'vitest';

// chipsCustom.ts toma `esHexValido` de chipsColores.ts, que importa el cliente
// supabase (para su hook); en CI no hay VITE_SUPABASE_* y el módulo real lanza
// al importarse. Mismo mock que en chipsColores.test.ts.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import {
  HEX_CHIP_CUSTOM_DEFAULT,
  MAX_CHIPS_CUSTOM,
  esChipCustom,
  idChipCustom,
  saneaChipsCustom,
} from './chipsCustom';

describe('idChipCustom', () => {
  it('arma un id estable: mayúsculas, sin tildes y sin espacios', () => {
    expect(idChipCustom('Cyber día')).toBe('CUSTOM-CYBER_DIA');
    expect(idChipCustom('  promo   verano ')).toBe('CUSTOM-PROMO_VERANO');
    // El mismo nombre da el mismo id: es lo que permite detectar repetidas.
    expect(idChipCustom('Cyber DIA')).toBe(idChipCustom('cyber día'));
  });

  it('un nombre sin letras ni números igual da un id usable', () => {
    expect(esChipCustom(idChipCustom('###'))).toBe(true);
  });

  it('los ids propios se distinguen de los de fábrica', () => {
    expect(esChipCustom('CUSTOM-PROMO')).toBe(true);
    expect(esChipCustom('BK')).toBe(false);
    expect(esChipCustom('')).toBe(false);
  });
});

describe('saneaChipsCustom', () => {
  it('descarta lo que no sirve y completa el color', () => {
    expect(
      saneaChipsCustom([
        { id: 'CUSTOM-PROMO', label: 'Promo', hex: '#ff0000' },
        { label: 'Sin id' }, // se le arma el id y el color por defecto
        { id: 'CUSTOM-X', label: '   ' }, // sin nombre: fuera
        'basura',
        null,
      ]),
    ).toEqual([
      { id: 'CUSTOM-PROMO', label: 'Promo', hex: '#ff0000' },
      { id: 'CUSTOM-SIN_ID', label: 'Sin id', hex: HEX_CHIP_CUSTOM_DEFAULT },
    ]);
  });

  it('no deja dos categorías con el mismo id', () => {
    const r = saneaChipsCustom([
      { label: 'Promo' },
      { label: 'PROMO' },
      { id: 'CUSTOM-PROMO', label: 'Otra cosa' },
    ]);
    expect(r).toHaveLength(1);
  });

  it('un color inválido cae al por defecto, no rompe el chip', () => {
    expect(saneaChipsCustom([{ label: 'X', hex: 'rojo' }])[0].hex).toBe(HEX_CHIP_CUSTOM_DEFAULT);
  });

  it('tope de categorías, y lo que no es lista devuelve vacío', () => {
    const muchas = Array.from({ length: MAX_CHIPS_CUSTOM + 5 }, (_, i) => ({ label: `C${i}` }));
    expect(saneaChipsCustom(muchas)).toHaveLength(MAX_CHIPS_CUSTOM);
    expect(saneaChipsCustom(null)).toEqual([]);
    expect(saneaChipsCustom({ label: 'X' })).toEqual([]);
  });
});
