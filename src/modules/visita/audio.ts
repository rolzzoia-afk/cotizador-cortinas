// ─────────────────────────────────────────────────────────────────────
// EL AUDIO DEL VIDEO DE LA VISITA.
//
// Un video de terreno de 10 minutos pesa cientos de megas, y para redactar el
// informe solo hace falta lo que se DIJO. Acá se saca la pista de audio en el
// navegador y se manda solo eso: wav mono a 16 kHz, ~1,9 MB por minuto. El
// video se sube aparte, sin bloquear la generación del informe.
//
// `codificarWav` es puro (sin Web Audio API) para poder testearlo.
// ─────────────────────────────────────────────────────────────────────

/** Frecuencia de muestreo del wav que se manda a transcribir. */
export const SAMPLE_RATE_TRANSCRIPCION = 16000;

/**
 * Empaqueta muestras (-1..1) en un wav PCM 16 bits mono.
 *
 * El header RIFF son 44 bytes; el resto es la muestra en little-endian. Se
 * recorta a ±1 antes de escalar: una muestra fuera de rango daría un entero
 * que desborda y suena a chasquido.
 */
export function codificarWav(muestras: Float32Array, sampleRate: number): Blob {
  const bytes = new ArrayBuffer(44 + muestras.length * 2);
  const v = new DataView(bytes);
  const texto = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true); // tamaño del bloque fmt
  v.setUint16(20, 1, true); // PCM sin comprimir
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // bytes por segundo
  v.setUint16(32, 2, true); // bytes por muestra
  v.setUint16(34, 16, true); // bits por muestra
  texto(36, 'data');
  v.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const m = Math.max(-1, Math.min(1, muestras[i]));
    v.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Mezcla los canales a mono promediándolos. */
export function mezclarAMono(canales: Float32Array[]): Float32Array {
  if (canales.length === 1) return canales[0];
  const largo = canales[0]?.length ?? 0;
  const out = new Float32Array(largo);
  for (let i = 0; i < largo; i++) {
    let s = 0;
    for (const c of canales) s += c[i] ?? 0;
    out[i] = s / canales.length;
  }
  return out;
}

/** El navegador no supo decodificar el archivo (códec raro, o no trae audio). */
export class AudioNoDecodificable extends Error {
  constructor(causa?: unknown) {
    super(
      'No se pudo leer el audio de este archivo. Suele pasar con formatos poco comunes: ' +
        'graba el video con la cámara normal del teléfono (mp4) e inténtalo de nuevo.',
    );
    this.name = 'AudioNoDecodificable';
    this.cause = causa;
  }
}

type CtorAudioContext = typeof AudioContext;

function ctorAudioContext(): CtorAudioContext | null {
  const w = globalThis as unknown as {
    AudioContext?: CtorAudioContext;
    webkitAudioContext?: CtorAudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Saca el audio de un video (o de un archivo de audio) como wav mono 16 kHz.
 *
 * Decodifica con la Web Audio API y vuelve a muestrear con un
 * OfflineAudioContext: el resultado pesa una fracción del video y es lo único
 * que viaja al servicio de transcripción.
 */
export async function extraerAudioWav(
  archivo: Blob,
  opts: { sampleRate?: number } = {},
): Promise<Blob> {
  const sampleRate = opts.sampleRate ?? SAMPLE_RATE_TRANSCRIPCION;
  const Ctor = ctorAudioContext();
  if (!Ctor) throw new AudioNoDecodificable(new Error('sin Web Audio API'));

  const buf = await archivo.arrayBuffer();
  const ctx = new Ctor();
  let decodificado: AudioBuffer;
  try {
    decodificado = await ctx.decodeAudioData(buf);
  } catch (e) {
    throw new AudioNoDecodificable(e);
  } finally {
    // El contexto solo se usó para decodificar; se cierra para no dejar el
    // hardware de audio tomado mientras se sube el archivo.
    void ctx.close?.();
  }
  if (decodificado.length === 0) throw new AudioNoDecodificable(new Error('sin pista de audio'));

  const largoDestino = Math.max(1, Math.ceil(decodificado.duration * sampleRate));
  const offline = new OfflineAudioContext(1, largoDestino, sampleRate);
  const fuente = offline.createBufferSource();
  fuente.buffer = decodificado;
  fuente.connect(offline.destination);
  fuente.start();
  const remuestreado = await offline.startRendering();
  return codificarWav(remuestreado.getChannelData(0), sampleRate);
}

/** Minutos de audio de un blob wav generado acá (para avisar antes de subir). */
export function duracionWavSegundos(bytes: number, sampleRate = SAMPLE_RATE_TRANSCRIPCION): number {
  return Math.max(0, (bytes - 44) / 2 / sampleRate);
}
