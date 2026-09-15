import { describe, expect, it } from 'vitest';
import { filtrarRecepciones } from './recepcionLista';

const base = {
  resultado: null,
  envio_finanzas: null,
  proveedor_nombre: 'JOSE MORENO Y COMPAÑIA',
  proveedor_rut: '77.704.530-K',
  orden_id: 'oc1',
};

const LISTA = [
  { ...base, numero: 'REC-0001', estado: 'por_contar', doc_numero: '261881' },
  { ...base, numero: 'REC-0002', estado: 'contada', resultado: 'ok', envio_finanzas: 'enviada', doc_numero: '0261.248' },
  { ...base, numero: 'REC-0003', estado: 'contada', resultado: 'con_diferencias', envio_finanzas: 'error', doc_numero: '9' },
  { ...base, numero: 'REC-0004', estado: 'contada', resultado: 'sin_orden', envio_finanzas: 'pendiente', doc_numero: '10', orden_id: null, proveedor_nombre: 'NAYEM' },
  { ...base, numero: 'REC-0005', estado: 'cancelada', doc_numero: '11' },
];

const nums = (l: Array<{ numero: string }>) => l.map((r) => r.numero);

describe('filtrar recepciones', () => {
  it('por chip', () => {
    expect(nums(filtrarRecepciones(LISTA, 'por_contar'))).toEqual(['REC-0001']);
    expect(nums(filtrarRecepciones(LISTA, 'contadas'))).toEqual(['REC-0002', 'REC-0003', 'REC-0004']);
    // «Con diferencias» incluye las sin orden: las dos las tiene que mirar Gerencia.
    expect(nums(filtrarRecepciones(LISTA, 'con_diferencias'))).toEqual(['REC-0003', 'REC-0004']);
    expect(nums(filtrarRecepciones(LISTA, 'sin_enviar'))).toEqual(['REC-0003', 'REC-0004']);
    expect(filtrarRecepciones(LISTA, 'todas')).toHaveLength(5);
  });

  it('busca por folio normalizado, proveedor, RUT y orden', () => {
    expect(nums(filtrarRecepciones(LISTA, 'todas', '261248'))).toEqual(['REC-0002']);
    expect(nums(filtrarRecepciones(LISTA, 'todas', 'nayem'))).toEqual(['REC-0004']);
    expect(nums(filtrarRecepciones(LISTA, 'todas', 'sin orden'))).toEqual(['REC-0004']);
    expect(filtrarRecepciones(LISTA, 'todas', 'OC-1013', (id) => (id === 'oc1' ? 'OC-1013' : undefined))).toHaveLength(4);
    expect(nums(filtrarRecepciones(LISTA, 'todas', 'rec-0005'))).toEqual(['REC-0005']);
  });
});
