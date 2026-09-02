import { describe, expect, it } from 'vitest';
import {
  ordenarCola,
  parseLoteRow,
  resumenLote,
  rowACola,
  type FilaCola,
  type ItemCola,
} from './lotes';

const fila = (extra: Partial<FilaCola> & { dg?: Record<string, unknown> } = {}): FilaCola => ({
  id: extra.id ?? 'uuid-1',
  numero_ot: extra.numero_ot ?? '3189',
  datos_generales: extra.dg ?? { cliente: 'ANA', ot: '3189' },
  fecha_entrega: extra.fecha_entrega ?? null,
});

const item = (p: Partial<ItemCola>): ItemCola => ({
  id: p.id ?? 'x',
  numero: p.numero ?? '1',
  numeroOt: p.numeroOt ?? p.numero ?? '1',
  cliente: p.cliente ?? 'CLIENTE',
  subEtapa: p.subEtapa ?? null,
  fechaEntrega: p.fechaEntrega ?? null,
  sinCorteTela: p.sinCorteTela ?? false,
});

describe('rowACola', () => {
  it('una OT huérfana (sin cliente y sin número) no entra a la cola', () => {
    expect(rowACola(fila({ dg: {} }))).toBeNull();
    expect(rowACola(fila({ dg: { cliente: '  ', ot: '' } }))).toBeNull();
  });

  it('el número que se MUESTRA sale de datos_generales; el de BUSCAR, de la columna', () => {
    // No siempre coinciden, y el buscador de Producción matchea EXACTO contra
    // `numero_ot`: si la tarjeta abriera con el número de datos_generales, la
    // OT «no estaría en el sistema».
    const it = rowACola(fila({ numero_ot: '3189', dg: { cliente: 'ANA', ot: '3189-B' } }))!;
    expect(it.numero).toBe('3189-B');
    expect(it.numeroOt).toBe('3189');
  });

  it('sin número en datos_generales usa el de la columna', () => {
    const it = rowACola(fila({ numero_ot: '3200', dg: { cliente: 'LUIS' } }))!;
    expect(it.numero).toBe('3200');
    expect(it.cliente).toBe('LUIS');
  });

  it('la sub-etapa vive en datos_generales, no en una columna', () => {
    expect(rowACola(fila({ dg: { cliente: 'ANA', subEtapa: 'Armado' } }))!.subEtapa).toBe('Armado');
    expect(rowACola(fila())!.subEtapa).toBeNull();
  });

  it('«tela sin cortar» = la OT todavía no confirmó el corte general', () => {
    expect(rowACola(fila())!.sinCorteTela).toBe(true);
    const cortada = rowACola(
      fila({ dg: { cliente: 'ANA', corteGeneralColmena: { piezas: [] } } }),
    )!;
    expect(cortada.sinCorteTela).toBe(false);
  });

  it('la fecha de entrega sale de la columna y, si falta, de datos_generales', () => {
    expect(rowACola(fila({ fecha_entrega: '2026-09-10' }))!.fechaEntrega).toBe('2026-09-10');
    expect(
      rowACola(fila({ dg: { cliente: 'ANA', fechaEntrega: '2026-09-12' } }))!.fechaEntrega,
    ).toBe('2026-09-12');
  });
});

describe('ordenarCola', () => {
  it('los grupos van en el orden real del taller, y lo que no tiene sub-etapa al final', () => {
    const grupos = ordenarCola([
      item({ id: 'a', subEtapa: 'Armado' }),
      item({ id: 'b', subEtapa: null }),
      item({ id: 'c', subEtapa: 'Estructura' }),
      item({ id: 'd', subEtapa: 'Dimensionado' }),
    ]);
    expect(grupos.map((g) => g.subEtapa)).toEqual([
      'Estructura',
      'Dimensionado',
      'Armado',
      null,
    ]);
  });

  it('dentro del grupo manda la fecha de entrega; sin fecha, al final', () => {
    const [g] = ordenarCola([
      item({ id: '1', numero: '10', subEtapa: 'Armado', fechaEntrega: null }),
      item({ id: '2', numero: '20', subEtapa: 'Armado', fechaEntrega: '2026-09-20' }),
      item({ id: '3', numero: '30', subEtapa: 'Armado', fechaEntrega: '2026-09-02' }),
    ]);
    expect(g.items.map((i) => i.numero)).toEqual(['30', '20', '10']);
  });

  it('sin fechas desempata el número, no el orden de llegada', () => {
    const [g] = ordenarCola([
      item({ id: '1', numero: '3200', subEtapa: 'Paños' }),
      item({ id: '2', numero: '3189', subEtapa: 'Paños' }),
    ]);
    expect(g.items.map((i) => i.numero)).toEqual(['3189', '3200']);
  });
});

describe('parseLoteRow', () => {
  it('lee una fila normal', () => {
    const lote = parseLoteRow({
      id: 'l1',
      nombre: 'Corte 01/09',
      ots: [
        { id: 'o1', numero: '3189-B', numeroOt: '3189' },
        { id: 'o2', numero: '3190', numeroOt: '3190' },
      ],
      creado_por: 'Jefe',
      creado_en: '2026-09-01T10:00:00Z',
    })!;
    expect(lote.nombre).toBe('Corte 01/09');
    expect(lote.ots.map((o) => o.numero)).toEqual(['3189-B', '3190']);
    expect(lote.ots.map((o) => o.numeroOt)).toEqual(['3189', '3190']);
    expect(lote.creadoPor).toBe('Jefe');
  });

  it('un lote viejo sin `numeroOt` cae al número que muestra (así se abre igual)', () => {
    const lote = parseLoteRow({
      id: 'l1',
      nombre: 'Corte 1/9',
      ots: [{ id: 'o1', numero: '267-10' }],
    })!;
    expect(lote.ots[0].numeroOt).toBe('267-10');
  });

  it('basura en el jsonb no rompe la pantalla del taller', () => {
    expect(parseLoteRow(null)).toBeNull();
    expect(parseLoteRow('lote')).toBeNull();
    expect(parseLoteRow({ id: 'l1' })).toBeNull(); // sin nombre
    const lote = parseLoteRow({
      id: 'l1',
      nombre: 'X',
      ots: ['basura', null, { numero: 'sin id' }, { id: 'o1' }],
    })!;
    expect(lote.ots).toEqual([{ id: 'o1', numero: 'o1', numeroOt: 'o1' }]);
  });

  it('`ots` que no es lista queda vacío en vez de reventar', () => {
    expect(parseLoteRow({ id: 'l1', nombre: 'X', ots: { a: 1 } })!.ots).toEqual([]);
  });
});

describe('resumenLote', () => {
  it('marca las OTs del lote que ya no están en producción', () => {
    const lote = parseLoteRow({
      id: 'l1',
      nombre: 'X',
      ots: [
        { id: 'o1', numero: '3189' },
        { id: 'o2', numero: '3190' },
      ],
    })!;
    const res = resumenLote(lote, [item({ id: 'o1', sinCorteTela: true })]);
    expect(res.total).toBe(2);
    expect(res.fuera.map((f) => f.numero)).toEqual(['3190']);
    expect(res.sinCorteTela).toBe(1);
  });

  it('una OT fuera de producción NO se cuenta como «sin cortar tela»', () => {
    const lote = parseLoteRow({ id: 'l1', nombre: 'X', ots: [{ id: 'o9', numero: '9' }] })!;
    expect(resumenLote(lote, []).sinCorteTela).toBe(0);
  });
});
