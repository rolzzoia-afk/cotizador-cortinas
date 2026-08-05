// Overrides END-TO-END: una regla editada en Admin tiene que mover al motor
// real (chips, modelo, tubo, etiqueta), no solo a la pantalla de Admin.
import { describe, expect, it } from 'vitest';
import { mecanismoParaPano, modeloPorAncho, opcionesMecanismoFiltradas } from './chips';
import {
  REGLAS_MECANISMO,
  mecPorAncho,
  reglaAnchoAplicable,
  opcionesMecanismoResolucion,
} from './reglas-mecanismo';
import {
  REGLAS_TUBERIA,
  chipTuberiaDeModelo,
  codigoTuboPorAncho,
  opcionesTuberiaFiltradas,
  opcionesTuberiaResolucion,
  opcionesTuberiaUI,
  tuberiaParaPano,
} from './reglas-tuberia';
import { REGLAS_SELECCION_DEFAULT, type ReglasSeleccion } from './reglasSeleccion';
import { especTuboEtiqueta } from '@/modules/cotizador/pdfEtiquetasBrother';
import { OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA } from '@/modules/cotizador/fase2';
import type { ModeloDespiece } from './tipos';

function clonar(): ReglasSeleccion {
  return JSON.parse(JSON.stringify(REGLAS_SELECCION_DEFAULT)) as ReglasSeleccion;
}

const modelo = (mecanismo: string, diametro = 38): ModeloDespiece => ({
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo,
  codigos_tubo: 'E01; E02',
  diametro_tubo_mm: diametro,
  dcto_tubo_cm: 3.8,
  dcto_tela_cm: 0.5,
  suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 2.6,
  activo: true,
  notas: '',
});

const soft = (variante: string, diam: 38 | 45): ModeloDespiece => ({
  ...modelo('', diam),
  sistema: 'SOFT_LIGHT',
  tipo_rol: `SOFT_LIGHT_${variante}_${diam}mm`,
  codigos_tubo: diam === 45 ? 'E04; E05; E78' : 'E01; E02; E66',
});

describe('override de una regla por ancho', () => {
  it('mover la banda de 2,2 a 2,0 m cambia el kit que entra a 2,1 m', () => {
    const r = clonar();
    // Con los valores de fábrica, 2,1 m está FUERA de la banda.
    expect(mecPorAncho('ROL', 2.1, 'BCO', true)).toBeNull();
    r.mecanismo.reglasAncho = r.mecanismo.reglasAncho.map((x) =>
      x.categoria === 'ROL' && x.anchoMaxM === 3.0 ? { ...x, anchoMinM: 2.0 } : x,
    );
    expect(mecPorAncho('ROL', 2.1, 'BCO', true, r.mecanismo)).toBe(18);
    // Y el chip que sale del motor se mueve con ella.
    const chip = mecanismoParaPano(
      { mecanismo: '', color: 'BCO' },
      'BCO',
      null,
      OPCIONES_MECANISMO_RESOLUCION,
      'ROL',
      2.1,
      true,
      r,
    );
    expect(chip).toContain('[MEC 18]');
  });

  it('el gate del tubo E78 sigue mandando con reglas editadas', () => {
    const r = clonar();
    r.mecanismo.reglasAncho = r.mecanismo.reglasAncho.map((x) =>
      x.categoria === 'ROL' && x.anchoMaxM === 3.0 ? { ...x, anchoMinM: 2.0 } : x,
    );
    expect(mecPorAncho('ROL', 2.1, 'BCO', false, r.mecanismo)).toBeNull();
  });

  it('quitarle el gate a la regla la vuelve automática', () => {
    const r = clonar();
    r.mecanismo.reglasAncho = r.mecanismo.reglasAncho.map((x) => {
      if (!(x.categoria === 'ROL' && x.anchoMaxM === 3.0)) return x;
      const { requiereTuboE78: _quitado, ...resto } = x;
      return resto;
    });
    expect(mecPorAncho('ROL', 2.5, 'BCO', false, r.mecanismo)).toBe(18);
  });

  it('una regla por ancho NUEVA para una categoría que no tenía', () => {
    const r = clonar();
    r.mecanismo.reglasAncho = [
      ...r.mecanismo.reglasAncho,
      {
        descripcion: 'Soft light ancho → kit 63',
        categoria: 'SOFT_LIGHT_38mm',
        anchoMinM: 2.8,
        mec: 28,
        tubo: 'E47',
        nota: 'Sobre 2,8 m la soft light usa el kit de 63 mm.',
      },
    ];
    const aplicada = reglaAnchoAplicable('SOFT_LIGHT_38mm', 3.1, 'BCO', false, r.mecanismo);
    expect(aplicada?.mec).toBe(28);
    expect(aplicada?.regla.tubo).toBe('E47');
    // Sin el override, esa categoría no tiene regla por ancho.
    expect(reglaAnchoAplicable('SOFT_LIGHT_38mm', 3.1, 'BCO', false)).toBeNull();
  });
});

