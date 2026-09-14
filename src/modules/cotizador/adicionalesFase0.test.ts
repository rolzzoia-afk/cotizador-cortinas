import { describe, it, expect } from 'vitest';
import {
  adicionalesFromPersist,
  adicionalesToPersist,
  claveColorDerivado,
  coloresDerivadosPersistidos,
  hayInstalacionVerticalManual,
  incluidasVisibles,
  instalacionTipoFromPersist,
  instalacionTipoParaGuardar,
  nuevoAdicional,
  rotuloManual,
  tipoDeAdicional,
  type AdicionalUI,
} from './adicionalesFase0';

const linea = (patch: Partial<AdicionalUI> = {}): AdicionalUI => ({
  ...nuevoAdicional(),
  codInt: 'CENF O',
  cantidad: 1,
  ...patch,
});

describe('tipoDeAdicional — qué rótulo se lee en la grilla y en el PDF', () => {
  it('el escrito a mano le gana al del catálogo', () => {
    expect(tipoDeAdicional('ACCESORIO CENEFA OVALADA', 'ACCESORIO')).toBe(
      'ACCESORIO CENEFA OVALADA',
    );
  });

  it('sin nada escrito manda el catálogo', () => {
    expect(tipoDeAdicional(undefined, 'ACCESORIO')).toBe('ACCESORIO');
    expect(tipoDeAdicional('', 'ACCESORIO')).toBe('ACCESORIO');
    // Solo espacios no es un rótulo: la línea vuelve al catálogo.
    expect(tipoDeAdicional('   ', 'ACCESORIO')).toBe('ACCESORIO');
  });

  it('sin catálogo y sin nada escrito no imprime «undefined»', () => {
    expect(tipoDeAdicional(undefined, undefined)).toBe('');
  });
});

describe('adicionales — guardar y volver a abrir', () => {
  // Es lo que pidió el dueño: se escribe el tipo y tiene que seguir ahí.
  it('el tipo escrito a mano sobrevive el viaje completo', () => {
    const [guardado] = adicionalesToPersist([linea({ tipo: 'ACCESORIO CENEFA OVALADA' })]);
    expect(guardado.tipo).toBe('ACCESORIO CENEFA OVALADA');
    const [devuelta] = adicionalesFromPersist([guardado]);
    expect(devuelta.tipo).toBe('ACCESORIO CENEFA OVALADA');
  });

  it('se guarda sin los espacios de sobra', () => {
    const [guardado] = adicionalesToPersist([linea({ tipo: '  MOTOR SOMFY  ' })]);
    expect(guardado.tipo).toBe('MOTOR SOMFY');
  });

  // Un tipo en blanco NO se guarda: si se guardara vacío, la línea quedaría
  // pegada a ese vacío en vez de volver a leer el catálogo.
  it('borrar el tipo devuelve la línea al catálogo', () => {
    for (const vacio of ['', '   ', undefined]) {
      const [guardado] = adicionalesToPersist([linea({ tipo: vacio })]);
      expect('tipo' in guardado, String(vacio)).toBe(false);
      expect(adicionalesFromPersist([guardado])[0].tipo).toBeUndefined();
    }
  });

  it('una línea vieja, sin el campo, se abre sin romperse', () => {
    const [devuelta] = adicionalesFromPersist([
      { id: 'x', codInt: 'DOM 38', cantidad: 2, descuento: 0 },
    ]);
    expect(devuelta.tipo).toBeUndefined();
    expect(devuelta.codInt).toBe('DOM 38');
  });

  it('lo que no es una lista no rompe la apertura', () => {
    expect(adicionalesFromPersist(undefined)).toEqual([]);
    expect(adicionalesFromPersist({})).toEqual([]);
  });

  it('el tipo no toca lo que decide el precio', () => {
    const [guardado] = adicionalesToPersist([
      linea({ codInt: ' CENF O ', cantidad: 3, descuento: 0.25, tipo: 'LO QUE SEA' }),
    ]);
    expect(guardado.codInt).toBe('CENF O'); // se sigue limpiando el código
    expect(guardado.cantidad).toBe(3);
    expect(guardado.descuento).toBe(0.25);
  });

  it('el color de la fila sobrevive el viaje completo', () => {
    const [guardado] = adicionalesToPersist([linea({ colorFila: '#9dc3e6' })]);
    expect(guardado.colorFila).toBe('#9DC3E6');
    expect(adicionalesFromPersist([guardado])[0].colorFila).toBe('#9DC3E6');
  });

  it('sin color, o con basura, la línea no guarda el campo', () => {
    for (const malo of ['', '   ', 'celeste', undefined]) {
      const [guardado] = adicionalesToPersist([linea({ colorFila: malo })]);
      expect('colorFila' in guardado, String(malo)).toBe(false);
      expect(adicionalesFromPersist([guardado])[0].colorFila).toBeUndefined();
    }
  });

  it('el color no toca lo que decide el precio', () => {
    const [guardado] = adicionalesToPersist([
      linea({ codInt: 'CENF O', cantidad: 3, descuento: 0.25, colorFila: '#FFD966' }),
    ]);
    expect(guardado.cantidad).toBe(3);
    expect(guardado.descuento).toBe(0.25);
    expect(guardado.origen).toBeUndefined();
  });
});

