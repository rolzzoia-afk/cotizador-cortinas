import { describe, expect, it } from 'vitest';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  cabeEnPano,
  cajaAEscala,
  consejoDelPano,
  desperdicioCm2,
  fechaLarga,
  medidaTexto,
  nombreFamiliaPano,
  origenTexto,
  panosQueCaben,
  resumenZonas,
  sirveParaTexto,
  ubicacionTexto,
} from './colmenaVista';

const HOY = '2026-09-08T12:00:00.000Z';

function pano(p: Partial<ColmenaPano> & { id: string }): ColmenaPano {
  return {
    empresa_id: 'e1',
    codigo: 'SC 48',
    medida_ancho: 120,
    medida_alto: 240,
    disponible: true,
    ot_asignada: null,
    fecha_uso: null,
    created_at: HOY,
    ...p,
  } as ColmenaPano;
}

describe('nombreFamiliaPano', () => {
  it('saca la familia del prefijo del código', () => {
    expect(nombreFamiliaPano('BK 07')).toBe('Blackout');
    expect(nombreFamiliaPano('DU 12')).toBe('Dúo');
    expect(nombreFamiliaPano('SC 48')).toBe('Screen');
    expect(nombreFamiliaPano('TR 04')).toBe('Translúcida');
  });

  it('un prefijo que no conoce cae en «Otra», no revienta', () => {
    expect(nombreFamiliaPano('BEE-SC')).toBe('Otra');
    expect(nombreFamiliaPano(null)).toBe('Otra');
  });
});

describe('ubicacionTexto', () => {
  it('arma la coordenada del galpón', () => {
    const p = pano({ id: '1', datos_extra: { zona: 'GALPON', rack: 3, m: 7, col: 3 } });
    expect(ubicacionTexto(p)).toBe('Galpón · R3 · M7 · col 3');
  });

  it('el liberado numera sus filas sin letra, así que dice «fila»', () => {
    const p = pano({ id: '1', datos_extra: { zona: 'LIBERADO', rack: 2, m: 3, col: 4 } });
    expect(ubicacionTexto(p)).toBe('Liberado · R2 · fila 3 · col 4');
  });

  it('en las zonas de estante manda el texto libre', () => {
    const p = pano({ id: '1', ubicacion: 'A-19', datos_extra: { zona: 'ROLZZO' } });
    expect(ubicacionTexto(p)).toBe('Rolzzo · A-19');
  });

  it('una coordenada incompleta no inventa una celda', () => {
    const p = pano({ id: '1', ubicacion: 'MAPA F73', datos_extra: { zona: 'GALPON', rack: 3 } });
    expect(ubicacionTexto(p)).toBe('Galpón · MAPA F73');
  });

  it('sin nada, al menos dice en qué zona está', () => {
    expect(ubicacionTexto(pano({ id: '1', datos_extra: { zona: 'GALPON' } }))).toBe('Galpón');
  });
});

describe('medidaTexto', () => {
  it('redondea al centímetro', () => {
    expect(medidaTexto(119.6, 240.2)).toBe('120 × 240');
  });

  it('sin medida no muestra un cero', () => {
    expect(medidaTexto(null, 240)).toBe('—');
  });
});

describe('cajaAEscala', () => {
  it('respeta la proporción real del paño', () => {
    expect(cajaAEscala(120, 240, 130)).toEqual({ ancho: 65, alto: 130 });
    expect(cajaAEscala(240, 120, 130)).toEqual({ ancho: 130, alto: 65 });
  });

  it('un paño cuadrado sale cuadrado', () => {
    expect(cajaAEscala(200, 200, 130)).toEqual({ ancho: 130, alto: 130 });
  });

  it('el lado corto nunca desaparece del todo', () => {
    const c = cajaAEscala(10, 400, 130);
    expect(c?.alto).toBe(130);
    expect(c?.ancho).toBe(28);
  });

  it('sin medidas no hay dibujo', () => {
    expect(cajaAEscala(null, 240, 130)).toBeNull();
    expect(cajaAEscala(0, 240, 130)).toBeNull();
  });
});

describe('origenTexto', () => {
  it('traduce las fuentes que existen en la base', () => {
    expect(origenTexto('corte_rollo')).toBe('Sobrante de un corte');
    expect(origenTexto('IMPORT_ROLZZO_2026-07-13')).toBe('Importado del Excel');
    expect(origenTexto('COLMENA_PANOS_MAPA')).toBe('Carga inicial de la colmena');
  });

  it('una fuente desconocida se muestra tal cual', () => {
    expect(origenTexto('otra_cosa')).toBe('otra_cosa');
    expect(origenTexto(null)).toBe('—');
  });
});

describe('fechaLarga', () => {
  it('escribe la fecha como se lee en Chile', () => {
    expect(fechaLarga('2026-06-02T10:00:00.000Z')).toMatch(/^0[12]-06-2026$/);
  });

  it('una fecha que no se entiende no muestra «Invalid Date»', () => {
    expect(fechaLarga('mañana')).toBe('');
    expect(fechaLarga(null)).toBe('');
  });
});

