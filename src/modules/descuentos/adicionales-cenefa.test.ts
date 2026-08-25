import { describe, expect, it } from 'vitest';
import {
  ajusteCenefaCuadradaCm,
  anchoCenefaCuadradaDeclaradoCm,
  anchoNominalCenefaCorte,
  buscarAdicionalCenefaOvalada,
  candidatosCenefaEnUbic,
  cenefaAdicionalEsDelPano,
  cenefaIncluidaEnElPrecio,
  cenefaOvaladaDesdeAdicional,
  cortinaDeLaCenefa,
  derivarAdicionalesCenefaDesdeVentanas,
  esAdicionalCenefaOvalada,
  esRollerOVertical,
  etiquetaTipInstCenefa,
  existeCenefaManualEnUbic,
  tiraCenefaOvalada,
  filtrarDerivadosPorCupoManual,
  indexCenefasOvaladasAdicionales,
  llevaCenefaPorCategoria,
  medidaCorteCenefaCuadrada,
  medidaCorteCenefaOvalada,
  ubicacionCoincideConAdicional,
} from './adicionales-cenefa';
import type { ModeloDespiece } from './tipos';
import type { VentanaItem } from '@/modules/ots/types';

const modeloRoller: ModeloDespiece = {
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_05',
  codigos_tubo: 'E01; E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 3.8,
  dcto_tela_cm: 0.5,
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
};

const modeloCenefa: ModeloDespiece = {
  ...modeloRoller,
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
  dcto_tubo_cm: 1.8,
  dcto_cenefa_cm: 1.5,
};

const modeloSoftLight: ModeloDespiece = {
  ...modeloRoller,
  sistema: 'SOFT_LIGHT',
  tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
  dcto_tubo_cm: 1.2,
};

const adicPza3G2 = { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'PZA 3-G2' };

describe('adicionales-cenefa', () => {
  it('detecta CENFO y CENF O', () => {
    expect(esAdicionalCenefaOvalada('CENFO')).toBe(true);
    expect(esAdicionalCenefaOvalada('CENF O')).toBe(true);
    expect(esAdicionalCenefaOvalada('DOM 38')).toBe(false);
  });

  it('solo coincide ubicación exacta (no IZQ/DER)', () => {
    expect(ubicacionCoincideConAdicional('PZA 3-G2', 'PZA 3-G2')).toBe(true);
    expect(ubicacionCoincideConAdicional('PZA 3 IZQ-G2', 'PZA 3-G2')).toBe(false);
  });

  it('busca adicional solo en la misma ubicación', () => {
    expect(buscarAdicionalCenefaOvalada('PZA 3-G2', [adicPza3G2])?.cantidad).toBe(2.96);
    expect(buscarAdicionalCenefaOvalada('PZA 3 IZQ-G2', [adicPza3G2])).toBeNull();
  });

  it('prioriza ancho del paño; Soft Light interno → cenefa 295.7 (296.9 − 1.2)', () => {
    expect(anchoNominalCenefaCorte(adicPza3G2, 296.9)).toBe(296.9);
    expect(
      cenefaOvaladaDesdeAdicional(adicPza3G2, modeloSoftLight, {
        anchoPanoCm: 296.9,
        categoria: 'SOFT_LIGHT_38mm',
        sentido: 'INTERNO',
      }),
    ).toBe(295.7);
  });

  it('roller cenefa ovalada: tapa = ancho − dcto_cenefa (1.5)', () => {
    expect(cenefaOvaladaDesdeAdicional(adicPza3G2, modeloRoller, { anchoPanoCm: 296.9 })).toBe(295.4);
    expect(cenefaOvaladaDesdeAdicional(adicPza3G2, modeloRoller, { anchoPanoCm: 0 })).toBe(294.5);
  });

  it('indexa adicionales por ubicación normalizada', () => {
    const map = indexCenefasOvaladasAdicionales([
      { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'pza 3-g2' },
      { codInt: 'CENFO', cantidad: 2.99, descuento: 0, ubicacion: 'PZA 2-G3' },
    ]);
    expect(map.get('PZA 3-G2')?.cantidad).toBe(2.96);
  });

  it('modelo cenefa integrado usa su propio dcto_cenefa', () => {
    expect(medidaCorteCenefaOvalada(250, modeloCenefa)).toBe(248.5); // 250 − 1.5
  });
});

