import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  COLUMNAS_PTOUCH,
  construirFilasEtiquetas,
  etiquetasToWorkbook,
} from './exportEtiquetasPtouch';
import type { Colmena, Tela } from '@/pages/telas/Telas.types';

const telaBase: Tela = {
  id: '1',
  codigo: 'BK 69',
  tipo: 'BK',
  grupo: 'BLACKOUT',
  nemotecnico: 'BK NEGRO',
  proveedor: 'PROV',
  cod_ext: null,
  descriptor: 'Blackout negro 3m',
  ancho: 3,
  calidad: null,
  status_stock: null,
  stock_minimo: null,
  stock_total: 10,
  stock_mp: 4,
  stock_liberado: 6,
  posicion: 'M4',
  almacen: 'LIBERADO',
  estado: 'ACTIVO',
  proveedor_codigo: null,
  responsable: null,
  observaciones: null,
  foto_url: null,
};

describe('construirFilasEtiquetas', () => {
  it('arma una fila por tela con QR TEL:<codigo> y campos base', () => {
    const filas = construirFilasEtiquetas([telaBase], {});
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      CODIGO: 'BK 69',
      NEMOTECNICO: 'BK NEGRO',
      TIPO: 'BK',
      ANCHO: 3,
      QR: 'TEL:BK 69',
    });
  });

  it('la posición de la colmena viva manda sobre la de la tela', () => {
    const colmena: Colmena = {
      RACK3: { codigo: 'BK 69', tipo: 'BK', nemotecnico: null, almacen: 'MATERIAS PRIMAS', id: 'x' },
    };
    const [fila] = construirFilasEtiquetas([telaBase], colmena);
    expect(fila.POSICION).toBe('RACK3');
    expect(fila.ALMACEN).toBe('MATERIAS PRIMAS');
    expect(fila.QR_UBICACION).toBe('TEL_LOC:RACK3|MATERIAS_PRIMAS');
  });

  it('sin colmena usa posicion/almacen de la tela como respaldo', () => {
    const [fila] = construirFilasEtiquetas([telaBase], {});
    expect(fila.POSICION).toBe('M4');
    expect(fila.ALMACEN).toBe('LIBERADO');
    expect(fila.QR_UBICACION).toBe('TEL_LOC:M4|LIBERADO');
  });

  it('sin posición alguna deja POSICION y QR_UBICACION vacíos', () => {
    const suelta = { ...telaBase, posicion: null, almacen: null };
    const [fila] = construirFilasEtiquetas([suelta], {});
    expect(fila.POSICION).toBe('');
    expect(fila.QR_UBICACION).toBe('');
  });

  it('limpia caracteres no ASCII del QR (mismo criterio que QRTelaDialog)', () => {
    const rara = { ...telaBase, codigo: 'BK 69–X' };
    const [fila] = construirFilasEtiquetas([rara], {});
    expect(fila.QR).toBe('TEL:BK69X');
    // El texto visible de la etiqueta conserva el código original.
    expect(fila.CODIGO).toBe('BK 69–X');
  });

  it('campos nulos salen como string vacío (P-touch no acepta null)', () => {
    const vacia: Tela = {
      ...telaBase,
      tipo: null,
      grupo: null,
      nemotecnico: null,
      proveedor: null,
      descriptor: null,
      ancho: null,
    };
    const [fila] = construirFilasEtiquetas([vacia], {});
    expect(fila.TIPO).toBe('');
    expect(fila.GRUPO).toBe('');
    expect(fila.NEMOTECNICO).toBe('');
    expect(fila.PROVEEDOR).toBe('');
    expect(fila.DESCRIPTOR).toBe('');
    expect(fila.ANCHO).toBe('');
  });
});

describe('etiquetasToWorkbook', () => {
  it('fila 1 = encabezados estables (campos de la plantilla P-touch)', () => {
    const wb = etiquetasToWorkbook(construirFilasEtiquetas([telaBase], {}));
    const ws = wb.Sheets['Etiquetas'];
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    expect(aoa[0]).toEqual([...COLUMNAS_PTOUCH]);
    expect(aoa[1][0]).toBe('BK 69');
    expect(aoa[1][COLUMNAS_PTOUCH.indexOf('QR')]).toBe('TEL:BK 69');
  });
});
