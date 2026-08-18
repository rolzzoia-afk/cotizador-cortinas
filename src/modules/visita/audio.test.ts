import { describe, expect, it } from 'vitest';
import {
  codificarWav,
  duracionWavSegundos,
  mezclarAMono,
  SAMPLE_RATE_TRANSCRIPCION,
} from './audio';

/** Lee el wav como bytes para poder mirarle el header. */
async function bytes(b: Blob): Promise<DataView> {
  return new DataView(await b.arrayBuffer());
}
const ascii = (v: DataView, off: number, n: number) =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(v.getUint8(off + i))).join('');

describe('codificarWav', () => {
  it('escribe un header RIFF/WAVE válido de 44 bytes', async () => {
    const wav = codificarWav(new Float32Array(100), 16000);
    const v = await bytes(wav);
    expect(ascii(v, 0, 4)).toBe('RIFF');
    expect(ascii(v, 8, 4)).toBe('WAVE');
    expect(ascii(v, 12, 4)).toBe('fmt ');
    expect(ascii(v, 36, 4)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint16(34, true)).toBe(16); // 16 bits
  });

  it('el tamaño es 44 + 2 bytes por muestra', async () => {
    const wav = codificarWav(new Float32Array(1000), 16000);
    expect(wav.size).toBe(44 + 2000);
    const v = await bytes(wav);
    expect(v.getUint32(4, true)).toBe(36 + 2000);
    expect(v.getUint32(40, true)).toBe(2000);
  });

  it('guarda el sample rate y los bytes por segundo que le pasan', async () => {
    const v = await bytes(codificarWav(new Float32Array(4), 16000));
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000); // 16 bits mono
  });

  it('una muestra fuera de rango se recorta en vez de desbordar', async () => {
    // Sin el clamp, 2.0 daría un entero que se envuelve y suena a chasquido.
    const v = await bytes(codificarWav(new Float32Array([2, -2, 0]), 16000));
    expect(v.getInt16(44, true)).toBe(32767);
    expect(v.getInt16(46, true)).toBe(-32768);
    expect(v.getInt16(48, true)).toBe(0);
  });

  it('un audio vacío igual produce un wav legible', async () => {
    const wav = codificarWav(new Float32Array(0), 16000);
    expect(wav.size).toBe(44);
    const v = await bytes(wav);
    expect(v.getUint32(40, true)).toBe(0);
  });
});

describe('mezclarAMono', () => {
  it('un solo canal pasa tal cual', () => {
    const c = new Float32Array([0.1, 0.2]);
    expect(mezclarAMono([c])).toBe(c);
  });

  it('dos canales se promedian', () => {
    const out = mezclarAMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(out)).toEqual([0.5, 0.5]);
  });
});

describe('duracionWavSegundos', () => {
  it('descuenta el header y divide por el sample rate', () => {
    // Un minuto a 16 kHz, 16 bits mono = 1.920.044 bytes con header.
    expect(duracionWavSegundos(44 + 16000 * 2 * 60)).toBeCloseTo(60, 6);
    expect(duracionWavSegundos(44, SAMPLE_RATE_TRANSCRIPCION)).toBe(0);
  });

  it('un tamaño imposible no da un negativo', () => {
    expect(duracionWavSegundos(10)).toBe(0);
  });
});
