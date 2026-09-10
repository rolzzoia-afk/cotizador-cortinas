import { describe, expect, it } from 'vitest';
import {
  ESTADOS_ORDEN,
  buscarOrdenes,
  diasEnEspera,
  etiquetaOrden,
  filtrarOrdenes,
  normalizarNumeroOC,
  normalizarRut,
  ordenarOrdenes,
  pendienteDeLinea,
  progresoDeOrden,
  puntuarOrdenParaDocumento,
  resumenContenido,
  resumenOrdenes,
  textoConversion,
  textoEspera,
  unidadesDeInventario,
  type LineaOrden,
  type OrdenCompra,
} from './compras';

// ── Ayudantes para armar datos de prueba ─────────────────────────────

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
  // `in` y no `??`: pasar `null` a propósito tiene que llegar como null, que
  // es justo el caso de «Finanzas no guarda esa fecha».
  aprobada_en: 'aprobada_en' in p ? p.aprobada_en : '2026-09-09T12:13:00Z',
  proveedor_rut: p.proveedor_rut ?? '76.014.543-2',
  proveedor_nombre: p.proveedor_nombre ?? 'COMERCIAL LAS AMERICAS S.A.',
  guia: p.guia ?? null,
  factura_folio: p.factura_folio ?? null,
  factura_tipo: p.factura_tipo ?? null,
  fecha_esperada: p.fecha_esperada ?? null,
  conflicto: p.conflicto ?? null,
  solicitud_ref: p.solicitud_ref ?? null,
  lineas: p.lineas ?? [],
});

// ── Normalizadores ───────────────────────────────────────────────────

describe('normalizarRut', () => {
  it('deja solo dígitos y K, en mayúscula', () => {
    expect(normalizarRut('76.014.543-2')).toBe('760145432');
    expect(normalizarRut('76014543-2')).toBe('760145432');
    expect(normalizarRut('  76.631.074-5 ')).toBe('766310745');
    expect(normalizarRut('12.345.678-k')).toBe('12345678K');
  });
  it('vacío ante basura', () => {
    expect(normalizarRut(null)).toBe('');
    expect(normalizarRut('sin rut')).toBe('');
  });
});

describe('normalizarNumeroOC', () => {
  it('las cuatro formas de escribir la misma orden', () => {
    for (const v of ['1016', 'OC-1016', 'oc 1016', 'OC1016', 'oc_1016', '  OC-01016 ']) {
      expect(normalizarNumeroOC(v)).toBe('1016');
    }
  });
  it('lo que no es un número de orden se deja como está', () => {
    expect(normalizarNumeroOC('CHANTILLY')).toBe('CHANTILLY');
    expect(normalizarNumeroOC('')).toBe('');
  });
});

// ── Encontrar la orden del papel que llegó ───────────────────────────

