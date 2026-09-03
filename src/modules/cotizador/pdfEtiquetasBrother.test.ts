import { describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';

// Captura el documento al guardar (save vive en la instancia, no en el
// prototipo): subclase real de jsPDF, así las medidas de página son las reales.
const docsGuardados = vi.hoisted(() => [] as unknown[]);
// Todo lo que se imprime con text(), de todas las páginas de todos los docs.
// jsPDF cuelga sus métodos de la INSTANCIA (no del prototipo), así que se
// envuelve acá, al construir.
const textosImpresos = vi.hoisted(() => [] as string[]);
vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  class JsPDFCaptura extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      (this as { save: unknown }).save = () => {
        docsGuardados.push(this);
        return this;
      };
      const textOriginal = (this as { text: (...a: unknown[]) => unknown }).text.bind(this);
      (this as { text: unknown }).text = (s: string | string[], ...rest: unknown[]) => {
        textosImpresos.push(Array.isArray(s) ? s.join(' ') : String(s));
        return textOriginal(s, ...rest);
      };
    }
  }
  return { ...mod, jsPDF: JsPDFCaptura };
});

import {
  agruparEtiquetasPanos,
  codigoPerfilVertical,
  cuerpoTextoJunto,
  esFilaDark,
  esFilaSoftLight,
  esFilaSoftLightCC,
  esFilaOscuranti,
  especTuboEtiqueta,
  familiaTelaEtiqueta,
  fmtMedidaCm,
  generarEtiquetasPDF,
  generarEtiquetasPanosPDF,
  ladoCadenaEtiqueta,
  ordenDobleEtiqueta,
  sistemaEtiquetaEstructura,
  textoAccionamiento,
  tipoCortinaEtiqueta,
  tipoCortinaEtiquetaGrupo,
} from './pdfEtiquetasBrother';
import { codigoSeparadorPerfil, codigoZocaloPerfil } from '@/modules/descuentos/codigos-estructura';
import { asignarJuntoEnOrden, buildOptimizerRows, type OptimizerRow } from './tela';
import { construirHojaCorte } from './hojaCorte';

const pz = (columnaExcel: string, medidaCm: number, cod = '') => ({
  componente: columnaExcel, columnaExcel, medidaCm, cod, color: '',
});

describe('fmtMedidaCm', () => {
  it('coma decimal es-CL, hasta 2 decimales, sin ceros de cola', () => {
    expect(fmtMedidaCm(250.5)).toBe('250,5');
    expect(fmtMedidaCm(230)).toBe('230');
    // Tolera centésimas (hoy solo llegarían de un override manual): las conserva.
    expect(fmtMedidaCm(295.05)).toBe('295,05');
    expect(fmtMedidaCm(194.17)).toBe('194,17');
    expect(fmtMedidaCm(199.97)).toBe('199,97');
    expect(fmtMedidaCm(250.5)).toBe('250,5'); // ,50 → ,5
  });
});

describe('familiaTelaEtiqueta', () => {
  it('mapea el chip de tipo de tela', () => {
    expect(familiaTelaEtiqueta('BK')).toBe('BLACKOUT');
    expect(familiaTelaEtiqueta('SCR')).toBe('SCREEN');
    expect(familiaTelaEtiqueta('DU')).toBe('DUO');
  });

  it('sin chip, deriva del nombre del producto', () => {
    expect(familiaTelaEtiqueta(undefined, 'ROLLER BLACKOUT DELUX')).toBe('BLACKOUT');
    expect(familiaTelaEtiqueta('', 'ROLLER SCREEN PREMIUM')).toBe('SCREEN');
    expect(familiaTelaEtiqueta('', 'VERTICAL PVC')).toBe('VERTICAL');
    expect(familiaTelaEtiqueta('', '')).toBe('—');
  });
});

describe('tipoCortinaEtiqueta', () => {
  it('primera palabra del producto, fallback al tipo', () => {
    expect(tipoCortinaEtiqueta('ROLLER BLACKOUT DELUX')).toBe('ROLLER');
    expect(tipoCortinaEtiqueta('', 'DELUX')).toBe('DELUX');
    expect(tipoCortinaEtiqueta()).toBe('—');
  });
});

