// ─────────────────────────────────────────────────────────────────────
// EL MICRÓFONO Y EL PARLANTE DEL NAVEGADOR.
//
// Envoltorio fino sobre las dos APIs que ya trae Chrome (y los navegadores
// basados en él): `SpeechRecognition` para escuchar y `speechSynthesis` para
// hablar. Todo lo raro de estas APIs vive acá y no ensucia la lógica:
//
//  · `start()` sobre un reconocedor ya iniciado LANZA: siempre se aborta antes.
//  · el `onend` del sintetizador no siempre llega (Chrome): hay un plazo de
//    respaldo calculado por el largo del texto.
//  · un texto largo se corta solo a los ~15 s: se llama a `resume()` cada 10.
//  · `getVoices()` empieza vacío hasta que el navegador carga las voces.
//
// Donde el navegador no traiga estas APIs (Firefox, algunos webviews), todo
// devuelve `false`/`null` y la vista guiada sigue funcionando a mano: el patrón
// del repo es detectar, avisar en castellano y NUNCA bloquear.
// ─────────────────────────────────────────────────────────────────────

type ResultadoASR = {
  isFinal: boolean;
  length: number;
  [i: number]: { transcript: string; confidence: number };
};

type EventoASR = { resultIndex: number; results: { length: number; [i: number]: ResultadoASR } };

type ReconocedorNativo = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoASR) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

type ConstructorASR = new () => ReconocedorNativo;

const ventana = (): (Window & {
  SpeechRecognition?: ConstructorASR;
  webkitSpeechRecognition?: ConstructorASR;
}) | null => (typeof window === 'undefined' ? null : (window as never));

