import { describe, expect, it } from 'vitest';
import type { FamiliaInsumo } from './codigosInsumo';
import type { Validador } from './helpers';
import {
  avisosDeFamilia,
  CAMPOS_VALIDADOR,
  coloresSinAbreviatura,
  mapaDeValidadores,
  maximoPorPrefijo,
  normalizarValorValidador,
  ordenarFamilias,
  problemaPrefijoNuevo,
  problemaValorNuevo,
  valoresHuerfanos,
} from './validadores';

function val(campo: string, valor: string, activo?: boolean | null): Validador {
  return { campo, valor, orden: null, activo };
}

function fam(p: Partial<FamiliaInsumo> & { prefijo: string }): FamiliaInsumo {
  return {
    nombre: p.prefijo,
    categoria: null,
    sub_categoria: null,
    digitos: 2,
    siguiente: 1,
    activo: true,
    descripcion: null,
    ...p,
  };
}

describe('normalizarValorValidador', () => {
  it('deja mayúsculas y colapsa los espacios', () => {
    expect(normalizarValorValidador('  tirro /  scotch ')).toBe('TIRRO / SCOTCH');
    expect(normalizarValorValidador('botas de seg.')).toBe('BOTAS DE SEG.');
  });

  it('tolera null y undefined', () => {
    expect(normalizarValorValidador(null)).toBe('');
    expect(normalizarValorValidador(undefined)).toBe('');
  });
});

describe('mapaDeValidadores', () => {
  const filas = [
    val('COLOR', 'BLANCO'),
    val('COLOR', 'NEGRO', true),
    val('COLOR', 'FUCSIA', false),
    val('SUB_CATEGORIA', 'MECANISMO', null),
    val('SUB_CATEGORIA', 'MECANISMO'),
    val('', 'SIN CAMPO'),
    val('COLOR', '   '),
  ];

  it('agrupa por campo respetando el orden de llegada', () => {
    expect(mapaDeValidadores(filas).COLOR).toEqual(['BLANCO', 'NEGRO']);
  });

  it('deja fuera los desactivados pero no los que tienen activo nulo', () => {
    const m = mapaDeValidadores(filas);
    expect(m.COLOR).not.toContain('FUCSIA');
    expect(m.SUB_CATEGORIA).toEqual(['MECANISMO']);
  });

  it('ignora filas sin campo o sin valor, y tolera la lista vacía', () => {
    expect(mapaDeValidadores(filas)['']).toBeUndefined();
    expect(mapaDeValidadores(null)).toEqual({});
    expect(mapaDeValidadores([])).toEqual({});
  });
});

describe('valoresHuerfanos', () => {
  // Este es el hueco que originó el desorden: los datos usaban 40
  // subcategorías y el formulario ofrecía 8.
  const filas = [val('SUB_CATEGORIA', 'MECANISMO'), val('SUB_CATEGORIA', 'CADENA')];

  it('encuentra lo que los artículos usan y el formulario no ofrece', () => {
    const fuera = valoresHuerfanos('SUB_CATEGORIA', ['MECANISMO', 'TORNILLERIA', 'MANGA'], filas);
    expect(fuera).toEqual(['MANGA', 'TORNILLERIA']);
  });

  it('compara normalizado, así que «mecanismo» no aparece como huérfano', () => {
    expect(valoresHuerfanos('SUB_CATEGORIA', ['  mecanismo '], filas)).toEqual([]);
  });

  it('ignora vacíos y no repite', () => {
    expect(valoresHuerfanos('SUB_CATEGORIA', ['MANGA', 'MANGA', '', null], filas)).toEqual([
      'MANGA',
    ]);
  });

  it('un valor desactivado NO es huérfano: la fila que lo usa sigue siendo válida', () => {
    const conBaja = [...filas, val('SUB_CATEGORIA', 'PESO', false)];
    expect(valoresHuerfanos('SUB_CATEGORIA', ['PESO'], conBaja)).toEqual([]);
  });
});

describe('problemaValorNuevo', () => {
  const filas = [val('COLOR', 'BLANCO')];

  it('rechaza el vacío y el repetido', () => {
    expect(problemaValorNuevo('  ', 'COLOR', filas)).toMatch(/escribe/i);
    expect(problemaValorNuevo('blanco', 'COLOR', filas)).toMatch(/ya está/i);
  });

  it('acepta uno nuevo, y el mismo texto en otro campo', () => {
    expect(problemaValorNuevo('CRUDO', 'COLOR', filas)).toBeNull();
    expect(problemaValorNuevo('BLANCO', 'PRODUCTO', filas)).toBeNull();
  });

  it('rechaza un valor absurdamente largo', () => {
    expect(problemaValorNuevo('X'.repeat(61), 'COLOR', filas)).toMatch(/largo/i);
  });
});

describe('coloresSinAbreviatura', () => {
  it('lista solo los que no tienen tres letras definidas', () => {
    expect(coloresSinAbreviatura(['BLANCO', 'AZUL', 'CRUDO', 'NEGRO'])).toEqual(['AZUL', 'CRUDO']);
  });

  it('no cuenta los que sí tienen, aunque vengan con tilde o en minúscula', () => {
    expect(coloresSinAbreviatura(['café', 'CAFÉ', 'Metálico', 'madera'])).toEqual([]);
  });

  it('N/A y los vacíos no son colores', () => {
    expect(coloresSinAbreviatura(['N/A', '', null, undefined, '  '])).toEqual([]);
  });
});

