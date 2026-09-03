import { describe, expect, it } from 'vitest';
import {
  asegurarPanosDual,
  CAMPOS_PROPIOS_DEL_ROLLO,
  CHIPS_MECANISMO_LEGACY,
  crearPanoVacio,
  esCampoPropioDelRollo,
  esCenefaCuadrada,
  etiquetaPanos,
  OPCIONES_CENEFA,
  OPCIONES_LARGO_CADENA,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_DUAL,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
  parcheApagarPerfilBase,
  parcheSuperficiePerfil,
  quitarPanoDualAutomatico,
} from './fase2';
import type { Pano, Ventana } from './types';

describe('crearPanoVacio', () => {
  it('tela y colores de accesorios parten VACÍOS (los rellena fase0-sync con el dato real)', () => {
    const p = crearPanoVacio();
    // Regresión: los defaults duros 'SCR'/'BCO' bloqueaban el relleno desde
    // Fase 0 (fase0-sync solo escribe campos vacíos) y enmascaraban el
    // color/producto real de la ventana.
    expect(p.tipoTela).toBe('');
    expect(p.colorPeso).toBe('');
    expect(p.colorCadena).toBe('');
    expect(p.colorMecanismo).toBe('');
    expect(p.color).toBe('');
  });

  it('el lado de la cadena parte VACÍO: es una decisión de terreno, no un default', () => {
    // Preseteado en 'Derecha', nadie lo preguntaba y las cortinas salían con
    // el mando al lado que cayera (pedido del dueño, 2026-09-02).
    expect(crearPanoVacio().cierreVert).toBe('');
  });

  it('el armado parte VACÍO: dentro o fuera del vano se elige en terreno', () => {
    // Preseteado en 'Interno', el paso «Ventana y medidas» lo daba por listo y
    // nadie lo elegía (pedido del dueño, 2026-09-03).
    expect(crearPanoVacio().armado).toBe('');
  });
});

describe('dual — dos rollos, UNA cortina', () => {
  const vent = (categoria: string, panos: Partial<Pano>[]): Ventana =>
    ({
      id: 'v1',
      ubicacion: 'Living',
      categoria,
      codInt: 'SC 10',
      producto: 'SCREEN',
      tipo: '',
      color: 'BCO',
      alto: 2.5,
      precio: 0,
      cantidad: 1,
      panos: panos.map((p) => ({ ...crearPanoVacio(), ...p })),
    }) as unknown as Ventana;

  it('elegir ROL_DUAL completa el segundo rollo con la ficha del primero, sin su tela', () => {
    // El editor ya no pregunta la cantidad de paños: la dual la define sola.
    const v = asegurarPanosDual(
      vent('ROL_DUAL', [
        { ancho: '2.5', alto: '2.5', materialTipo: 'Muro', codInt: 'SC 10', producto: 'SCREEN', tipoTela: 'SCR' },
      ]),
    );
    expect(v.panos).toHaveLength(2);
    // Comparten ventana y bracket: las medidas y la instalación se copian.
    expect(v.panos[1].ancho).toBe('2.5');
    expect(v.panos[1].materialTipo).toBe('Muro');
    expect(v.panos[1].dual).toBe(true);
    // La tela NO: cada rollo lleva la suya (si se copiara, se cortarían dos
    // telas iguales y el error aparecería recién en el taller).
    expect(v.panos[1].codInt).toBe('');
    expect(v.panos[1].tipoTela).toBe('');
  });

  it('no toca la dual que ya viene con sus dos telas (import de Fase 1)', () => {
    const v = vent('ROL_DUAL', [{ codInt: 'SC 10' }, { codInt: 'BK 10' }]);
    expect(asegurarPanosDual(v)).toBe(v);
  });

  it('un roller simple no gana paños', () => {
    const v = vent('ROL', [{ ancho: '2.5' }]);
    expect(asegurarPanosDual(v).panos).toHaveLength(1);
  });

  it('al salir de la dual se va el rollo que se creó solo y baja el flag dual', () => {
    // Si el flag se quedara, el BOM seguiría emitiendo el bracket dual en una
    // cortina simple.
    const v = quitarPanoDualAutomatico(
      vent('ROL', [
        { ancho: '2.5', dual: true, dualLado: 'DERECHO', mecanismo: 'DUAL DERECHO BLANCO [MEC 01]' },
        { ancho: '2.5', dual: true, codInt: '' },
      ]),
    );
    expect(v.panos).toHaveLength(1);
    expect(v.panos[0].dual).toBe(false);
    expect(v.panos[0].dualLado).toBe('');
  });

  it('pero NO borra el rollo al que ya le eligieron tela', () => {
    const v = quitarPanoDualAutomatico(
      vent('ROL', [{ codInt: 'SC 10', dual: true }, { codInt: 'BK 10', dual: true }]),
    );
    expect(v.panos).toHaveLength(2);
    expect(v.panos.every((p) => p.dual === false)).toBe(true);
  });

  it('en la lista la dual cuenta ROLLOS, no paños («Doble» sonaba a dos cortinas)', () => {
    expect(etiquetaPanos(2, true)).toBe('Dual (2 rollos)');
    expect(etiquetaPanos(1, true)).toBe('Dual (1 rollo)');
    expect(etiquetaPanos(2, false)).toBe('Doble');
  });

  it('lo propio del rollo es su tela y el lado de su cadena; el resto es de la cortina', () => {
    // En MIXTO cada rollo lleva su cadena por un lado distinto, por eso el
    // cierre no se espeja. Las medidas sí: es la misma ventana.
    expect([...CAMPOS_PROPIOS_DEL_ROLLO]).toEqual([
      'codInt',
      'producto',
      'descripcion',
      'tipoTela',
      'cierreVert',
    ]);
    expect(esCampoPropioDelRollo('codInt')).toBe(true);
    expect(esCampoPropioDelRollo('cierreVert')).toBe(true);
    expect(esCampoPropioDelRollo('ancho')).toBe(false);
    expect(esCampoPropioDelRollo('materialTipo')).toBe(false);
  });
});

