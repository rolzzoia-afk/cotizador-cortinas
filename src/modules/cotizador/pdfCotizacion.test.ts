import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mismo arnés que pdfEtiquetasBrother.test.ts: subclase real de jsPDF (las
// medidas de página son las de verdad) que captura lo guardado, lo impreso con
// text()/textWithLink(), las imágenes y los enlaces.
const docsGuardados = vi.hoisted(() => [] as Array<{ getNumberOfPages: () => number }>);
const textosImpresos = vi.hoisted(() => [] as string[]);
const imagenes = vi.hoisted(() => [] as string[]);
const enlaces = vi.hoisted(() => [] as string[]);
const guardadosCon = vi.hoisted(() => [] as string[]);
// Rectángulos rellenos, con el color de relleno vigente al dibujarlos: es lo
// único que delata el fondo de una fila (el color de fila no imprime texto).
const rellenos = vi.hoisted(
  () => [] as Array<{ x: number; y: number; w: number; h: number; color: string }>,
);
// Cada texto con el TAMAÑO con que se dibujó: es lo único que delata que una
// celda se achicó para caber (lo que el dueño pidió que dejara de pasar).
const impresos = vi.hoisted(() => [] as Array<{ txt: string; size: number }>);

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  class JsPDFCaptura extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      const self = this as unknown as Record<string, (...a: never[]) => unknown>;
      let tam = 0;
      const setFontSizeOriginal = self.setFontSize.bind(this);
      self.setFontSize = ((n: number) => {
        tam = n;
        return setFontSizeOriginal(n as never);
      }) as never;
      const textOriginal = self.text.bind(this);
      self.text = ((s: string | string[], ...rest: never[]) => {
        const txt = Array.isArray(s) ? s.join(' ') : String(s);
        textosImpresos.push(txt);
        impresos.push({ txt, size: tam });
        return textOriginal(s as never, ...rest);
      }) as never;
      const linkTextoOriginal = self.textWithLink.bind(this);
      self.textWithLink = ((s: string, x: never, y: never, opts: { url?: string }) => {
        textosImpresos.push(String(s));
        if (opts?.url) enlaces.push(opts.url);
        return linkTextoOriginal(s as never, x, y, opts as never);
      }) as never;
      const linkOriginal = self.link.bind(this);
      self.link = ((x: never, y: never, w: never, h: never, opts: { url?: string }) => {
        if (opts?.url) enlaces.push(opts.url);
        return linkOriginal(x, y, w, h, opts as never);
      }) as never;
      const addImageOriginal = self.addImage.bind(this);
      self.addImage = ((data: string, ...rest: never[]) => {
        imagenes.push(typeof data === 'string' ? data : 'no-string');
        return addImageOriginal(data as never, ...rest);
      }) as never;
      let relleno = '';
      const setFillOriginal = self.setFillColor.bind(this);
      self.setFillColor = ((...a: never[]) => {
        relleno = a.join(',');
        return setFillOriginal(...a);
      }) as never;
      const rectOriginal = self.rect.bind(this);
      self.rect = ((x: number, y: number, w: number, h: number, ...rest: never[]) => {
        if (String(rest[0]) === 'F') rellenos.push({ x, y, w, h, color: relleno });
        return rectOriginal(x as never, y as never, w as never, h as never, ...rest);
      }) as never;
      // Los recuadros de la columna CAT van con esquinas redondeadas.
      const roundedOriginal = self.roundedRect.bind(this);
      self.roundedRect = ((x: number, y: number, w: number, h: number, ...rest: never[]) => {
        if (String(rest[2]) === 'F') rellenos.push({ x, y, w, h, color: relleno });
        return roundedOriginal(x as never, y as never, w as never, h as never, ...rest);
      }) as never;
      self.save = ((nombre: string) => {
        guardadosCon.push(nombre);
        docsGuardados.push(this as never);
        return this;
      }) as never;
    }
  }
  return { ...mod, jsPDF: JsPDFCaptura };
});

import { DATOS_EMPRESA_DEFAULT } from './datosEmpresaCotizacion';
import { TIRA_PROYECTOS, TIRA_PROYECTOS_RATIO } from './fotosProyectos';
import { SELLO_CUOTAS, SELLO_TARJETAS } from './logoRolzzo';
import { FILAS_TOTALES } from './filasTotales';
import { formatCLP } from './calculos';
import { calcularTotales } from './preciosFase0';
import { jsPDF } from 'jspdf';
import {
  ALTO_MAX_TIRA,
  ANCHO_COLUMNAS,
  ANCHO_TOTALES,
  ANCHO_UTIL,
  descuentoPesos,
  fmtMedida3,
  medidasContain,
  generarPdfCotizacion,
  medidasTira,
  nombreArchivoPdf,
  textoTransferencia,
  tituloBanda,
  urlCopiarTransferencia,
  type EntradaPdfCotizacion,
  type FilaPdfCortina,
} from './pdfCotizacion';

