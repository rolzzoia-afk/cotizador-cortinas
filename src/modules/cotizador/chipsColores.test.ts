import { describe, expect, it, vi } from 'vitest';

// chipsColores.ts importa el cliente supabase (para el hook useChipsColores);
// en CI no hay VITE_SUPABASE_* y el módulo real lanza al importarse.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { esHexValido, estiloChipHex } from './chipsColores';

describe('esHexValido', () => {
  it('acepta #rgb y #rrggbb, rechaza el resto', () => {
    expect(esHexValido('#fff')).toBe(true);
    expect(esHexValido('#FEF3C7')).toBe(true);
    expect(esHexValido('fff')).toBe(false);
    expect(esHexValido('#ggg')).toBe(false);
    expect(esHexValido('#12345')).toBe(false);
    expect(esHexValido(null)).toBe(false);
    expect(esHexValido(42)).toBe(false);
  });
});

describe('estiloChipHex', () => {
  it('fondo claro → texto oscuro; fondo oscuro → texto blanco', () => {
    expect(estiloChipHex('#fef3c7').color).toBe('#1c1917'); // ámbar claro
    expect(estiloChipHex('#b45309').color).toBe('#ffffff'); // ámbar oscuro
  });

  it('expande #rgb y oscurece el borde', () => {
    const s = estiloChipHex('#fff');
    expect(s.backgroundColor).toBe('#ffffff');
    expect(s.borderColor).toBe('#b8b8b8'); // 255 × 0,72 ≈ 184
  });
});
