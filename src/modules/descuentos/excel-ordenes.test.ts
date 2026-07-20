import { describe, it, expect } from 'vitest';
import { COLUMNAS, generarOrdenesOptimizador } from './excel-ordenes';
import type { ModeloDespiece } from './tipos';
import type { Ventana, Pano } from '@/modules/cotizador/types';

// Índice de columna por NOMBRE (robusto a que se agreguen/reordenen columnas).
const col = (n: string) => (COLUMNAS as readonly string[]).indexOf(n);
const idxTUBO = col('TUBO');
const idxPESO = col('PESO');
const idxCENEFA = col('CENEFA OVALADA');
const idxCON_TIRA = col('CON TIRA');
const idxPESO_SOFT_LIGHT = col('PESO SOFT LIGHT');
const idxTUBERIA = col('TUBERIA');

const modelo: ModeloDespiece = {
  sistema: 'ROLLER_SIMPLE',
  tipo_rol: 'ROL_SIMPLE',
  mecanismo: 'MEC_13',
  codigos_tubo: 'E01; E02; E66', // catálogo 38mm con E02 y E66
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

function ventana(tuberiaPano: string): Ventana {
  return {
    id: 'v1',
    ubicacion: 'TERRAZA',
    codInt: 'TR 02',
    producto: 'Roller',
    tipo: '',
    color: 'GRIS',
    alto: 2,
    precio: 0,
    cantidad: 1,
    categoria: 'ROL',
    grupoId: null,
    grupoOrden: 0,
    modelo,
    panos: [{ ancho: 1.5, alto: 2, color: 'GRIS', tuberia: tuberiaPano } as Pano],
  } as Ventana;
}

const softLight38: ModeloDespiece = {
  sistema: 'SOFT_LIGHT',
  tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
  mecanismo: '',
  codigos_tubo: 'E01; E02; E03; E53; E66',
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
};

function ventanaSoftLight(anchoM: number, ubicacion = 'PZA 3', sentido = 'INTERNO'): Ventana {
  return {
    id: 'v-soft',
    ubicacion,
    codInt: 'BK 18',
    producto: 'Roller Blackout',
    tipo: '',
    color: 'BLANCO',
    alto: 2,
    precio: 0,
    cantidad: 1,
    categoria: 'SOFT_LIGHT_38mm',
    sentido,
    grupoId: null,
    grupoOrden: 0,
    modelo: softLight38,
    panos: [{ ancho: anchoM, alto: 2, color: 'BLANCO', tuberia: '0,38mm [E66] 2mm' } as Pano],
  } as Ventana;
}

describe('generarOrdenesOptimizador — cenefa ovalada desde adicionales Fase 0', () => {
  const adicionalesOT266 = [
    { codInt: 'CENFO', cantidad: 2.96, descuento: 0, ubicacion: 'PZA 3-G2', colorAcc: 'BLANCO' },
    { codInt: 'CENFO', cantidad: 2.99, descuento: 0, ubicacion: 'PZA 2-G3', colorAcc: 'BLANCO' },
  ];

  it('OT 266-2 PZA 3-G2 dorado (SISTEMAS OSCURIDAD): tubo 293.9, peso SL 289.9, cenefa 295.7', () => {
    const v = ventanaSoftLight(2.969, 'PZA 3-G2');
    v.panos[0].cenefaTira = 'CON TIRA';
    const { aoa } = generarOrdenesOptimizador('266-2', [v], { adicionalesFase0: adicionalesOT266 });
    expect(aoa[1][idxTUBO]).toBe(293.9);
    expect(aoa[1][idxPESO_SOFT_LIGHT]).toBe(289.9);
    expect(aoa[1][idxCENEFA]).toBe(295.7);
    expect(aoa[1][idxCON_TIRA]).toBe('CON TIRA');
  });

  it('cenefa ovalada sin tira → columna CON TIRA vacía o SIN TIRA', () => {
    const v = ventanaSoftLight(2.969, 'PZA 3-G2');
    v.panos[0].cenefaTira = 'SIN TIRA';
    const { aoa } = generarOrdenesOptimizador('266-2', [v], { adicionalesFase0: adicionalesOT266 });
    expect(aoa[1][idxCON_TIRA]).toBe('SIN TIRA');
  });

  it('PZA 2-G3 soft light ancho 2.99 m → cenefa 297.8 (299 − 1.2)', () => {
    const v = ventanaSoftLight(2.99, 'PZA 2-G3');
    const { aoa } = generarOrdenesOptimizador('266-2', [v], { adicionalesFase0: adicionalesOT266 });
    expect(aoa[1][idxCENEFA]).toBe(297.8);
  });

  it('PZA 3 IZQ-G2 no recibe cenefa del adicional PZA 3-G2', () => {
    const v = ventana('');
    v.ubicacion = 'PZA 3 IZQ-G2';
    v.panos = [{ ancho: 1.455, alto: 2, color: 'BLANCO', tuberia: '0,38mm [E02] 1,2mm' } as Pano];
    const { aoa } = generarOrdenesOptimizador('266-2', [v], { adicionalesFase0: adicionalesOT266 });
    expect(aoa[1][idxCENEFA]).toBe('');
  });

  it('sin adicional en esa ubicación no agrega cenefa en roller simple', () => {
    const v = ventana('');
    v.ubicacion = 'SALA';
    const { aoa } = generarOrdenesOptimizador('266-2', [v]);
    expect(aoa[1][idxCENEFA]).toBe('');
  });
});

describe('generarOrdenesOptimizador — SOFT LIGHT interno 38 mm', () => {
  it('ancho 2.987 m → tubo 295.7, peso 291.7, tubería 38mm_E66', () => {
    const { aoa } = generarOrdenesOptimizador('266-2', [ventanaSoftLight(2.987)]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E66');
    expect(aoa[1][idxTUBO]).toBe(295.7);
    expect(aoa[1][idxPESO]).toBe('');
    expect(aoa[1][idxPESO_SOFT_LIGHT]).toBe(291.7);
  });

  it('ancho 2.959 m → tubo 292.9, peso 288.9', () => {
    const { aoa } = generarOrdenesOptimizador('266-2', [ventanaSoftLight(2.959, 'PZA 3-G2')]);
    expect(aoa[1][idxTUBO]).toBe(292.9);
    expect(aoa[1][idxPESO]).toBe('');
    expect(aoa[1][idxPESO_SOFT_LIGHT]).toBe(288.9);
  });

  it('modelo SEMI guardado + sentido INTERNO → fórmulas interno', () => {
    const v = ventanaSoftLight(2.849, 'PZA 3-G2', 'INTERNO');
    v.modelo = { ...softLight38, tipo_rol: 'SOFT_LIGHT_SEMI_38mm' };
    const { aoa } = generarOrdenesOptimizador('266-2', [v]);
    expect(aoa[1][idxTUBO]).toBe(281.9);
    expect(aoa[1][idxPESO]).toBe('');
    expect(aoa[1][idxPESO_SOFT_LIGHT]).toBe(277.9);
  });

  it('perfil izquierdo ON → COLOR PERFIL desde adicional SOFTLIZQ Fase 0', () => {
    const v = ventanaSoftLight(2.969, 'PZA 3-G2');
    v.panos[0].perfilIzqMuro = true;
    const adicionales = [
      { codInt: 'SOFTLIZQ', cantidad: 1, descuento: 0, ubicacion: 'PERFIL IZQ', colorAcc: 'BLANCO' },
      { codInt: 'SOFTLDER', cantidad: 1, descuento: 0, ubicacion: 'PERFIL DEF', colorAcc: 'BLANCO' },
    ];
    const { aoa } = generarOrdenesOptimizador('266-2', [v], { adicionalesFase0: adicionales });
    const idxPerfilIzq = col('PERFIL (IZQ) INT');
    const idxColorPerfil = col('COLOR PERFIL');
    expect(aoa[1][idxPerfilIzq]).toBe(210); // alto 200 cm + 10
    expect(aoa[1][idxColorPerfil]).toBe('BLANCO');
  });

  it('cenefa delantera → PERFIL SUPERIOR (CENEF.PRO) con la misma medida', () => {
    const v = ventanaSoftLight(2.969, 'PZA 3-G2');
    v.categoria = 'OSCURANTI_63mm';
    v.modelo = { ...softLight38, sistema: 'OSCURANTI' };
    v.panos[0].cenefa = 'Cuadrada';
    const { aoa } = generarOrdenesOptimizador('266-2', [v]);
    const idxCenefaDel = 9;
    const idxPerfilSup = 10;
    expect(aoa[1][idxCenefaDel]).toBe(296.6); // 296.9 − 0.3
    expect(aoa[1][idxPerfilSup]).toBe(296.6);
  });

  it('peso soft light → COLOR PESO INF. SOFT LIGHT con código por color', () => {
    const idxColorPesoInf = 16;
    const vBco = ventanaSoftLight(2.969, 'PZA 3-G2');
    vBco.panos[0].colorPeso = 'BCO';
    const { aoa: aoaBco } = generarOrdenesOptimizador('266-2', [vBco]);
    expect(aoaBco[1][idxPESO_SOFT_LIGHT]).toBe(289.9);
    expect(aoaBco[1][idxColorPesoInf]).toBe('E24 [BLANCO]');

    const vNeg = ventanaSoftLight(2.969, 'PZA 3-G2');
    vNeg.panos[0].colorPeso = 'NEGRO';
    const { aoa: aoaNeg } = generarOrdenesOptimizador('266-2', [vNeg]);
    expect(aoaNeg[1][idxColorPesoInf]).toBe('E44 [NEGRO]');
  });
});

describe('generarOrdenesOptimizador — cuadro de cenefas cuadradas (verticales/roller)', () => {
  const cenefaCuadrada = [
    { codInt: 'CENF C', cantidad: 2.694, descuento: 0, ubicacion: 'LIVING', colorAcc: 'CAFÉ' },
  ];

  // Ventana roller con cenefa cuadrada; el TIP. INST sale del "Tapas" del paño.
  function ventanaCenefaCuadrada(tapa: string): Ventana {
    const v = ventana('');
    v.ubicacion = 'LIVING';
    v.panos = [
      { ancho: 2.69, alto: 2, color: 'CAFÉ', cenefa: 'Cuadrada', cenefaTapa: tapa } as Pano,
    ];
    return v;
  }

  it('anexa el cuadro tras una fila en blanco; ANCHO CORTE EST = inicial − 0,5 (muro a muro)', () => {
    const { aoa, filas } = generarOrdenesOptimizador('266-4', [ventanaCenefaCuadrada('MURO_MURO')], {
      adicionalesFase0: cenefaCuadrada,
    });
    expect(filas).toBe(1); // filas reportadas = solo paños, sin el cuadro
    const tituloIdx = aoa.findIndex((r) => String(r[0]).startsWith('CENEFAS CUADRADAS'));
    expect(tituloIdx).toBeGreaterThan(0);
    expect(aoa[tituloIdx - 1]).toEqual([]); // fila en blanco antes del cuadro
    const header = aoa[tituloIdx + 1];
    expect(header[0]).toBe('ANCHO INICIAL');
    expect(header[5]).toBe('ANCHO CORTE EST.');
    const fila = aoa[tituloIdx + 2];
    expect(fila[0]).toBe(269.4); // 2,694 × 100 (cantidad del adicional)
    expect(fila[1]).toBe('CAFÉ');
    expect(fila[2]).toBe('LIVING');
    expect(fila[3]).toBe('CENEFA CUADRADA');
    expect(fila[4]).toBe('MURO_MURO'); // TIP. INST desde el "Tapas" del paño
    expect(fila[5]).toBe(268.9); // 269,4 − 0,5
    expect(fila[6]).toBe(''); // sobrante: lo llena el cortador
  });

  it('TIP. INST CON_1_TAPA del paño → ANCHO CORTE EST = inicial + 1', () => {
    const { aoa } = generarOrdenesOptimizador('266-4', [ventanaCenefaCuadrada('CON_1_TAPA')], {
      adicionalesFase0: cenefaCuadrada,
    });
    const fila = aoa[aoa.findIndex((r) => String(r[0]).startsWith('CENEFAS CUADRADAS')) + 2];
    expect(fila[4]).toBe('CON_1_TAPA');
    expect(fila[5]).toBe(270.4);
  });

  it('legacy SIN_TAPA en el paño → TIP. INST "MURO_MURO" (− 0,5)', () => {
    const { aoa } = generarOrdenesOptimizador('266-4', [ventanaCenefaCuadrada('SIN_TAPA')], {
      adicionalesFase0: cenefaCuadrada,
    });
    const fila = aoa[aoa.findIndex((r) => String(r[0]).startsWith('CENEFAS CUADRADAS')) + 2];
    expect(fila[4]).toBe('MURO_MURO');
    expect(fila[5]).toBe(268.9);
  });

  it('NO anexa el cuadro si la OT no tiene cortinas roller/vertical', () => {
    const { aoa } = generarOrdenesOptimizador('266-4', [ventanaSoftLight(2.969, 'LIVING')], {
      adicionalesFase0: cenefaCuadrada,
    });
    expect(aoa.some((r) => String(r[0]).startsWith('CENEFAS CUADRADAS'))).toBe(false);
  });

  it('sin adicionales de cenefa cuadrada no anexa el cuadro', () => {
    const { aoa } = generarOrdenesOptimizador('266-4', [ventana('')]);
    expect(aoa.some((r) => String(r[0]).startsWith('CENEFAS CUADRADAS'))).toBe(false);
  });
});

describe('generarOrdenesOptimizador — código del tubo', () => {
  it('usa el tubo elegido en el paño (E02), no el primero del modelo (E01)', () => {
    const { aoa } = generarOrdenesOptimizador('266-1', [ventana('0,38mm [E02] 1,2mm')]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E02');
  });

  it('si el paño no define tubo, aplica la regla por ancho (≤2,2 m → E02)', () => {
    const { aoa } = generarOrdenesOptimizador('266-1', [ventana('')]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E02');
  });
});

describe('generarOrdenesOptimizador — tubo por ancho (E02/E66)', () => {
  it('cortina >2,2 m sin tubo manual usa E66', () => {
    const { aoa } = generarOrdenesOptimizador('266-1', [
      { ...ventana(''), panos: [{ ancho: 2.97, alto: 2, color: 'GRIS' } as Pano] } as Ventana,
    ]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E66');
  });
  it('cortina ≤2,2 m sin tubo manual usa E02', () => {
    const { aoa } = generarOrdenesOptimizador('266-1', [
      { ...ventana(''), panos: [{ ancho: 2.2, alto: 2, color: 'GRIS' } as Pano] } as Ventana,
    ]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E02');
  });
  it('respeta el tubo elegido a mano aunque el ancho sea >2m', () => {
    const { aoa } = generarOrdenesOptimizador('266-1', [
      { ...ventana('0,38mm [E02] 1,2mm'), panos: [{ ancho: 2.97, alto: 2, color: 'GRIS', tuberia: '0,38mm [E02] 1,2mm' } as Pano] } as Ventana,
    ]);
    expect(aoa[1][idxTUBERIA]).toBe('38mm_E02');
  });
});

describe('generarOrdenesOptimizador — BEEBLACK', () => {
  const idxPerfilSupAncho = col('PERFIL SUPERIOR (ANCHO)');
  const idxAnchoTela = col('ANCHO TELA');
  const idxTotalLamas = col('TOTAL LAMAS CORTE');
  const idxManillaIzq = col('MANILLA IZQ (ALTO)');
  const idxTubo = 6;

  function ventanaBeeblack(
    anchoM: number,
    altoM: number,
    sentido: string,
    panoExtra: Partial<Pano> = {},
  ): Ventana {
    return {
      id: 'v-bb',
      ubicacion: 'SALA',
      codInt: 'BK BB',
      producto: 'Beeblack',
      tipo: '',
      color: 'BLANCO',
      alto: altoM,
      precio: 0,
      cantidad: 1,
      categoria: 'BEEBLACK',
      sentido,
      grupoId: null,
      modelo: null,
      panos: [
        {
          ancho: anchoM,
          alto: altoM,
          color: 'BLANCO',
          beeblackVariante: sentido === 'INTERNO' ? 'INTERNO' : 'EXTERNO_SEMI',
          beeblackManillaIzq: true,
          beeblackManillaDer: true,
          ...panoExtra,
        } as Pano,
      ],
    } as Ventana;
  }

  it('INTERNO 200×130.1 — columnas BEEBLACK sin tubo/peso roller', () => {
    const { aoa, advertencias } = generarOrdenesOptimizador('888', [
      ventanaBeeblack(2, 1.301, 'INTERNO'),
    ]);
    expect(advertencias).toHaveLength(0);
    const fila = aoa[1];
    expect(fila[idxTubo]).toBe('');
    expect(fila[idxPerfilSupAncho]).toBe(194.3);
    expect(fila[idxAnchoTela]).toBe(195.3);
    expect(fila[idxTotalLamas]).toBe(140.2);
    expect(fila[idxManillaIzq]).toBe(125.1);
  });

  it('EXTERNO_SEMI 150×130 extras ON — integración Fase 4', () => {
    const { aoa } = generarOrdenesOptimizador('888', [
      ventanaBeeblack(1.5, 1.3, 'EXTERNO', {
        beeblackExtraSupInfIzq: true,
        beeblackExtraSupInfDer: true,
        beeblackExtraLatSup: true,
        beeblackExtraLatInf: true,
      }),
    ]);
    const fila = aoa[1];
    expect(fila[idxPerfilSupAncho]).toBe(151);
    expect(fila[idxTotalLamas]).toBe(110.9);
    expect(fila[idxManillaIzq]).toBe(131.7);
  });
});

describe('generarOrdenesOptimizador — dual (2 telas por ventana)', () => {
  const idxCOD_INT = 2;
  const dualModel: ModeloDespiece = {
    sistema: 'ROLLER_DUAL',
    tipo_rol: 'ROL_DUAL',
    mecanismo: 'MEC_01_DUAL_DERECHO_BLANCO',
    codigos_tubo: 'E01; E02; E66',
    diametro_tubo_mm: 38,
    dcto_tubo_cm: 3.9,
    dcto_tela_cm: 0.5,
    suma_peso_cm: 0.1,
    dcto_cenefa_cm: 0,
    dcto_cenefa_del_cm: 0,
    dcto_cenefa_tra_cm: 0,
    dcto_perfiles_cm: 0,
    peso_interno_duo_cm: 0,
    peso_u_duo_cm: 0,
    ancho_max_m: 2.1,
    activo: true,
    notas: '',
  };

  it('exporta 2 filas TUBO/PESO, COD_INT por paño y tubería 38mm_E02', () => {
    const v = {
      id: 'vd', ubicacion: 'LIVING', codInt: 'SC 68', producto: 'ROLLER SCREEN',
      tipo: '', color: 'BLANCO', alto: 1.8, precio: 0, cantidad: 1,
      categoria: 'ROL_DUAL', grupoId: null, grupoOrden: 0, modelo: dualModel,
      panos: [
        { ancho: 1.6, alto: 1.8, color: 'BLANCO', dual: true, codInt: 'SC 68' },
        { ancho: 1.6, alto: 1.8, color: 'BLANCO', dual: true, codInt: 'BK 69' },
      ] as Pano[],
    } as Ventana;
    const { aoa } = generarOrdenesOptimizador('DUAL-1', [v]);
    // 2 filas de datos (una por paño).
    expect(aoa).toHaveLength(3); // header + 2
    expect(aoa[1][idxCOD_INT]).toBe('SC 68');
    expect(aoa[2][idxCOD_INT]).toBe('BK 69');
    // Tubo por paño = ancho − 3,9 (160 − 3,9 = 156,1).
    expect(aoa[1][idxTUBO]).toBe(156.1);
    expect(aoa[2][idxTUBO]).toBe(156.1);
    // Tubería 38 mm → E02 (ancho ≤ 2,2 m).
    expect(String(aoa[1][idxTUBERIA])).toContain('E02');
  });
});

describe('generarOrdenesOptimizador — PLETINA (velcro)', () => {
  const pletinaRoller: ModeloDespiece = {
    sistema: 'PLETINA_ROLLER',
    tipo_rol: 'PLETINA_ROLLER_V',
    mecanismo: 'VELCRO',
    codigos_tubo: '',
    diametro_tubo_mm: 0,
    dcto_tubo_cm: 0.8,
    dcto_tela_cm: 0.8,
    suma_peso_cm: 0.7,
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
  const pletinaDuo: ModeloDespiece = {
    ...pletinaRoller,
    sistema: 'PLETINA_DUO',
    tipo_rol: 'PLETINA_DUO_V',
    peso_u_duo_cm: 0.6,
    peso_interno_duo_cm: 0.8,
  };
  const ventPletina = (modelo: ModeloDespiece, categoria: string, producto: string): Ventana =>
    ({
      id: 'vp',
      ubicacion: 'TERRAZA',
      codInt: 'SC 02',
      producto,
      tipo: '',
      color: 'GRIS',
      alto: 1.85,
      precio: 0,
      cantidad: 1,
      categoria,
      grupoId: null,
      grupoOrden: 0,
      modelo,
      panos: [{ ancho: 0.8, alto: 1.85, color: 'GRIS' } as Pano],
    }) as Ventana;

  const idxPletina = col('PLETINA');
  const idxTelaYPletina = col('TELA Y PLETINA');
  const idxPesoU = col('PESO U');
  const idxPesoInterno = col('PESO INTERNO');
  const idxAltoMesa = col('ALTO MESA DE CORTE');
  const idxAltoTela = col('ALTO TELA');

  it('roller 0,80×1,85 → PLETINA 79,2 · PESO 79,3 · TUBO vacío · TUBERIA VELCRO · ALTO TELA 185', () => {
    const { aoa } = generarOrdenesOptimizador('X', [
      ventPletina(pletinaRoller, 'PLETINA_ROLLER_V', 'ROLLER SCREEN PREMIUM'),
    ]);
    expect(aoa[1][idxPletina]).toBe(79.2);
    expect(aoa[1][idxPESO]).toBe(79.3);
    expect(aoa[1][idxTUBO]).toBe('');
    expect(aoa[1][idxTUBERIA]).toBe('VELCRO');
    expect(aoa[1][idxAltoTela]).toBe(185);
  });

  it('dúo 0,80×1,85 → TELA Y PLETINA 79,2 · PESO U 79,4 · PESO INTERNO 79,2 · ALTO MESA 195 · ALTO TELA 370', () => {
    const { aoa } = generarOrdenesOptimizador('X', [
      ventPletina(pletinaDuo, 'PLETINA_DUO_V', 'ROLLER DUO BLACKOUT PREMIUM'),
    ]);
    expect(aoa[1][idxTelaYPletina]).toBe(79.2);
    expect(aoa[1][idxPesoU]).toBe(79.4);
    expect(aoa[1][idxPesoInterno]).toBe(79.2);
    expect(aoa[1][idxAltoMesa]).toBe(195);
    expect(aoa[1][idxAltoTela]).toBe(370);
    expect(aoa[1][idxTUBERIA]).toBe('VELCRO');
    expect(aoa[1][idxPletina]).toBe(''); // el dúo NO llena la columna PLETINA
  });
});
