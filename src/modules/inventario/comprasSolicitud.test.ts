import { describe, expect, it } from 'vitest';
import {
  agruparPorProveedor,
  enCamino,
  ESTADOS_SOLICITUD,
  etiquetaSolicitud,
  lineasParaSolicitud,
  sinCantidadParaPedir,
} from './comprasSolicitud';
import type { LineaOrden, OrdenCompra } from './compras';

// Los mismos ayudantes que el test de órdenes: una línea y una orden mínimas,
// para no repetir quince campos en cada caso.
const linea = (p: Partial<LineaOrden> = {}): LineaOrden => ({
  id: p.id ?? 'l1',
  posicion: p.posicion ?? 1,
  codigo_interno: p.codigo_interno ?? null,
  codigo_proveedor: p.codigo_proveedor ?? null,
  descripcion: p.descripcion ?? null,
  cantidad_pedida: p.cantidad_pedida ?? 10,
  unidad: p.unidad ?? null,
  dominio: p.dominio ?? 'insumo',
  item_cod: p.item_cod ?? null,
  factor: p.factor ?? 1,
  vinculo: p.vinculo ?? null,
  cantidad_recibida: p.cantidad_recibida ?? 0,
  estado_linea: p.estado_linea ?? 'pendiente',
  conflicto: p.conflicto ?? null,
  nota: p.nota ?? null,
});

const orden = (p: Partial<OrdenCompra> = {}): OrdenCompra => ({
  id: p.id ?? 'o1',
  numero: p.numero ?? 'OC-1016',
  estado: p.estado ?? 'en_espera',
  aprobada_en: '2026-09-09T12:13:00Z',
  lineas: p.lineas ?? [],
});

// ── De Alertas a la solicitud ────────────────────────────────────────

describe('lineasParaSolicitud', () => {
  it('arma la línea con la foto del momento', () => {
    expect(
      lineasParaSolicitud([
        {
          dominio: 'insumo',
          codigo: 'mec18',
          nombre: 'KIT 45 BLANCO',
          ahora: 2,
          minimo: 10,
          cantidad: 8,
          proveedor: ' CHANTILLY ',
          bajoMinimo: true,
        },
      ]),
    ).toEqual([
      {
        dominio: 'insumo',
        item_cod: 'MEC18',
        cantidad: 8,
        unidad: 'un',
        motivo: 'bajo_minimo',
        nombre: 'KIT 45 BLANCO',
        stock_al_pedir: 2,
        minimo_al_pedir: 10,
        proveedor_sugerido: 'CHANTILLY',
      },
    ]);
  });
  it('la tela se pide en metros', () => {
    const [l] = lineasParaSolicitud([{ dominio: 'tela', codigo: 'BK74', cantidad: 30.5 }]);
    expect(l.unidad).toBe('m');
    expect(l.cantidad).toBe(30.5);
  });
  it('descarta lo que no tiene cantidad: pedir 0 no es pedir', () => {
    expect(
      lineasParaSolicitud([
        { dominio: 'insumo', codigo: 'A1', cantidad: 0 },
        { dominio: 'insumo', codigo: 'A2', cantidad: -3 },
        { dominio: 'insumo', codigo: '   ', cantidad: 5 },
      ]),
    ).toEqual([]);
  });
  it('el mismo artículo dos veces queda UNA vez, con la cantidad mayor', () => {
    const r = lineasParaSolicitud([
      { dominio: 'insumo', codigo: 'A1', cantidad: 5 },
      { dominio: 'insumo', codigo: 'a1', cantidad: 12 },
      { dominio: 'insumo', codigo: 'A1', cantidad: 3 },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].cantidad).toBe(12);
  });
  it('el mismo código en insumo y en tela son DOS artículos distintos', () => {
    expect(
      lineasParaSolicitud([
        { dominio: 'insumo', codigo: 'X1', cantidad: 1 },
        { dominio: 'tela', codigo: 'X1', cantidad: 1 },
      ]),
    ).toHaveLength(2);
  });
  it('sin proveedor ni saldo, la línea sale igual', () => {
    expect(lineasParaSolicitud([{ dominio: 'insumo', codigo: 'A1', cantidad: 2 }])[0]).toEqual({
      dominio: 'insumo',
      item_cod: 'A1',
      cantidad: 2,
      unidad: 'un',
      motivo: 'manual',
    });
  });
});

