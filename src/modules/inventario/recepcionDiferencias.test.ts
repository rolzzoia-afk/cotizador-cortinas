import { describe, expect, it } from 'vitest';
import type { LineaOrden, OrdenCompra } from './compras';
import type { LineaConteo } from './recepcion';
import {
  diferenciasDeRecepcion,
  resultadoDeDiferencias,
  resumenConteo,
  type Diferencia,
} from './recepcionDiferencias';

function linea(p: Partial<LineaOrden> & { id: string }): LineaOrden {
  return {
    posicion: 1,
    cantidad_pedida: 1,
    factor: 1,
    cantidad_recibida: 0,
    estado_linea: 'pendiente',
    dominio: 'insumo',
    item_cod: 'E42',
    ...p,
  };
}

const ORDEN: OrdenCompra = {
  id: 'oc',
  numero: 'OC-1015',
  estado: 'en_espera',
  proveedor_rut: '78.762.290-9',
  lineas: [
    linea({ id: 'bk', posicion: 1, dominio: 'tela', item_cod: 'BK 43', cantidad_pedida: 2 }),
    linea({ id: 'e42', posicion: 2, item_cod: 'E42', cantidad_pedida: 2 }),
  ],
};

function conteo(p: Partial<LineaConteo> & { id: string }): LineaConteo {
  return {
    posicion: 1,
    origen: 'factura',
    fact_codigo: null,
    fact_descripcion: null,
    fact_cantidad: 1,
    orden_linea_id: null,
    dominio: 'insumo',
    item_cod: 'E42',
    factor: 1,
    accion: 'recibir',
    motivo_exclusion: null,
    cantidad_buena: 0,
    cantidad_danada: 0,
    nota: null,
    fotos: [],
    ...p,
  };
}

/** El caso de todos los días: llegó todo lo facturado y lo facturado es lo pedido. */
const TODO_BIEN = [
  conteo({ id: 'l1', posicion: 1, orden_linea_id: 'bk', dominio: 'tela', item_cod: 'BK 43', fact_cantidad: 2, cantidad_buena: 2 }),
  conteo({ id: 'l2', posicion: 2, orden_linea_id: 'e42', fact_cantidad: 2, cantidad_buena: 2 }),
];

const tipos = (d: Diferencia[]) => d.map((x) => `${x.tipo}:${x.gravedad}`);

