import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mismo arnés que pdfEtiquetasBrother.test.ts: subclase real de jsPDF (las
// medidas de página son las de verdad) que captura lo guardado, lo impreso con
// text()/textWithLink(), las imágenes y los enlaces.
const docsGuardados = vi.hoisted(() => [] as Array<{ getNumberOfPages: () => number }>);
const textosImpresos = vi.hoisted(() => [] as string[]);
const imagenes = vi.hoisted(() => [] as string[]);
const enlaces = vi.hoisted(() => [] as string[]);
const guardadosCon = vi.hoisted(() => [] as string[]);

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  class JsPDFCaptura extends mod.jsPDF {
    constructor(...args: ConstructorParameters<typeof mod.jsPDF>) {
      super(...args);
      const self = this as unknown as Record<string, (...a: never[]) => unknown>;
      const textOriginal = self.text.bind(this);
      self.text = ((s: string | string[], ...rest: never[]) => {
        textosImpresos.push(Array.isArray(s) ? s.join(' ') : String(s));
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
import { TIRA_PROYECTOS } from './fotosProyectos';
import { SELLO_CUOTAS, SELLO_TARJETAS } from './logoRolzzo';
import { FILAS_TOTALES, NOTA_IVA } from './filasTotales';
import { calcularTotales } from './preciosFase0';
import {
  ANCHO_COLUMNAS,
  ANCHO_UTIL,
  descuentoPesos,
  fmtMedida3,
  generarPdfCotizacion,
  nombreArchivoPdf,
  textoTransferencia,
  tituloBanda,
  urlCopiarTransferencia,
  type EntradaPdfCotizacion,
  type FilaPdfCortina,
} from './pdfCotizacion';

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

  it('dibuja las 14 columnas del Excel, agrupadas', () => {
    generarPdfCotizacion(entradaDemo());
    for (const c of ['COD', 'CANT', 'PRODUCTO', 'COD_INT', 'DCT%', 'DESCUENTO $', 'TOTAL']) {
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
    expect(impreso()).toContain('INSTALACION ROLLER');
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

  it('los totales salen del MISMO descriptor que la pantalla, sin desglosar IVA', () => {
    generarPdfCotizacion(entradaDemo());
    for (const f of FILAS_TOTALES) expect(impreso()).toContain(f.label);
    expect(impreso()).toContain(NOTA_IVA);
    expect(impreso()).not.toContain('IVA 19%');
    expect(impreso().toUpperCase()).not.toContain('SUBTOTAL');
    expect(impreso().toUpperCase()).not.toContain('ABONO');
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
