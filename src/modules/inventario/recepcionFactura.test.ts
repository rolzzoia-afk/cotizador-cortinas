import { describe, expect, it } from 'vitest';
import type { LineaOrden, OrdenCompra } from './compras';
import { candidatosCatalogo, emparejarConCatalogo, type ArticuloCatalogo } from './recepcionCatalogo';
import {
  avisosDeCabecera,
  cabeceraDesdeExtraccion,
  emparejarConOrden,
  lineasDesdeOrden,
  lineasParaAbrir,
  marcarDuplicadas,
  problemasDeRevision,
  type Aprendida,
  type ExtraccionFactura,
  type LineaExtraida,
} from './recepcionFactura';
import { codigoNeutro, esCargo, normalizarTexto, pareceTela, similitud, tokens } from './recepcionTexto';

function extraida(p: Partial<LineaExtraida> & { descripcion: string }): LineaExtraida {
  return { posicion: 0, codigo: null, cantidad: 1, unidad: null, unidades_por_paquete: null, es_cargo: false, ...p };
}

function linea(p: Partial<LineaOrden> & { id: string }): LineaOrden {
  return {
    posicion: 1,
    cantidad_pedida: 1,
    factor: 1,
    cantidad_recibida: 0,
    estado_linea: 'pendiente',
    dominio: 'insumo',
    item_cod: null,
    ...p,
  };
}

const ORDEN: OrdenCompra = {
  id: 'oc',
  numero: 'OC-1015',
  estado: 'en_espera',
  proveedor_rut: '78.762.290-9',
  proveedor_nombre: 'IMPORTADORA NAYEM LTDA',
  lineas: [
    linea({ id: 'bk', posicion: 1, codigo_interno: 'BK 43', codigo_proveedor: 'ROB 58 55', descripcion: 'BLACK OUT STONE BLUE ROB 58 55', dominio: 'tela', item_cod: 'BK 43', cantidad_pedida: 2 }),
    linea({ id: 'e42', posicion: 2, codigo_interno: 'E42', codigo_proveedor: '100200300400', descripcion: 'SEPARADOR DE DARK Y SOFT LIGHT NEGRO', item_cod: 'E42', cantidad_pedida: 2 }),
    linea({ id: 'cn', posicion: 3, codigo_interno: 'CAD10', descripcion: 'CADENA PLASTICA NEGRA 60CM', item_cod: 'CAD10', cantidad_pedida: 10 }),
    linea({ id: 'cb', posicion: 4, codigo_interno: 'CAD11', descripcion: 'CADENA PLASTICA BLANCA 60CM', item_cod: 'CAD11', cantidad_pedida: 10 }),
    linea({ id: 'x', posicion: 5, codigo_interno: 'TELEVISOR', descripcion: 'TELESITA' }),
  ],
};

describe('texto', () => {
  it('normaliza acentos y puntuación sin romper los decimales', () => {
    expect(normalizarTexto('Rollér  blackout DIS. C17BO-4 3,0 cm #34')).toBe('ROLLER BLACKOUT DIS C17BO 4 3.0 CM 34');
  });

  it('los colores no tienen género', () => {
    expect(tokens('cadena NEGRA')).toEqual(['CADENA', 'NEGRO']);
  });

  it('reconoce los códigos que no identifican nada', () => {
    for (const c of ['', 'N/A', 'na', '-', 'S/C', '000', '1,10E+11', '1.10E+11']) expect(codigoNeutro(c)).toBe(true);
    for (const c of ['ROB 58 55', '100200300400', 'E42']) expect(codigoNeutro(c)).toBe(false);
  });

  it('un color o una medida distinta baja mucho el parecido', () => {
    const q = 'CADENA PLASTICA NEGRO 60 CM';
    expect(similitud(q, 'CADENA PLASTICA NEGRA 60CM')).toBeGreaterThan(similitud(q, 'CADENA PLASTICA BLANCA 60CM'));
    expect(similitud(q, 'CADENA PLASTICA NEGRA 90CM')).toBeLessThan(similitud(q, 'CADENA PLASTICA NEGRA 60CM'));
  });

  it('distingue tela de insumo y los cargos', () => {
    expect(pareceTela('RO ROLLER BLACKOUT DIS. C17BO-4 3.0 CM #34')).toBe(true);
    expect(pareceTela('ROLLO DE CINTA [150 MTS.]')).toBe(false);
    expect(pareceTela('SEPARADOR DE DARK Y SOFT LIGHT NEGRO')).toBe(false);
    expect(esCargo({ descripcion: 'Flete a Santiago', es_cargo: false })).toBe(true);
    expect(esCargo({ descripcion: 'TUBO 38', es_cargo: false })).toBe(false);
  });
});