describe('tipoCortinaEtiquetaGrupo', () => {
  const r = (tuberiaCod: string, producto = 'ROLLER SCREEN PREMIUM'): OptimizerRow =>
    ({ tuberiaCod, producto, tipo: '' } as unknown as OptimizerRow);
  it('todas verticales → VERTICAL', () => {
    expect(tipoCortinaEtiquetaGrupo([r('VERTICAL'), r('VERTICAL')])).toBe('VERTICAL');
  });
  it('ninguna vertical → tipo roller del producto', () => {
    expect(tipoCortinaEtiquetaGrupo([r('38mm_E02')])).toBe('ROLLER');
  });
  it('grupo mixto vertical + roller → VERT/ROLLER', () => {
    expect(tipoCortinaEtiquetaGrupo([r('VERTICAL'), r('38mm_E02')])).toBe('VERT/ROLLER');
  });
  it('lista vacía → guion', () => {
    expect(tipoCortinaEtiquetaGrupo([])).toBe('—');
  });
});

describe('sistemaEtiquetaEstructura', () => {
  it('DUO por producto, DUAL por flag, si no la familia del producto', () => {
    expect(sistemaEtiquetaEstructura('ROLLER DUO BK', '', false)).toBe('DUO');
    expect(sistemaEtiquetaEstructura('ROLLER SCREEN', '', true)).toBe('DUAL');
    expect(sistemaEtiquetaEstructura('ROLLER BLACKOUT', '', false)).toBe('ROLLER');
  });
  it('pletina (velcro) gana al resto: PLETINA V (roller) / PLETINA DUO', () => {
    expect(sistemaEtiquetaEstructura('ROLLER SCREEN', '', false, true)).toBe('PLETINA V');
    expect(sistemaEtiquetaEstructura('ROLLER DUO BLACKOUT', '', false, true)).toBe('PLETINA DUO');
  });
  it('vertical gana a todo lo demás', () => {
    expect(sistemaEtiquetaEstructura('VERTICAL PVC', '', false, false, true)).toBe('VERTICAL');
    expect(sistemaEtiquetaEstructura('ROLLER DUO BK', '', true, true, true)).toBe('VERTICAL');
  });
});

describe('codigoPerfilVertical', () => {
  it('negro → VER61; blanco/gris/otro → VER62 (no hay vertical gris)', () => {
    expect(codigoPerfilVertical('NEGRO')).toBe('VER61');
    expect(codigoPerfilVertical('NEG')).toBe('VER61');
    // Plural tecleado en Fase 1: sigue siendo negro.
    expect(codigoPerfilVertical('NEGROS')).toBe('VER61');
    expect(codigoPerfilVertical('BLANCO')).toBe('VER62');
    expect(codigoPerfilVertical('BCO')).toBe('VER62');
    expect(codigoPerfilVertical('GRIS')).toBe('VER62');
    expect(codigoPerfilVertical('')).toBe('VER62');
    expect(codigoPerfilVertical(undefined)).toBe('VER62');
  });
});

describe('ordenDobleEtiqueta', () => {
  it('mapea el orden de telas a texto', () => {
    expect(ordenDobleEtiqueta('BK_VID_SCR')).toBe('BK AL VIDRIO');
    expect(ordenDobleEtiqueta('SCR_VID_BK')).toBe('SCR AL VIDRIO');
    expect(ordenDobleEtiqueta('')).toBe('');
  });
});

describe('especTuboEtiqueta', () => {
  it('arma "38 mm de 1,2 mm" desde código corto + chip', () => {
    expect(especTuboEtiqueta('38mm_E02', '0,38mm [E02] 1,2mm')).toBe('38 mm de 1,2 mm');
  });

  it('con el chip largo nuevo saca el espesor del código (E02→1,2; E66→2,5)', () => {
    expect(especTuboEtiqueta('38mm_E02', 'E02-TUBO 1.2 / Ø 38 mm')).toBe('38 mm de 1,2 mm');
    expect(especTuboEtiqueta('38mm_E66', 'E66 - TUBO (.40mm) - 2.5mm')).toBe('38 mm de 2,5 mm');
  });

  it('sin espesor en el chip deja solo el diámetro', () => {
    expect(especTuboEtiqueta('38mm_E02', '')).toBe('38 mm');
    expect(especTuboEtiqueta('38mm_E02')).toBe('38 mm');
  });

  it('sin código de tubo no inventa nada', () => {
    expect(especTuboEtiqueta(undefined, '1,2mm')).toBe('');
    expect(especTuboEtiqueta('', '1,2mm')).toBe('');
  });
});

describe('ladoCadenaEtiqueta', () => {
  it('limpia el formato "CAD [DERECHA]" de Fase 0', () => {
    expect(ladoCadenaEtiqueta('CAD [DERECHA]')).toBe('DERECHA');
    expect(ladoCadenaEtiqueta('CAD IZQUIERDA')).toBe('IZQUIERDA');
    expect(ladoCadenaEtiqueta(undefined)).toBe('—');
  });
});