// Antes solo se reconocía el soft light 38: un 45 mm caía al despeje del roller
// (−1,5), que en INTERNO acertaba por casualidad y en SEMI/EXTERNO no tenía nada
// que ver con su pizarra (OT 3169).
describe('cenefa del adicional en soft light 45 mm', () => {
  const modeloSl45: ModeloDespiece = {
    ...modeloSoftLight,
    tipo_rol: 'SOFT_LIGHT_INTERNO_45mm',
    diametro_tubo_mm: 45,
  };
  const adic281 = { codInt: 'CENF O', cantidad: 2.81, descuento: 0, ubicacion: 'PPAL' };
  const medida = (categoria: string, sentido: string, modelo = modeloSl45) =>
    cenefaOvaladaDesdeAdicional(adic281, modelo, { anchoPanoCm: 281, categoria, sentido });

  it('INTERNO: 281 → 279,5 (el 38 daría 279,8)', () => {
    expect(medida('SOFT_LIGHT_45mm', 'INTERNO')).toBe(279.5);
    expect(medida('SOFT_LIGHT_38mm', 'INTERNO', modeloSoftLight)).toBe(279.8);
  });

  it('SEMI y EXTERNO usan la tabla de oscuridad, no el despeje del roller', () => {
    expect(medida('SOFT_LIGHT_45mm', 'SEMI')).toBe(287.6); // 281 + 6,6
    expect(medida('SOFT_LIGHT_45mm', 'EXTERNO')).toBe(294.2); // 281 + 13,2
  });

  it('un soft light 38 sobre tubo de 45 (banda E78) corta como 45', () => {
    expect(medida('SOFT_LIGHT_38mm', 'INTERNO')).toBe(279.5);
  });
});

// Desde que la oscuridad cae INTERNO fija (PR #207), la variante vive en
// `oscuridadVariante` y `sentido` ya no la trae. La cenefa del adicional seguía
// leyendo solo el sentido: salía INTERNO (218,1) mientras el tubo (230,7) y el
// peso del mismo paño salían EXTERNO — "el tubo no puede ser más grande que la
// cenefa" (OT 3196, dueño 2026-08-20).
describe('la variante de la cenefa del adicional sigue al despiece (OT 3196)', () => {
  const adic = { codInt: 'CENF O', cantidad: 2.193, descuento: 0, ubicacion: 'PPAL' };
  const medida = (ctx: { oscuridadVariante?: string | null; sentido?: string | null }) =>
    cenefaOvaladaDesdeAdicional(adic, modeloSoftLight, {
      anchoPanoCm: 219.3,
      categoria: 'SOFT_LIGHT_38mm',
      ...ctx,
    });

  it('la fila real: caída INTERNO fija + variante EXTERNO → cenefa EXTERNO (232,5)', () => {
    expect(medida({ sentido: 'INTERNO', oscuridadVariante: 'EXTERNO' })).toBe(232.5); // 219,3 + 13,2
    expect(medida({ sentido: 'INTERNO', oscuridadVariante: 'SEMI' })).toBe(225.9); // 219,3 + 6,6
    expect(medida({ sentido: 'INTERNO', oscuridadVariante: 'INTERNO' })).toBe(218.1); // 219,3 − 1,2
  });

  it('las filas viejas (variante en el sentido) siguen saliendo bien', () => {
    expect(medida({ sentido: 'EXTERNO' })).toBe(232.5);
    expect(medida({ sentido: 'SEMI', oscuridadVariante: '' })).toBe(225.9);
  });

  it('sin variante ni sentido cae al tipo_rol del modelo (INTERNO)', () => {
    expect(medida({})).toBe(218.1);
  });
});