/** Una tira propia del admin: un JPEG de 1 × 1 de verdad, que jsPDF sí decodifica. */
const TIRA_PROPIA =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL' +
  'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAAB' +
  'AAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const CORTINA: FilaPdfCortina = {
  cod: 'DUOBK_P',
  cantidad: 1,
  producto: 'ROLLER DUO BLACKOUT PREMIUM',
  codInt: 'DB-P',
  tipo: 'PREMIUM',
  descripcion: 'COLOR POR DEFINIR',
  ubicacion: 'LIVING',
  colorAcc: 'POR DEFINIR',
  ancho: 1.46,
  alto: 2.2,
  valorUnit: 233174,
  descuento: 0.3,
  total: 163222,
};

/** La cotización de la captura de referencia (MATACARLOS COTJS-10427-1). */
function entradaDemo(over: Partial<EntradaPdfCotizacion> = {}): EntradaPdfCotizacion {
  return {
    numero: 'COTJS-10427-1',
    otBanda: 'N° COTJS - 07979-5 -1 - VISITA-VERTICALES Y DUAL CON CENEFA CUADRADA',
    otCliente: '3205-1',
    soloTelasB: true,
    hayTelaB: true,
    cliente: {
      nombre: 'CARLOS',
      rut: '',
      mail: 'matacarlos23@gmail.com',
      telefono: '56 9 3430 4618',
      direccion: 'LAS CONDES',
      comuna: '',
    },
    fecha: { dia: 29, mes: 7, anio2: 26 },
    cortinas: [CORTINA, { ...CORTINA, ubicacion: 'PZ PPAL 2', ancho: 0.8, alto: 1.3 }],
    adicionales: [
      {
        cod: 'INSTALACION',
        cantidad: 7,
        producto: 'INSTALACION ROLLER',
        codInt: 'INST',
        tipo: 'INSTALACION',
        descripcion: 'GRATIS',
        valorUnit: 17500,
        descuento: 1,
        total: 0,
        destacadoRojo: true,
      },
    ],
    totales: calcularTotales(1158638),
    terminos: ['Cotización válida por 5 días.', 'Pago 50% / 50%.'],
    proveedorTarjeta: 'mercadopago',
    empresa: DATOS_EMPRESA_DEFAULT,
    logoDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAA',
    ...over,
  };
}

const impreso = () => textosImpresos.join(' | ');

beforeEach(() => {
  docsGuardados.length = 0;
  textosImpresos.length = 0;
  imagenes.length = 0;
  enlaces.length = 0;
  guardadosCon.length = 0;
  rellenos.length = 0;
  impresos.length = 0;
});

// «Las letras de la cotización deben ser del mismo tamaño» (dueño, 2026-09-14).
// Antes cada celda se achicaba sola hasta 4,2 pt para meter su texto en una
// línea y después lo cortaba: la DESCRIPCIÓN salía en letra chica —y a medio
// escribir, con un paréntesis suelto al final— al lado de un TIPO en letra
// normal.
describe('generarPdfCotizacion — el cuerpo de la tabla, todo del mismo tamaño', () => {
  const LARGA = 'BLANCO 5% ROSC 95 85 (ESTANDAR)';
  const cotizarConLarga = () =>
    generarPdfCotizacion(
      entradaDemo({
        // Sin la banda de la gama B, que se dibuja en 19 pt y no es el cuerpo.
        soloTelasB: false,
        hayTelaB: false,
        cortinas: [
          {
            ...CORTINA,
            producto: 'BEEBLACK-BLACKOUT WATERPROFF',
            descripcion: LARGA,
            ubicacion: 'PRUEBA 2',
          },
        ],
      }),
    );

  it('ninguna celda del cuerpo se achica: todas van a 6 pt', () => {
    cotizarConLarga();
    const cuerpo = impresos.filter((i) =>
      /WATERPROFF|BEEBLACK|BLACKOUT|ROSC|ESTANDAR|DUOBK_P|PREMIUM|PRUEBA/.test(i.txt),
    );
    expect(cuerpo.length).toBeGreaterThan(4);
    expect([...new Set(cuerpo.map((i) => i.size))]).toEqual([6]);
  });

  it('lo largo se parte en líneas y no se corta a mitad de palabra', () => {
    cotizarConLarga();
    const junto = impresos.map((i) => i.txt).join(' ');
    expect(junto).toContain('(ESTANDAR)');
    expect(junto).toContain('WATERPROFF');
    expect(junto).not.toContain('…');
  });

  it('la fila crece con el texto: la tabla ya no cabe en el alto de antes', () => {
    cotizarConLarga();
    const filas = rellenos.filter((r) => r.w > 20 && r.h >= 5 && r.h < 12);
    expect(filas.some((r) => r.h > 5)).toBe(true);
  });
});

