import { describe, expect, it } from 'vitest';
import {
  TERMINOS_DEFAULT,
  categoriasDeVentanas,
  claveTermino,
  conTerminoTarjeta,
  grupoAplica,
  hayTerminoTarjeta,
  normalizarTerminos,
  terminosParaCotizacion,
  textoTerminoTarjeta,
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
  const generales = terminosParaCotizacion(TERMINOS_DEFAULT, [], []);
  const soloA = terminosParaCotizacion(TERMINOS_DEFAULT, [], ['A']);
  const soloB = terminosParaCotizacion(TERMINOS_DEFAULT, [], ['B']);

  it('una cotización sin categoría de tela igual sale con condiciones', () => {
    expect(generales.length).toBeGreaterThan(10);
    expect(generales[0]).toContain('válida por 5 días');
    expect(generales[1]).toContain('50%');
    expect(generales.some((x) => x.includes('fenómenos naturales'))).toBe(true);
    // Nada que sea propio de una gama.
    expect(generales.some((x) => x.includes('huevo'))).toBe(false);
    expect(generales.some((x) => x.includes('DARK ROLLER'))).toBe(false);
  });

  it('la categoría A y la B traen condiciones DISTINTAS', () => {
    // Cuotas: 6 en la A, 12 en la B.
    expect(soloA.some((x) => x.includes('hasta 6 cuotas'))).toBe(true);
    expect(soloB.some((x) => x.includes('hasta 12 cuotas'))).toBe(true);
    expect(soloA.some((x) => x.includes('hasta 12 cuotas'))).toBe(false);
    expect(soloB.some((x) => x.includes('hasta 6 cuotas'))).toBe(false);
    // Garantía de instalaciones: 3 años en la A, 2 en la B.
    expect(soloA.some((x) => x.includes('Garantía de instalaciones: 3 años'))).toBe(true);
    expect(soloB.some((x) => x.includes('Garantía de instalaciones: 2 años'))).toBe(true);
    // Primera visita: con costo en la A, gratis en la B.
    expect(soloA.some((x) => x.includes('valor de $15.000'))).toBe(true);
    expect(soloB.some((x) => x.includes('SIN COSTO'))).toBe(true);
  });

  it('lo propio de cada gama no se cuela en la otra', () => {
    expect(soloA.some((x) => x.includes('DARK ROLLER'))).toBe(true);
    expect(soloA.some((x) => x.includes('GAMA ESTANDAR'))).toBe(true);
    expect(soloA.some((x) => x.includes('cenefas cuadradas u ovaladas'))).toBe(true);
    expect(soloB.some((x) => x.includes('DARK ROLLER'))).toBe(false);

    expect(soloB.some((x) => x.includes('peso cadena tipo "huevo"'))).toBe(true);
    expect(soloB.some((x) => x.includes('2,50 mts de ancho'))).toBe(true);
    expect(soloA.some((x) => x.includes('huevo'))).toBe(false);
    expect(soloA.some((x) => x.includes('CATEGORÍA B'))).toBe(false);
  });

  it('los generales van primero y son los mismos en las dos gamas', () => {
    expect(soloA.slice(0, generales.length)).toEqual(generales);
    expect(soloB.slice(0, generales.length)).toEqual(generales);
  });

  it('una cotización mixta A + B trae las dos listas', () => {
    const mixta = terminosParaCotizacion(TERMINOS_DEFAULT, [], ['A', 'B']);
    expect(mixta).toHaveLength(
      generales.length + (soloA.length - generales.length) + (soloB.length - generales.length),
    );
    expect(mixta.some((x) => x.includes('DARK ROLLER'))).toBe(true);
    expect(mixta.some((x) => x.includes('huevo'))).toBe(true);
  });

  it('cada gama tiene su término de la onda (el del botón VER EJEMPLO)', () => {
    expect(soloA.some((x) => x.includes('zuncho y corchete'))).toBe(true);
    expect(soloB.some((x) => x.includes('corte en "V"'))).toBe(true);
  });

  it('corrige el typo "LIGTH" del Excel', () => {
    const t = terminosParaCotizacion(TERMINOS_DEFAULT, [], ['A', 'B']);
    expect(t.some((x) => x.toUpperCase().includes('LIGTH'))).toBe(false);
    expect(t.some((x) => x.includes('"ROLLER SOFT LIGHT"'))).toBe(true);
  });
});

describe('el término de la tarjeta', () => {
  const PARAMS = { proveedorTarjeta: 'mercadopago', recargoTarjeta: 0.138 } as never;
  const fmtPct = (n: number) => (n * 100).toFixed(1).replace('.', ',');

  it('cada gama trae su propio término de tarjeta, así que no se agrega el automático', () => {
    expect(hayTerminoTarjeta(terminosParaCotizacion(TERMINOS_DEFAULT, [], ['A']))).toBe(true);
    expect(hayTerminoTarjeta(terminosParaCotizacion(TERMINOS_DEFAULT, [], ['B']))).toBe(true);
  });

  it('sin categoría de tela no hay término de tarjeta: lo pone la app', () => {
    expect(hayTerminoTarjeta(terminosParaCotizacion(TERMINOS_DEFAULT, [], []))).toBe(false);
  });

  it('no confunde la nota de la tarjeta de débito con un término de crédito', () => {
    expect(hayTerminoTarjeta(['Si pagas con tarjeta de débito se aplica comisión.'])).toBe(false);
  });

  it('agrega la frase automática solo cuando falta', () => {
    const auto = textoTerminoTarjeta(PARAMS, fmtPct);
    expect(conTerminoTarjeta(['Pago al contado.'], auto)).toEqual(['Pago al contado.', auto]);
    const conPropio = ['Pago: Tarjeta de crédito hasta 12 cuotas sin interés por mercadopago.'];
    expect(conTerminoTarjeta(conPropio, auto)).toEqual(conPropio);
  });

  it('la frase automática cambia con el proveedor', () => {
    expect(textoTerminoTarjeta(PARAMS, fmtPct)).toContain('Mercado Pago');
    expect(
      textoTerminoTarjeta({ proveedorTarjeta: 'flow', recargoTarjetaFlow: 0.035 } as never, fmtPct),
    ).toContain('Flow');
  });
});
