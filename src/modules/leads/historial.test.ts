import { describe, expect, it } from 'vitest';
import { filtrarActividad, quienDe, textoActividad } from './historial';
import type { LeadActividad, LeadActividadTipo } from './types';

const GENESIS = 'p-genesis';
const nombres = new Map([
  [GENESIS, 'Génesis'],
  ['p-camila', 'Camila Rojas'],
]);

function act(tipo: LeadActividadTipo, detalle: Record<string, unknown>, registrado_por: string | null = GENESIS): LeadActividad {
  return {
    id: `a-${tipo}`,
    lead_id: 'l1',
    empresa_id: 'e1',
    tipo,
    detalle,
    registrado_por,
    created_at: '2026-09-16T14:32:00Z',
  };
}

describe('textoActividad — qué cambió', () => {
  it('estado de la cotización con nota y autor', () => {
    const l = textoActividad(
      act('cotizacion', { de: 'enviada', a: 'por_actualizar', version: 1, nota: 'agregar 1 cortina' }),
      nombres,
    );
    expect(l.titulo).toBe('Cotización: Enviada → Por actualizar');
    expect(l.detalle).toEqual(['agregar 1 cortina']);
    expect(l.quien).toBe('Génesis');
  });

  it('reenvío muestra la versión y el cambio del cliente', () => {
    const l = textoActividad(
      act('cotizacion', { de: 'por_actualizar', a: 'actualizada', version: 2, estado_de: 'cotizando', estado_a: 'cotizado' }),
      nombres,
    );
    expect(l.titulo).toBe('Cotización: Por actualizar → Actualizada (v2)');
    expect(l.detalle).toContain('El cliente pasó de Cotizando a Cotizado');
  });

  it('desde el Panel lo dice', () => {
    const l = textoActividad(act('cotizacion', { de: 'sin_enviar', a: 'enviada', version: 1, origen: 'ot' }), nombres);
    expect(l.desdeOt).toBe(true);
    expect(l.detalle).toContain('Al pasar la OT a «Esperando confirmación» en el Panel');
  });

  it('edición: una línea por campo, de → a', () => {
    const l = textoActividad(
      act('edicion', {
        campos: {
          instagram: { de: null, a: '@seba_bonilla' },
          monto: { de: 100000, a: 250000 },
        },
      }),
      nombres,
    );
    expect(l.titulo).toBe('Editó 2 datos');
    expect(l.detalle[0]).toBe('Instagram: — → @seba_bonilla');
    expect(l.detalle[1]).toMatch(/^Monto: \$\s?100\.000 → \$\s?250\.000$/);
  });

  it('edición de un solo campo lo nombra', () => {
    const l = textoActividad(act('edicion', { campos: { llamada_por: { de: 'Juan', a: 'Lisset' } } }), nombres);
    expect(l.titulo).toBe('Editó llamada');
    expect(l.detalle).toEqual(['Llamada: Juan → Lisset']);
  });

  it('asignación con nombres', () => {
    const l = textoActividad(act('asignacion', { de: GENESIS, a: 'p-camila' }), nombres);
    expect(l.titulo).toBe('Asignado a Camila Rojas');
    expect(l.detalle).toEqual(['Antes: Génesis']);
  });

  it('seguimiento con medio y nota', () => {
    const l = textoActividad(
      act('seguimiento', { n: 2, etapa: 2, resultado: 'no_respondio', medio: 'whatsapp', nota: 'Se deja audio' }),
      nombres,
    );
    expect(l.titulo).toBe('Seguimiento 2 por WhatsApp: No respondió');
    expect(l.detalle).toEqual(['Se deja audio']);
  });

  it('seguimiento viejo sin medio ni n usa la etapa', () => {
    const l = textoActividad(act('seguimiento', { etapa: 1, resultado: 'respondio' }, null), nombres);
    expect(l.titulo).toBe('Seguimiento 1: Respondió (sigue interesado)');
    expect(l.quien).toBe('Sistema');
  });

  it('cambio de estado desde la OT', () => {
    const l = textoActividad(
      act('cambio_estado', { de: 'cotizado', a: 'ganado', origen: 'ot', numero_ot: '#3221' }),
      nombres,
    );
    expect(l.titulo).toBe('Estado: Cotizado → Ganado');
    expect(l.detalle).toContain('Al mover la OT #3221 en el Panel');
  });

  it('fila creada por la carga inicial', () => {
    const l = textoActividad(act('creado', { origen: 'ot', numero_ot: '3245', relleno: true }, null), nombres);
    expect(l.titulo).toBe('Fila creada desde la OT 3245');
    expect(l.quien).toBe('Carga inicial');
  });
});

describe('quienDe', () => {
  it('persona desconocida no queda en blanco', () => {
    expect(quienDe({ registrado_por: 'otro', detalle: {} }, nombres)).toBe('Alguien del equipo');
  });

  it('archivado automático', () => {
    expect(quienDe({ registrado_por: null, detalle: { accion: 'archivado_auto' } }, nombres)).toBe('Automático');
  });
});

describe('filtrarActividad', () => {
  const todas = [
    act('cotizacion', {}),
    act('seguimiento', {}),
    act('edicion', {}),
    act('comentario', {}),
    act('creado', {}),
  ];

  it('separa cotización, seguimientos y cambios', () => {
    expect(filtrarActividad(todas, 'todo')).toHaveLength(5);
    expect(filtrarActividad(todas, 'cotizacion').map((a) => a.tipo)).toEqual(['cotizacion']);
    expect(filtrarActividad(todas, 'seguimientos').map((a) => a.tipo)).toEqual(['seguimiento', 'comentario']);
    expect(filtrarActividad(todas, 'cambios').map((a) => a.tipo)).toEqual(['edicion']);
  });
});
