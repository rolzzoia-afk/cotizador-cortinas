// ─────────────────────────────────────────────────────────────────────
// LA REGLA DE ORO: sin plantilla guardada, la etiqueta sale igual que antes.
//
// `__fixtures__/catalogo.html` se grabó con el generador VIEJO (el que tenía la
// geometría escrita a mano) ANTES de migrarlo al motor de plantillas. El test
// vuelve a generar la misma etiqueta con el default y compara caja por caja:
// posición, tamaño, cuerpo, negrita y texto. Si algo se corrió un milímetro, se
// entera acá y no la vendedora con 200 muestras impresas.
//
// Cómo se regenera la fixture (solo si el diseño cambia A PROPÓSITO): correr el
// generador y guardar su salida con estos mismos dos ejemplos.
// ─────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlEtiquetasCatalogo } from '@/modules/telas/etiquetaCatalogo';
import { htmlEtiquetasSobrante } from '@/modules/telas/etiquetaSobrante';
import { htmlDeEtiquetas } from './etiquetaHtml';
import { normalizarPlantilla, type PlantillaEtiqueta } from './plantilla';
import { PLANTILLA_CATALOGO } from './defaults/catalogo';

const MUESTRAS = [
  {
    codigos: 'BK 01',
    tipo: 'BLACKOUT',
    descripcion: 'BLANCO ESTANDAR',
    ancho: '2,5',
    calidad: 'PREMIUM',
  },
  {
    codigos: 'BK 11 / BK 12',
    tipo: 'SCREEN',
    descripcion: 'GRIS OSCURO JASPEADO R1002-8',
    ancho: '2,97',
    calidad: 'DELUX',
  },
];

const LOGO = 'data:image/png;base64,LOGO';

/** Un rectángulo dibujado, leído del HTML: posición, tamaño y cómo se ve. */
type Rect = {
  left: string;
  top: string;
  width: string;
  height: string;
  fontSize: string;
  bold: boolean;
  texto: string;
};

const estiloDe = (style: string, prop: string): string => {
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;"]+)`));
  return m ? m[1].trim() : '';
};

/** Las líneas divisorias, que los dos motores dibujan con DOM distinto. */
const ES_DIVISOR = /\b(divV|divH|linea)\b/;

/**
 * Todos los bloques posicionados del documento, en orden de aparición.
 *
 * Se leen las etiquetas de apertura y el texto que sigue: el `.tabla` del motor
 * viejo tenía divisores adentro, y un regex que buscara el `</div>` de cierre
 * se comería el anidado.
 */
