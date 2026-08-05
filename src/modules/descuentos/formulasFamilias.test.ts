import { describe, it, expect } from 'vitest';
import {
  FORMULAS_DEFAULT,
  conCampoEditado,
  leerCampo,
  normalizarFormulas,
  sonDefault,
} from './formulasFamilias';
import { calcularDespiece, calculoVertical, MODELO_DESPIECE_STUB } from './despiece';
import { cortesSoftLight38, medidaCenefaSoftLight38 } from './reglas-soft-light';
import { medidaCorteCenefaCuadrada } from './adicionales-cenefa';
import type { ModeloDespiece } from './tipos';

const modelo = (over: Partial<ModeloDespiece> = {}): ModeloDespiece => ({
  ...MODELO_DESPIECE_STUB,
  ...over,
});

describe('normalizarFormulas', () => {
  it('sin nada guardado devuelve las de fábrica', () => {
    expect(normalizarFormulas(null)).toEqual(FORMULAS_DEFAULT);
    expect(normalizarFormulas(undefined)).toEqual(FORMULAS_DEFAULT);
    expect(normalizarFormulas('basura')).toEqual(FORMULAS_DEFAULT);
  });

  it('completa lo que falta con el valor de fábrica (versión vieja del JSON)', () => {
    const f = normalizarFormulas({ vertical: { pasoCarritoCm: 10 } });
    expect(f.vertical.pasoCarritoCm).toBe(10);
    expect(f.vertical.extraCarrito).toBe(FORMULAS_DEFAULT.vertical.extraCarrito);
    expect(f.oscuridad).toEqual(FORMULAS_DEFAULT.oscuridad);
  });

  it('descarta valores que no son números y deja el de fábrica', () => {
    const f = normalizarFormulas({
      roller: { pesoVsTuboCm: 'mucho' },
      vertical: { pasoCarritoCm: null, extraCarrito: 3 },
    });
    expect(f.roller.pesoVsTuboCm).toBe(0.4);
    expect(f.vertical.pasoCarritoCm).toBe(8);
    expect(f.vertical.extraCarrito).toBe(3);
  });

  it('respeta las tablas de 3 valores y rechaza las de largo distinto', () => {
    const buena = normalizarFormulas({ oscuridad: { cenefaAdj: { DARK: [-1, 2, 3] } } });
    expect(buena.oscuridad.cenefaAdj.DARK).toEqual([-1, 2, 3]);
    const corta = normalizarFormulas({ oscuridad: { cenefaAdj: { DARK: [-1] } } });
    expect(corta.oscuridad.cenefaAdj.DARK).toEqual(FORMULAS_DEFAULT.oscuridad.cenefaAdj.DARK);
  });

  it('un campo suelto malo dentro de la tabla no arrastra al resto', () => {
    const f = normalizarFormulas({ oscuridad: { cenefaAdj: { DARK: [-1, 'x', 3] } } });
    expect(f.oscuridad.cenefaAdj.DARK).toEqual([-1, 7.5, 3]); // el SEMI queda de fábrica
  });

  it('normalizar no muta el default', () => {
    normalizarFormulas({ vertical: { pasoCarritoCm: 99 } });
    expect(FORMULAS_DEFAULT.vertical.pasoCarritoCm).toBe(8);
  });
});

