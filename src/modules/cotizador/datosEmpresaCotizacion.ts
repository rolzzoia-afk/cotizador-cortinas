// ─────────────────────────────────────────────────────────────────────
// DATOS FIJOS DE LA EMPRESA que salen en el PDF descargable de la cotización.
//
// Son los textos que en la planilla Excel estaban escritos a mano en la
// plantilla: el encabezado con el teléfono y el RUT, la banda de validez, los
// datos para transferir, los botones con link del pie y las bandas de cuotas.
// No los calcula nadie y no vienen de la cotización: son de la empresa.
//
// Viven en `configuracion` (clave `datos_empresa_cotizacion`) para que el
// administrador pueda cambiar una cuenta bancaria o un link sin tocar código.
// Los valores de fábrica son los del PDF que la empresa manda hoy
// (docs/referencias/CATEGORIA B-MATACARLOS COTJS-10427-1.pdf); las URLs se
// sacaron de las anotaciones de ese mismo PDF.
//
// Módulo puro: sin React ni Supabase (se testea directo).
// ─────────────────────────────────────────────────────────────────────

/** Uno de los botones con link del pie del PDF. */
export type BotonPdf = {
  /** Título de la fila («CATÁLOGO DE TELAS»). */
  etiqueta: string;
  /** Texto dentro del botón («VER AQUÍ»). */
  accion: string;
  /** A dónde lleva el clic. Vacío = el botón se dibuja sin enlace. */
  url: string;
  /** Bajada chica bajo el título. */
  nota: string;
};

export type DatosEmpresaCotizacion = {
  encabezado: {
    titulo: string;
    subtitulo: string;
    web: string;
    telefono: string;
    rut: string;
    correos: string;
    /** Logo propio subido por el admin. Vacío = el logo Rolzzo de fábrica. */
    logoUrl: string;
  };
  /**
   * La banda negra del título. En la planilla es una celda que la vendedora
   * escribe a mano: dice «COTIZACION» salvo en las de categoría B, que llevan
   * «LINEA PREMIUM [CATEGORIA B]». Por eso son dos textos, no uno armado con
   * la gama de las cortinas.
   */
  banda: { titulo: string; tituloCategoriaB: string; leyendaTarjetas: string };
  /** La banda roja del encabezado. */
  validez: { titulo: string; detalle: string };
  /** La celda CONTACTO de la grilla del cliente. */
  contacto: { texto: string; url: string };
  transferencia: {
    titulo: string;
    intro: string;
    nombre: string;
    tipoCuenta: string;
    banco: string;
    rut: string;
    numero: string;
    mail: string;
  };
  botones: BotonPdf[];
  /**
   * La leyenda de las cuotas que va pegada al total con tarjeta, como el
   * rótulo rojo de la planilla. Solo sale con Mercadopago: con Flow las cuotas
   * y sus intereses los pone el banco del cliente.
   */
  totales: { leyendaCuotas: string };
  /** La tira de fotos «NUESTROS PROYECTOS Y PRODUCTOS» del pie. */
  fotosProyectos: { titulo: string; subtitulo: string; visible: boolean };
  /** El recuadro rojo que solo sale cuando la cotización trae telas B. */
  bloqueCategoriaB: { texto: string };
  /**
   * La banda roja del pie. Cambia con el medio de pago: las cuotas SIN INTERÉS
   * son de Mercadopago; con Flow los intereses los pone el banco del cliente.
   */
  bandaFinal: { titulo: string; nota: string; tituloFlow: string; notaFlow: string };
  /** El chip «VER EJEMPLO» del término de la onda en "V". */
  urlEjemploOnda: string;
};

