import { describe, expect, it } from 'vitest';
import {
  combinarEtiquetas,
  datosEtiquetaCatalogo,
  formatearAncho,
  htmlEtiquetasCatalogo,
  nombreDeTela,
  tipoLargo,
} from './etiquetaCatalogo';
import { PLANTILLA_CATALOGO } from '@/modules/etiquetas/defaults/catalogo';
import type { Tela } from '@/pages/telas/Telas.types';

const tela = (over: Partial<Tela> = {}): Tela => ({
  id: '1',
  codigo: 'SC 03',
  tipo: 'SC',
  grupo: 'SCREEN',
  nemotecnico: 'SC BLANCO',
  proveedor: 'PROV',
  cod_ext: null,
  descriptor: 'BLANCO 1%',
  ancho: 2.5,
  calidad: 'PREMIUM',
  status_stock: null,
  stock_minimo: null,
  stock_total: null,
  stock_mp: null,
  stock_liberado: null,
  posicion: null,
  almacen: null,
  estado: 'ACTIVO',
  proveedor_codigo: null,
  responsable: null,
  observaciones: null,
  foto_url: null,
  ...over,
});

const LOGO = 'data:image/png;base64,AAA';

/** El texto que se ve impreso, sin las etiquetas que lo envuelven. */
const soloTexto = (html: string): string => html.replace(/<[^>]+>/g, '');

describe('tipoLargo', () => {
  it('escribe la familia completa como el Excel de marketing', () => {
    expect(tipoLargo('BK')).toBe('BLACKOUT');
    expect(tipoLargo('SC')).toBe('SCREEN');
    expect(tipoLargo('DU')).toBe('DUO');
  });

  it('una familia desconocida se imprime tal cual, no en blanco', () => {
    expect(tipoLargo('OSCURANTI')).toBe('OSCURANTI');
    expect(tipoLargo(null)).toBe('');
  });
});

describe('formatearAncho', () => {
  it('usa coma es-CL y no rellena decimales', () => {
    expect(formatearAncho(2.5)).toBe('2,5');
    expect(formatearAncho(2.97)).toBe('2,97');
    expect(formatearAncho(3)).toBe('3');
  });

  it('sin ancho cargado deja el campo vacío en vez de imprimir cero', () => {
    expect(formatearAncho(null)).toBe('');
    expect(formatearAncho(undefined)).toBe('');
  });
});

describe('nombreDeTela', () => {
  it('usa el descriptor, que es como se llama la tela para la clienta', () => {
    expect(nombreDeTela(tela({ descriptor: 'BLANCO ESTANDAR' }))).toBe('BLANCO ESTANDAR');
  });

  // 81 de las 214 telas del catálogo no tienen descriptor cargado (2026-08-28):
  // esas etiquetas salían con el recuadro «TELA:» en blanco.
  it('sin descriptor cae al nemotécnico en vez de dejar el recuadro vacío', () => {
    expect(nombreDeTela(tela({ descriptor: null }))).toBe('SC BLANCO');
    expect(nombreDeTela(tela({ descriptor: '   ' }))).toBe('SC BLANCO');
  });

  it('sin ninguno de los dos queda vacío, nunca "null"', () => {
    expect(nombreDeTela(tela({ descriptor: null, nemotecnico: null }))).toBe('');
  });
});

describe('datosEtiquetaCatalogo', () => {
  it('mapea los 5 campos que combinaba la plantilla', () => {
    expect(datosEtiquetaCatalogo(tela())).toEqual({
      codigos: 'SC 03',
      tipo: 'SCREEN',
      descripcion: 'BLANCO 1%',
      ancho: '2,5',
      calidad: 'PREMIUM',
    });
  });

  it('los nulos quedan en blanco, nunca como "null"', () => {
    const e = datosEtiquetaCatalogo(
      tela({ descriptor: null, nemotecnico: null, calidad: null, ancho: null }),
    );
    expect(e).toMatchObject({ descripcion: '', calidad: '', ancho: '' });
  });
});

