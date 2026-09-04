import { describe, expect, it } from 'vitest';
import {
  anunciosDelPaso,
  camposDelPaso,
  campoPorEtiqueta,
  opcionUnicaAutomatica,
  proximoCampo,
  type CtxVoz,
} from './voz';
import { CENEFA_OVALADA_SISTEMA } from './parches';
import type { VarianteViz } from './cortinaViz';
import type { CatalogoProductos, Pano, Ventana } from '../types';

const pano = (over: Partial<Pano> = {}): Pano =>
  ({ ancho: 0, alto: 0, color: '', ...over }) as unknown as Pano;

const ventana = (over: Partial<Ventana> = {}, p: Partial<Pano> = {}): Ventana =>
  ({
    id: 'v1',
    ubicacion: '',
    categoria: 'ROL',
    codInt: '',
    color: '',
    alto: 0,
    cantidad: 1,
    panos: [pano(p)],
    ...over,
  }) as unknown as Ventana;

const ctxDe = (v: Ventana, variante: VarianteViz = 'roller', extra: Partial<CtxVoz> = {}): CtxVoz => ({
  ventana: v,
  pano: v.panos[0],
  panoIdx: 0,
  variante,
  ...extra,
});

const claves = (ids: ReturnType<typeof camposDelPaso>) => ids.map((c) => c.clave);

describe('proximoCampo', () => {
  it('en una ficha en blanco lo primero es la ubicación', () => {
    expect(proximoCampo('medidas', ctxDe(ventana()))?.clave).toBe('ventana.ubicacion');
  });

  it('salta lo que ya está lleno', () => {
    const v = ventana({ ubicacion: 'LIVING' }, { ancho: 1.5 });
    expect(proximoCampo('medidas', ctxDe(v))?.clave).toBe('pano.alto');
  });

  it('no vuelve a preguntar lo que ya se atendió', () => {
    const v = ventana({ categoria: '' });
    const atendidos = new Set(['ventana.ubicacion']);
    expect(proximoCampo('medidas', ctxDe(v), atendidos)?.clave).toBe('ventana.categoria');
  });

  it('cuando no falta nada, no hay próximo campo', () => {
    const v = ventana(
      { ubicacion: 'LIVING', categoria: 'ROL', cantidad: 1 },
      { ancho: 1.5, alto: 2, armado: 'Interno' },
    );
    expect(proximoCampo('medidas', ctxDe(v))).toBe(null);
  });
});

