import { describe, expect, it } from 'vitest';
import {
  IDS_INTRO,
  INTROS_INFORME_DEFAULT,
  introDe,
  normalizarIntrosInforme,
  textoIntro,
  type IntrosInforme,
} from './introsInforme';

const URL_A = 'https://proj.supabase.co/storage/v1/object/public/informe-assets/emp/duo/1.jpg';

describe('intros de fábrica', () => {
  it('trae una por familia más la nota de varios paños, todas activas y con texto', () => {
    const ids = INTROS_INFORME_DEFAULT.intros.map((i) => i.id);
    expect(ids).toEqual([...IDS_INTRO]);
    expect(INTROS_INFORME_DEFAULT.intros.every((i) => i.activo)).toBe(true);
    expect(INTROS_INFORME_DEFAULT.intros.every((i) => i.texto.length > 40)).toBe(true);
    expect(INTROS_INFORME_DEFAULT.intros.every((i) => i.fotos.length === 0)).toBe(true);
  });

  it('el texto del dúo es el del correo real', () => {
    const duo = INTROS_INFORME_DEFAULT.intros.find((i) => i.id === 'duo')!;
    expect(duo.texto).toContain('siempre existirán pasos de luz entre sus lamas y laterales');
  });
});

describe('normalizarIntrosInforme', () => {
  it('lo corrupto cae a las de fábrica', () => {
    expect(normalizarIntrosInforme(null).intros).toHaveLength(IDS_INTRO.length);
    expect(normalizarIntrosInforme('basura').intros).toHaveLength(IDS_INTRO.length);
  });

  it('REPONE las que falten en lo guardado (una empresa que guardó antes no queda muda)', () => {
    // Misma lección que el catálogo guardado que pisaba al de fábrica: guardar
    // una versión vieja no puede hacer desaparecer una familia nueva.
    const guardado = { intros: [{ id: 'duo', texto: 'Mi texto de dúo', fotos: [], activo: true }] };
    const out = normalizarIntrosInforme(guardado);
    expect(out.intros.map((i) => i.id)).toEqual([...IDS_INTRO]);
    expect(out.intros.find((i) => i.id === 'duo')!.texto).toBe('Mi texto de dúo');
    expect(out.intros.find((i) => i.id === 'blackout')!.texto).toBe(
      INTROS_INFORME_DEFAULT.intros.find((i) => i.id === 'blackout')!.texto,
    );
  });

  it('respeta el orden de fábrica aunque lo guardado venga desordenado', () => {
    const out = normalizarIntrosInforme({
      intros: [
        { id: 'vertical', texto: 'V', fotos: [], activo: true },
        { id: 'duo', texto: 'D', fotos: [], activo: true },
      ],
    });
    expect(out.intros.map((i) => i.id)).toEqual([...IDS_INTRO]);
  });

  it('una intro sin texto se descarta y se repone la de fábrica', () => {
    const out = normalizarIntrosInforme({
      intros: [{ id: 'duo', texto: '   ', fotos: [URL_A], activo: true }],
    });
    const duo = out.intros.find((i) => i.id === 'duo')!;
    expect(duo.texto).toBe(INTROS_INFORME_DEFAULT.intros[0].texto);
    expect(duo.fotos).toEqual([]);
  });

  it('un id desconocido se ignora sin romper nada', () => {
    const out = normalizarIntrosInforme({
      intros: [{ id: 'romana', texto: 'X', fotos: [], activo: true }],
    });
    expect(out.intros.map((i) => i.id)).toEqual([...IDS_INTRO]);
  });

  it('las fotos se limpian: solo URLs válidas', () => {
    const out = normalizarIntrosInforme({
      intros: [{ id: 'duo', texto: 'D', fotos: [URL_A, 'javascript:x', URL_A], activo: true }],
    });
    expect(out.intros.find((i) => i.id === 'duo')!.fotos).toEqual([URL_A]);
  });

  it('`activo` solo se apaga con un false explícito', () => {
    const out = normalizarIntrosInforme({
      intros: [
        { id: 'duo', texto: 'D', fotos: [] },
        { id: 'screen', texto: 'S', fotos: [], activo: false },
      ],
    });
    expect(out.intros.find((i) => i.id === 'duo')!.activo).toBe(true);
    expect(out.intros.find((i) => i.id === 'screen')!.activo).toBe(false);
  });
});

describe('introDe / textoIntro', () => {
  const c: IntrosInforme = normalizarIntrosInforme({
    intros: [
      { id: 'duo', texto: 'Pasos de luz del dúo.', fotos: [URL_A], activo: true },
      { id: 'screen', texto: 'Screen.', fotos: [], activo: false },
    ],
  });

  it('el texto baja con sus fotos debajo', () => {
    expect(textoIntro(c, 'duo')).toBe(`Pasos de luz del dúo.\n[foto: ${URL_A}]`);
  });

  it('una intro apagada no aporta nada', () => {
    expect(introDe(c, 'screen')).toBeNull();
    expect(textoIntro(c, 'screen')).toBe('');
  });

  it('las que no se tocaron siguen dando su texto de fábrica', () => {
    expect(textoIntro(c, 'vertical')).toContain('entre sus lamas');
  });
});