// Las cenefas derivadas de un paño no se conservan entre aperturas: se tiran y
// se vuelven a armar desde las cortinas, con id nuevo. Sin este rescate, pintar
// una se perdía al recargar la OT.
describe('coloresDerivadosPersistidos — el color de una cenefa derivada', () => {
  it('rescata el color por código y ubicación', () => {
    const mapa = coloresDerivadosPersistidos([
      linea({ codInt: 'CENF O', ubicacion: 'LIVING', origen: 'pano', colorFila: '#FFD966' }),
      linea({ codInt: 'CENF O', ubicacion: 'ESCRITORIO', origen: 'pano', colorFila: '#A9D18E' }),
    ]);
    expect(mapa.get(claveColorDerivado('CENF O', 'LIVING'))).toBe('#FFD966');
    expect(mapa.get(claveColorDerivado('CENF O', 'ESCRITORIO'))).toBe('#A9D18E');
    // La llave no distingue mayúsculas ni espacios: la ubicación se teclea.
    expect(mapa.get(claveColorDerivado(' cenf o ', ' living '))).toBe('#FFD966');
  });

  it('ignora las líneas manuales y las que no están pintadas', () => {
    const mapa = coloresDerivadosPersistidos([
      linea({ codInt: 'CENF O', ubicacion: 'LIVING', origen: 'manual', colorFila: '#FFD966' }),
      linea({ codInt: 'DOM 38', ubicacion: 'PIEZA', origen: 'pano' }),
    ]);
    expect(mapa.size).toBe(0);
  });
});

describe('instalación de las verticales — una sola fila, y editable', () => {
  const incluidas = [{ sistema: 'Vertical', cantidad: 1, total: 0 }];
  const cenefa = { codInt: 'CENF O' };
  const instVert = { codInt: 'INST-VERT' };

  it('sin la línea escrita, la app muestra la suya', () => {
    expect(incluidasVisibles(incluidas, [cenefa])).toHaveLength(1);
    expect(incluidasVisibles(incluidas, [])).toHaveLength(1);
  });

  // El caso que reportó el dueño: el Excel traía INST-VERT y la instalación
  // vertical salía dos veces (2026-08-26).
  it('con la línea del Excel, la automática se calla', () => {
    expect(incluidasVisibles(incluidas, [cenefa, instVert])).toEqual([]);
  });

  it('da igual cómo venga escrito el código', () => {
    for (const ci of ['inst-vert', ' INST-VERT ', 'Inst-Vert']) {
      expect(incluidasVisibles(incluidas, [{ codInt: ci }]), ci).toEqual([]);
    }
  });

  // Solo se calla la de las verticales: la roller es un cobro de verdad.
  it('no toca las filas de otros sistemas', () => {
    const mixto = [{ sistema: 'Vertical' }, { sistema: 'Roller' }];
    expect(incluidasVisibles(mixto, [instVert]).map((p) => p.sistema)).toEqual(['Roller']);
  });

  it('hayInstalacionVerticalManual reconoce la línea', () => {
    expect(hayInstalacionVerticalManual([instVert])).toBe(true);
    expect(hayInstalacionVerticalManual([cenefa])).toBe(false);
    expect(hayInstalacionVerticalManual([])).toBe(false);
  });

  // No devuelve el mismo array: quien lo reciba no puede tocar el del motor.
  it('devuelve una copia, no el arreglo del motor', () => {
    expect(incluidasVisibles(incluidas, [])).not.toBe(incluidas);
  });
});

describe('el TIPO de la fila de INSTALACIÓN — lo único que se escribe ahí', () => {
  it('lo escrito le gana al texto que arma la app', () => {
    expect(rotuloManual('INSTALACION EN ALTURA', 'INSTALACION Roller')).toBe(
      'INSTALACION EN ALTURA',
    );
  });

  it('en blanco manda el automático', () => {
    expect(rotuloManual('', 'INSTALACION Roller')).toBe('INSTALACION Roller');
    expect(rotuloManual('  ', 'INSTALACION Roller')).toBe('INSTALACION Roller');
    expect(rotuloManual(undefined, 'INSTALACION Roller')).toBe('INSTALACION Roller');
  });

  it('sin nada de nada no imprime «undefined»', () => {
    expect(rotuloManual(undefined, undefined)).toBe('');
  });

  it('guarda el tipo sin los espacios de sobra', () => {
    expect(instalacionTipoParaGuardar('  INSTALACION EN ALTURA  ')).toBe('INSTALACION EN ALTURA');
  });

  // En blanco NO se guarda: si se guardara vacío, la fila quedaría pegada a
  // ese vacío en vez de volver a decir INSTALACION.
  it('en blanco no se guarda nada', () => {
    for (const vacio of ['', '   ', undefined]) {
      expect(instalacionTipoParaGuardar(vacio), String(vacio)).toBeUndefined();
    }
  });

  it('una OT vieja o con basura guardada se abre vacía', () => {
    expect(instalacionTipoFromPersist(undefined)).toBe('');
    expect(instalacionTipoFromPersist({ tipo: 'x' })).toBe('');
    expect(instalacionTipoFromPersist(42)).toBe('');
    expect(instalacionTipoFromPersist('  EN ALTURA ')).toBe('EN ALTURA');
  });
});