function rectangulos(html: string, css: string): Rect[] {
  const out: Rect[] = [];
  const re = /<(div|img)\s+class="([^"]*)"([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, , clases, atributos] = m;
    if (ES_DIVISOR.test(clases)) continue;
    const resto = html.slice(m.index + m[0].length);
    const interior = resto.slice(0, Math.max(0, resto.indexOf('</div>')));
    const style = atributos.match(/style="([^"]*)"/)?.[1] ?? '';
    if (!style.includes('left:') || !style.includes('top:')) continue;
    // El cuerpo y la negrita pueden venir inline (motor nuevo) o de una clase
    // del CSS (motor viejo): se busca en los dos lados.
    const deClase = (prop: string): string => {
      for (const c of clases.split(/\s+/).filter(Boolean)) {
        const bloque = css.match(new RegExp(`\\.${c}\\b[^{]*\\{([^}]*)\\}`));
        if (bloque) {
          const v = estiloDe(bloque[1], prop);
          if (v) return v;
        }
      }
      return '';
    };
    out.push({
      left: estiloDe(style, 'left'),
      top: estiloDe(style, 'top'),
      width: estiloDe(style, 'width'),
      height: estiloDe(style, 'height'),
      // Sin tamaño declarado manda el del navegador (16 px = 12 pt exactos):
      // el motor viejo dejaba así el campo CÓDIGOS y el nuevo lo escribe. Se
      // compara lo que se IMPRIME, no cómo está escrito.
      fontSize: estiloDe(style, 'font-size') || deClase('font-size') || '12pt',
      bold: /font-weight\s*:\s*bold/.test(style) || deClase('font-weight') === 'bold',
      texto: interior
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return out;
}

const cssDe = (html: string): string => html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

const ordenar = (r: Rect[]): Rect[] =>
  [...r].sort((a, b) => (a.top + a.left).localeCompare(b.top + b.left));

describe('la etiqueta de catálogo sale IGUAL que antes de la plantilla', () => {
  const viejo = readFileSync('src/modules/etiquetas/__fixtures__/catalogo.html', 'utf8');
  const nuevo = htmlEtiquetasCatalogo(MUESTRAS, LOGO);

  it('la hoja mide lo mismo', () => {
    const page = (h: string) => h.match(/@page\s*\{[^}]*\}/)?.[0].replace(/\s+/g, ' ');
    expect(page(nuevo)).toBe(page(viejo));
  });

  it('salen las mismas etiquetas', () => {
    const cuenta = (h: string) => (h.match(/class="etiqueta"/g) ?? []).length;
    expect(cuenta(nuevo)).toBe(2);
    expect(cuenta(nuevo)).toBe(cuenta(viejo));
  });

  it('cada cuadro está en el mismo lugar, del mismo tamaño y con la misma letra', () => {
    const a = ordenar(rectangulos(viejo, cssDe(viejo)));
    const b = ordenar(rectangulos(nuevo, cssDe(nuevo)));
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i++) {
      expect({ i, ...b[i] }).toEqual({ i, ...a[i] });
    }
  });

  it('las divisorias de la tabla caen en el mismo lugar', () => {
    // El motor viejo las anidaba adentro del recuadro (posición relativa) y el
    // nuevo las dibuja sueltas: distinto DOM, misma cruz sobre el papel.
    // Viejo: tabla en 1,52 / 17,07 con divisores en 29,53 y 12,59.
    const vertical = nuevo.match(/class="linea"[^>]*left:31\.05mm/);
    const horizontal = nuevo.match(/class="linea"[^>]*top:29\.66mm/);
    expect(vertical).not.toBeNull();
    expect(horizontal).not.toBeNull();
  });

  it('conserva lo que hace imprimible el diseño: fondos, encoger y el print', () => {
    expect(nuevo).toContain('print-color-adjust: exact');
    expect(nuevo).toContain('data-encoger');
    expect(nuevo).toContain('data-parte');
    expect(nuevo).toContain('window.print()');
    // La banda de CÓDIGOS va en negro con letra blanca, o se imprime invisible.
    expect(nuevo).toMatch(/background:#000/);
    expect(nuevo).toMatch(/color:#fff/);
  });

  it('escapa lo que el usuario escribe', () => {
    const html = htmlEtiquetasCatalogo(
      [{ ...MUESTRAS[0], descripcion: 'TELA <script>alert(1)</script>' }],
      LOGO,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('la etiqueta del sobrante sale IGUAL que antes de la plantilla', () => {
  const viejo = readFileSync('src/modules/etiquetas/__fixtures__/sobrante.html', 'utf8');
  const nuevo = htmlEtiquetasSobrante([
    {
      codigo: 'SC 96',
      funcional: { roller: true, vertical: false },
      anchoCm: 102,
      altoCm: 170,
      origen: 'OT 3187-B',
      fechaISO: '2026-08-26T12:00:00.000Z',
      ubicacion: 'A-54',
      serial: 'OT3187B-260826-S1',
    },
    {
      codigo: 'BK 10',
      funcional: { roller: true, vertical: true },
      anchoCm: 159,
      altoCm: 256,
      origen: 'LOTE Corte 02/09',
      otsDelLote: ['#3215', '#3213'],
      fechaISO: '2026-09-02T12:00:00.000Z',
      ubicacion: 'L02',
      serial: 'LCORTE0209-020926-S2',
    },
  ]);

  /** Solo el plano y lo que dice: el cuerpo se afirma aparte, más abajo. */
  const plano = (h: string) =>
    ordenar(rectangulos(h, cssDe(h))).map(({ left, top, width, height, texto }) => ({
      left,
      top,
      width,
      height,
      texto,
    }));

  it('el papel mide lo mismo y salen las dos etiquetas', () => {
    expect(nuevo).toContain('@page { size: 62mm 62mm; margin: 0; }');
    expect((nuevo.match(/class="etiqueta"/g) ?? []).length).toBe(2);
  });

  it('cada cuadro cae en el mismo lugar y dice lo mismo', () => {
    expect(plano(nuevo)).toEqual(plano(viejo));
  });

  it('los datos grandes conservan su cuerpo: código, medidas y ubicación', () => {
    for (const pt of ['17pt', '15pt', '19pt']) expect(nuevo).toContain(`font-size:${pt}`);
  });

  it('marca AMBAS cuando sirve para las dos, y solo esa', () => {
    // La segunda etiqueta (BK 10) sirve para roller y vertical.
    const segunda = nuevo.split('class="etiqueta"')[2];
    const vistos = segunda.match(/class="visto"/g) ?? [];
    expect(vistos).toHaveLength(1);
    // El visto va en la casilla de AMBAS.
    const iAmbas = segunda.indexOf('AMBAS');
    const iVisto = segunda.indexOf('class="visto"');
    expect(iVisto).toBeLessThan(iAmbas);
    expect(segunda.slice(iVisto, iAmbas)).not.toContain('ROLLER');
  });

  it('las OTs del lote solo aparecen cuando el sobrante salió de un lote', () => {
    const [, primera, segunda] = nuevo.split('class="etiqueta"');
    expect(primera).toContain('OT 3187-B');
    expect(primera).not.toContain('<small>OT');
    expect(segunda).toContain('OT #3215 · OT #3213');
  });
});

describe('htmlDeEtiquetas — el motor', () => {
  const plantilla: PlantillaEtiqueta = {
    version: 1,
    hoja: { ancho: 62, alto: 30 },
    elementos: [
      {
        id: 'titulo',
        tipo: 'texto',
        visible: true,
        x: 1,
        y: 1,
        ancho: 60,
        alto: 6,
        texto: 'OT {ot}',
        estilo: { pt: 12, bold: true, align: 'centro', color: 'negro' },
      },
      {
        id: 'medida',
        tipo: 'campo',
        visible: true,
        x: 1,
        y: 8,
        ancho: 30,
        alto: 5,
        slot: 'medida',
        estilo: { pt: 9, bold: false, align: 'izquierda', color: 'negro' },
      },
      {
        id: 'oculto',
        tipo: 'campo',
        visible: false,
        x: 1,
        y: 14,
        ancho: 30,
        alto: 5,
        slot: 'medida',
        estilo: { pt: 9, bold: false, align: 'izquierda', color: 'negro' },
      },
    ],
  };

  it('el texto fijo intercala los datos con {slot}', () => {
    const html = htmlDeEtiquetas(plantilla, [{ ot: '3213', medida: '120 × 200' }]);
    expect(html).toContain('OT 3213');
    expect(html).toContain('120 × 200');
  });

  it('un elemento invisible no se dibuja', () => {
    const html = htmlDeEtiquetas(plantilla, [{ ot: '1', medida: 'X' }]);
    expect((html.match(/120|X/g) ?? []).length).toBe(1);
  });

  it('una etiqueta por juego de datos', () => {
    const html = htmlDeEtiquetas(plantilla, [
      { ot: '1', medida: 'A' },
      { ot: '2', medida: 'B' },
      { ot: '3', medida: 'C' },
    ]);
    expect((html.match(/class="etiqueta"/g) ?? []).length).toBe(3);
  });

  it('el papel es el de la plantilla', () => {
    expect(htmlDeEtiquetas(plantilla, [])).toContain('@page { size: 62mm 30mm; margin: 0; }');
  });

  it('un slot sin dato sale vacío, no rompe la etiqueta', () => {
    const html = htmlDeEtiquetas(plantilla, [{}]);
    expect(html).toContain('class="etiqueta"');
    expect(html).toContain('OT {ot}'); // el slot desconocido se ve, no se traga
  });
});

describe('normalizarPlantilla', () => {
  it('lo guardado se superpone al default, elemento por elemento', () => {
    const guardada = {
      version: 1,
      hoja: { ancho: 62, alto: 52 },
      elementos: [{ id: 'codigos', x: 10, visible: false }],
    };
    const p = normalizarPlantilla(guardada, PLANTILLA_CATALOGO);
    const codigos = p.elementos.find((e) => e.id === 'codigos')!;
    expect(codigos.x).toBe(10);
    expect(codigos.visible).toBe(false);
    // Lo que no se tocó sigue como de fábrica.
    const original = PLANTILLA_CATALOGO.elementos.find((e) => e.id === 'codigos')!;
    expect(codigos.y).toBe(original.y);
    expect(p.elementos).toHaveLength(PLANTILLA_CATALOGO.elementos.length);
  });

  it('un elemento NUEVO del sistema aparece solo, sin restaurar nada', () => {
    // Se guarda una plantilla que no conoce el pie; el default sí lo trae.
    const guardada = { version: 1, elementos: [{ id: 'codigos', x: 10 }] };
    const p = normalizarPlantilla(guardada, PLANTILLA_CATALOGO);
    expect(p.elementos.some((e) => e.id === 'pie')).toBe(true);
  });

  it('un id que ya no existe se descarta sin romper', () => {
    const p = normalizarPlantilla(
      { elementos: [{ id: 'fantasma', x: 1 }] },
      PLANTILLA_CATALOGO,
    );
    expect(p.elementos.some((e) => e.id === 'fantasma')).toBe(false);
    expect(p.elementos).toHaveLength(PLANTILLA_CATALOGO.elementos.length);
  });

  it('conserva los cuadros que agregó el usuario (los `x-`)', () => {
    const p = normalizarPlantilla(
      {
        elementos: [
          { id: 'x-nota', tipo: 'texto', x: 2, y: 45, ancho: 20, alto: 4, texto: 'REVISADO' },
        ],
      },
      PLANTILLA_CATALOGO,
    );
    const propio = p.elementos.find((e) => e.id === 'x-nota');
    expect(propio).toBeDefined();
    expect(propio!.tipo).toBe('texto');
  });

  it('un elemento inventado SIN el prefijo x- no entra', () => {
    const p = normalizarPlantilla(
      { elementos: [{ id: 'colado', tipo: 'texto', texto: 'hola' }] },
      PLANTILLA_CATALOGO,
    );
    expect(p.elementos.some((e) => e.id === 'colado')).toBe(false);
  });

  it('la basura cae en el default sin lanzar', () => {
    expect(normalizarPlantilla(null, PLANTILLA_CATALOGO).elementos).toHaveLength(
      PLANTILLA_CATALOGO.elementos.length,
    );
    expect(normalizarPlantilla({ elementos: 'no es lista' }, PLANTILLA_CATALOGO).hoja).toEqual(
      PLANTILLA_CATALOGO.hoja,
    );
    const p = normalizarPlantilla(
      { hoja: { ancho: 'x', alto: -5 }, elementos: [{ id: 'codigos', x: 'nada', pt: 'no' }] },
      PLANTILLA_CATALOGO,
    );
    expect(p.hoja.ancho).toBe(62);
    expect(p.elementos.find((e) => e.id === 'codigos')!.x).toBe(31.15);
  });

  it('el slot de un campo NO se puede cambiar: es el enchufe con el dato', () => {
    const p = normalizarPlantilla(
      { elementos: [{ id: 'codigos', slot: 'otra_cosa' }] },
      PLANTILLA_CATALOGO,
    );
    const codigos = p.elementos.find((e) => e.id === 'codigos')!;
    expect(codigos.tipo === 'campo' && codigos.slot).toBe('codigos');
  });
});
