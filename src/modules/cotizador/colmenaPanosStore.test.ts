import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente Supabase de mentira: encadena igual que el real (`from().select()
// .eq().eq().order().order().range()`) y devuelve la página que le toque.
const rangos: { desde: number; hasta: number }[] = [];
let filas: unknown[] = [];
let errorAlLeer: { message: string } | null = null;
const filtros: Record<string, unknown> = {};
const ordenes: string[] = [];

vi.mock('@/lib/supabase', () => {
  const consulta = {
    select: () => consulta,
    eq: (col: string, val: unknown) => {
      filtros[col] = val;
      return consulta;
    },
    order: (col: string) => {
      ordenes.push(col);
      return consulta;
    },
    range: (desde: number, hasta: number) => {
      rangos.push({ desde, hasta });
      if (errorAlLeer) return Promise.resolve({ data: null, error: errorAlLeer });
      return Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null });
    },
  };
  return { supabase: { from: () => consulta } };
});

import { cargarColmenaDisponible, cargarColmenaPanos } from './colmenaPanosStore';

const fila = (i: number) => ({
  id: `p${i}`,
  codigo: 'BK 18',
  medida_ancho: 219,
  medida_alto: 200,
  ubicacion: 'MAPA M1-20',
  tipo: 'SOBRANTE',
  disponible: true,
  ot_asignada: null,
  created_at: '2025-01-01T00:00:00Z',
  datos_extra: null,
});

beforeEach(() => {
  rangos.length = 0;
  ordenes.length = 0;
  for (const k of Object.keys(filtros)) delete filtros[k];
  filas = [];
  errorAlLeer = null;
});

describe('cargarColmenaDisponible', () => {
  it('pagina de a 1000 hasta traer la colmena completa', async () => {
    // 2.033 paños: lo que deja la reactivación de la colmena. Con un `select`
    // simple PostgREST devolvía 1.000 y el plan de corte veía media colmena.
    filas = Array.from({ length: 2033 }, (_, i) => fila(i));
    const todas = await cargarColmenaDisponible('emp-1');
    expect(todas).toHaveLength(2033);
    expect(rangos).toEqual([
      { desde: 0, hasta: 999 },
      { desde: 1000, hasta: 1999 },
      { desde: 2000, hasta: 2999 },
    ]);
  });

  it('corta apenas una página viene incompleta (no pide una de más)', async () => {
    filas = Array.from({ length: 12 }, (_, i) => fila(i));
    expect(await cargarColmenaDisponible('emp-1')).toHaveLength(12);
    expect(rangos).toHaveLength(1);
  });

  it('pide una segunda página cuando la primera viene EXACTA', async () => {
    filas = Array.from({ length: 1000 }, (_, i) => fila(i));
    expect(await cargarColmenaDisponible('emp-1')).toHaveLength(1000);
    expect(rangos).toHaveLength(2);
  });

  it('filtra por empresa y por disponible, y ordena estable para paginar', async () => {
    filas = [fila(0)];
    await cargarColmenaDisponible('emp-1');
    expect(filtros.empresa_id).toBe('emp-1');
    expect(filtros.disponible).toBe(true);
    expect(ordenes).toEqual(['created_at', 'id']);
  });

  it('propaga el error en vez de devolver media colmena', async () => {
    errorAlLeer = { message: 'timeout' };
    await expect(cargarColmenaDisponible('emp-1')).rejects.toMatchObject({ message: 'timeout' });
  });
});

describe('cargarColmenaPanos', () => {
  it('entrega los paños ya normalizados al tipo del motor', async () => {
    filas = [fila(0)];
    const [p] = await cargarColmenaPanos('emp-1');
    expect(p).toEqual({
      _docId: 'p0',
      cod: 'BK 18',
      ancho: 219,
      alto: 200,
      ubicacion: 'MAPA M1-20',
      tipo: 'SOBRANTE',
      creadoEn: '2025-01-01T00:00:00Z',
    });
  });
});