describe('puntuarOrdenParaDocumento', () => {
  const conGuia = orden({ guia: '789465132' });

  it('la guía exacta gana a todo', () => {
    expect(puntuarOrdenParaDocumento(conGuia, '789465132')).toBe(100);
  });
  it('el folio de la factura vale lo mismo que la guía', () => {
    const conFactura = orden({ guia: null, factura_folio: '12345', factura_tipo: 'Factura' });
    expect(puntuarOrdenParaDocumento(conFactura, '12345')).toBe(100);
    // Y encontrarla por un pedazo del folio también sirve.
    expect(puntuarOrdenParaDocumento(conFactura, '234')).toBe(70);
  });
  it('después el número de orden, escrito como sea', () => {
    expect(puntuarOrdenParaDocumento(conGuia, 'OC-1016')).toBe(90);
    expect(puntuarOrdenParaDocumento(conGuia, '1016')).toBe(90);
  });
  it('el RUT calza escrito con puntos o sin ellos', () => {
    expect(puntuarOrdenParaDocumento(conGuia, '76.014.543-2')).toBe(80);
    expect(puntuarOrdenParaDocumento(conGuia, '760145432')).toBe(80);
  });
  it('un RUT corto NO calza: «12» no puede ser un proveedor', () => {
    expect(puntuarOrdenParaDocumento(orden({ proveedor_rut: '12' }), '12')).toBe(0);
  });
  it('el nombre del proveedor, en cualquier caja', () => {
    expect(puntuarOrdenParaDocumento(conGuia, 'americas')).toBe(60);
  });
  it('el código del artículo de una línea', () => {
    const o = orden({ lineas: [linea({ item_cod: 'DU30', codigo_proveedor: 'DC.151.20.0005' })] });
    expect(puntuarOrdenParaDocumento(o, 'DU30')).toBe(45);
    expect(puntuarOrdenParaDocumento(o, 'DC.151.20.0005')).toBe(44);
  });
  it('la descripción de una línea, como último recurso', () => {
    const o = orden({ lineas: [linea({ descripcion: 'LUXOR DUO TABACO 3.0 MTS' })] });
    expect(puntuarOrdenParaDocumento(o, 'luxor')).toBe(30);
  });
  it('lo que no calza da 0, y la búsqueda vacía también', () => {
    expect(puntuarOrdenParaDocumento(conGuia, 'nada de esto')).toBe(0);
    expect(puntuarOrdenParaDocumento(conGuia, '   ')).toBe(0);
  });
});

describe('buscarOrdenes', () => {
  const a = orden({ id: 'a', numero: 'OC-1015', guia: '789465132', estado: 'recibida_parcial' });
  const b = orden({ id: 'b', numero: 'OC-1016', guia: null });
  const c = orden({ id: 'c', numero: 'OC-1003', guia: '789456132' });

  it('la guía del papel trae su orden primera', () => {
    expect(buscarOrdenes([a, b, c], '789465132').map((o) => o.id)).toEqual(['a']);
  });
  it('sin búsqueda devuelve todo tal cual', () => {
    expect(buscarOrdenes([a, b, c], '')).toHaveLength(3);
  });
  it('a igual puntaje manda la que todavía espera, y la más antigua', () => {
    const espera = orden({ id: 'x', numero: 'OC-2000', aprobada_en: '2026-09-01T00:00:00Z' });
    const otra = orden({
      id: 'y',
      numero: 'OC-2000',
      estado: 'recibida',
      aprobada_en: '2026-08-01T00:00:00Z',
    });
    expect(buscarOrdenes([otra, espera], '2000').map((o) => o.id)).toEqual(['x', 'y']);
  });
});

// ── Filtros y orden ──────────────────────────────────────────────────

describe('filtrarOrdenes', () => {
  const lista = [
    orden({ id: '1', estado: 'en_espera' }),
    orden({ id: '2', estado: 'recibida_parcial' }),
    orden({ id: '3', estado: 'recibida' }),
    orden({ id: '4', estado: 'anulada' }),
    orden({ id: '5', estado: 'cerrada' }),
  ];
  it('«abiertas» son las que todavía esperan algo', () => {
    expect(filtrarOrdenes(lista, 'abiertas').map((o) => o.id)).toEqual(['1', '2']);
  });
  it('cada filtro trae lo suyo', () => {
    expect(filtrarOrdenes(lista, 'en_espera').map((o) => o.id)).toEqual(['1']);
    expect(filtrarOrdenes(lista, 'parciales').map((o) => o.id)).toEqual(['2']);
    expect(filtrarOrdenes(lista, 'cerradas').map((o) => o.id)).toEqual(['3', '4', '5']);
    expect(filtrarOrdenes(lista, 'todas')).toHaveLength(5);
  });
  it('se puede acotar a un proveedor, con el RUT escrito de cualquier forma', () => {
    const otro = orden({ id: '9', proveedor_rut: '77.704.530-K' });
    expect(filtrarOrdenes([...lista, otro], 'todas', '', '777045308')).toHaveLength(0);
    expect(filtrarOrdenes([...lista, otro], 'todas', '', '77704530-k').map((o) => o.id)).toEqual(['9']);
  });
});

