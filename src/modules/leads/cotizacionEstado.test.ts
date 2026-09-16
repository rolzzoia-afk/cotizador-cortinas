import { describe, expect, it } from 'vitest';
import {
  contarPorActualizar,
  opcionesEstadoCotizacion,
  textoEstadoCotizacion,
} from './cotizacionEstado';

const estados = (actual: Parameters<typeof opcionesEstadoCotizacion>[0]) =>
  opcionesEstadoCotizacion(actual).map((o) => o.estado);

describe('opcionesEstadoCotizacion', () => {
  it('una sin enviar se puede enviar o dejar por actualizar, nada más', () => {
    expect(estados('sin_enviar')).toEqual(['enviada', 'por_actualizar']);
  });

  it('una enviada se puede pedir actualizar, reenviar o deshacer', () => {
    expect(estados('enviada')).toEqual(['por_actualizar', 'actualizada', 'sin_enviar']);
  });

  it('una por actualizar no se ofrece a sí misma', () => {
    expect(estados('por_actualizar')).toEqual(['actualizada', 'sin_enviar']);
  });

  it('una actualizada se puede volver a enviar (cuenta otra versión)', () => {
    const ops = opcionesEstadoCotizacion('actualizada');
    expect(ops.map((o) => o.estado)).toEqual(['por_actualizar', 'actualizada', 'sin_enviar']);
    expect(ops.find((o) => o.estado === 'actualizada')?.texto).toBe('Volver a enviar actualizada');
  });

  it('«por actualizar» pide nota y «sin enviar» pide confirmación', () => {
    const ops = opcionesEstadoCotizacion('enviada');
    expect(ops.find((o) => o.estado === 'por_actualizar')?.pideNota).toBe(true);
    expect(ops.find((o) => o.estado === 'sin_enviar')?.confirma).toBe(true);
    expect(ops.find((o) => o.estado === 'actualizada')?.confirma).toBe(false);
  });
});

describe('textoEstadoCotizacion', () => {
  it('muestra la versión solo desde la segunda', () => {
    expect(textoEstadoCotizacion({ estado_cotizacion: 'enviada', cotizacion_version: 1 })).toBe('Enviada');
    expect(textoEstadoCotizacion({ estado_cotizacion: 'actualizada', cotizacion_version: 3 })).toBe(
      'Actualizada · v3',
    );
    expect(textoEstadoCotizacion({ estado_cotizacion: 'sin_enviar', cotizacion_version: 0 })).toBe('Sin enviar');
  });
});

describe('contarPorActualizar', () => {
  const leads = [
    { estado_cotizacion: 'por_actualizar' as const, asignado_a: 'a' },
    { estado_cotizacion: 'por_actualizar' as const, asignado_a: 'b' },
    { estado_cotizacion: 'enviada' as const, asignado_a: 'a' },
  ];

  it('cuenta todas sin filtro', () => {
    expect(contarPorActualizar(leads)).toBe(2);
  });

  it('cuenta solo las de una vendedora', () => {
    expect(contarPorActualizar(leads, 'a')).toBe(1);
    expect(contarPorActualizar(leads, 'c')).toBe(0);
  });
});
