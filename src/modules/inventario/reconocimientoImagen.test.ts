import { describe, expect, it } from 'vitest';
import {
  LADO_EMBEDDING,
  LADO_MINIATURA,
  medidasParaEmbedding,
} from './reconocimientoImagen';

describe('la tela se recorta cuadrada por el centro', () => {
  it('una foto apaisada pierde los costados, no el medio', () => {
    const r = medidasParaEmbedding(4000, 3000, 'tela');
    expect(r.sw).toBe(3000);
    expect(r.sh).toBe(3000);
    expect(r.sx).toBe(500); // (4000 - 3000) / 2
    expect(r.sy).toBe(0);
    expect(r.ancho).toBe(LADO_EMBEDDING);
    expect(r.alto).toBe(LADO_EMBEDDING);
  });

  it('una foto vertical pierde arriba y abajo', () => {
    const r = medidasParaEmbedding(3000, 4000, 'tela');
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(500);
    expect(r.sw).toBe(3000);
  });

  it('una tela ya chica no se agranda: sumaría peso sin agregar detalle', () => {
    const r = medidasParaEmbedding(600, 800, 'tela');
    expect(r.ancho).toBe(600);
    expect(r.alto).toBe(600);
  });
});

describe('el insumo va entero', () => {
  it('no se recorta: su forma completa es lo que lo identifica', () => {
    const r = medidasParaEmbedding(4000, 3000, 'insumo');
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
    expect(r.sw).toBe(4000);
    expect(r.sh).toBe(3000);
  });

  it('se achica conservando la proporción, con el lado mayor en 1024', () => {
    const r = medidasParaEmbedding(4000, 3000, 'insumo');
    expect(r.ancho).toBe(LADO_EMBEDDING);
    expect(r.alto).toBe(768);
  });

  it('una foto que ya es chica se deja igual', () => {
    const r = medidasParaEmbedding(800, 600, 'insumo');
    expect(r).toMatchObject({ ancho: 800, alto: 600 });
  });
});

describe('la miniatura sale del mismo encuadre', () => {
  it('mismo recorte, otro tamaño: la de la lista y la del motor muestran lo mismo', () => {
    const grande = medidasParaEmbedding(4000, 3000, 'tela');
    const chica = medidasParaEmbedding(4000, 3000, 'tela', LADO_MINIATURA);
    expect(chica.sx).toBe(grande.sx);
    expect(chica.sy).toBe(grande.sy);
    expect(chica.sw).toBe(grande.sw);
    expect(chica.ancho).toBe(LADO_MINIATURA);
  });
});

describe('medidas imposibles', () => {
  it('una imagen sin tamaño no revienta: devuelve cero y el llamador usa el original', () => {
    expect(medidasParaEmbedding(0, 0, 'insumo')).toMatchObject({ ancho: 0, alto: 0 });
    expect(medidasParaEmbedding(-5, 100, 'tela')).toMatchObject({ ancho: 0, alto: 0 });
  });
});
