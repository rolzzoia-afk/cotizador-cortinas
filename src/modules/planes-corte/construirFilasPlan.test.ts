import { describe, expect, it } from 'vitest';
import {
  construirFilasPlan,
  estiloFilaPlan,
  extraerOTsDePlan,
  type PlanParaExportar,
  type ResultadoItem,
} from './construirFilasPlan';

function plan(resultados: ResultadoItem[], ordenes: PlanParaExportar['ordenes'] = []) {
  return { fecha: '2026-08-26T12:00:00Z', resultados, ordenes };
}

/** Un corte simple desde la colmena, con la orden pegada al resultado. */
function corte(over: Partial<ResultadoItem> = {}, orden: Record<string, unknown> = {}) {
  return {
    orden: { id: '1', ot: '#3197', ubic: 'LIVING', cod: 'E02', componente: 'TUBO', ...orden },
    resultado: {
      codigo: 'E02',
      color: 'Aluminio',
      colmena: 'A33',
      fuente: 'colmena',
      medida_cm: 120,
      medida_origen: 430,
      ...over,
    },
  } as ResultadoItem;
}

describe('construirFilasPlan', () => {
  it('un corte sin sobrante es una sola fila con las 13 celdas del Excel', () => {
    const [fila, ...resto] = construirFilasPlan(plan([corte()]));
    expect(resto).toHaveLength(0);
    expect(fila.tipo).toBe('corte');
    expect(fila.clave).toBe('r0');
    expect(fila.celdas.ot).toBe('#3197');
    expect(fila.celdas.ubicacion).toBe('LIVING');
    expect(fila.celdas.accion).toBe('CORTAR');
    expect(fila.celdas.colmena).toBe('A33');
    expect(fila.celdas.medidaCm).toBe(120);
    expect(fila.celdas.origenCm).toBe(430);
    // Sin serial la fila no queda con huecos: el taller lee guiones.
    expect(fila.celdas.lote).toBe('-');
    expect(fila.celdas.fechaSerial).toBe('-');
  });

  it('el sobrante acompaña a su corte y comparte el índice', () => {
    const filas = construirFilasPlan(plan([corte({ sobrante_cm: 200, colmena_sobrante: 'B12' })]));
    expect(filas.map((f) => f.clave)).toEqual(['r0', 'r0:s']);
    expect(filas[1].tipo).toBe('sobrante');
    expect(filas[1].celdas.accion).toBe('GUARDAR SOBRANTE');
    expect(filas[1].celdas.colmena).toBe('B12');
    expect(filas[1].celdas.medidaCm).toBe(200);
  });

  it('un sobrante de 10 cm o menos es MERMA aunque el plan no lo diga', () => {
    const filas = construirFilasPlan(plan([corte({ sobrante_cm: 8, es_desecho: false })]));
    expect(filas[1].tipo).toBe('merma');
    expect(filas[1].celdas.accion).toBe('DESECHAR MERMA');
    expect(filas[1].celdas.colmena).toBe('BASURERO');
    expect(estiloFilaPlan(filas[1])).toBe('merma');
  });

  it('el sobrante intermedio se reserva en mesa, sin colmena de destino', () => {
    const filas = construirFilasPlan(
      plan([corte({ sobrante_cm: 306, es_intermedio: true, colmena_sobrante: 'A33' })]),
    );
    expect(filas[1].tipo).toBe('reserva-mesa');
    expect(filas[1].celdas.accion).toBe('RESERVAR EN MESA');
    expect(filas[1].celdas.colmena).toBe('-');
  });

  it('un tubo nuevo se rotula como tal y la colmena dice de dónde sale', () => {
    const filas = construirFilasPlan(
      plan([corte({ fuente: 'tubo_nuevo', nombreMaterialNuevo: 'TUBO 45 x 6 MTS' })]),
    );
    expect(filas[0].celdas.accion).toBe('TUBO NUEVO');
    expect(filas[0].celdas.colmena).toBe('TUBO 45 x 6 MTS');
  });

  it('un reemplazo con tubo nuevo deja los dos códigos a la vista', () => {
    const filas = construirFilasPlan(
      plan([
        corte({
          fuente: 'reemplazo',
          codigo: 'E39',
          codigo_original: 'E66',
          codigo_reemplazo: 'E39',
          es_reemplazo_desde_colmena: false,
        }),
      ]),
    );
    expect(filas[0].celdas.accion).toBe('TUBO NUEVO (REEMPLAZO E66 → E39)');
    expect(filas[0].celdas.codigo).toBe('E66 → E39');
  });

  it('el componente que no es TUBO se nombra en la acción', () => {
    const filas = construirFilasPlan(plan([corte({}, { componente: 'CENEFA DELANTERA' })]));
    expect(filas[0].celdas.accion).toBe('CORTAR CENEFA DELANTERA');
  });

  describe('CON TIRA', () => {
    it('se agrega solo en la cenefa ovalada', () => {
      const filas = construirFilasPlan(
        plan([corte({}, { componente: 'CENEFA OVALADA', con_tira: 'SI' })]),
      );
      expect(filas[0].celdas.accion).toBe('CORTAR CENEFA OVALADA CON TIRA');
      expect(filas[0].conTira).toBe(true);
      expect(estiloFilaPlan(filas[0])).toBe('con-tira');
    });

    it('marcada en otro componente no cambia nada', () => {
      const filas = construirFilasPlan(
        plan([corte({}, { componente: 'CENEFA DELANTERA', con_tira: 'X' })]),
      );
      expect(filas[0].celdas.accion).toBe('CORTAR CENEFA DELANTERA');
      expect(filas[0].conTira).toBe(false);
    });
  });

  describe('reorden de MESA', () => {
    // El corte que come de la mesa aparece ANTES en el plan que el corte que
    // deja ese sobrante: sin reordenar, el operario busca en la mesa algo que
    // todavía no dejó ahí.
    const consumidor = corte(
      { colmena: 'MESA', medida_cm: 90, medida_origen: 306 },
      { id: '2', ubic: 'ESTUDIO' },
    );
    const productor = corte({
      colmena: 'A33',
      medida_cm: 124,
      medida_origen: 430,
      sobrante_cm: 306,
      es_intermedio: true,
    });

    it('sube el productor por encima del consumidor', () => {
      const filas = construirFilasPlan(plan([consumidor, productor]));
      expect(filas.map((f) => f.clave)).toEqual(['r1', 'r1:s', 'r0']);
      expect(filas[1].celdas.accion).toBe('RESERVAR EN MESA');
      expect(filas[2].celdas.colmena).toBe('MESA');
    });

    it('las claves siguen el índice original, no la posición final', () => {
      const filas = construirFilasPlan(plan([consumidor, productor]));
      // El consumidor era resultados[0] y quedó último: su clave sigue siendo r0.
      expect(filas[2].idx).toBe(0);
      expect(filas[2].clave).toBe('r0');
    });

    it('si ya venía en orden no mueve nada', () => {
      const filas = construirFilasPlan(plan([productor, consumidor]));
      expect(filas.map((f) => f.clave)).toEqual(['r0', 'r0:s', 'r1']);
    });
  });

  it('un plan vacío no revienta', () => {
    expect(construirFilasPlan(plan([]))).toEqual([]);
  });
});