describe('cenefa cuadrada (verticales/roller)', () => {
  it('ajuste por TIP. INST: +1 / +2 / −0,5 (muro a muro es la base)', () => {
    expect(ajusteCenefaCuadradaCm('CON_1_TAPA')).toBe(1);
    expect(ajusteCenefaCuadradaCm('CON_2_TAPAS')).toBe(2);
    expect(ajusteCenefaCuadradaCm('MURO_MURO')).toBe(-0.5);
    // legacy/vacío → muro a muro
    expect(ajusteCenefaCuadradaCm('SIN_TAPA')).toBe(-0.5);
    expect(ajusteCenefaCuadradaCm(undefined)).toBe(-0.5);
  });

  it('ancho corte est. = ancho inicial + ajuste (ej. 269,40 muro a muro → 268,90)', () => {
    expect(medidaCorteCenefaCuadrada(269.4, 'MURO_MURO')).toBe(268.9);
    expect(medidaCorteCenefaCuadrada(269.4, 'CON_1_TAPA')).toBe(270.4);
    expect(medidaCorteCenefaCuadrada(269.4, 'CON_2_TAPAS')).toBe(271.4);
    expect(medidaCorteCenefaCuadrada(269.4, undefined)).toBe(268.9);
    expect(medidaCorteCenefaCuadrada(0, 'MURO_MURO')).toBe(0);
  });

  describe('anchoCenefaCuadradaDeclaradoCm — el ancho de la etiqueta es el VENDIDO en Fase 1', () => {
    // OT 3181: vertical de 2,737 en LIVING con cenefa cuadrada vendida a 2,747.
    // La etiqueta imprimía 273,2 (ancho de la cortina −0,5); debe decir 274,7.
    const vendida = [{ codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'LIVING' }];

    it('toma la cantidad del adicional (×100), no el ancho de la cortina', () => {
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING', 2.737, vendida)).toBe(274.7);
    });

    it('la fila con sufijo de paño calza con la UBIC. general del adicional', () => {
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING P2', 2.737, vendida)).toBe(274.7);
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING-G2', 2.737, vendida)).toBe(274.7);
    });

    it('la UBIC. exacta le gana a la general, y entre iguales gana la de ancho más parecido', () => {
      const dos = [
        { codInt: 'CENF C', cantidad: 1.5, descuento: 0, ubicacion: 'LIVING' },
        { codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'LIVING-G2' },
      ];
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING-G2', 1.5, dos)).toBe(274.7);
      const mismaUbic = [
        { codInt: 'CENF C', cantidad: 1.5, descuento: 0, ubicacion: 'LIVING' },
        { codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'LIVING' },
      ];
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING', 2.737, mismaUbic)).toBe(274.7);
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING', 1.48, mismaUbic)).toBe(150);
    });

    it('ignora la ovalada, otra UBIC. y cantidades en cero; sin calce devuelve null', () => {
      const otros = [
        { codInt: 'CENF O', cantidad: 2.747, descuento: 0, ubicacion: 'LIVING' },
        { codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'COMEDOR' },
        { codInt: 'CENF C', cantidad: 0, descuento: 0, ubicacion: 'LIVING' },
      ];
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING', 2.737, otros)).toBeNull();
      expect(anchoCenefaCuadradaDeclaradoCm('LIVING', 2.737, undefined)).toBeNull();
      expect(anchoCenefaCuadradaDeclaradoCm('', 2.737, vendida)).toBeNull();
    });
  });

  it('esRollerOVertical: ROL* y VERTICAL', () => {
    expect(esRollerOVertical('ROL')).toBe(true);
    expect(esRollerOVertical('ROL_DUAL')).toBe(true);
    expect(esRollerOVertical('VERTICAL')).toBe(true);
    expect(esRollerOVertical('SOFT_LIGHT_38mm')).toBe(false);
    expect(esRollerOVertical('')).toBe(false);
  });

  it('etiqueta TIP. INST: legacy/vacío → "MURO_MURO"', () => {
    expect(etiquetaTipInstCenefa('MURO_MURO')).toBe('MURO_MURO');
    expect(etiquetaTipInstCenefa('CON_1_TAPA')).toBe('CON_1_TAPA');
    expect(etiquetaTipInstCenefa('SIN_TAPA')).toBe('MURO_MURO');
    expect(etiquetaTipInstCenefa(undefined)).toBe('MURO_MURO');
  });
});

