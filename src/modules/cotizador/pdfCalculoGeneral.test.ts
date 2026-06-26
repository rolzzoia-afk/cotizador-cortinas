import { describe, it, expect } from 'vitest';
import { construirCalculoGeneral } from './pdfCalculoGeneral';
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
    expect(f.codMecanismo).toBe('MEC_14_LZ50_SINFLEX_BLANCO');
    expect(f.accionamiento).toBe('[CAD 05] 4MT');
    expect(f.pesoCadena).toBe('[PCA 04] TRANSPARENTE');
    // Despiece del mismo motor: tubo = ancho − 2, peso = tubo − 0,4, tela = peso − 0,1.
    expect(f.despiece.get('TUBO')).toBe(172.5);
    expect(f.despiece.get('PESO')).toBe(172.1);
    expect(f.despiece.get('TELA (ANCHO)')).toBe(172); // peso − 0.1
  });

  it('arma un bloque ROLLER con las columnas que tienen datos', () => {
    const data = construirCalculoGeneral([ventRoller(1.745, 'A'), ventRoller(1.49, 'B')]);
    expect(data.bloques).toHaveLength(1);
    expect(data.bloques[0].sistema.key).toBe('ROLLER');
    const labels = data.bloques[0].columnas.map((c) => c.label);
    expect(labels).toContain('TUBO');
    expect(labels).toContain('PESO');
    expect(labels).toContain('TELA (ANCHO)');
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
