// Flujo completo de un TIPO DE CORTINA propio creado desde Admin.
// Es el checklist de "no quedó en el aire": el tipo se despieza con la mecánica
// de su molde, puede tener números propios, hereda las filas del catálogo y las
// columnas del Excel, y desactivarlo no rompe las órdenes ya guardadas.
import { describe, expect, it } from 'vitest';
import { calcularDespiece } from './despiece';
import {
  FORMULAS_OSCURIDAD_DEFAULT,
  cortesOscuridad,
  familiaOscuridad,
  formulasOscuridadParaTipo,
} from './reglas-oscuridad';
import { FORMULAS_DEFAULT } from './formulasFamilias';
import { modelosParaCategoria, categoriaEsDual } from './tipos';
import type { ModeloDespiece } from './tipos';
import type { TipoCortina } from './tiposCortina';

const base: Omit<ModeloDespiece, 'sistema' | 'tipo_rol' | 'mecanismo'> = {
  codigos_tubo: 'E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 0,
  dcto_tela_cm: 0,
  suma_peso_cm: 0,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 3,
  activo: true,
  notas: '',
};

const modeloDark: ModeloDespiece = {
  ...base,
  sistema: 'DARK_ROLLER',
  tipo_rol: 'DARK_38mm',
  mecanismo: 'MEC_33_KIT_SIMPLE_BLANCO',
};

/** Tipo montado sobre DARK 38: misma mecánica, otro nombre. */
const TIPO_DARK: TipoCortina = {
  categoria: 'DARK_PRO_38mm',
  nombre: 'Dark Pro',
  grupo: 'Tipos propios',
  base: 'DARK_38mm',
  activo: true,
};

const TIPO_ROL: TipoCortina = {
  categoria: 'ROL_INDUSTRIAL',
  nombre: 'Roller industrial',
  grupo: 'Tipos propios',
  base: 'ROL',
  activo: true,
};

const medida = (d: ReturnType<typeof calcularDespiece>, componente: string) =>
  d.cortes.find((c) => c.componente === componente)?.medidaCm;
const columna = (d: ReturnType<typeof calcularDespiece>, col: string) =>
  d.cortes.find((c) => c.columnaExcel === col)?.medidaCm;

describe('formulasOscuridadParaTipo', () => {
  it('sin parche devuelve el MISMO objeto (no copia en cada paño)', () => {
    const f = FORMULAS_OSCURIDAD_DEFAULT;
    expect(formulasOscuridadParaTipo(f, 'DARK_PRO_38mm', 'DARK')).toBe(f);
    expect(formulasOscuridadParaTipo(f, '', 'DARK')).toBe(f);
  });

  it('pisa SOLO la fila del molde y deja el resto de familias intacto', () => {
    const f = {
      ...FORMULAS_OSCURIDAD_DEFAULT,
      porTipo: { DARK_PRO_38mm: { tuboPaso: [9, 9, 9] as [number, number, number] } },
    };
    const parchado = formulasOscuridadParaTipo(f, 'DARK_PRO_38mm', 'DARK');
    expect(parchado.tuboPaso.DARK).toEqual([9, 9, 9]);
    expect(parchado.tuboPaso.OSCURANTI).toEqual(FORMULAS_OSCURIDAD_DEFAULT.tuboPaso.OSCURANTI);
    expect(parchado.tuboPaso.DARK_45).toEqual(FORMULAS_OSCURIDAD_DEFAULT.tuboPaso.DARK_45);
    // El original no se muta.
    expect(FORMULAS_OSCURIDAD_DEFAULT.tuboPaso.DARK).not.toEqual([9, 9, 9]);
  });

  it('un parche de otra categoría no toca nada', () => {
    const f = {
      ...FORMULAS_OSCURIDAD_DEFAULT,
      porTipo: { OTRO_38mm: { cenefaAdj: [1, 1, 1] as [number, number, number] } },
    };
    expect(formulasOscuridadParaTipo(f, 'DARK_PRO_38mm', 'DARK')).toBe(f);
  });
});

