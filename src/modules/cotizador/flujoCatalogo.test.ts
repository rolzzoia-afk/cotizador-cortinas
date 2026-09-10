import { describe, expect, it } from 'vitest';
import { avisosCatalogo, esCortinaTipo, flujoDeProducto } from './flujoCatalogo';
import { REGLAS_PRECIOS_DEFAULT } from './reglasPrecios';
import { cotizarFase0, precioMlPorCod } from './motorFase0';
import type { CatalogoProductos, Producto } from './types';

const prod = (over: Partial<Producto> = {}): Producto => ({
  cod: 'BLACKOUT_D',
  producto: 'ROLLER BLACKOUT DELUX',
  tipo: 'DELUX',
  descripcion: 'RUSTICO LINO',
  precio: 27176,
  ...over,
});

const CAT: CatalogoProductos = {
  'BK-D': prod({ precio: 31000 }),
  'BK 09': prod({ precio: 27176 }),
  'BK 10': prod({ precio: 23782 }),
  'SC-P': prod({ cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', precio: 31582 }),
  'BEE 01': prod({ cod: 'BEEBLACK', producto: 'BEE BLACK', tipo: 'PREMIUM', precio: 90000 }),
  'BEE 02': prod({ cod: 'BEEBLACK', producto: 'BEE BLACK', tipo: 'PREMIUM', precio: 45000 }),
  'VER 01': prod({ cod: 'BLACKOUT_V_D', producto: 'CORTINA VERTICAL BLACKOUT', tipo: 'DELUX', precio: 12345 }),
  DOM38: prod({ cod: 'ACCESORIO', producto: 'MOTOR', tipo: 'ACCESORIO', precio: 180000 }),
};

describe('esCortinaTipo', () => {
  it('acepta los cuatro tipos de cortina, sin importar mayúsculas ni espacios', () => {
    for (const t of ['PREMIUM', 'delux', ' Standard ', 'BASIC']) expect(esCortinaTipo(t)).toBe(true);
  });

  it('rechaza cualquier otro tipo, incluido vacío', () => {
    for (const t of ['ACCESORIO', 'INSTALACION', '', undefined]) expect(esCortinaTipo(t)).toBe(false);
  });
});

describe('flujoDeProducto', () => {
  it('una tela con tipo de cortina entra como cortina, con su receta propia', () => {
    const f = flujoDeProducto(CAT['BK 09'], 'BK 09', CAT);
    expect(f.entra).toBe('cortina');
    expect(f.cod).toBe('BLACKOUT_D');
    expect(f.recetaKey).toBe('BLACKOUT_D');
    expect(f.recetaPropia).toBe(true);
  });

  it('un producto que no es cortina entra como adicional y no tiene receta', () => {
    const f = flujoDeProducto(CAT.DOM38, 'DOM38', CAT);
    expect(f.entra).toBe('adicional');
    expect(f.recetaKey).toBeNull();
  });

  it('cobra con la tela de referencia de la familia, no con la suya', () => {
    const f = flujoDeProducto(CAT['BK 10'], 'BK 10', CAT);
    expect(f.origenPrecio).toBe('arquetipo');
    expect(f.telaReferencia).toBe('BK-D');
    expect(f.precioMl).toBe(31000); // no 23.782, que es el precio de esta tela
  });

  it('una familia sin tela de referencia cobra la más cara del grupo', () => {
    const f = flujoDeProducto(CAT['BEE 02'], 'BEE 02', CAT);
    expect(f.origenPrecio).toBe('maxFamilia');
    expect(f.telaReferencia).toBe('BEE 01');
    expect(f.precioMl).toBe(90000);
    // Sin receta propia: cae en la del roller premium.
    expect(f.recetaPropia).toBe(false);
    expect(f.recetaKey).toBe('BLACKOUT_P');
  });

  it('la vertical toma la tela del roller equivalente y la receta vertical', () => {
    const f = flujoDeProducto(CAT['VER 01'], 'VER 01', CAT);
    expect(f.esVertical).toBe(true);
    expect(f.origenPrecio).toBe('baseVertical');
    expect(f.telaReferencia).toBe('BK-D');
    expect(f.recetaKey).toBe('VERTICAL');
  });

  it('un dúo desconocido cae en la receta genérica de dúo', () => {
    const p = prod({ cod: 'DUO_RARO', producto: 'DUO EXPERIMENTAL', tipo: 'PREMIUM' });
    const f = flujoDeProducto(p, 'DX 01', { ...CAT, 'DX 01': p });
    expect(f.esDuo).toBe(true);
    expect(f.recetaKey).toBe('DUO_GENERICO');
  });

  it('sin familia declarada, el COD_INT hace de familia', () => {
    const p = prod({ cod: '', tipo: 'PREMIUM' });
    const f = flujoDeProducto(p, 'SUELTA 1', { ...CAT, 'SUELTA 1': p });
    expect(f.cod).toBe('SUELTA 1');
  });

  it('la ficha de una tela MÁS CARA que la referencia muestra su propio precio', () => {
    // El caso que reportó el dueño: puso una tela a 100.000 y la cotización
    // seguía cobrando el arquetipo (31.000), porque la referencia cortaba la
    // cascada. La referencia es un piso: esta tela lo levanta.
    const cara = prod({ precio: 100000, descripcion: 'DICHROIC BEIGE' });
    const cat: CatalogoProductos = { ...CAT, 'BK 85': cara };
    const f = flujoDeProducto(cat['BK 85'], 'BK 85', cat);
    expect(f.precioMl).toBe(100000);
    expect(f.origenPrecio).toBe('masCaraQueLaReferencia');
    expect(f.telaReferencia).toBe('BK 85');
    // La referencia sigue estando bien: que otra tela la supere no la rompe.
    expect(f.referenciaDeclaradaRota).toBe('');
  });

  it('una tela cara que NADIE compró no le sube el precio a la familia', () => {
    // La regla del dueño (2026-09-07): el techo son las telas de la cotización,
    // no el catálogo entero. Con el catálogo entero, una DELUX archivada por
    // error bajo SCREEN_P le subía el precio a todas las screen.
    const cat: CatalogoProductos = { ...CAT, 'BK 85': prod({ precio: 100000 }) };
    const f = flujoDeProducto(cat['BK 10'], 'BK 10', cat);
    expect(f.precioMl).toBe(31000);
    expect(f.origenPrecio).toBe('arquetipo');
    expect(f.telaReferencia).toBe('BK-D');
  });

  it('si la referencia sigue siendo la más cara, el precio no se mueve', () => {
    const f = flujoDeProducto(CAT['BK 10'], 'BK 10', CAT);
    expect(f.precioMl).toBe(31000);
    expect(f.origenPrecio).toBe('arquetipo');
  });

  it('la vertical también sube cuando la tela cara es la que se vende', () => {
    const caraV = prod({
      cod: 'BLACKOUT_V_D',
      producto: 'CORTINA VERTICAL BLACKOUT',
      tipo: 'DELUX',
      precio: 88000,
    });
    const cat: CatalogoProductos = { ...CAT, 'VER 09': caraV };
    expect(flujoDeProducto(cat['VER 09'], 'VER 09', cat)).toMatchObject({
      precioMl: 88000,
      origenPrecio: 'masCaraQueLaReferencia',
      telaReferencia: 'VER 09',
    });
    // Y la barata de la misma familia sigue en la tela base del roller.
    expect(flujoDeProducto(cat['VER 01'], 'VER 01', cat)).toMatchObject({
      precioMl: 31000,
      origenPrecio: 'baseVertical',
      telaReferencia: 'BK-D',
    });
  });

  it('el precio TECLEADO del sistema (categoría B) sigue mandando sobre todo', () => {
    const cat: CatalogoProductos = { ...CAT, 'BK 85': prod({ precio: 100000 }) };
    const r = precioMlPorCod('BLACKOUT_D', cat, REGLAS_PRECIOS_DEFAULT, {
      telaPorFamilia: { BLACKOUT_D: 29231 },
    } as never);
    expect(r).toEqual({ precio: 29231, arquetipo: '', motivo: 'sistema' });
  });

  // El beeblack no tiene tela de referencia (es el MAXIFS del Excel), así que
  // antes cobraba la más cara de su familia EN EL CATÁLOGO: en la traslúcida
  // ganaba la fila genérica `BEE-TRAS` (78.848) y no la tela que se vende,
  // `BEE-TR01` (52.565), y salía 50 % arriba de la OT real.
  it('el beeblack cobra su tela TECLEADA, no la fila más cara del catálogo', () => {
    const cat: CatalogoProductos = {
      'BEE-TRAS': prod({ cod: 'BEE_TRAS', precio: 78848 }),
      'BEE-TR01': prod({ cod: 'BEE_TRAS', precio: 52565 }),
      'BEE-BK': prod({ cod: 'BEE_BK', precio: 48500 }),
      'BEE-BK05': prod({ cod: 'BEE_BK', precio: 7839 }),
    };
    const bb = REGLAS_PRECIOS_DEFAULT.sistemas.beeblack;
    expect(precioMlPorCod('BEE_TRAS', cat, REGLAS_PRECIOS_DEFAULT, bb)).toEqual({
      precio: 52600,
      arquetipo: '',
      motivo: 'sistema',
    });
    // El blackout no se mueve: su tecleado es el mismo que ya cobraba.
    expect(precioMlPorCod('BEE_BK', cat, REGLAS_PRECIOS_DEFAULT, bb).precio).toBe(48500);
    // Sin el sistema en la mano sigue mandando el máximo, que es la regla vieja.
    expect(precioMlPorCod('BEE_TRAS', cat, REGLAS_PRECIOS_DEFAULT)).toEqual({
      precio: 78848,
      arquetipo: 'BEE-TRAS',
      motivo: 'maximo',
    });
  });

  it('el precio que muestra es el que cobra el motor', () => {
    // Antídoto contra que la pantalla y la cotización se digan cosas distintas.
    const f = flujoDeProducto(CAT['BK 10'], 'BK 10', CAT);
    const r = cotizarFase0(
      [{ codInt: 'BK 10', ancho: 1.5, alto: 2, cantidad: 1 }],
      CAT,
      {},
    );
    expect(r.familias[0].precioMl).toBe(f.precioMl);
    expect(r.familias[0].arquetipoCodInt).toBe(f.telaReferencia);
  });
});

describe('avisosCatalogo', () => {
  const av = avisosCatalogo(CAT, { 'BK 09': 2.98 }, REGLAS_PRECIOS_DEFAULT);

  it('marca la familia que se cobra con la tela más cara', () => {
    expect(av.familiasSinReferencia).toEqual([{ cod: 'BEEBLACK', telas: 2, telaMasCara: 'BEE 01' }]);
  });

  it('una referencia SANA superada por una tela más cara no se avisa como rota', () => {
    const cat: CatalogoProductos = { ...CAT, 'BK 85': prod({ precio: 100000 }) };
    const r = avisosCatalogo(cat, {}, REGLAS_PRECIOS_DEFAULT);
    expect(r.referenciasRotas.some((x) => x.cod === 'BLACKOUT_D')).toBe(false);
    expect(r.familiasSinReferencia.some((x) => x.cod === 'BLACKOUT_D')).toBe(false);
  });

  it('marca las telas de cortina sin ancho de rollo y deja fuera los adicionales', () => {
    expect(av.telasSinAncho).toContain('BK 10');
    expect(av.telasSinAncho).not.toContain('BK 09'); // tiene ancho en el mapa
    expect(av.telasSinAncho).not.toContain('DOM38'); // no es cortina
  });

  it('marca la tela de referencia que ya no está en el catálogo', () => {
    const sinReferencia = { ...CAT };
    delete sinReferencia['BK-D'];
    const r = avisosCatalogo(sinReferencia, {}, REGLAS_PRECIOS_DEFAULT);
    expect(r.referenciasRotas).toContainEqual({ cod: 'BLACKOUT_D', codInt: 'BK-D', mandaAhora: 'BK 09' });
  });

  it('la vertical que quedó sin su roller equivalente cae al máximo de su familia, y se avisa', () => {
    const sinBase = { ...CAT };
    delete sinBase['BK-D'];
    const r = avisosCatalogo(sinBase, {}, REGLAS_PRECIOS_DEFAULT);
    // Antes se quedaba en $0 (tela gratis). Ahora hay un solo respaldo para
    // todos: la tela más cara de la familia, que acá es la propia VER 01.
    const f = flujoDeProducto(CAT['VER 01'], 'VER 01', sinBase);
    expect(f.precioMl).toBe(12345);
    expect(f.origenPrecio).toBe('maxFamilia');
    expect(f.referenciaDeclaradaRota).toBe('BK-D');
    expect(r.referenciasRotas).toContainEqual({ cod: 'BLACKOUT_V_D', codInt: 'BK-D', mandaAhora: 'VER 01' });
  });

  it('una familia donde NINGUNA tela tiene precio queda en sinPrecio (y no en $0 mudo)', () => {
    const gratis: CatalogoProductos = {
      'X 01': prod({ cod: 'FAMILIA_X', producto: 'ROLLER X', tipo: 'PREMIUM', precio: 0 }),
    };
    const f = flujoDeProducto(gratis['X 01'], 'X 01', gratis);
    expect(f.origenPrecio).toBe('sinPrecio');
    expect(f.precioMl).toBe(0);
  });

  it('marca las familias que solo se distinguen por mayúsculas', () => {
    // Caso real del catálogo: BLACKOUT_p con p minúscula. El Excel las trata
    // como una sola familia; la app las cobra por separado.
    const conTipeo = {
      ...CAT,
      'BK 98': prod({ cod: 'BLACKOUT_P', tipo: 'PREMIUM' }),
      'BK 99': prod({ cod: 'BLACKOUT_p', tipo: 'PREMIUM' }),
    };
    const r = avisosCatalogo(conTipeo, {}, REGLAS_PRECIOS_DEFAULT);
    expect(r.familiasCasiIguales).toHaveLength(1);
    expect([...r.familiasCasiIguales[0].familias].sort()).toEqual(['BLACKOUT_P', 'BLACKOUT_p']);
  });

  it('marca los productos sin tipo, que entran como adicional sin que se note', () => {
    const conVacio = { ...CAT, 'BK 98': prod({ tipo: '' }) };
    const r = avisosCatalogo(conVacio, {}, REGLAS_PRECIOS_DEFAULT);
    expect(r.productosSinTipo).toEqual(['BK 98']);
  });

  it('un catálogo sano no avisa nada', () => {
    const sano: CatalogoProductos = { 'BK-D': prod({ precio: 31000 }), 'BK 09': prod() };
    const r = avisosCatalogo(sano, { 'BK-D': 2.98, 'BK 09': 2.98 });
    expect(r.familiasSinReferencia).toHaveLength(0);
    expect(r.telasSinAncho).toHaveLength(0);
    expect(r.referenciasRotas).toHaveLength(0);
    expect(r.familiasCasiIguales).toHaveLength(0);
    expect(r.productosSinTipo).toHaveLength(0);
  });
});