export const DATOS_EMPRESA_DEFAULT: DatosEmpresaCotizacion = {
  encabezado: {
    titulo: 'CORTINAS ROLZZO',
    subtitulo: '[ CORTINAS ROLLER A LA MEDIDA ]',
    web: 'www.cortinasrolzzo.cl',
    telefono: '+ 56 9 9942 8383',
    rut: '76.631.074-5',
    correos: 'CORTINASROLZZO@GMAIL.COM - VENTAS@CORTINASROLZZO.CL',
    logoUrl: '',
  },
  banda: {
    titulo: 'COTIZACION',
    tituloCategoriaB: 'LINEA PREMIUM [CATEGORIA B]',
    leyendaTarjetas: 'Con tarjeta de crédito',
  },
  validez: {
    titulo: 'VÁLIDO POR 5 DIAS',
    detalle: 'De aprobar después de este rango debe actualizar cotización',
  },
  contacto: {
    texto: 'INSTAGRAM',
    url: 'https://www.instagram.com/cortinasrolzzo/',
  },
  transferencia: {
    titulo: 'DATOS PARA REALIZAR TRANSFERENCIA:',
    intro:
      'Una vez aceptada la cotización (luego de la visita y rectificadas medidas) se debe cancelar el 50% a la siguiente cuenta:',
    nombre: 'Comercial Antonio Pascuzzo EIRL',
    tipoCuenta: 'Corriente',
    banco: 'Itaú',
    rut: '76.631.074-5',
    numero: '220917032',
    mail: 'cortinasrolzzo@gmail.com',
  },
  botones: [
    {
      etiqueta: 'CATÁLOGO DE TELAS',
      accion: 'VER AQUÍ',
      url: 'https://cortinasrolzzo.cl/collections/all',
      // Neutro a propósito: el enlace lleva al catálogo COMPLETO y este texto
      // sale igual en una cotización de categoría A que en una de B.
      nota: 'Revisa todas nuestras telas disponibles.',
    },
    {
      etiqueta: 'VISITA AL SHOWROOM',
      accion: 'AGENDAR',
      url: 'https://api.whatsapp.com/send/?phone=56999428383&text&app_absent=0',
      nota: 'Corrobora la calidad de materiales. (Previo agendamiento)',
    },
    {
      etiqueta: 'WHATSAPP',
      accion: 'CLIC AQUÍ',
      url: 'https://api.whatsapp.com/send/?phone=56999428383&text&app_absent=0',
      nota: 'Aclara todas tus dudas con nuestras asesoras.',
    },
  ],
  totales: { leyendaCuotas: 'HASTA 12 CUOTAS SIN INTERÉS' },
  fotosProyectos: {
    titulo: 'NUESTROS PROYECTOS Y PRODUCTOS',
    subtitulo: 'TODO NUESTRO INSTAGRAM Y PAGINA WEB SON TRABAJOS FABRICADOS E INSTALADOS POR CORTINAS ROLZZO',
    visible: true,
  },
  bloqueCategoriaB: {
    texto:
      'Esta cotización es la "CATEGORÍA B", fabricadas con los mismos materiales de gama media que te ofrecen la mayoría de los cortineros. Los materiales utilizados en la fabricación de estas cortinas roller o verticales NO son de la "CATEGORÍA A" que Cortinas Rolzzo siempre utiliza y compara en nuestras publicaciones',
  },
  bandaFinal: {
    titulo: 'PAGA HASTA 12 CUOTAS SIN INTERÉS',
    nota: 'SI PAGAS CON TARJETA DE DÉBITO SE TE APLICARÁ LA COMISIÓN DE MERCADOPAGO POR LO QUE SI VAS A PAGAR CON DÉBITO, TE RECOMENDAMOS HACER UNA TRANSFERENCIA Y TE EVITAS LA COMISIÓN',
    // Tal cual la banda del documento de Flow, que no lleva nota debajo.
    tituloFlow: 'PAGO CON FLOW - LOS INTERESES DEPENDERÁ DE TU BANCO',
    notaFlow: '',
  },
  urlEjemploOnda: 'https://app.hubspot.com/documents/8349822/view/243147183?accessId=48ffc2',
};

function txt(v: unknown, porDefecto: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || porDefecto;
}

/** Igual que `txt` pero acepta el vacío a propósito (logo, URLs opcionales). */
function txtOpcional(v: unknown, porDefecto: string): string {
  return typeof v === 'string' ? v.trim() : porDefecto;
}

/**
 * Sanea lo guardado en la BD contra los valores de fábrica, campo por campo.
 * Se hace así —y no con un spread— para que agregar un campo nuevo al type NO
 * deje el PDF con un hueco en las empresas que ya guardaron su configuración.
 */