describe('diferencias', () => {
  it('todo bien: ninguna diferencia y resultado ok', () => {
    const d = diferenciasDeRecepcion(TODO_BIEN, ORDEN);
    expect(d).toEqual([]);
    expect(resultadoDeDiferencias(d, true)).toBe('ok');
  });

  it('faltante y dañado son errores, con el texto listo para Gerencia', () => {
    const d = diferenciasDeRecepcion(
      [
        conteo({ id: 'l1', posicion: 3, fact_descripcion: 'RO ROLLER BLACKOUT C17BO-4', orden_linea_id: 'bk', dominio: 'tela', item_cod: 'BK 43', fact_cantidad: 2, cantidad_buena: 1.5 }),
        conteo({ id: 'l2', posicion: 4, orden_linea_id: 'e42', fact_cantidad: 2, cantidad_buena: 1, cantidad_danada: 1, nota: 'caja mojada', fotos: ['e/f.jpg'] }),
      ],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['faltante:error', 'danado:error']);
    expect(d[0].texto).toBe('Línea 3 «RO ROLLER BLACKOUT C17BO-4»: facturados 2, contados 1,5 (faltan 0,5).');
    expect(d[1]).toMatchObject({ linea_id: 'l2', nota: 'caja mojada', fotos: ['e/f.jpg'], contado: 2 });
    expect(d[1].texto).toMatch(/: 1 llegó dañado y no entró al stock\.$/);
    expect(resultadoDeDiferencias(d, true)).toBe('con_diferencias');
  });

  it('contar de más que lo facturado es sobrante', () => {
    const d = diferenciasDeRecepcion(
      [TODO_BIEN[0], conteo({ ...TODO_BIEN[1], cantidad_buena: 3 })],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['sobrante:error']);
    expect(d[0].texto).toMatch(/sobran 1\)/);
  });

  it('lo que llegó sin facturar es sobrante', () => {
    const d = diferenciasDeRecepcion(
      [...TODO_BIEN, conteo({ id: 'n', nueva: true, posicion: 3, origen: 'manual', orden_linea_id: 'e42', fact_cantidad: 0, cantidad_buena: 1 })],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['sobrante:error']);
    expect(d[0].linea_id).toBeNull();
    expect(d[0].texto).toBe('E42: llegaron 1 que no están en el documento.');
  });

  it('entrega parcial: facturado menos que lo pedido es AVISO y el resultado sigue ok', () => {
    const d = diferenciasDeRecepcion(
      [conteo({ ...TODO_BIEN[0], fact_cantidad: 1, cantidad_buena: 1 })],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['facturado_de_menos:aviso', 'facturado_de_menos:aviso']);
    expect(d[0].texto).toBe('BK 43 (línea 1 de la orden): se facturaron 1 de 2 que faltaban (entrega parcial).');
    expect(d[1].texto).toBe('E42 (línea 2 de la orden): no viene en este documento; siguen faltando 2.');
    expect(resultadoDeDiferencias(d, true)).toBe('ok');
  });

  it('dos líneas del papel sobre la misma de la orden se suman antes de comparar', () => {
    const d = diferenciasDeRecepcion(
      [
        conteo({ id: 'a', posicion: 1, orden_linea_id: 'e42', fact_cantidad: 1, cantidad_buena: 1 }),
        conteo({ id: 'b', posicion: 2, orden_linea_id: 'e42', fact_cantidad: 2, cantidad_buena: 2 }),
        TODO_BIEN[0],
      ],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['facturado_de_mas:error']);
    expect(d[0].texto).toBe('E42 (línea 2 de la orden): se facturaron 3 y faltaban 2.');
  });

  it('recibir algo que la orden no pide es error', () => {
    const d = diferenciasDeRecepcion(
      [...TODO_BIEN, conteo({ id: 'z', posicion: 3, fact_descripcion: 'TELA RARA', dominio: 'tela', item_cod: 'SC 29', fact_cantidad: 1, cantidad_buena: 1 })],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['facturado_no_pedido:error']);
    expect(d[0].texto).toBe('Línea 3 «TELA RARA»: se recibió como SC 29 y la orden no lo pide.');
  });

  it('lo excluido: «no es inventario» avisa, «no se sabe qué es» es error', () => {
    const d = diferenciasDeRecepcion(
      [
        ...TODO_BIEN,
        conteo({ id: 'f', posicion: 3, fact_descripcion: 'FLETE', accion: 'excluir', motivo_exclusion: 'no_inventario' }),
        conteo({ id: 'q', posicion: 4, fact_descripcion: 'XJ-77', accion: 'excluir', motivo_exclusion: 'no_identificado' }),
      ],
      ORDEN,
    );
    expect(tipos(d)).toEqual(['excluida:aviso', 'no_identificado:error']);
    expect(d[0].texto).toBe('Línea 3 «FLETE»: no es inventario.');
  });

  it('RUT distinto al de la orden es error; escrito de otra forma no', () => {
    expect(tipos(diferenciasDeRecepcion(TODO_BIEN, ORDEN, { rutFactura: '78762290-9' }))).toEqual([]);
    const d = diferenciasDeRecepcion(TODO_BIEN, ORDEN, { rutFactura: '77.704.530-K' });
    expect(tipos(d)).toEqual(['rut_distinto:error']);
  });

  it('sin orden: una sola diferencia sin_orden y resultado sin_orden', () => {
    const d = diferenciasDeRecepcion([conteo({ id: 'a', fact_cantidad: 3, cantidad_buena: 3 })], null);
    expect(tipos(d)).toEqual(['sin_orden:error']);
    expect(resultadoDeDiferencias(d, false)).toBe('sin_orden');
  });

  it('una línea de la orden ya completa que se vuelve a facturar es de más', () => {
    const orden: OrdenCompra = {
      ...ORDEN,
      lineas: [linea({ id: 'c', posicion: 1, cantidad_pedida: 2, cantidad_recibida: 2, estado_linea: 'completa' })],
    };
    const d = diferenciasDeRecepcion([conteo({ id: 'a', orden_linea_id: 'c', fact_cantidad: 1, cantidad_buena: 1 })], orden);
    expect(tipos(d)).toEqual(['facturado_de_mas:error']);
  });
});

describe('resumen del conteo', () => {
  it('cuenta lo que entra por dominio y predice cómo queda la orden', () => {
    const r = resumenConteo(
      [
        conteo({ ...TODO_BIEN[0], cantidad_buena: 1.5, cantidad_danada: 0.5 }),
        conteo({ ...TODO_BIEN[1], factor: 10 }),
        conteo({ id: 'f', accion: 'excluir', motivo_exclusion: 'no_inventario', cantidad_buena: 9 }),
      ],
      ORDEN,
      [{ tipo: 'danado', gravedad: 'error', texto: 'x' }, { tipo: 'excluida', gravedad: 'aviso', texto: 'y' }],
    );
    expect(r).toEqual({
      lineas: 2,
      unidadesInsumo: 20,
      metrosTela: 1.5,
      conDanados: 1,
      errores: 1,
      avisos: 1,
      estadoOrden: 'recibida_parcial',
    });
  });

  it('todo recibido deja la orden recibida; solo dañado la deja como estaba; sin orden, null', () => {
    expect(resumenConteo(TODO_BIEN, ORDEN).estadoOrden).toBe('recibida');
    expect(
      resumenConteo([conteo({ ...TODO_BIEN[0], cantidad_buena: 0, cantidad_danada: 2 })], ORDEN).estadoOrden,
    ).toBe('en_espera');
    expect(resumenConteo(TODO_BIEN, null).estadoOrden).toBeNull();
  });
});