describe('campos por paso', () => {
  it('el beeblack pide su variante', () => {
    const v = ventana({ categoria: 'BEEBLACK' });
    expect(claves(camposDelPaso('medidas', ctxDe(v, 'beeblack')))).toContain(
      'pano.beeblackVariante',
    );
  });

  it('sin beeblack no se pregunta la variante', () => {
    expect(claves(camposDelPaso('medidas', ctxDe(ventana())))).not.toContain(
      'pano.beeblackVariante',
    );
  });

  it('la dual pregunta el lado del mecanismo', () => {
    const v = ventana({ categoria: 'DUAL' });
    expect(claves(camposDelPaso('mecanismo', ctxDe(v, 'dual')))).toEqual([
      'pano.mecanismo',
      'pano.dualLado',
    ]);
  });

  it('lo primero que se pregunta es cadena o motor', () => {
    const v = ventana();
    expect(proximoCampo('accionamiento', ctxDe(v))?.clave).toBe('pano.acciona');
  });

  it('elegida la cadena, ya no se pregunta cadena o motor', () => {
    const ctx = ctxDe(ventana({}, { codCadena: 'CAD03' }));
    const campos = camposDelPaso('accionamiento', ctx);
    expect(campos.find((c) => c.clave === 'pano.acciona')?.estaVacio(ctx)).toBe(false);
    expect(proximoCampo('accionamiento', ctx)?.clave).toBe('pano.cierreVert');
  });

  it('respondido «con cadena», la conversación sigue con la cadena misma', () => {
    // El paso NO puede quedarse en una sola pregunta: al marcar «cadena» hay
    // que seguir con cuál, de qué lado y con qué peso.
    const ctx = ctxDe(ventana());
    const atendidos = new Set(['pano.acciona']);
    expect(proximoCampo('accionamiento', ctx, atendidos)?.clave).toBe('pano.codCadena');
  });

  it('con motor puesto se pregunta el modelo y su lado', () => {
    const v = ventana({}, { motorModelo: 'DOM41' });
    expect(claves(camposDelPaso('accionamiento', ctxDe(v)))).toEqual([
      'pano.motorModelo',
      'pano.ladoMotor',
      'pano.motorCargador',
      'pano.motorControlAdicCant',
      'pano.motorHubUsbCant',
    ]);
  });

  it('los motores pequeños se dictan, y el cargador que ofrecen es su DOM51', () => {
    // El dictado no puede ofrecer un hub que la pantalla no tiene: las dos
    // leen `opcionesCargadorMotor`.
    const v = ventana({}, { motorModelo: 'DOM48' });
    const ctx = ctxDe(v);
    const campos = camposDelPaso('accionamiento', ctx);
    const modelo = campos.find((c) => c.clave === 'pano.motorModelo');
    const valores = modelo?.opciones?.(ctx)?.map((o) => o.value) ?? [];
    expect(valores).toContain('DOM48');
    expect(valores).toContain('DOM38'); // los de siempre siguen ahí: conviven
    const cargador = campos.find((c) => c.clave === 'pano.motorCargador');
    expect(cargador?.opciones?.(ctx)?.map((o) => o.value)).toEqual(['NINGUNO', 'DOM51', 'DOM33']);
  });

  it('el MEC 06 trae la cadena incorporada: no se pregunta ninguna', () => {
    const v = ventana({}, { mecanismo: 'SINFLEX [MEC 06]' });
    const ctx = ctxDe(v);
    const cadena = camposDelPaso('accionamiento', ctx).find((c) => c.clave === 'pano.codCadena');
    expect(cadena?.estaVacio(ctx)).toBe(false);
  });

  it('la vertical solo pregunta su cierre', () => {
    const v = ventana({ categoria: 'VERTICAL' });
    expect(claves(camposDelPaso('accionamiento', ctxDe(v, 'vertical')))).toEqual(['pano.cierreVert']);
  });

  it('el beeblack pregunta hacia dónde corre el acordeón', () => {
    const v = ventana({ categoria: 'BEEBLACK' });
    expect(claves(camposDelPaso('accionamiento', ctxDe(v, 'beeblack')))).toEqual([
      'ventana.direccion',
    ]);
  });

  it('la dúo pregunta la altura de cierre', () => {
    const v = ventana({ categoria: 'DUO' });
    expect(claves(camposDelPaso('peso', ctxDe(v, 'duo')))).toContain('pano.cierreAlturaCm');
  });

  it('el color de la manilla solo se pide si hay manillas', () => {
    const sin = ctxDe(ventana({}, { manillaCant: 0 }));
    expect(claves(camposDelPaso('peso', sin))).not.toContain('pano.manillaColor');
    const con = ctxDe(ventana({}, { manillaCant: 2 }));
    expect(claves(camposDelPaso('peso', con))).toContain('pano.manillaColor');
  });

  it('el modelo se anuncia LEGIBLE, no como objeto', () => {
    // `ventana.modelo` es un ModeloDespiece, no un texto: leerlo a secas decía
    // «el modelo quedó en [object Object]».
    const v = ventana({
      modelo: { tipo_rol: 'ROL_SIMPLE', diametro_tubo_mm: 38 },
    } as unknown as Partial<Ventana>);
    const dicho = anunciosDelPaso('medidas', ctxDe(v))[0];
    expect(dicho).not.toContain('[object');
    expect(dicho).toContain('ROL SIMPLE');
    expect(dicho).toContain('38');
  });

  it('sin modelo todavía no se anuncia nada', () => {
    expect(anunciosDelPaso('medidas', ctxDe(ventana()))).toEqual([]);
  });

  it('los perfiles no se dictan: se avisa que van a mano', () => {
    const ctx = ctxDe(ventana());
    expect(camposDelPaso('perfiles', ctx)).toEqual([]);
    expect(anunciosDelPaso('perfiles', ctx)[0]).toMatch(/a mano/i);
  });

  it('el resumen no pregunta nada', () => {
    expect(camposDelPaso('resumen', ctxDe(ventana()))).toEqual([]);
  });
});

