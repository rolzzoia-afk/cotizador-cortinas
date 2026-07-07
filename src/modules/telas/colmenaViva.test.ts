import { describe, it, expect } from 'vitest';
import {
  tipoDeCodigo,
  claveCelda,
  agruparMapa,
  agruparPorZona,
  zonaDe,
  slotGalpon,
  agruparSlots,
  tipoDominante,
  diasEnColmena,
  estadoColmena,
  enAlerta,
} from './colmenaViva';
import type { ColmenaPano } from '@/modules/admin/colmena';

function pano(p: Partial<ColmenaPano>): ColmenaPano {
  return {
    id: p.id ?? 'x',
    empresa_id: 'e',
    codigo: p.codigo ?? null,
    medida_ancho: p.medida_ancho ?? 100,
    medida_alto: p.medida_alto ?? 100,
    disponible: p.disponible ?? true,
    ot_asignada: p.ot_asignada ?? null,
    fecha_uso: p.fecha_uso ?? null,
    created_at: p.created_at ?? null,
    ubicacion: p.ubicacion,
    datos_extra: p.datos_extra,
  };
}

describe('tipoDeCodigo', () => {
  it('toma el prefijo del código', () => {
    expect(tipoDeCodigo('BK 07')).toBe('BK');
    expect(tipoDeCodigo('du 31')).toBe('DU');
    expect(tipoDeCodigo('SC 65')).toBe('SC');
    expect(tipoDeCodigo('TR 01')).toBe('TR');
  });
  it('desconocidos y vacíos → OTRO', () => {
    expect(tipoDeCodigo('ZZ 9')).toBe('OTRO');
    expect(tipoDeCodigo(null)).toBe('OTRO');
    expect(tipoDeCodigo('')).toBe('OTRO');
  });
});

describe('claveCelda', () => {
  it('arma la clave fila-col', () => {
    expect(claveCelda(1, 2)).toBe('1-2');
  });
});

describe('agruparMapa', () => {
  it('reconstruye racks ordenados con rango de filas/cols contiguo y lookup', () => {
    const { racks } = agruparMapa([
      pano({ id: '1', codigo: 'SC 73', datos_extra: { rack: '2', m: '1', col: '10' } }),
      pano({ id: '2', codigo: 'DU 31', datos_extra: { rack: 2, m: 1, col: 11 } }),
      pano({ id: '3', codigo: 'BK 61', datos_extra: { rack: 1, m: 1, col: 2 } }),
      pano({ id: '4', codigo: 'SC 92', datos_extra: { rack: 1, m: 5, col: 2 } }),
    ]);
    expect(racks.map((r) => r.rack)).toEqual([1, 2]);

    const r1 = racks.find((r) => r.rack === 1)!;
    // dos paños en col 2, filas 1 y 5 → rango contiguo de filas 1..5
    expect(r1.filas).toEqual([1, 2, 3, 4, 5]);
    expect(r1.cols).toEqual([2]);
    expect(r1.celdas.get(claveCelda(1, 2))?.id).toBe('3');
    expect(r1.celdas.get(claveCelda(5, 2))?.id).toBe('4');
    expect(r1.celdas.get(claveCelda(3, 2))).toBeUndefined();

    const r2 = racks.find((r) => r.rack === 2)!;
    expect(r2.cols).toEqual([10, 11]);
    expect(r2.celdas.get(claveCelda(1, 10))?.codigo).toBe('SC 73');
  });

  it('separa como huérfanos los paños sin coordenada válida (incluido rack null → NO Rack 0)', () => {
    const { racks, huerfanos } = agruparMapa([
      pano({ id: '1', codigo: 'BK 61', datos_extra: { rack: 1, m: 1, col: 2 } }),
      pano({ id: '2', codigo: 'BK 02', ubicacion: 'MAPA F73', datos_extra: { col: 5 } }),
      pano({ id: '3', codigo: 'SC 01', datos_extra: null }),
      // rack null/0: Number(null)===0 → antes creaba un "Rack 0" fantasma
      pano({ id: '4', codigo: 'BK 02', datos_extra: { rack: null, m: null, col: 5 } }),
      pano({ id: '5', codigo: 'BK 03', datos_extra: { rack: 0, m: 1, col: 1 } }),
    ]);
    expect(racks.map((r) => r.rack)).toEqual([1]); // ni 0 ni negativos
    expect(huerfanos.map((p) => p.id).sort()).toEqual(['2', '3', '4', '5']);
  });
});