describe('combinarEtiquetas', () => {
  // Caso «BK 11 / BK 12» del catálogo viejo: dos códigos, una sola muestra.
  it('une los códigos en el orden elegido y toma el resto de la primera', () => {
    const e = combinarEtiquetas([
      tela({ codigo: 'BK 11', descriptor: 'GRIS 4M', tipo: 'BK' }),
      tela({ codigo: 'BK 12', descriptor: 'OTRO', tipo: 'SC' }),
    ]);
    expect(e.codigos).toBe('BK 11 / BK 12');
    expect(e.descripcion).toBe('GRIS 4M');
    expect(e.tipo).toBe('BLACKOUT');
  });
});

describe('encoger para que quepa', () => {
  // El ajuste se hace midiendo el texto ya dibujado, no contando letras:
  // acá se fija que los campos variables queden marcados y que el documento
  // lleve el guion que los mide antes de imprimir.
  it('marca los campos de la tela y no los rótulos fijos', () => {
    const html = htmlEtiquetasCatalogo([datosEtiquetaCatalogo(tela())], LOGO);
    // Solo el cuerpo: el CSS y el guion también nombran el atributo.
    const cuerpo = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
    // codigos, tipo, calidad, descripcion y ancho.
    expect(cuerpo.match(/data-encoger/g)).toHaveLength(5);
    // Los rótulos fijos no encogen: si no caben, es que el diseño está mal.
    expect(cuerpo).not.toMatch(/data-encoger[^>]*>TELA:/);
    expect(cuerpo).not.toMatch(/data-encoger[^>]*>Ancho máximo:/);
  });

  it('el documento ajusta antes de mandar a la impresora', () => {
    const html = htmlEtiquetasCatalogo([datosEtiquetaCatalogo(tela())], LOGO);
    expect(html).toContain('el.scrollWidth > el.clientWidth');
    expect(html.indexOf('function ajustar()')).toBeLessThan(html.indexOf('window.print()'));
  });

  // Solo el nombre de la tela puede terminar en dos renglones: es el único
  // dato largo de verdad (hay descriptores de 46 caracteres en el catálogo).
  it('solo el nombre de la tela puede partirse en dos renglones', () => {
    const html = htmlEtiquetasCatalogo([datosEtiquetaCatalogo(tela())], LOGO);
    const cuerpo = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
    expect(cuerpo.match(/data-parte/g)).toHaveLength(1);
    // Y el que se parte es justamente el nombre de la tela.
    expect(cuerpo).toMatch(/data-parte><span class="txt"><span class="p">BLANCO<\/span>/);
    // Y se parte recién cuando encoger en una línea ya no alcanza.
    expect(html).toContain("el.style.whiteSpace = 'normal'");
    expect(html).toContain('el.scrollHeight > el.clientHeight');
  });
});

