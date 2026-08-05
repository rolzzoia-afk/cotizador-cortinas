import { describe, it, expect } from 'vitest';
import {
  CONSTANTES_EDITABLES,
  MEDIDA_PRUEBA_DEFAULT,
  agruparCuadros,
  construirCuadros,
  construirCuadrosDeCatalogo,
  formatearAjuste,
  referenciaDe,
  type CuadroFormula,
} from './cuadrosFormulas';
import { FORMULAS_DEFAULT, conCampoEditado, leerCampo } from './formulasFamilias';
import type { ModeloDespiece } from './tipos';

const modelo = (over: Partial<ModeloDespiece>): ModeloDespiece => ({
  sistema: '',
  tipo_rol: '',
  mecanismo: '',
  codigos_tubo: '',
  diametro_tubo_mm: 0,
  dcto_tubo_cm: 0,
  dcto_tela_cm: 0,
  suma_peso_cm: 0,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 0,
  activo: true,
  notas: '',
  ...over,
});

/** Catálogo mínimo con una fila por familia que los cuadros necesitan. */
const CATALOGO: ModeloDespiece[] = [
  modelo({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_38mm', diametro_tubo_mm: 38 }),
  modelo({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_45mm', diametro_tubo_mm: 45 }),
  modelo({ sistema: 'OSCURANTI', tipo_rol: 'OSCURANTI_63mm', diametro_tubo_mm: 63 }),
  modelo({ sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_38mm', diametro_tubo_mm: 38 }),
  modelo({ sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_45mm', diametro_tubo_mm: 45 }),
  modelo({ sistema: 'VERTICAL', tipo_rol: 'VERTICAL_LAMAS_89', dcto_tubo_cm: 1.8, dcto_perfiles_cm: 1.7 }),
];

const cuadro = (cuadros: CuadroFormula[], id: string) => {
  const c = cuadros.find((x) => x.id === id);
  if (!c) throw new Error(`No existe el cuadro ${id}. Hay: ${cuadros.map((x) => x.id).join(', ')}`);
  return c;
};
const medida = (c: CuadroFormula, componente: string) =>
  c.filas.find((f) => f.componente === componente)?.medidaCm;

describe('referenciaDe', () => {
  it('los laterales y las manillas se miden sobre el ALTO', () => {
    expect(referenciaDe('Perfil izquierdo a Muro')).toBe('alto');
    expect(referenciaDe('Perfil derecho dentro del Marco')).toBe('alto');
    expect(referenciaDe('Perfil lateral izq (alto)')).toBe('alto');
    expect(referenciaDe('Manilla izq (alto)')).toBe('alto');
    expect(referenciaDe('Separador izquierdo')).toBe('alto');
  });

  it('el inferior y la base se miden sobre el ANCHO, no sobre el alto', () => {
    expect(referenciaDe('Perfil inferior a Muro')).toBe('ancho');
    expect(referenciaDe('Separador base')).toBe('ancho');
    expect(referenciaDe('Perfil superior')).toBe('ancho');
  });

  it('los conteos no tienen descuento contra ninguna medida', () => {
    expect(referenciaDe('Carritos')).toBe('cantidad');
    expect(referenciaDe('Lamas')).toBe('cantidad');
    expect(referenciaDe('Total lamas')).toBe('cantidad');
  });

  it('el alto de tela del velcro es una medida fija', () => {
    expect(referenciaDe('Alto Tela Velcro')).toBe('fija');
  });
});

describe('construirCuadros — los totales salen del motor real', () => {
  const cuadros = construirCuadros(CATALOGO, { anchoCm: 200, altoCm: 240 });

  it('DARK 38 INTERNO reproduce la pizarra 200: 199,7 / 198,7 / 193,9 / 193,3 / 193,5', () => {
    const c = cuadro(cuadros, 'DARK_38mm||INTERNO');
    expect(medida(c, 'Cenefa Delantera')).toBe(199.7);
    expect(medida(c, 'Cenefa Trasera')).toBe(198.7);
    expect(medida(c, 'Tubo')).toBe(193.9);
    expect(medida(c, 'Tela (ancho)')).toBe(193.3);
    expect(medida(c, 'Peso')).toBe(193.5);
  });

  it('OSCURANTI INTERNO a 330 reproduce la pizarra: 329,7 / 323,9 / 323,3 / 323,5', () => {
    const c = cuadro(construirCuadros(CATALOGO, { anchoCm: 330, altoCm: 240 }), 'OSCURANTI_63mm||INTERNO');
    expect(medida(c, 'Perfil superior')).toBe(329.7);
    expect(medida(c, 'Tubo')).toBe(323.9);
    expect(medida(c, 'Tela (ancho)')).toBe(323.3);
    expect(medida(c, 'Peso')).toBe(323.5);
  });

  it('el ajuste es la diferencia contra el ancho de prueba (la columna "descuento")', () => {
    const c = cuadro(cuadros, 'DARK_38mm||INTERNO');
    const cenefa = c.filas.find((f) => f.componente === 'Cenefa Delantera');
    expect(cenefa?.referencia).toBe('ancho');
    expect(cenefa?.ajusteCm).toBe(-0.3); // 199,7 − 200
  });

  it('SOFT LIGHT 38 EXTERNO suma sobre el ancho en vez de descontar', () => {
    const c = cuadro(cuadros, 'SOFT_LIGHT_38mm||EXTERNO');
    expect(medida(c, 'Cenefa')).toBe(213.2); // 200 + 13,2
    expect(c.filas.find((f) => f.componente === 'Cenefa')?.ajusteCm).toBe(13.2);
  });

  it('la cenefa cuadrada es un cuadro distinto del ovalado de la misma medida', () => {
    const ovalada = cuadro(cuadros, 'SOFT_LIGHT_38mm||INTERNO');
    const cuadrada = cuadro(cuadros, 'SOFT_LIGHT_38mm|Cuadrada|INTERNO');
    expect(medida(ovalada, 'Cenefa')).toBe(198.8); // 200 − 1,2
    expect(medida(cuadrada, 'Cenefa Delantera')).toBe(199.7); // 200 − 0,3
  });

  it('VERTICAL trae sus conteos sin ajuste y el perfil cabezal encadenado', () => {
    const c = cuadro(cuadros, 'VERTICAL');
    expect(medida(c, 'Perfil cabezal')).toBe(198.2); // 200 − 1,8
    expect(medida(c, 'Varilla')).toBe(196.5); // 198,2 − 1,7
    expect(medida(c, 'Carritos')).toBe(25); // floor(196,5/8) = 24, + 1
    const carritos = c.filas.find((f) => f.componente === 'Carritos');
    expect(carritos?.referencia).toBe('cantidad');
    expect(carritos?.ajusteCm).toBeNull();
  });

  it('BEE BLACK sale sin fila de catálogo (usa sus propias reglas) y lo declara', () => {
    const c = cuadro(cuadros, 'BEEBLACK|INTERNO');
    expect(c.sinModelo).toBe(true);
    expect(medida(c, 'Perfil superior (ancho)')).toBe(194.3); // 200 − 5,7
    const lateral = c.filas.find((f) => f.componente === 'Perfil lateral izq (alto)');
    expect(lateral?.referencia).toBe('alto');
    expect(lateral?.medidaCm).toBe(234.3); // 240 − 5,7
  });

  it('sin catálogo los cuadros igual se construyen (no explotan)', () => {
    const sinNada = construirCuadros([], MEDIDA_PRUEBA_DEFAULT);
    expect(sinNada.length).toBeGreaterThan(0);
    expect(sinNada.every((c) => c.sinModelo || c.grupo === 'Bee Black')).toBe(true);
  });
});

describe('perfiles opcionales', () => {
  const cuadros = construirCuadros(CATALOGO, { anchoCm: 200, altoCm: 240 });

  it('los laterales a muro miden alto + 10 y el marco mide el alto exacto', () => {
    const c = cuadro(cuadros, 'DARK_38mm||INTERNO');
    const muro = c.perfiles.find((p) => p.key === 'izqMuro');
    const marco = c.perfiles.find((p) => p.key === 'izqMarco');
    expect(muro?.medidaCm).toBe(250);
    expect(muro?.ajusteCm).toBe(10);
    expect(marco?.medidaCm).toBe(240);
    expect(marco?.ajusteCm).toBe(0);
  });

  it('DARK trae los laterales encendidos de fábrica; el inferior no', () => {
    const c = cuadro(cuadros, 'DARK_38mm||INTERNO');
    expect(c.perfiles.find((p) => p.key === 'izqMuro')?.activoPorDefecto).toBe(true);
    expect(c.perfiles.find((p) => p.key === 'infMuro')?.activoPorDefecto).toBe(false);
  });

  it('el perfil inferior se mide sobre el ANCHO (no sobre el alto)', () => {
    const c = cuadro(cuadros, 'SOFT_LIGHT_38mm||INTERNO');
    const inf = c.perfiles.find((p) => p.key === 'infMuro');
    expect(inf?.referencia).toBe('ancho');
    expect(inf?.medidaCm).toBe(186.7); // 200 − 13,3 (montaje dentro)
  });

  it('SEMI no ofrece elegir el montaje del base; INTERNO sí', () => {
    expect(cuadro(cuadros, 'SOFT_LIGHT_38mm||SEMI').montajeBase).toBe(false);
    expect(cuadro(cuadros, 'SOFT_LIGHT_38mm||INTERNO').montajeBase).toBe(true);
  });

  it('vertical y beeblack no tienen perfiles de oscuridad', () => {
    expect(cuadro(cuadros, 'VERTICAL').perfiles).toEqual([]);
    expect(cuadro(cuadros, 'BEEBLACK|SEMI').perfiles).toEqual([]);
  });
});

describe('construirCuadrosDeCatalogo', () => {
  const tabulares: ModeloDespiece[] = [
    modelo({
      sistema: 'ROLLER_SIMPLE',
      tipo_rol: 'ROL_SIMPLE',
      mecanismo: 'MEC_05_LZ90_BLANCO',
      diametro_tubo_mm: 38,
      dcto_tubo_cm: 3.8,
      suma_peso_cm: 0.1,
    }),
    modelo({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_38mm' }), // no tabular: se ignora
  ];

  it('hace un cuadro por fila del catálogo y omite las familias con pizarra propia', () => {
    const cuadros = construirCuadrosDeCatalogo(tabulares, { anchoCm: 200, altoCm: 240 });
    expect(cuadros).toHaveLength(1);
    expect(cuadros[0].grupo).toBe('ROLLER_SIMPLE');
    expect(cuadros[0].titulo).toBe('ROL_SIMPLE');
  });

  it('el roller encadena tubo → peso → tela con los descuentos de la fila', () => {
    const [c] = construirCuadrosDeCatalogo(tabulares, { anchoCm: 200, altoCm: 240 });
    expect(medida(c, 'Tubo')).toBe(196.2); // 200 − 3,8
    expect(medida(c, 'Peso')).toBe(195.8); // tubo − 0,4
    expect(medida(c, 'Tela (ancho)')).toBe(195.7); // peso − 0,1
  });
});

describe('qué número edita cada fila', () => {
  const cuadros = construirCuadros(CATALOGO, { anchoCm: 200, altoCm: 240 });
  const fila = (id: string, componente: string) =>
    cuadro(cuadros, id).filas.find((f) => f.componente === componente);

  it('la cenefa apunta a la tabla de SU familia y variante', () => {
    expect(fila('DARK_38mm||INTERNO', 'Cenefa Delantera')?.campo).toBe('oscuridad.cenefaAdj.DARK.0');
    expect(fila('DARK_38mm||EXTERNO', 'Cenefa Delantera')?.campo).toBe('oscuridad.cenefaAdj.DARK.2');
    expect(fila('SOFT_LIGHT_38mm||SEMI', 'Cenefa')?.campo).toBe(
      'oscuridad.cenefaAdj.SOFT_LIGHT_38.1',
    );
  });

  it('en las familias que encadenan, el tubo edita el PASO y dice desde dónde mide', () => {
    const tubo = fila('DARK_38mm||INTERNO', 'Tubo');
    expect(tubo?.campo).toBe('oscuridad.tuboPaso.DARK.0');
    expect(tubo?.desde).toBe('la cenefa trasera');
    const oscuranti = fila('OSCURANTI_63mm||INTERNO', 'Tubo');
    expect(oscuranti?.campo).toBe('oscuridad.tuboPaso.OSCURANTI.0');
    expect(oscuranti?.desde).toBe('la pieza frontal');
  });

  it('en las que cortan neto, el tubo edita su propia tabla y no viene "desde"', () => {
    const tubo = fila('SOFT_LIGHT_38mm||INTERNO', 'Tubo');
    expect(tubo?.campo).toBe('oscuridad.tuboAdj.SOFT_LIGHT_38.0');
    expect(tubo?.desde).toBeUndefined();
  });

  it('los pasos compartidos se marcan como tales (mueven varios cuadros)', () => {
    const tela = fila('DARK_38mm||INTERNO', 'Tela (ancho)');
    expect(tela?.campo).toBe('oscuridad.telaPasoCm');
    expect(tela?.compartido).toBe(true);
    // La tela del soft light es de su tabla: NO es compartida.
    expect(fila('SOFT_LIGHT_38mm||INTERNO', 'Tela (ancho)')?.compartido).toBeUndefined();
  });

  it('el beeblack apunta a la tabla de ajustes de su variante', () => {
    expect(fila('BEEBLACK|INTERNO', 'Perfil superior (ancho)')?.campo).toBe(
      'beeblack.ajustes.INTERNO.perfilAncho',
    );
    expect(fila('BEEBLACK|EXTERNO', 'Perfil lateral izq (alto)')?.campo).toBe(
      'beeblack.ajustes.EXTERNO.perfilLateral',
    );
    expect(fila('BEEBLACK|SEMI', 'Total lamas')?.campo).toBe('beeblack.ajustes.SEMI.lamasDivisor');
  });

  it('las cantidades de la vertical no se editan desde el cuadro (van en constantes)', () => {
    expect(fila('VERTICAL', 'Carritos')?.campo).toBeUndefined();
    expect(fila('VERTICAL', 'Perfil cabezal')?.campo).toBeUndefined();
  });

  it('todas las rutas declaradas existen en las fórmulas', () => {
    const rutas = cuadros.flatMap((c) => c.filas.map((f) => f.campo).filter(Boolean));
    expect(rutas.length).toBeGreaterThan(20);
    for (const r of rutas) expect(leerCampo(FORMULAS_DEFAULT, r as string)).not.toBeNull();
  });

  it('las constantes compartidas también apuntan a rutas reales', () => {
    for (const g of CONSTANTES_EDITABLES) {
      for (const c of g.items) expect(leerCampo(FORMULAS_DEFAULT, c.campo)).not.toBeNull();
    }
  });

  it('los cuadros se dibujan con las fórmulas que se les pasan', () => {
    const f = conCampoEditado(FORMULAS_DEFAULT, 'oscuridad.cenefaAdj.DARK.0', -0.5);
    const editados = construirCuadros(CATALOGO, { anchoCm: 200, altoCm: 240 }, f);
    expect(medida(cuadro(editados, 'DARK_38mm||INTERNO'), 'Cenefa Delantera')).toBe(199.5);
  });
});

describe('agruparCuadros y formatearAjuste', () => {
  it('agrupa conservando el orden en que vienen', () => {
    const grupos = agruparCuadros(construirCuadros(CATALOGO, MEDIDA_PRUEBA_DEFAULT));
    expect(grupos.map((g) => g.grupo)).toEqual([
      'Soft Light',
      'Dark',
      'Oscuranti',
      'Bee Black',
      'Vertical',
    ]);
    expect(grupos[1].cuadros).toHaveLength(6); // DARK 38 y 45 × 3 variantes
  });

  it('el signo se ve con el menos largo y coma decimal (es-CL)', () => {
    expect(formatearAjuste(-0.3)).toBe('−0,3');
    expect(formatearAjuste(13.2)).toBe('+13,2');
    expect(formatearAjuste(0)).toBe('0');
    expect(formatearAjuste(null)).toBe('—');
  });
});
