import { describe, expect, it } from 'vitest';
import {
  armadoDesdeSentido,
  cierreDesdeDireccion,
  colorAccesorioCorto,
  direccionDesdeCierre,
  enriquecerPanoDesdeFase0,
  enriquecerVentanaDesdeFase0,
  motorAdicionalParaUbic,
  otTraeHubDomotica,
  sentidoDesdeArmado,
  tipoTelaDesdeProducto,
  tipoTelaDesdeVentana,
} from './fase0-sync';
import { crearPanoVacio } from './fase2';
import type { Pano, Ventana } from './types';

describe('fase0-sync', () => {
  it('sentido INTERNO/EXTERNO → armado', () => {
    expect(armadoDesdeSentido('INTERNO')).toBe('Interno');
    expect(armadoDesdeSentido('EXTERNO')).toBe('Externo');
  });

  it('cod producto → tipo tela', () => {
    expect(tipoTelaDesdeProducto('SCREEN_P', 'SC 64')).toBe('SCR');
    expect(tipoTelaDesdeProducto('BLACKOUT_D', 'BK 18')).toBe('BK');
    expect(tipoTelaDesdeProducto('DUOBK', '')).toBe('DU');
    expect(tipoTelaDesdeProducto('', 'SC 68')).toBe('SCR');
  });

  it('direccion cadena → cierre', () => {
    expect(cierreDesdeDireccion('CAD [IZQUIERDA]')).toBe('Izquierda');
    expect(cierreDesdeDireccion('CAD [DERECHA]')).toBe('Derecha');
    expect(cierreDesdeDireccion('CIERRE [MEDIO]')).toBe('Medio');
  });

  it('recíprocos armado→sentido y cierre→direccion (para Fase 2 → cotización)', () => {
    expect(sentidoDesdeArmado('Interno')).toBe('INTERNO');
    expect(sentidoDesdeArmado('Externo')).toBe('EXTERNO');
    expect(sentidoDesdeArmado('')).toBe('');
    expect(direccionDesdeCierre('Izquierda')).toBe('CAD [IZQUIERDA]');
    expect(direccionDesdeCierre('Derecha')).toBe('CAD [DERECHA]');
    expect(direccionDesdeCierre('Medio')).toBe('CIERRE [MEDIO]');
    expect(direccionDesdeCierre('Vertical')).toBe('');
  });

  it('color accesorios → código corto', () => {
    expect(colorAccesorioCorto('BLANCO')).toBe('BCO');
    expect(colorAccesorioCorto('GRIS')).toBe('GRS');
  });

  it('enriquecerPano solo rellena vacíos', () => {
    const ventana = {
      id: '1',
      sentido: 'EXTERNO',
      direccion: 'CAD [DERECHA]',
      codInt: 'BK 18',
      color: 'BLANCO',
      panos: [],
    } as unknown as Ventana;
    const pano = { ancho: 2, alto: 2, color: 'BLANCO', armado: 'Interno' } as Pano;
    const out = enriquecerPanoDesdeFase0(pano, ventana, {
      'BK 18': { cod: 'BLACKOUT_D', producto: '', tipo: '', descripcion: '', precio: 0 },
    });
    expect(out.armado).toBe('Interno');
    expect(out.tipoTela).toBe('BK');
    expect(out.cierreVert).toBe('Derecha');
    expect(out.colorPeso).toBe('BCO');
  });

  it('tipoTelaDesdeVentana sin catálogo usa COD_INT', () => {
    expect(tipoTelaDesdeVentana({ codInt: 'SC 64' })).toBe('SCR');
  });

  it('paño NUEVO (vacío) toma el color y la tela REALES de la ventana, no BCO/SCR', () => {
    const ventana = {
      id: '1',
      codInt: 'BK 18',
      color: 'NEGRO',
      panos: [],
    } as unknown as Ventana;
    const out = enriquecerPanoDesdeFase0(crearPanoVacio(), ventana, {
      'BK 18': { cod: 'BLACKOUT_D', producto: '', tipo: '', descripcion: '', precio: 0 },
    });
    // Antes crearPanoVacio nacía con BCO/SCR duros y este relleno nunca corría.
    expect(out.colorPeso).toBe('NEG');
    expect(out.colorCadena).toBe('NEG');
    expect(out.colorMecanismo).toBe('NEG');
    expect(out.tipoTela).toBe('BK');
  });

  it('adicional CENFO en misma ubicación → pre-selecciona cenefa Ovalada y tira', () => {
    const ventana = {
      id: '1',
      ubicacion: 'PZA 3-G2',
      codInt: 'BK 18',
      panos: [{ ancho: 2.969, alto: 2, color: 'BLANCO' } as Pano],
    } as Ventana;
    const adicionales = [
      { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'PZA 3-G2', conTira: true },
    ];
    const out = enriquecerVentanaDesdeFase0(ventana, undefined, adicionales);
    expect(out.panos[0].cenefa).toBe('Ovalada');
    expect(out.panos[0].cenefaTira).toBe('CON TIRA');
  });

  it('adicional CEN-PRO → pre-selecciona cenefa Cuadrada', () => {
    const ventana = {
      id: '1',
      ubicacion: 'PPAL BK',
      panos: [{ ancho: 3.5, alto: 2, color: 'CAFÉ' } as Pano],
    } as Ventana;
    const adicionales = [
      { codInt: 'CEN-PRO', cantidad: 3.56, descuento: 0, ubicacion: 'PPAL BK' },
    ];
    const out = enriquecerPanoDesdeFase0(
      { ancho: 3.5, alto: 2, color: 'CAFÉ', cenefa: 'No' } as Pano,
      ventana,
      undefined,
      { adicionalesFase0: adicionales, panoIndex: 0, totalPanos: 1 },
    );
    expect(out.cenefa).toBe('Cuadrada');
  });

  it('BEEBLACK INTERNO → variante y manillas ON por defecto', () => {
    const ventana = {
      id: '1',
      categoria: 'BEEBLACK',
      sentido: 'INTERNO',
      panos: [{ ancho: 2, alto: 1.301, color: 'BLANCO' } as Pano],
    } as Ventana;
    const out = enriquecerPanoDesdeFase0(ventana.panos[0], ventana);
    expect(out.beeblackVariante).toBe('INTERNO');
    expect(out.beeblackManillaIzq).toBe(true);
    expect(out.beeblackManillaDer).toBe(true);
  });

  it('BEEBLACK EXTERNO → variante EXTERNO_SEMI', () => {
    const ventana = {
      id: '1',
      categoria: 'BEEBLACK',
      sentido: 'EXTERNO',
      panos: [{ ancho: 1.5, alto: 1.3, color: 'BLANCO' } as Pano],
    } as Ventana;
    const out = enriquecerPanoDesdeFase0(ventana.panos[0], ventana);
    expect(out.beeblackVariante).toBe('EXTERNO_SEMI');
  });
});

