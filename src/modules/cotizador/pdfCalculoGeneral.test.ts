import { describe, it, expect } from 'vitest';
import {
  aplicarVariante,
  construirCalculoGeneral,
  envolverEtiqueta,
  VARIANTE_DIMENSIONADO,
} from './pdfCalculoGeneral';
import { PARAMETROS_CORTE_DEFAULT } from './parametrosCorte';
import type { Ventana } from './types';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

const modeloRoller: ModeloDespiece = {
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL',
  mecanismo: 'MEC_14_LZ50_SINFLEX_BLANCO',
  codigos_tubo: 'E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 2,
  dcto_tela_cm: 0,
  suma_peso_cm: 0.1,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 99,
  activo: true,
  notas: '',
};

function ventRoller(ancho: number, ubic: string): Ventana {
  return {
    id: `v${ubic}`,
    ubicacion: ubic,
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    categoria: 'ROL',
    color: 'BLANCO',
    alto: 1.8,
    precio: 0,
    cantidad: 1,
    grupoId: null,
    sentido: 'EXTERNO',
    direccion: 'CAD [IZQUIERDA]',
    modelo: modeloRoller,
    panos: [
      {
        ancho,
        alto: 1.8,
        color: 'BLANCO',
        codCadena: 'CAD 05',
        largoCadena: '4MT',
        codPeso: 'PCA 04',
        colorPeso: 'TRANSPARENTE',
      },
    ],
  } as Ventana;
}

