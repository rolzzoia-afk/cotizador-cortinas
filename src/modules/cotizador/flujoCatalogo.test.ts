import { describe, expect, it } from 'vitest';
import { avisosCatalogo, esCortinaTipo, flujoDeProducto } from './flujoCatalogo';
import { REGLAS_PRECIOS_DEFAULT } from './reglasPrecios';
import { cotizarFase0 } from './motorFase0';
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

  it('marca las telas de cortina sin ancho de rollo y deja fuera los adicionales', () => {
    expect(av.telasSinAncho).toContain('BK 10');
    expect(av.telasSinAncho).not.toContain('BK 09'); // tiene ancho en el mapa
    expect(av.telasSinAncho).not.toContain('DOM38'); // no es cortina
  });

  it('marca la tela de referencia que ya no está en el catálogo', () => {
    const sinReferencia = { ...CAT };
    delete sinReferencia['BK-D'];
    const r = avisosCatalogo(sinReferencia, {}, REGLAS_PRECIOS_DEFAULT);
    expect(r.referenciasRotas).toContainEqual({ cod: 'BLACKOUT_D', codInt: 'BK-D' });
  });

  it('marca la vertical que quedó sin su roller equivalente (cotizaría la tela a $0)', () => {
    const sinBase = { ...CAT };
    delete sinBase['BK-D'];
    const r = avisosCatalogo(sinBase, {}, REGLAS_PRECIOS_DEFAULT);
    // La vertical no cae al máximo de su familia: se queda en cero.
    expect(flujoDeProducto(CAT['VER 01'], 'VER 01', sinBase).precioMl).toBe(0);
    expect(r.referenciasRotas).toContainEqual({ cod: 'BLACKOUT_V_D', codInt: 'BK-D' });
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
