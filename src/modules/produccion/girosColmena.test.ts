import { describe, expect, it, vi } from 'vitest';
import { pieceId } from '@/modules/cotizador/hojaCorte';

// El módulo trae el hook, que abre el cliente Supabase al importarse: sin las
// llaves del entorno (la CI no las tiene) reventaba antes de correr un test.
// Acá solo se prueba lo PURO, así que el cliente puede ser de mentira.
vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { AREA_GIRO, REF_GIRO, otIdDePieza } from './girosColmena';

describe('otIdDePieza — de qué OT es una cortina del plan', () => {
  it('devuelve el uuid con el que se armó el pieceId', () => {
    const id = pieceId('67c635a5-152c-4780-a066-23f5081175a9', 'v-1', 0);
    expect(otIdDePieza(id)).toBe('67c635a5-152c-4780-a066-23f5081175a9');
  });

  it('un id de ventana con guiones no rompe el corte (los uuid no llevan «_»)', () => {
    expect(otIdDePieza(pieceId('ot-3213', 'ventana-con-guiones-4', 2))).toBe('ot-3213');
  });

  it('una llave vacía no revienta: devuelve cadena vacía', () => {
    expect(otIdDePieza('')).toBe('');
  });
});

describe('dónde se guardan las autorizaciones de giro', () => {
  it('van al área «panos», que ya existe en el CHECK de produccion_checks', () => {
    expect(AREA_GIRO).toBe('panos');
  });

  it('llevan un ref propio: así `useChecks` no las cuenta como cortinas hechas', () => {
    // `useChecks` descarta las filas cuyo `ref` no calza con el suyo (''), así
    // que estas filas no ensucian el avance de la vista Paños.
    expect(REF_GIRO).toBe('giro');
    expect(REF_GIRO).not.toBe('');
  });
});