function constructorASR(): ConstructorASR | null {
  const w = ventana();
  if (!w) return null;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SoporteVoz = { escuchar: boolean; hablar: boolean };

/** Qué puede hacer este navegador. Se consulta antes de ofrecer el botón. */
export function soporteVoz(): SoporteVoz {
  const w = ventana();
  return {
    escuchar: !!constructorASR(),
    hablar: !!w && typeof w.speechSynthesis !== 'undefined',
  };
}

/** El mensaje que se le muestra al vendedor cuando su navegador no sirve. */
export const AVISO_SIN_SOPORTE =
  'Este navegador no puede escuchar. Abre la vista guiada en Chrome (o en el navegador del teléfono) para dictar, o completa los datos a mano.';

// ── Hablar ────────────────────────────────────────────────────────────

let vozElegida: SpeechSynthesisVoice | null = null;

/** Lo mínimo que se le pide a una voz para poder puntuarla (y poder probarlo). */
export type VozCandidata = { name: string; lang: string; localService?: boolean };

/** Qué tan cerca está el idioma de la voz de cómo se habla en Chile. */
function puntajeIdioma(lang: string): number {
  const l = (lang || '').replace('_', '-').toLowerCase();
  if (!l.startsWith('es')) return -1;
  if (l.startsWith('es-cl')) return 40;
  if (l.startsWith('es-419') || l.startsWith('es-us')) return 34;
  if (l.startsWith('es-mx')) return 32;
  if (l.startsWith('es-ar') || l.startsWith('es-pe') || l.startsWith('es-co')) return 28;
  if (l.startsWith('es-es')) return 22;
  return 18;
}

/**
 * Qué tan HUMANA suena. Las voces que el sistema baja de internet —las de
 * Google y las «Natural»/«Online» de Microsoft— son las que no suenan a robot;
 * las viejas instaladas en el equipo (SAPI, eloquence) son las metálicas.
 */
function puntajeCalidad(v: VozCandidata): number {
  const n = (v.name || '').toLowerCase();
  let p = 0;
  if (n.includes('natural')) p += 30;
  if (n.includes('google')) p += 25;
  if (n.includes('online')) p += 15;
  if (v.localService === false) p += 12;
  if (n.includes('eloquence') || n.includes('sapi') || n.includes('espeak')) p -= 25;
  return p;
}

/**
 * La voz con que habla el asistente. Se elige UNA y no se cambia más: antes se
 * resolvía tarde —la primera frase salía con la voz por defecto del navegador y
 * las siguientes con otra— y en Android la lista se recarga sola, así que la
 * guía terminaba hablando con dos voces distintas.
 */
export function elegirVozDe<T extends VozCandidata>(voces: readonly T[]): T | null {
  let mejor: T | null = null;
  let mejorPuntaje = -Infinity;
  for (const v of voces) {
    const idioma = puntajeIdioma(v.lang);
    if (idioma < 0) continue;
    const p = idioma + puntajeCalidad(v);
    if (p > mejorPuntaje) {
      mejorPuntaje = p;
      mejor = v;
    }
  }
  return mejor;
}

function vocesDisponibles(): SpeechSynthesisVoice[] {
  const w = ventana();
  if (!w?.speechSynthesis) return [];
  try {
    return w.speechSynthesis.getVoices() ?? [];
  } catch {
    return [];
  }
}

const CLAVE_VOZ_GUARDADA = 'wizard_voz_preferida';

function vozGuardada(): string {
  try {
    return ventana()?.localStorage?.getItem(CLAVE_VOZ_GUARDADA) ?? '';
  } catch {
    return '';
  }
}

/** La voz elegida, fijándola la primera vez que haya lista que mirar. */
function vozPreferida(): SpeechSynthesisVoice | null {
  if (vozElegida) return vozElegida;
  const voces = vocesDisponibles();
  if (voces.length === 0) return null;
  const guardada = vozGuardada();
  vozElegida = (guardada && voces.find((v) => v.name === guardada)) || elegirVozDe(voces);
  return vozElegida;
}

/** Las voces en castellano que ofrece este equipo, para poder elegir una. */
export function vocesEnCastellano(): { name: string; lang: string; natural: boolean }[] {
  return vocesDisponibles()
    .filter((v) => (v.lang || '').toLowerCase().startsWith('es'))
    .map((v) => ({
      name: v.name,
      lang: v.lang,
      natural: /natural|google|online/i.test(v.name) || v.localService === false,
    }));
}

/** El nombre de la voz con la que está hablando ahora mismo. */
export function nombreVozActual(): string {
  return vozPreferida()?.name ?? '';
}

/**
 * Fija la voz a mano y la recuerda en este equipo. Es la salida cuando la que
 * el navegador elige suena mal o se cambia sola.
 */
export function fijarVoz(nombre: string): void {
  const voz = vocesDisponibles().find((v) => v.name === nombre);
  if (!voz) return;
  vozElegida = voz;
  try {
    ventana()?.localStorage?.setItem(CLAVE_VOZ_GUARDADA, nombre);
  } catch {
    // Sin localStorage la elección vale igual, pero solo para esta sesión.
  }
}

/** Se llama en el clic de encender: las voces suelen cargar con retardo. */
export function precargarVoces(): void {
  const w = ventana();
  if (!w?.speechSynthesis || vozElegida) return;
  if (vozPreferida()) return;
  w.speechSynthesis.onvoiceschanged = () => {
    vozPreferida();
  };
}

let timerRespaldo: ReturnType<typeof setTimeout> | null = null;
let timerVoces: ReturnType<typeof setTimeout> | null = null;
/** Cada cancelación invalida lo que estuviera por decirse. */
let generacion = 0;

// Acá vivía un `resume()` cada 10 s, el truco clásico contra el corte de los
// textos largos. En Edge, con las voces que se bajan de internet, ese `resume()`
// en medio de la transmisión hacía que el navegador retomara con OTRA voz. El
// corte ya no hace falta esquivarlo: se habla frase por frase.

function limpiarTimersHabla() {
  if (timerRespaldo) clearTimeout(timerRespaldo);
  if (timerVoces) clearTimeout(timerVoces);
  timerRespaldo = null;
  timerVoces = null;
}

/** Largo máximo de cada trozo hablado: bastante menos que el corte a los ~15 s. */
const LARGO_FRASE = 140;

/**
 * Parte un texto en frases cortas, respetando los puntos y los signos. Nunca
 * corta una palabra por la mitad.
 */
export function partirEnFrases(texto: string, largo = LARGO_FRASE): string[] {
  const frases = texto
    .split(/(?<=[.!?…])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
  const salida: string[] = [];
  for (const frase of frases) {
    if (frase.length <= largo) {
      salida.push(frase);
      continue;
    }
    // Una frase sola demasiado larga (una lista de opciones) se parte por comas
    // y, si aún así no entra, por palabras.
    let actual = '';
    for (const trozo of frase.split(/(?<=,)\s+/)) {
      for (const palabra of trozo.split(' ')) {
        if (actual && `${actual} ${palabra}`.length > largo) {
          salida.push(actual);
          actual = palabra;
        } else {
          actual = actual ? `${actual} ${palabra}` : palabra;
        }
      }
    }
    if (actual) salida.push(actual);
  }
  return salida.length > 0 ? salida : [texto];
}

/**
 * Dice `texto` y llama a `alTerminar` UNA sola vez: con el `onend` real o con
 * el plazo de respaldo, lo que llegue primero.
 */
export function hablar(texto: string, alTerminar: () => void): void {
  const w = ventana();
  const limpio = texto.trim();
  if (!w?.speechSynthesis || !limpio) {
    alTerminar();
    return;
  }
  cancelarHabla();
  const miGeneracion = generacion;
  let terminado = false;
  const terminar = () => {
    if (terminado) return;
    terminado = true;
    limpiarTimersHabla();
    alTerminar();
  };

  const decir = () => {
    // Alguien canceló (cambio de paso, apagar) mientras cargaban las voces.
    if (miGeneracion !== generacion) return;
    const voz = vozPreferida();
    // Se dice frase por frase. Las voces «online» de Edge y Chrome se bajan de
    // internet mientras suenan, y un texto largo se les corta a los ~15 s: ahí
    // el navegador termina la frase con la voz LOCAL del equipo — que es lo
    // que se escucha como dos voces distintas en la misma pregunta.
    //
    // Las frases van UNA POR VEZ, encadenadas por el `onend` de la anterior —
    // no todas en cola. Encoladas, el primer tropiezo de una (pasa en el
    // teléfono) botaba a todas las que venían detrás y la lectura quedaba
    // cortada a mitad de camino; encadenadas, una frase que falla se salta y
    // la lectura sigue con la siguiente.
    const partes = partirEnFrases(limpio);
    let i = 0;
    const decirSiguiente = () => {
      if (miGeneracion !== generacion || terminado) return;
      if (i >= partes.length) {
        terminar();
        return;
      }
      const u = new SpeechSynthesisUtterance(partes[i]);
      i += 1;
      u.lang = voz?.lang || 'es-CL';
      if (voz) u.voice = voz;
      // Un poco más lento que el default y sin subir el tono: leído así se
      // entiende con ruido de obra y suena menos a máquina.
      u.rate = 0.98;
      u.pitch = 1;
      u.onend = decirSiguiente;
      u.onerror = (e: { error?: string }) => {
        // Nuestra propia cancelación no debe relanzar nada.
        if (e?.error === 'canceled' || e?.error === 'interrupted') return;
        decirSiguiente();
      };
      w.speechSynthesis.speak(u);
    };
    decirSiguiente();
    // Red de seguridad por si el navegador se come algún `onend`. Va HOLGADA a
    // propósito (unas 9 letras por segundo, cuando se leen 14): si se quedara
    // corta cortaría la frase para pasar a la siguiente.
    timerRespaldo = setTimeout(terminar, limpio.length * 110 + 4000);
  };

  // La lista de voces carga con retardo: si todavía no está, la PRIMERA frase
  // saldría con la voz por defecto y el resto con la elegida — la guía hablando
  // con dos voces. Se esperan unos milisegundos y se habla con una sola.
  if (!vozElegida && vocesDisponibles().length === 0) {
    let intentos = 0;
    const esperar = () => {
      if (miGeneracion !== generacion) return;
      if (vozPreferida() || intentos >= 8) {
        decir();
        return;
      }
      intentos++;
      timerVoces = setTimeout(esperar, 60);
    };
    esperar();
    return;
  }
  decir();
}

export function cancelarHabla(): void {
  const w = ventana();
  generacion++;
  limpiarTimersHabla();
  if (w?.speechSynthesis) w.speechSynthesis.cancel();
}

/** ¿El parlante está sonando? El micrófono nunca se abre mientras sea true. */
export function estaHablando(): boolean {
  const w = ventana();
  return !!w?.speechSynthesis?.speaking;
}

// ── Escuchar ──────────────────────────────────────────────────────────

export type Reconocedor = {
  escuchar: () => void;
  abortar: () => void;
  destruir: () => void;
};

export type CallbacksASR = {
  onParcial?: (texto: string) => void;
  onFinal: (texto: string, alternativas: string[]) => void;
  onError: (error: string) => void;
};

/**
 * Cuánto se espera, después de un pedazo entendido, por si la frase sigue.
 * Cubre el cierre y la reapertura de la sesión (~400 ms) más una pausa humana
 * normal en medio de una frase («dentro del… marco»).
 */
export const MS_REMATE_TURNO = 1100;

/**
 * Un reconocedor listo para usar, o null si el navegador no trae la API.
 *
 * `continuous: false` a propósito: se escucha UNA respuesta por pregunta. Con
 * `true`, el reconocedor sigue abierto mientras la app habla y se transcribe a
 * sí misma.
 */
export function crearReconocedor(cbs: CallbacksASR): Reconocedor | null {
  const Ctor = constructorASR();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = 'es-CL';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;

  let activo = false;
  let huboFinal = false;
  let destruido = false;
  let ultimoFinal = '';
  // Un corte pedido por nosotros (cambio de paso, apagar, reabrir) NO es un
  // «no te escuché»: sin esta marca, tres cortes seguidos pausaban el asistente.
  let abortando = false;
  // ── El remate del turno ──
  // El recortador de Chrome (sobre todo en Android) cierra la escucha con
  // CUALQUIER pausa chica: «dentro del… marco» llegaba como «dentro del», y
  // «uno coma ochenta… y cinco» se habría anotado 1,80 — un corte malo en el
  // taller. Por eso un final NO se entrega al tiro: se guarda el pedazo, se
  // reabre el micrófono y se espera un momento por si la frase sigue; recién
  // cuando el hablante se calla de verdad se junta todo y se entrega ENTERO.
  let fragmentos: string[] = [];
  let alternativasUltimas: string[] = [];
  let timerRemate: ReturnType<typeof setTimeout> | null = null;

  const limpiarRemate = () => {
    if (timerRemate) clearTimeout(timerRemate);
    timerRemate = null;
  };

  const cerrarTurno = () => {
    limpiarRemate();
    if (destruido || fragmentos.length === 0) return;
    const texto = fragmentos.join(' ');
    // Las alternativas solo tienen sentido si la frase salió de una pieza.
    const alternativas = fragmentos.length === 1 ? alternativasUltimas : [];
    fragmentos = [];
    alternativasUltimas = [];
    if (activo) {
      abortando = true;
      try {
        rec.abort();
      } catch {
        /* nada que hacer */
      }
    }
    cbs.onFinal(texto, alternativas);
  };

  rec.onstart = () => {
    activo = true;
    huboFinal = false;
  };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const texto = (r[0]?.transcript || '').trim();
      if (!r.isFinal) {
        if (texto) cbs.onParcial?.([...fragmentos, texto].join(' '));
        continue;
      }
      // Android repite el mismo final dos veces: se descarta el duplicado.
      if (!texto || texto === ultimoFinal) continue;
      ultimoFinal = texto;
      huboFinal = true;
      fragmentos.push(texto);
      alternativasUltimas = [];
      for (let j = 1; j < r.length; j++) {
        const alt = (r[j]?.transcript || '').trim();
        if (alt) alternativasUltimas.push(alt);
      }
      cbs.onParcial?.(fragmentos.join(' '));
      limpiarRemate();
      timerRemate = setTimeout(cerrarTurno, MS_REMATE_TURNO);
    }
  };

  rec.onerror = (e) => {
    if (destruido) return;
    // 'aborted' es nuestro: lo produce cada `abortar()`, no es un problema.
    if (e.error === 'aborted') return;
    // Con un pedazo ya en la mano, el «no oí más» es justamente lo esperado:
    // el timer va a cerrar el turno con lo que hay.
    if (e.error === 'no-speech' && fragmentos.length > 0) return;
    cbs.onError(e.error);
  };

  rec.onend = () => {
    activo = false;
    if (destruido) return;
    if (abortando) {
      abortando = false;
      return;
    }
    if (fragmentos.length > 0) {
      // El turno sigue abierto: se reabre el micrófono por si la frase
      // continúa. Si no arranca, el timer entrega igual lo que hay.
      try {
        rec.start();
      } catch {
        /* el timer cierra el turno */
      }
      return;
    }
    // Se cerró sin haber entendido nada: para la máquina es un intento fallido.
    if (!huboFinal) cbs.onError('no-speech');
  };

  return {
    escuchar: () => {
      if (destruido) return;
      ultimoFinal = '';
      fragmentos = [];
      alternativasUltimas = [];
      limpiarRemate();
      // `start()` sobre uno ya iniciado lanza InvalidStateError.
      if (activo) {
        abortando = true;
        try {
          rec.abort();
        } catch {
          /* da igual: se va a reintentar igual */
        }
      }
      try {
        rec.start();
      } catch {
        // Suele ser el «ya estaba escuchando»: no vale la pena molestar.
      }
    },
    abortar: () => {
      limpiarRemate();
      fragmentos = [];
      alternativasUltimas = [];
      if (destruido || !activo) return;
      abortando = true;
      try {
        rec.abort();
      } catch {
        /* nada que hacer */
      }
    },
    destruir: () => {
      destruido = true;
      limpiarRemate();
      try {
        rec.abort();
      } catch {
        /* nada que hacer */
      }
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
    },
  };
}

