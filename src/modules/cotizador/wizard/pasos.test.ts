import { describe, expect, it } from 'vitest';
import {
  avancePaso,
  faltantesPaso,
  pasoCompleto,
  pasoDePieza,
  pasosAplicables,
  targetsProgreso,
  PASOS_WIZARD,
  type CtxPaso,
  type IdPaso,
} from './pasos';
import { PIEZAS_VIZ, type VarianteViz } from './cortinaViz';
import { pendientesFase2 } from '../fase2-completitud';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import type { CatalogoProductos, Pano, Ventana } from '../types';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

/** Reglas donde el ROL quedó marcado «sin mecanismo» (lo permite Admin). */
const SIN_KIT: ReglasSeleccion = {
  ...REGLAS_SELECCION_DEFAULT,
  mecanismo: {
    ...REGLAS_SELECCION_DEFAULT.mecanismo,
    categoriasSinMecanismo: ['VERTICAL', 'BEEBLACK', 'ROL'],
  },
};

const modeloRoller: ModeloDespiece = {
  sistema: 'ROLLER',
  tipo_rol: 'ROL',
  mecanismo: 'MEC_33',
  codigos_tubo: 'E02',
  diametro_tubo_mm: 38,
  dcto_tubo_cm: 3.8,
  dcto_tela_cm: 0.5,
  suma_peso_cm: 0.1,
} as ModeloDespiece;

/** Paño con TODO lo que piden los pasos del wizard. */
const panoLleno = (over: Partial<Pano> = {}): Pano =>
  ({
    ancho: 1.5,
    alto: 2,
    color: 'BLANCO',
    colorMecanismo: 'BCO',
    colorCadena: 'BCO',
    colorPeso: 'BCO',
    materialTipo: 'CONCRETO',
    superficie: 'TECHO',
    relacionMarco: 'Dentro',
    tuberia: '38mm [E02]',
    mecanismo: 'SINFLEX BLANCO [MEC 33]',
    codCadena: 'CAD 03',
    codPeso: 'PCA 04',
    cierreVert: 'Derecha',
    tipoTela: 'BK',
    cortes: 'Nada',
    cenefa: 'No',
    manillaCant: 0,
    ...over,
  }) as unknown as Pano;

const ventLlena = (over: Partial<Ventana> = {}, pano: Partial<Pano> = {}): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING',
    categoria: 'ROL',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    color: 'BLANCO',
    alto: 2,
    cantidad: 1,
    modelo: modeloRoller,
    panos: [panoLleno(pano)],
    ...over,
  }) as unknown as Ventana;

const ctxDe = (
  v: Ventana,
  variante: VarianteViz = 'roller',
  extra: { catalogo?: CatalogoProductos; reglas?: ReglasSeleccion } = {},
): CtxPaso => ({
  ventana: v,
  pano: v.panos[0],
  panoIdx: 0,
  variante,
  ...extra,
});

const idsAplicables = (ctx: CtxPaso): IdPaso[] => pasosAplicables(ctx).map((p) => p.id);
const pasoPorId = (id: IdPaso) => PASOS_WIZARD.find((p) => p.id === id)!;

describe('pasosAplicables', () => {
  it('un roller recorre los diez pasos, en orden', () => {
    expect(idsAplicables(ctxDe(ventLlena()))).toEqual([
      'medidas',
      'soportes',
      'tubo',
      'mecanismo',
      'accionamiento',
      'tela',
      'peso',
      'terreno',
      'cenefa',
      'resumen',
    ]);
  });

  it('la pletina lleva mecanismo (VELCRO) pero NO accionamiento', () => {
    // De fábrica solo la vertical y el beeblack van sin kit, y ninguna de las
    // dos tiene vista guiada: el paso de mecanismo siempre aparece. El de
    // accionamiento no: el paño va PEGADO, no sube ni baja, así que no hay
    // cadena, ni peso de cadena, ni lado de mando que preguntar.
    const ids = idsAplicables(ctxDe(ventLlena({ categoria: 'PLETINA_ROLLER_V' })));
    expect(ids).toContain('mecanismo');
    expect(ids).not.toContain('accionamiento');
    expect(ids).toContain('tela');
  });

  it('el wizard de la pletina nunca pide MENOS que el gate de Fase 2', () => {
    // Misma paridad que el resto: si se completan los pasos, la ventana no
    // puede quedar bloqueando el paso a Fase 3.
    const v = ventLlena({ categoria: 'PLETINA_ROLLER_V' }, { codCadena: '', codPeso: '' });
    expect(pendientesFase2([v])).toEqual([]);
  });

  it('si Admin marca una categoría «sin mecanismo», el wizard se salta ese paso', () => {
    const ids = idsAplicables(ctxDe(ventLlena(), 'roller', { reglas: SIN_KIT }));
    expect(ids).not.toContain('mecanismo');
    expect(ids).not.toContain('accionamiento');
    expect(ids).toContain('tela');
  });
});