describe('override de la banda de oscuridad (antes hardcodeada en chips.ts)', () => {
  const modelos = [soft('INTERNO', 38), soft('INTERNO', 45)];

  it('con los valores de fábrica, 2,1 m NO sube a 45 mm', () => {
    const out = modeloPorAncho(modelos, 'SOFT_LIGHT_38mm', 2.1, modelos[0], 'BCO', true);
    expect(out?.diametro_tubo_mm).toBe(38);
  });

  it('bajar la banda a 2,0 m hace que 2,1 m suba el MODELO a 45 mm', () => {
    const r = clonar();
    r.mecanismo.bandaOscuridadE78 = { anchoMinM: 2.0, anchoMaxM: 3.0 };
    const out = modeloPorAncho(modelos, 'SOFT_LIGHT_38mm', 2.1, modelos[0], 'BCO', true, r.mecanismo);
    expect(out?.diametro_tubo_mm).toBe(45);
    expect(out?.tipo_rol).toBe('SOFT_LIGHT_INTERNO_45mm');
  });

  it('achicar la banda devuelve a 38 mm un ancho que antes subía', () => {
    const r = clonar();
    r.mecanismo.bandaOscuridadE78 = { anchoMinM: 2.8, anchoMaxM: 3.0 };
    const out = modeloPorAncho(modelos, 'SOFT_LIGHT_38mm', 2.5, modelos[1], 'BCO', true, r.mecanismo);
    expect(out?.diametro_tubo_mm).toBe(38);
  });
});

describe('override de las reglas de tubería', () => {
  it('mover el corte E02/E66 cambia el tubo elegido', () => {
    const r = clonar();
    const m38 = modelo('MEC_33', 38);
    expect(codigoTuboPorAncho(m38, 2.4)).toBe('E66');
    r.tuberia.reglaE02E66 = { ...r.tuberia.reglaE02E66, anchoMaxE02M: 2.5 };
    expect(codigoTuboPorAncho(m38, 2.4, undefined, r.tuberia)).toBe('E02');
  });

  it('una regla de categoría nueva fija el tubo de esa familia', () => {
    const r = clonar();
    r.tuberia.reglasCategoria = [
      ...r.tuberia.reglasCategoria,
      { descripcion: 'Dúo siempre E66', categoria: { includes: 'DUO' }, codigo: 'E66' },
    ];
    expect(codigoTuboPorAncho(modelo('MEC_33', 38), 1.5, 'DUO_MANUAL_38mm', r.tuberia)).toBe('E66');
    expect(codigoTuboPorAncho(modelo('MEC_33', 38), 1.5, 'DUO_MANUAL_38mm')).toBe('E02');
  });

  it('cambiar el orden de los tubos de 45 mm cambia cuál se auto-selecciona', () => {
    // Un modelo cuyo código propio (E04) no es un chip seleccionable: el tubo
    // sale de la lista de compatibles del diámetro, y ahí manda el ORDEN.
    const m45 = { ...modelo('MEC_18', 45), codigos_tubo: 'E04' };
    expect(chipTuberiaDeModelo(m45, OPCIONES_TUBERIA)).toBe('E78 - TUBO 43MM(ESP1.2)(5.8)');

    const r = clonar();
    r.tuberia.tubos45mm = ['E05', 'E78'];
    delete (r.tuberia.codigoPorDiametro as Record<number, string>)[45];
    expect(chipTuberiaDeModelo(m45, OPCIONES_TUBERIA, undefined, r.tuberia)).toBe(
      'E05 - TUBO Ø 45 mm',
    );
  });
});