describe('la tela', () => {
  const catalogo = {
    'BK 10': { producto: 'BLACKOUT BLANCO', tipo: 'PREMIUM', cod: 'BLACKOUT' },
  } as unknown as CatalogoProductos;

  it('fuera de dual la tela es de la ventana', () => {
    const v = ventana();
    const ctx = ctxDe(v, 'roller', { catalogo });
    const campo = camposDelPaso('tela', ctx)[0];
    expect(campo.estaVacio(ctx)).toBe(true);
    const accion = campo.aplicar('BK 10', ctx);
    expect(accion.ventana?.codInt).toBe('BK 10');
    expect(accion.pano?.tipoTela).toBe('BK');
  });

  it('en dual el paño 2 pide su propia tela aunque la ventana ya tenga una', () => {
    const v = ventana({ codInt: 'BK 10' });
    const ctx: CtxVoz = { ...ctxDe(v, 'dual', { catalogo }), panoIdx: 1 };
    const campo = camposDelPaso('tela', ctx)[0];
    expect(campo.estaVacio(ctx)).toBe(true);
    expect(campo.aplicar('BK 10', ctx).pano?.codInt).toBe('BK 10');
    expect(campo.aplicar('BK 10', ctx).ventana).toBeUndefined();
  });
});

describe('la cenefa', () => {
  it('el DARK no pregunta nada: va cuadrada por sistema', () => {
    const v = ventana({ categoria: 'DARK_38mm' });
    const ctx = ctxDe(v, 'oscuridad');
    expect(camposDelPaso('cenefa', ctx)).toEqual([]);
    expect(anunciosDelPaso('cenefa', ctx)[0]).toMatch(/por sistema/i);
  });

  it('el soft light elige entre su ovalada y la cuadrada', () => {
    const v = ventana({ categoria: 'SOFT_LIGHT_38mm' });
    const ctx = ctxDe(v, 'oscuridad');
    const campos = camposDelPaso('cenefa', ctx);
    expect(claves(campos)).toEqual(['pano.cenefa']);
    // Elegir «la del sistema» deja el campo vacío a propósito.
    expect(campos[0].aplicar(CENEFA_OVALADA_SISTEMA, ctx).pano?.cenefa).toBe('');
  });

  it('la ovalada del roller pide tira, color de tapa y bracket', () => {
    const v = ventana({}, { cenefa: 'Ovalada' });
    expect(claves(camposDelPaso('cenefa', ctxDe(v)))).toEqual([
      'pano.cenefa',
      'pano.cenefaTira',
      'pano.colorTapa',
      'pano.bracketTipo',
    ]);
  });

  it('en categoría B la tira no se pregunta', () => {
    const v = ventana({}, { cenefa: 'Ovalada' });
    expect(claves(camposDelPaso('cenefa', ctxDe(v, 'roller', { lineaB: true })))).not.toContain(
      'pano.cenefaTira',
    );
  });

  it('la cuadrada del roller pide tapas y color', () => {
    const v = ventana({}, { cenefa: 'Cuadrada a muro' });
    expect(claves(camposDelPaso('cenefa', ctxDe(v)))).toEqual([
      'pano.cenefa',
      'pano.cenefaTapa',
      'pano.colorTapa',
    ]);
  });

  it('la vertical SÍ ofrece «No lleva»: su cenefa es opcional, y la ovalada no aplica', () => {
    // Hubo una regla que la forzaba a cenefa cuadrada. Era incorrecta: la que
    // lleva cenefa sí o sí es la dúo (abajo).
    const v = ventana({ categoria: 'VERTICAL' });
    const ctx = ctxDe(v, 'vertical');
    const campo = camposDelPaso('cenefa', ctx)[0];
    expect(campo.opciones?.(ctx).map((o) => o.value)).toEqual([
      'No',
      'Cuadrada a muro',
      'Cuadrada a techo',
    ]);
  });

  it('a la dúo no se le pregunta el tipo: la ovalada va por sistema y es obligatoria', () => {
    // Antes la condición estaba al revés: dejaba de preguntar mientras el dato
    // NO fuera «Ovalada» y volvía a preguntar cuando ya lo era, así que se le
    // podía dictar «no lleva» a una dúo.
    const conDato = (cenefa: string) =>
      claves(camposDelPaso('cenefa', ctxDe(ventana({ categoria: 'DUO_MANUAL_38mm' }, { cenefa }))));
    expect(conDato('')).not.toContain('pano.cenefa');
    expect(conDato('Ovalada')).not.toContain('pano.cenefa');
    expect(conDato('Cuadrada a muro')).not.toContain('pano.cenefa');
  });

  it('una roller que eligió la ovalada a mano SÍ puede cambiarla', () => {
    const v = ventana({ categoria: 'ROL' }, { cenefa: 'Ovalada' });
    const ctx = ctxDe(v);
    expect(claves(camposDelPaso('cenefa', ctx))).toContain('pano.cenefa');
    const campo = camposDelPaso('cenefa', ctx)[0];
    expect(campo.opciones?.(ctx).map((o) => o.value)).toEqual([
      'No',
      'Ovalada',
      'Cuadrada a muro',
      'Cuadrada a techo',
    ]);
  });
});

