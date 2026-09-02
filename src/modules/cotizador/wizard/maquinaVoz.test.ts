import { describe, expect, it } from 'vitest';
import {
  ESTADO_VOZ_INICIAL,
  esEco,
  reducirVoz,
  type EstadoVoz,
  type EventoVoz,
} from './maquinaVoz';

/** Corre una secuencia de eventos y devuelve el estado + los últimos efectos. */
function correr(eventos: EventoVoz[], desde: EstadoVoz = ESTADO_VOZ_INICIAL) {
  let estado = desde;
  let efectos: ReturnType<typeof reducirVoz>['efectos'] = [];
  for (const e of eventos) {
    const r = reducirVoz(estado, e);
    estado = r.estado;
    efectos = r.efectos;
  }
  return { estado, efectos };
}

describe('el ciclo feliz', () => {
  it('encender → preguntar → escuchar → interpretar', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va esta cortina?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
    ]);
    expect(estado.fase).toBe('escuchando');
    expect(estado.pregunta).toBe('¿Dónde va esta cortina?');
    expect(estado.campo).toBe('ventana.ubicacion');
    expect(efectos).toEqual([{ tipo: 'ESCUCHAR' }]);
  });

  it('el resultado deja el estado listo para interpretar', () => {
    const { estado } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va esta cortina?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'RESULTADO', texto: 'pieza uno' },
    ]);
    expect(estado.fase).toBe('interpretando');
    expect(estado.dicho).toBe('pieza uno');
  });

  it('un campo atendido no vuelve a la cola y limpia los fallos', () => {
    const { estado } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'RESULTADO', texto: 'pieza uno' },
      { tipo: 'ATENDIDO', campo: 'ventana.ubicacion' },
    ]);
    expect(estado.atendidos).toEqual(['ventana.ubicacion']);
    expect(estado.fallos).toBe(0);
  });
});

describe('el eco del parlante', () => {
  it('lo que la app acaba de decir se descarta y se sigue escuchando', () => {
    const dicho = 'la cadena queda a la izquierda o a la derecha';
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿La cadena queda a la izquierda o a la derecha?', campo: 'pano.cierreVert' },
      { tipo: 'TTS_FIN' },
      { tipo: 'RESULTADO', texto: dicho },
    ]);
    expect(estado.fase).toBe('escuchando');
    expect(efectos).toEqual([{ tipo: 'ESCUCHAR' }]);
  });

  it('una respuesta corta NO se confunde con el eco aunque esté en la pregunta', () => {
    const { estado } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿La cadena queda a la izquierda o a la derecha?', campo: 'pano.cierreVert' },
      { tipo: 'TTS_FIN' },
      { tipo: 'RESULTADO', texto: 'izquierda' },
    ]);
    expect(estado.fase).toBe('interpretando');
  });

  it('esEco compara frases largas, no palabras sueltas', () => {
    expect(esEco('cuánto mide de ancho', '¿Cuánto mide de ancho?')).toBe(true);
    expect(esEco('ancho', '¿Cuánto mide de ancho?')).toBe(false);
    expect(esEco('', 'lo que sea')).toBe(false);
  });

  it('una respuesta que CITA una opción de la pregunta NO es eco', () => {
    // Regresión: «dentro del marco» tiene sus 3 palabras dentro de la pregunta
    // y el filtro viejo se la comía; el vendedor la repetía sin resultado.
    const pregunta = '¿Va dentro del marco, fuera del marco, o no aplica?';
    expect(esEco('dentro del marco', pregunta)).toBe(false);
    expect(esEco('fuera del marco', pregunta)).toBe(false);
    expect(esEco('cuadrada a muro', '¿Cuadrada a muro, cuadrada a techo, ovalada o no lleva?')).toBe(false);
  });

  it('la pregunta rebotada (entera o su cola) sí es eco', () => {
    const pregunta = '¿Va dentro del marco, fuera del marco, o no aplica?';
    expect(esEco('va dentro del marco fuera del marco o no aplica', pregunta)).toBe(true);
    // El micrófono alcanzó a oír el final del parlante.
    expect(esEco('fuera del marco o no aplica', pregunta)).toBe(true);
  });
});

describe('cuando no se entiende', () => {
  const preguntar: EventoVoz[] = [
    { tipo: 'ENCENDER' },
    { tipo: 'HABLAR', texto: '¿Cuánto mide de ancho?', campo: 'pano.ancho' },
    { tipo: 'TTS_FIN' },
  ];

  it('el primer fallo vuelve a preguntar', () => {
    const { estado, efectos } = correr([...preguntar, { tipo: 'NO_ENTENDI', texto: 'No te entendí.' }]);
    expect(estado.fase).toBe('hablando');
    expect(estado.fallos).toBe(1);
    expect(efectos).toEqual([{ tipo: 'HABLAR', texto: 'No te entendí.', luegoEscuchar: true }]);
  });

  it('al tercer fallo el micrófono se pausa', () => {
    const { estado, efectos } = correr([
      ...preguntar,
      { tipo: 'NO_ENTENDI', texto: 'No te entendí.' },
      { tipo: 'NO_ENTENDI', texto: 'No te entendí.' },
      { tipo: 'NO_ENTENDI', texto: 'Toca el micrófono para seguir.' },
    ]);
    expect(estado.fase).toBe('pausado');
    expect(efectos[0]).toEqual({ tipo: 'CANCELAR' });
    expect(efectos[1]).toEqual({
      tipo: 'HABLAR',
      texto: 'Toca el micrófono para seguir.',
      luegoEscuchar: false,
    });
  });

  it('en pausa, el fin del habla NO reabre el micrófono', () => {
    const { estado, efectos } = correr([
      ...preguntar,
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'TTS_FIN' },
    ]);
    expect(estado.fase).toBe('pausado');
    expect(efectos).toEqual([]);
  });

  it('reanudar vuelve a escuchar', () => {
    const { estado, efectos } = correr([
      ...preguntar,
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'NO_ENTENDI', texto: 'x' },
      { tipo: 'REANUDAR' },
    ]);
    expect(estado.fase).toBe('escuchando');
    expect(estado.fallos).toBe(0);
    expect(efectos).toEqual([{ tipo: 'ESCUCHAR' }]);
  });
});

