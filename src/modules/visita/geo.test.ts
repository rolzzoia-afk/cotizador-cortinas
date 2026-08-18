import { describe, expect, it } from 'vitest';
import { formatoGeo, motivoGeoError, urlMapaGeo } from './geo';
import type { GeoFirma } from '@/modules/ots/types';

const geo = (extra: Partial<GeoFirma> = {}): GeoFirma => ({
  lat: -33.44821,
  lng: -70.66927,
  capturadaEl: '2026-08-18T14:30:00.000Z',
  ...extra,
});

describe('motivoGeoError', () => {
  it('traduce los tres códigos del navegador', () => {
    expect(motivoGeoError(1)).toBe('El cliente no dio permiso de ubicación');
    expect(motivoGeoError(2)).toBe('Sin señal de GPS en el lugar');
    expect(motivoGeoError(3)).toBe('El GPS demoró demasiado en responder');
  });

  it('un código desconocido (o ausente) igual da un texto legible', () => {
    // Se guarda en la OT: nunca debe quedar "undefined" ni un número suelto.
    expect(motivoGeoError(99)).toBe('No se pudo obtener la ubicación');
    expect(motivoGeoError(undefined)).toBe('No se pudo obtener la ubicación');
  });
});

describe('formatoGeo', () => {
  it('coma decimal es-CL y 5 decimales (~1 m de resolución)', () => {
    expect(formatoGeo(geo())).toBe('-33,44821, -70,66927');
  });

  it('recorta a 5 decimales lo que llega con más', () => {
    // El GPS entrega 7+ decimales (milímetros): ruido para lo que se necesita.
    expect(formatoGeo(geo({ lat: -33.4482093, lng: -70.6692651 }))).toBe(
      '-33,44821, -70,66927',
    );
  });

  it('completa con ceros una coordenada redonda', () => {
    expect(formatoGeo(geo({ lat: -33.5, lng: 70 }))).toBe('-33,50000, 70,00000');
  });

  it('agrega la precisión redondeada cuando el navegador la informa', () => {
    expect(formatoGeo(geo({ precisionM: 12.4 }))).toBe('-33,44821, -70,66927 · ±12 m');
    expect(formatoGeo(geo({ precisionM: 1650 }))).toBe('-33,44821, -70,66927 · ±1650 m');
  });
});

describe('urlMapaGeo', () => {
  it('arma el link al mapa con punto decimal (el que entiende Google)', () => {
    expect(urlMapaGeo(geo())).toBe('https://www.google.com/maps?q=-33.44821,-70.66927');
  });

  it('el link usa la coordenada COMPLETA, no la recortada de la pantalla', () => {
    const g = geo({ lat: -33.4482093, lng: -70.6692651 });
    expect(urlMapaGeo(g)).toContain('-33.4482093,-70.6692651');
  });
});