describe('textoAccionamiento', () => {
  it('cadena: largo + color con nombre completo', () => {
    expect(textoAccionamiento({ largoCadena: '4', colorCadena: 'NEG' })).toBe('4 METROS NEGRO');
    expect(textoAccionamiento({ largoCadena: '1,5', colorCadena: 'BCO' })).toBe(
      '1,5 METROS BLANCO',
    );
  });

  it('motor gana sobre la cadena', () => {
    expect(textoAccionamiento({ motorTipo: 'Somfy', largoCadena: '4' })).toBe('MOTOR SOMFY');
  });

  it('sin datos devuelve vacío', () => {
    expect(textoAccionamiento({})).toBe('');
  });

  it('la METÁLICA se rotula con los metros a cortar, no con «ROLLO»', () => {
    // El armador corta del rollo: el largo de catálogo no le sirve de nada.
    expect(
      textoAccionamiento({ cadenaMetalica: true, alto: 2.3, largoCadena: 'ROLLO', colorCadena: 'MET' }),
    ).toBe('METÁLICA 4,6 M');
    // Elegida a mano en la ficha, sin el flag: igual.
    expect(textoAccionamiento({ codCadena: 'CAD13', alto: 1.5, largoCadena: 'ROLLO' })).toBe(
      'METÁLICA 3 M',
    );
    // Y el motor le sigue ganando.
    expect(textoAccionamiento({ cadenaMetalica: true, alto: 2.3, motorTipo: 'Somfy' })).toBe(
      'MOTOR SOMFY',
    );
  });
});

describe('agruparEtiquetasPanos', () => {
  const fila = (junto: string, numeroPano: number | string, altoCorte = 2.65): OptimizerRow =>
    ({
      codInt: 'SC 64',
      junto,
      numeroPano,
      altoCorte,
      ancho: 1.2,
      anchoRollo: 2.98,
    }) as unknown as OptimizerRow;

  it('corte en conjunto → UNA etiqueta con la letra REPETIDA por cortina («A-A»)', () => {
    // En el Dimensionado esas dos cortinas salen con dos letras A: la etiqueta
    // dice lo mismo, y así el cortador sabe que del tiro salen DOS piezas.
    const grupos = agruparEtiquetasPanos([
      fila('A', 1),
      fila('A', 1),
      fila('B', 2),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].junto).toBe('A-A');
    expect(grupos[0].cortinas).toBe(2);
    expect(grupos[1].junto).toBe('B');
  });

  it('tres cortinas en el mismo tiro → «A-A-A»', () => {
    const grupos = agruparEtiquetasPanos([fila('A', 1), fila('A', 1), fila('A', 1)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].junto).toBe('A-A-A');
    expect(grupos[0].cortinas).toBe(3);
  });

  it('la etiqueta del grupo lleva el alto MAYOR (el tiro se corta a ese alto)', () => {
    const grupos = agruparEtiquetasPanos([fila('A', 1, 2.05), fila('A', 1, 2.65)]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].row.altoCorte).toBe(2.65);
  });

  it('la letra es la del PAÑO, no la del plan guardado: dos paños, dos letras', () => {
    // Un plan viejo podía traer la misma letra en paños distintos (las letras
    // se reciclaban tras la Z). La hoja de corte los renumera y la etiqueta la
    // sigue: A y B, nunca dos A para tiros distintos.
    const grupos = agruparEtiquetasPanos([fila('A', 1), fila('A', 27)]);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.junto)).toEqual(['A', 'B']);
    expect(grupos.map((g) => g.pano)).toEqual([1, 2]);
  });

  it('filas sin letra ni N° de paño (planes legacy) van cada una con su etiqueta', () => {
    const grupos = agruparEtiquetasPanos([fila('', ''), fila('', ''), fila('·', 3)]);
    expect(grupos).toHaveLength(3);
    expect(grupos.map((g) => g.junto)).toEqual(['A', 'B', 'C']);
  });

  it('una INVERTIDA marcada a mano no comparte etiqueta, igual que en la hoja de corte', () => {
    // El empacador la mete en un paño compartido (cabe a lo ancho), pero el
    // papel del cortador le da paño propio: si la etiqueta agrupara por su
    // cuenta, imprimiría un paño de menos y todas las letras de ahí en adelante
    // saldrían corridas contra el Dimensionado.
    const conFlag = {
      ...fila('A', 1),
      pano: { invertida: true },
    } as unknown as OptimizerRow;
    const grupos = agruparEtiquetasPanos([fila('A', 1), conFlag, fila('B', 2)]);
    expect(grupos).toHaveLength(3);
    expect(grupos.map((g) => g.junto)).toEqual(['A', 'B', 'C']);
  });
});