describe('opciones de Fase 2', () => {
  it('el largo de cadena ofrece 2.4mts (existe CAD16 y derivarLargoColor lo produce)', () => {
    expect(OPCIONES_LARGO_CADENA).toContain('2.4mts');
  });

  it('la tubería ya no ofrece el chip huérfano E53 (sin regla en reglas-tuberia)', () => {
    expect(OPCIONES_TUBERIA.some((o) => o.includes('E53'))).toBe(false);
  });

  it('la tubería usa las descripciones largas por código + E65 + VELCRO + VERTICAL', () => {
    expect([...OPCIONES_TUBERIA]).toEqual([
      'E02-TUBO 1.2 / Ø 38 mm',
      'E66 - TUBO (.40mm) - 2.5mm',
      'E39 - TUBO .43 - ESP 1.2 (TUBO .45)',
      'E05 - TUBO Ø 45 mm',
      'E47 - TUBO Ø 63 mm',
      'E65 - TUBO (.63mm)',
      'VELCRO',
      'VERTICAL',
    ]);
  });

  it('la lista de resolución = UI + duales + chips legacy, sin duplicados', () => {
    expect(OPCIONES_MECANISMO_RESOLUCION).toHaveLength(
      OPCIONES_MECANISMO.length + OPCIONES_MECANISMO_DUAL.length + CHIPS_MECANISMO_LEGACY.length,
    );
    expect(new Set(OPCIONES_MECANISMO_RESOLUCION).size).toBe(
      OPCIONES_MECANISMO_RESOLUCION.length,
    );
  });

  it('el material de instalación incluye CERÁMICA', () => {
    expect([...OPCIONES_MATERIAL_TIPO]).toEqual(['VULCANITA', 'CONCRETO', 'MADERA', 'CERÁMICA']);
  });

  it('la cenefa cuadrada se separa por instalación: muro y techo (sin el chip genérico)', () => {
    expect(OPCIONES_CENEFA).toContain('Cuadrada a muro');
    expect(OPCIONES_CENEFA).toContain('Cuadrada a techo');
    expect(OPCIONES_CENEFA).not.toContain('Cuadrada');
  });
});

describe('esCenefaCuadrada', () => {
  it('acepta las variantes nuevas y el "Cuadrada" legacy de OTs viejas', () => {
    expect(esCenefaCuadrada('Cuadrada a muro')).toBe(true);
    expect(esCenefaCuadrada('Cuadrada a techo')).toBe(true);
    expect(esCenefaCuadrada('Cuadrada')).toBe(true);
    expect(esCenefaCuadrada('  cuadrada a muro ')).toBe(true);
  });

  it('rechaza ovalada, No y vacío', () => {
    expect(esCenefaCuadrada('Ovalada')).toBe(false);
    expect(esCenefaCuadrada('No')).toBe(false);
    expect(esCenefaCuadrada('')).toBe(false);
    expect(esCenefaCuadrada(undefined)).toBe(false);
    expect(esCenefaCuadrada(null)).toBe(false);
  });
});

describe('parcheSuperficiePerfil — instalación del perfil de oscuridad', () => {
  it('la superficie es exclusiva: marca una y limpia las medidas manuales de las otras', () => {
    const p = parcheSuperficiePerfil('izq', 'muro');
    expect(p.perfilIzqActivo).toBe(true);
    expect(p.perfilIzqMuro).toBe(true);
    expect(p.perfilIzqPiso).toBe(false);
    expect(p.perfilIzqMarco).toBe(false);
    expect('perfilIzqMuroCm' in p).toBe(false); // la medida de la superficie elegida se respeta
    expect(p.perfilIzqPisoCm).toBeUndefined();
    expect(p.perfilIzqMarcoCm).toBeUndefined();
  });

  it('un LATERAL a piso apaga el perfil base y su separador', () => {
    for (const lado of ['izq', 'der'] as const) {
      const p = parcheSuperficiePerfil(lado, 'piso');
      expect(p.perfilInfActivo, lado).toBe(false);
      expect(p.perfilInfMuro, lado).toBe(false);
      expect(p.perfilInfPiso, lado).toBe(false);
      expect(p.perfilInfMarco, lado).toBe(false);
      expect(p.perfilInfPisoCm, lado).toBeUndefined();
      // El separador base hereda la medida del base: sin base quedaría pendiente
      // y bloquearía el avance de Fase 2.
      expect(p.separadorInf, lado).toBe(false);
      expect(p.separadorInfCm, lado).toBeUndefined();
    }
  });

  it('muro y "dentro del marco" NO tocan el perfil base', () => {
    for (const sup of ['muro', 'marco'] as const) {
      const p = parcheSuperficiePerfil('der', sup);
      expect('perfilInfActivo' in p, sup).toBe(false);
      expect('separadorInf' in p, sup).toBe(false);
    }
  });

  it('el perfil base a piso no se apaga a sí mismo', () => {
    const p = parcheSuperficiePerfil('inf', 'piso');
    expect(p.perfilInfActivo).toBe(true);
    expect(p.perfilInfPiso).toBe(true);
    expect('separadorInf' in p).toBe(false);
  });

  it('parcheApagarPerfilBase limpia marca, superficie, medidas y separador', () => {
    const p = parcheApagarPerfilBase();
    expect(p.perfilInfActivo).toBe(false);
    expect(p.perfilInfMuroCm).toBeUndefined();
    expect(p.separadorInf).toBe(false);
  });
});