/**
 * Pide el permiso del micrófono y lo suelta enseguida.
 *
 * El reconocedor pide el permiso por su cuenta, pero lo hace cuando arranca —
 * que en esta pantalla es DESPUÉS de que la app terminó de hablar, o sea fuera
 * del clic. Varios navegadores no muestran el cartel si no viene de un gesto
 * del usuario, y el reconocedor queda inservible sin decir nada. Pidiéndolo
 * dentro del clic, el permiso ya está dado cuando hace falta.
 */
/**
 * En qué quedó el permiso del micrófono para este sitio, sin pedirlo.
 *
 * Importa por Android: si el permiso se negó (o el navegador lo negó solo, que
 * es lo que hace con los pedidos repetidos), Chrome lo deja BLOQUEADO y los
 * pedidos siguientes fallan EN SILENCIO — no aparece ningún cartel. Desde la
 * app no se puede desbloquear: lo único honesto es explicarle al vendedor
 * dónde activarlo.
 */
export async function estadoPermisoMicrofono(): Promise<'granted' | 'denied' | 'prompt' | 'desconocido'> {
  const w = ventana();
  const permisos = w?.navigator?.permissions;
  if (!permisos?.query) return 'desconocido';
  try {
    const r = await permisos.query({ name: 'microphone' as PermissionName });
    return r.state === 'granted' || r.state === 'denied' ? r.state : 'prompt';
  } catch {
    return 'desconocido';
  }
}

/** Cómo desbloquear el micrófono, dicho para el teléfono y para el computador. */
export const AVISO_MIC_BLOQUEADO =
  'El micrófono está BLOQUEADO para este sitio, por eso el navegador ya ni pregunta. Para activarlo: toca el ícono junto a la dirección (el candado o los controles) → Permisos → Micrófono → Permitir, y vuelve a tocar Dictar.';

export async function pedirPermisoMicrofono(): Promise<boolean> {
  const w = ventana();
  if (!w?.navigator?.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await w.navigator.mediaDevices.getUserMedia({ audio: true });
    for (const pista of stream.getTracks()) pista.stop();
    return true;
  } catch {
    // Si lo niegan, el propio reconocedor devolverá 'not-allowed' y ahí se avisa.
    return false;
  }
}

/** Texto en castellano para cada error del reconocedor. */
export function mensajeErrorASR(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'El navegador no dio permiso para usar el micrófono. Actívalo y vuelve a intentar.';
    case 'audio-capture':
      return 'No se encontró ningún micrófono conectado.';
    case 'network':
      return 'El reconocimiento de voz necesita internet y no hay conexión.';
    case 'no-speech':
      return 'No te escuché.';
    default:
      return 'Hubo un problema con el micrófono.';
  }
}