// La invariante que motivó todo: la etiqueta y el papel del cortador tienen que
// decir la MISMA letra para la misma cortina. Se comprueba contra la hoja de
// corte real, no contra letras escritas a mano.
describe('etiquetas de paño vs. hoja de corte', () => {
  const cat = {
    'SC 64': {
      cod: 'SC 64', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM',
      descripcion: '', precio: 0, anchoRollo: 2.98,
    },
  };
  const mkVent = (id: string, ancho: number, invertida?: boolean) => ({
    id,
    ubicacion: id,
    codInt: 'SC 64',
    producto: 'ROLLER SCREEN PREMIUM',
    tipo: 'PREMIUM',
    categoria: 'ROL',
    grupoId: null,
    alto: 1.8,
    precio: 0,
    cantidad: 1,
    panos: [{ ancho, alto: 1.8, ...(invertida === undefined ? {} : { invertida }) }],
  });

  it('cada etiqueta lleva la letra de su paño, repetida una vez por cortina', () => {
    // v1 + v2 caben juntas (1,40 + 1,45); v3 es la invertida a mano.
    const ventanas = [mkVent('v1', 1.4), mkVent('v2', 1.45), mkVent('v3', 1.2, true)];
    const rows = asignarJuntoEnOrden(buildOptimizerRows(ventanas as never, cat as never));
    const hoja = construirHojaCorte(rows, [], { id: 'ot1', storeVentanas: ventanas } as never);
    const grupos = agruparEtiquetasPanos(rows);

    expect(grupos).toHaveLength(hoja.totalPanos);
    // Las letras del papel, sin repetir, en el orden en que aparecen.
    const delPapel = [...new Set(hoja.cortinas.map((c) => c.cortarJunto))];
    expect(grupos.map((g) => g.pano)).toEqual(hoja.panos.map((p) => p.pano));
    expect(grupos.map((g) => g.junto.split('-')[0])).toEqual(delPapel);
    // El paño compartido repite su letra; los de una sola cortina, no.
    expect(grupos.map((g) => g.junto)).toEqual(['A-A', 'B']);
  });
});

describe('cuerpoTextoJunto', () => {
  // Anchos medidos por jsPDF (mm) para un espacio libre típico de ~30 mm
  // junto a una OT corta ("#3187-B"). La regla vieja contaba caracteres y
  // dejaba pasar a 18,4 textos que impresos se montaban sobre el N° de OT.
  it('una letra sola o de vuelta corta ("A", "UUU") queda a 18,4', () => {
    expect(cuerpoTextoJunto(4.5, 2.6, 30)).toEqual({ size: 18.4, hScale: 1 });
    expect(cuerpoTextoJunto(14.2, 8.1, 30)).toEqual({ size: 18.4, hScale: 1 });
  });

  it('si a 18,4 no cabe (letra ancha + OT larga), baja a 10,5', () => {
    expect(cuerpoTextoJunto(30.7, 17.5, 30)).toEqual({ size: 10.5, hScale: 1 });
  });

  it('un grupo enorme se condensa con hScale en vez de pisar la OT', () => {
    const r = cuerpoTextoJunto(66, 37.6, 30);
    expect(r.size).toBe(10.5);
    expect(r.hScale).toBeCloseTo(30 / 37.6, 6);
    // Con la compresión, el ancho impreso queda EXACTO al espacio libre.
    expect(37.6 * r.hScale).toBeCloseTo(30, 6);
  });

  it('la compresión tiene piso 0,4: apretado se lee, montado no', () => {
    expect(cuerpoTextoJunto(200, 120, 30).hScale).toBe(0.4);
  });
});