// Motor desde los adicionales de Fase 0: el motor cotizado como adicional
// (DOM 38/41) se precarga en el paño cuya UBIC. calza, para que aparezca en
// Fase 2 y en Fase 4/inventario. Match estricto por ubicación (solo la que
// calza), robusto a separadores; domótica si la OT trae el hub DOM 43.
describe('fase0-sync — motor desde adicionales de Fase 0', () => {
  const ventanaLiving = (ubic: string): Ventana =>
    ({
      id: ubic,
      ubicacion: ubic,
      codInt: 'SC 11',
      categoria: 'ROL',
      panos: [{ ancho: 1.6, alto: 1.7, color: 'NEGRO' } as Pano],
    }) as Ventana;

  it('motorAdicionalParaUbic: calza pese al separador (punto vs guion)', () => {
    const adic = [{ codInt: 'DOM 38', cantidad: 3, descuento: 30, ubicacion: 'LIVING IZQ.G1' }];
    expect(motorAdicionalParaUbic('LIVING IZQ-G1', adic)).toBe('DOM38');
    expect(motorAdicionalParaUbic('LIVING CENT-G1', adic)).toBeNull();
    expect(motorAdicionalParaUbic('', adic)).toBeNull();
  });

  it('otTraeHubDomotica detecta el DOM 43', () => {
    expect(otTraeHubDomotica([{ codInt: 'DOM 43', cantidad: 1, descuento: 0 }])).toBe(true);
    expect(otTraeHubDomotica([{ codInt: 'DOM 39', cantidad: 1, descuento: 0 }])).toBe(false);
    expect(otTraeHubDomotica([])).toBe(false);
  });

  it('motor DOM 38 en la misma ubicación (separador distinto) + hub → motorModelo + domótica', () => {
    const adicionales = [
      { codInt: 'DOM 38', cantidad: 3, descuento: 30, ubicacion: 'LIVING IZQ.G1' },
      { codInt: 'DOM 43', cantidad: 1, descuento: 10, ubicacion: '' },
    ];
    const out = enriquecerVentanaDesdeFase0(ventanaLiving('LIVING IZQ-G1'), undefined, adicionales);
    expect(out.panos[0].motorModelo).toBe('DOM38');
    expect(out.panos[0].motorDomotica).toBe(true);
  });

  it('ubicación que NO calza → cortina sin motor (match estricto)', () => {
    const adicionales = [
      { codInt: 'DOM 38', cantidad: 3, descuento: 30, ubicacion: 'LIVING IZQ.G1' },
    ];
    const out = enriquecerVentanaDesdeFase0(ventanaLiving('LIVING CENT-G1'), undefined, adicionales);
    expect(out.panos[0].motorModelo).toBeFalsy();
  });

  it('sin hub DOM 43 → motor sin domótica', () => {
    const adicionales = [
      { codInt: 'DOM 38', cantidad: 1, descuento: 0, ubicacion: 'LIVING IZQ-G1' },
    ];
    const out = enriquecerVentanaDesdeFase0(ventanaLiving('LIVING IZQ-G1'), undefined, adicionales);
    expect(out.panos[0].motorModelo).toBe('DOM38');
    expect(out.panos[0].motorDomotica).toBeFalsy();
  });

  it('un control (DOM 39) NO motoriza aunque calce la ubicación', () => {
    const adicionales = [
      { codInt: 'DOM 39', cantidad: 1, descuento: 10, ubicacion: 'LIVING IZQ-G1' },
    ];
    const out = enriquecerVentanaDesdeFase0(ventanaLiving('LIVING IZQ-G1'), undefined, adicionales);
    expect(out.panos[0].motorModelo).toBeFalsy();
  });

  it('no pisa un motor ya elegido en terreno', () => {
    const adicionales = [
      { codInt: 'DOM 38', cantidad: 1, descuento: 0, ubicacion: 'LIVING IZQ-G1' },
    ];
    const ventana = {
      id: 'x',
      ubicacion: 'LIVING IZQ-G1',
      codInt: 'SC 11',
      categoria: 'ROL',
      panos: [{ ancho: 1.6, alto: 1.7, color: 'NEGRO', motorModelo: 'DOM41' } as Pano],
    } as Ventana;
    const out = enriquecerVentanaDesdeFase0(ventana, undefined, adicionales);
    expect(out.panos[0].motorModelo).toBe('DOM41'); // respeta lo elegido
  });
});