describe('estiloFilaPlan', () => {
  it('un corte normal no se pinta', () => {
    expect(estiloFilaPlan(construirFilasPlan(plan([corte()]))[0])).toBe(null);
  });

  it('un corte que sale de la mesa se pinta como mesa', () => {
    const filas = construirFilasPlan(plan([corte({ colmena: 'MESA' })]));
    expect(estiloFilaPlan(filas[0])).toBe('mesa');
  });

  it('la mesa le gana a la tira, como en el Excel', () => {
    const filas = construirFilasPlan(
      plan([corte({ colmena: 'MESA' }, { componente: 'CENEFA OVALADA', con_tira: 'SI' })]),
    );
    expect(filas[0].conTira).toBe(true);
    expect(estiloFilaPlan(filas[0])).toBe('mesa');
  });
});

describe('extraerOTsDePlan', () => {
  it('saca la OT de la orden pegada al resultado', () => {
    expect(extraerOTsDePlan(plan([corte()]))).toEqual(['#3197']);
  });

  it('resuelve la orden referenciada por id', () => {
    const p = plan(
      [{ orden: '7', resultado: { codigo: 'E02' } } as ResultadoItem],
      [{ id: '7', ot: '3202' }],
    );
    expect(extraerOTsDePlan(p)).toEqual(['3202']);
  });

  it('no repite y descarta los guiones', () => {
    const p = plan([corte(), corte({}, { id: '9' }), corte({}, { id: '9', ot: '-' })]);
    expect(extraerOTsDePlan(p)).toEqual(['#3197']);
  });

  it('una celda con dos OTs escritas a mano se parte en dos', () => {
    const p = plan([corte({}, { ot: '3054- SERV\r\n3061- SERV' })]);
    expect(extraerOTsDePlan(p)).toEqual(['3054- SERV', '3061- SERV']);
  });
});
