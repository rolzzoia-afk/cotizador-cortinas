import { describe, expect, it } from 'vitest';
import {
  convieneSincronizar,
  mensajeErrorCompras,
  mensajeSincronizacion,
  textoDesdeSync,
} from './comprasMensajes';

// ── Mensajes ─────────────────────────────────────────────────────────

describe('mensajeErrorCompras', () => {
  it('manda el mensaje que escribió la función, que es el que dice el detalle', () => {
    expect(mensajeErrorCompras('CO008', 'No existe el artículo ZZZ99 (insumo)')).toBe(
      'No existe el artículo ZZZ99 (insumo)',
    );
  });
  it('sin mensaje propio usa el genérico del código', () => {
    expect(mensajeErrorCompras('CO000')).toContain('apagado');
    expect(mensajeErrorCompras('CO004')).toContain('ya se recibió');
    expect(mensajeErrorCompras('co007')).toContain('firma');
  });
  it('un código desconocido no deja al operario sin explicación', () => {
    expect(mensajeErrorCompras('XX999')).toBe('No se pudo completar la operación.');
    expect(mensajeErrorCompras()).toBe('No se pudo completar la operación.');
  });
});

describe('mensajeSincronizacion', () => {
  it('dice qué llegó de Finanzas', () => {
    expect(mensajeSincronizacion({ nuevas: 0, actualizadas: 0 })).toBe('No hay órdenes nuevas.');
    expect(mensajeSincronizacion({ nuevas: 1, actualizadas: 0 })).toBe('1 orden nueva');
    expect(mensajeSincronizacion({ nuevas: 3, actualizadas: 12 })).toBe('3 órdenes nuevas · 12 al día');
    expect(mensajeSincronizacion({ nuevas: 2, actualizadas: 0, vinculadas: 5 })).toBe(
      '2 órdenes nuevas · 5 líneas vinculadas solas',
    );
  });
});

describe('textoDesdeSync y convieneSincronizar', () => {
  const ahora = new Date('2026-09-12T12:00:00Z');
  it('cuenta cuánto hace que se habló con Finanzas', () => {
    expect(textoDesdeSync('2026-09-12T11:48:00Z', ahora)).toBe('hace 12 min');
    expect(textoDesdeSync('2026-09-12T11:59:40Z', ahora)).toBe('recién');
    expect(textoDesdeSync('2026-09-12T08:00:00Z', ahora)).toBe('hace 4 h');
    expect(textoDesdeSync('2026-09-10T12:00:00Z', ahora)).toBe('hace 2 días');
    expect(textoDesdeSync(null, ahora)).toBe('nunca');
  });
  it('vuelve a preguntar pasados 10 minutos, y siempre si nunca se preguntó', () => {
    expect(convieneSincronizar(null, ahora)).toBe(true);
    expect(convieneSincronizar('2026-09-12T11:55:00Z', ahora)).toBe(false);
    expect(convieneSincronizar('2026-09-12T11:45:00Z', ahora)).toBe(true);
  });
});