describe('sinCantidadParaPedir', () => {
  it('avisa cuáles no tienen «dejar en» definido', () => {
    expect(
      sinCantidadParaPedir([
        { dominio: 'insumo', codigo: 'A1', cantidad: 0 },
        { dominio: 'insumo', codigo: 'A2', cantidad: 5 },
      ]),
    ).toEqual(['A1']);
  });
});

describe('agruparPorProveedor', () => {
  it('junta por proveedor y pone primero al que tiene más líneas', () => {
    const r = agruparPorProveedor([
      { id: '1', dominio: 'insumo', item_cod: 'A', cantidad: 1, proveedor_sugerido: 'CHANTILLY' },
      { id: '2', dominio: 'insumo', item_cod: 'B', cantidad: 1, proveedor_sugerido: 'SINFLEX' },
      { id: '3', dominio: 'insumo', item_cod: 'C', cantidad: 1, proveedor_sugerido: 'CHANTILLY' },
    ]);
    expect(r.map((g) => [g.proveedor, g.lineas.length])).toEqual([
      ['CHANTILLY', 2],
      ['SINFLEX', 1],
    ]);
  });
  it('lo que no tiene proveedor anotado se agrupa aparte, con nombre', () => {
    const r = agruparPorProveedor([
      { id: '1', dominio: 'insumo', item_cod: 'A', cantidad: 1, proveedor_sugerido: null },
      { id: '2', dominio: 'insumo', item_cod: 'B', cantidad: 1, proveedor_sugerido: '  ' },
    ]);
    expect(r).toEqual([{ proveedor: 'Sin proveedor anotado', lineas: r[0].lineas }]);
    expect(r[0].lineas).toHaveLength(2);
  });
});

// ── Qué viene en camino ──────────────────────────────────────────────

describe('enCamino', () => {
  it('suma lo pendiente de las órdenes abiertas, en unidades nuestras', () => {
    const r = enCamino([
      orden({
        estado: 'en_espera',
        lineas: [linea({ item_cod: 'MEC18', cantidad_pedida: 5, factor: 50 })],
      }),
      orden({
        id: 'o2',
        estado: 'recibida_parcial',
        lineas: [
          linea({ item_cod: 'mec18', cantidad_pedida: 10, cantidad_recibida: 4, factor: 1 }),
        ],
      }),
    ]);
    expect(r.get('insumo|MEC18')).toBe(256);
  });
  it('no cuenta las órdenes terminadas ni las líneas canceladas', () => {
    const r = enCamino([
      orden({ estado: 'recibida', lineas: [linea({ item_cod: 'A', cantidad_pedida: 9 })] }),
      orden({
        id: 'o2',
        estado: 'en_espera',
        lineas: [
          linea({ item_cod: 'B', cantidad_pedida: 9, estado_linea: 'cancelada' }),
          linea({ item_cod: 'C', cantidad_pedida: 9, estado_linea: 'faltante_aceptado' }),
        ],
      }),
    ]);
    expect(r.size).toBe(0);
  });
  it('una línea sin vincular no se puede contar contra ningún artículo', () => {
    const r = enCamino([
      orden({ estado: 'en_espera', lineas: [linea({ item_cod: null, cantidad_pedida: 9 })] }),
    ]);
    expect(r.size).toBe(0);
  });
});

describe('etiquetas de la solicitud', () => {
  it('cada estado tiene texto y color', () => {
    for (const e of Object.values(ESTADOS_SOLICITUD)) {
      expect(e.texto.length).toBeGreaterThan(0);
      expect(e.variante).toBeTruthy();
    }
  });
  it('un estado que la base traiga escrito de otra forma no rompe la tabla', () => {
    expect(etiquetaSolicitud('borrador').texto).toBe('Armando');
    expect(etiquetaSolicitud('inventado')).toEqual({ texto: 'inventado', variante: 'muted' });
    expect(etiquetaSolicitud(null)).toEqual({ texto: '—', variante: 'muted' });
  });
});
