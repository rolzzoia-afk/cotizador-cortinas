import { describe, expect, it } from 'vitest';
import { pendientesFase2, pendientesPorVentana, resumenPendientes } from './fase2-completitud';
import type { CatalogoProductos, Pano, Ventana } from './types';
import { esLineaB } from './lineaB';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

const modeloRoller: ModeloDespiece = {
  sistema: 'ROLLER', tipo_rol: 'ROL', mecanismo: 'MEC_33', codigos_tubo: 'E02',
  diametro_tubo_mm: 38, dcto_tubo_cm: 3.8, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
} as ModeloDespiece;

/** Paño ROLLER completo: sin pendientes. Cada test le quita UNA cosa. */
const panoOk = (over: Partial<Pano> = {}): Pano =>
  ({
    ancho: 1.5,
    alto: 2,
    mecanismo: 'SINFLEX BLANCO [MEC 33]',
    tuberia: '38mm [E02]',
    color: 'BLANCO',
    materialTipo: 'CONCRETO',
    codCadena: 'CAD 03',
    codPeso: 'PCA 04',
    ...over,
  }) as unknown as Pano;

const ventOk = (over: Partial<Ventana> = {}, pano: Partial<Pano> = {}): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING',
    categoria: 'ROL',
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    alto: 2,
    modelo: modeloRoller,
    panos: [panoOk(pano)],
    ...over,
  }) as unknown as Ventana;

const mensajes = (v: Ventana[]) => pendientesFase2(v).map((p) => p.mensaje);

describe('pendientesFase2 — paño completo', () => {
  it('un roller con todo definido no tiene pendientes', () => {
    expect(pendientesFase2([ventOk()])).toEqual([]);
  });

  it('lista vacía de ventanas → sin pendientes', () => {
    expect(pendientesFase2([])).toEqual([]);
  });
});

describe('pendientesFase2 — datos de la ventana', () => {
  it('sin ubicación / categoría / modelo', () => {
    const m = mensajes([ventOk({ ubicacion: '', categoria: '', modelo: null } as Partial<Ventana>)]);
    expect(m).toContain('falta la ubicación');
    expect(m).toContain('falta la categoría');
    expect(m).toContain('falta el modelo de fabricación');
  });

  it('ventana sin paños corta ahí (no repite pendientes de paño)', () => {
    const p = pendientesFase2([ventOk({ panos: [] })]);
    expect(p.map((x) => x.mensaje)).toEqual(['no tiene paños']);
    expect(p[0].panoIdx).toBeNull();
  });

  it('BEEBLACK no exige modelo de fabricación, pero sí su variante', () => {
    const bee = ventOk(
      { categoria: 'BEEBLACK', modelo: null } as Partial<Ventana>,
      { beeblackVariante: '' },
    );
    const m = mensajes([bee]);
    expect(m).not.toContain('falta el modelo de fabricación');
    expect(m).toContain('falta la variante BEEBLACK');
  });
});

describe('pendientesFase2 — datos del paño', () => {
  const sinDato = (over: Partial<Pano>) => mensajes([ventOk({}, over)]);

  it('medidas, mecanismo y tubería', () => {
    expect(sinDato({ ancho: 0 })).toContain('falta el ancho');
    expect(sinDato({ alto: 0, ...({} as object) })).toBeDefined();
    expect(sinDato({ mecanismo: '' })).toContain('falta el mecanismo');
    expect(sinDato({ tuberia: '' })).toContain('falta la tubería');
  });

  it('color de accesorios y material de instalación', () => {
    const sinColor = mensajes([
      ventOk({ color: '' } as Partial<Ventana>, { color: '', colorMecanismo: '', colorCadena: '', colorPeso: '' }),
    ]);
    expect(sinColor).toContain('falta el color de accesorios');
    // Sin material la OT sale con 0 tarugos y sin aviso: por eso bloquea.
    expect(sinDato({ materialTipo: '' })).toContain('falta el material de instalación');
  });

  it('cadena y peso solo cuando el mecanismo es manual', () => {
    expect(sinDato({ codCadena: '', codPeso: '' })).toEqual(
      expect.arrayContaining(['falta la cadena', 'falta el peso de cadena']),
    );
    // Con motor, la cadena no aplica (el motor la reemplaza).
    const conMotor = sinDato({ codCadena: '', codPeso: '', motorModelo: 'DOM38', ladoMotor: 'DERECHO' });
    expect(conMotor).not.toContain('falta la cadena');
    expect(conMotor).not.toContain('falta el peso de cadena');
  });

  it('manilla: el color solo se exige si hay cantidad', () => {
    expect(sinDato({ manillaCant: 2, manillaColor: '' })).toContain('falta el color de la manilla');
    expect(sinDato({ manillaCant: 0, manillaColor: '' })).not.toContain('falta el color de la manilla');
  });

  it('motor: modelo y lado', () => {
    expect(sinDato({ motorTipo: 'Somfy', motorModelo: '', ladoMotor: '' })).toEqual(
      expect.arrayContaining(['falta el modelo de motor', 'falta el lado del motor']),
    );
  });

  it('dúo: altura de cierre', () => {
    const duo = mensajes([ventOk({ categoria: 'DUO_MANUAL_38mm' }, { cierreAlturaCm: 0 })]);
    expect(duo).toContain('falta la altura de cierre del dúo');
    const conCierre = mensajes([ventOk({ categoria: 'DUO_MANUAL_38mm' }, { cierreAlturaCm: 120 })]);
    expect(conCierre).not.toContain('falta la altura de cierre del dúo');
  });
});