describe('el silencio', () => {
  it('pausar no cuenta como fallo: el micrófono queda esperando un toque', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'PAUSAR', texto: 'Dejo el micrófono en pausa.' },
    ]);
    expect(estado.fase).toBe('pausado');
    expect(estado.fallos).toBe(0);
    expect(efectos[0]).toEqual({ tipo: 'CANCELAR' });
    expect(efectos[1]).toEqual({
      tipo: 'HABLAR',
      texto: 'Dejo el micrófono en pausa.',
      luegoEscuchar: false,
    });
  });

  it('la pregunta en pantalla se conserva al pausar', () => {
    const { estado } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'PAUSAR', texto: 'x' },
    ]);
    expect(estado.pregunta).toBe('¿Dónde va?');
    expect(estado.campo).toBe('ventana.ubicacion');
  });
});

describe('errores del reconocedor', () => {
  it('sin permiso de micrófono se apaga y avisa', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'ERROR_ASR', error: 'not-allowed', texto: 'Falta el permiso del micrófono.' },
    ]);
    expect(estado.fase).toBe('apagado');
    expect(estado.aviso).toBe('Falta el permiso del micrófono.');
    expect(efectos).toContainEqual({ tipo: 'AVISO', texto: 'Falta el permiso del micrófono.' });
  });

  it('el silencio cuenta como intento fallido', () => {
    const { estado } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'ERROR_ASR', error: 'no-speech', texto: 'No te escuché.' },
    ]);
    expect(estado.fallos).toBe(1);
    expect(estado.fase).toBe('hablando');
  });
});

describe('ambigüedad', () => {
  it('lee los candidatos y espera el número', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Qué cenefa lleva?', campo: 'pano.cenefa' },
      { tipo: 'TTS_FIN' },
      { tipo: 'RESULTADO', texto: 'cuadrada' },
      {
        tipo: 'AMBIGUO',
        texto: '¿Cuál? Uno: Cuadrada a muro. Dos: Cuadrada a techo.',
        candidatos: [
          { valor: 'Cuadrada a muro', etiqueta: 'Cuadrada a muro' },
          { valor: 'Cuadrada a techo', etiqueta: 'Cuadrada a techo' },
        ],
      },
      { tipo: 'TTS_FIN' },
    ]);
    expect(estado.fase).toBe('desambiguando');
    expect(estado.candidatos).toHaveLength(2);
    expect(efectos).toEqual([{ tipo: 'ESCUCHAR' }]);
  });
});

describe('paso listo y cambios de paso', () => {
  it('sin más preguntas se queda esperando una orden, con el micrófono abierto', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: 'Paso listo. ¿Sigo con Soportes?', campo: null, luegoEscuchar: false },
      { tipo: 'TTS_FIN' },
    ]);
    expect(estado.fase).toBe('esperandoOrden');
    expect(efectos).toEqual([{ tipo: 'ESCUCHAR' }]);
  });

  it('cambiar de paso cancela lo que estaba sonando y limpia lo atendido', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'TTS_FIN' },
      { tipo: 'ATENDIDO', campo: 'ventana.ubicacion' },
      { tipo: 'REINICIAR' },
    ]);
    expect(estado.fase).toBe('esperandoOrden');
    expect(estado.atendidos).toEqual([]);
    expect(efectos).toEqual([{ tipo: 'CANCELAR' }]);
  });

  it('apagar corta todo desde cualquier fase', () => {
    const { estado, efectos } = correr([
      { tipo: 'ENCENDER' },
      { tipo: 'HABLAR', texto: '¿Dónde va?', campo: 'ventana.ubicacion' },
      { tipo: 'APAGAR' },
    ]);
    expect(estado).toEqual(ESTADO_VOZ_INICIAL);
    expect(efectos).toEqual([{ tipo: 'CANCELAR' }]);
  });

  it('con el asistente apagado, los eventos en vuelo se ignoran', () => {
    const { estado, efectos } = correr([{ tipo: 'TTS_FIN' }, { tipo: 'RESULTADO', texto: 'hola' }]);
    expect(estado).toEqual(ESTADO_VOZ_INICIAL);
    expect(efectos).toEqual([]);
  });
});
