import { describe, expect, it } from 'vitest';
import {
  deletreoACodigo,
  matchOpcion,
  normalizarVoz,
  parsearCodigoTela,
  parsearComando,
  parsearEntero,
  parsearMedida,
  parsearOrdinal,
  type OpcionVoz,
} from './vozParsers';
import type { CatalogoProductos } from '../types';

describe('normalizarVoz', () => {
  it('saca tildes, mayúsculas y puntuación', () => {
    expect(normalizarVoz('¿Rodapié, sí?')).toBe('rodapie si');
  });

  it('la coma entre dígitos se conserva como punto decimal', () => {
    expect(normalizarVoz('mide 1,85 metros.')).toBe('mide 1.85 metros');
  });
});

describe('parsearMedida — metros', () => {
  const casos: [string, string][] = [
    ['1,85', '1.85'],
    ['1.85', '1.85'],
    ['185', '1.85'],
    ['90', '0.9'],
    ['uno coma ochenta y cinco', '1.85'],
    ['un metro ochenta y cinco', '1.85'],
    ['un metro y medio', '1.5'],
    ['dos metros diez', '2.1'],
    ['ochenta centímetros', '0.8'],
    ['doce', '0.12'],
    ['dos', '2'],
    ['ciento ochenta y cinco', '1.85'],
    ['2,30 metros', '2.3'],
  ];
  for (const [dicho, esperado] of casos) {
    it(`«${dicho}» → ${esperado}`, () => {
      const r = parsearMedida(dicho, 'm');
      expect(r.ok && r.valor).toBe(esperado);
    });
  }

  it('lo que no es número no se inventa', () => {
    const r = parsearMedida('hola', 'm');
    expect(r).toEqual({ ok: false, motivo: 'no-numero' });
  });

  it('una medida imposible se rechaza para volver a preguntar', () => {
    const r = parsearMedida('cincuenta metros', 'm');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toBe('fuera-de-rango');
  });
});

describe('parsearMedida — centímetros', () => {
  it('«quince» son 15 cm', () => {
    const r = parsearMedida('quince', 'cm');
    expect(r.ok && r.valor).toBe('15');
  });

  it('«ciento veinte centímetros» son 120 cm', () => {
    const r = parsearMedida('ciento veinte centímetros', 'cm');
    expect(r.ok && r.valor).toBe('120');
  });

  it('«un metro y medio» dicho en un campo en cm son 150', () => {
    const r = parsearMedida('un metro y medio', 'cm');
    expect(r.ok && r.valor).toBe('150');
  });
});

describe('parsearEntero', () => {
  it('«dos» son 2', () => expect(parsearEntero('dos')).toEqual({ ok: true, valor: 2 }));
  it('«ninguna» son 0', () => expect(parsearEntero('ninguna')).toEqual({ ok: true, valor: 0 }));
  it('«no» son 0', () => expect(parsearEntero('no')).toEqual({ ok: true, valor: 0 }));
  it('«cero» son 0', () => expect(parsearEntero('cero')).toEqual({ ok: true, valor: 0 }));
  it('«muchas» no es un número', () => expect(parsearEntero('muchas').ok).toBe(false));
});

describe('matchOpcion', () => {
  const cenefa: OpcionVoz[] = [
    { value: 'No', label: 'No', sinonimos: ['no lleva'] },
    { value: 'Ovalada', label: 'Ovalada' },
    { value: 'Cuadrada a muro', label: 'Cuadrada a muro' },
    { value: 'Cuadrada a techo', label: 'Cuadrada a techo' },
  ];

  it('la frase exacta gana', () => {
    const r = matchOpcion('ovalada', cenefa);
    expect(r.tipo === 'unica' && r.opcion.value).toBe('Ovalada');
  });

  it('«cuadrada» a secas queda ambigua entre muro y techo', () => {
    const r = matchOpcion('cuadrada', cenefa);
    expect(r.tipo).toBe('ambigua');
    expect(r.tipo === 'ambigua' && r.opciones.map((o) => o.value)).toEqual([
      'Cuadrada a muro',
      'Cuadrada a techo',
    ]);
  });

  it('la opción entera dentro de la frase gana', () => {
    const r = matchOpcion('ponle cuadrada a techo', cenefa);
    expect(r.tipo === 'unica' && r.opcion.value).toBe('Cuadrada a techo');
  });

  it('«que sea externo» elige Externo', () => {
    const armado: OpcionVoz[] = [
      { value: 'Interno', label: 'Interno', sinonimos: ['interior'] },
      { value: 'Externo', label: 'Externo', sinonimos: ['exterior'] },
    ];
    const r = matchOpcion('que sea externo', armado);
    expect(r.tipo === 'unica' && r.opcion.value).toBe('Externo');
  });

  it('el sinónimo también sirve', () => {
    const material: OpcionVoz[] = [
      { value: 'VULCANITA', label: 'VULCANITA', sinonimos: ['yeso'] },
      { value: 'CONCRETO', label: 'CONCRETO', sinonimos: ['hormigon'] },
    ];
    const r = matchOpcion('es de yeso', material);
    expect(r.tipo === 'unica' && r.opcion.value).toBe('VULCANITA');
  });

  it('lo que no se parece a nada no elige nada', () => {
    expect(matchOpcion('pieza uno', cenefa).tipo).toBe('nada');
  });
});