describe('opcionUnicaAutomatica', () => {
  it('con una sola tubería posible no se pregunta', () => {
    const ctx = ctxDe(ventana(), 'roller', { opcionesTuberia: ['38mm [E02]'] });
    const campo = camposDelPaso('tubo', ctx)[0];
    expect(opcionUnicaAutomatica(campo, ctx)?.value).toBe('38mm [E02]');
  });

  it('con dos opciones sí se pregunta', () => {
    const ctx = ctxDe(ventana(), 'roller', { opcionesTuberia: ['38mm [E02]', '45mm [E39]'] });
    expect(opcionUnicaAutomatica(camposDelPaso('tubo', ctx)[0], ctx)).toBe(null);
  });
});

describe('campoPorEtiqueta', () => {
  it('«corregir ancho» encuentra el ancho', () => {
    const ctx = ctxDe(ventana());
    expect(campoPorEtiqueta('medidas', ctx, 'ancho')?.clave).toBe('pano.ancho');
  });

  it('«posición de la cadena» se encuentra aunque lo dicho venga sin tilde', () => {
    // El comando entrega el texto normalizado («posicion…») y la etiqueta
    // lleva tilde: sin normalizar los DOS lados, contestaba «no encontré ese
    // campo» a un pedido perfectamente claro.
    const ctx = ctxDe(ventana({}, { codCadena: 'CAD03' }));
    expect(campoPorEtiqueta('accionamiento', ctx, 'la posicion de la cadena')?.clave).toBe(
      'pano.cierreVert',
    );
    expect(campoPorEtiqueta('accionamiento', ctx, 'posición de la cadena')?.clave).toBe(
      'pano.cierreVert',
    );
  });

  it('con una palabra con peso alcanza: «corregir la posición»', () => {
    const ctx = ctxDe(ventana({}, { codCadena: 'CAD03' }));
    expect(campoPorEtiqueta('accionamiento', ctx, 'la posicion')?.clave).toBe('pano.cierreVert');
  });

  it('«el tipo de cortina» también', () => {
    const ctx = ctxDe(ventana());
    expect(campoPorEtiqueta('medidas', ctx, 'el tipo de cortina')?.clave).toBe('ventana.categoria');
  });

  it('lo que no es un campo devuelve null', () => {
    expect(campoPorEtiqueta('medidas', ctxDe(ventana()), 'la luna')).toBe(null);
  });
});
