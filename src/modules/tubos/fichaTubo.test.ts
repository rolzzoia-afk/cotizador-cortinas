import { describe, expect, it } from 'vitest';
import {
  cm,
  esTuboBlanco,
  esTuboGris,
  fechaCorta,
  mezclaGrisYBlanco,
  nombreFuente,
  pasoDeEvento,
  recorridoDeTubo,
  type EventoTubo,
} from './fichaTubo';

function ev(p: Partial<EventoTubo> & { id: string; evento: string }): EventoTubo {
  return {
    cod: 'E02',
    n_colmena: 'A1',
    medida_cm: 154.2,
    medida_resultado_cm: 154.2,
    ot: null,
    notas: null,
    fuente: 'optimizador',
    created_at: '2026-07-22T10:00:00.000Z',
    ...p,
  };
}

describe('nombreFuente', () => {
  it('traduce las fuentes que existen en producción', () => {
    expect(nombreFuente('optimizador')).toBe('optimizador de corte');
    expect(nombreFuente('optimizador_nuevo')).toBe('optimizador de corte');
    expect(nombreFuente('carga_inicial')).toBe('carga inicial del taller');
    expect(nombreFuente('ingreso_retroactivo_auto')).toBe('ingreso retroactivo automático');
  });

  it('agrupa las familias de recuperación y de carga masiva', () => {
    expect(nombreFuente('recovery_wipe_20260831')).toBe('recuperación manual');
    expect(nombreFuente('restauracion_manual_29_05_v3')).toBe('recuperación manual');
    expect(nombreFuente('backfill_colmena_rieles_20260727')).toBe('carga masiva');
  });

  it('una fuente que no conoce se muestra tal cual, y la vacía no ensucia', () => {
    expect(nombreFuente('otra_cosa')).toBe('otra_cosa');
    expect(nombreFuente(null)).toBe('');
  });
});

describe('cm', () => {
  it('un decimal como máximo, con coma', () => {
    expect(cm(154.2)).toBe('154,2');
    expect(cm(300)).toBe('300');
  });

  it('sin medida no muestra un cero', () => {
    expect(cm(null)).toBe('—');
  });
});

describe('fechaCorta', () => {
  it('escribe la fecha como se lee en el taller', () => {
    expect(fechaCorta('2026-05-14T12:00:00.000Z')).toBe('14-05-2026');
  });

  it('una fecha que no se entiende no muestra «Invalid Date»', () => {
    expect(fechaCorta('ayer')).toBe('');
    expect(fechaCorta(null)).toBe('');
  });
});

describe('pasoDeEvento', () => {
  it('el corte se nombra por su OT', () => {
    const p = pasoDeEvento(
      ev({ id: '1', evento: 'corte', ot: '3054', medida_resultado_cm: 0 }),
    );
    expect(p.titulo).toBe('Corte · OT 3054');
    expect(p.tono).toBe('corte');
  });

  it('el sobrante dice a qué estante vuelve', () => {
    const p = pasoDeEvento(ev({ id: '1', evento: 'sobrante', n_colmena: 'A28', ot: '3055' }));
    expect(p.titulo).toBe('Sobrante · vuelve a A28');
  });

  it('cuando el largo cambia se muestran los dos, y si no, uno solo', () => {
    expect(pasoDeEvento(ev({ id: '1', evento: 'corte', medida_resultado_cm: 0 })).medidas).toBe(
      '154,2 → 0 cm',
    );
    expect(pasoDeEvento(ev({ id: '2', evento: 'ingreso' })).medidas).toBe('154,2 cm');
  });

  it('NO recalcula el largo cortado: la resta no lo da, parte se fue en merma', () => {
    // 154,2 → 0 con un corte real de 151,2 y 2,7 de merma: el 154,2 de la
    // resta sería mentira. El largo real solo viaja en la nota.
    const p = pasoDeEvento(
      ev({
        id: '1',
        evento: 'corte',
        ot: '3054',
        medida_resultado_cm: 0,
        notas: 'Corte de 151.2cm para OT 3054 — MERMA',
      }),
    );
    expect(p.titulo).not.toContain('154');
    expect(p.nota).toBe('Corte de 151.2cm para OT 3054 — MERMA');
  });

  it('junta la fecha con la fuente en una línea', () => {
    const p = pasoDeEvento(ev({ id: '1', evento: 'ingreso', fuente: 'carga_inicial' }));
    expect(p.detalle).toBe('22-07-2026 · carga inicial del taller');
  });

  it('sin fuente no deja el separador colgando', () => {
    const p = pasoDeEvento(ev({ id: '1', evento: 'ingreso', fuente: null }));
    expect(p.detalle).toBe('22-07-2026');
  });
});

