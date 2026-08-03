import { describe, expect, it } from 'vitest';
import {
  TERMINOS_DEFAULT,
  categoriasDeVentanas,
  claveTermino,
  grupoAplica,
  normalizarTerminos,
  terminosParaCotizacion,
  type ConfigTerminos,
} from './terminos';

const CONFIG: ConfigTerminos = {
  grupos: [
    { id: 'gen', nombre: 'General', siempre: true, terminos: ['Cotización válida por 5 días.', 'Pago 50% / 50%.'] },
    { id: 'premium', nombre: 'Gama premium', telas: ['A'], terminos: ['Garantía 5 años en mecanismos.', 'Pago 50% / 50%.'] },
    { id: 'estandar', nombre: 'Gama estándar', telas: ['B'], terminos: ['Ancho máximo 2,50 m.'] },
    { id: 'bb', nombre: 'Bee-black', categorias: ['BEEBLACK'], terminos: ['El bee-black se instala en 20 días hábiles.'] },
    { id: 'dark', nombre: 'Dark', categorias: ['DARK_38mm', 'DARK_45mm'], terminos: ['DARK ROLLER se instala entre 18 y 25 días hábiles.'] },
  ],
};

describe('terminosParaCotizacion', () => {
  it('solo cortinas de tela A: general + premium', () => {
    const t = terminosParaCotizacion(CONFIG, ['ROL'], ['A']);
    expect(t).toEqual([
      'Cotización válida por 5 días.',
      'Pago 50% / 50%.',
      'Garantía 5 años en mecanismos.',
    ]);
  });

  it('el término repetido entre dos grupos sale UNA sola vez', () => {
    const t = terminosParaCotizacion(CONFIG, ['ROL'], ['A']);
    expect(t.filter((x) => x === 'Pago 50% / 50%.')).toHaveLength(1);
  });

  it('al sumar un beeblack se agregan SUS términos a los de la otra categoría', () => {
    const solo = terminosParaCotizacion(CONFIG, ['ROL'], ['A']);
    const conBb = terminosParaCotizacion(CONFIG, ['ROL', 'BEEBLACK'], ['A']);
    expect(conBb.slice(0, solo.length)).toEqual(solo);
    expect(conBb).toContain('El bee-black se instala en 20 días hábiles.');
    expect(conBb).toHaveLength(solo.length + 1);
  });

  it('cotización mixta A + B trae las dos gamas', () => {
    const t = terminosParaCotizacion(CONFIG, ['ROL'], ['A', 'B']);
    expect(t).toContain('Garantía 5 años en mecanismos.');
    expect(t).toContain('Ancho máximo 2,50 m.');
  });

  it('un DARK 45 dispara el grupo que lista ambas variantes', () => {
    const t = terminosParaCotizacion(CONFIG, ['DARK_45mm'], []);
    expect(t).toContain('DARK ROLLER se instala entre 18 y 25 días hábiles.');
  });

  it('sin categorías solo quedan los grupos "siempre"', () => {
    expect(terminosParaCotizacion(CONFIG, [], [])).toEqual([
      'Cotización válida por 5 días.',
      'Pago 50% / 50%.',
    ]);
  });

  it('dedupe insensible a mayúsculas, acentos, espacios y punto final', () => {
    const cfg: ConfigTerminos = {
      grupos: [
        { id: 'a', nombre: 'A', siempre: true, terminos: ['Pago  al  contado.'] },
        { id: 'b', nombre: 'B', siempre: true, terminos: ['PAGO AL CONTADO'] },
      ],
    };
    expect(terminosParaCotizacion(cfg, [], [])).toEqual(['Pago  al  contado.']);
  });
});

describe('grupoAplica', () => {
  it('"siempre" gana sobre cualquier filtro', () => {
    expect(grupoAplica({ id: 'x', nombre: 'x', siempre: true, terminos: [] }, [], [])).toBe(true);
  });

  it('un grupo sin asignación NO aplica (está a medio configurar)', () => {
    expect(grupoAplica({ id: 'x', nombre: 'x', terminos: ['t'] }, ['ROL'], ['A'])).toBe(false);
  });

  it('la categoría de producto compara sin distinguir mayúsculas', () => {
    const g = { id: 'x', nombre: 'x', categorias: ['beeblack'], terminos: ['t'] };
    expect(grupoAplica(g, ['BEEBLACK'], [])).toBe(true);
  });
});

describe('categoriasDeVentanas', () => {
  it('devuelve el set ordenado, sin vacíos ni repetidos', () => {
    expect(
      categoriasDeVentanas([
        { categoria: 'ROL' },
        { categoria: 'BEEBLACK' },
        { categoria: 'ROL' },
        { categoria: '' },
        { categoria: null },
        {},
      ]),
    ).toEqual(['BEEBLACK', 'ROL']);
  });

  it('tolera null/undefined', () => {
    expect(categoriasDeVentanas(null)).toEqual([]);
    expect(categoriasDeVentanas(undefined)).toEqual([]);
  });
});

describe('normalizarTerminos', () => {
  it('sin datos cae al default (la cotización nunca queda sin condiciones)', () => {
    expect(normalizarTerminos(null)).toBe(TERMINOS_DEFAULT);
    expect(normalizarTerminos({})).toBe(TERMINOS_DEFAULT);
    expect(normalizarTerminos({ grupos: [] })).toBe(TERMINOS_DEFAULT);
    expect(normalizarTerminos({ grupos: 'nope' })).toBe(TERMINOS_DEFAULT);
  });

  it('limpia términos vacíos, garantiza arrays y descarta grupos sin id', () => {
    const out = normalizarTerminos({
      grupos: [
        { id: 'a', nombre: '', terminos: ['  uno  ', '', '   '], siempre: 'sí' },
        { id: '', nombre: 'sin id', terminos: ['x'] },
        { id: 'b', terminos: null, categorias: [' beeblack '] },
      ],
    });
    expect(out.grupos).toHaveLength(2);
    expect(out.grupos[0]).toMatchObject({ id: 'a', nombre: 'a', terminos: ['uno'], siempre: false });
    expect(out.grupos[0].telas).toEqual([]);
    expect(out.grupos[1]).toMatchObject({ id: 'b', terminos: [], categorias: ['BEEBLACK'] });
  });
});

describe('claveTermino', () => {
  it('normaliza acentos, espacios y puntuación final', () => {
    expect(claveTermino('  Garantía   5 años.  ')).toBe('GARANTIA 5 ANOS');
    expect(claveTermino('Garantia 5 anos')).toBe('GARANTIA 5 ANOS');
  });
});

describe('TERMINOS_DEFAULT', () => {
  it('replica el texto que estaba cableado en la cotización', () => {
    const t = terminosParaCotizacion(TERMINOS_DEFAULT, [], []);
    expect(t).toHaveLength(5);
    expect(t[0]).toContain('válida por 5 días');
    expect(t[1]).toContain('50%');
  });
});