describe('ordenarOrdenes', () => {
  it('primero lo que espera; dentro de eso, lo más reciente arriba', () => {
    const lista = [
      orden({ id: 'vieja', estado: 'recibida', aprobada_en: '2026-09-01T00:00:00Z' }),
      orden({ id: 'espera1', estado: 'en_espera', aprobada_en: '2026-09-05T00:00:00Z' }),
      orden({ id: 'espera2', estado: 'en_espera', aprobada_en: '2026-09-09T00:00:00Z' }),
    ];
    expect(ordenarOrdenes(lista).map((o) => o.id)).toEqual(['espera2', 'espera1', 'vieja']);
  });
});

// ── Cuánto falta ─────────────────────────────────────────────────────

describe('pendienteDeLinea', () => {
  it('lo pedido menos lo recibido', () => {
    expect(pendienteDeLinea(linea({ cantidad_pedida: 50, cantidad_recibida: 20 }))).toBe(30);
  });
  it('nunca negativo: si llegó de más, no falta nada', () => {
    expect(pendienteDeLinea(linea({ cantidad_pedida: 50, cantidad_recibida: 60 }))).toBe(0);
  });
});

describe('unidadesDeInventario y textoConversion', () => {
  it('la orden habla en cajas, el kardex en unidades', () => {
    expect(unidadesDeInventario(5, 50)).toBe(250);
    expect(unidadesDeInventario(3, 1)).toBe(3);
  });
  it('un factor inválido se trata como 1, no como cero', () => {
    expect(unidadesDeInventario(4, 0)).toBe(4);
    expect(unidadesDeInventario(4, Number.NaN)).toBe(4);
  });
  it('con factor 1 no se muestra la multiplicación', () => {
    expect(textoConversion(50, 1, 'un')).toBe('50 un');
  });
  it('con factor se muestra la cuenta completa', () => {
    expect(textoConversion(5, 50, 'cajas', 'un')).toBe('5 cajas × 50 = 250 un');
  });
});

describe('progresoDeOrden', () => {
  it('cuenta líneas completas, pendientes, sin vincular y con conflicto', () => {
    const o = orden({
      lineas: [
        linea({ id: '1', estado_linea: 'completa', item_cod: 'MEC18' }),
        linea({ id: '2', estado_linea: 'parcial', item_cod: 'MEC23' }),
        linea({ id: '3', estado_linea: 'pendiente', item_cod: null }),
        linea({ id: '4', estado_linea: 'cancelada', item_cod: 'X1', conflicto: 'ya no viene' }),
      ],
    });
    expect(progresoDeOrden(o)).toEqual({
      lineas: 4,
      completas: 1,
      pendientes: 2,
      fraccion: 0.25,
      sinVincular: 1,
      conConflicto: 1,
    });
  });
  it('el faltante aceptado cuenta como terminado', () => {
    const o = orden({ lineas: [linea({ estado_linea: 'faltante_aceptado', item_cod: 'A' })] });
    expect(progresoDeOrden(o).fraccion).toBe(1);
  });
  it('una orden sin líneas no divide por cero', () => {
    expect(progresoDeOrden(orden()).fraccion).toBe(0);
  });
});