describe('generarEtiquetasPanosPDF', () => {
  it('una página por paño físico: 3 cortinas con corte en conjunto → 2 etiquetas', () => {
    docsGuardados.length = 0;
    const fila = (junto: string, numeroPano: number): OptimizerRow =>
      ({
        codInt: 'SC 64',
        producto: 'ROLLER SCREEN PREMIUM',
        tipo: 'PREMIUM',
        junto,
        numeroPano,
        altoCorte: 2.65,
        ancho: 1.2,
        anchoRollo: 2.98,
        pano: { tipoTela: 'SCR' },
      }) as unknown as OptimizerRow;
    generarEtiquetasPanosPDF(
      [fila('A', 1), fila('A', 1), fila('B', 2)],
      { ot: '3097', cliente: 'BARBARA / LEONARDO', fecha: '2026-07-07' },
      {},
    );
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(2);
  });
  it('páginas exactas de 62×51 mm, sin sobrante (y sin volteo de jsPDF)', () => {
    docsGuardados.length = 0;
    const row = (junto: string, numeroPano: number) =>
      ({
        codInt: 'SC 93',
        producto: 'ROLLER SCREEN PREMIUM',
        tipo: 'PREMIUM',
        junto,
        numeroPano,
        altoCorte: 2.551,
        ancho: 1.2,
        anchoRollo: 2.98,
        pano: { tipoTela: 'SCR' },
      }) as unknown as OptimizerRow;
    generarEtiquetasPanosPDF(
      [row('A', 1), row('B', 2)],
      { ot: '267-3', cliente: 'JEFFI', fecha: '2026-07-03' },
      { 'SC 93': { cod: 'SCREEN_P', producto: 'ROLLER SCREEN PREMIUM', tipo: 'PREMIUM', descripcion: 'TEXTURE PERLA 5%', precio: 23820 } },
    );
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(2);
    for (let p = 1; p <= 2; p++) {
      doc.setPage(p);
      expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
      expect(doc.internal.pageSize.getHeight()).toBeCloseTo(51, 1);
    }
  });
});

describe('generarEtiquetasPanosPDF — omite paños de colmena', () => {
  const fila = (junto: string, numeroPano: number, ventanaId: string, panoIndex = 0): OptimizerRow =>
    ({
      codInt: 'SC 64',
      producto: 'ROLLER SCREEN PREMIUM',
      tipo: 'PREMIUM',
      junto,
      numeroPano,
      ventanaId,
      panoIndex,
      altoCorte: 2.65,
      ancho: 1.2,
      anchoRollo: 2.98,
      pano: { tipoTela: 'SCR' },
    }) as unknown as OptimizerRow;
  const meta = { ot: '3115', cliente: 'LUIS-VIVIANA', fecha: '2026-07-15' };

  it('paño de colmena no lleva etiqueta: 3 paños, 1 de colmena → 2 etiquetas', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('B', 2, 'V2'), fila('C', 3, 'V3')],
      meta,
      {},
      (r) => r.ventanaId === 'V3',
    );
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });

  it('si ALGUNA pieza del paño en conjunto sale de colmena, se omite todo el paño', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('A', 1, 'V2'), fila('B', 2, 'V3')],
      meta,
      {},
      (r) => r.ventanaId === 'V2', // una de las dos cortinas del paño A
    );
    expect(n).toBe(1); // solo queda el paño B
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(1);
  });

  it('todos los paños de colmena → 0 etiquetas y NO genera PDF', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF(
      [fila('A', 1, 'V1'), fila('B', 2, 'V2')],
      meta,
      {},
      () => true,
    );
    expect(n).toBe(0);
    expect(docsGuardados).toHaveLength(0);
  });

  it('sin callback → imprime todos (regresión del comportamiento previo)', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF([fila('A', 1, 'V1'), fila('B', 2, 'V2')], meta, {});
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });
});

// Aclaración 2026-08-17: la categoría B se fabrica CON sus etiquetas Brother
// (estructura y paño). Lo que no lleva es la etiqueta Rolzzo del inventario
// (INS 95 / INS 95-1), que vive en inventario.ts. Entre el 14 y el 17 se filtró
// acá por error: estos tests fijan que ya no se filtra.
describe('categoría B: sí lleva etiquetas Brother', () => {
  const meta = { ot: '3190', cliente: 'CLIENTE B', fecha: '2026-08-17' };
  const filaB = (junto: string, numeroPano: number, lineaB: boolean): OptimizerRow =>
    ({
      codInt: 'BK 78',
      producto: 'ROLLER BLACKOUT GAMA B',
      tipo: 'BLACKOUT',
      junto,
      numeroPano,
      ventanaId: `V${numeroPano}`,
      panoIndex: 0,
      altoCorte: 2.1,
      ancho: 1.5,
      alto: 2,
      lineaB,
      pano: { tipoTela: 'BK', mecanismo: 'MEC 06 LZ50 B BLANCO', tuberia: 'E01' },
    }) as unknown as OptimizerRow;

  it('etiquetas de ESTRUCTURA: una OT toda B imprime una por cortina', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPDF([filaB('A', 1, true), filaB('B', 2, true)], meta, {});
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });

  it('etiquetas de PAÑO: la B cuenta igual que la A (2 paños → 2 etiquetas)', () => {
    docsGuardados.length = 0;
    const n = generarEtiquetasPanosPDF([filaB('A', 1, true), filaB('B', 2, false)], meta, {});
    expect(n).toBe(2);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
  });
});

