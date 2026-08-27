import { describe, expect, it } from 'vitest';
import {
  CANALES_FALLBACK,
  canalParaGuardar,
  esCanalReal,
  opcionesCanal,
} from './canales';

const CONFIG = ['Instagram', 'WhatsApp 1', 'WhatsApp 2', 'Shopify'];

describe('opcionesCanal', () => {
  it('pone primero los configurados y después los fijos', () => {
    expect(opcionesCanal(CONFIG)).toEqual([
      'Instagram',
      'WhatsApp 1',
      'WhatsApp 2',
      'Shopify',
      'Web',
      'Referido',
      'Otro',
    ]);
  });

  it('sin config usa los de fábrica', () => {
    expect(opcionesCanal([])).toEqual([...CANALES_FALLBACK, 'Web', 'Referido', 'Otro']);
    expect(opcionesCanal(undefined)).toEqual([...CANALES_FALLBACK, 'Web', 'Referido', 'Otro']);
  });

  it('no repite un canal que ya está en la config, ni por mayúsculas', () => {
    expect(opcionesCanal([...CONFIG, 'web', 'INSTAGRAM'])).toEqual([
      'Instagram',
      'WhatsApp 1',
      'WhatsApp 2',
      'Shopify',
      'web',
      'Referido',
      'Otro',
    ]);
  });

  // La config se edita en /ventas: si sacan un canal, una OT vieja no puede
  // quedarse sin el suyo y cambiar en silencio al abrirla.
  it('conserva el canal guardado aunque ya no esté en la lista', () => {
    expect(opcionesCanal(CONFIG, 'TikTok')).toContain('TikTok');
    expect(opcionesCanal(CONFIG, 'Instagram')).toEqual(opcionesCanal(CONFIG));
  });

  it('no agrega los valores legacy como si fueran canales', () => {
    expect(opcionesCanal(CONFIG, 'Cotizador')).toEqual(opcionesCanal(CONFIG));
    expect(opcionesCanal(CONFIG, 'manual')).toEqual(opcionesCanal(CONFIG));
    expect(opcionesCanal(CONFIG, '   ')).toEqual(opcionesCanal(CONFIG));
  });
});

describe('esCanalReal / canalParaGuardar', () => {
  it('«Cotizador» y «manual» no son canales: los escribía la app', () => {
    expect(esCanalReal('Cotizador')).toBe(false);
    expect(esCanalReal('COTIZADOR')).toBe(false);
    expect(esCanalReal('manual')).toBe(false);
    expect(esCanalReal('')).toBe(false);
    expect(esCanalReal(null)).toBe(false);
  });

  it('un canal de verdad sí lo es', () => {
    expect(esCanalReal('Instagram')).toBe(true);
    expect(esCanalReal('TikTok')).toBe(true);
  });

  it('guardar limpia espacios y descarta los legacy', () => {
    expect(canalParaGuardar('  TikTok  ')).toBe('TikTok');
    expect(canalParaGuardar('Cotizador')).toBe('');
    expect(canalParaGuardar(undefined)).toBe('');
  });
});