describe('estados del catálogo en el motor', () => {
  it('un tubo oculto no se ofrece, pero el guardado se conserva (escape conStored)', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E05' ? { ...t, estado: 'oculto' as const } : t,
    );
    const ui = opcionesTuberiaUI(r.tuberia);
    expect(ui).not.toContain('E05 - TUBO Ø 45 mm');

    // El paño que ya lo tenía guardado lo sigue viendo en su selector.
    const conStored = opcionesTuberiaFiltradas(
      ui,
      { modelo: modelo('MEC_18', 45), tuberiaActual: 'E05 - TUBO Ø 45 mm' },
      r.tuberia,
    );
    expect(conStored).toContain('E05 - TUBO Ø 45 mm');
  });

  it('un tubo oculto elegido a mano NO se pisa al recalcular el paño', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E05' ? { ...t, estado: 'oculto' as const } : t,
    );
    const out = tuberiaParaPano(
      2.5,
      modelo('MEC_18', 45),
      'E05 - TUBO Ø 45 mm',
      opcionesTuberiaResolucion(r.tuberia),
      undefined,
      r.tuberia,
    );
    expect(out).toBe('E05 - TUBO Ø 45 mm');
  });

  it('un kit oculto sale del selector de Fase 2 pero sigue resolviendo', () => {
    const r = clonar();
    r.mecanismo.mecanismos = r.mecanismo.mecanismos.map((x) =>
      x.chip === 'KIT SIMPLE GRIS 38MM [MEC 34]' ? { ...x, estado: 'oculto' as const } : x,
    );
    const opts = opcionesMecanismoFiltradas(
      [],
      'ROL',
      'GRS',
      opcionesMecanismoUIDe(r),
      undefined,
      r.mecanismo,
    );
    expect(opts).not.toContain('KIT SIMPLE GRIS 38MM [MEC 34]');
    // Una OT guardada con ese kit lo sigue mostrando en el inventario.
    const chip = mecanismoParaPano(
      { mecanismo: 'KIT SIMPLE GRIS 38MM [MEC 34]', color: 'GRS' },
      'GRS',
      null,
      opcionesMecanismoResolucion(r.mecanismo),
      'ROL',
      1.5,
      false,
      r,
    );
    expect(chip).toBe('KIT SIMPLE GRIS 38MM [MEC 34]');
  });
});

describe('alta de una tubería nueva', () => {
  const nueva = {
    codigo: 'E90',
    descripcion: 'E90 - TUBO Ø 45 mm reforzado',
    diametroMm: 45,
    espesorMm: 2.5,
    estado: 'activo' as const,
    autoPorAncho: true,
  };

  it('aparece en el selector y la puede elegir una regla', () => {
    const r = clonar();
    r.tuberia.tubos = [...r.tuberia.tubos, nueva];
    r.tuberia.codigoPorDiametro = { ...r.tuberia.codigoPorDiametro, 45: 'E90' };
    expect(opcionesTuberiaUI(r.tuberia)).toContain(nueva.descripcion);
    expect(codigoTuboPorAncho(modelo('MEC_18', 45), 2.5, undefined, r.tuberia)).toBe('E90');
  });

  it('su espesor llega a la etiqueta Brother', () => {
    const r = clonar();
    r.tuberia.tubos = [...r.tuberia.tubos, nueva];
    expect(especTuboEtiqueta('45mm_E90', 'E90', r.tuberia)).toBe('45 mm de 2,5 mm');
    // Sin darla de alta, la etiqueta sale sin espesor.
    expect(especTuboEtiqueta('45mm_E90', 'E90')).toBe('45 mm');
  });

  it('completar el espesor de un tubo que no lo tenía se refleja en la etiqueta', () => {
    const r = clonar();
    r.tuberia.tubos = r.tuberia.tubos.map((t) =>
      t.codigo === 'E47' ? { ...t, espesorMm: 1.5 } : t,
    );
    expect(especTuboEtiqueta('63mm_E47', 'E47')).toBe('63 mm');
    expect(especTuboEtiqueta('63mm_E47', 'E47', r.tuberia)).toBe('63 mm de 1,5 mm');
  });
});

describe('sin overrides el comportamiento es el de siempre', () => {
  it('pasar las reglas de fábrica da lo mismo que no pasarlas', () => {
    const m38 = modelo('MEC_33', 38);
    expect(codigoTuboPorAncho(m38, 2.4, undefined, REGLAS_TUBERIA)).toBe(
      codigoTuboPorAncho(m38, 2.4),
    );
    expect(mecPorAncho('ROL', 3.5, 'BCO', false, REGLAS_MECANISMO)).toBe(
      mecPorAncho('ROL', 3.5, 'BCO', false),
    );
    expect(opcionesTuberiaUI(REGLAS_TUBERIA)).toEqual(OPCIONES_TUBERIA);
  });
});

/** Las opciones de UI del draft (helper local para no importar el módulo entero). */
function opcionesMecanismoUIDe(r: ReglasSeleccion): readonly string[] {
  return r.mecanismo.mecanismos.filter((m) => m.estado === 'activo').map((m) => m.chip);
}
