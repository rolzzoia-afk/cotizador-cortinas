// ─────────────────────────────────────────────────────────────────────
// LA CONVERSACIÓN — máquina de estados pura del asistente de voz.
//
// Ordena el ida y vuelta: hablar → escuchar → interpretar → confirmar →
// siguiente pregunta. No sabe QUÉ preguntar (eso lo arma `voz.ts` con el
// contexto fresco del wizard) ni cómo hablar (eso es `webSpeech.ts`): solo
// decide en qué estado queda la conversación y qué hay que hacer después.
//
// Lo que se resuelve acá y no se puede resolver en el hook sin volverse loco:
// el eco del parlante (el micrófono se oye a sí mismo), los reintentos antes
// de rendirse, y que un cambio de paso cancele lo que estaba sonando.
// ─────────────────────────────────────────────────────────────────────
import { normalizarVoz } from './vozParsers';

export type FaseVoz =
  | 'apagado'
  | 'hablando'
  | 'escuchando'
  | 'interpretando'
  | 'desambiguando'
  | 'esperandoOrden'
  | 'pausado';

export type CandidatoVoz = { valor: string; etiqueta: string };

export type EstadoVoz = {
  fase: FaseVoz;
  /** La pregunta en curso, tal como se muestra en pantalla. */
  pregunta: string;
  /** Campo que se está preguntando; null = anuncio o espera de orden. */
  campo: string | null;
  /** Lo último que se escuchó (se muestra en vivo). */
  dicho: string;
  /** Opciones leídas cuando la respuesta fue ambigua: se eligen por número. */
  candidatos: CandidatoVoz[];
  /** Campos ya atendidos en este paso: respondidos, saltados o en blanco. */
  atendidos: string[];
  /** Intentos seguidos sin entender. A los 3 se pausa y se pide un toque. */
  fallos: number;
  /** Lo último que dijo la app: sirve para descartar su propio eco. */
  ultimoHablado: string;
  /** Al terminar de hablar, ¿hay que abrir el micrófono esperando respuesta? */
  escucharAlTerminar: boolean;
  /** Aviso corto para la pantalla (no se habla). */
  aviso: string;
};

export type EfectoVoz =
  | { tipo: 'HABLAR'; texto: string; luegoEscuchar: boolean }
  | { tipo: 'ESCUCHAR' }
  | { tipo: 'CANCELAR' }
  | { tipo: 'AVISO'; texto: string };

export type EventoVoz =
  | { tipo: 'ENCENDER' }
  | { tipo: 'APAGAR' }
  /** Preguntar por un campo (`campo`) o simplemente decir algo (`campo: null`). */
  | { tipo: 'HABLAR'; texto: string; campo?: string | null; luegoEscuchar?: boolean }
  | { tipo: 'TTS_FIN' }
  | { tipo: 'RESULTADO'; texto: string }
  /** El campo quedó resuelto (respondido, saltado o dejado en blanco). */
  | { tipo: 'ATENDIDO'; campo: string }
  | { tipo: 'AMBIGUO'; texto: string; candidatos: CandidatoVoz[] }
  | { tipo: 'NO_ENTENDI'; texto: string }
  /** Dejar el micrófono en pausa sin contarlo como error (silencio largo). */
  | { tipo: 'PAUSAR'; texto: string }
  | { tipo: 'ERROR_ASR'; error: string; texto: string }
  /** Cambió el paso o el paño: se cancela todo y se empieza de nuevo. */
  | { tipo: 'REINICIAR' }
  | { tipo: 'REANUDAR' };

export const ESTADO_VOZ_INICIAL: EstadoVoz = {
  fase: 'apagado',
  pregunta: '',
  campo: null,
  dicho: '',
  candidatos: [],
  atendidos: [],
  fallos: 0,
  ultimoHablado: '',
  escucharAlTerminar: false,
  aviso: '',
};

/** Reintentos antes de apagar el micrófono y esperar un toque. */
export const FALLOS_PARA_PAUSAR = 3;

/**
 * ¿Lo que llegó del micrófono es la propia voz de la app rebotando?
 *
 * Solo se descarta una frase LARGA que se parece mucho a lo recién hablado: una
 * respuesta de una o dos palabras («izquierda») casi siempre aparece dentro de
 * la pregunta, y descartarla dejaría al vendedor hablándole a una pared.
 */
export function esEco(dicho: string, hablado: string): boolean {
  const d = normalizarVoz(dicho);
  const h = normalizarVoz(hablado);
  if (!d || !h) return false;
  if (d === h) return true;
  const td = d.split(' ').filter(Boolean);
  if (td.length < 3) return false;
  const th = new Set(h.split(' ').filter(Boolean));
  const comunes = td.filter((t) => th.has(t)).length;
  // Eco de verdad = el micrófono oyó la pregunta (casi) entera. Una respuesta
  // que CITA una opción de la pregunta («dentro del marco» tras «¿va dentro
  // del marco, fuera del marco o no aplica?») cubre solo un pedazo de lo
  // hablado y tiene que llegar al intérprete.
  return comunes / td.length >= 0.8 && comunes / th.size >= 0.6;
}

/** Errores del reconocedor que no tienen vuelta: hay que apagar y avisar. */
const ERRORES_FATALES = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

type Resultado = { estado: EstadoVoz; efectos: EfectoVoz[] };

const sinCambio = (estado: EstadoVoz): Resultado => ({ estado, efectos: [] });

