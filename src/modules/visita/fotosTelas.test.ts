import { describe, expect, it } from 'vitest';
import { claveTela, mapaFotosTelas, resolverFotoTela } from './fotosTelas';
import type { CatalogoProductos } from '@/modules/cotizador/types';

const CAT: CatalogoProductos = {
  'BK 24': { cod: 'BLACKOUT_D', producto: 'ROLLER BLACKOUT DELUX', tipo: 'DELUX', descripcion: 'LINO BEIGE', precio: 41868, foto: 'https://x/informe-assets/e/tela-BK24/ficha.jpg' },
  'SC 34': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 31582 },
};

describe('fotosTelas — de dónde sale la foto de la tela del informe', () => {
  it('la clave ignora mayúsculas y espacios de más', () => {
    expect(claveTela(' bk  24 ')).toBe('BK 24');
    expect(claveTela(null)).toBe('');
  });

  it('mapaFotosTelas: solo filas con foto, clave normalizada, la primera gana', () => {
    const m = mapaFotosTelas([
      { codigo: 'bk 24', foto_url: 'https://x/fotos-telas/e/BK_24_1.jpg' },
      { codigo: 'BK 24', foto_url: 'https://x/fotos-telas/e/BK_24_2.jpg' },
      { codigo: 'SC 34', foto_url: null },
      { codigo: 'SC 17', foto_url: '  ' },
      { codigo: null, foto_url: 'https://x/huerfana.jpg' },
    ]);
    expect(m).toEqual({ 'BK 24': 'https://x/fotos-telas/e/BK_24_1.jpg' });
  });

  it('la ficha del catálogo de productos manda sobre la foto del inventario', () => {
    const f = resolverFotoTela(CAT, { 'BK 24': 'https://x/fotos-telas/e/BK_24.jpg' });
    expect(f('BK 24')).toBe('https://x/informe-assets/e/tela-BK24/ficha.jpg');
  });

  it('sin ficha, usa la foto subida en Telas → Catálogo', () => {
    const f = resolverFotoTela(CAT, { 'SC 34': 'https://x/fotos-telas/e/SC_34.jpg' });
    expect(f('SC 34')).toBe('https://x/fotos-telas/e/SC_34.jpg');
    expect(f(' sc 34 ')).toBe('https://x/fotos-telas/e/SC_34.jpg');
  });

  it('sin ninguna de las dos devuelve undefined (la habitación va sin foto)', () => {
    expect(resolverFotoTela(CAT)('SC 34')).toBeUndefined();
    expect(resolverFotoTela(CAT, {})('NO EXISTE')).toBeUndefined();
  });

  it('sin el mapa del inventario se comporta como antes (regresión)', () => {
    const f = resolverFotoTela(CAT);
    expect(f('BK 24')).toBe(CAT['BK 24'].foto);
    expect(f('SC 34')).toBeUndefined();
  });

  it('la vertical sin foto propia usa la ficha de su tela base (SC 93-V → SC 93)', () => {
    const cat: CatalogoProductos = {
      ...CAT,
      'SC 93': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: '', precio: 23820, foto: 'https://x/informe-assets/e/tela-SC-93/ficha.jpeg' },
      'SC 93-V': { cod: 'SCREEN_V_P', producto: 'CORTINA VERTICAL SCREEN', tipo: 'PREMIUM', descripcion: '', precio: 23820 },
    };
    expect(resolverFotoTela(cat)('SC 93-V')).toBe(cat['SC 93'].foto);
    // Y también cae a la foto del inventario de la base si la ficha no está.
    const sinFicha = { ...cat, 'SC 93': { ...cat['SC 93'], foto: undefined } };
    expect(resolverFotoTela(sinFicha, { 'SC 93': 'https://x/fotos-telas/e/SC_93.jpg' })('SC 93-V')).toBe(
      'https://x/fotos-telas/e/SC_93.jpg',
    );
  });

  it('la vertical con foto propia gana sobre la de su base', () => {
    const cat: CatalogoProductos = {
      ...CAT,
      'SC 93': { cod: 'SCREEN_P', producto: 'R', tipo: 'PREMIUM', descripcion: '', precio: 1, foto: 'https://x/base.jpg' },
      'SC 93-V': { cod: 'SCREEN_V_P', producto: 'V', tipo: 'PREMIUM', descripcion: '', precio: 1, foto: 'https://x/propia.jpg' },
    };
    expect(resolverFotoTela(cat)('SC 93-V')).toBe('https://x/propia.jpg');
    expect(resolverFotoTela({ ...CAT }, { 'SC 93-V': 'https://x/inv-v.jpg', 'SC 93': 'https://x/inv-base.jpg' })('SC 93-V')).toBe('https://x/inv-v.jpg');
  });
});