describe('parsearOrdinal', () => {
  it('«la primera» es 1', () => expect(parsearOrdinal('la primera')).toBe(1));
  it('«dos» es 2', () => expect(parsearOrdinal('dos')).toBe(2));
  it('«el tercero» es 3', () => expect(parsearOrdinal('el tercero')).toBe(3));
  it('«blanco» no es un ordinal', () => expect(parsearOrdinal('blanco')).toBe(null));
});

describe('parsearComando', () => {
  it('reconoce la orden completa', () => {
    expect(parsearComando('siguiente')?.comando).toBe('siguiente');
  });

  it('«derecha» NO es «de nuevo»', () => {
    expect(parsearComando('derecha')).toBe(null);
  });

  it('«corregir ancho» trae el campo', () => {
    expect(parsearComando('corregir ancho')).toEqual({ comando: 'corregir', resto: 'ancho' });
  });

  it('«no» solo es comando cuando se está confirmando', () => {
    expect(parsearComando('no')).toBe(null);
    expect(parsearComando('no', { enConfirmacion: true })?.comando).toBe('no');
  });

  it('en texto libre solo vale la orden exacta', () => {
    expect(parsearComando('para el living', { soloExacto: true })).toBe(null);
    expect(parsearComando('parar', { soloExacto: true })?.comando).toBe('parar');
  });
});

describe('deletreoACodigo', () => {
  it('«be ka diez» es BK 10', () => expect(deletreoACodigo('be ka diez')).toBe('BK 10'));
  it('«ese ce erre cinco» es SCR 5', () => expect(deletreoACodigo('ese ce erre cinco')).toBe('SCR 5'));
  it('sin letras deletreadas no devuelve nada', () => expect(deletreoACodigo('quince')).toBe(''));
});

describe('parsearCodigoTela', () => {
  const catalogo = {
    'BK 10': { producto: 'BLACKOUT BLANCO', tipo: 'PREMIUM', cod: 'BLACKOUT' },
    'BK 11': { producto: 'BLACKOUT NEGRO', tipo: 'PREMIUM', cod: 'BLACKOUT' },
    'SCR 5': { producto: 'SCREEN GRIS', tipo: 'STANDARD', cod: 'SCREEN' },
    ACC01: { producto: 'SOPORTE', tipo: 'ACCESORIO', cod: 'ACCESORIO' },
  } as unknown as CatalogoProductos;

  it('el código dicho tal cual', () => {
    const r = parsearCodigoTela('bk 10', catalogo);
    expect(r.tipo === 'unica' && r.opcion.codInt).toBe('BK 10');
  });

  it('el código deletreado', () => {
    const r = parsearCodigoTela('be ka diez', catalogo);
    expect(r.tipo === 'unica' && r.opcion.codInt).toBe('BK 10');
  });

  it('el nombre del producto', () => {
    const r = parsearCodigoTela('screen gris', catalogo);
    if (r.tipo === 'unica') expect(r.opcion.codInt).toBe('SCR 5');
    else if (r.tipo === 'ambigua') expect(r.opciones[0].codInt).toBe('SCR 5');
    else throw new Error('la tela dictada por su nombre tiene que encontrarse');
  });

  it('«blackout» a secas deja elegir entre las dos', () => {
    const r = parsearCodigoTela('blackout', catalogo);
    expect(r.tipo).toBe('ambigua');
    expect(r.tipo === 'ambigua' && r.opciones.length).toBe(2);
  });

  it('los accesorios no son telas', () => {
    expect(parsearCodigoTela('soporte', catalogo).tipo).toBe('nada');
  });
});