describe('tipo sobre DARK 38 — despiece', () => {
  it('sin parche corta EXACTAMENTE igual que el DARK nativo (golden de pizarra)', () => {
    const conTipo = calcularDespiece(modeloDark, 200, {
      categoria: 'DARK_PRO_38mm',
      altoCm: 200,
      oscuridadVariante: 'INTERNO',
      tipos: [TIPO_DARK],
    });
    // Pizarra DARK 200 INTERNO: 199,7 / 198,7 / 193,9 / 193,3 / 193,5.
    expect(medida(conTipo, 'Cenefa Delantera')).toBe(199.7);
    expect(medida(conTipo, 'Cenefa Trasera')).toBe(198.7);
    expect(medida(conTipo, 'Tubo')).toBe(193.9);
    expect(medida(conTipo, 'Tela (ancho)')).toBe(193.3);
    expect(medida(conTipo, 'Peso')).toBe(193.5);

    const nativo = calcularDespiece(modeloDark, 200, {
      categoria: 'DARK_38mm',
      altoCm: 200,
      oscuridadVariante: 'INTERNO',
    });
    expect(conTipo.cortes).toEqual(nativo.cortes);
  });

  it('con paso de tubo propio mueve la cadena completa y deja el DARK nativo intacto', () => {
    const formulas = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        // El molde descuenta 4,8 en INTERNO; este tipo descuenta 8.
        porTipo: { DARK_PRO_38mm: { tuboPaso: [8, 5, 5.4] as [number, number, number] } },
      },
    };
    const ctx = {
      altoCm: 200,
      oscuridadVariante: 'INTERNO' as const,
      tipos: [TIPO_DARK],
      formulas,
    };
    const propio = calcularDespiece(modeloDark, 200, { ...ctx, categoria: 'DARK_PRO_38mm' });
    // La cenefa no cambia (no se parchó); el tubo baja 3,2 y arrastra tela y peso.
    expect(medida(propio, 'Cenefa Trasera')).toBe(198.7);
    expect(medida(propio, 'Tubo')).toBe(190.7);
    expect(medida(propio, 'Tela (ancho)')).toBe(190.1);
    expect(medida(propio, 'Peso')).toBe(190.3);

    const nativo = calcularDespiece(modeloDark, 200, { ...ctx, categoria: 'DARK_38mm' });
    expect(medida(nativo, 'Tubo')).toBe(193.9);
    expect(medida(nativo, 'Peso')).toBe(193.5);
  });

  it('con cenefa propia arrastra toda la cadena por debajo', () => {
    const formulas = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        porTipo: { DARK_PRO_38mm: { cenefaAdj: [-1, 7.5, 15.8] as [number, number, number] } },
      },
    };
    const d = calcularDespiece(modeloDark, 200, {
      categoria: 'DARK_PRO_38mm',
      altoCm: 200,
      oscuridadVariante: 'INTERNO',
      tipos: [TIPO_DARK],
      formulas,
    });
    expect(medida(d, 'Cenefa Delantera')).toBe(199);
    expect(medida(d, 'Cenefa Trasera')).toBe(198);
    expect(medida(d, 'Tubo')).toBe(193.2);
    expect(medida(d, 'Peso')).toBe(192.8);
  });

  it('emite las mismas columnas del Excel que su molde', () => {
    const d = calcularDespiece(modeloDark, 200, {
      categoria: 'DARK_PRO_38mm',
      altoCm: 200,
      oscuridadVariante: 'INTERNO',
      tipos: [TIPO_DARK],
    });
    expect(columna(d, 'CENEFA DELANTERA')).toBe(199.7);
    expect(columna(d, 'CENEFA TRASERA')).toBe(198.7);
    expect(columna(d, 'TUBO')).toBe(193.9);
    expect(columna(d, 'PESO SOFT LIGHT')).toBe(193.5);
  });
});

describe('tipo sobre ROL — hereda la mecánica del roller', () => {
  const modeloRoller: ModeloDespiece = {
    ...base,
    sistema: 'ROLLER_SIMPLE',
    tipo_rol: 'ROL_SIMPLE',
    mecanismo: 'MEC_33_KIT_SIMPLE_BLANCO',
    dcto_tubo_cm: 3.8,
    dcto_tela_cm: 0.5,
    suma_peso_cm: 0.1,
  };

  it('corta con los descuentos de la fila del catálogo, igual que ROL', () => {
    const d = calcularDespiece(modeloRoller, 150.1, {
      categoria: 'ROL_INDUSTRIAL',
      tipos: [TIPO_ROL],
    });
    expect(columna(d, 'TUBO')).toBe(146.3);
    expect(columna(d, 'PESO')).toBe(145.9);
  });

  it('no entra por la rama de oscuridad', () => {
    expect(familiaOscuridad('ROL_INDUSTRIAL', undefined, [TIPO_ROL])).toBeNull();
  });
});

describe('familia de oscuridad por tipo', () => {
  it('resuelve la familia del molde', () => {
    expect(familiaOscuridad('DARK_PRO_38mm', undefined, [TIPO_DARK])).toBe('DARK');
  });

  it('sin los tipos a mano NO adivina (y por eso hay que pasarlos)', () => {
    expect(familiaOscuridad('DARK_PRO_38mm')).toBeNull();
  });

  it('respeta el tipo de cenefa del molde soft light', () => {
    const tipoSL: TipoCortina = {
      categoria: 'SL_PRO_38mm',
      nombre: 'Soft Pro',
      grupo: 'Tipos propios',
      base: 'SOFT_LIGHT_38mm',
      activo: true,
    };
    expect(familiaOscuridad('SL_PRO_38mm', undefined, [tipoSL])).toBe('SOFT_LIGHT_38');
    expect(familiaOscuridad('SL_PRO_38mm', 'Cuadrada a muro', [tipoSL])).toBe('SOFT_LIGHT_CC');
  });
});

