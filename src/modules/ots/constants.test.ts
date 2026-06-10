// Tests de las plantillas de WhatsApp multi-empresa.
import { describe, expect, it } from 'vitest';
import { WHATSAPP_MESSAGES, formatTelefonoWhatsApp } from './constants';

describe('WHATSAPP_MESSAGES', () => {
  it('sin empresa usa el default histórico (Cortinas Rolzzo)', () => {
    const msg = WHATSAPP_MESSAGES.cotizacion('Juana', '3024');
    expect(msg).toContain('Juana');
    expect(msg).toContain('3024');
    expect(msg).toContain('Cortinas Rolzzo');
  });

  it('con empresa usa el nombre del tenant en TODOS los estados', () => {
    const estados = Object.keys(WHATSAPP_MESSAGES) as (keyof typeof WHATSAPP_MESSAGES)[];
    for (const estado of estados) {
      const msg = WHATSAPP_MESSAGES[estado]('Juana', '3024', 'Cortinas del Sur');
      expect(msg, `estado ${estado}`).toContain('Cortinas del Sur');
      expect(msg, `estado ${estado}`).not.toContain('Rolzzo');
    }
  });
});

describe('formatTelefonoWhatsApp', () => {
  it('normaliza formatos chilenos comunes', () => {
    expect(formatTelefonoWhatsApp('912345678')).toBe('56912345678');
    expect(formatTelefonoWhatsApp('+56 9 1234 5678')).toBe('56912345678');
    expect(formatTelefonoWhatsApp('12345678')).toBe('56912345678');
    expect(formatTelefonoWhatsApp('')).toBe('');
  });
});