describe('construirCalculoGeneral', () => {
  it('una fila por cortina con identidad y despiece del mismo motor', () => {
    const data = construirCalculoGeneral([ventRoller(1.745, 'PPAL IZQ')]);
    expect(data.filas).toHaveLength(1);
    const f = data.filas[0];
    expect(f.bloque).toBe('ROLLER');
    expect(f.anchoCorteCm).toBe(174.5);
    expect(f.altoRollerCm).toBe(205); // alto + 25
    expect(f.cadena).toBe('CAD [IZQUIERDA]');
    expect(f.armado).toBe('EXTERNO');
    // Columnas nuevas (lo que faltaba vs el manual cg.xlsx).
    expect(f.codSec).toBe('ROL');
    // Mecanismo como CHIP de bodega (mismo resolutor que Fase 4), no el id
    // crudo del modelo Excel. Aquí el color no mapea a kit 32/33/34
    // (colorPeso TRANSPARENTE) → chip derivado del modelo MEC_14.
    expect(f.codMecanismo).toBe('LZ50 SFLX BCO [MEC 14]');
    expect(f.accionamiento).toBe('[CAD 05] 4MT');
    expect(f.pesoCadena).toBe('[PCA 04] TRANSPARENTE');
    // Despiece del mismo motor: tubo = ancho − 2, peso = tubo − 0,4, tela = peso − 0,1.
    expect(f.despiece.get('TUBO')).toBe(172.5);
    expect(f.despiece.get('PESO')).toBe(172.1);
    expect(f.despiece.get('TELA (ANCHO)')).toBe(172); // peso − 0.1
    // Columna ALTO del Excel manual: alto de corte de la tela (alto + 25).
    expect(f.despiece.get('ALTO')).toBe(205);
  });

  it('dúo: la columna ALTO trae el corte real (2×alto + 30)', () => {
    const v = ventRoller(1.5, 'LIVING');
    (v as { producto: string }).producto = 'ROLLER DUO BLACKOUT PREMIUM';
    const [f] = construirCalculoGeneral([v]).filas;
    expect(f.despiece.get('ALTO')).toBe(390); // 180×2 + 30
  });

  it('pletina roller: ALTO exacto (sin +25), la tela no lleva vuelta de tubo', () => {
    const modeloPletR: ModeloDespiece = {
      ...modeloRoller,
      sistema: 'PLETINA_ROLLER',
      diametro_tubo_mm: 0,
      dcto_tubo_cm: 0.8,
      dcto_tela_cm: 0.8,
      suma_peso_cm: 0.7,
      ancho_max_m: 3,
    };
    const v = ventRoller(0.8, 'TERRAZA IZQ');
    (v as { categoria: string }).categoria = 'PLETINA_ROLLER_V';
    (v as { alto: number }).alto = 1.85;
    v.panos![0].alto = 1.85;
    v.modelo = modeloPletR;
    const [f] = construirCalculoGeneral([v]).filas;
    expect(f.altoRollerCm).toBe(185); // exacto, sin +25
    expect(f.despiece.get('ALTO')).toBe(185);
    // Despiece directo del ancho: pletina/tela = 80 − 0,8 ; peso = 80 − 0,7.
    expect(f.despiece.get('PLETINA')).toBe(79.2);
    expect(f.despiece.get('PESO')).toBe(79.3);
  });

  it('pletina dúo: ALTO = 2×alto (sin +30); Dimensionado → ALTO MESA = alto+10', () => {
    const modeloPletD: ModeloDespiece = {
      ...modeloRoller,
      sistema: 'PLETINA_DUO',
      diametro_tubo_mm: 0,
      dcto_tubo_cm: 0.8,
      dcto_tela_cm: 0.8,
      peso_u_duo_cm: 0.6,
      peso_interno_duo_cm: 0.8,
      ancho_max_m: 3,
    };
    const v = ventRoller(0.8, 'TERRAZA DER');
    (v as { producto: string }).producto = 'ROLLER DUO BLACKOUT DELUX';
    (v as { categoria: string }).categoria = 'PLETINA_DUO_V';
    (v as { alto: number }).alto = 1.85;
    v.panos![0].alto = 1.85;
    v.modelo = modeloPletD;
    const [f] = construirCalculoGeneral([v]).filas;
    expect(f.altoDuoCm).toBe(370); // 185×2, sin +30
    expect(f.despiece.get('ALTO')).toBe(370);
    expect(f.despiece.get('TELA Y PLETINA')).toBe(79.2);
    expect(f.despiece.get('PESO U (LÁGRIMA)')).toBe(79.4);
    expect(f.despiece.get('PESO INTERNO (E13)')).toBe(79.2);
    // Dimensionado: la tela dúo se corta doblada → ALTO MESA DE CORTE = alto + 10.
    const [fd] = construirCalculoGeneral(
      [v],
      {},
      PARAMETROS_CORTE_DEFAULT,
      undefined,
      { altoMesaCorteDuo: true },
    ).filas;
    expect(fd.despiece.get('ALTO MESA DE CORTE')).toBe(195);
    expect(fd.despiece.has('ALTO')).toBe(false);
  });

  it('arma un bloque ROLLER con las columnas que tienen datos', () => {
    const data = construirCalculoGeneral([ventRoller(1.745, 'A'), ventRoller(1.49, 'B')]);
    expect(data.bloques).toHaveLength(1);
    expect(data.bloques[0].sistema.key).toBe('ROLLER');
    const labels = data.bloques[0].columnas.map((c) => c.label);
    expect(labels).toContain('TUBO');
    expect(labels).toContain('PESO');
    expect(labels).toContain('TELA (ANCHO)');
    // ALTO siempre cierra el bloque, como en la hoja manual.
    expect(labels[labels.length - 1]).toBe('ALTO');
  });

  it('oculta columnas de identidad sin datos (ej. sin cadena → no aparece)', () => {
    const v = ventRoller(1.745, 'A');
    (v as { direccion?: string }).direccion = '';
    const data = construirCalculoGeneral([v]);
    const ids = data.identidad.map((c) => c.key);
    expect(ids).not.toContain('cadena');
    expect(ids).toContain('producto');
  });

  it('sin ventanas roller/soft/oscuranti no arma bloques de esos sistemas', () => {
    const data = construirCalculoGeneral([ventRoller(1.745, 'A')]);
    expect(data.bloques.some((b) => b.sistema.key === 'SOFT')).toBe(false);
    expect(data.bloques.some((b) => b.sistema.key === 'OSCU')).toBe(false);
  });

  it('CENEFA OVALADA se divide por tira: "(CON TIRA)" / "(SIN TIRA)" según el paño', () => {
    const modeloCenefa: ModeloDespiece = { ...modeloRoller, dcto_cenefa_cm: 1.5 };
    const conTira = ventRoller(1.45, 'PIEZA 1');
    conTira.modelo = modeloCenefa;
    conTira.panos![0].cenefa = 'Ovalada';
    conTira.panos![0].cenefaTira = 'CON TIRA';
    const sinTira = ventRoller(1.2, 'PIEZA 2');
    sinTira.modelo = modeloCenefa;
    sinTira.panos![0].cenefa = 'Ovalada';
    sinTira.panos![0].cenefaTira = 'SIN TIRA';
    const data = construirCalculoGeneral([conTira, sinTira]);
    // La medida es la misma fórmula (ancho − 1,5); solo cambia la etiqueta.
    expect(data.filas[0].despiece.get('CENEFA OVALADA (CON TIRA)')).toBe(143.5); // 145 − 1,5
    expect(data.filas[0].despiece.has('CENEFA OVALADA (SIN TIRA)')).toBe(false);
    expect(data.filas[1].despiece.get('CENEFA OVALADA (SIN TIRA)')).toBe(118.5); // 120 − 1,5
    // El bloque ROLLER trae ambas columnas y ya no la etiqueta genérica.
    const labels = data.bloques[0].columnas.map((c) => c.label);
    expect(labels).toContain('CENEFA OVALADA (CON TIRA)');
    expect(labels).toContain('CENEFA OVALADA (SIN TIRA)');
    expect(labels).not.toContain('CENEFA OVALADA');
  });

  it('paño ovalado sin tira definida → cae en "(CON TIRA)" por defecto', () => {
    const modeloCenefa: ModeloDespiece = { ...modeloRoller, dcto_cenefa_cm: 1.5 };
    const v = ventRoller(1.45, 'PIEZA 1');
    v.modelo = modeloCenefa;
    v.panos![0].cenefa = 'Ovalada';
    const [f] = construirCalculoGeneral([v]).filas;
    // Default 2026-07-20: la cenefa ovalada sin dato de tira arranca CON TIRA.
    expect(f.despiece.get('CENEFA OVALADA (CON TIRA)')).toBe(143.5);
    expect(f.despiece.has('CENEFA OVALADA (SIN TIRA)')).toBe(false);
  });
});