describe('avance de cada paso', () => {
  it('una ventana en blanco no tiene ningún paso listo (salvo los que no piden nada)', () => {
    const vacia = {
      id: 'v', ubicacion: '', categoria: '', codInt: '', color: '', alto: 0, cantidad: 1,
      panos: [{ ancho: '', alto: '', color: '' } as Pano],
    } as unknown as Ventana;
    const ctx = ctxDe(vacia);
    expect(avancePaso(pasoPorId('medidas'), ctx)).toBe(0);
    expect(avancePaso(pasoPorId('soportes'), ctx)).toBe(0);
    expect(avancePaso(pasoPorId('tubo'), ctx)).toBe(0);
  });

  it('el avance es la fracción de campos resueltos', () => {
    const ctx = ctxDe(ventLlena({}, { materialTipo: '', superficie: '' }));
    // soportes pide 4 datos y quedan 2.
    expect(avancePaso(pasoPorId('soportes'), ctx)).toBeCloseTo(0.5, 6);
    expect(faltantesPaso(pasoPorId('soportes'), ctx)).toEqual(['material (tarugos)', 'superficie']);
  });

  it('con todo lleno, todos los pasos quedan completos', () => {
    const ctx = ctxDe(ventLlena());
    for (const p of pasosAplicables(ctx)) expect(pasoCompleto(p, ctx)).toBe(true);
  });

  it('el MEC 06 trae la cadena incorporada: no se pide elegir una', () => {
    const ctx = ctxDe(ventLlena({}, { codCadena: '', mecanismo: 'CADENA INCORPORADA [MEC 06]' }));
    expect(pasoCompleto(pasoPorId('accionamiento'), ctx)).toBe(true);
  });

  it('con motor se piden modelo y lado, no cadena ni peso', () => {
    const ctx = ctxDe(
      ventLlena({}, { codCadena: '', codPeso: '', motorModelo: 'DOM38', ladoMotor: 'DERECHA' }),
    );
    expect(pasoCompleto(pasoPorId('accionamiento'), ctx)).toBe(true);
    const sinLado = ctxDe(ventLlena({}, { codCadena: '', motorModelo: 'DOM38' }));
    expect(faltantesPaso(pasoPorId('accionamiento'), sinLado)).toEqual(['lado del motor']);
  });

  it('la manilla solo pide color si se pidió alguna', () => {
    expect(pasoCompleto(pasoPorId('peso'), ctxDe(ventLlena({}, { manillaCant: 0 })))).toBe(true);
    expect(
      faltantesPaso(pasoPorId('peso'), ctxDe(ventLlena({}, { manillaCant: 2, manillaColor: '' }))),
    ).toEqual(['color de la manilla']);
  });

  it('el dúo pide la altura de cierre que se mide en terreno', () => {
    const ctx = ctxDe(ventLlena({ categoria: 'DUO_MANUAL_38mm' }), 'duo');
    expect(faltantesPaso(pasoPorId('peso'), ctx)).toEqual(['altura de cierre']);
    const conCierre = ctxDe(ventLlena({ categoria: 'DUO_MANUAL_38mm' }, { cierreAlturaCm: 4 }), 'duo');
    expect(pasoCompleto(pasoPorId('peso'), conCierre)).toBe(true);
  });

  it('«no lleva cenefa» también es una respuesta que completa el paso', () => {
    expect(pasoCompleto(pasoPorId('cenefa'), ctxDe(ventLlena({}, { cenefa: 'No' })))).toBe(true);
  });

  it('la cenefa ovalada pide tapa, bracket y tira', () => {
    const ctx = ctxDe(ventLlena({}, { cenefa: 'Ovalada' }));
    expect(faltantesPaso(pasoPorId('cenefa'), ctx)).toEqual([
      'color de tapa',
      'tipo de bracket',
      'tira de la cenefa',
    ]);
  });

  it('en dual la tela viaja en el paño, no en la ventana', () => {
    const sinTela = ctxDe(ventLlena({ categoria: 'ROL_DUAL', codInt: '' }), 'dual');
    expect(faltantesPaso(pasoPorId('tela'), sinTela)).toContain('tela');
    const conTela = ctxDe(ventLlena({ categoria: 'ROL_DUAL', codInt: '' }, { codInt: 'SC 64' }), 'dual');
    expect(pasoCompleto(pasoPorId('tela'), conTela)).toBe(true);
  });
});

