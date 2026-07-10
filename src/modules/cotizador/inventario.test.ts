// Tests de la hoja de inventario (Fase 4): construcción de filas por
// cortina y totales con adicional manual.
import { describe, expect, it } from 'vitest';
import type { BomItem, VentanaItem } from '@/modules/ots/types';
import {
  claveItem,
  codigoEtiqueta,
  construirEtiquetas,
  construirFilasCortinas,
  totalItem,
  type InventarioEstado,
} from './inventario';
import { codigoTuberiaDeChip } from '@/modules/descuentos/reglas-tuberia';

const ventanaEduardo = (ubic: string, ancho: number): VentanaItem => ({
  id: ubic,
  ubicacion: ubic,
  producto: 'ROLLER SCREEN',
  tipo: 'ROL',
  color: 'GRIS',
  alto: 1.85,
  panos: [
    {
      ancho,
      alto: 1.85,
      mecanismo: '[MEC 13] LZ50 SINFLEX',
      colorMecanismo: 'GRS',
      tuberia: '0,38mm',
      largoCadena: '3MTS',
      colorCadena: 'GRIS',
      colorPeso: 'TRANSPARENTE',
    },
  ],
});

describe('construirFilasCortinas', () => {
  it('arma una fila por paño con mecanismo, tubería, accionamiento y medidas (caso OT 3029)', () => {
    const filas = construirFilasCortinas([
      ventanaEduardo('TERRAZA IZQ', 1.501),
      ventanaEduardo('TERRAZA DER', 1.475),
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({
      id: 1,
      producto: 'ROLLER SCREEN GRIS',
      tipo: 'ROL',
      mecanismo: 'KIT SIMPLE GRIS 38MM [MEC 34] GRS',
      tuberia: '0,38mm',
      accionamiento: '3MTS GRIS',
      pesoCadena: 'TRANSPARENTE',
      ubicacion: 'TERRAZA IZQ',
      anchoM: 1.501,
      altoM: 1.85,
    });
    expect(filas[1].ubicacion).toBe('TERRAZA DER');
  });

  it('codPeso de Fase 2 aparece en peso cadena', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING',
        producto: 'ROLLER',
        tipo: 'PREMIUM',
        color: 'Blanco',
        categoria: 'ROL',
        panos: [{ ancho: 1.5, alto: 1.8, codPeso: 'PCA01', colorPeso: 'BCO' }],
      },
    ]);
    expect(f.pesoCadena).toBe('PESO HUEVO PORTA CADENA BLANCO');
  });

  it('motor reemplaza a la cadena en accionamiento', () => {
    const v = ventanaEduardo('LIVING', 2.0);
    v.panos![0].motorTipo = 'GRD';
    v.panos![0].ladoMotor = 'IZQ';
    const [f] = construirFilasCortinas([v]);
    expect(f.accionamiento).toBe('MOTOR GRD (IZQ)');
  });

  it('ignora ventanas sin paños', () => {
    expect(construirFilasCortinas([{ id: 'x' }])).toHaveLength(0);
  });

  it('fallback: BCO con MEC 05 legacy guardado → MEC 33', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING',
        producto: 'ROLLER',
        tipo: 'ROL',
        color: 'Blanco',
        categoria: 'ROL',
        panos: [{ ancho: 2, alto: 1.8, colorMecanismo: 'BCO', mecanismo: 'LZ 38 MERG BCO [MEC 05]' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 33]');
  });

  it('SOFT_LIGHT_38mm + BCO → MEC 39 en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING',
        producto: 'SOFT LIGHT',
        tipo: 'SOFT',
        color: 'Blanco',
        categoria: 'SOFT_LIGHT_38mm',
        panos: [{ ancho: 2, alto: 1.8, colorPeso: 'BCO', mecanismo: '' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 39]');
  });

  it('DUO_MANUAL_38mm + NEG → MEC 38 (cenefa ovalada negro) en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING IZQ-G1',
        producto: 'ROLLER DUO POLIESTER PREMIUM NEGRO',
        tipo: 'PREMIUM',
        color: 'Negro',
        categoria: 'DUO_MANUAL_38mm',
        // Caso real OT 267-9: kit simple negro guardado por el mapeo por color.
        panos: [{ ancho: 1.346, alto: 2.32, colorPeso: 'NEG', mecanismo: 'KIT SIMPLE NEGRO 38MM [MEC 32]' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 38]');
  });

  it('DUO_MANUAL_38mm + BCO → MEC 39 (cenefa ovalada blanco) en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING IZQ-G1',
        producto: 'ROLLER DUO BLACKOUT PREMIUM BLANCO',
        tipo: 'PREMIUM',
        color: 'Blanco',
        categoria: 'DUO_MANUAL_38mm',
        // Caso real OT 267-5: el kit simple quedó guardado por el mapeo por
        // color; la regla de categoría debe pisarlo con el kit ovalada.
        panos: [{ ancho: 1.66, alto: 2.3, colorPeso: 'BCO', mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 39]');
  });

  it('ROL_MANUAL_CENEFA_OVALADA_38mm + BCO → MEC 39 (kit ovalada) en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'DORM PPA',
        producto: 'ROLLER BLACKOUT DELUX',
        tipo: 'DELUX',
        color: 'Blanco',
        categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
        // Caso real: roller con cenefa ovalada quedaba con el kit simple
        // blanco guardado por el mapeo por color.
        panos: [{ ancho: 2.65, alto: 2.4, colorPeso: 'BCO', mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 39]');
  });

  it('OSCURANTI → MEC 28 en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'DORM',
        producto: 'OSCURANTE',
        tipo: 'OSC',
        color: 'Blanco',
        categoria: 'OSCURANTI_63mm',
        modelo: {
          sistema: 'OSCURANTI',
          tipo_rol: 'OSC',
          mecanismo: 'MEC_28',
          codigos_tubo: 'E47',
          diametro_tubo_mm: 63,
          dcto_tubo_cm: 0,
          dcto_tela_cm: 0,
          suma_peso_cm: 0,
          dcto_cenefa_cm: 0,
          dcto_cenefa_del_cm: 0,
          dcto_cenefa_tra_cm: 0,
          dcto_perfiles_cm: 0,
          peso_interno_duo_cm: 0,
          peso_u_duo_cm: 0,
          ancho_max_m: 3.5,
          activo: true,
          notas: '',
        },
        panos: [{ ancho: 3.507, alto: 2, mecanismo: 'KIT SIMPLE BLANCO 38MM [MEC 33]' }],
      },
    ]);
    expect(f.mecanismo).toContain('[MEC 28]');
    expect(codigoTuberiaDeChip(f.tuberia)).toBe('E47');
  });

  it('SOFT_LIGHT ancho 2,99 m sin tubo guardado → E66 en Fase 4', () => {
    const [f] = construirFilasCortinas([
      {
        id: '1',
        ubicacion: 'LIVING',
        producto: 'SOFT LIGHT',
        tipo: 'SOFT',
        color: 'Blanco',
        categoria: 'SOFT_LIGHT_38mm',
        modelo: {
          sistema: 'SOFT_LIGHT',
          tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
          mecanismo: '',
          codigos_tubo: 'E02; E66',
          diametro_tubo_mm: 38,
          dcto_tubo_cm: 1.2,
          dcto_tela_cm: 0.2,
          suma_peso_cm: 0.1,
          dcto_cenefa_cm: 0,
          dcto_cenefa_del_cm: 0,
          dcto_cenefa_tra_cm: 0,
          dcto_perfiles_cm: 0,
          peso_interno_duo_cm: 0,
          peso_u_duo_cm: 0,
          ancho_max_m: 3,
          activo: true,
          notas: '',
        },
        panos: [{ ancho: 2.989, alto: 2, colorPeso: 'BCO', mecanismo: '', tuberia: '' }],
      },
    ]);
    expect(codigoTuberiaDeChip(f.tuberia)).toBe('E66');
  });
});