describe('emparejar con la orden', () => {
  it('por nuestro código, por el del proveedor y por lo aprendido, en ese orden', () => {
    const aprendidas: Aprendida[] = [
      { proveedor_rut: '78762290-9', clave_tipo: 'codigo', clave: 'ZZ-1', dominio: 'insumo', item_cod: 'CAD11', factor: null },
    ];
    const r = emparejarConOrden(
      [
        extraida({ posicion: 1, codigo: 'bk43', descripcion: 'BLACKOUT AZUL' }),
        extraida({ posicion: 2, codigo: '100200300400', descripcion: 'SEPARADOR' }),
        extraida({ posicion: 3, codigo: 'zz-1', descripcion: 'CADENA' }),
      ],
      ORDEN,
      aprendidas,
      '78.762.290-9',
    );
    expect(r.map((l) => [l.orden_linea_id, l.vinculo])).toEqual([
      ['bk', 'interno'],
      ['e42', 'codigo'],
      ['cb', 'aprendida'],
    ]);
    expect(r[0]).toMatchObject({ dominio: 'tela', item_cod: 'BK 43', confianza: null });
  });

  it('por la descripción solo PROPONE, y prefiere el color que calza', () => {
    const [l] = emparejarConOrden([extraida({ codigo: 'N/A', descripcion: 'CADENA PLASTICA NEGRO 60 CM', cantidad: 10 })], ORDEN);
    expect(l.orden_linea_id).toBe('cn');
    expect(l.vinculo).toBe('descripcion');
    expect(l.confianza).toBeGreaterThanOrEqual(0.5);
  });

  it('lo que no calza queda sin elegir, y los cargos se excluyen', () => {
    const r = emparejarConOrden(
      [extraida({ descripcion: 'ARTICULO QUE NADIE PIDIO' }), extraida({ descripcion: 'FLETE', es_cargo: true })],
      ORDEN,
    );
    expect(r[0]).toMatchObject({ orden_linea_id: null, item_cod: null, accion: 'recibir' });
    expect(r[1]).toMatchObject({ accion: 'excluir', motivo_exclusion: 'no_inventario' });
  });

  it('lo aprendido que la orden no trae queda como artículo suelto (facturado y no pedido)', () => {
    const [l] = emparejarConOrden(
      [extraida({ codigo: 'Q1', descripcion: 'OTRA COSA' })],
      ORDEN,
      [{ proveedor_rut: '78762290-9', clave_tipo: 'codigo', clave: 'Q1', dominio: 'tela', item_cod: 'SC 29', factor: 1 }],
    );
    expect(l).toMatchObject({ orden_linea_id: null, dominio: 'tela', item_cod: 'SC 29', vinculo: 'aprendida' });
  });

  it('marca las dos líneas del papel que van a la misma de la orden', () => {
    const r = emparejarConOrden(
      [extraida({ codigo: 'E42', descripcion: 'SEPARADOR', cantidad: 1 }), extraida({ codigo: 'E42', descripcion: 'SEPARADOR', cantidad: 1 })],
      ORDEN,
    );
    expect(r.map((l) => l.duplicada)).toEqual([true, true]);
    expect(marcarDuplicadas([{ ...r[0] }, { ...r[1], accion: 'excluir' }]).map((l) => l.duplicada)).toEqual([false, false]);
  });

  it('sin lectura: una línea por lo que falta de la orden', () => {
    const r = lineasDesdeOrden(ORDEN);
    expect(r).toHaveLength(5);
    expect(r[0]).toMatchObject({ orden_linea_id: 'bk', cantidad: 2, vinculo: 'interno', codigo: 'ROB 58 55' });
  });
});