// DIMENSIONADO: la misma hoja pero solo con lo que usa la mesa de tela.
describe('aplicarVariante — DIMENSIONADO', () => {
  const data = construirCalculoGeneral([ventRoller(1.745, 'PPAL IZQ')]);
  const { identidad, bloques } = aplicarVariante(data, VARIANTE_DIMENSIONADO);

  it('quita tubería, color accesorios, cadena/cierre, armado y ancho/alto mts', () => {
    const keys = identidad.map((c) => c.key);
    for (const fuera of ['tuberia', 'colorAcc', 'cadena', 'armado', 'anchoMts', 'altoMts']) {
      expect(keys).not.toContain(fuera);
    }
    // La identidad útil queda intacta.
    expect(keys).toContain('cant');
    expect(keys).toContain('producto');
    expect(keys).toContain('codInt');
    expect(keys).toContain('ubic');
  });

  it('quita TUBO, PESO y CENEFA OVALADA del bloque, conserva TELA (ANCHO) y ALTO al final', () => {
    const labels = bloques[0].columnas.map((c) => c.label);
    expect(labels).not.toContain('TUBO');
    expect(labels).not.toContain('PESO');
    expect(labels).not.toContain('CENEFA OVALADA');
    expect(labels).toContain('TELA (ANCHO)');
    expect(labels[labels.length - 1]).toBe('ALTO');
  });

  it('también excluye los pesos del dúo (PESO INTERNO / PESO U) y la cenefa ovalada', () => {
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('PESO INTERNO (E13)')).toBe(true);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('PESO U (LÁGRIMA)')).toBe(true);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CENEFA OVALADA')).toBe(true);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CENEFA OVALADA (CON TIRA)')).toBe(true);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CENEFA OVALADA (SIN TIRA)')).toBe(true);
    // Pero no toca otros componentes.
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CIERRE DE ALTURA')).toBe(false);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CENEFA DELANTERA')).toBe(false);
  });
});