describe('targetsProgreso — cómo se arma el dibujo', () => {
  it('una ventana en blanco no dibuja ninguna pieza', () => {
    const vacia = {
      id: 'v', ubicacion: '', categoria: 'ROL', codInt: '', color: '', alto: 0, cantidad: 1,
      panos: [{ ancho: '', alto: '', color: '' } as Pano],
    } as unknown as Ventana;
    const t = targetsProgreso(ctxDe(vacia));
    for (const pieza of PIEZAS_VIZ) expect(t[pieza]).toBe(0);
  });

  it('con todo lleno, la cortina queda armada y desplegada', () => {
    const t = targetsProgreso(ctxDe(ventLlena()));
    for (const pieza of PIEZAS_VIZ) expect(t[pieza]).toBe(1);
  });

  it('una pieza no se dibuja antes que aquello sobre lo que se monta', () => {
    // Sin soportes resueltos, el tubo no puede flotar aunque ya esté elegido.
    // Ojo: el color de accesorios cae al de la VENTANA, así que para dejarlo
    // vacío de verdad hay que vaciar los dos.
    const ctx = ctxDe(
      ventLlena(
        { color: '' },
        { colorMecanismo: '', colorCadena: '', colorPeso: '', color: '', materialTipo: '', superficie: '', relacionMarco: '' },
      ),
    );
    const t = targetsProgreso(ctx);
    expect(t.soportes).toBe(0);
    expect(t.tubo).toBe(0);
    expect(t.tela).toBe(0);
    expect(t.peso).toBe(0);
  });

  it('el peso no aparece antes que la tela', () => {
    const ctx = ctxDe(ventLlena({ codInt: '' }, { tipoTela: '' }));
    const t = targetsProgreso(ctx);
    expect(t.tela).toBe(0);
    expect(t.peso).toBe(0);
    // …pero el tubo y el mecanismo, que no dependen de la tela, sí.
    expect(t.tubo).toBe(1);
    expect(t.mecanismo).toBe(1);
  });

  it('la cortina baja recién cuando la tela, el peso y el accionamiento están', () => {
    const sinCadena = ctxDe(ventLlena({}, { codCadena: '', codPeso: '' }));
    expect(targetsProgreso(sinCadena).despliegue).toBe(0);
    expect(targetsProgreso(ctxDe(ventLlena())).despliegue).toBe(1);
  });

  it('un paso que no aplica no deja su pieza colgada a medias', () => {
    // Una categoría sin kit cuenta su mecanismo como listo, para que la tela y
    // el peso puedan armarse igual y la cortina llegue a bajar.
    const ctx = ctxDe(ventLlena({}, { mecanismo: '', codCadena: '', codPeso: '' }), 'roller', {
      reglas: SIN_KIT,
    });
    const t = targetsProgreso(ctx);
    expect(t.mecanismo).toBe(1);
    expect(t.accionamiento).toBe(1);
    expect(t.despliegue).toBe(1);
  });
});

describe('paridad con el gate de Fase 2', () => {
  it('si el wizard queda completo, la ventana NO bloquea el paso a Fase 3', () => {
    // Es la promesa del wizard: nunca pide menos que `pendientesFase2`.
    const v = ventLlena();
    const ctx = ctxDe(v);
    for (const p of pasosAplicables(ctx)) expect(pasoCompleto(p, ctx)).toBe(true);
    expect(pendientesFase2([v])).toEqual([]);
  });

  it('cada dato que el gate exige tiene un paso donde llenarlo', () => {
    // Se quita un campo a la vez: si el gate lo reclama, algún paso del wizard
    // tiene que estar pidiéndolo también.
    const quitables: { pano: Partial<Pano>; ventana?: Partial<Ventana> }[] = [
      { pano: { ancho: 0 } },
      { pano: { alto: 0 } },
      { pano: { mecanismo: '' } },
      { pano: { tuberia: '' } },
      { pano: { materialTipo: '' } },
      { pano: { codCadena: '' } },
      { pano: { codPeso: '' } },
      // El color cae al de la ventana: para que falte de verdad, los dos vacíos.
      {
        pano: { colorMecanismo: '', colorCadena: '', colorPeso: '', color: '' },
        ventana: { color: '' },
      },
    ];
    for (const { pano: over, ventana } of quitables) {
      const v = ventLlena(ventana ?? {}, over);
      const ctx = ctxDe(v);
      expect(pendientesFase2([v]).length, `el gate deja pasar ${JSON.stringify(over)}`).toBeGreaterThan(0);
      const incompletos = pasosAplicables(ctx).filter((p) => !pasoCompleto(p, ctx));
      expect(incompletos.length, `ningún paso pide ${JSON.stringify(over)}`).toBeGreaterThan(0);
    }
  });

  it('el wizard además pide cosas de terreno que el gate no mira', () => {
    // Superficie sin cenefa, corte y posición de cadena no bloquean la OT, pero
    // en terreno hay que preguntarlos igual.
    const v = ventLlena({}, { superficie: '', cortes: '', relacionMarco: '' });
    expect(pendientesFase2([v])).toEqual([]);
    const ctx = ctxDe(v);
    expect(pasoCompleto(pasoPorId('soportes'), ctx)).toBe(false);
    expect(pasoCompleto(pasoPorId('terreno'), ctx)).toBe(false);
  });
});

describe('pasoDePieza — el clic en el dibujo lleva a su paso', () => {
  it('cada pieza dibujada tiene su paso', () => {
    for (const pieza of PIEZAS_VIZ) expect(pasoDePieza(pieza)).not.toBeNull();
  });

  it('lleva al paso correcto', () => {
    expect(pasoDePieza('tubo')).toBe('tubo');
    expect(pasoDePieza('accionamiento')).toBe('accionamiento');
    expect(pasoDePieza('despliegue')).toBe('terreno');
  });
});