describe('zonaDe / agruparPorZona', () => {
  it('asume GALPON si falta zona', () => {
    expect(zonaDe(pano({ datos_extra: { rack: 1 } }))).toBe('GALPON');
    expect(zonaDe(pano({ datos_extra: { zona: 'LIBERADO', rack: 1 } }))).toBe('LIBERADO');
  });

  it('separa zonas (orden GALPON, LIBERADO, ROLZZO) con el modo correcto', () => {
    const zonas = agruparPorZona([
      pano({ id: '1', codigo: 'BK 61', datos_extra: { zona: 'GALPON', rack: 1, m: 1, col: 2 } }),
      pano({ id: '2', codigo: 'DU 10', datos_extra: { zona: 'LIBERADO', rack: 1, m: 1, col: 1 } }),
      pano({ id: '3', codigo: 'BK 07', ubicacion: 'A-19', datos_extra: { zona: 'ROLZZO' } }),
      // sin zona → GALPON
      pano({ id: '4', codigo: 'BK 02', datos_extra: { rack: 2, m: 1, col: 5 } }),
    ]);
    expect(zonas.map((z) => z.zona)).toEqual(['GALPON', 'LIBERADO', 'ROLZZO']);
    const galpon = zonas.find((z) => z.zona === 'GALPON');
    expect(galpon?.modo).toBe('grid');
    if (galpon?.modo === 'grid') expect(galpon.racks.map((r) => r.rack)).toEqual([1, 2]);
    const rolzzo = zonas.find((z) => z.zona === 'ROLZZO');
    expect(rolzzo?.modo).toBe('slots');
    if (rolzzo?.modo === 'slots') expect(rolzzo.sectores[0].pref).toBe('A');
  });
});

describe('slotGalpon', () => {
  it('parsea estantes A/B/VR con padding', () => {
    expect(slotGalpon('A-19')).toEqual({ pref: 'A', num: 19, slot: 'A19' });
    expect(slotGalpon('VR - 5')).toEqual({ pref: 'VR', num: 5, slot: 'VR05' });
    expect(slotGalpon('b-88')).toEqual({ pref: 'B', num: 88, slot: 'B88' });
  });
  it('null si no calza', () => {
    expect(slotGalpon('sin numero')).toBeNull();
    expect(slotGalpon(null)).toBeNull();
  });
});

describe('agruparSlots', () => {
  it('agrupa por sector (A,B,VR) y estante, multi-tela, y separa huérfanos', () => {
    const { sectores, huerfanos } = agruparSlots([
      pano({ id: '1', codigo: 'BK 60', ubicacion: 'A-52' }),
      pano({ id: '2', codigo: 'BK 61', ubicacion: 'A-52' }), // mismo estante
      pano({ id: '3', codigo: 'SC 23', ubicacion: 'B-30' }),
      pano({ id: '4', codigo: 'BK 18', ubicacion: 'VR-7' }),
      pano({ id: '5', codigo: 'XX', ubicacion: 'sin-formato' }), // huérfano
    ]);
    expect(sectores.map((s) => s.pref)).toEqual(['A', 'B', 'VR']);
    const a = sectores.find((s) => s.pref === 'A')!;
    expect(a.slots).toHaveLength(1);
    expect(a.slots[0].slot).toBe('A52');
    expect(a.slots[0].panos.map((p) => p.id)).toEqual(['1', '2']); // dos telas
    expect(huerfanos.map((p) => p.id)).toEqual(['5']);
  });
});

describe('tipoDominante', () => {
  it('devuelve el tipo más frecuente; vacío → OTRO', () => {
    expect(
      tipoDominante([pano({ codigo: 'BK 1' }), pano({ codigo: 'BK 2' }), pano({ codigo: 'SC 1' })]),
    ).toBe('BK');
    expect(tipoDominante([])).toBe('OTRO');
  });
});

describe('diasEnColmena / estadoColmena / enAlerta', () => {
  const HOY = '2026-06-26T00:00:00Z';

  it('cuenta días desde fecha_origen, luego creadoEn, luego created_at', () => {
    expect(diasEnColmena(pano({ datos_extra: { fecha_origen: '2026-06-16' } }), HOY)).toBe(10);
    expect(diasEnColmena(pano({ datos_extra: { creadoEn: '2026-06-21T00:00:00Z' } }), HOY)).toBe(5);
    expect(diasEnColmena(pano({ created_at: '2026-06-24T00:00:00Z' }), HOY)).toBe(2);
  });

  it('null si no hay ninguna fecha', () => {
    expect(diasEnColmena(pano({}), HOY)).toBeNull();
  });

  it('estado: activa / alerta (>90d) / usada / baja', () => {
    expect(estadoColmena(pano({ datos_extra: { fecha_origen: '2026-06-01' } }), HOY).estado).toBe('activa');
    expect(estadoColmena(pano({ datos_extra: { fecha_origen: '2026-01-01' } }), HOY).estado).toBe('alerta');
    expect(estadoColmena(pano({ disponible: false }), HOY).estado).toBe('usada');
    expect(
      estadoColmena(pano({ disponible: false, datos_extra: { baja: true } }), HOY).estado,
    ).toBe('baja');
  });

  it('enAlerta solo para disponibles con más de 90 días', () => {
    expect(enAlerta(pano({ datos_extra: { fecha_origen: '2026-01-01' } }), HOY)).toBe(true);
    expect(enAlerta(pano({ disponible: false, datos_extra: { fecha_origen: '2026-01-01' } }), HOY)).toBe(false);
    expect(enAlerta(pano({ datos_extra: { fecha_origen: '2026-06-20' } }), HOY)).toBe(false);
  });

  it('diasAlerta custom cambia el umbral (parámetro de corte)', () => {
    const p = pano({ datos_extra: { fecha_origen: '2026-06-16' } }); // 10 días
    expect(enAlerta(p, HOY)).toBe(false); // default 90
    expect(enAlerta(p, HOY, 7)).toBe(true);
    expect(estadoColmena(p, HOY, 7).estado).toBe('alerta');
  });
});
