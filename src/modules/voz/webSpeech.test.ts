import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearReconocedor, elegirVozDe, partirEnFrases, soporteVoz } from './webSpeech';

/** Reconocedor de mentira, con la misma coreografía de eventos que Chrome. */
class ReconocedorFalso {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  static ultimo: ReconocedorFalso | null = null;

  constructor() {
    ReconocedorFalso.ultimo = this;
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  /** Chrome avisa 'aborted' y ENSEGUIDA cierra: las dos cosas, en ese orden. */
  abort() {
    this.onerror?.({ error: 'aborted' });
    this.onend?.();
  }
  decir(texto: string) {
    this.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: texto } } },
    });
  }
}

beforeEach(() => {
  ReconocedorFalso.ultimo = null;
  (globalThis as { window?: unknown }).window = { SpeechRecognition: ReconocedorFalso };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('soporteVoz', () => {
  it('sin navegador no hay nada que ofrecer', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(soporteVoz()).toEqual({ escuchar: false, hablar: false });
  });
});

describe('elegirVozDe', () => {
  it('prefiere la voz natural antes que la instalada en el equipo', () => {
    const elegida = elegirVozDe([
      { name: 'Microsoft Helena - Spanish (Spain)', lang: 'es-ES', localService: true },
      { name: 'Microsoft Dalia Online (Natural) - Spanish (Mexico)', lang: 'es-MX', localService: false },
    ]);
    expect(elegida?.name).toContain('Natural');
  });

  it('entre dos naturales, la más cercana a como se habla acá', () => {
    const elegida = elegirVozDe([
      { name: 'Google español de España', lang: 'es-ES', localService: false },
      { name: 'Google español de Latinoamérica', lang: 'es-419', localService: false },
    ]);
    expect(elegida?.lang).toBe('es-419');
  });

  it('nunca elige una voz de otro idioma', () => {
    expect(
      elegirVozDe([
        { name: 'Google US English', lang: 'en-US', localService: false },
        { name: 'Microsoft Sabina', lang: 'es-MX', localService: true },
      ])?.lang,
    ).toBe('es-MX');
  });

  it('sin ninguna voz en castellano no se fuerza nada', () => {
    expect(elegirVozDe([{ name: 'Google US English', lang: 'en-US' }])).toBe(null);
  });

  it('descarta las voces metálicas viejas si hay algo mejor', () => {
    const elegida = elegirVozDe([
      { name: 'eSpeak Spanish', lang: 'es-CL', localService: true },
      { name: 'Google español', lang: 'es-ES', localService: false },
    ]);
    expect(elegida?.name).toBe('Google español');
  });
});

describe('partirEnFrases', () => {
  it('parte por los puntos y respeta los signos', () => {
    expect(
      partirEnFrases('Ventana y medidas. El modelo quedó en ROL SIMPLE. ¿Dónde va esta cortina?'),
    ).toEqual([
      'Ventana y medidas.',
      'El modelo quedó en ROL SIMPLE.',
      '¿Dónde va esta cortina?',
    ]);
  });

  it('una frase corta se dice de una sola vez', () => {
    expect(partirEnFrases('¿Cuánto mide de ancho?')).toEqual(['¿Cuánto mide de ancho?']);
  });

  it('ninguna parte pasa del largo máximo, y no se corta una palabra', () => {
    const largo = `No entendí. Las opciones son: ${Array.from({ length: 40 }, (_, i) => `opcion${i}`).join(', ')}.`;
    const partes = partirEnFrases(largo);
    expect(partes.every((p) => p.length <= 140)).toBe(true);
    // Nada se pierde: todas las palabras siguen estando.
    expect(partes.join(' ').replace(/\s+/g, ' ')).toContain('opcion39');
  });

  it('un texto sin puntuación igual sale entero', () => {
    expect(partirEnFrases('pieza uno')).toEqual(['pieza uno']);
  });
});

describe('crearReconocedor', () => {
  it('un corte pedido por nosotros NO cuenta como «no te escuché»', () => {
    // Sin esto, tres cambios de paso seguidos pausaban el asistente solo.
    const onError = vi.fn();
    const rec = crearReconocedor({ onFinal: vi.fn(), onError })!;
    rec.escuchar();
    rec.abortar();
    expect(onError).not.toHaveBeenCalled();
  });

  it('el silencio de verdad sí cuenta como intento fallido', () => {
    const onError = vi.fn();
    const rec = crearReconocedor({ onFinal: vi.fn(), onError })!;
    rec.escuchar();
    ReconocedorFalso.ultimo!.onend?.();
    expect(onError).toHaveBeenCalledWith('no-speech');
  });

  it('lo entendido no dispara ningún error al cerrarse', () => {
    const onError = vi.fn();
    const onFinal = vi.fn();
    const rec = crearReconocedor({ onFinal, onError })!;
    rec.escuchar();
    ReconocedorFalso.ultimo!.decir('pieza uno');
    ReconocedorFalso.ultimo!.onend?.();
    expect(onFinal).toHaveBeenCalledWith('pieza uno', []);
    expect(onError).not.toHaveBeenCalled();
  });

  it('el final repetido de Android se descarta', () => {
    const onFinal = vi.fn();
    const rec = crearReconocedor({ onFinal, onError: vi.fn() })!;
    rec.escuchar();
    ReconocedorFalso.ultimo!.decir('dos metros');
    ReconocedorFalso.ultimo!.decir('dos metros');
    expect(onFinal).toHaveBeenCalledTimes(1);
  });

  it('se configura en castellano de Chile y de a una respuesta', () => {
    crearReconocedor({ onFinal: vi.fn(), onError: vi.fn() });
    const r = ReconocedorFalso.ultimo!;
    expect(r.lang).toBe('es-CL');
    // Con `continuous` el micrófono queda abierto mientras la app habla y se
    // transcribe a sí misma.
    expect(r.continuous).toBe(false);
    expect(r.maxAlternatives).toBe(3);
  });
});