describe('sirveParaTexto', () => {
  it('nombra los dos usos', () => {
    expect(sirveParaTexto({ roller: true, vertical: true })).toEqual(['Roller', 'Vertical']);
    expect(sirveParaTexto({ roller: false, vertical: true })).toEqual(['Vertical']);
  });

  it('un trozo que no sirve para nada devuelve la lista vacía', () => {
    expect(sirveParaTexto({ roller: false, vertical: false })).toEqual([]);
  });
});

describe('consejoDelPano', () => {
  it('un paño reciente no necesita que nadie opine', () => {
    expect(consejoDelPano({ estado: 'activa', dias: 12, familia: 'Screen' })).toBeNull();
  });

  it('el que lleva más de 90 días propone qué hacer', () => {
    expect(consejoDelPano({ estado: 'alerta', dias: 98, familia: 'Screen' })).toBe(
      'Lleva 98 días sin usarse. Conviene ofrecerlo en la próxima cotización de screen o darlo de baja.',
    );
  });

  it('sin fecha lo dice sin inventar un número', () => {
    expect(consejoDelPano({ estado: 'alerta', dias: null, familia: 'Dúo' })).toContain(
      'Lleva mucho tiempo',
    );
  });

  it('explica por qué un paño usado o dado de baja sigue a la vista', () => {
    expect(consejoDelPano({ estado: 'usada', dias: 3, familia: 'Screen' })).toContain('ya se usó');
    expect(consejoDelPano({ estado: 'baja', dias: 3, familia: 'Screen' })).toContain('merma');
  });
});

describe('cabeEnPano', () => {
  const p = pano({ id: '1', medida_ancho: 120, medida_alto: 240 });

  it('cabe lo que entra por los dos lados', () => {
    expect(cabeEnPano(p, { ancho: 120, alto: 240 })).toBe(true);
    expect(cabeEnPano(p, { ancho: 100, alto: 200 })).toBe(true);
  });

  it('NO se gira: la tela tiene diseño y no se acuesta sola', () => {
    expect(cabeEnPano(p, { ancho: 240, alto: 120 })).toBe(false);
  });

  it('un centímetro de más no cabe', () => {
    expect(cabeEnPano(p, { ancho: 121, alto: 240 })).toBe(false);
  });
});

describe('panosQueCaben', () => {
  const lista = [
    pano({ id: 'justo', medida_ancho: 125, medida_alto: 245 }),
    pano({ id: 'grande', medida_ancho: 300, medida_alto: 300 }),
    pano({ id: 'chico', medida_ancho: 100, medida_alto: 100 }),
    pano({ id: 'usado', medida_ancho: 200, medida_alto: 300, disponible: false }),
    pano({ id: 'baja', medida_ancho: 200, medida_alto: 300, datos_extra: { baja: true } }),
    pano({ id: 'otro-codigo', codigo: 'BK 07', medida_ancho: 200, medida_alto: 300 }),
  ];

  it('del que menos desperdicia al que más', () => {
    expect(panosQueCaben(lista, { ancho: 120, alto: 240 }).map((p) => p.id)).toEqual([
      'justo',
      'otro-codigo',
      'grande',
    ]);
  });

  it('deja fuera lo usado y lo dado de baja', () => {
    const ids = panosQueCaben(lista, { ancho: 120, alto: 240 }).map((p) => p.id);
    expect(ids).not.toContain('usado');
    expect(ids).not.toContain('baja');
  });

  it('se puede pedir un código en particular', () => {
    expect(panosQueCaben(lista, { ancho: 120, alto: 240 }, 'bk 07').map((p) => p.id)).toEqual([
      'otro-codigo',
    ]);
  });

  it('desperdicioCm2 mide lo que sobra', () => {
    expect(desperdicioCm2(pano({ id: 'x', medida_ancho: 200, medida_alto: 100 }), {
      ancho: 100,
      alto: 100,
    })).toBe(10_000);
  });
});

describe('resumenZonas', () => {
  const lista = [
    pano({ id: '1', datos_extra: { zona: 'GALPON' } }),
    pano({ id: '2', datos_extra: { zona: 'GALPON' }, disponible: false }),
    pano({
      id: '3',
      datos_extra: { zona: 'GALPON', fecha_origen: '2026-01-01T00:00:00.000Z' },
    }),
    pano({ id: '4', ubicacion: 'A-19', datos_extra: { zona: 'ROLZZO' } }),
    pano({ id: '5', datos_extra: { zona: 'LIBERADO' } }),
  ];

  it('una pestaña por zona, en el orden del galpón', () => {
    expect(resumenZonas(lista, HOY).map((z) => z.zona)).toEqual(['GALPON', 'LIBERADO', 'ROLZZO']);
  });

  it('cuenta los disponibles y los que llevan más de 90 días', () => {
    const galpon = resumenZonas(lista, HOY)[0];
    expect(galpon.label).toBe('Galpón');
    expect(galpon.disponibles).toBe(2);
    expect(galpon.alerta).toBe(1);
    expect(galpon.modo).toBe('grid');
  });

  it('las zonas de estante se marcan como tales', () => {
    const rolzzo = resumenZonas(lista, HOY).find((z) => z.zona === 'ROLZZO');
    expect(rolzzo?.modo).toBe('slots');
  });

  it('sin paños no hay pestañas', () => {
    expect(resumenZonas([], HOY)).toEqual([]);
  });
});
