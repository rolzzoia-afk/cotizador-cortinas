import { describe, expect, it } from 'vitest';
import type { LineaOrden, OrdenCompra } from './compras';
import {
  esHeic,
  etiquetaDocumento,
  fechaHoraCL,
  rutaFichaRecepcion,
  etiquetaEnvio,
  etiquetaResultado,
  lineasParaConfirmar,
  lineasPorRecibir,
  llegoTodoLoFacturado,
  motivoNoRecibible,
  normalizarNumeroDocumento,
  problemasDeLaFirma,
  problemasDelConteo,
  problemasDelPapel,
  rutaArchivoRecepcion,
  unidadesQueEntran,
  type LineaConteo,
} from './recepcion';

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

// Con la forma de la OC-1015 real: una tela, un insumo y una línea sin vincular.
const ORDEN: OrdenCompra = {
  id: 'oc',
  numero: 'OC-1015',
  estado: 'en_espera',
  lineas: [
    linea({ id: 'bk', posicion: 1, dominio: 'tela', item_cod: 'BK 43', cantidad_pedida: 2 }),
    linea({ id: 'e42', posicion: 2, item_cod: 'E42', cantidad_pedida: 5, cantidad_recibida: 2, estado_linea: 'parcial' }),
    linea({ id: 'x', posicion: 3, dominio: null, item_cod: null, codigo_interno: 'TELEVISOR' }),
    linea({ id: 'ok', posicion: 4, cantidad_pedida: 1, cantidad_recibida: 1, estado_linea: 'completa' }),
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

describe('el papel', () => {
  it('etiqueta el documento como lo escribe el kardex', () => {
    expect(etiquetaDocumento('factura', ' 261881 ')).toBe('Factura 261881');
    expect(etiquetaDocumento('guia', '12')).toBe('Guía 12');
    expect(etiquetaDocumento('otro', 'X')).toBe('Doc. X');
  });

  it('el mismo folio escrito de otra forma es el mismo papel (espejo de compras_doc_norm)', () => {
    expect(normalizarNumeroDocumento('261.881')).toBe('261881');
    expect(normalizarNumeroDocumento('0261881')).toBe('261881');
    expect(normalizarNumeroDocumento('prueba 1')).toBe(normalizarNumeroDocumento('PRUEBA-1'));
    expect(normalizarNumeroDocumento('000')).toBe('0');
    expect(normalizarNumeroDocumento('')).toBe('');
  });

  it('pide tipo y número del papel, y nombre y firma para confirmar', () => {
    expect(problemasDelPapel({ tipo: 'factura', numero: '1' })).toEqual([]);
    expect(problemasDelPapel({ tipo: 'boleta', numero: ' ' })).toHaveLength(2);
    expect(problemasDeLaFirma({ recibe: 'Ana', hayFirma: true })).toEqual([]);
    expect(problemasDeLaFirma({ recibe: '', hayFirma: false })).toEqual([
      'Falta el nombre de quien recibe.',
      'Falta la firma de quien recibe.',
    ]);
  });

  it('reconoce un HEIC por el tipo o por la extensión', () => {
    expect(esHeic({ name: 'IMG_1.HEIC', type: '' })).toBe(true);
    expect(esHeic({ name: 'foto', type: 'image/heif' })).toBe(true);
    expect(esHeic({ name: 'factura.pdf', type: 'application/pdf' })).toBe(false);
  });

  it('guarda los archivos bajo la carpeta de la empresa, sin repetir el nombre', () => {
    expect(rutaArchivoRecepcion('emp', 'oc-1', 'Factura.PDF', 1000, 'abc')).toBe('emp/oc-1/1000-abc.pdf');
    expect(rutaArchivoRecepcion('emp', 'recepciones/r1', 'x', 5, 'z')).toBe('emp/recepciones/r1/5-z.jpg');
    // Una carpeta con basura no puede escaparse de la empresa.
    expect(rutaArchivoRecepcion('emp', '../otra', 'a.png', 1, 'q')).toBe('emp/otra/1-q.png');
  });
});

describe('ruta y fechas', () => {
  it('la ficha conserva el «ver como» y abre el conteo con contar=1', () => {
    expect(rutaFichaRecepcion('r1')).toBe('/inventario/compras/recepciones/r1');
    expect(rutaFichaRecepcion('r1', '?rol=operario')).toBe('/inventario/compras/recepciones/r1?rol=operario');
    expect(rutaFichaRecepcion('r1', '', true)).toBe('/inventario/compras/recepciones/r1?contar=1');
  });

  it('una fecha sola no se corre un día; una con hora va en la hora de Chile', () => {
    expect(fechaHoraCL('2026-09-10', false)).toBe('10-09-2026');
    expect(fechaHoraCL('2026-09-11T15:21:00Z')).toBe('11-09-2026 12:21');
    expect(fechaHoraCL(null)).toBe('—');
  });
});

describe('los estados', () => {
  it('nombra resultado y envío, y devuelve null sin valor', () => {
    expect(etiquetaResultado('con_diferencias')?.texto).toBe('Con diferencias');
    expect(etiquetaEnvio('error')?.variante).toBe('destructive');
    expect(etiquetaResultado(null)).toBeNull();
    expect(etiquetaEnvio('raro')?.texto).toBe('raro');
  });
});

describe('las líneas de la orden', () => {
  it('solo las que tienen algo pendiente', () => {
    expect(lineasPorRecibir(ORDEN).map((l) => l.id)).toEqual(['bk', 'e42', 'x']);
  });

  it('una línea sin artículo no se puede recibir', () => {
    expect(motivoNoRecibible(ORDEN.lineas![2])).toMatch(/Sin artículo/);
    expect(motivoNoRecibible(ORDEN.lineas![0])).toBeNull();
  });
});

describe('el conteo', () => {
  it('lo que entra es lo bueno por el factor, y nada si no se recibe', () => {
    expect(unidadesQueEntran(conteo({ id: 'a', cantidad_buena: 3, factor: 50 }))).toBe(150);
    expect(unidadesQueEntran(conteo({ id: 'a', cantidad_buena: 3, accion: 'excluir' }))).toBe(0);
  });

  it('«llegó todo lo facturado» copia lo facturado a bueno, sin tocar lo manual ni lo excluido', () => {
    const r = llegoTodoLoFacturado([
      conteo({ id: 'a', fact_cantidad: 2, cantidad_danada: 1 }),
      conteo({ id: 'b', fact_cantidad: 1, accion: 'excluir', motivo_exclusion: 'no_inventario' }),
      conteo({ id: 'c', origen: 'manual', fact_cantidad: 0, cantidad_buena: 4 }),
    ]);
    expect(r.map((l) => [l.cantidad_buena, l.cantidad_danada])).toEqual([
      [2, 0],
      [0, 0],
      [4, 0],
    ]);
  });

  it('frena insumos que no dan entero, líneas sin artículo y agregadas en 0', () => {
    const p = problemasDelConteo([
      conteo({ id: 'a', posicion: 1, cantidad_buena: 1.5 }),
      conteo({ id: 'b', posicion: 2, item_cod: null, dominio: null }),
      conteo({ id: 'c', posicion: 3, origen: 'manual', fact_cantidad: 0 }),
      conteo({ id: 'd', posicion: 4, dominio: 'tela', item_cod: 'BK 43', cantidad_buena: 1.5 }),
      conteo({ id: 'e', posicion: 5, accion: 'excluir', motivo_exclusion: 'no_inventario', item_cod: null }),
    ]);
    expect(p).toHaveLength(3);
    expect(p[0]).toMatch(/^Línea 1 \(E42\): da 1,5 unidades/);
    expect(p[1]).toMatch(/^Línea 2: no tiene artículo/);
    expect(p[2]).toMatch(/^Línea 3 \(E42\): anota cuánto llegó/);
  });

  it('un faltante NO impide firmar: es lo que se reporta', () => {
    expect(problemasDelConteo([conteo({ id: 'a', fact_cantidad: 5, cantidad_buena: 0 })])).toEqual([]);
  });

  it('manda todas las líneas, con lo que faltaba de la orden al abrir', () => {
    const r = lineasParaConfirmar(
      [
        conteo({ id: 'l1', orden_linea_id: 'e42', fact_cantidad: 3, cantidad_buena: 2, cantidad_danada: 1, nota: ' caja rota ', fotos: ['emp/r/1.jpg'] }),
        conteo({ id: 'l2', accion: 'excluir', motivo_exclusion: 'no_inventario', cantidad_buena: 7 }),
        conteo({ id: 'tmp', nueva: true, origen: 'manual', orden_linea_id: 'bk', fact_cantidad: 0, cantidad_buena: 1 }),
        conteo({ id: 'tmp2', nueva: true, origen: 'manual', item_cod: 'E99', fact_cantidad: 0, cantidad_buena: 2, factor: 10 }),
      ],
      ORDEN,
    );
    expect(r[0]).toEqual({
      linea_id: 'l1', facturado: 3, accion: 'recibir', motivo_exclusion: null,
      buena: 2, danada: 1, esperado: 3, nota: 'caja rota', fotos: ['emp/r/1.jpg'],
    });
    // Lo tecleado en una línea excluida no viaja.
    expect(r[1]).toMatchObject({ linea_id: 'l2', accion: 'excluir', buena: 0, motivo_exclusion: 'no_inventario' });
    expect(r[2]).toMatchObject({ nueva: { orden_linea_id: 'bk' }, buena: 1, esperado: 2 });
    expect(r[2]).not.toHaveProperty('linea_id');
    expect(r[3]).toMatchObject({ nueva: { dominio: 'insumo', item_cod: 'E99', factor: 10 }, esperado: null });
  });
});