describe('leerCampo / conCampoEditado', () => {
  it('lee un número por su ruta, incluso dentro de una tabla', () => {
    expect(leerCampo(FORMULAS_DEFAULT, 'vertical.pasoCarritoCm')).toBe(8);
    expect(leerCampo(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.DARK.0')).toBe(-0.3);
  });

  it('una ruta que no apunta a un número devuelve null', () => {
    expect(leerCampo(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj')).toBeNull();
    expect(leerCampo(FORMULAS_DEFAULT, 'no.existe')).toBeNull();
  });

  it('editar devuelve una copia y no toca el original', () => {
    const editado = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.DARK.0', -0.5);
    expect(leerCampo(editado, 'oscuridad.cenefaAdj.DARK.0')).toBe(-0.5);
    expect(leerCampo(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.DARK.0')).toBe(-0.3);
  });

  it('una ruta inválida devuelve el objeto sin cambios', () => {
    expect(conCampoEditado(FORMULAS_DEFAULT, 'no.existe', 5)).toBe(FORMULAS_DEFAULT);
    expect(conCampoEditado(FORMULAS_DEFAULT, 'vertical.inventado', 5)).toBe(FORMULAS_DEFAULT);
  });

  it('sonDefault distingue lo de fábrica de lo editado', () => {
    expect(sonDefault(FORMULAS_DEFAULT)).toBe(true);
    expect(sonDefault(conCampoEditado(FORMULAS_DEFAULT, 'roller.pesoVsTuboCm', 0.5))).toBe(false);
  });
});

// Lo que de verdad importa: que el número editado llegue hasta el corte.
describe('los overrides llegan al despiece', () => {
  const corte = (d: ReturnType<typeof calcularDespiece>, comp: string) =>
    d.cortes.find((c) => c.componente === comp)?.medidaCm;

  it('DARK: cambiar la cenefa mueve TODA la cadena (trasera, tubo, tela, peso)', () => {
    const ctx = { categoria: 'DARK_38mm', altoCm: 240, oscuridadVariante: 'INTERNO' };
    const base = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, ctx);
    expect(corte(base, 'Cenefa Delantera')).toBe(199.7);
    expect(corte(base, 'Peso')).toBe(193.5);

    // −0,3 → −0,5: dos milímetros menos en cada eslabón.
    const f = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.DARK.0', -0.5);
    const editado = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, { ...ctx, formulas: f });
    expect(corte(editado, 'Cenefa Delantera')).toBe(199.5);
    expect(corte(editado, 'Cenefa Trasera')).toBe(198.5);
    expect(corte(editado, 'Tubo')).toBe(193.7);
    expect(corte(editado, 'Tela (ancho)')).toBe(193.1);
    expect(corte(editado, 'Peso')).toBe(193.3);
  });

  it('SOFT LIGHT: cambiar el tubo NO mueve la tela (cortan neto, no encadenan)', () => {
    const ctx = { categoria: 'SOFT_LIGHT_38mm', altoCm: 240, oscuridadVariante: 'INTERNO' };
    const f = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.tuboAdj.SOFT_LIGHT_38.0', -4);
    const d = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, { ...ctx, formulas: f });
    expect(corte(d, 'Tubo')).toBe(196);
    expect(corte(d, 'Tela (ancho)')).toBe(192.8); // sin cambios: 200 − 7,2
  });

  it('el paso de la tela (compartido) mueve las familias encadenadas', () => {
    const f = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.telaPasoCm', 1);
    const d = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, {
      categoria: 'DARK_38mm',
      altoCm: 240,
      oscuridadVariante: 'INTERNO',
      formulas: f,
    });
    expect(corte(d, 'Tubo')).toBe(193.9); // el tubo no depende de la tela
    expect(corte(d, 'Tela (ancho)')).toBe(192.9); // 193,9 − 1
    expect(corte(d, 'Peso')).toBe(193.1); // tela + 0,2
  });

  it('BEEBLACK: cambiar el ajuste del perfil mueve superior e inferior', () => {
    const ctx = { categoria: 'BEEBLACK', altoCm: 240, beeblackVariante: 'INTERNO' };
    const f = conCampoEditado(FORMULAS_DEFAULT, 'beeblack.ajustes.INTERNO.perfilAncho', -6);
    const d = calcularDespiece(modelo(), 200, { ...ctx, formulas: f });
    expect(corte(d, 'Perfil superior (ancho)')).toBe(194);
    expect(corte(d, 'Perfil inferior (ancho)')).toBe(194);
    expect(corte(d, 'Perfil lateral izq (alto)')).toBe(234.3); // el lateral no se toca
  });

  it('VERTICAL: cambiar el paso del carrito cambia carritos y lamas', () => {
    const mVert = modelo({ sistema: 'VERTICAL', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 });
    const base = calcularDespiece(mVert, 200, { altoCm: 240 });
    expect(corte(base, 'Carritos')).toBe(25); // floor(196,5/8) + 1

    const f = conCampoEditado(FORMULAS_DEFAULT, 'vertical.pasoCarritoCm', 10);
    const d = calcularDespiece(mVert, 200, { altoCm: 240, formulas: f });
    expect(corte(d, 'Carritos')).toBe(20); // floor(196,5/10) + 1
    expect(corte(d, 'Lamas')).toBe(20);
  });

  it('VERTICAL: el paso en cero no divide por cero, deja 0 carritos', () => {
    const cv = calculoVertical({ dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 }, 200, 240, {
      formulas: { pasoCarritoCm: 0, extraCarrito: 1, lamasRepuesto: 2 },
    });
    expect(cv.carritos).toBe(0);
    expect(cv.repuesto).toBe(0);
  });

  it('ROLLER: cambiar el peso respecto del tubo mueve peso y tela', () => {
    const mRoller = modelo({
      sistema: 'ROLLER_SIMPLE',
      diametro_tubo_mm: 38,
      dcto_tubo_cm: 3.8,
      suma_peso_cm: 0.1,
    });
    const f = conCampoEditado(FORMULAS_DEFAULT, 'roller.pesoVsTuboCm', 0.6);
    const d = calcularDespiece(mRoller, 200, { formulas: f });
    expect(corte(d, 'Tubo')).toBe(196.2);
    expect(corte(d, 'Peso')).toBe(195.6); // 196,2 − 0,6
    expect(corte(d, 'Tela (ancho)')).toBe(195.5); // peso − 0,1
  });

  it('sin fórmulas en el contexto, el despiece es el de siempre', () => {
    const ctx = { categoria: 'DARK_38mm', altoCm: 240, oscuridadVariante: 'INTERNO' };
    const sin = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, ctx);
    const con = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, {
      ...ctx,
      formulas: FORMULAS_DEFAULT,
    });
    expect(sin.cortes).toEqual(con.cortes);
  });
});