describe('derivarAdicionalesCenefaDesdeVentanas (paño → adicional)', () => {
  it('1 paño Ovalada CON TIRA → un CENF O con cantidad = ANCHO del paño (#22), no v.cantidad', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'LIVING',
      cantidad: 2, // unidades de la ventana: NO debe usarse como cantidad de la cenefa
      color: 'NEGRO',
      panos: [{ ancho: 2.5, alto: 2, cenefa: 'Ovalada', cenefaTira: 'CON TIRA', colorTapa: 'GRS' }],
    };
    expect(derivarAdicionalesCenefaDesdeVentanas([v])).toEqual([
      { codInt: 'CENF O', cantidad: 2.5, descuento: 0, ubicacion: 'LIVING', colorAcc: 'GRS', conTira: true, origen: 'pano' },
    ]);
  });

  it('el DÚO no genera CENF O: su cenefa ya va en el precio de la familia', () => {
    // Las recetas dúo incluyen el perfil E 26 y el mecanismo MEC 09, así que
    // derivar el adicional cobraría la cenefa dos veces (2026-08-20).
    const duo: VentanaItem = {
      id: 'v1',
      ubicacion: 'VISITA',
      categoria: 'DUO_MANUAL_38mm',
      cantidad: 1,
      color: 'NEGRO',
      panos: [{ ancho: 1.66, alto: 2, cenefa: 'Ovalada', colorTapa: 'NEG' }],
    } as unknown as VentanaItem;
    expect(derivarAdicionalesCenefaDesdeVentanas([duo])).toEqual([]);
    expect(cenefaIncluidaEnElPrecio('DUO_MANUAL_38mm')).toBe(true);
    // El roller de cenefa ovalada SÍ se cobra aparte: su receta no la trae.
    const roller: VentanaItem = {
      ...duo,
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
    } as unknown as VentanaItem;
    expect(cenefaIncluidaEnElPrecio('ROL_MANUAL_CENEFA_OVALADA_38mm')).toBe(false);
    expect(derivarAdicionalesCenefaDesdeVentanas([roller])).toHaveLength(1);
  });

  it('1 paño Ovalada SIN dato de tira → CENF O con conTira true (default 2026-07-20)', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'LIVING',
      cantidad: 1,
      color: 'NEGRO',
      panos: [{ ancho: 2.5, alto: 2, cenefa: 'Ovalada', colorTapa: 'GRS' }],
    };
    const [adic] = derivarAdicionalesCenefaDesdeVentanas([v]);
    expect(adic.codInt).toBe('CENF O');
    expect(adic.conTira).toBe(true);
  });

  it('1 paño Ovalada con "SIN TIRA" explícito → CENF O con conTira false', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'LIVING',
      cantidad: 1,
      panos: [{ ancho: 2.5, alto: 2, cenefa: 'Ovalada', cenefaTira: 'SIN TIRA', colorTapa: 'GRS' }],
    };
    expect(derivarAdicionalesCenefaDesdeVentanas([v])[0].conTira).toBe(false);
  });

  it('multi-paño: Cuadrada en paños 1 y 3 → dos CENF C en V1-G1 / V1-G3 (conTira undefined)', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'PZA 3',
      cantidad: 1,
      panos: [
        { ancho: 1, alto: 2, cenefa: 'Cuadrada', color: 'BCO' },
        { ancho: 1, alto: 2, cenefa: 'No' },
        { ancho: 1, alto: 2, cenefa: 'Cuadrada', color: 'BCO' },
      ],
    };
    const out = derivarAdicionalesCenefaDesdeVentanas([v]);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.ubicacion)).toEqual(['PZA 3-G1', 'PZA 3-G3']);
    expect(out.every((a) => a.codInt === 'CENF C' && a.conTira === undefined)).toBe(true);
  });

  it('sin cenefa (No / vacío) no genera nada', () => {
    const v: VentanaItem = { id: 'v1', ubicacion: 'X', panos: [{ ancho: 1, alto: 1, cenefa: 'No' }, { ancho: 1, alto: 1 }] };
    expect(derivarAdicionalesCenefaDesdeVentanas([v])).toEqual([]);
  });

  it('las variantes "Cuadrada a muro" / "a techo" también generan CENF C', () => {
    const v: VentanaItem = {
      id: 'v1',
      ubicacion: 'COMEDOR',
      cantidad: 1,
      panos: [
        { ancho: 1, alto: 2, cenefa: 'Cuadrada a muro', color: 'BCO' },
        { ancho: 1, alto: 2, cenefa: 'Cuadrada a techo', color: 'BCO' },
      ],
    };
    const out = derivarAdicionalesCenefaDesdeVentanas([v]);
    expect(out).toHaveLength(2);
    expect(out.every((a) => a.codInt === 'CENF C')).toBe(true);
  });
});

