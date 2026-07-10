import { describe, it, expect } from 'vitest';
import {
  aplicarVariante,
  construirCalculoGeneral,
  VARIANTE_DIMENSIONADO,
} from './pdfCalculoGeneral';
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
    // Pero no toca otros componentes.
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CIERRE DE ALTURA')).toBe(false);
    expect(VARIANTE_DIMENSIONADO.sinDespiece?.('CENEFA DELANTERA')).toBe(false);
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