// La categoría se lee de un vistazo en la grilla; en el papel también hacía
// falta (dueño, 2026-09-14: «que diga categoría A o B o invertida en un cuadro
// pequeño»).
describe('generarPdfCotizacion — la columna CAT', () => {
  const VERDE = '198,231,186';
  const AMBAR = '255,224,138';
  const CELESTE = '187,218,244';
  const pinto = (rgb: string) => rellenos.some((r) => r.color === rgb && r.w < 6 && r.h < 3);

  it('una cortina de gama A lleva su recuadro verde, y ninguno más', () => {
    generarPdfCotizacion(entradaDemo({ cortinas: [CORTINA] }));
    expect(pinto(VERDE)).toBe(true);
    expect(pinto(AMBAR)).toBe(false);
    expect(pinto(CELESTE)).toBe(false);
  });

  it('la categoría B lleva el ámbar', () => {
    generarPdfCotizacion(entradaDemo({ cortinas: [{ ...CORTINA, lineaB: true }] }));
    expect(pinto(AMBAR)).toBe(true);
    expect(pinto(VERDE)).toBe(false);
  });

  it('la invertida suma su recuadro al de la gama', () => {
    generarPdfCotizacion(entradaDemo({ cortinas: [{ ...CORTINA, invertida: true }] }));
    expect(pinto(VERDE)).toBe(true);
    expect(pinto(CELESTE)).toBe(true);
    expect(impreso()).toContain('INV');
  });

  it('los adicionales no llevan categoría', () => {
    generarPdfCotizacion(entradaDemo({ cortinas: [] }));
    expect(pinto(VERDE)).toBe(false);
    expect(pinto(AMBAR)).toBe(false);
    expect(pinto(CELESTE)).toBe(false);
  });
});

// Las vendedoras pintan filas en la planilla para agrupar las cortinas de una
// misma pieza. El color elegido en la grilla de Fase 1/3 tiene que llegar al
// documento del cliente; si no, el PDF no se parece a lo que ellas ven.
describe('generarPdfCotizacion — el color de fila que se eligió en la grilla', () => {
  /** ¿Se pintó una franja del ancho de la tabla con este color? */
  const pintoFilaCon = (rgb: string) =>
    rellenos.some((r) => r.color === rgb && r.h > 0 && r.h < 8);

  it('la cortina pintada sale con su color y la de al lado no', () => {
    generarPdfCotizacion(
      entradaDemo({
        cortinas: [
          { ...CORTINA, colorFila: '#FFD966' },
          { ...CORTINA, ubicacion: 'PZ PPAL 2' },
        ],
      }),
    );
    expect(pintoFilaCon('255,217,102')).toBe(true);
  });

  it('sin color, ninguna fila usa un fondo de la paleta', () => {
    generarPdfCotizacion(entradaDemo());
    expect(pintoFilaCon('255,217,102')).toBe(false);
    expect(pintoFilaCon('169,209,142')).toBe(false);
  });

  it('el adicional pintado gana sobre el rojo automático de la instalación', () => {
    const e = entradaDemo();
    generarPdfCotizacion({
      ...e,
      adicionales: [{ ...e.adicionales[0], colorFila: '#9DC3E6' }],
    });
    expect(pintoFilaCon('157,195,230')).toBe(true);
  });

  it('un adicional destacado y SIN color conserva el rojo de siempre', () => {
    generarPdfCotizacion(entradaDemo());
    // ROJO_SUAVE del módulo: la instalación gratis va destacada.
    expect(rellenos.some((r) => r.color === '252,226,226')).toBe(true);
  });

  it('un color inválido no pinta nada: la fila cae en el fondo alternado', () => {
    generarPdfCotizacion(
      entradaDemo({ cortinas: [{ ...CORTINA, colorFila: 'amarillo' }] }),
    );
    expect(rellenos.some((r) => r.color === 'amarillo')).toBe(false);
    expect(docsGuardados).toHaveLength(1);
  });
});