describe('los datos caen adentro de los recuadros', () => {
  // El .lbx traía cada cuadro de texto ajustado a su texto de EJEMPLO, no a la
  // celda dibujada: el de TIPO medía 15,95 mm (lo justo para «SCREEN») y el del
  // nombre de la tela terminaba 1 mm más afuera que la tabla. Así, «BLACKOUT»
  // se encogía sin necesidad y «BLANCO ESTANDAR» se salía por el costado en vez
  // de encoger (visto impreso el 2026-08-28).
  //
  // Ahora la geometría es la PLANTILLA de fábrica, así que se afirma sobre
  // ella: es la que sale impresa mientras nadie la edite en Admin.
  const caja = (id: string) => {
    const e = PLANTILLA_CATALOGO.elementos.find((x) => x.id === id);
    if (!e) throw new Error(`no está el elemento ${id} en la plantilla`);
    return e;
  };

  const tabla = caja('tabla');
  const divX = caja('tabla_div_v').x - tabla.x;
  const divY = caja('tabla_div_h').y - tabla.y;

  it('ningún campo se pasa del borde derecho de la tabla', () => {
    for (const id of ['tipo', 'calidad', 'rotulo_tela', 'descripcion', 'rotulo_ancho', 'ancho']) {
      const c = caja(id);
      expect(c.x + c.ancho).toBeLessThanOrEqual(tabla.x + tabla.ancho);
    }
  });

  it('los datos de la columna izquierda no cruzan la línea del medio', () => {
    for (const id of ['tipo', 'calidad', 'rotulo_ancho']) {
      const c = caja(id);
      expect(c.x + c.ancho).toBeLessThanOrEqual(tabla.x + divX);
    }
  });

  it('el nombre de la tela usa todo el ancho de su celda, no el del ejemplo', () => {
    const c = caja('descripcion');
    // Lo que sobra hasta el borde es solo el aire; nada de 1 mm afuera.
    expect(tabla.x + tabla.ancho - (c.x + c.ancho)).toBeLessThanOrEqual(1.5);
    // Y de alto llega hasta la línea horizontal, para poder ir en dos renglones.
    expect(c.y + c.alto).toBeLessThanOrEqual(tabla.y + divY);
    expect(c.alto).toBeGreaterThan(5.5);
  });

  it('la familia tiene el mismo lugar que la calidad, así no encoge sola', () => {
    expect(caja('tipo').ancho).toBeCloseTo(caja('calidad').ancho, 0);
  });
});

describe('htmlEtiquetasCatalogo', () => {
  it('imprime una etiqueta por tela en papel de 62 × 52 mm', () => {
    const html = htmlEtiquetasCatalogo(
      [datosEtiquetaCatalogo(tela()), datosEtiquetaCatalogo(tela({ codigo: 'BK 01' }))],
      LOGO,
    );
    expect(html.match(/class="etiqueta"/g)).toHaveLength(2);
    expect(html).toContain('@page { size: 62mm 52mm; margin: 0; }');
  });

  it('lleva los datos de la tela, el logo y el pie de la marca', () => {
    const html = htmlEtiquetasCatalogo([datosEtiquetaCatalogo(tela())], LOGO);
    for (const dato of ['SC 03', 'SCREEN', 'PREMIUM', '2,5']) {
      expect(html).toContain(dato);
    }
    expect(soloTexto(html)).toContain('BLANCO 1%');
    expect(html).toContain('CÓDIGOS');
    expect(html).toContain('Ancho máximo:');
    expect(html).toContain('www.cortinasrolzzo.cl');
    expect(html).toContain(`src="${LOGO}"`);
  });

  // El nombre va palabra por palabra para que el renglón se parta solo en los
  // espacios; el envoltorio existe porque sin él las palabras quedan como
  // items flex sueltos y el navegador se come los espacios («BLANCOESTANDAR»).
  it('el nombre va en palabras enteras y conserva los espacios', () => {
    const html = htmlEtiquetasCatalogo(
      [datosEtiquetaCatalogo(tela({ descriptor: 'BLACKOUT R1002-8' }))],
      LOGO,
    );
    expect(html).toContain(
      '<span class="txt"><span class="p">BLACKOUT</span> <span class="p">R1002-8</span></span>',
    );
    expect(soloTexto(html)).toContain('BLACKOUT R1002-8');
  });

  it('escapa el texto de la tela para no romper el HTML', () => {
    const html = htmlEtiquetasCatalogo(
      [datosEtiquetaCatalogo(tela({ descriptor: 'GRIS <B> & CO' }))],
      LOGO,
    );
    expect(html).toContain('&lt;B&gt;');
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<B>');
  });

  // La impresora descarta los fondos si no se lo pide explícitamente, y la
  // banda negra de CÓDIGOS salía en blanco en la prueba del 2026-08-28.
  it('pide que se impriman los fondos, o la banda de CÓDIGOS sale en blanco', () => {
    const html = htmlEtiquetasCatalogo([datosEtiquetaCatalogo(tela())], LOGO);
    expect(html).toContain('print-color-adjust: exact');
  });
});
