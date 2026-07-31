import { describe, expect, it } from 'vitest';
import {
  CHIPS_MECANISMO_LEGACY,
  crearPanoVacio,
  esCenefaCuadrada,
  OPCIONES_CENEFA,
  OPCIONES_LARGO_CADENA,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_DUAL,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
  parcheApagarPerfilBase,
  parcheSuperficiePerfil,
} from './fase2';

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
      'E78 - TUBO 43MM(ESP1.2)(5.8)',
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