describe('generarPdfCotizacion', () => {
  it('imprime el encabezado y la banda de título', () => {
    generarPdfCotizacion(entradaDemo());
    expect(docsGuardados).toHaveLength(1);
    expect(impreso()).toContain('CORTINAS ROLZZO');
    expect(impreso()).toContain('LINEA PREMIUM [CATEGORIA B]');
    expect(impreso()).toContain('CARLOS');
    expect(impreso()).toContain('VÁLIDO POR 5 DIAS');
  });

  it('el detalle va bajo el título y la celda OT CLIENTE lleva solo el número', () => {
    generarPdfCotizacion(entradaDemo());
    const ot = 'N° COTJS - 07979-5 -1 - VISITA-VERTICALES Y DUAL CON CENEFA CUADRADA';
    expect(textosImpresos).toContain(ot);
    expect(impreso()).toContain('OT CLIENTE:');
    expect(textosImpresos).toContain('3205-1');
    // En la celda va el número pelado: el detalle no se repite ahí.
    expect(textosImpresos.filter((t) => t === ot)).toHaveLength(1);
    const idxBanda = textosImpresos.indexOf('LINEA PREMIUM [CATEGORIA B]');
    expect(textosImpresos.indexOf(ot)).toBeGreaterThan(idxBanda);
    expect(textosImpresos.indexOf('3205-1')).toBeGreaterThan(textosImpresos.indexOf(ot));
  });

  it('sin OT detallada la banda queda solo con el título y la celda dice N/A', () => {
    generarPdfCotizacion(entradaDemo({ otBanda: '   ', otCliente: '   ' }));
    expect(impreso()).toContain('N/A');
    expect(impreso()).not.toContain('COTJS - 07979-5');
  });

  // La celda CONTACTO dejó de ser el Instagram fijo de la empresa: ahora dice
  // por dónde nos encontró el cliente, elegido en Fase 1.
  it('la celda CONTACTO muestra el canal de ESTA cotización', () => {
    generarPdfCotizacion(entradaDemo({ canal: 'TikTok' }));
    expect(impreso()).toContain('CONTACTO:');
    expect(impreso()).toContain('TikTok');
  });

  it('sin canal elegido cae al texto fijo de la empresa, como antes', () => {
    generarPdfCotizacion(entradaDemo({ canal: '   ' }));
    expect(impreso()).toContain('INSTAGRAM');
    generarPdfCotizacion(entradaDemo({ canal: undefined }));
    expect(impreso()).toContain('INSTAGRAM');
  });

  it('la banda NO cae al número de la OT: ahí va texto o nada', () => {
    generarPdfCotizacion(entradaDemo({ otBanda: '', otCliente: '3201' }));
    // El número queda en su celda, no bajo el título.
    expect(impreso()).toContain('3201');
    const idxBanda = textosImpresos.indexOf('LINEA PREMIUM [CATEGORIA B]');
    const idxNumero = textosImpresos.indexOf('3201');
    expect(idxNumero).toBeGreaterThan(idxBanda + 1);
  });

  it('el título de la banda sale de la configuración, no de la gama', () => {
    generarPdfCotizacion(entradaDemo({ soloTelasB: false, hayTelaB: false }));
    expect(impreso()).toContain('COTIZACION');
    // «LINEA DELUX» y compañía no existen en ninguna cotización real.
    expect(impreso()).not.toContain('LINEA ');
  });

  it('el sello de las 12 cuotas es solo de la categoría B', () => {
    generarPdfCotizacion(entradaDemo({ soloTelasB: false, hayTelaB: false }));
    expect(imagenes.some((i) => i === SELLO_TARJETAS)).toBe(true);
    expect(imagenes.some((i) => i === SELLO_CUOTAS)).toBe(false);
    expect(impreso()).toContain('Con tarjeta de crédito');

    imagenes.length = 0;
    generarPdfCotizacion(entradaDemo());
    expect(imagenes.some((i) => i === SELLO_CUOTAS)).toBe(true);
    expect(imagenes.some((i) => i === SELLO_TARJETAS)).toBe(false);
  });

  it('dibuja las columnas del Excel más la CAT, agrupadas', () => {
    generarPdfCotizacion(entradaDemo());
    for (const c of ['COD', 'CANT', 'PRODUCTO', 'COD_INT', 'CAT', 'DCT%', 'DESCUENTO $', 'TOTAL']) {
      expect(impreso()).toContain(c);
    }
    expect(impreso()).toContain('INFORMACIÓN DEL PRODUCTO');
    expect(impreso()).toContain('MEDIDAS');
    expect(impreso()).toContain('PRECIO');
  });

  it('las medidas van con 3 decimales y coma, y los montos en pesos', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('1,460');
    expect(impreso()).toContain('0,800');
    expect(impreso()).toContain('$233.174');
    expect(impreso()).toContain('30%');
    // DESCUENTO $ = 233.174 × 1 × 30%
    expect(impreso()).toContain('$69.952');
  });

  it('la instalación gratis sale como adicional con 100% y total en guion', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('ADICIONALES');
    // El producto largo se parte en dos líneas de la celda (el cuerpo va todo
    // del mismo tamaño y ya no se achica).
    expect(impreso()).toContain('INSTALACION');
    expect(impreso()).toContain('ROLLER');
    expect(impreso()).toContain('GRATIS');
    expect(impreso()).toContain('100%');
    expect(impreso()).toContain('$122.500'); // 17.500 × 7 × 100%
    expect(impreso()).toContain('$ -');
  });

  it('el envío con cobro en destino se avisa bajo los adicionales', () => {
    const aviso = 'ENVÍO A REGIÓN: EL COSTO DEL ENVÍO SE PAGA EN DESTINO Y NO ESTÁ INCLUIDO EN ESTA COTIZACIÓN.';
    generarPdfCotizacion(entradaDemo({ avisoEnvio: aviso }));
    expect(impreso()).toContain(aviso);
    const idxAdic = textosImpresos.indexOf('ADICIONALES');
    expect(textosImpresos.indexOf(aviso)).toBeGreaterThan(idxAdic);
  });

  it('sin envío a cobrar no se dibuja ningún aviso', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).not.toContain('COBRO EN DESTINO');
    expect(impreso()).not.toContain('ENVÍO A REGIÓN');
  });

  it('los totales salen del MISMO descriptor que la pantalla, con el desglose de la planilla', () => {
    const totales = calcularTotales(1158638);
    generarPdfCotizacion(entradaDemo());
    for (const f of FILAS_TOTALES) {
      // El total con tarjeta nombra el medio de pago solo en el documento.
      expect(impreso()).toContain(f.labelPdf?.(totales, 'mercadopago') ?? f.label(totales));
      expect(impreso()).toContain(formatCLP(f.valor(totales)));
    }
    // El IVA vuelve a estar a la vista, así que la nota que decía que iba
    // incluido en los montos ya no se imprime.
    expect(impreso()).toContain('IVA 19%');
    expect(impreso().toLowerCase()).not.toContain('incluyen iva');
    // El abono inicial sigue fuera del documento del cliente.
    expect(impreso().toUpperCase()).not.toContain('ABONO');
  });

  it('cada rótulo de total cabe junto a su monto en el recuadro (no se monta encima)', () => {
    // El rótulo y el monto comparten celda: el rótulo se achica hasta caber en
    // el recuadro ENTERO, así que uno largo no se trunca —se dibuja debajo del
    // monto—. El más largo es el del documento con Mercadopago («Pago con
    // tarjeta de crédito (Mercadopago)»). Los cuerpos son los de `secTotales`.
    const doc = new jsPDF('p', 'mm', 'a4');
    const totales = calcularTotales(1158638);
    for (const f of FILAS_TOTALES) {
      doc.setFont('helvetica', f.fuerte ? 'bold' : 'normal');
      doc.setFontSize(f.fuerte ? 7.6 : 6.4);
      const wRotulo = Math.max(
        ...(['mercadopago', 'flow'] as const).map((p) =>
          doc.getTextWidth(f.labelPdf?.(totales, p) ?? f.label(totales)),
        ),
      );
      doc.setFontSize(f.fuerte ? 8.6 : 7);
      const wMonto = doc.getTextWidth(formatCLP(f.valor(totales)));
      // 2 mm de margen interno + 1,6 de aire entre los dos textos.
      expect(wRotulo + wMonto, f.id).toBeLessThan(ANCHO_TOTALES - 3.6);
    }
  });

  // Al abrir el documento, lo primero que saltaba a la vista era el monto MÁS
  // ALTO, en rojo (dueño, 2026-09-14). Ahora la tarjeta va resaltada en AZUL
  // (arriba) y la transferencia en AMARILLO (abajo), en ese orden, y solo en el
  // papel: la pantalla queda como estaba.
  it('el total con tarjeta va en azul arriba y el de transferencia en amarillo abajo', () => {
    generarPdfCotizacion(entradaDemo());
    const banda = (rgb: string) => rellenos.find((r) => r.color === rgb && r.w === ANCHO_TOTALES);
    const azul = banda('29,79,145'); // AZUL: tarjeta
    const amarillo = banda('255,235,125'); // AMARILLO_SUAVE: transferencia
    expect(azul).toBeDefined();
    expect(amarillo).toBeDefined();
    expect(azul!.y).toBeLessThan(amarillo!.y);
    // Y ya no queda ninguna banda del recuadro en rojo ni en negro.
    expect(banda('252,226,226')).toBeUndefined();
    expect(banda('22,22,24')).toBeUndefined();
  });

  it('el total con tarjeta dice con qué se paga, y nombra el medio elegido', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('Pago con tarjeta de crédito (Mercadopago)');
    expect(impreso()).not.toContain('Tot. tarjeta de crédito');

    textosImpresos.length = 0;
    generarPdfCotizacion(entradaDemo({ proveedorTarjeta: 'flow' }));
    expect(impreso()).toContain('Pago con tarjeta de crédito (Flow)');
    // Con Flow las cuotas las pone el banco: la leyenda roja no se promete.
    expect(impreso()).not.toContain('HASTA 12 CUOTAS SIN INTERÉS');
  });

  it('sin folio se genera igual y el archivo toma el nombre del cliente', () => {
    generarPdfCotizacion(entradaDemo({ numero: null, otBanda: '', otCliente: '' }));
    expect(docsGuardados).toHaveLength(1);
    expect(impreso()).not.toContain('COTJS-10427-1');
    expect(guardadosCon[0]).toBe('Cotizacion-CARLOS.pdf');
  });

  it('el recuadro rojo de la categoría B solo sale si hay telas B', () => {
    generarPdfCotizacion(entradaDemo({ hayTelaB: false, soloTelasB: false }));
    expect(impreso()).not.toContain('gama media');
    expect(impreso()).not.toContain('[CATEGORIA B]');

    textosImpresos.length = 0;
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('gama media');
  });

  it('imprime el pie con los datos de transferencia y la banda de cuotas', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('DATOS PARA REALIZAR TRANSFERENCIA:');
    expect(impreso()).toContain('Itaú');
    expect(impreso()).toContain('220917032');
    expect(impreso()).toContain('PAGA HASTA 12 CUOTAS SIN INTERÉS');
    expect(impreso()).toContain('CATÁLOGO DE TELAS');
    expect(impreso()).toContain('VER AQUÍ');
  });

  // Con Flow no hay cuotas sin interés: las pone el banco del cliente.
  it('con Flow la banda del pie cambia y no promete cuotas sin interés', () => {
    generarPdfCotizacion(entradaDemo({ proveedorTarjeta: 'flow' }));
    expect(impreso()).toContain('PAGO CON FLOW');
    expect(impreso()).not.toContain('PAGA HASTA 12 CUOTAS SIN INTERÉS');
    // La nota de la comisión de Mercadopago tampoco corresponde.
    expect(impreso()).not.toContain('COMISIÓN DE MERCADOPAGO');
  });

  it('con Flow no se estampa el sello de las 12 cuotas ni en categoría B', () => {
    generarPdfCotizacion(entradaDemo({ proveedorTarjeta: 'flow' }));
    expect(imagenes.some((i) => i === SELLO_CUOTAS)).toBe(false);
    expect(imagenes.some((i) => i === SELLO_TARJETAS)).toBe(true);
  });

  it('la banda de validez de la cotización pisa a la de la empresa', () => {
    generarPdfCotizacion(
      entradaDemo({ validezTitulo: 'DESCUENTO VÁLIDO POR 1 DÍA', validezAmarilla: true }),
    );
    expect(impreso()).toContain('DESCUENTO VÁLIDO POR 1 DÍA');
    expect(impreso()).not.toContain('VÁLIDO POR 5 DIAS');
  });

  it('sin validez propia manda la de la empresa', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('VÁLIDO POR 5 DIAS');
  });

  // La imagen del admin en la banda de validez (cyberday y parecidos).
  describe('imagen en la banda de validez', () => {
    // Un JPEG de verdad: jsPDF lo decodifica y la banda se dibuja. Con un
    // dataURL falso `addImage` lanza y el PDF cae al texto, que es justo el
    // respaldo que se quiere (pero no lo que este caso prueba).
    const IMG = TIRA_PROPIA;

    it('reemplaza la banda roja y su texto', () => {
      generarPdfCotizacion(entradaDemo({ validezImagenDataUrl: IMG }));
      expect(imagenes).toContain(IMG);
      expect(impreso()).not.toContain('VÁLIDO POR 5 DIAS');
    });

    it('la validez escrita en la cotización le gana a la imagen', () => {
      generarPdfCotizacion(
        entradaDemo({ validezImagenDataUrl: IMG, validezTitulo: 'CYBER 3 DÍAS' }),
      );
      expect(impreso()).toContain('CYBER 3 DÍAS');
      expect(imagenes).not.toContain(IMG);
    });
  });

  describe('medidasContain', () => {
    it('mete la imagen entera en el recuadro, centrada y sin deformar', () => {
      // Bien apaisada: ocupa todo el ancho y se centra a lo alto.
      expect(medidasContain(10, 60, 12)).toEqual({ x: 0, y: 3, ancho: 60, alto: 6 });
      // Menos apaisada que el recuadro: manda el alto y se centra a lo ancho.
      expect(medidasContain(4, 60, 12)).toEqual({ x: 6, y: 0, ancho: 48, alto: 12 });
      const alta = medidasContain(1, 60, 12);
      expect(alta.alto).toBe(12);
      expect(alta.ancho).toBe(12);
      expect(alta.x).toBe(24);
      // Ratio inválido: se estira al recuadro entero en vez de reventar.
      expect(medidasContain(0, 60, 12)).toEqual({ x: 0, y: 0, ancho: 60, alto: 12 });
    });
  });

  it('el recuadro de los datos bancarios se puede tocar para copiarlos', () => {
    generarPdfCotizacion(entradaDemo());
    expect(impreso()).toContain('> TOCA ESTE RECUADRO PARA COPIAR LOS DATOS');
    const url = enlaces.find((u) => u.includes('send?text='));
    expect(url).toBeDefined();
    const texto = decodeURIComponent(url!.split('send?text=')[1]);
    expect(texto).toContain('Comercial Antonio Pascuzzo EIRL');
    expect(texto).toContain('Cuenta Corriente Itaú');
    expect(texto).toContain('220917032');
    expect(texto).toContain('76.631.074-5');
  });

  it('sin datos bancarios no se dibuja el recuadro tocable', () => {
    const empresa = {
      ...DATOS_EMPRESA_DEFAULT,
      transferencia: {
        ...DATOS_EMPRESA_DEFAULT.transferencia,
        nombre: '',
        tipoCuenta: '',
        banco: '',
        numero: '',
        rut: '',
        mail: '',
      },
    };
    generarPdfCotizacion(entradaDemo({ empresa }));
    expect(impreso()).not.toContain('TOCA ESTE RECUADRO');
  });

  it('los botones del pie quedan clicables', () => {
    generarPdfCotizacion(entradaDemo());
    expect(enlaces.some((u) => u.includes('cortinasrolzzo.cl/collections/all'))).toBe(true);
    expect(enlaces.some((u) => u.includes('api.whatsapp.com'))).toBe(true);
  });

  it('el chip VER EJEMPLO acompaña al término de la onda, en las dos gamas', () => {
    // Categoría B: la onda «corte en V».
    generarPdfCotizacion(
      entradaDemo({
        terminos: [
          'Cortinas Roller igual o mayor a 1,90 mts de alto tienden a generar una leve onda en las telas tipo corte en "V".',
        ],
      }),
    );
    expect(impreso()).toContain('VER EJEMPLO');
    expect(enlaces.some((u) => u.includes('hubspot'))).toBe(true);

    // Categoría A: la redacción es otra, pero también habla de ondas.
    textosImpresos.length = 0;
    generarPdfCotizacion(
      entradaDemo({
        terminos: [
          'Cortinas Roller Blackout y Screen al utilizar zuncho y corchete en el peso inferior tienden a generar leves ondas en las telas, al ser mayor a 2 mts de ancho aún más.',
        ],
      }),
    );
    expect(impreso()).toContain('VER EJEMPLO');
  });

  it('con muchas cortinas salta de página repitiendo la cabecera', () => {
    const muchas = Array.from({ length: 60 }, (_, i) => ({ ...CORTINA, ubicacion: `V${i}` }));
    generarPdfCotizacion(entradaDemo({ cortinas: muchas }));
    expect(docsGuardados[0].getNumberOfPages()).toBeGreaterThan(1);
    expect(textosImpresos.filter((t) => t === 'COD').length).toBeGreaterThanOrEqual(2);
    expect(impreso()).toContain('Página 2');
  });

  it('usa el logo recibido y, sin logo, cae al encabezado tipográfico', () => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAA';
    generarPdfCotizacion(entradaDemo({ logoDataUrl: logo }));
    expect(imagenes).toContain(logo);

    textosImpresos.length = 0;
    imagenes.length = 0;
    generarPdfCotizacion(entradaDemo({ logoDataUrl: null }));
    expect(impreso()).toContain('Rolzzo');
    // Los sellos siguen dibujándose: lo que no está es el logo.
    expect(imagenes).not.toContain(logo);
  });

  it('los sellos van con transparencia: nada de recuadros sobre el papel', () => {
    generarPdfCotizacion(entradaDemo());
    generarPdfCotizacion(entradaDemo({ soloTelasB: false, hayTelaB: false }));
    // Un JPEG no tiene canal alfa y llegaba con el fondo negro al pie. La
    // única imagen que SÍ puede ser JPEG es la tira de fotos: va sobre papel
    // blanco, no necesita alfa y en PNG pesaría 1,8 MB.
    const sellosYLogo = imagenes.filter((d) => d !== TIRA_PROYECTOS);
    expect(sellosYLogo.length).toBeGreaterThan(0);
    expect(sellosYLogo.every((d) => !d.startsWith('data:image/jpeg'))).toBe(true);
  });

  // La tira «NUESTROS PROYECTOS Y PRODUCTOS» del Excel manual.
  describe('la tira de proyectos', () => {
    it('sale con sus dos bandas y la imagen', () => {
      generarPdfCotizacion(entradaDemo());
      expect(impreso()).toContain('NUESTROS PROYECTOS Y PRODUCTOS');
      expect(impreso()).toContain('FABRICADOS E INSTALADOS POR CORTINAS ROLZZO');
      expect(imagenes).toContain(TIRA_PROYECTOS);
    });

    it('apagándola en Admin desaparece entera', () => {
      const empresa = {
        ...DATOS_EMPRESA_DEFAULT,
        fotosProyectos: { ...DATOS_EMPRESA_DEFAULT.fotosProyectos, visible: false },
      };
      generarPdfCotizacion(entradaDemo({ empresa }));
      expect(impreso()).not.toContain('NUESTROS PROYECTOS');
      expect(imagenes).not.toContain(TIRA_PROYECTOS);
      // Sin tira tampoco queda el enlace suelto sobre el papel.
      expect(enlaces).not.toContain(DATOS_EMPRESA_DEFAULT.fotosProyectos.url);
    });

    it('queda clicable con el enlace de Admin', () => {
      generarPdfCotizacion(entradaDemo());
      expect(enlaces).toContain(DATOS_EMPRESA_DEFAULT.fotosProyectos.url);
    });

    it('sin enlace se dibuja igual, pero sin clic', () => {
      const empresa = {
        ...DATOS_EMPRESA_DEFAULT,
        fotosProyectos: { ...DATOS_EMPRESA_DEFAULT.fotosProyectos, url: '' },
      };
      generarPdfCotizacion(entradaDemo({ empresa }));
      expect(imagenes).toContain(TIRA_PROYECTOS);
      expect(enlaces).not.toContain(DATOS_EMPRESA_DEFAULT.fotosProyectos.url);
    });

    it('la imagen propia del admin reemplaza a la de fábrica', () => {
      generarPdfCotizacion(entradaDemo({ tiraProyectosDataUrl: TIRA_PROPIA }));
      expect(imagenes).toContain(TIRA_PROPIA);
      expect(imagenes).not.toContain(TIRA_PROYECTOS);
    });

    it('sin imagen propia sigue saliendo la de fábrica', () => {
      generarPdfCotizacion(entradaDemo({ tiraProyectosDataUrl: null }));
      expect(imagenes).toContain(TIRA_PROYECTOS);
    });
  });

  // El alto de la tira decide si el cierre cabe en la página: una imagen con
  // otra proporción no puede empujarlo fuera del papel.
  describe('medidasTira', () => {
    it('la de fábrica ocupa el ancho de la tabla', () => {
      const m = medidasTira(TIRA_PROYECTOS_RATIO);
      expect(m.ancho).toBe(ANCHO_UTIL);
      expect(m.x).toBe(8);
      expect(m.alto).toBeCloseTo(ANCHO_UTIL / TIRA_PROYECTOS_RATIO);
    });

    it('una imagen más alta que ancha se achica y se centra, no se deforma', () => {
      const m = medidasTira(1); // cuadrada
      expect(m.alto).toBe(ALTO_MAX_TIRA);
      expect(m.ancho).toBe(ALTO_MAX_TIRA);
      expect(m.x).toBeGreaterThan(8);
      // Conserva la proporción que le pasaron.
      expect(m.ancho / m.alto).toBeCloseTo(1);
    });

    it('un ratio inservible cae al de fábrica en vez de dividir por cero', () => {
      for (const malo of [0, -3, NaN, Infinity]) {
        expect(medidasTira(malo).alto).toBeCloseTo(ANCHO_UTIL / TIRA_PROYECTOS_RATIO);
      }
    });
  });

  // El rótulo rojo de las cuotas que la planilla pone junto al total tarjeta.
  // Se busca por igualdad EXACTA: la banda del pie dice «PAGA HASTA 12 CUOTAS
  // SIN INTERÉS» y con `toContain` cualquier prueba pasaría sola.
  describe('la leyenda de las cuotas', () => {
    const LEYENDA = DATOS_EMPRESA_DEFAULT.totales.leyendaCuotas;
    const salio = () => textosImpresos.includes(LEYENDA);

    it('va con Mercadopago, en cualquier categoría', () => {
      generarPdfCotizacion(entradaDemo({ soloTelasB: false, hayTelaB: false }));
      expect(salio()).toBe(true);
      textosImpresos.length = 0;
      generarPdfCotizacion(entradaDemo({ soloTelasB: true }));
      expect(salio()).toBe(true);
    });

    it('con Flow no se promete nada: las cuotas las pone el banco', () => {
      generarPdfCotizacion(entradaDemo({ proveedorTarjeta: 'flow' }));
      expect(salio()).toBe(false);
    });

    it('vaciándola en Admin no sale', () => {
      const empresa = { ...DATOS_EMPRESA_DEFAULT, totales: { leyendaCuotas: '' } };
      generarPdfCotizacion(entradaDemo({ empresa }));
      expect(salio()).toBe(false);
    });
  });
});