describe('existeCenefaManualEnUbic (dedup contra manuales)', () => {
  const manuales = [{ codInt: 'CENF O', cantidad: 1, descuento: 0, ubicacion: 'LIVING' }];
  it('mismo tipo + misma ubicación → true; distinto tipo/ubic → false', () => {
    expect(existeCenefaManualEnUbic(manuales, 'Ovalada', 'living')).toBe(true);
    expect(existeCenefaManualEnUbic(manuales, 'Cuadrada', 'LIVING')).toBe(false);
    expect(existeCenefaManualEnUbic(manuales, 'Ovalada', 'COCINA')).toBe(false);
    expect(existeCenefaManualEnUbic([], 'Ovalada', 'LIVING')).toBe(false);
  });
});

// ── A qué CORTINA le toca la cenefa (OT 3169) ────────────────────────────
// Tres cortinas escritas "PPAL" (un soft light de 2,81 y dos roller) y una sola
// cenefa comprada: la app se la marcaba a las tres y cobraba una.
describe('llevaCenefaPorCategoria', () => {
  it('ovalada: el soft light y los sistemas de cenefa ovalada la llevan; el roller simple no', () => {
    expect(llevaCenefaPorCategoria('Ovalada', { categoria: 'SOFT_LIGHT_45mm' })).toBe(true);
    expect(llevaCenefaPorCategoria('Ovalada', { categoria: 'SOFT_LIGHT_38mm' })).toBe(true);
    expect(llevaCenefaPorCategoria('Ovalada', { categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm' })).toBe(true);
    expect(llevaCenefaPorCategoria('Ovalada', { categoria: 'ROL' })).toBe(false);
  });

  it('el dúo la lleva por su SISTEMA, aunque su categoría no lo diga', () => {
    // DUO_MANUAL_38mm se fabrica con el sistema CENEFA_OVALADA_DUO.
    expect(llevaCenefaPorCategoria('Ovalada', { categoria: 'DUO_MANUAL_38mm' })).toBe(false);
    expect(
      llevaCenefaPorCategoria('Ovalada', {
        categoria: 'DUO_MANUAL_38mm',
        sistemaModelo: 'CENEFA_OVALADA_DUO',
      }),
    ).toBe(true);
  });

  it('un soft light con cuadrada elegida deja de ser candidato a la ovalada', () => {
    const sl = { categoria: 'SOFT_LIGHT_45mm', cenefaPano: 'Cuadrada a muro' };
    expect(llevaCenefaPorCategoria('Ovalada', sl)).toBe(false);
    expect(llevaCenefaPorCategoria('Cuadrada', sl)).toBe(true);
  });

  it('cuadrada: DARK y oscuranti la llevan puesta; el roller no', () => {
    expect(llevaCenefaPorCategoria('Cuadrada', { categoria: 'DARK_38mm' })).toBe(true);
    expect(llevaCenefaPorCategoria('Cuadrada', { categoria: 'OSCURANTI_63mm' })).toBe(true);
    expect(llevaCenefaPorCategoria('Cuadrada', { categoria: 'ROL' })).toBe(false);
  });
});

describe('cortinaDeLaCenefa', () => {
  // La cotización real: PPAL con un soft light de 2,81 y dos roller.
  const ppal = (): ReturnType<typeof candidatosCenefaEnUbic> => [
    { ventanaId: 'sl', panoIndex: 0, categoria: 'SOFT_LIGHT_45mm', anchoM: 2.81 },
    { ventanaId: 'r1', panoIndex: 0, categoria: 'ROL', anchoM: 1.357 },
    { ventanaId: 'r2', panoIndex: 0, categoria: 'ROL', anchoM: 1.455 },
  ];

  it('gana la que lleva cenefa por categoría (el soft light)', () => {
    expect(cortinaDeLaCenefa(ppal(), { cantidad: 2.81 }, 'Ovalada')?.ventanaId).toBe('sl');
    // Y sigue ganando aunque la cantidad del adicional apunte a otro ancho: la
    // categoría manda sobre el desempate.
    expect(cortinaDeLaCenefa(ppal(), { cantidad: 1.36 }, 'Ovalada')?.ventanaId).toBe('sl');
  });

  it('sin ninguna candidata por categoría desempata el ancho más parecido', () => {
    const soloRoller = ppal().slice(1);
    expect(cortinaDeLaCenefa(soloRoller, { cantidad: 1.45 }, 'Ovalada')?.ventanaId).toBe('r2');
    expect(cortinaDeLaCenefa(soloRoller, { cantidad: 1.3 }, 'Ovalada')?.ventanaId).toBe('r1');
    // Sin cantidad utilizable no se inventa nada: la primera.
    expect(cortinaDeLaCenefa(soloRoller, { cantidad: 0 }, 'Ovalada')?.ventanaId).toBe('r1');
  });

  it('una sola cortina en la ubicación → esa; ninguna → null', () => {
    expect(cortinaDeLaCenefa(ppal().slice(0, 1), { cantidad: 9 }, 'Ovalada')?.ventanaId).toBe('sl');
    expect(cortinaDeLaCenefa([], { cantidad: 1 }, 'Ovalada')).toBeNull();
  });
});

describe('candidatosCenefaEnUbic / cenefaAdicionalEsDelPano', () => {
  const ventanas: VentanaItem[] = [
    { id: 'sl', ubicacion: 'PPAL', categoria: 'SOFT_LIGHT_45mm', panos: [{ ancho: 2.81, alto: 2.4 }] },
    { id: 'r1', ubicacion: 'PPAL', categoria: 'ROL', panos: [{ ancho: 1.357, alto: 2.4 }] },
    { id: 'r2', ubicacion: 'PPAL', categoria: 'ROL', panos: [{ ancho: 1.455, alto: 2.4 }] },
    { id: 'otra', ubicacion: 'VISITA', categoria: 'ROL', panos: [{ ancho: 1.66, alto: 1.93 }] },
  ];
  const adic = { codInt: 'CENF O', cantidad: 2.81 };

  it('junta las tres cortinas de PPAL y deja fuera la de VISITA', () => {
    expect(candidatosCenefaEnUbic('PPAL', ventanas).map((c) => c.ventanaId)).toEqual([
      'sl', 'r1', 'r2',
    ]);
    expect(candidatosCenefaEnUbic('visita', ventanas)).toHaveLength(1);
    expect(candidatosCenefaEnUbic('', ventanas)).toEqual([]);
  });

  it('la cenefa es del soft light, no de los roller vecinos', () => {
    const cands = candidatosCenefaEnUbic('PPAL', ventanas);
    expect(cenefaAdicionalEsDelPano(adic, { ventanaId: 'sl', panoIndex: 0 }, cands)).toBe(true);
    expect(cenefaAdicionalEsDelPano(adic, { ventanaId: 'r1', panoIndex: 0 }, cands)).toBe(false);
    expect(cenefaAdicionalEsDelPano(adic, { ventanaId: 'r2', panoIndex: 0 }, cands)).toBe(false);
  });

  it('sin candidatos (quien llama no pasó las ventanas) no cambia nada', () => {
    expect(cenefaAdicionalEsDelPano(adic, { ventanaId: 'r1', panoIndex: 0 }, [])).toBe(true);
  });

  it('los paños de UNA ventana se separan con -G1/-G2 y no compiten con otra ventana', () => {
    const dosPanos: VentanaItem[] = [
      { id: 'v1', ubicacion: 'COMEDOR', categoria: 'ROL', panos: [{ ancho: 1, alto: 2 }, { ancho: 2, alto: 2 }] },
    ];
    expect(candidatosCenefaEnUbic('COMEDOR-G2', dosPanos)).toEqual([
      { ventanaId: 'v1', panoIndex: 1, categoria: 'ROL', anchoM: 2, cenefaPano: null, sistemaModelo: null },
    ]);
  });
});

describe('filtrarDerivadosPorCupoManual', () => {
  const derivado = (ubic: string, cantidad: number) => ({
    codInt: 'CENF O', cantidad, descuento: 0, ubicacion: ubic, origen: 'pano' as const,
  });

  it('una cenefa manual tapa UNA cortina, no todas las de la ubicación', () => {
    const manuales = [{ codInt: 'CENF O', cantidad: 2.81, descuento: 0, ubicacion: 'PPAL' }];
    const derivados = [derivado('PPAL', 2.81), derivado('PPAL', 1.357), derivado('PPAL', 1.455)];
    const out = filtrarDerivadosPorCupoManual(derivados, manuales);
    expect(out.map((a) => a.cantidad)).toEqual([1.357, 1.455]);
  });

  it('dos manuales tapan dos derivados; sin manuales no se descarta ninguno', () => {
    const manuales = [
      { codInt: 'CENF O', cantidad: 1, descuento: 0, ubicacion: 'PPAL' },
      { codInt: 'CENF O', cantidad: 1, descuento: 0, ubicacion: 'ppal' }, // se normaliza igual
    ];
    const derivados = [derivado('PPAL', 1), derivado('PPAL', 2), derivado('PPAL', 3)];
    expect(filtrarDerivadosPorCupoManual(derivados, manuales)).toHaveLength(1);
    expect(filtrarDerivadosPorCupoManual(derivados, [])).toHaveLength(3);
  });

  it('el cupo es por TIPO: una cuadrada manual no tapa una ovalada derivada', () => {
    const manuales = [{ codInt: 'CENF C', cantidad: 1, descuento: 0, ubicacion: 'PPAL' }];
    expect(filtrarDerivadosPorCupoManual([derivado('PPAL', 1)], manuales)).toHaveLength(1);
  });

  // Una cenefa que nació del paño y se editó a mano (soft light: se cobra por
  // el ancho de TELA, no por el del paño) sigue ocupando el cupo de SU paño.
  describe('una derivada editada a mano no se duplica al reabrir la OT', () => {
    it('con el ancho cambiado tapa igual a su gemela', () => {
      const manuales = [
        {
          codInt: 'CENF O', cantidad: 3.1, descuento: 0,
          ubicacion: 'PPAL', origen: 'manual' as const, ubicacionDerivada: 'PPAL',
        },
      ];
      expect(filtrarDerivadosPorCupoManual([derivado('PPAL', 2.81)], manuales)).toHaveLength(0);
    });

    it('con la ubicación renombrada también, gracias a ubicacionDerivada', () => {
      const manuales = [
        {
          codInt: 'CENF O', cantidad: 3.1, descuento: 0,
          ubicacion: 'DORM 1', origen: 'manual' as const, ubicacionDerivada: 'PPAL',
        },
      ];
      expect(filtrarDerivadosPorCupoManual([derivado('PPAL', 2.81)], manuales)).toHaveLength(0);
    });

    it('sin ubicacionDerivada manda la ubicación (una manual de siempre)', () => {
      const manuales = [{ codInt: 'CENF O', cantidad: 3.1, descuento: 0, ubicacion: 'DORM 1' }];
      expect(filtrarDerivadosPorCupoManual([derivado('PPAL', 2.81)], manuales)).toHaveLength(1);
    });
  });
});

describe('tiraCenefaOvalada — categoría B siempre SIN TIRA (2026-08-14)', () => {
  it('la B fuerza SIN TIRA aunque el paño tenga CON TIRA guardado', () => {
    expect(tiraCenefaOvalada('CON TIRA', undefined, true)).toBe('SIN TIRA');
    expect(tiraCenefaOvalada(undefined, true, true)).toBe('SIN TIRA');
    expect(tiraCenefaOvalada('', null, true)).toBe('SIN TIRA');
  });

  it('sin lineaB todo sigue igual (regresión: default CON TIRA)', () => {
    expect(tiraCenefaOvalada(undefined, undefined, false)).toBe('CON TIRA');
    expect(tiraCenefaOvalada('SIN TIRA', undefined, false)).toBe('SIN TIRA');
    expect(tiraCenefaOvalada(undefined, undefined)).toBe('CON TIRA');
  });
});
