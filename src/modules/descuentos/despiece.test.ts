// Tests dorados del motor de despiece.
// Las reglas de peso/tela fueron validadas contra OTs REALES del taller
// (3024, 3029, 3031): peso = tubo − 0.4; tela = tubo − suma_peso (0.1).
import { describe, expect, it } from 'vitest';
import { calcularDespiece, COLUMNA_PESO_OSCURIDAD } from './despiece';
import type { ModeloDespiece } from './tipos';

const base: Omit<ModeloDespiece, 'sistema' | 'tipo_rol' | 'mecanismo'> = {
  codigos_tubo: 'E01; E02',
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

function corte(d: ReturnType<typeof calcularDespiece>, col: string) {
  return d.cortes.find((c) => c.columnaExcel === col)?.medidaCm;
}
function tela(d: ReturnType<typeof calcularDespiece>) {
  return d.cortes.find((c) => c.componente.startsWith('Tela'))?.medidaCm;
}

describe('calcularDespiece — OT 3029 REAL (Roller Screen gris, MEC_13)', () => {
  const m: ModeloDespiece = {
    ...base,
    sistema: 'ROLLER_SIMPLE',
    tipo_rol: 'ROL_SIMPLE',
    mecanismo: 'MEC_13_LZ50_SINFLEX_GRIS',
    dcto_tubo_cm: 3.8,
    dcto_tela_cm: 0.5,
    suma_peso_cm: 0.1,
  };
  it('TERRAZA IZQ 150.1 → tubo 146.3, peso 145.9 (planilla del taller)', () => {
    const d = calcularDespiece(m, 150.1);
    expect(corte(d, 'TUBO')).toBe(146.3);
    expect(corte(d, 'PESO')).toBe(145.9);
    expect(tela(d)).toBe(145.8); // peso − 0.1 (la tela se cuelga del peso)
  });
  it('TERRAZA DER 147.5 → tubo 143.7, peso 143.3', () => {
    const d = calcularDespiece(m, 147.5);
    expect(corte(d, 'TUBO')).toBe(143.7);
    expect(corte(d, 'PESO')).toBe(143.3);
  });
});

describe('calcularDespiece — OT 3031 REAL (BK 72, ancho 200.1)', () => {
  // En la orden de la OT 3031: tubo 196.3 / peso 195.9
  const m: ModeloDespiece = {
    ...base,
    sistema: 'ROLLER_SIMPLE',
    tipo_rol: 'ROL_SIMPLE',
    mecanismo: 'MEC_05_LZ90_BLANCO',
    dcto_tubo_cm: 3.8,
    suma_peso_cm: 0.1,
  };
  it('tubo 196.3, peso 195.9 (regla tubo − 0.4)', () => {
    const d = calcularDespiece(m, 200.1);
    expect(corte(d, 'TUBO')).toBe(196.3);
    expect(corte(d, 'PESO')).toBe(195.9);
  });
});

describe('calcularDespiece — cenefa ovalada manual 38 (ancho 250)', () => {
  const m: ModeloDespiece = {
    ...base,
    sistema: 'CENEFA_OVALADA',
    tipo_rol: 'ROL_CENEFA_OV_MANUAL_38mm',
    mecanismo: 'MEC_10_OVALADA_BLANCO',
    dcto_tubo_cm: 1.8,
    suma_peso_cm: 0.1,
    dcto_cenefa_cm: 1.5,
  };
  const d = calcularDespiece(m, 250);
  it('tapa = ancho − cenefa (248.5); tubo y peso van detrás (− tubo − cenefa)', () => {
    // La tapa ovalada es la más ancha; el tubo va detrás.
    expect(corte(d, 'CENEFA OVALADA')).toBe(248.5); // 250 − 1.5
    expect(corte(d, 'TUBO')).toBe(246.7); // 250 − 1.8 − 1.5
    expect(corte(d, 'PESO')).toBe(246.3); // tubo − 0.4
    // En cenefa ovalada la tela se cuelga del PESO: peso − 0.1 (no tubo − 0.1).
    expect(tela(d)).toBe(246.2); // 246.3 − 0.1
  });
});

describe('calcularDespiece — DÚO manual 38 (ancho 200)', () => {
  const m: ModeloDespiece = {
    ...base,
    sistema: 'CENEFA_OVALADA_DUO',
    tipo_rol: 'DUO_CENEFA_OV_MANUAL_38mm',
    mecanismo: 'MEC_09_OVALADA_NEGRO',
    dcto_tubo_cm: 1.8,
    dcto_tela_cm: 0.5,
    dcto_cenefa_cm: 1.5,
    peso_interno_duo_cm: 0.2,
    peso_u_duo_cm: 0.3,
  };
  const d = calcularDespiece(m, 200);
  it('pesos dúo detrás de la tapa (peso interno = tela 196.2, U 196.4), sin columna PESO', () => {
    // baseTubo = 200 − 1.8 − 1.5 = 196.7 (los pesos van detrás de la cenefa).
    // El PESO INTERNO va del MISMO ancho que la tela = baseTubo − dcto_tela (OT 3048).
    expect(corte(d, 'PESO INTERNO')).toBe(196.2); // 196.7 − 0.5 (= tela)
    expect(corte(d, 'PESO U')).toBe(196.4); // 196.7 − 0.3
    expect(corte(d, 'PESO')).toBeUndefined();
    // La tela dúo la fija dcto_tela (no suma_peso): mismo ancho que el peso interno.
    expect(tela(d)).toBe(196.2);
  });

  // Caso REAL de planilla del taller (OT 3048, duoej.xlsx): ancho 166 →
  // tubo 162.7, peso U 162.4, peso interno 162.2 (= tela). Antes daba 162.5.
  it('OT 3048 LIVING IZQ ancho 166 → tubo 162.7, peso U 162.4, peso interno 162.2', () => {
    const d3048 = calcularDespiece(m, 166);
    expect(corte(d3048, 'TUBO')).toBe(162.7); // 166 − 1.8 − 1.5
    expect(corte(d3048, 'PESO U')).toBe(162.4); // 162.7 − 0.3
    expect(corte(d3048, 'PESO INTERNO')).toBe(162.2); // 162.7 − 0.5 (= tela)
    expect(tela(d3048)).toBe(162.2); // TELA de la etiqueta de estructura dúo
  });
});

describe('calcularDespiece — SOFT LIGHT interno 38 mm (SISTEMAS OSCURIDAD.xlsx)', () => {
  const m: ModeloDespiece = {
    ...base,
    sistema: 'SOFT_LIGHT',
    tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
    mecanismo: '',
    codigos_tubo: 'E01; E02; E03; E53; E66',
    dcto_tubo_cm: 1.2,
    dcto_tela_cm: 0.2,
    suma_peso_cm: 0.1,
  };

  it('ancho 296.9 cm → tubo 293.9, peso 289.9 (ejemplo del Excel)', () => {
    const d = calcularDespiece(m, 296.9, {
      categoria: 'SOFT_LIGHT_38mm',
      sentido: 'INTERNO',
    });
    expect(corte(d, 'TUBO')).toBe(293.9);
    expect(corte(d, COLUMNA_PESO_OSCURIDAD)).toBe(289.9);
    expect(corte(d, 'PESO')).toBeUndefined();
    expect(tela(d)).toBe(289.7); // peso − 0.2
    expect(d.aproximado).toBe(false); // ahora se calcula con reglas-oscuridad
  });

  it('ancho 298.7 cm → tubo 295.7, peso 291.7 (OT 266-2)', () => {
    const d = calcularDespiece(m, 298.7, {
      categoria: 'SOFT_LIGHT_38mm',
      sentido: 'INTERNO',
    });
    expect(corte(d, 'TUBO')).toBe(295.7);
    expect(corte(d, COLUMNA_PESO_OSCURIDAD)).toBe(291.7);
    expect(corte(d, 'PESO')).toBeUndefined();
  });

  it('modelo SEMI + sentido INTERNO → fórmulas interno (no genérico ancho−1.2)', () => {
    const semi = { ...m, tipo_rol: 'SOFT_LIGHT_SEMI_38mm' };
    const d = calcularDespiece(semi, 284.9, {
      categoria: 'SOFT_LIGHT_38mm',
      sentido: 'INTERNO',
    });
    expect(corte(d, 'TUBO')).toBe(281.9);
    expect(corte(d, COLUMNA_PESO_OSCURIDAD)).toBe(277.9);
    expect(corte(d, 'PESO')).toBeUndefined();
  });

  it('sentido EXTERNO → cenefa ancho + 13.2', () => {
    const d = calcularDespiece(m, 200, {
      categoria: 'SOFT_LIGHT_38mm',
      sentido: 'EXTERNO',
    });
    expect(corte(d, 'TUBO')).toBe(211.4);
    expect(corte(d, COLUMNA_PESO_OSCURIDAD)).toBe(207.4);
    expect(corte(d, 'PESO')).toBeUndefined();
  });
});

/** Fila del catálogo de la cortina vertical (sql/20260721_alta_vertical_descuentos.sql). */
const mVertical: ModeloDespiece = {
  ...base,
  sistema: 'VERTICAL',
  tipo_rol: 'VERTICAL_LAMAS_89',
  mecanismo: '',
  codigos_tubo: '',
  diametro_tubo_mm: 0,
  dcto_tubo_cm: 1.8, // perfil cabezal
  dcto_perfiles_cm: 1.7, // varilla (encadenada al perfil)
  ancho_max_m: 6,
};

describe('calcularDespiece — pletina y oscuridad', () => {
  it('pletina roller (velcro): cada corte se descuenta DIRECTO del ancho (Excel manual)', () => {
    const m: ModeloDespiece = {
      ...base,
      sistema: 'PLETINA_ROLLER',
      tipo_rol: 'PLETINA_ROLLER_V',
      mecanismo: 'VELCRO',
      diametro_tubo_mm: 0,
      dcto_tubo_cm: 0.8,
      dcto_tela_cm: 0.8,
      suma_peso_cm: 0.7,
    };
    const d = calcularDespiece(m, 80); // ancho 80 → 79,2 / 79,2 / 79,3
    expect(corte(d, 'PLETINA')).toBe(79.2);
    expect(tela(d)).toBe(79.2);
    expect(corte(d, 'PESO')).toBe(79.3);
    expect(corte(d, 'TUBO')).toBeUndefined();
  });

  it('pletina dúo (velcro): tela y pletina / peso U / peso interno directos del ancho', () => {
    const m: ModeloDespiece = {
      ...base,
      sistema: 'PLETINA_DUO',
      tipo_rol: 'PLETINA_DUO_V',
      mecanismo: 'VELCRO',
      diametro_tubo_mm: 0,
      dcto_tubo_cm: 0.8,
      dcto_tela_cm: 0.8,
      peso_u_duo_cm: 0.6,
      peso_interno_duo_cm: 0.8,
    };
    const d = calcularDespiece(m, 80); // ancho 80 → 79,2 / 79,4 / 79,2
    expect(corte(d, 'TELA Y PLETINA')).toBe(79.2);
    expect(corte(d, 'PESO U')).toBe(79.4);
    expect(corte(d, 'PESO INTERNO')).toBe(79.2);
    expect(corte(d, 'PLETINA')).toBeUndefined();
    expect(corte(d, 'TUBO')).toBeUndefined();
  });

  it('vertical: perfil/varilla encadenados y carritos con floor (fórmulas del taller)', () => {
    const d = calcularDespiece(mVertical, 150, { altoCm: 180 });
    expect(corte(d, 'PERFIL CABEZAL')).toBe(148.2); // 150 − 1,8
    expect(corte(d, 'VARILLA')).toBe(146.5); // 148,2 − 1,7
    expect(corte(d, 'CARRITOS')).toBe(18); // floor(146,5 / 8) = floor(18,31)
    expect(corte(d, 'LAMAS')).toBe(18); // una por carrito (como la ferretería)
    expect(corte(d, 'REPUESTO')).toBe(2); // tela extra, no se instala
    expect(corte(d, 'ALTO TELA')).toBe(185); // 180 + 5
    expect(corte(d, 'ALTO FINAL LAMA')).toBe(172); // 185 − 13
    // El ancho del corte de tela es el ancho real (sin descuento) y va sin
    // columna: la tela no viaja en el Excel de órdenes.
    expect(d.cortes.find((c) => c.componente === 'Ancho tela')?.medidaCm).toBe(150);
    expect(corte(d, 'TUBO')).toBeUndefined();
    expect(corte(d, 'PESO')).toBeUndefined();
  });

  it('vertical: la división exacta NO suma un carrito de más', () => {
    // 131,5 → perfil 129,7 → varilla 128,0 → 128/8 = 16 justo.
    const d = calcularDespiece(mVertical, 131.5, { altoCm: 200 });
    expect(corte(d, 'VARILLA')).toBe(128);
    expect(corte(d, 'CARRITOS')).toBe(16);
    expect(corte(d, 'LAMAS')).toBe(16);
  });

  it('vertical: los cm de tela salen del contexto (parámetros de corte)', () => {
    const d = calcularDespiece(mVertical, 150, {
      altoCm: 180,
      verticalExtraAltoCm: 6,
      verticalDctoAltoFinalCm: 12,
    });
    expect(corte(d, 'ALTO TELA')).toBe(186);
    expect(corte(d, 'ALTO FINAL LAMA')).toBe(174);
  });

  it('vertical sin alto: solo el aluminio, sin columnas de tela', () => {
    const d = calcularDespiece(mVertical, 150);
    expect(corte(d, 'PERFIL CABEZAL')).toBe(148.2);
    expect(corte(d, 'ALTO TELA')).toBeUndefined();
    expect(corte(d, 'ALTO FINAL LAMA')).toBeUndefined();
    expect(corte(d, 'LAMAS')).toBe(18);
    expect(corte(d, 'REPUESTO')).toBe(2);
  });

  it('dark roller marcado aproximado, con cenefas del/tras', () => {
    const m: ModeloDespiece = {
      ...base,
      sistema: 'DARK_ROLLER',
      tipo_rol: 'DARK_INTERNO_38mm',
      mecanismo: '',
      dcto_tubo_cm: 6.1,
      suma_peso_cm: 0.2,
      dcto_cenefa_del_cm: 0.3,
      dcto_cenefa_tra_cm: 1,
    };
    const d = calcularDespiece(m, 200);
    expect(d.aproximado).toBe(true);
    expect(corte(d, 'CENEFA DELANTERA')).toBe(199.7);
    expect(corte(d, 'CENEFA TRASERA')).toBe(199);
    expect(corte(d, COLUMNA_PESO_OSCURIDAD)).toBe(193.5);
    expect(corte(d, 'PESO')).toBeUndefined();
    expect(d.notas.some((n) => n.includes('PERFILES'))).toBe(true);
  });

  it('ancho inválido → sin cortes', () => {
    const m: ModeloDespiece = { ...base, sistema: 'X', tipo_rol: 'X', mecanismo: '' };
    expect(calcularDespiece(m, 0).cortes).toHaveLength(0);
  });
});

describe('calcularDespiece — BEEBLACK', () => {
  const stub: ModeloDespiece = { ...base, sistema: 'STUB', tipo_rol: 'STUB', mecanismo: '' };

  it('INTERNO 200×130.1 enruta a reglas beeblack (golden Excel)', () => {
    const d = calcularDespiece(stub, 200, {
      categoria: 'BEEBLACK',
      altoCm: 130.1,
      beeblackVariante: 'INTERNO',
      beeblackToggles: { manillaIzq: true, manillaDer: true },
    });
    expect(d.aproximado).toBe(false);
    expect(corte(d, 'PERFIL SUPERIOR (ANCHO)')).toBe(194.3);
    expect(corte(d, 'ANCHO TELA')).toBe(195.3);
    expect(corte(d, 'TOTAL LAMAS CORTE')).toBe(140.2);
    expect(corte(d, 'MANILLA IZQ (ALTO)')).toBe(125.1);
    expect(corte(d, 'TUBO')).toBeUndefined();
  });

  it('EXTERNO_SEMI 150×130 extras ON', () => {
    const d = calcularDespiece(stub, 150, {
      categoria: 'BEEBLACK',
      altoCm: 130,
      beeblackVariante: 'EXTERNO_SEMI',
      beeblackToggles: {
        extraAnchoIzq: true,
        extraAnchoDer: true,
        extraAltoSup: true,
        extraAltoInf: true,
        manillaIzq: true,
        manillaDer: true,
      },
    });
    expect(corte(d, 'PERFIL SUPERIOR (ANCHO)')).toBe(151);
    expect(corte(d, 'PERFIL LATERAL IZQ (ALTO)')).toBe(131);
    expect(corte(d, 'MANILLA IZQ (ALTO)')).toBe(131.7);
    expect(corte(d, 'TOTAL LAMAS CORTE')).toBe(110.9);
  });
});