// El Dimensionado muestra en las filas dúo ALTO MESA DE CORTE (alto + 10) en
// vez de ALTO, porque la tela dúo se corta doblada en la mesa.
describe('ALTO MESA DE CORTE (Dimensionado dúo)', () => {
  const duo = (ancho: number, alto: number, ubic: string): Ventana => {
    const v = ventRoller(ancho, ubic);
    (v as { producto: string }).producto = 'ROLLER DUO BLACKOUT PREMIUM';
    (v as { alto: number }).alto = alto;
    (v.panos![0] as { alto: number }).alto = alto;
    return v;
  };

  it('dúo con opts → ALTO MESA DE CORTE = alto + 10 y NO setea ALTO', () => {
    const [f] = construirCalculoGeneral([duo(1.5, 2.3, 'PZA 1')], {}, undefined, undefined, {
      altoMesaCorteDuo: true,
    }).filas;
    expect(f.despiece.get('ALTO MESA DE CORTE')).toBe(240); // 230 + 10
    expect(f.despiece.has('ALTO')).toBe(false);
  });

  it('dúo alto 101,5 → mesa 111,5 (media tela con decimal)', () => {
    const [f] = construirCalculoGeneral([duo(0.5, 1.015, 'OFICINA')], {}, undefined, undefined, {
      altoMesaCorteDuo: true,
    }).filas;
    expect(f.despiece.get('ALTO MESA DE CORTE')).toBe(111.5); // 101,5 + 10
  });

  it('roller con opts → ALTO normal (alto+25), sin columna mesa', () => {
    const [f] = construirCalculoGeneral([ventRoller(1.5, 'LIVING')], {}, undefined, undefined, {
      altoMesaCorteDuo: true,
    }).filas;
    expect(f.despiece.get('ALTO')).toBe(205); // 180 + 25
    expect(f.despiece.has('ALTO MESA DE CORTE')).toBe(false);
  });

  it('sin opts → dúo mantiene ALTO = 2×alto+30 (Cálculo General / Inventario intactos)', () => {
    const [f] = construirCalculoGeneral([duo(1.5, 1.8, 'LIVING')]).filas;
    expect(f.despiece.get('ALTO')).toBe(390); // 180×2 + 30
    expect(f.despiece.has('ALTO MESA DE CORTE')).toBe(false);
  });

  it('OT mixta con opts: el bloque trae MESA penúltima y ALTO última', () => {
    const data = construirCalculoGeneral(
      [ventRoller(1.5, 'LIVING'), duo(1.5, 2.3, 'PZA 1')],
      {}, undefined, undefined, { altoMesaCorteDuo: true },
    );
    const labels = data.bloques[0].columnas.map((c) => c.label);
    expect(labels).toContain('ALTO MESA DE CORTE');
    expect(labels[labels.length - 1]).toBe('ALTO');
    expect(labels[labels.length - 2]).toBe('ALTO MESA DE CORTE');
  });

  it('params custom: extraMesaDuoCm gobierna el valor', () => {
    const params = { ...PARAMETROS_CORTE_DEFAULT, extraMesaDuoCm: 15 };
    const [f] = construirCalculoGeneral([duo(1.5, 2.3, 'PZA 1')], {}, params, undefined, {
      altoMesaCorteDuo: true,
    }).filas;
    expect(f.despiece.get('ALTO MESA DE CORTE')).toBe(245); // 230 + 15
  });

  it('VARIANTE_DIMENSIONADO activa el flag y no filtra la columna nueva', () => {
    expect(VARIANTE_DIMENSIONADO.altoMesaCorteDuo).toBe(true);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('ALTO MESA DE CORTE')).toBe(false);
  });

  it('categoría con "DUO" pero producto roller (screen con motor) NO es dúo', () => {
    // OT 999 real: LIVING = ROLLER SCREEN PREMIUM con categoria DUO_MOTOR_PEQUEÑO.
    // El corte (tela.ts) lo trata como roller simple; el dimensionado también.
    const v = ventRoller(1, 'LIVING');
    (v as { categoria: string }).categoria = 'DUO_MOTOR_PEQUEÑO_38mm';
    (v as { alto: number }).alto = 0.6;
    (v.panos![0] as { alto: number }).alto = 0.6;
    const [f] = construirCalculoGeneral([v], {}, undefined, undefined, {
      altoMesaCorteDuo: true,
    }).filas;
    expect(f.despiece.get('ALTO')).toBe(85); // 60 + 25 (roller), no 2×60+30
    expect(f.despiece.has('ALTO MESA DE CORTE')).toBe(false);
  });
});

// Cabeceras: tamaño de letra fijo (como TUBERIA), envolviendo a varias líneas.
describe('envolverEtiqueta', () => {
  const medir = (s: string) => s.length * 2; // 2 mm por carácter

  it('etiqueta corta que cabe → una sola línea', () => {
    expect(envolverEtiqueta(medir, 'TUBERIA', 20)).toEqual(['TUBERIA']);
  });

  it('quiebra por espacio cuando no cabe', () => {
    expect(envolverEtiqueta(medir, 'PESO INTERNO (E13)', 16)).toEqual(['PESO', 'INTERNO', '(E13)']);
  });

  it('quiebra por "/" conservando la barra en la línea de arriba', () => {
    expect(envolverEtiqueta(medir, 'CADENA/CIERRE', 16)).toEqual(['CADENA/', 'CIERRE']);
  });

  it('si todo cabe, no mete espacios extra alrededor de "/"', () => {
    expect(envolverEtiqueta(medir, 'CADENA/CIERRE', 100)).toEqual(['CADENA/CIERRE']);
  });

  it('etiqueta vacía → no rompe', () => {
    expect(envolverEtiqueta(medir, '', 20)).toEqual(['']);
  });
});

describe('CONJUNTO PAÑOS (Dimensionado, #27)', () => {
  it('juntoPorPieza puebla fila.conjunto; VARIANTE_DIMENSIONADO trae conjuntoPanos', () => {
    const vents = [ventRoller(1.4, 'LIVING'), ventRoller(1.5, 'COMEDOR')];
    const junto = new Map([
      ['vLIVING_0', 'A'],
      ['vCOMEDOR_0', 'B'],
    ]);
    const data = construirCalculoGeneral(vents, {}, undefined, junto);
    expect(data.filas.map((f) => f.conjunto)).toEqual(['A', 'B']);
    expect(VARIANTE_DIMENSIONADO.conjuntoPanos).toBe(true);
    // Sin el mapa la columna queda vacía.
    const sinMapa = construirCalculoGeneral(vents, {});
    expect(sinMapa.filas.every((f) => f.conjunto === '')).toBe(true);
  });
});