describe('pendientesFase2 — cenefas', () => {
  it('ovalada: superficie, color de tapa, bracket y tira', () => {
    const m = mensajes([ventOk({}, { cenefa: 'Ovalada' })]);
    expect(m).toEqual(
      expect.arrayContaining([
        'falta la superficie (techo/pared)',
        'falta el color de tapa de la cenefa',
        'falta el tipo de bracket',
        'falta definir la tira de la cenefa (con/sin)',
      ]),
    );
    const completa = mensajes([
      ventOk({}, { cenefa: 'Ovalada', superficie: 'TECHO', colorTapa: 'BLANCO', bracketTipo: 'CORTO', cenefaTira: 'CON TIRA' }),
    ]);
    expect(completa).toEqual([]);
  });

  it('cuadrada de roller: pide tapas; en oscuridad son fijas y no se piden', () => {
    const roller = mensajes([ventOk({}, { cenefa: 'Cuadrada a muro', superficie: 'PARED' })]);
    expect(roller).toEqual(
      expect.arrayContaining(['falta el tipo de tapas de la cenefa', 'falta el color de tapa de la cenefa']),
    );
    // Soft light con cenefa cuadrada: las tapas son fijas del sistema.
    const soft = mensajes([
      ventOk({ categoria: 'SOFT_LIGHT_38mm' }, {
        cenefa: 'Cuadrada a muro', superficie: 'PARED',
        perfilIzqPiso: true, perfilDerPiso: true,
      }),
    ]);
    expect(soft).not.toContain('falta el tipo de tapas de la cenefa');
  });
});

describe('pendientesFase2 — perfiles de oscuridad (mismo criterio que el Excel)', () => {
  const soft = (pano: Partial<Pano>) =>
    mensajes([
      ventOk(
        { categoria: 'SOFT_LIGHT_38mm' },
        { cenefa: 'Ovalada', superficie: 'PARED', colorTapa: 'BLANCO', bracketTipo: 'CORTO', cenefaTira: 'SIN TIRA', ...pano },
      ),
    ]);

  it('lateral activo sin superficie → falta la instalación', () => {
    const m = soft({ oscuridadVariante: 'INTERNO' });
    expect(m).toContain('Perfil izquierdo: falta la instalación (muro/piso/marco)');
    expect(m).toContain('Perfil derecho: falta la instalación (muro/piso/marco)');
  });

  it('con la superficie elegida no reporta nada (los laterales traen su perforación)', () => {
    const m = soft({ oscuridadVariante: 'INTERNO', perfilIzqPiso: true, perfilDerPiso: true });
    expect(m).toEqual([]);
  });

  it('SEMI: los laterales quedan sin perforación → la pide', () => {
    const m = soft({ oscuridadVariante: 'SEMI', perfilIzqPiso: true, perfilDerPiso: true });
    expect(m).toContain('Perfil izquierdo a Piso: falta la perforación (int/ext)');
  });

  it('separador sin medida derivable (su perfil no tiene superficie) → pide la medida, no la perforación', () => {
    const m = soft({ oscuridadVariante: 'INTERNO', perfilDerPiso: true, separadorIzq: true });
    expect(m).toContain('Separador izquierdo: falta la medida');
    expect(m.some((x) => x.startsWith('Separador izquierdo: falta la perforación'))).toBe(false);
    // Con el perfil del lado ya definido, el separador hereda su medida.
    const conPerfil = soft({ oscuridadVariante: 'INTERNO', perfilIzqPiso: true, perfilDerPiso: true, separadorIzq: true });
    expect(conPerfil).toEqual([]);
  });
});