describe('maximoPorPrefijo', () => {
  it('toma el número más alto de cada prefijo', () => {
    const m = maximoPorPrefijo(['MEC01', 'MEC45', 'INS99', 'INS100', 'E80']);
    expect(m.get('MEC')).toBe(45);
    expect(m.get('INS')).toBe(100); // INS100 > INS99, aunque en texto ordene al revés
    expect(m.get('E')).toBe(80);
  });

  it('cuenta los que llevan sufijo y descarta lo que no tiene forma', () => {
    const m = maximoPorPrefijo(['MEC44-B', 'MEC02', 'DOM 18', '', null, 'SOLOLETRAS']);
    expect(m.get('MEC')).toBe(44);
    expect(m.has('DOM')).toBe(false); // «DOM 18» con espacio no calza: por eso se corrigió
    expect(m.has('SOLOLETRAS')).toBe(false);
  });
});

describe('problemaPrefijoNuevo', () => {
  const familias = [fam({ prefijo: 'MEC' })];

  it('acepta 1 a 4 letras', () => {
    expect(problemaPrefijoNuevo('TOR', familias)).toBeNull();
    expect(problemaPrefijoNuevo('e', familias)).toBeNull();
    expect(problemaPrefijoNuevo('WALL', familias)).toBeNull();
  });

  it('rechaza vacío, con números, con espacios, de más de 4 y repetido', () => {
    expect(problemaPrefijoNuevo('', familias)).toMatch(/escribe/i);
    expect(problemaPrefijoNuevo('MEC1', familias)).toMatch(/letras/i);
    expect(problemaPrefijoNuevo('ME C', familias)).toMatch(/letras/i);
    expect(problemaPrefijoNuevo('LARGO', familias)).toMatch(/letras/i);
    expect(problemaPrefijoNuevo('mec', familias)).toMatch(/ya existe/i);
  });
});

describe('avisosDeFamilia', () => {
  it('no dice nada cuando el correlativo va por delante', () => {
    expect(avisosDeFamilia(fam({ prefijo: 'MEC', siguiente: 46 }), 45)).toEqual([]);
  });

  it('avisa si el próximo número ya está ocupado', () => {
    const [a] = avisosDeFamilia(fam({ prefijo: 'MEC', siguiente: 40 }), 45);
    expect(a).toContain('MEC40');
    expect(a).toContain('45');
  });

  it('avisa cuando la familia pasó de 99 y sigue en 2 dígitos', () => {
    const avisos = avisosDeFamilia(fam({ prefijo: 'INS', siguiente: 265, digitos: 2 }), 264);
    expect(avisos.join(' ')).toMatch(/3 dígitos/);
  });

  it('con 3 dígitos y más de 99 no protesta', () => {
    expect(avisosDeFamilia(fam({ prefijo: 'INS', siguiente: 265, digitos: 3 }), 264)).toEqual([]);
  });

  it('rechaza un correlativo bajo cero y unos dígitos inventados', () => {
    const avisos = avisosDeFamilia(fam({ prefijo: 'X', siguiente: 0, digitos: 4 }), undefined);
    expect(avisos.join(' ')).toMatch(/1 o más/);
    expect(avisos.join(' ')).toMatch(/2 o 3/);
  });

  it('desactivar deja aviso, porque saca la familia del alta', () => {
    const avisos = avisosDeFamilia(fam({ prefijo: 'SLM', siguiente: 4, activo: false }), 3);
    expect(avisos.join(' ')).toMatch(/deja de ofrecerse/i);
  });

  it('una familia recién creada, sin códigos todavía, no genera avisos', () => {
    expect(avisosDeFamilia(fam({ prefijo: 'NUE', siguiente: 1 }), undefined)).toEqual([]);
  });
});

describe('ordenarFamilias', () => {
  it('las activas primero y después por prefijo', () => {
    const orden = ordenarFamilias([
      fam({ prefijo: 'TOR' }),
      fam({ prefijo: 'SLM', activo: false }),
      fam({ prefijo: 'CAD' }),
    ]).map((f) => f.prefijo);
    expect(orden).toEqual(['CAD', 'TOR', 'SLM']);
  });

  it('no modifica el arreglo que recibe', () => {
    const original = [fam({ prefijo: 'TOR' }), fam({ prefijo: 'CAD' })];
    ordenarFamilias(original);
    expect(original.map((f) => f.prefijo)).toEqual(['TOR', 'CAD']);
  });
});

describe('CAMPOS_VALIDADOR', () => {
  it('los tres que importan van primero: categoría, subcategoría y color', () => {
    expect(CAMPOS_VALIDADOR.slice(0, 3).map((c) => c.campo)).toEqual([
      'CATEGORIA',
      'SUB_CATEGORIA',
      'COLOR',
    ]);
  });

  it('no repite campos y todos tienen título y explicación', () => {
    const campos = CAMPOS_VALIDADOR.map((c) => c.campo);
    expect(new Set(campos).size).toBe(campos.length);
    expect(CAMPOS_VALIDADOR.every((c) => c.titulo && c.hint)).toBe(true);
  });
});
