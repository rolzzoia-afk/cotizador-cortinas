import { describe, expect, it } from 'vitest';
import {
  esUrlFotoSegura,
  fotosDelInforme,
  informeAHtml,
  informeATextoPlano,
  lineaFoto,
  normalizarFotos,
  pathDeUrlPublica,
  textoConFotos,
  urlDeLineaFoto,
} from './imagenesInforme';

const URL_A = 'https://proj.supabase.co/storage/v1/object/public/informe-assets/emp/intro-duo/1.jpg';
const URL_B = 'https://proj.supabase.co/storage/v1/object/public/informe-assets/emp/intro-duo/2.jpg';

describe('urlDeLineaFoto', () => {
  it('reconoce el marcador, con o sin espacios alrededor', () => {
    expect(urlDeLineaFoto(`[foto: ${URL_A}]`)).toBe(URL_A);
    expect(urlDeLineaFoto(`   [foto:${URL_A}]  `)).toBe(URL_A);
    expect(urlDeLineaFoto(`[FOTO: ${URL_A}]`)).toBe(URL_A);
  });

  it('un [foto: …] EN MEDIO de una frase es texto, no una foto', () => {
    // Si no, se rompería el párrafo de alguien que escribió eso a propósito.
    expect(urlDeLineaFoto(`Mira esto [foto: ${URL_A}] y dime`)).toBeNull();
  });

  it('una línea normal no es marcador', () => {
    expect(urlDeLineaFoto('1. Living / Comedor')).toBeNull();
    expect(urlDeLineaFoto('')).toBeNull();
  });

  it('`lineaFoto` produce lo que `urlDeLineaFoto` lee', () => {
    expect(urlDeLineaFoto(lineaFoto(URL_A))).toBe(URL_A);
  });
});

describe('esUrlFotoSegura', () => {
  it('acepta http y https', () => {
    expect(esUrlFotoSegura(URL_A)).toBe(true);
    expect(esUrlFotoSegura('http://x.cl/a.png')).toBe(true);
  });

  it('rechaza todo lo que no sea http(s): el HTML termina en un correo', () => {
    expect(esUrlFotoSegura('javascript:alert(1)')).toBe(false);
    expect(esUrlFotoSegura('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false);
    expect(esUrlFotoSegura('/relativa.jpg')).toBe(false);
    expect(esUrlFotoSegura('')).toBe(false);
  });
});

describe('informeAHtml', () => {
  it('cada bloque separado por línea en blanco es un <p>, y los saltos simples <br>', () => {
    const html = informeAHtml('Hola\nqué tal\n\nOtro párrafo');
    expect(html).toContain('Hola<br>qué tal');
    expect((html.match(/<p /g) ?? []).length).toBe(2);
  });

  it('el marcador se convierte en <img> con la URL', () => {
    const html = informeAHtml(`Texto\n${lineaFoto(URL_A)}\nMás texto`);
    expect(html).toContain(`<img src="${URL_A}"`);
    // Y corta el párrafo: la foto no queda pegada dentro del texto.
    expect(html).toContain('>Texto</p>');
    expect(html).toContain('>Más texto</p>');
  });

  it('escapa el texto: nada de HTML inyectado desde Admin', () => {
    const html = informeAHtml('5 < 6 & "así" <script>alert(1)</script>');
    expect(html).toContain('5 &lt; 6 &amp;');
    expect(html).not.toContain('<script>');
  });

  it('una URL no http(s) NO genera etiqueta: sale como texto', () => {
    const html = informeAHtml('[foto: javascript:alert(1)]');
    expect(html).not.toContain('<img');
    expect(html).toContain('[foto: javascript:alert(1)]');
  });

  it('lleva estilos EN LÍNEA (Gmail descarta las hojas de estilo)', () => {
    const html = informeAHtml(`hola\n${lineaFoto(URL_A)}`);
    expect(html).toContain('style="margin:0 0 12px;font-family:');
    expect(html).toContain('max-width:100%');
  });

  it('texto vacío → HTML vacío', () => {
    expect(informeAHtml('')).toBe('');
    expect(informeAHtml('\n\n')).toBe('');
  });
});

describe('informeATextoPlano', () => {
  it('el marcador se reduce a su URL, para que el link siga a mano', () => {
    expect(informeATextoPlano(`Texto\n${lineaFoto(URL_A)}`)).toBe(`Texto\n${URL_A}`);
  });

  it('el resto del texto no se toca', () => {
    const t = '1. Living\n   - Tipo de Cortina: Duo Blackout DU 39';
    expect(informeATextoPlano(t)).toBe(t);
  });
});

describe('fotosDelInforme', () => {
  it('devuelve las URLs en orden y sin repetir', () => {
    const t = [lineaFoto(URL_A), 'texto', lineaFoto(URL_B), lineaFoto(URL_A)].join('\n');
    expect(fotosDelInforme(t)).toEqual([URL_A, URL_B]);
  });

  it('ignora los marcadores con URL insegura', () => {
    expect(fotosDelInforme('[foto: javascript:x]')).toEqual([]);
  });
});

describe('textoConFotos', () => {
  it('pega las fotos debajo del texto, una por línea', () => {
    expect(textoConFotos('Hola', [URL_A, URL_B])).toBe(
      `Hola\n${lineaFoto(URL_A)}\n${lineaFoto(URL_B)}`,
    );
  });

  it('sin fotos devuelve el texto tal cual, y sin texto no deja líneas sueltas', () => {
    expect(textoConFotos('Hola', [])).toBe('Hola');
    expect(textoConFotos('Hola', undefined)).toBe('Hola');
    expect(textoConFotos('  ', [])).toBe('');
  });

  it('descarta las URLs inseguras', () => {
    expect(textoConFotos('Hola', ['javascript:x', URL_A])).toBe(`Hola\n${lineaFoto(URL_A)}`);
  });
});

describe('pathDeUrlPublica', () => {
  it('saca el path para poder borrar el archivo', () => {
    expect(pathDeUrlPublica(URL_A)).toBe('emp/intro-duo/1.jpg');
  });

  it('decodifica y descarta el query string', () => {
    const url = URL_A.replace('1.jpg', 'a%20b.jpg') + '?v=2';
    expect(pathDeUrlPublica(url)).toBe('emp/intro-duo/a b.jpg');
  });

  it('una URL de otro lado devuelve vacío: no es nuestra, no se borra', () => {
    expect(pathDeUrlPublica('https://otra.cl/foto.jpg')).toBe('');
    expect(pathDeUrlPublica('')).toBe('');
  });
});

describe('normalizarFotos', () => {
  it('deja solo URLs válidas, sin repetir', () => {
    expect(normalizarFotos([URL_A, 'basura', URL_A, URL_B])).toEqual([URL_A, URL_B]);
  });

  it('lo que no es lista devuelve vacío', () => {
    expect(normalizarFotos(null)).toEqual([]);
    expect(normalizarFotos('x')).toEqual([]);
  });

  it('corta en el tope', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => `https://x.cl/${i}.jpg`);
    expect(normalizarFotos(muchas).length).toBeLessThanOrEqual(6);
  });
});