// Antes había DOS copias de la tabla de cenefa soft light: la del paño
// (reglas-oscuridad) y la del adicional (reglas-soft-light). Editar una sin la
// otra dejaba la cenefa comprada desalineada de la del paño en la MISMA ventana.
describe('la cenefa del adicional sale de la misma tabla que la del paño', () => {
  it('con las fórmulas de fábrica, adicional y paño miden igual', () => {
    const delPano = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, {
      categoria: 'SOFT_LIGHT_38mm',
      altoCm: 240,
      oscuridadVariante: 'INTERNO',
    }).cortes.find((c) => c.componente === 'Cenefa')?.medidaCm;
    expect(medidaCenefaSoftLight38(200, 'INTERNO')).toBe(delPano);
  });

  it('al editar la tabla, el adicional se mueve con el paño', () => {
    const f = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.SOFT_LIGHT_38.0', -2);
    const delPano = calcularDespiece(modelo({ diametro_tubo_mm: 38 }), 200, {
      categoria: 'SOFT_LIGHT_38mm',
      altoCm: 240,
      oscuridadVariante: 'INTERNO',
      formulas: f,
    }).cortes.find((c) => c.componente === 'Cenefa')?.medidaCm;
    expect(delPano).toBe(198);
    expect(medidaCenefaSoftLight38(200, 'INTERNO', f)).toBe(198);
    expect(cortesSoftLight38(200, 'INTERNO', f).tubo).toBe(196.2); // 198 − 1,8
  });

  it('la cenefa cuadrada de adicional también es editable', () => {
    expect(medidaCorteCenefaCuadrada(200, 'CON_2_TAPAS')).toBe(202);
    const f = conCampoEditado(FORMULAS_DEFAULT, 'adicionales.cuadradaCon2TapasCm', 3);
    expect(medidaCorteCenefaCuadrada(200, 'CON_2_TAPAS', f)).toBe(203);
  });
});
