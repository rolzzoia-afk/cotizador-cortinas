import { describe, expect, it } from 'vitest';
import {
  casillaMarcada,
  etiquetaDesdePano,
  fechaCorta,
  funcionalDeMarca,
  htmlEtiquetasSobrante,
  lineaOts,
  marcaDeFuncional,
  medida,
  type EtiquetaSobrante,
} from './etiquetaSobrante';

const base: EtiquetaSobrante = {
  codigo: 'BK 10',
  funcional: { roller: false, vertical: true },
  anchoCm: 98,
  altoCm: 260,
  origen: 'OT 3189',
  fechaISO: '2026-09-02T13:00:00.000Z',
  ubicacion: 'A-54',
  serial: 'OT3189-020926-S1',
};

describe('casillaMarcada — cuál de los tres cuadros se marca', () => {
  it('sirve para las dos cosas → se marca AMBAS y solo AMBAS', () => {
    expect(casillaMarcada({ roller: true, vertical: true })).toBe('ambas');
  });

  it('sirve para una sola → se marca esa', () => {
    expect(casillaMarcada({ roller: true, vertical: false })).toBe('roller');
    expect(casillaMarcada({ roller: false, vertical: true })).toBe('vertical');
  });

  it('no sirve para nada → ningún cuadro (no debería llegar a imprimirse)', () => {
    expect(casillaMarcada({ roller: false, vertical: false })).toBe(null);
  });

  it('lo que el operario marca vuelve a ser dato, y da la vuelta completa', () => {
    expect(funcionalDeMarca('ambas')).toEqual({ roller: true, vertical: true });
    expect(funcionalDeMarca('roller')).toEqual({ roller: true, vertical: false });
    expect(funcionalDeMarca('vertical')).toEqual({ roller: false, vertical: true });
    // Desmarcar todo es decir «no sirve»: el trozo se va a merma.
    expect(funcionalDeMarca('nada')).toEqual({ roller: false, vertical: false });
    for (const m of ['vertical', 'roller', 'ambas', 'nada'] as const) {
      expect(marcaDeFuncional(funcionalDeMarca(m))).toBe(m);
    }
  });
});

describe('formato de los datos', () => {
  it('la fecha va corta, como en el cartel a mano', () => {
    expect(fechaCorta('2026-09-02T13:00:00.000Z')).toBe('02-09-26');
    expect(fechaCorta('')).toBe('');
    expect(fechaCorta('cualquier cosa')).toBe('');
  });

  it('la medida se redondea al centímetro', () => {
    expect(medida(97.5)).toBe('98 cm');
    expect(medida(260)).toBe('260 cm');
  });

  it('las OTs del lote se resumen cuando son muchas', () => {
    expect(lineaOts([])).toBe('');
    expect(lineaOts(['3189', '3190'])).toBe('OT 3189 · OT 3190');
    expect(lineaOts(['1', '2', '3', '4', '5', '6'])).toBe('OT 1 · OT 2 · OT 3 · OT 4 +2');
  });
});

describe('htmlEtiquetasSobrante', () => {
  it('imprime todos los campos del cartel', () => {
    const html = htmlEtiquetasSobrante([base]);
    expect(html).toContain('BK 10');
    expect(html).toContain('98 cm');
    expect(html).toContain('260 cm');
    expect(html).toContain('OT 3189');
    expect(html).toContain('02-09-26');
    expect(html).toContain('A-54');
    expect(html).toContain('OT3189-020926-S1');
    expect(html).toContain('UBICACIÓN ASIGNADA');
    // El cuadro TIPO del cartel viejo quedó reemplazado por FUNCIONAL.
    expect(html).toContain('FUNCIONAL PARA:');
    expect(html).toContain('VERTICAL');
    expect(html).toContain('ROLLER');
    expect(html).toContain('AMBAS');
  });

  it('el papel es el rollo de 62 mm', () => {
    expect(htmlEtiquetasSobrante([base])).toContain('@page { size: 62mm 62mm; margin: 0; }');
  });

  it('el visto va en la casilla que corresponde, una sola vez', () => {
    const vert = htmlEtiquetasSobrante([base]);
    expect(vert.match(/class="visto"/g)).toHaveLength(1);
    // El visto se dibuja ANTES del rótulo de su casilla.
    expect(vert.indexOf('class="visto"')).toBeLessThan(vert.indexOf('VERTICAL'));

    const ambas = htmlEtiquetasSobrante([
      { ...base, funcional: { roller: true, vertical: true } },
    ]);
    expect(ambas.match(/class="visto"/g)).toHaveLength(1);
    expect(ambas.indexOf('class="visto"')).toBeGreaterThan(ambas.indexOf('ROLLER'));
  });

  it('N etiquetas son N páginas', () => {
    const html = htmlEtiquetasSobrante([base, { ...base, codigo: 'SC-D' }, base]);
    expect(html.match(/class="etiqueta"/g)).toHaveLength(3);
    expect(html).toContain('SC-D');
  });

  it('el lote imprime su nombre y las OTs que se cortaron juntas', () => {
    const html = htmlEtiquetasSobrante([
      { ...base, origen: 'LOTE Corte 02/09', otsDelLote: ['3189', '3190'] },
    ]);
    expect(html).toContain('LOTE Corte 02/09');
    expect(html).toContain('OT 3189 · OT 3190');
  });

  it('escapa el HTML de un código con símbolos', () => {
    const html = htmlEtiquetasSobrante([{ ...base, ubicacion: 'A<54>' }]);
    expect(html).toContain('A&lt;54&gt;');
    expect(html).not.toContain('A<54>');
  });
});

describe('etiquetaDesdePano — reimprimir uno que ya está en la colmena', () => {
  it('usa el funcional guardado cuando existe', () => {
    const e = etiquetaDesdePano({
      codigo: 'BK 10',
      medida_ancho: 98,
      medida_alto: 260,
      ubicacion: 'A-54',
      datos_extra: {
        ot_origen: 'OT 3189',
        creadoEn: '2026-09-02T13:00:00.000Z',
        serial: 'OT3189-020926-S1',
        funcional: { roller: true, vertical: false },
      },
    });
    expect(e.funcional).toEqual({ roller: true, vertical: false });
    expect(e.serial).toBe('OT3189-020926-S1');
  });

  it('un paño viejo (sin funcional guardado) lo recalcula de las medidas', () => {
    // Los paños del import del galpón y los del flujo clásico no lo tienen.
    const e = etiquetaDesdePano({
      codigo: 'SC 10',
      medida_ancho: 90,
      medida_alto: 260,
      ubicacion: 'B-12',
      created_at: '2026-08-01T10:00:00.000Z',
    });
    expect(e.funcional).toEqual({ roller: false, vertical: true });
    // Sin serial guardado la etiqueta sale con ese recuadro vacío, no inventa uno.
    expect(e.serial).toBe('');
    expect(e.fechaISO).toBe('2026-08-01T10:00:00.000Z');
  });

  it('un paño sin medidas no revienta', () => {
    const e = etiquetaDesdePano({ codigo: null, medida_ancho: null, medida_alto: null });
    expect(e).toMatchObject({ codigo: '', anchoCm: 0, altoCm: 0, ubicacion: '', origen: '' });
    expect(() => htmlEtiquetasSobrante([e])).not.toThrow();
  });
});
