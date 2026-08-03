import { describe, expect, it } from 'vitest';
import {
  ANCHO_MAX,
  ANCHO_MIN,
  LAYOUT_DEFAULT,
  SECCIONES,
  bloqueNuevo,
  bloquesEnFlujo,
  bloquesJuntoATotales,
  claseAlineacion,
  esSeccion,
  flotantesDe,
  moverBloqueA,
  normalizarLayout,
  type BloqueDoc,
} from './docCotizacion';

const tipos = (bs: BloqueDoc[]) => bs.map((b) => b.tipo);
const ids = (bs: BloqueDoc[]) => bs.map((b) => b.id);

describe('LAYOUT_DEFAULT', () => {
  it('las 4 secciones y después términos + cuotas', () => {
    expect(tipos(LAYOUT_DEFAULT.bloques)).toEqual([
      'datos_cliente',
      'catalogo',
      'cortinas',
      'totales',
      'terminos',
      'banner_cuotas',
    ]);
  });

  it('los términos comparten fila con los totales (el hueco a la izquierda)', () => {
    expect(bloquesJuntoATotales(LAYOUT_DEFAULT.bloques).map((b) => b.tipo)).toEqual(['terminos']);
    // Y por eso ya no ocupan una franja propia del flujo.
    expect(tipos(bloquesEnFlujo(LAYOUT_DEFAULT.bloques))).not.toContain('terminos');
  });
});

describe('esSeccion', () => {
  it('distingue secciones del sistema de bloques de contenido', () => {
    expect(SECCIONES.every(esSeccion)).toBe(true);
    expect(esSeccion('imagen')).toBe(false);
    expect(esSeccion('terminos')).toBe(false);
  });
});