describe('códigos de perfil zócalo / separador por color', () => {
  it('zócalo E32/E33/E34 y separador E41/E42/E43 por color (café ≡ madera)', () => {
    expect(codigoZocaloPerfil('BLANCO')).toBe('E32');
    expect(codigoZocaloPerfil('NEG')).toBe('E33');
    expect(codigoZocaloPerfil('CAFÉ')).toBe('E34');
    expect(codigoZocaloPerfil('MADERA')).toBe('E34');
    expect(codigoSeparadorPerfil('BLANCO')).toBe('E41');
    expect(codigoSeparadorPerfil('NEGRO')).toBe('E42');
    expect(codigoSeparadorPerfil('CAFE')).toBe('E43');
    expect(codigoSeparadorPerfil('MADERA')).toBe('E43');
    // Color sin código fijo → '' (la etiqueta cae al color).
    expect(codigoZocaloPerfil('AZUL')).toBe('');
    expect(codigoSeparadorPerfil('')).toBe('');
  });
});

describe('esFilaSoftLight', () => {
  const row = (piezas: ReturnType<typeof pz>[]): OptimizerRow =>
    ({ piezas } as unknown as OptimizerRow);
  it('true solo si tiene PESO SOFT LIGHT y CENEFA OVALADA', () => {
    expect(esFilaSoftLight(row([pz('PESO SOFT LIGHT', 250), pz('CENEFA OVALADA', 263)]))).toBe(true);
    // Roller (PESO roller + sin cenefa ovalada) → false.
    expect(esFilaSoftLight(row([pz('PESO', 250)]))).toBe(false);
    // Un ROLLER con cenefa ovalada sigue siendo roller: desde la OT 3169 su
    // despiece también trae la tapa, y el peso roller es lo que los separa.
    expect(esFilaSoftLight(row([pz('PESO', 250), pz('CENEFA OVALADA', 263)]))).toBe(false);
    // Dark/CC sin la cenefa OVALADA (usan CENEFA DELANTERA) → false.
    expect(esFilaSoftLight(row([pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)]))).toBe(false);
  });
});

describe('esFilaDark', () => {
  const row = (piezas: ReturnType<typeof pz>[]): OptimizerRow =>
    ({ piezas } as unknown as OptimizerRow);
  it('true solo con PESO SOFT LIGHT + cenefa cuadrada DELANTERA y TRASERA', () => {
    expect(
      esFilaDark(row([pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263), pz('CENEFA TRASERA', 262)])),
    ).toBe(true);
    // Soft light CC / Oscuranti: delantera sin trasera → false (etiqueta roller).
    expect(esFilaDark(row([pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)]))).toBe(false);
    // Soft light ovalada → false (tiene su propia etiqueta).
    expect(esFilaDark(row([pz('PESO SOFT LIGHT', 250), pz('CENEFA OVALADA', 263)]))).toBe(false);
    // Roller → false.
    expect(esFilaDark(row([pz('PESO', 250)]))).toBe(false);
  });
});