describe('recorridoDeTubo', () => {
  const eventos = [
    ev({ id: 'c', evento: 'corte', created_at: '2026-07-22T12:00:00.000Z' }),
    ev({ id: 'a', evento: 'ingreso', created_at: '2026-05-14T09:00:00.000Z' }),
    ev({ id: 'b', evento: 'sobrante', created_at: '2026-07-22T11:00:00.000Z' }),
  ];

  it('ordena por cuándo se registró cada evento', () => {
    const r = recorridoDeTubo(eventos, { enColmena: true, dias: 48 });
    expect(r.map((p) => p.id)).toEqual(['a', 'b', 'c', 'hoy']);
  });

  it('el paso de hoy dice cuántos días lleva en el estante', () => {
    const r = recorridoDeTubo(eventos, { enColmena: true, dias: 48 });
    const hoy = r[r.length - 1];
    expect(hoy.esHoy).toBe(true);
    expect(hoy.titulo).toBe('Hoy · esperando el próximo corte');
    expect(hoy.detalle).toBe('48 días en el estante');
  });

  it('un solo día se escribe en singular', () => {
    const r = recorridoDeTubo(eventos, { enColmena: true, dias: 1 });
    expect(r[r.length - 1].detalle).toBe('1 día en el estante');
  });

  it('sin fecha de ingreso lo dice, no muestra «null días»', () => {
    const r = recorridoDeTubo(eventos, { enColmena: true, dias: null });
    expect(r[r.length - 1].detalle).toBe('sin fecha de ingreso registrada');
  });

  it('un tubo que ya no está en la colmena no lleva paso de hoy', () => {
    const r = recorridoDeTubo(eventos, { enColmena: false, dias: null });
    expect(r.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('sin eventos y fuera de la colmena, el recorrido queda vacío', () => {
    expect(recorridoDeTubo([], { enColmena: false, dias: null })).toEqual([]);
  });
});

describe('la regla del gris y el blanco', () => {
  it('el E03 es el blanco; E01/E02/E39/E66/E78 son los grises', () => {
    expect(esTuboBlanco('E03')).toBe(true);
    expect(esTuboBlanco('e 03')).toBe(true);
    expect(esTuboGris('E39')).toBe(true);
    expect(esTuboGris('E03')).toBe(false);
  });

  it('un código que no es tubo no es ni gris ni blanco', () => {
    expect(esTuboBlanco('E13')).toBe(false);
    expect(esTuboGris('E13')).toBe(false);
    expect(esTuboGris(null)).toBe(false);
  });

  it('avisa cuando un estante junta blanco con gris', () => {
    expect(mezclaGrisYBlanco([{ cod: 'E03' }, { cod: 'E39' }])).toBe(true);
  });

  it('un estante de un solo color no dispara el aviso', () => {
    expect(mezclaGrisYBlanco([{ cod: 'E39' }, { cod: 'E02' }, { cod: 'E01' }])).toBe(false);
    expect(mezclaGrisYBlanco([{ cod: 'E03' }, { cod: 'E03' }])).toBe(false);
  });

  it('los pesos y las cenefas conviven con cualquier color', () => {
    expect(mezclaGrisYBlanco([{ cod: 'E03' }, { cod: 'E13' }, { cod: 'E27' }])).toBe(false);
  });
});