describe('normalizarLayout', () => {
  it('sin datos válidos cae al default', () => {
    expect(normalizarLayout(null)).toBe(LAYOUT_DEFAULT);
    expect(normalizarLayout({})).toBe(LAYOUT_DEFAULT);
    expect(normalizarLayout({ bloques: [] })).toBe(LAYOUT_DEFAULT);
    expect(normalizarLayout({ bloques: 'nope' })).toBe(LAYOUT_DEFAULT);
    expect(normalizarLayout({ bloques: [{ tipo: 'inexistente' }] })).toBe(LAYOUT_DEFAULT);
  });

  it('repone las secciones que falten, antes del contenido suelto', () => {
    const out = normalizarLayout({ bloques: [{ id: 'terminos', tipo: 'terminos' }] });
    expect(tipos(out.bloques)).toEqual([...SECCIONES, 'terminos']);
  });

  it('respeta el orden de secciones que eligió el admin', () => {
    const out = normalizarLayout({
      bloques: [
        { tipo: 'totales' },
        { tipo: 'cortinas' },
        { tipo: 'catalogo' },
        { tipo: 'datos_cliente' },
      ],
    });
    expect(tipos(out.bloques)).toEqual(['totales', 'cortinas', 'catalogo', 'datos_cliente']);
  });

  it('descarta secciones repetidas: siempre una de cada', () => {
    const out = normalizarLayout({
      bloques: [{ tipo: 'cortinas' }, { tipo: 'cortinas' }, { tipo: 'cortinas' }],
    });
    expect(out.bloques.filter((b) => b.tipo === 'cortinas')).toHaveLength(1);
    expect(tipos(out.bloques).sort()).toEqual([...SECCIONES].sort());
  });

  it('las secciones son siempre visibles y a ancho completo', () => {
    const out = normalizarLayout({
      bloques: [{ tipo: 'totales', visible: false, ancho: 20 }],
    });
    const tot = out.bloques.find((b) => b.tipo === 'totales')!;
    expect(tot.visible).toBe(true);
    expect(tot.ancho).toBe(100);
  });

  it('migra el formato viejo de zonas: encabezado arriba, pie abajo', () => {
    const out = normalizarLayout({
      bloques: [
        { id: 'terminos', tipo: 'terminos', zona: 'pie' },
        { id: 'cyber', tipo: 'imagen', zona: 'encabezado', url: 'https://x.cl/a.png' },
      ],
    });
    expect(tipos(out.bloques)).toEqual(['imagen', ...SECCIONES, 'terminos']);
  });

  it('acota el ancho al rango permitido', () => {
    const out = normalizarLayout({
      bloques: [
        { id: 'a', tipo: 'texto', ancho: 500 },
        { id: 'b', tipo: 'texto', ancho: 1 },
        { id: 'c', tipo: 'texto', ancho: 'x' },
        { id: 'd', tipo: 'texto', ancho: 42.4 },
      ],
    });
    const anchos = out.bloques.filter((b) => b.tipo === 'texto').map((b) => b.ancho);
    expect(anchos).toEqual([ANCHO_MAX, ANCHO_MIN, ANCHO_MAX, 42]);
  });

  it('repara ids duplicados o vacíos', () => {
    const out = normalizarLayout({
      bloques: [
        { id: 'x', tipo: 'texto' },
        { id: 'x', tipo: 'texto' },
        { id: '', tipo: 'imagen' },
      ],
    });
    expect(new Set(ids(out.bloques)).size).toBe(out.bloques.length);
  });

  it('visible por defecto true; alineación inválida cae a izquierda', () => {
    const out = normalizarLayout({ bloques: [{ id: 'a', tipo: 'texto', alineacion: 'diagonal' }] });
    const a = out.bloques.find((b) => b.id === 'a')!;
    expect(a.visible).toBe(true);
    expect(a.alineacion).toBe('izquierda');
  });

  it('respeta visible:false y limpia strings vacíos de imagen', () => {
    const out = normalizarLayout({
      bloques: [{ id: 'a', tipo: 'imagen', visible: false, url: '  ', enlace: ' https://x.cl ' }],
    });
    const a = out.bloques.find((b) => b.id === 'a')!;
    expect(a.visible).toBe(false);
    expect(a.url).toBeUndefined();
    expect(a.enlace).toBe('https://x.cl');
  });

  describe('imagen flotante', () => {
    const conFlotante = (flotante: unknown) =>
      normalizarLayout({ bloques: [{ id: 'f', tipo: 'imagen', flotante }] }).bloques.find(
        (b) => b.id === 'f',
      )!;

    it('conserva la posición y acota x/y a 0–100', () => {
      expect(conFlotante({ sobre: 'datos_cliente', x: 60, y: 5 }).flotante).toEqual({
        sobre: 'datos_cliente',
        x: 60,
        y: 5,
      });
      expect(conFlotante({ sobre: 'cortinas', x: -30, y: 999 }).flotante).toMatchObject({
        x: 0,
        y: 100,
      });
    });

    it('descarta la flotante si la sección de anclaje no existe', () => {
      expect(conFlotante({ sobre: 'inventado', x: 1, y: 1 }).flotante).toBeUndefined();
      expect(conFlotante('nada').flotante).toBeUndefined();
    });

    it('solo las imágenes y los carruseles pueden flotar', () => {
      const out = normalizarLayout({
        bloques: [
          { id: 't', tipo: 'texto', flotante: { sobre: 'totales', x: 1, y: 1 } },
          { id: 'c', tipo: 'carrusel', flotante: { sobre: 'datos_cliente', x: 35, y: 50 } },
        ],
      });
      expect(out.bloques.find((b) => b.id === 't')!.flotante).toBeUndefined();
      expect(out.bloques.find((b) => b.id === 'c')!.flotante).toMatchObject({
        sobre: 'datos_cliente',
      });
    });
  });

  describe('carrusel', () => {
    const imagenesDe = (imagenes: unknown) =>
      normalizarLayout({ bloques: [{ id: 'c', tipo: 'carrusel', imagenes }] }).bloques.find(
        (b) => b.id === 'c',
      )!.imagenes;

    it('descarta las entradas sin URL y limpia los espacios', () => {
      expect(
        imagenesDe([
          { url: ' https://x.cl/1.png ', enlace: ' https://x.cl ', alt: 'uno' },
          { url: '   ' },
          'basura',
          { enlace: 'https://y.cl' },
        ]),
      ).toEqual([{ url: 'https://x.cl/1.png', enlace: 'https://x.cl', alt: 'uno' }]);
    });

    it('un carrusel sin imágenes queda con la lista vacía, no undefined', () => {
      expect(imagenesDe(undefined)).toEqual([]);
      expect(imagenesDe('nada')).toEqual([]);
    });
  });

  describe('juntoATotales', () => {
    it('se conserva en los bloques de contenido', () => {
      const out = normalizarLayout({
        bloques: [{ id: 'terminos', tipo: 'terminos', juntoATotales: true }],
      });
      expect(out.bloques.find((b) => b.id === 'terminos')!.juntoATotales).toBe(true);
    });

    it('flotar y compartir fila con los totales son excluyentes: gana flotante', () => {
      const out = normalizarLayout({
        bloques: [
          {
            id: 'img',
            tipo: 'imagen',
            juntoATotales: true,
            flotante: { sobre: 'cortinas', x: 1, y: 2 },
          },
        ],
      });
      const img = out.bloques.find((b) => b.id === 'img')!;
      expect(img.flotante).toMatchObject({ sobre: 'cortinas' });
      expect(img.juntoATotales).toBeUndefined();
    });
  });
});

