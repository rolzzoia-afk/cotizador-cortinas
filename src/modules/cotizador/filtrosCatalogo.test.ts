import { describe, it, expect } from 'vitest';
import { CHIP_OTROS, FILTROS_CATALOGO, chipDeProducto, labelChip } from './filtrosCatalogo';
import type { CatalogoProductos, Producto } from './types';

const p = (cod: string, extra: Partial<Producto> = {}): Producto => ({
  cod,
  producto: 'X',
  tipo: 'PREMIUM',
  descripcion: '',
  precio: 0,
  ...extra,
});

describe('chipDeProducto — familias', () => {
  it('las familias de siempre caen donde siempre', () => {
    expect(chipDeProducto(p('BLACKOUT_P'), 'BK 18')).toBe('BK');
    expect(chipDeProducto(p('BLACKOUT_D'), 'BK 60')).toBe('BK');
    expect(chipDeProducto(p('BLACKOUT_S'), 'BK 50')).toBe('BK');
    expect(chipDeProducto(p('SCREEN_P'), 'SC 65')).toBe('SCR');
    expect(chipDeProducto(p('DUOBK_P'), 'DU 12')).toBe('DUO_BK');
    expect(chipDeProducto(p('DUOPOLI_P'), 'DU 07')).toBe('DUO_POLI');
  });

  it('una familia NUEVA de blackout/screen cae sola en su chip (antes quedaba sin chip)', () => {
    expect(chipDeProducto(p('BLACKOUT_X'), 'BK 99')).toBe('BK');
    expect(chipDeProducto(p('SCREEN_ECO'), 'SC 99')).toBe('SCR');
  });

  it('las verticales ganan sobre el chip general (BLACKOUT_V no es BK)', () => {
    expect(chipDeProducto(p('BLACKOUT_V_P'), 'BK 60-V')).toBe('BK_V');
    expect(chipDeProducto(p('BLACKOUT_V_NUEVA'), 'BK 99-V')).toBe('BK_V');
    expect(chipDeProducto(p('SCREEN_V_D'), 'SC 03-V')).toBe('SC_V');
  });

  it('el COD (familia) se compara sin importar mayúsculas ni espacios', () => {
    expect(chipDeProducto(p(' blackout_p '), 'BK 18')).toBe('BK');
  });
});

describe('chipDeProducto — COD_INT sueltos (motores, soft, oscura)', () => {
  it('el diccionario de COD_INT sigue mandando sobre la familia', () => {
    // Su `cod` es ACCESORIO, que no dice nada: el chip sale del COD_INT.
    expect(chipDeProducto(p('ACCESORIO'), 'DOM 42')).toBe('MOTOR_MG');
    expect(chipDeProducto(p('ACCESORIO'), 'DOM 01')).toBe('MOT');
    expect(chipDeProducto(p('ACCESORIO'), 'CENF O')).toBe('SOFT');
    expect(chipDeProducto(p('ACCESORIO'), 'P-DER')).toBe('OSCURA');
    expect(chipDeProducto(p('ACCESORIO'), 'MOT 01')).toBe('MOT_VERT');
    expect(chipDeProducto(p('ACCESORIO'), 'DOM 35')).toBe('MOTOR_GRANDE');
  });

  it('un COD_INT nuevo que el diccionario no conoce cae en OTROS, no desaparece', () => {
    expect(chipDeProducto(p('ACCESORIO'), 'DOM 43')).toBe(CHIP_OTROS);
    expect(chipDeProducto(p(''), 'INS 99')).toBe(CHIP_OTROS);
  });
});

describe('chipDeProducto — chip elegido a mano', () => {
  it('gana sobre el diccionario y sobre la familia', () => {
    // El motor nuevo que el automático manda a OTROS se fija a MOTOR MG.
    expect(chipDeProducto(p('ACCESORIO', { chip: 'MOTOR_MG' }), 'DOM 43')).toBe('MOTOR_MG');
    expect(chipDeProducto(p('BLACKOUT_P', { chip: 'SOFT' }), 'BK 18')).toBe('SOFT');
    expect(chipDeProducto(p('ACCESORIO', { chip: 'MOT' }), 'DOM 42')).toBe('MOT');
  });

  it('un chip inválido o vacío se ignora y vuelve al automático', () => {
    expect(chipDeProducto(p('BLACKOUT_P', { chip: 'NO_EXISTE' }), 'BK 18')).toBe('BK');
    expect(chipDeProducto(p('BLACKOUT_P', { chip: '' }), 'BK 18')).toBe('BK');
    expect(chipDeProducto(p('BLACKOUT_P', { chip: '   ' }), 'BK 18')).toBe('BK');
  });
});

describe('FILTROS_CATALOGO', () => {
  const catalogo: CatalogoProductos = {
    'BK 18': p('BLACKOUT_P'),
    'BK 60-V': p('BLACKOUT_V_P'),
    'SC 65': p('SCREEN_P'),
    'SC 03-V': p('SCREEN_V_D'),
    'DU 12': p('DUOBK_P'),
    'DU 07': p('DUOPOLI_P'),
    'DOM 42': p('ACCESORIO'),
    'CENF O': p('ACCESORIO'),
    'DOM 43': p('ACCESORIO'), // motor nuevo, sin chip todavía
    'TER 01': p('TERMICO_P'), // familia inédita
    'MOT MG X': p('ACCESORIO', { chip: 'MOTOR_MG' }),
  };

  it('cada producto matchea EXACTAMENTE un chip (partición, sin huecos ni duplicados)', () => {
    for (const [ci, prod] of Object.entries(catalogo)) {
      const chips = FILTROS_CATALOGO.filter((f) => f.match(prod, ci)).map((f) => f.id);
      expect(chips, `${ci} debería caer en un solo chip`).toHaveLength(1);
    }
  });

  it('el chip Otros junta lo que no calza en ninguno', () => {
    const otros = Object.entries(catalogo)
      .filter(([ci, prod]) => chipDeProducto(prod, ci) === CHIP_OTROS)
      .map(([ci]) => ci);
    expect(otros.sort()).toEqual(['DOM 43', 'TER 01']);
  });

  it('Otros es el último chip de la lista y tiene label legible', () => {
    expect(FILTROS_CATALOGO[FILTROS_CATALOGO.length - 1].id).toBe(CHIP_OTROS);
    expect(labelChip(CHIP_OTROS)).toBe('Otros');
    expect(labelChip('BK_V')).toBe('BK VERT');
    expect(labelChip('NO_EXISTE')).toBe('NO_EXISTE');
  });

  it('todos los chips conservan su id y color por defecto (los overrides por empresa siguen)', () => {
    for (const f of FILTROS_CATALOGO) {
      expect(f.id).toMatch(/^[A-Z_]+$/);
      expect(f.hexDefault).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