export function normalizarDatosEmpresa(raw: unknown): DatosEmpresaCotizacion {
  const d = DATOS_EMPRESA_DEFAULT;
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Record<keyof DatosEmpresaCotizacion, unknown>>;
  const enc = (r.encabezado ?? {}) as Record<string, unknown>;
  const bnd = (r.banda ?? {}) as Record<string, unknown>;
  const val = (r.validez ?? {}) as Record<string, unknown>;
  const con = (r.contacto ?? {}) as Record<string, unknown>;
  const tra = (r.transferencia ?? {}) as Record<string, unknown>;
  const blo = (r.bloqueCategoriaB ?? {}) as Record<string, unknown>;
  const ban = (r.bandaFinal ?? {}) as Record<string, unknown>;
  const tot = (r.totales ?? {}) as Record<string, unknown>;
  const fot = (r.fotosProyectos ?? {}) as Record<string, unknown>;

  // Los botones se reponen enteros si la lista guardada no sirve: son 3 filas
  // con posición fija en el pie, no una lista libre.
  const botonesRaw = Array.isArray(r.botones) ? (r.botones as unknown[]) : [];
  const botones = d.botones.map((porDefecto, i) => {
    const b = (botonesRaw[i] ?? {}) as Record<string, unknown>;
    return {
      etiqueta: txt(b.etiqueta, porDefecto.etiqueta),
      accion: txt(b.accion, porDefecto.accion),
      url: txtOpcional(b.url, porDefecto.url),
      nota: txtOpcional(b.nota, porDefecto.nota),
    };
  });

  return {
    encabezado: {
      titulo: txt(enc.titulo, d.encabezado.titulo),
      subtitulo: txtOpcional(enc.subtitulo, d.encabezado.subtitulo),
      web: txtOpcional(enc.web, d.encabezado.web),
      telefono: txtOpcional(enc.telefono, d.encabezado.telefono),
      rut: txtOpcional(enc.rut, d.encabezado.rut),
      correos: txtOpcional(enc.correos, d.encabezado.correos),
      logoUrl: txtOpcional(enc.logoUrl, ''),
    },
    banda: {
      // El título nunca puede quedar vacío: es lo primero que ve el cliente.
      titulo: txt(bnd.titulo, d.banda.titulo),
      tituloCategoriaB: txt(bnd.tituloCategoriaB, d.banda.tituloCategoriaB),
      leyendaTarjetas: txtOpcional(bnd.leyendaTarjetas, d.banda.leyendaTarjetas),
    },
    validez: {
      titulo: txtOpcional(val.titulo, d.validez.titulo),
      detalle: txtOpcional(val.detalle, d.validez.detalle),
    },
    contacto: {
      texto: txtOpcional(con.texto, d.contacto.texto),
      url: txtOpcional(con.url, d.contacto.url),
    },
    transferencia: {
      titulo: txt(tra.titulo, d.transferencia.titulo),
      intro: txtOpcional(tra.intro, d.transferencia.intro),
      nombre: txtOpcional(tra.nombre, d.transferencia.nombre),
      tipoCuenta: txtOpcional(tra.tipoCuenta, d.transferencia.tipoCuenta),
      banco: txtOpcional(tra.banco, d.transferencia.banco),
      rut: txtOpcional(tra.rut, d.transferencia.rut),
      numero: txtOpcional(tra.numero, d.transferencia.numero),
      mail: txtOpcional(tra.mail, d.transferencia.mail),
    },
    botones,
    totales: { leyendaCuotas: txtOpcional(tot.leyendaCuotas, d.totales.leyendaCuotas) },
    fotosProyectos: {
      titulo: txtOpcional(fot.titulo, d.fotosProyectos.titulo),
      subtitulo: txtOpcional(fot.subtitulo, d.fotosProyectos.subtitulo),
      // Solo un `false` explícito la apaga: un guardado viejo no la tiene y
      // tiene que salir igual.
      visible: fot.visible !== false,
    },
    bloqueCategoriaB: { texto: txtOpcional(blo.texto, d.bloqueCategoriaB.texto) },
    bandaFinal: {
      titulo: txtOpcional(ban.titulo, d.bandaFinal.titulo),
      nota: txtOpcional(ban.nota, d.bandaFinal.nota),
      tituloFlow: txtOpcional(ban.tituloFlow, d.bandaFinal.tituloFlow),
      notaFlow: txtOpcional(ban.notaFlow, d.bandaFinal.notaFlow),
    },
    urlEjemploOnda: txtOpcional(r.urlEjemploOnda, d.urlEjemploOnda),
  };
}