describe('moverBloqueA', () => {
  const base = [
    { id: 'a', tipo: 'texto' },
    { id: 'b', tipo: 'cortinas' },
    { id: 'c', tipo: 'totales' },
  ] as BloqueDoc[];

  it('inserta antes del bloque de referencia', () => {
    expect(ids(moverBloqueA(base, 'a', 'c'))).toEqual(['b', 'a', 'c']);
    expect(ids(moverBloqueA(base, 'c', 'a'))).toEqual(['c', 'a', 'b']);
  });

  it('sin referencia lo manda al final', () => {
    expect(ids(moverBloqueA(base, 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('mueve secciones del sistema igual que el contenido', () => {
    expect(ids(moverBloqueA(base, 'c', 'b'))).toEqual(['a', 'c', 'b']);
  });

  it('id inexistente o soltarse sobre sí mismo devuelve el mismo array', () => {
    expect(moverBloqueA(base, 'zzz')).toBe(base);
    expect(moverBloqueA(base, 'a', 'a')).toBe(base);
  });
});

describe('flotantesDe / bloquesJuntoATotales / bloquesEnFlujo', () => {
  const bloques = [
    { id: 'cli', tipo: 'datos_cliente', visible: true },
    { id: 'img', tipo: 'imagen', visible: true, flotante: { sobre: 'datos_cliente', x: 60, y: 5 } },
    { id: 'oculta', tipo: 'imagen', visible: false, flotante: { sobre: 'datos_cliente', x: 0, y: 0 } },
    { id: 'carr', tipo: 'carrusel', visible: true, flotante: { sobre: 'datos_cliente', x: 35, y: 50 } },
    { id: 'terminos', tipo: 'terminos', visible: true, juntoATotales: true },
    { id: 'pie', tipo: 'banner_cuotas', visible: true },
  ] as BloqueDoc[];

  it('agrupa las flotantes por la sección que las ancla, sin las ocultas', () => {
    expect(ids(flotantesDe(bloques, 'datos_cliente'))).toEqual(['img', 'carr']);
    expect(flotantesDe(bloques, 'totales')).toEqual([]);
  });

  it('separa los que comparten fila con los totales', () => {
    expect(ids(bloquesJuntoATotales(bloques))).toEqual(['terminos']);
  });

  it('en el flujo solo quedan los que ocupan franja propia', () => {
    expect(ids(bloquesEnFlujo(bloques))).toEqual(['cli', 'pie']);
  });
});

describe('bloqueNuevo', () => {
  it('la imagen nace a media página y centrada', () => {
    expect(bloqueNuevo('imagen', '1')).toMatchObject({
      tipo: 'imagen',
      ancho: 50,
      alineacion: 'centro',
      visible: true,
    });
  });

  it('el texto nace a ancho completo y sin flotar', () => {
    const b = bloqueNuevo('texto', '2');
    expect(b).toMatchObject({ ancho: 100, alineacion: 'izquierda' });
    expect(b.flotante).toBeUndefined();
  });

  it('el carrusel nace flotando en el hueco de los datos del cliente', () => {
    const b = bloqueNuevo('carrusel', '3');
    expect(b.flotante).toEqual({ sobre: 'datos_cliente', x: 35, y: 50 });
    expect(b.imagenes).toEqual([]);
    expect(b.ancho).toBe(60);
  });
});

describe('claseAlineacion', () => {
  it('mapea a las clases flex', () => {
    expect(claseAlineacion('centro')).toBe('justify-center');
    expect(claseAlineacion('derecha')).toBe('justify-end');
    expect(claseAlineacion('izquierda')).toBe('justify-start');
  });
});