describe('antes de guardar', () => {
  it('pide artículo, cantidad y que la línea de la orden esté vinculada', () => {
    const [bien, sinArticulo, sinCant, sinVincular] = emparejarConOrden(
      [
        extraida({ codigo: 'E42', descripcion: 'SEPARADOR', cantidad: 2 }),
        extraida({ descripcion: 'ALGO', cantidad: 1 }),
        extraida({ codigo: 'BK 43', descripcion: 'BLACKOUT', cantidad: null }),
        extraida({ codigo: 'TELEVISOR', descripcion: 'TELE', cantidad: 1 }),
      ],
      ORDEN,
    );
    expect(problemasDeRevision([bien], ORDEN)).toEqual([]);
    expect(problemasDeRevision([sinArticulo], ORDEN)[0]).toMatch(/elige a qué corresponde/);
    expect(problemasDeRevision([sinCant], ORDEN)[0]).toMatch(/falta la cantidad facturada/);
    expect(problemasDeRevision([sinVincular], ORDEN)[0]).toMatch(/línea 5 de la orden no tiene artículo/);
    expect(problemasDeRevision([], ORDEN)).toHaveLength(1);
  });

  it('solo manda el artículo suelto cuando no hay línea de la orden', () => {
    const r = emparejarConOrden([extraida({ codigo: 'E42', descripcion: 'SEPARADOR', cantidad: 2 }), extraida({ descripcion: 'FLETE' })], ORDEN);
    const p = lineasParaAbrir(r);
    expect(p[0]).toMatchObject({ orden_linea_id: 'e42', item_cod: null, dominio: null, vinculo: 'interno', cantidad: 2 });
    expect(p[1]).toMatchObject({ accion: 'excluir', motivo_exclusion: 'no_inventario', orden_linea_id: null, vinculo: null });
  });
});

describe('la cabecera', () => {
  const ext: ExtraccionFactura = {
    es_documento: true,
    motivo_no_documento: null,
    proveedor: { nombre: 'JOSE MORENO Y COMPAÑIA', rut: '77.704.530-K' },
    documento: { tipo: 'boleta', numero: '261881', fecha: '2026-09-10', orden_compra_ref: 'OC 1013' },
    lineas: [],
    advertencias: ['cantidad ilegible en la línea 2'],
  };

  it('propone tipo, número, fecha y proveedor', () => {
    expect(cabeceraDesdeExtraccion(ext, ORDEN)).toEqual({
      tipo: 'otro', numero: '261881', fecha: '2026-09-10', rut: '77.704.530-K', nombre: 'JOSE MORENO Y COMPAÑIA',
    });
    // Sin lectura: factura, con el proveedor de la orden.
    expect(cabeceraDesdeExtraccion(null, ORDEN)).toMatchObject({ tipo: 'factura', numero: '', rut: '78.762.290-9' });
  });

  it('avisa RUT distinto, otra orden mencionada y las advertencias de la lectura', () => {
    const a = avisosDeCabecera(cabeceraDesdeExtraccion(ext, ORDEN), ext, ORDEN);
    expect(a).toHaveLength(3);
    expect(a[0]).toMatch(/RUT del papel/);
    expect(a[1]).toMatch(/menciona la orden OC 1013/);
    expect(a[2]).toBe('La lectura avisa: cantidad ilegible en la línea 2');
  });
});

describe('sin orden, contra el catálogo', () => {
  const CAT: ArticuloCatalogo[] = [
    { dominio: 'tela', cod: 'BK 34', nombre: 'ROLLER BLACKOUT GRIS 3.0 MTS', cod_proveedor: null },
    { dominio: 'insumo', cod: 'INS10', nombre: 'CINTA DOBLE CONTACTO', descriptor_proveedor: 'ROLLO DE CINTA 150 MTS', can_x_paquete: 50 },
    { dominio: 'insumo', cod: 'E42', nombre: 'SEPARADOR DARK', cod_proveedor: 'P-9' },
  ];

  it('código nuestro, del proveedor y descripción con factor del paquete', () => {
    const r = emparejarConCatalogo(
      [
        extraida({ codigo: 'e 42', descripcion: 'SEPARADOR' }),
        extraida({ codigo: 'P-9', descripcion: 'X' }),
        extraida({ codigo: null, descripcion: 'ROLLO DE CINTA [150 MTS.]', unidades_por_paquete: 50 }),
      ],
      CAT,
    );
    expect(r.map((l) => [l.item_cod, l.vinculo, l.factor])).toEqual([
      ['E42', 'interno', 1],
      ['E42', 'codigo', 1],
      ['INS10', 'descripcion', 50],
    ]);
  });

  it('el buscador ordena por parecido y prefiere el dominio indicado', () => {
    const c = candidatosCatalogo('blackout gris', CAT, 3, 'tela');
    expect(c[0].articulo.cod).toBe('BK 34');
    expect(candidatosCatalogo('INS', CAT)[0].articulo.cod).toBe('INS10');
    expect(candidatosCatalogo('  ', CAT)).toEqual([]);
  });
});