describe('catálogo de modelos del tipo', () => {
  const modelos: ModeloDespiece[] = [
    { ...base, sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE', mecanismo: 'MEC_33_BLANCO' },
    { ...base, sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_INDUSTRIAL_1', mecanismo: 'MEC_33_BLANCO' },
    { ...base, sistema: 'ROLLER_DUAL', tipo_rol: 'DUAL', mecanismo: 'MEC_01_DUAL' },
  ];

  it('sin filas propias hereda las de su molde', () => {
    const r = modelosParaCategoria(modelos, 'ROL_INDUSTRIAL', [TIPO_ROL]);
    expect(r).toHaveLength(2);
  });

  it('con filas propias usa solo las suyas', () => {
    const conFilas: TipoCortina = { ...TIPO_ROL, sistemas: ['ROLLER_SIMPLE'], tipoIncluye: 'INDUSTRIAL' };
    const r = modelosParaCategoria(modelos, 'ROL_INDUSTRIAL', [conFilas]);
    expect(r.map((m) => m.tipo_rol)).toEqual(['ROL_INDUSTRIAL_1']);
  });

  it('un tipo sobre ROL_DUAL es dual', () => {
    const dual: TipoCortina = { ...TIPO_ROL, categoria: 'ROL_DOBLE', base: 'ROL_DUAL' };
    expect(categoriaEsDual('ROL_DOBLE', [dual])).toBe(true);
    expect(categoriaEsDual('ROL_INDUSTRIAL', [TIPO_ROL])).toBe(false);
  });

  it('una categoría desconocida sigue sin modelos', () => {
    expect(modelosParaCategoria(modelos, 'NO_EXISTE', [TIPO_ROL])).toEqual([]);
  });
});

describe('tipo DESACTIVADO', () => {
  const guardado: TipoCortina = { ...TIPO_DARK, activo: false };

  it('una orden ya guardada se sigue calculando con su molde', () => {
    const d = calcularDespiece(modeloDark, 200, {
      categoria: 'DARK_PRO_38mm',
      altoCm: 200,
      oscuridadVariante: 'INTERNO',
      tipos: [guardado],
    });
    expect(medida(d, 'Tubo')).toBe(193.9);
    expect(medida(d, 'Peso')).toBe(193.5);
  });
});

describe('el molde nativo nunca se contamina', () => {
  it('dos ventanas en la misma orden, una nativa y otra de tipo propio', () => {
    const formulas = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        porTipo: { DARK_PRO_38mm: { tuboPaso: [8, 5, 5.4] as [number, number, number] } },
      },
    };
    const comun = { altoCm: 200, oscuridadVariante: 'INTERNO' as const, tipos: [TIPO_DARK], formulas };
    const propio = calcularDespiece(modeloDark, 200, { ...comun, categoria: 'DARK_PRO_38mm' });
    const nativo = calcularDespiece(modeloDark, 200, { ...comun, categoria: 'DARK_38mm' });
    const otraVez = calcularDespiece(modeloDark, 200, { ...comun, categoria: 'DARK_PRO_38mm' });

    expect(medida(propio, 'Tubo')).toBe(190.7);
    expect(medida(nativo, 'Tubo')).toBe(193.9);
    expect(medida(otraVez, 'Tubo')).toBe(190.7);
  });
});

describe('el perfil base respeta las fórmulas editadas (fix)', () => {
  it('editar el ajuste del perfil base mueve el CORTE, no solo la vista previa', () => {
    const perfiles = { infActivo: true, infMuro: true, infMontaje: 'PARED' as const };
    const conDefault = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, perfiles, {}, null);
    const editadas = {
      ...FORMULAS_OSCURIDAD_DEFAULT,
      infSoftlight: {
        ...FORMULAS_OSCURIDAD_DEFAULT.infSoftlight,
        INTERNO: { DENTRO: -13.3, PARED: -5 },
      },
    };
    const conEdicion = cortesOscuridad(
      'SOFT_LIGHT_38',
      'INTERNO',
      200,
      200,
      perfiles,
      {},
      null,
      editadas,
    );
    const base0 = conDefault.find((c) => c.componente.includes('inferior'))?.medidaCm;
    const base1 = conEdicion.find((c) => c.componente.includes('inferior'))?.medidaCm;
    expect(base0).toBeDefined();
    expect(base1).toBeDefined();
    expect(base1).not.toBe(base0);
    expect(base1).toBe(195);
  });
});
