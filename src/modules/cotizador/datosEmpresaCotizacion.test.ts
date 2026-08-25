import { describe, expect, it } from 'vitest';
import { DATOS_EMPRESA_DEFAULT, normalizarDatosEmpresa } from './datosEmpresaCotizacion';

describe('los datos de empresa del PDF', () => {
  it('de fábrica trae los del PDF que se manda hoy al cliente', () => {
    const d = DATOS_EMPRESA_DEFAULT;
    expect(d.encabezado.titulo).toBe('CORTINAS ROLZZO');
    expect(d.encabezado.rut).toBe('76.631.074-5');
    expect(d.transferencia.banco).toBe('Itaú');
    expect(d.transferencia.numero).toBe('220917032');
    expect(d.validez.titulo).toContain('5 DIAS');
    expect(d.bandaFinal.titulo).toContain('12 CUOTAS');
    // Con Flow no hay cuotas sin interés: las pone el banco del cliente.
    expect(d.bandaFinal.tituloFlow).toContain('FLOW');
    expect(d.bandaFinal.tituloFlow).not.toContain('SIN INTERÉS');
    expect(d.bandaFinal.notaFlow).toBe('');
    // El logo de fábrica va embebido en el generador: acá vacío a propósito.
    expect(d.encabezado.logoUrl).toBe('');
  });

  it('la banda trae los dos títulos que se escriben a mano en la planilla', () => {
    const b = DATOS_EMPRESA_DEFAULT.banda;
    expect(b.titulo).toBe('COTIZACION');
    expect(b.tituloCategoriaB).toBe('LINEA PREMIUM [CATEGORIA B]');
    expect(b.leyendaTarjetas).toBe('Con tarjeta de crédito');
  });

  it('trae los 3 botones del pie con sus links reales', () => {
    const b = DATOS_EMPRESA_DEFAULT.botones;
    expect(b).toHaveLength(3);
    expect(b[0].etiqueta).toBe('CATÁLOGO DE TELAS');
    expect(b[0].url).toContain('cortinasrolzzo.cl/collections/all');
    // Showroom y WhatsApp van al mismo WhatsApp, como en el PDF de referencia.
    expect(b[1].url).toContain('api.whatsapp.com');
    expect(b[2].url).toContain('api.whatsapp.com');
    expect(b.every((x) => x.accion.length > 0)).toBe(true);
  });
});

describe('normalizarDatosEmpresa', () => {
  it('sin datos usables cae al default', () => {
    expect(normalizarDatosEmpresa(null)).toBe(DATOS_EMPRESA_DEFAULT);
    expect(normalizarDatosEmpresa('nope')).toBe(DATOS_EMPRESA_DEFAULT);
    expect(normalizarDatosEmpresa(undefined)).toBe(DATOS_EMPRESA_DEFAULT);
  });

  it('un objeto vacío devuelve todos los campos de fábrica', () => {
    expect(normalizarDatosEmpresa({})).toEqual(DATOS_EMPRESA_DEFAULT);
  });

  it('lo guardado pisa al default sin borrar lo que no se tocó', () => {
    const out = normalizarDatosEmpresa({
      transferencia: { banco: 'Santander', numero: '999' },
    });
    expect(out.transferencia.banco).toBe('Santander');
    expect(out.transferencia.numero).toBe('999');
    // Los campos que la empresa no editó siguen siendo los de fábrica.
    expect(out.transferencia.nombre).toBe(DATOS_EMPRESA_DEFAULT.transferencia.nombre);
    expect(out.encabezado.titulo).toBe(DATOS_EMPRESA_DEFAULT.encabezado.titulo);
    expect(out.botones).toEqual(DATOS_EMPRESA_DEFAULT.botones);
  });

  it('repone los botones que falten y respeta los editados', () => {
    const out = normalizarDatosEmpresa({
      botones: [{ etiqueta: 'MI CATÁLOGO', url: 'https://x.cl' }],
    });
    expect(out.botones).toHaveLength(3);
    expect(out.botones[0].etiqueta).toBe('MI CATÁLOGO');
    expect(out.botones[0].url).toBe('https://x.cl');
    // La acción que no vino se repone; los otros dos botones enteros también.
    expect(out.botones[0].accion).toBe('VER AQUÍ');
    expect(out.botones[2]).toEqual(DATOS_EMPRESA_DEFAULT.botones[2]);
  });

  it('un link vaciado a propósito se respeta (botón sin enlace)', () => {
    const out = normalizarDatosEmpresa({
      botones: [{ url: '' }, {}, {}],
      urlEjemploOnda: '',
      contacto: { texto: '', url: '' },
    });
    expect(out.botones[0].url).toBe('');
    expect(out.urlEjemploOnda).toBe('');
    expect(out.contacto.url).toBe('');
  });

  it('el título del encabezado nunca queda vacío', () => {
    const out = normalizarDatosEmpresa({ encabezado: { titulo: '   ' } });
    expect(out.encabezado.titulo).toBe('CORTINAS ROLZZO');
  });

  it('el título de la banda tampoco: es lo primero que ve el cliente', () => {
    const out = normalizarDatosEmpresa({ banda: { titulo: '  ', tituloCategoriaB: '' } });
    expect(out.banda.titulo).toBe('COTIZACION');
    expect(out.banda.tituloCategoriaB).toBe('LINEA PREMIUM [CATEGORIA B]');
  });

  it('guarda el logo propio cuando el admin sube uno', () => {
    const out = normalizarDatosEmpresa({ encabezado: { logoUrl: 'https://cdn/logo.png' } });
    expect(out.encabezado.logoUrl).toBe('https://cdn/logo.png');
  });

  // Lo guardado por una empresa ANTES de que existieran estos campos no puede
  // quedarse sin la leyenda ni sin la tira: son parte del documento de siempre.
  describe('campos nuevos sobre una configuración vieja', () => {
    const vieja = { encabezado: { titulo: 'CORTINAS ROLZZO' } };

    it('la leyenda de las cuotas se repone', () => {
      expect(normalizarDatosEmpresa(vieja).totales.leyendaCuotas).toBe(
        'HASTA 12 CUOTAS SIN INTERÉS',
      );
    });

    it('la tira de proyectos sale, con sus dos textos', () => {
      const f = normalizarDatosEmpresa(vieja).fotosProyectos;
      expect(f.visible).toBe(true);
      expect(f.titulo).toBe('NUESTROS PROYECTOS Y PRODUCTOS');
      expect(f.subtitulo).toContain('CORTINAS ROLZZO');
    });

    it('solo un false explícito la apaga', () => {
      expect(normalizarDatosEmpresa({ fotosProyectos: { visible: false } }).fotosProyectos.visible)
        .toBe(false);
      expect(normalizarDatosEmpresa({ fotosProyectos: {} }).fotosProyectos.visible).toBe(true);
    });

    it('la leyenda vaciada a propósito se respeta (no sale nunca)', () => {
      expect(normalizarDatosEmpresa({ totales: { leyendaCuotas: '' } }).totales.leyendaCuotas)
        .toBe('');
    });
  });
});