describe('resumenContenido', () => {
  it('distingue dos órdenes parecidas del mismo proveedor', () => {
    const a = orden({
      lineas: [
        linea({ id: '1', item_cod: 'SC 29' }),
        linea({ id: '2', item_cod: 'SC 54' }),
      ],
    });
    const b = orden({
      lineas: [
        linea({ id: '1', item_cod: 'SC 29' }),
        linea({ id: '2', item_cod: 'SC 54' }),
        linea({ id: '3', item_cod: 'SC 77' }),
      ],
    });
    expect(resumenContenido(a)).toBe('SC 29 · SC 54');
    expect(resumenContenido(b)).toBe('SC 29 · SC 54 · SC 77');
  });
  it('con muchas líneas corta y dice cuántas quedaron', () => {
    const o = orden({
      lineas: ['A', 'B', 'C', 'D', 'E'].map((c, i) => linea({ id: String(i), item_cod: c })),
    });
    expect(resumenContenido(o)).toBe('A · B · C +2');
  });
  it('una línea sin vincular muestra el código que venía en la orden', () => {
    const o = orden({
      lineas: [linea({ item_cod: null, codigo_interno: 'DU 30' })],
    });
    expect(resumenContenido(o)).toBe('DU 30');
  });
  it('las canceladas no cuentan, y sin líneas no dice nada', () => {
    const o = orden({
      lineas: [
        linea({ id: '1', item_cod: 'A' }),
        linea({ id: '2', item_cod: 'B', estado_linea: 'cancelada' }),
      ],
    });
    expect(resumenContenido(o)).toBe('A');
    expect(resumenContenido(orden())).toBe('');
  });
});

// ── Fechas ───────────────────────────────────────────────────────────

describe('diasEnEspera y textoEspera', () => {
  const ahora = new Date('2026-09-12T12:00:00Z');
  it('cuenta los días desde que la aprobaron', () => {
    expect(diasEnEspera(orden({ aprobada_en: '2026-09-09T12:00:00Z' }), ahora)).toBe(3);
  });
  it('sin fecha devuelve null en vez de inventar una', () => {
    expect(diasEnEspera(orden({ aprobada_en: null }), ahora)).toBeNull();
    expect(textoEspera(orden({ aprobada_en: null }), ahora)).toBe('—');
  });
  it('con fecha comprometida dice si está atrasada', () => {
    expect(textoEspera(orden({ fecha_esperada: '2026-09-09' }), ahora)).toBe('Atrasada 3 días');
    expect(textoEspera(orden({ fecha_esperada: '2026-09-12' }), ahora)).toBe('Se espera hoy');
    expect(textoEspera(orden({ fecha_esperada: '2026-09-15' }), ahora)).toBe('Se espera en 3 días');
  });
  it('sin fecha comprometida dice cuánto lleva esperando', () => {
    expect(textoEspera(orden({ aprobada_en: '2026-09-11T12:00:00Z' }), ahora)).toBe(
      'Aprobada hace 1 día',
    );
    expect(textoEspera(orden({ aprobada_en: '2026-09-12T08:00:00Z' }), ahora)).toBe('Aprobada hoy');
  });
});

// ── Resumen ──────────────────────────────────────────────────────────

describe('resumenOrdenes', () => {
  it('cuenta lo que hay que mirar hoy', () => {
    const lista = [
      orden({ id: '1', estado: 'en_espera', lineas: [linea({ item_cod: null })] }),
      orden({
        id: '2',
        estado: 'recibida_parcial',
        conflicto: 'anulada_con_recepcion',
        lineas: [linea({ item_cod: 'A' }), linea({ item_cod: null })],
      }),
      // Una cerrada no aporta pendientes: ya no va a llegar nada.
      orden({ id: '3', estado: 'cerrada', lineas: [linea({ item_cod: null })] }),
    ];
    expect(resumenOrdenes(lista)).toEqual({
      enEspera: 1,
      parciales: 1,
      // 1 de la orden en espera + 1 de la parcial. La cerrada NO suma.
      sinVincular: 2,
      conConflicto: 1,
      lineasPendientes: 3,
    });
  });
});

// ── Etiquetas ────────────────────────────────────────────────────────

describe('etiquetas de estado', () => {
  it('cada estado tiene texto y color', () => {
    for (const e of Object.values(ESTADOS_ORDEN)) {
      expect(e.texto.length).toBeGreaterThan(0);
      expect(e.variante).toBeTruthy();
    }
  });
  it('un estado que la base traiga escrito de otra forma no rompe la tabla', () => {
    expect(etiquetaOrden('inventado')).toEqual({ texto: 'inventado', variante: 'muted' });
    expect(etiquetaOrden(null)).toEqual({ texto: '—', variante: 'muted' });
  });
});
