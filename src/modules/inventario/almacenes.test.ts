// El mismo almacén se guarda hoy con cuatro grafías distintas. Estos tests son
// la lista completa de lo que hay en la base: si aparece una quinta, va acá.

import { describe, expect, it } from 'vitest';
import {
  columnaStock,
  esAlmacenCamioneta,
  etiquetaAlmacen,
  normalizarAlmacen,
} from './almacenes';

describe('normalizarAlmacen — las cuatro grafías que existen', () => {
  it('todas las formas de materias primas dan MP', () => {
    for (const t of [
      'MP',
      'mp',
      ' MP ',
      'MATERIAS PRIMAS',
      'MATERIAS_PRIMAS',
      'materias primas',
      'Materias  Primas',
      'MATERIASPRIMAS',
      'MATERIA PRIMA',
    ]) {
      expect(normalizarAlmacen(t), t).toBe('MP');
    }
  });

  it('liberado da LIB', () => {
    for (const t of ['LIB', 'LIBERADO', 'liberado', ' Liberado ', 'LIBERADOS']) {
      expect(normalizarAlmacen(t), t).toBe('LIB');
    }
  });

  it('las zonas de la colmena de paños se mantienen', () => {
    expect(normalizarAlmacen('GALPON')).toBe('GALPON');
    expect(normalizarAlmacen('ROLZZO')).toBe('ROLZZO');
    expect(normalizarAlmacen('MERMA')).toBe('MERMA');
  });

  it('las tildes no cambian el resultado', () => {
    expect(normalizarAlmacen('GALPÓN')).toBe('GALPON');
    expect(normalizarAlmacen('galpón')).toBe('GALPON');
  });

  it('las camionetas se numeran igual escritas como sea', () => {
    for (const t of ['CAM-1', 'cam 1', 'CAMIONETA 1', 'camioneta-1', 'CAM1']) {
      expect(normalizarAlmacen(t), t).toBe('CAM-1');
    }
    expect(normalizarAlmacen('CAMIONETA 12')).toBe('CAM-12');
  });

  // Lo importante: NO adivinar. Un texto raro tiene que notarse, no esconderse
  // en el almacén equivocado.
  it('lo desconocido devuelve undefined en vez de inventar', () => {
    for (const t of ['', '   ', null, undefined, 'BODEGA 3', 'PATIO', 'CAM-', 'X']) {
      expect(normalizarAlmacen(t), String(t)).toBeUndefined();
    }
  });
});

describe('esAlmacenCamioneta', () => {
  it('reconoce solo los CAM-n', () => {
    expect(esAlmacenCamioneta('CAM-1')).toBe(true);
    expect(esAlmacenCamioneta('cam-12')).toBe(true);
    expect(esAlmacenCamioneta('MP')).toBe(false);
    expect(esAlmacenCamioneta('')).toBe(false);
    expect(esAlmacenCamioneta(null)).toBe(false);
  });
});

describe('etiquetaAlmacen — lo que lee la persona', () => {
  it('traduce los códigos conocidos', () => {
    expect(etiquetaAlmacen('MP')).toBe('Materias primas');
    expect(etiquetaAlmacen('LIB')).toBe('Liberado');
    expect(etiquetaAlmacen('MERMA')).toBe('Merma');
    expect(etiquetaAlmacen('GALPON')).toBe('Galpón');
    expect(etiquetaAlmacen('CAM-2')).toBe('Camioneta 2');
  });

  it('un código desconocido se muestra tal cual, no se esconde', () => {
    expect(etiquetaAlmacen('PATIO')).toBe('PATIO');
  });

  it('sin código muestra una raya', () => {
    expect(etiquetaAlmacen('')).toBe('—');
    expect(etiquetaAlmacen(null)).toBe('—');
  });
});

describe('columnaStock — dónde vive el saldo', () => {
  it('MP y liberado tienen columna propia en insumos', () => {
    expect(columnaStock('MP')).toBe('stock_mp');
    expect(columnaStock('MATERIAS PRIMAS')).toBe('stock_mp');
    expect(columnaStock('LIBERADO')).toBe('stock_liberado');
  });

  // Las camionetas viven en inventario_camioneta, no en una columna de insumos:
  // por eso la pantalla de Camionetas escribía stock_total (columna generada) y
  // la escritura se perdía en silencio.
  it('una camioneta o la merma no tienen columna', () => {
    expect(columnaStock('CAM-1')).toBeUndefined();
    expect(columnaStock('MERMA')).toBeUndefined();
    expect(columnaStock('PATIO')).toBeUndefined();
    expect(columnaStock(null)).toBeUndefined();
  });
});