describe('resumen y agrupación', () => {
  it('resumenPendientes cuenta datos y ventanas', () => {
    const p = pendientesFase2([
      ventOk({ id: 'a', ubicacion: 'LIVING' }, { materialTipo: '' }),
      ventOk({ id: 'b', ubicacion: 'PIEZA' }, { materialTipo: '', tuberia: '' }),
    ]);
    expect(resumenPendientes(p)).toBe('3 datos pendientes en 2 ventanas');
    expect(resumenPendientes(p.slice(0, 1))).toBe('1 dato pendiente en 1 ventana');
  });

  it('pendientesPorVentana agrupa conservando el orden', () => {
    const p = pendientesFase2([
      ventOk({ id: 'a', ubicacion: 'LIVING' }, { materialTipo: '' }),
      ventOk({ id: 'b', ubicacion: 'PIEZA' }, { tuberia: '' }),
    ]);
    const grupos = pendientesPorVentana(p);
    expect(grupos.map((g) => g.ubicacion)).toEqual(['LIVING', 'PIEZA']);
    expect(grupos[0].items).toHaveLength(1);
  });
});

describe('pendientesFase2 — categoría B (solo hay herrajes en blanco y negro)', () => {
  // Catálogo mínimo: una tela de gama B y una de gama A.
  const CAT = {
    'SC 99': { cod: 'SCREEN_P', producto: 'SCREEN B', precio: 0, categoria: 'B' },
    'SC 64': { cod: 'SCREEN_P', producto: 'SCREEN A', precio: 0, categoria: 'A' },
  } as unknown as CatalogoProductos;

  const conTela = (codInt: string, pano: Partial<Pano> = {}) =>
    ventOk({ codInt }, pano);

  it('una cortina de tela B con accesorios grises no deja avanzar', () => {
    const p = pendientesFase2([conTela('SC 99', { color: 'GRIS' })], undefined, undefined, CAT);
    expect(p).toHaveLength(1);
    expect(p[0].mensaje).toContain('categoría B no tiene herrajes');
    expect(p[0].mensaje).toContain('GRIS');
  });

  it('la misma cortina en blanco o negro pasa sin problema', () => {
    for (const color of ['BLANCO', 'NEGRO']) {
      expect(pendientesFase2([conTela('SC 99', { color })], undefined, undefined, CAT)).toEqual([]);
    }
  });

  it('forzar la categoría A en esa cortina la destraba (los herrajes A sí tienen gris)', () => {
    const v = conTela('SC 99', { color: 'GRIS', lineaB: false });
    expect(pendientesFase2([v], undefined, undefined, CAT)).toEqual([]);
  });

  it('forzar la categoría B en una tela A sí aplica el chequeo', () => {
    const v = conTela('SC 64', { color: 'GRIS', lineaB: true });
    expect(pendientesFase2([v], undefined, undefined, CAT)[0]?.mensaje).toContain('categoría B');
  });

  it('sin catálogo el chequeo no corre (los llamadores que no lo pasan no lo necesitan)', () => {
    expect(pendientesFase2([conTela('SC 99', { color: 'GRIS' })])).toEqual([]);
  });
});

describe('la categoría B solo aplica donde tiene recetas', () => {
  const CAT = {
    'SC 99': { cod: 'SCREEN_P', producto: 'SCREEN B', precio: 0, categoria: 'B' },
  } as unknown as CatalogoProductos;

  it('una tela de gama B en un sistema de oscuridad NO entra en la categoría B', () => {
    // La gama comercial de la tela no cambia la estructura de un soft light:
    // sus perfiles, tubo y peso son los suyos, no los de la gama económica.
    expect(esLineaB({ lineaB: undefined, codInt: 'SC 99' }, 'SC 99', CAT, 'SOFT_LIGHT_38mm')).toBe(false);
    expect(esLineaB({ lineaB: undefined, codInt: 'SC 99' }, 'SC 99', CAT, 'BEEBLACK')).toBe(false);
    expect(esLineaB({ lineaB: undefined, codInt: 'SC 99' }, 'SC 99', CAT, 'VERTICAL')).toBe(false);
    // …ni siquiera forzándola a mano: no hay herrajes B para esos sistemas.
    expect(esLineaB({ lineaB: true, codInt: 'SC 99' }, 'SC 99', CAT, 'DARK_38mm')).toBe(false);
  });

  it('en roller simple, ovalada y dúo 38 sí entra', () => {
    for (const cat of ['ROL', 'ROL_MANUAL_CENEFA_OVALADA_38mm', 'DUO_MANUAL_38mm']) {
      expect(esLineaB({ lineaB: undefined, codInt: 'SC 99' }, 'SC 99', CAT, cat)).toBe(true);
    }
  });

  it('sin categoría responde solo por la tela (el distintivo A/B de la grilla)', () => {
    expect(esLineaB({ lineaB: undefined, codInt: 'SC 99' }, 'SC 99', CAT)).toBe(true);
  });
});