describe('etiquetas por color de accesorios', () => {
  const v = (color: string, colorMecanismo?: string): VentanaItem => ({
    id: color,
    color,
    panos: [{ ancho: 1.5, alto: 1.8, ...(colorMecanismo ? { colorMecanismo } : {}) }],
  });

  it('codigoEtiqueta: blancos Y GRISES → INS 95-1 (blanca); negros y resto → INS 95 (negra)', () => {
    expect(codigoEtiqueta('BLANCO')).toEqual({ cod: 'INS 95-1', color: 'BLANCA' });
    expect(codigoEtiqueta('BCO')).toEqual({ cod: 'INS 95-1', color: 'BLANCA' });
    // Cambio 2026-07-09: accesorios grises llevan etiqueta blanca (antes negra).
    expect(codigoEtiqueta('GRIS')).toEqual({ cod: 'INS 95-1', color: 'BLANCA' });
    expect(codigoEtiqueta('GRS')).toEqual({ cod: 'INS 95-1', color: 'BLANCA' });
    expect(codigoEtiqueta('NEGRO')).toEqual({ cod: 'INS 95', color: 'NEGRA' });
    expect(codigoEtiqueta('')).toEqual({ cod: 'INS 95', color: 'NEGRA' });
  });

  it('OT blanca → 1 línea INS 95-1 con 1 etiqueta por paño', () => {
    expect(construirEtiquetas([v('Blanco'), v('BLANCO')])).toEqual([
      { cod: 'INS 95-1', color: 'BLANCA', cantidad: 2 },
    ]);
  });

  it('OT mixta → una línea por código (negra primero; gris cuenta como blanca)', () => {
    expect(construirEtiquetas([v('Blanco'), v('NEGRO'), v('GRIS')])).toEqual([
      { cod: 'INS 95', color: 'NEGRA', cantidad: 1 },
      { cod: 'INS 95-1', color: 'BLANCA', cantidad: 2 },
    ]);
  });

  it('el color de accesorios del paño (colorMecanismo) pisa el de la ventana', () => {
    expect(construirEtiquetas([v('NEGRO', 'BCO')])).toEqual([
      { cod: 'INS 95-1', color: 'BLANCA', cantidad: 1 },
    ]);
  });
});

describe('totalItem', () => {
  const item: BomItem = {
    categoria: 'MECANISMO',
    descripcion: 'Mecanismo',
    especificacion: 'MEC 13',
    color: 'GRIS',
    cantidad: 2,
    unidad: 'unid.',
  };

  it('sin adicional, total = cantidad', () => {
    expect(totalItem(item, { entregas: {} })).toBe(2);
  });

  it('suma el adicional manual de la hoja', () => {
    const estado: InventarioEstado = {
      entregas: { [claveItem(item)]: { entregado: false, adicional: 1 } },
    };
    expect(totalItem(item, estado)).toBe(3);
  });
});
