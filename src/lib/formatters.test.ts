import { describe, it, expect } from 'vitest';
import { formatCLP, formatNumber, formatDate, formatDateTime } from './formatters';

describe('formatCLP', () => {
  it('formatea enteros en CLP con símbolo $', () => {
    expect(formatCLP(1234567)).toMatch(/\$/);
    expect(formatCLP(1234567)).toContain('1');
  });

  it('redondea sin decimales', () => {
    expect(formatCLP(1999.9)).not.toContain(',');
    expect(formatCLP(1999.9)).not.toContain('.9');
  });

  it('usa locale es-CL (separador miles con punto)', () => {
    const out = formatCLP(1000000);
    expect(out).toContain('1.000.000');
  });

  it('retorna — para null/undefined', () => {
    expect(formatCLP(null)).toBe('—');
    expect(formatCLP(undefined)).toBe('—');
  });

  it('formatea 0 correctamente (no null)', () => {
    expect(formatCLP(0)).toMatch(/\$/);
    expect(formatCLP(0)).toContain('0');
  });
});

describe('formatNumber', () => {
  it('formatea con separador es-CL', () => {
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(1234567)).toBe('1.234.567');
  });

  it('retorna — para null/undefined', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });

  it('preserva 0 (no null-pass)', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

// Nota: Intl.DateTimeFormat en node usa ICU compacto ("-" como separador)
// mientras que navegadores usan full-ICU ("/"). Testeamos por piezas, no por
// separador exacto, para que los tests sean portables.
describe('formatDate', () => {
  it('incluye día, mes y año al formatear Date object', () => {
    const out = formatDate(new Date(2026, 0, 15));
    expect(out).toContain('15');
    expect(out).toContain('01');
    expect(out).toContain('2026');
  });

  it('parsea ISO string', () => {
    const out = formatDate('2026-01-15T12:00:00Z');
    expect(out).toMatch(/\d{2}.\d{2}.2026/);
  });

  it('retorna — para null/undefined/string vacía', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('retorna — para fecha inválida', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('incluye fecha + hora + minuto', () => {
    const out = formatDateTime(new Date(2026, 0, 15, 14, 30));
    expect(out).toContain('15');
    expect(out).toContain('2026');
    // hora/minuto: 14:30 (24h) o 02:30 p.m. (12h) dependiendo del ICU.
    expect(out).toMatch(/14:30|2:30/);
  });

  it('retorna — para fechas inválidas', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('wat')).toBe('—');
  });
});