export function reducirVoz(estado: EstadoVoz, evento: EventoVoz): Resultado {
  if (evento.tipo === 'ENCENDER') {
    return { estado: { ...ESTADO_VOZ_INICIAL, fase: 'esperandoOrden' }, efectos: [] };
  }
  if (evento.tipo === 'APAGAR') {
    return { estado: { ...ESTADO_VOZ_INICIAL }, efectos: [{ tipo: 'CANCELAR' }] };
  }
  // Con el asistente apagado no hay nada que hacer: los eventos en vuelo
  // (un `onend` tardío, un resultado que llegó después) se descartan.
  if (estado.fase === 'apagado') return sinCambio(estado);

  switch (evento.tipo) {
    case 'HABLAR': {
      const luegoEscuchar = evento.luegoEscuchar ?? true;
      return {
        estado: {
          ...estado,
          fase: 'hablando',
          pregunta: evento.campo !== undefined && evento.campo !== null ? evento.texto : estado.pregunta,
          campo: evento.campo !== undefined ? evento.campo : estado.campo,
          ultimoHablado: evento.texto,
          escucharAlTerminar: luegoEscuchar,
          dicho: '',
          aviso: '',
        },
        efectos: [{ tipo: 'HABLAR', texto: evento.texto, luegoEscuchar }],
      };
    }

    case 'TTS_FIN': {
      // Un `onend` que llega cuando ya se decidió otra cosa (una pausa, un
      // cambio de paso) no debe reabrir el micrófono.
      if (estado.fase === 'pausado') return sinCambio(estado);
      if (estado.fase !== 'hablando') return sinCambio(estado);
      const fase: FaseVoz = estado.escucharAlTerminar
        ? estado.candidatos.length > 0
          ? 'desambiguando'
          : 'escuchando'
        : 'esperandoOrden';
      return { estado: { ...estado, fase }, efectos: [{ tipo: 'ESCUCHAR' }] };
    }

    case 'RESULTADO': {
      if (!['escuchando', 'desambiguando', 'esperandoOrden'].includes(estado.fase)) {
        return sinCambio(estado);
      }
      if (esEco(evento.texto, estado.ultimoHablado)) {
        // El parlante se oyó a sí mismo: se ignora y se sigue escuchando.
        return { estado, efectos: [{ tipo: 'ESCUCHAR' }] };
      }
      return {
        estado: { ...estado, fase: 'interpretando', dicho: evento.texto },
        efectos: [],
      };
    }

    case 'ATENDIDO': {
      const atendidos = estado.atendidos.includes(evento.campo)
        ? estado.atendidos
        : [...estado.atendidos, evento.campo];
      return { estado: { ...estado, atendidos, candidatos: [], fallos: 0 }, efectos: [] };
    }

    case 'AMBIGUO':
      return {
        estado: {
          ...estado,
          fase: 'hablando',
          candidatos: evento.candidatos,
          ultimoHablado: evento.texto,
          escucharAlTerminar: true,
          fallos: 0,
        },
        efectos: [{ tipo: 'HABLAR', texto: evento.texto, luegoEscuchar: true }],
      };

    case 'NO_ENTENDI': {
      const fallos = estado.fallos + 1;
      if (fallos >= FALLOS_PARA_PAUSAR) {
        return {
          estado: { ...estado, fase: 'pausado', fallos, aviso: 'Micrófono en pausa.' },
          efectos: [
            { tipo: 'CANCELAR' },
            { tipo: 'HABLAR', texto: evento.texto, luegoEscuchar: false },
          ],
        };
      }
      return {
        estado: { ...estado, fase: 'hablando', fallos, escucharAlTerminar: true, ultimoHablado: evento.texto },
        efectos: [{ tipo: 'HABLAR', texto: evento.texto, luegoEscuchar: true }],
      };
    }

    case 'PAUSAR':
      return {
        estado: { ...estado, fase: 'pausado', fallos: 0, aviso: 'Micrófono en pausa.' },
        efectos: [
          { tipo: 'CANCELAR' },
          { tipo: 'HABLAR', texto: evento.texto, luegoEscuchar: false },
        ],
      };

    case 'ERROR_ASR': {
      if (ERRORES_FATALES.has(evento.error)) {
        return {
          estado: { ...ESTADO_VOZ_INICIAL, aviso: evento.texto },
          efectos: [{ tipo: 'CANCELAR' }, { tipo: 'AVISO', texto: evento.texto }],
        };
      }
      // 'no-speech' y compañía: se cuenta como intento fallido y se reintenta.
      return reducirVoz(estado, { tipo: 'NO_ENTENDI', texto: evento.texto });
    }

    case 'REINICIAR':
      return {
        estado: {
          ...ESTADO_VOZ_INICIAL,
          fase: 'esperandoOrden',
          aviso: estado.aviso,
        },
        efectos: [{ tipo: 'CANCELAR' }],
      };

    case 'REANUDAR':
      if (estado.fase !== 'pausado') return sinCambio(estado);
      return {
        estado: { ...estado, fase: 'escuchando', fallos: 0, aviso: '' },
        efectos: [{ tipo: 'ESCUCHAR' }],
      };

    default:
      return sinCambio(estado);
  }
}

/** ¿El asistente está trabajando (encendido y no en pausa)? */
export function vozActiva(estado: EstadoVoz): boolean {
  return estado.fase !== 'apagado';
}