describe('esFilaSoftLightCC', () => {
  const row = (categoria: string, piezas: ReturnType<typeof pz>[]): OptimizerRow =>
    ({ categoria, piezas } as unknown as OptimizerRow);
  it('true: soft light con cenefa cuadrada delantera SIN trasera', () => {
    expect(
      esFilaSoftLightCC(row('SOFT_LIGHT_38mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)])),
    ).toBe(true);
  });
  it('false: Oscuranti tiene la MISMA firma de piezas pero NO es soft light', () => {
    expect(
      esFilaSoftLightCC(row('OSCURANTI_63mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)])),
    ).toBe(false);
  });
  it('false: con cenefa TRASERA es DARK, no CC', () => {
    expect(
      esFilaSoftLightCC(
        row('SOFT_LIGHT_38mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263), pz('CENEFA TRASERA', 262)]),
      ),
    ).toBe(false);
  });
  it('false: soft light ovalada (cenefa ovalada, no delantera)', () => {
    expect(
      esFilaSoftLightCC(row('SOFT_LIGHT_45mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA OVALADA', 263)])),
    ).toBe(false);
  });
});

describe('esFilaOscuranti', () => {
  const row = (categoria: string, piezas: ReturnType<typeof pz>[]): OptimizerRow =>
    ({ categoria, piezas } as unknown as OptimizerRow);
  it('true: categoría OSCURANTI con peso de oscuridad + perfil superior', () => {
    expect(
      esFilaOscuranti(
        row('OSCURANTI_63mm', [pz('PESO SOFT LIGHT', 250), pz('PERFIL SUPERIOR (CENEF.PRO)', 263)]),
      ),
    ).toBe(true);
  });
  it('false: soft light CC lleva cenefa cuadrada delantera, no perfil superior', () => {
    expect(
      esFilaOscuranti(row('SOFT_LIGHT_38mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)])),
    ).toBe(false);
    expect(
      esFilaOscuranti(row('OSCURANTI_63mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA DELANTERA', 263)])),
    ).toBe(false);
  });
  it('false: roller / soft light ovalada', () => {
    expect(esFilaOscuranti(row('ROL', [pz('PESO', 250)]))).toBe(false);
    expect(
      esFilaOscuranti(row('SOFT_LIGHT_45mm', [pz('PESO SOFT LIGHT', 250), pz('CENEFA OVALADA', 263)])),
    ).toBe(false);
  });
});

describe('generarEtiquetasPDF — soft light usa página 62×146', () => {
  it('la etiqueta soft light mide 146 mm de alto (vs 100 del roller)', () => {
    docsGuardados.length = 0;
    const softRow = {
      codInt: 'SC 02',
      producto: 'ROLLER SCREEN PREMIUM',
      tipo: 'PREMIUM',
      ubicacion: 'LIVING',
      categoria: 'SOFT_LIGHT_45mm',
      anchoCm: 250,
      altoCm: 230,
      tuberiaCod: '45mm_E78',
      sentido: 'INTERNO',
      pano: { tipoTela: 'SCR', oscuridadVariante: 'EXTERNO', color: 'BLANCO' },
      piezas: [
        pz('TUBO', 245.7),
        pz('PESO SOFT LIGHT', 243),
        pz('CENEFA OVALADA', 263.2),
        pz('Tela (ancho)', 242.8),
        pz('PERFIL (IZQ) INT', 240),
        pz('PERFIL (DER) INT', 240),
        pz('PERFIL BASE', 236.7),
      ],
    } as unknown as OptimizerRow;
    generarEtiquetasPDF([softRow], { ot: '267-23', cliente: 'LUZ LIVIANA', fecha: '2026-07-24' }, {});
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(146, 1);
  });
});

describe('generarEtiquetasPDF — DARK usa página 62×146', () => {
  it('la etiqueta DARK (cenefas del/tra + velcro) mide 146 mm de alto', () => {
    docsGuardados.length = 0;
    const darkRow = {
      codInt: 'SC 64',
      producto: 'ROLLER BLACKOUT',
      tipo: 'PREMIUM',
      ubicacion: 'LIVING',
      categoria: 'DARK_38mm',
      anchoCm: 251.5,
      altoCm: 230,
      tuberiaCod: '38mm_E02',
      sentido: 'INTERNO',
      pano: { tipoTela: 'BK', oscuridadVariante: 'EXTERNO', color: 'NEGRO' },
      piezas: [
        pz('TUBO', 260.9),
        pz('PESO SOFT LIGHT', 260.93),
        pz('CENEFA DELANTERA', 267.3),
        pz('CENEFA TRASERA', 266.3),
        pz('Tela (ancho)', 260.84),
        pz('PERFIL (IZQ) INT', 240),
        pz('PERFIL (DER) INT', 240),
        pz('PERFIL BASE', 254.7),
      ],
    } as unknown as OptimizerRow;
    generarEtiquetasPDF([darkRow], { ot: '2525', cliente: 'ADRIANA PASCUZZO', fecha: '2026-07-27' }, {});
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(146, 1);
  });
});

describe('generarEtiquetasPDF — soft light CC: estructura 146 + página de cenefa cuadrada', () => {
  it('genera la etiqueta de estructura de 146 mm y ADEMÁS la página extra de cenefa cuadrada', () => {
    docsGuardados.length = 0;
    const ccRow = {
      codInt: 'SC 10',
      producto: 'ROLLER BLACKOUT',
      tipo: 'PREMIUM',
      ubicacion: 'PIEZA',
      categoria: 'SOFT_LIGHT_38mm',
      anchoCm: 200,
      altoCm: 200,
      tuberiaCod: '38mm_E66',
      sentido: 'INTERNO',
      pano: { tipoTela: 'BK', oscuridadVariante: 'INTERNO', color: 'BLANCO', cenefa: 'Cuadrada a muro' },
      piezas: [
        pz('TUBO', 193.9),
        pz('PESO SOFT LIGHT', 193.5),
        pz('CENEFA DELANTERA', 199.7),
        pz('Tela (ancho)', 193.3),
        pz('PERFIL (IZQ) INT', 210),
        pz('PERFIL (DER) INT', 210),
      ],
    } as unknown as OptimizerRow;
    generarEtiquetasPDF([ccRow], { ot: '268-1', cliente: 'CLIENTE CC', fecha: '2026-07-27' }, {});
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    // 2 páginas: estructura (146 mm) + página extra de cenefa cuadrada (100 mm).
    expect(doc.getNumberOfPages()).toBe(2);
    doc.setPage(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(146, 1);
  });
});

describe('generarEtiquetasPDF — página de cenefa cuadrada: ANCHO DE CENEFA', () => {
  // OT 3181: vertical de 2,737 en LIVING con cenefa cuadrada VENDIDA a 2,747
  // (cantidad del adicional CENF C en Fase 1). Imprimía 273,2 (cortina −0,5).
  const verticalRow = {
    codInt: 'SCREEN_V_P',
    producto: 'CORTINA VERTICAL SCREEN',
    tipo: 'PREMIUM',
    ubicacion: 'LIVING',
    categoria: 'VERTICAL',
    ancho: 2.737,
    anchoCm: 273.7,
    altoCm: 200,
    tuberiaCod: 'VERTICAL',
    pano: { tipoTela: 'SCR', color: 'NEGRO', cenefa: 'Cuadrada a muro', cenefaTapa: 'MURO_MURO' },
    piezas: [pz('PERFIL VERTICAL', 271.9), pz('VARILLA', 272)],
  } as unknown as OptimizerRow;
  const meta = { ot: '3181', cliente: 'FRANK', fecha: '2026-08-17' };

  it('imprime la cantidad vendida en Fase 1 (2,747 → 274,7), no el ancho de la cortina', () => {
    docsGuardados.length = 0;
    textosImpresos.length = 0;
    generarEtiquetasPDF([verticalRow], meta, {}, [
      { codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'LIVING' },
    ]);
    expect(docsGuardados).toHaveLength(1);
    expect((docsGuardados[0] as jsPDF).getNumberOfPages()).toBe(2);
    expect(textosImpresos).toContain('274,7');
    expect(textosImpresos).not.toContain('273,2');
  });

  it('sin adicional que calce, se estima desde la cortina como antes (273,7 − 0,5 = 273,2)', () => {
    docsGuardados.length = 0;
    textosImpresos.length = 0;
    generarEtiquetasPDF([verticalRow], meta, {}, [
      { codInt: 'CENF C', cantidad: 2.747, descuento: 0, ubicacion: 'COMEDOR' },
    ]);
    expect(textosImpresos).toContain('273,2');
    expect(textosImpresos).not.toContain('274,7');
  });
});

describe('generarEtiquetasPDF — OSCURANTI usa página 62×146', () => {
  it('la etiqueta oscuranti (cenefa cuadrada + perfil superior) mide 146 mm', () => {
    docsGuardados.length = 0;
    const oscRow = {
      codInt: 'SC 64',
      producto: 'ROLLER BLACKOUT',
      tipo: 'PREMIUM',
      ubicacion: 'LIVING',
      categoria: 'OSCURANTI_63mm',
      anchoCm: 251.5,
      altoCm: 230,
      tuberiaCod: '63mm_E47',
      sentido: 'EXTERNO',
      pano: { tipoTela: 'BK', oscuridadVariante: 'EXTERNO', color: 'NEGRO' },
      piezas: [
        pz('TUBO', 260.9),
        pz('PESO SOFT LIGHT', 260.86),
        pz('CENEFA DELANTERA', 267.3),
        pz('PERFIL SUPERIOR (CENEF.PRO)', 267.3),
        pz('Tela (ancho)', 260.84),
        pz('PERFIL (IZQ) INT', 240),
        pz('PERFIL (DER) INT', 240),
      ],
    } as unknown as OptimizerRow;
    generarEtiquetasPDF([oscRow], { ot: '269-1', cliente: 'CLIENTE OSC', fecha: '2026-07-28' }, {});
    expect(docsGuardados).toHaveLength(1);
    const doc = docsGuardados[0] as jsPDF;
    // Sin cenefa elegible en el paño: una sola página, la de estructura.
    expect(doc.getNumberOfPages()).toBe(1);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(62, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(146, 1);
  });
});
