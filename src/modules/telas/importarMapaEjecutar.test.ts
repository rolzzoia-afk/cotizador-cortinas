import { describe, it, expect } from 'vitest';
import { ejecutarPlanMapa, type ClienteMapa } from './importarMapaEjecutar';
import type { PlanAplicacion, PanoInsertMapa, PanoUpdateMapa, PanoBajaMapa } from './importarMapa';

type Behavior = {
  failInsertChunkIdx?: number;
  bajaNoAfecta?: string[]; // ids cuya baja devuelve 0 filas
  updateError?: string[]; // ids cuyo update falla
};

function makeFake(behavior: Behavior = {}) {
  const timeline: string[] = [];
  const log = { insertChunks: [] as number[], updates: [] as string[], bajas: [] as string[] };
  let insertIdx = 0;

  const client: ClienteMapa = {
    from() {
      return {
        insert(rows: unknown[]) {
          const idx = insertIdx++;
          log.insertChunks.push(rows.length);
          timeline.push('insert');
          const fail = behavior.failInsertChunkIdx === idx;
          return Promise.resolve({ error: fail ? { message: 'insert boom' } : null });
        },
        update(vals: Record<string, unknown>) {
          const isBaja = vals.disponible === false;
          const eqs: [string, unknown][] = [];
          const builder = {
            eq(col: string, val: unknown) {
              eqs.push([col, val]);
              return builder;
            },
            select() {
              const id = String(eqs.find((e) => e[0] === 'id')?.[1] ?? '');
              if (isBaja) {
                log.bajas.push(id);
                timeline.push('baja');
                const afecta = !behavior.bajaNoAfecta?.includes(id);
                return Promise.resolve({ data: afecta ? [{ id }] : [], error: null });
              }
              log.updates.push(id);
              timeline.push('update');
              const err = behavior.updateError?.includes(id);
              return Promise.resolve({
                data: err ? null : [{ id }],
                error: err ? { message: 'update boom' } : null,
              });
            },
          };
          return builder;
        },
      };
    },
  };
  return { client, log, timeline };
}

function mkPlan(over: Partial<PlanAplicacion> = {}): PlanAplicacion {
  return { inserts: [], updates: [], bajas: [], fuente: 'IMPORT_MAPA_2026-07-13', ...over };
}
const ins = (n: number): PanoInsertMapa[] =>
  Array.from({ length: n }, (_, i) => ({
    empresa_id: 'E1',
    codigo: `BK ${i}`,
    medida_ancho: 100,
    medida_alto: 100,
    disponible: true,
    tipo: 'SOBRANTE',
    ubicacion: `MAPA M1-${i}`,
    datos_extra: {},
  }));
const upd = (ids: string[]): PanoUpdateMapa[] =>
  ids.map((id) => ({ id, codigo: 'SC 1', medida_ancho: 1, medida_alto: 1, datos_extra: {} }));
const baj = (ids: string[]): PanoBajaMapa[] => ids.map((id) => ({ id, datos_extra: {} }));

describe('ejecutarPlanMapa', () => {
  it('trocea 250 inserts en chunks de 100', async () => {
    const { client, log } = makeFake();
    const res = await ejecutarPlanMapa(client, mkPlan({ inserts: ins(250) }));
    expect(log.insertChunks).toEqual([100, 100, 50]);
    expect(res.insertados).toBe(250);
    expect(res.errores).toHaveLength(0);
  });

  it('orden estricto: inserts → updates → bajas', async () => {
    const { client, timeline } = makeFake();
    await ejecutarPlanMapa(
      client,
      mkPlan({ inserts: ins(1), updates: upd(['u1']), bajas: baj(['b1']) }),
    );
    const iIns = timeline.lastIndexOf('insert');
    const iUpd = timeline.indexOf('update');
    const iBaja = timeline.indexOf('baja');
    expect(iIns).toBeLessThan(iUpd);
    expect(iUpd).toBeLessThan(iBaja);
  });

  it('un chunk de insert falla: continúa y reporta, y aún ejecuta updates', async () => {
    const { client, log } = makeFake({ failInsertChunkIdx: 1 });
    const res = await ejecutarPlanMapa(
      client,
      mkPlan({ inserts: ins(250), updates: upd(['u1', 'u2']) }),
    );
    expect(res.insertados).toBe(150); // chunks 0 y 2
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toMatchObject({ fase: 'insert', filas: 100 });
    expect(res.actualizados).toBe(2);
    expect(log.updates).toEqual(['u1', 'u2']);
  });

  it('baja sin filas afectadas → bajasOmitidas, no error', async () => {
    const { client } = makeFake({ bajaNoAfecta: ['b2'] });
    const res = await ejecutarPlanMapa(client, mkPlan({ bajas: baj(['b1', 'b2', 'b3']) }));
    expect(res.dadosDeBaja).toBe(2);
    expect(res.bajasOmitidas).toBe(1);
    expect(res.errores).toHaveLength(0);
  });

  it('update con error se registra por fila', async () => {
    const { client } = makeFake({ updateError: ['u2'] });
    const res = await ejecutarPlanMapa(client, mkPlan({ updates: upd(['u1', 'u2', 'u3']) }));
    expect(res.actualizados).toBe(2);
    expect(res.errores).toHaveLength(1);
    expect(res.errores[0]).toMatchObject({ fase: 'update', filas: 1 });
  });
});