describe('helpers del PDF', () => {
  it('las columnas suman exactamente el ancho útil de la hoja', () => {
    expect(ANCHO_COLUMNAS).toBe(ANCHO_UTIL);
  });

  it('la cotización de una sola cortina cabe en una página', () => {
    generarPdfCotizacion(entradaDemo({ cortinas: [CORTINA] }));
    expect(docsGuardados[0].getNumberOfPages()).toBe(1);
  });

  it('tituloBanda toma los dos títulos de la planilla', () => {
    expect(tituloBanda(DATOS_EMPRESA_DEFAULT, true)).toBe('LINEA PREMIUM [CATEGORIA B]');
    expect(tituloBanda(DATOS_EMPRESA_DEFAULT, false)).toBe('COTIZACION');
  });

  it('tituloBanda respeta lo que el admin haya configurado', () => {
    const empresa = {
      ...DATOS_EMPRESA_DEFAULT,
      banda: { ...DATOS_EMPRESA_DEFAULT.banda, titulo: 'PRESUPUESTO' },
    };
    expect(tituloBanda(empresa, false)).toBe('PRESUPUESTO');
  });

  it('fmtMedida3 escribe las medidas como el Excel', () => {
    expect(fmtMedida3(1.46)).toBe('1,460');
    expect(fmtMedida3(2)).toBe('2,000');
    expect(fmtMedida3(NaN)).toBe('0,000');
  });

  it('descuentoPesos usa la misma guarda de cantidad que el motor', () => {
    expect(descuentoPesos(17500, 7, 1)).toBe(122500);
    expect(descuentoPesos(100000, 0, 0.3)).toBe(30000); // cantidad 0 cuenta como 1
  });

  it('textoTransferencia arma los datos listos para pegar en el banco', () => {
    const t = textoTransferencia(DATOS_EMPRESA_DEFAULT.transferencia);
    expect(t.split('\n')).toEqual([
      'Comercial Antonio Pascuzzo EIRL',
      'Cuenta Corriente Itaú',
      'N°: 220917032',
      'RUT: 76.631.074-5',
      'Mail: cortinasrolzzo@gmail.com',
    ]);
  });

  it('urlCopiarTransferencia queda vacía si no hay datos que mandar', () => {
    expect(urlCopiarTransferencia(DATOS_EMPRESA_DEFAULT.transferencia)).toContain('send?text=');
    const vacio = { titulo: '', intro: '', nombre: '', tipoCuenta: '', banco: '', rut: '', numero: '', mail: '' };
    expect(urlCopiarTransferencia(vacio)).toBe('');
  });

  it('nombreArchivoPdf prefiere el folio y sanea el texto', () => {
    expect(nombreArchivoPdf('COTJS-10427-1', 'CARLOS')).toBe('Cotizacion-COTJS-10427-1.pdf');
    expect(nombreArchivoPdf(null, 'María Pérez')).toBe('Cotizacion-Maria-Perez.pdf');
    expect(nombreArchivoPdf(null, '   ')).toBe('Cotizacion.pdf');
  });
});
