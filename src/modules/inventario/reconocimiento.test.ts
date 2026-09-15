import { describe, expect, it } from 'vitest';
import {
  ANGULOS_GUIA,
  bandaDeSimilitud,
  faltanObligatorias,
  hayDuda,
  parsearPayloadQR,
  rutaConsulta,
  rutaFotoReconocimiento,
  rutaMiniatura,
  UMBRALES,
} from './reconocimiento';

describe('bandas de parecido', () => {
  it('reparte en las tres bandas por los umbrales', () => {
    expect(bandaDeSimilitud(0.95)).toBe('seguro');
    expect(bandaDeSimilitud(UMBRALES.seguro)).toBe('seguro');
    expect(bandaDeSimilitud(0.7)).toBe('probable');
    expect(bandaDeSimilitud(UMBRALES.posible)).toBe('probable');
    expect(bandaDeSimilitud(0.5)).toBe('dudoso');
    expect(bandaDeSimilitud(0)).toBe('dudoso');
  });
});

describe('cuándo se pide la segunda opinión', () => {
  it('sin nada parecido NO se pregunta: no habría entre qué elegir', () => {
    expect(hayDuda([])).toBe(false);
    expect(hayDuda([0.3, 0.2])).toBe(false);
  });

  it('un candidato que no llega a «seguro» se consulta', () => {
    expect(hayDuda([0.7, 0.4])).toBe(true);
  });

  it('dos candidatos empatados se consultan aunque el primero sea alto', () => {
    // El caso de los dos tamaños del mismo kit: 0,91 y 0,89 no los distingue.
    expect(hayDuda([0.91, 0.89])).toBe(true);
  });

  it('un ganador claro y despegado no gasta la segunda opinión', () => {
    expect(hayDuda([0.93, 0.6])).toBe(false);
  });
});

describe('el QR de la etiqueta', () => {
  it('lee las etiquetas que imprime la app', () => {
    expect(parsearPayloadQR('INS:MEC32')).toEqual({ dominio: 'insumo', cod: 'MEC32' });
    expect(parsearPayloadQR('TEL:BK 24')).toEqual({ dominio: 'tela', cod: 'BK 24' });
  });

  it('normaliza como el resto del sistema: el insumo sin espacios, la tela con uno solo', () => {
    expect(parsearPayloadQR('ins: mec 32-bco')).toEqual({ dominio: 'insumo', cod: 'MEC32-BCO' });
    expect(parsearPayloadQR('TEL:  bk   24 ')).toEqual({ dominio: 'tela', cod: 'BK 24' });
  });

  it('una ubicación de rack NO es un artículo', () => {
    expect(parsearPayloadQR('LOC:A-12')).toBeNull();
  });

  it('un texto cualquiera no se interpreta: mejor reconocer por la foto', () => {
    expect(parsearPayloadQR('MEC32')).toBeNull();
    expect(parsearPayloadQR('https://rolzzo.com')).toBeNull();
    expect(parsearPayloadQR('')).toBeNull();
    expect(parsearPayloadQR(null)).toBeNull();
  });
});

describe('los ángulos que se piden al enseñar', () => {
  it('las dos primeras tomas son obligatorias', () => {
    expect(ANGULOS_GUIA.filter((a) => a.obligatorio).map((a) => a.id)).toEqual(['frente', 'lado']);
  });

  it('cuenta lo que falta para poder cerrar', () => {
    expect(faltanObligatorias([])).toBe(2);
    expect(faltanObligatorias(['frente'])).toBe(1);
    expect(faltanObligatorias(['frente', 'lado', 'etiqueta'])).toBe(0);
  });
});

describe('dónde se guarda cada foto', () => {
  const EMPRESA = '67c635a5-152c-4780-a066-23f5081175a9';

  it('la primera carpeta es la empresa: es lo único que mira la política del bucket', () => {
    const p = rutaFotoReconocimiento(EMPRESA, 'insumo', 'MEC32', 'frente', 1758000000000);
    expect(p.split('/')[0]).toBe(EMPRESA);
    expect(p).toBe(`${EMPRESA}/insumo/MEC32/1758000000000_frente.jpg`);
    expect(rutaConsulta(EMPRESA).split('/')[0]).toBe(EMPRESA);
  });

  it('un código con barra o espacio no puede inventar carpetas', () => {
    const p = rutaFotoReconocimiento(EMPRESA, 'tela', 'BK 24/X', 'lado', 1);
    expect(p).toBe(`${EMPRESA}/tela/BK_24_X/1_lado.jpg`);
    expect(p.split('/')).toHaveLength(4);
  });

  it('la miniatura va al lado de su foto', () => {
    expect(rutaMiniatura('e/insumo/MEC32/1_frente.jpg')).toBe('e/insumo/MEC32/1_frente_min.jpg');
  });
});
