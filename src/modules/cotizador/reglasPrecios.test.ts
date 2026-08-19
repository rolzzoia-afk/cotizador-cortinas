import { describe, it, expect } from 'vitest';
import {
  BASE_VERTICAL_PROPIA,
  FAMILIAS_BEEBLACK,
  GRUPOS_INSUMO,
  REGLAS_PRECIOS_DEFAULT,
  RECETAS_DEFAULT,
  claveReceta,
  conValoresMaximos,
  grupoDelInsumo,
  insumosParaFamilia,
  lamasPorPasada,
  explicarCantidad,
  normalizarReglasPrecios,
  resolverReceta,
  sistemaDeFamilia,
  sonReglasPreciosDefault,
  validarReglasPrecios,
  type LineaReceta,
  type ReglasPrecios,
} from './reglasPrecios';

const clonar = (r: ReglasPrecios): ReglasPrecios => JSON.parse(JSON.stringify(r));

describe('normalizarReglasPrecios', () => {
  it('sin nada guardado devuelve las reglas de fábrica', () => {
    expect(sonReglasPreciosDefault(normalizarReglasPrecios(undefined))).toBe(true);
    expect(sonReglasPreciosDefault(normalizarReglasPrecios(null))).toBe(true);
    expect(sonReglasPreciosDefault(normalizarReglasPrecios('cualquier cosa'))).toBe(true);
    expect(sonReglasPreciosDefault(normalizarReglasPrecios({}))).toBe(true);
  });

  it('una receta guardada REEMPLAZA la de su familia y no toca las demás', () => {
    const r = normalizarReglasPrecios({
      recetas: { SCREEN_P: [{ insumo: 'E 15', precio: 'venta', cantidad: { tipo: 'sumaAnchos' } }] },
    });
    expect(r.recetas.SCREEN_P).toHaveLength(1);
    expect(r.recetas.BLACKOUT_D).toEqual(RECETAS_DEFAULT.BLACKOUT_D);
  });

  it('repone el precio de fábrica de un insumo que una receta usa y el guardado no trae', () => {
    // Guardan un mapa de insumos con UNO solo; la receta de fábrica nombra muchos.
    const r = normalizarReglasPrecios({ insumos: { 'E 02': { valorMaximo: 5000 } } });
    expect(r.insumos['E 02'].valorMaximo).toBe(5000);
    // MEC 18 lo usa la receta roller: tiene que volver con su precio de fábrica.
    expect(r.insumos['MEC 18'].valorMaximo).toBe(REGLAS_PRECIOS_DEFAULT.insumos['MEC 18'].valorMaximo);
  });

  it('acepta un insumo guardado como número suelto (formato viejo)', () => {
    const r = normalizarReglasPrecios({ insumos: { 'E 05': 12345 } });
    expect(r.insumos['E 05'].valorMaximo).toBe(12345);
  });

  it('descarta líneas y valores corruptos sin romper el resto', () => {
    const r = normalizarReglasPrecios({
      insumos: { 'E 02': { valorMaximo: 'hola' }, ' E 05 ': { valorMaximo: 9 } },
      recetas: {
        SCREEN_P: [
          { insumo: '', precio: 'venta', cantidad: { tipo: 'porCortina' } },
          { insumo: 'E 15', precio: 'venta', cantidad: { tipo: 'inventado' } },
          { insumo: 'E 15', precio: 'venta', cantidad: { tipo: 'porCortina', factor: 2 } },
        ],
      },
      regalo: -50,
      anchoRolloFallbackM: 0,
    });
    expect(r.recetas.SCREEN_P).toEqual([
      { insumo: 'E 15', precio: 'venta', cantidad: { tipo: 'porCortina', factor: 2, filtroAncho: undefined } },
    ]);
    // El precio corrupto se descarta, pero como las recetas usan E 02 vuelve
    // con el valor de fábrica: nunca queda una línea cobrándose $0.
    expect(r.insumos['E 02'].valorMaximo).toBe(REGLAS_PRECIOS_DEFAULT.insumos['E 02'].valorMaximo);
    expect(r.insumos['E 05'].valorMaximo).toBe(9); // la clave venía con espacios
    expect(r.regalo).toBe(0);
    expect(r.anchoRolloFallbackM).toBe(REGLAS_PRECIOS_DEFAULT.anchoRolloFallbackM);
  });

  it('los arquetipos se mezclan por clave: lo guardado pisa, el resto queda de fábrica', () => {
    const r = normalizarReglasPrecios({ arquetipos: { SCREEN_P: 'SC-OTRO' } });
    expect(r.arquetipos.SCREEN_P).toBe('SC-OTRO');
    expect(r.arquetipos.BLACKOUT_D).toBe('BK-D');
  });
});

describe('validarReglasPrecios', () => {
  it('las reglas de fábrica no tienen errores', () => {
    expect(validarReglasPrecios(REGLAS_PRECIOS_DEFAULT).errores).toEqual([]);
  });

  it('un insumo que una receta nombra pero no tiene precio es un ERROR', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    delete r.insumos['MEC 18'];
    const { errores } = validarReglasPrecios(r);
    expect(errores.some((e) => e.includes('MEC 18') && e.includes('$0'))).toBe(true);
  });

  it('un precio en cero o negativo es un ERROR', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.insumos['E 02'] = { valorMaximo: 0 };
    expect(validarReglasPrecios(r).errores.some((e) => e.includes('E 02'))).toBe(true);
  });

  it('una familia sin materiales es un ERROR', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.recetas.SCREEN_P = [];
    expect(validarReglasPrecios(r).errores.some((e) => e.includes('sin materiales'))).toBe(true);
  });

  it('un tramo de anchos al revés es un ERROR', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.recetas.SCREEN_P = [
      { insumo: 'E 02', precio: 'venta', cantidad: { tipo: 'sumaAnchos', filtroAncho: { min: 3, max: 1 } } },
    ];
    expect(validarReglasPrecios(r).errores.some((e) => e.includes('al revés'))).toBe(true);
  });

  it('el hueco entre los dos tubos sale como AVISO, no como error', () => {
    const { errores, avisos } = validarReglasPrecios(REGLAS_PRECIOS_DEFAULT);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('hueco'))).toBe(true);
  });

  it('un insumo agregado a mano que nadie usa sale como AVISO', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.insumos['XXX 99'] = { valorMaximo: 1000 };
    expect(validarReglasPrecios(r).avisos.some((a) => a.includes('XXX 99'))).toBe(true);
  });

  it('las variantes de fábrica sin uso NO ensucian los avisos', () => {
    // Están en la lista para poder cambiarlas por la que usa la receta; que
    // ninguna receta las nombre es lo normal, no algo para revisar.
    const avisos = validarReglasPrecios(REGLAS_PRECIOS_DEFAULT).avisos;
    expect(avisos.some((a) => a.includes('ZUN 01'))).toBe(false);
    expect(avisos.some((a) => a.includes('ninguna familia lo usa'))).toBe(false);
  });

  it('dos variantes del mismo material con precios distintos salen como AVISO', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.insumos['ZUN 01'] = { valorMaximo: 999 };
    const { errores, avisos } = validarReglasPrecios(r);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('ZUN 06') && a.includes('ZUN 01'))).toBe(true);
  });
});

describe('tela de las verticales', () => {
  it('de fábrica se cobra por paños, como la planilla', () => {
    expect(REGLAS_PRECIOS_DEFAULT.telaVertical.modo).toBe('panos');
    expect(REGLAS_PRECIOS_DEFAULT.telaVertical.anchoRolloVerticalM).toBe(2.95);
  });

  it('lo guardado antes de que existiera el cobro por lamas queda en paños', () => {
    const viejo = clonar(REGLAS_PRECIOS_DEFAULT) as Record<string, unknown>;
    delete viejo.telaVertical;
    const r = normalizarReglasPrecios(viejo);
    expect(r.telaVertical).toEqual(REGLAS_PRECIOS_DEFAULT.telaVertical);
  });

  it('un modo desconocido o un número inválido caen en el valor de fábrica', () => {
    const r = normalizarReglasPrecios({
      telaVertical: { modo: 'inventado', anchoLamaM: 0, pasoLamaM: -1, anchoRolloVerticalM: 3.2 },
    });
    expect(r.telaVertical.modo).toBe('panos');
    expect(r.telaVertical.anchoLamaM).toBe(0.089);
    expect(r.telaVertical.pasoLamaM).toBe(0.08);
    expect(r.telaVertical.anchoRolloVerticalM).toBe(3.2); // este sí era válido
  });

  it('un rollo más angosto que una lama es un ERROR', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.telaVertical = { ...r.telaVertical, anchoRolloVerticalM: 0.05 };
    expect(validarReglasPrecios(r).errores.some((e) => e.includes('más angosto'))).toBe(true);
  });

  it('lamas montadas más separadas que su ancho sale como AVISO', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.telaVertical = { ...r.telaVertical, pasoLamaM: 0.12 };
    const { errores, avisos } = validarReglasPrecios(r);
    expect(errores).toEqual([]);
    expect(avisos.some((a) => a.includes('huecos'))).toBe(true);
  });

  it('una pasada del rollo de fábrica rinde 33 lamas', () => {
    expect(lamasPorPasada(REGLAS_PRECIOS_DEFAULT.telaVertical)).toBe(33);
  });

  it('la tela propia cubre las mismas familias que la del roller', () => {
    expect(Object.keys(BASE_VERTICAL_PROPIA).sort()).toEqual(
      Object.keys(REGLAS_PRECIOS_DEFAULT.baseVertical).sort(),
    );
  });
});

describe('la hoja Insumos completa', () => {
  const insumos = REGLAS_PRECIOS_DEFAULT.insumos;

  it('trae los 41 que usan las recetas más las variantes de la planilla', () => {
    // 41 con receta + 39 variantes/sueltos = los 80 que se pueden elegir.
    expect(Object.keys(insumos).length).toBe(80);
  });

  it('cada variante cobra lo mismo que el material del que es alternativa', () => {
    for (const [representante, variantes] of Object.entries(GRUPOS_INSUMO)) {
      for (const cod of variantes) {
        expect(insumos[cod]?.valorMaximo).toBe(insumos[representante].valorMaximo);
      }
    }
  });

  it('todos los códigos nuevos traen descripción', () => {
    for (const [cod, ins] of Object.entries(insumos)) {
      expect(ins.descripcion, `${cod} sin descripción`).toBeTruthy();
    }
  });

  it('los dos materiales sueltos de la planilla traen su propio precio', () => {
    expect(insumos['TAP 13'].valorMaximo).toBe(142.8);
    expect(insumos.MER0014.valorMaximo).toBe(59.5);
  });

  it('grupoDelInsumo responde igual desde el representante que desde la variante', () => {
    const desdeArriba = grupoDelInsumo('ZUN 06');
    expect(desdeArriba).toContain('ZUN 03');
    expect(grupoDelInsumo('ZUN 03')).toEqual(desdeArriba);
    expect(grupoDelInsumo('MAT00001')).toEqual([]); // no comparte con nadie
  });
});

describe('explicarCantidad — la regla contada en castellano', () => {
  const casos: [LineaReceta['cantidad'], string][] = [
    [{ tipo: 'porCortina' }, '1 por cada cortina'],
    [{ tipo: 'porCortina', factor: 2 }, '2 por cada cortina'],
    [{ tipo: 'porCortina', factor: 2, filtroAncho: { min: 2.2 } }, '2 por cada cortina de 2,2 m de ancho o más'],
    [{ tipo: 'sumaAnchos' }, 'suma de los anchos de las cortinas'],
    [{ tipo: 'sumaAnchos', factor: 2 }, 'suma de los anchos de las cortinas × 2'],
    [{ tipo: 'sumaAnchos', filtroAncho: { max: 2.19 } }, 'suma de los anchos de las cortinas de hasta 2,19 m de ancho'],
    [{ tipo: 'sumaAnchos', masFijoM: 0.2 }, 'suma de los anchos de las cortinas, más 0,2 m fijos'],
    [{ tipo: 'sumaAltos', factor: 5 }, 'suma de los altos vendidos × 5'],
    [{ tipo: 'fijo', cantidad: 4 }, '4 por familia, sin importar cuántas cortinas'],
    [{ tipo: 'porCortinaCuadrado', factor: 2 }, 'cantidad de cortinas al cuadrado × 2'],
    [{ tipo: 'lamas' }, 'lamas de la cortina: suma de anchos ÷ 0,08 m (paso de lama)'],
  ];
  for (const [cantidad, esperado] of casos) {
    it(`${cantidad.tipo} → «${esperado}»`, () => {
      expect(explicarCantidad(cantidad)).toBe(esperado);
    });
  }

  it('las lamas se explican con el paso vigente, no con el de fábrica', () => {
    expect(explicarCantidad({ tipo: 'lamas' }, 0.1)).toContain('÷ 0,1 m');
  });

  it('cada línea de cada receta de fábrica se puede explicar', () => {
    for (const lineas of Object.values(RECETAS_DEFAULT)) {
      for (const l of lineas) expect(explicarCantidad(l.cantidad).length).toBeGreaterThan(3);
    }
  });
});

describe('conValoresMaximos', () => {
  it('cambia solo los precios pedidos y conserva el resto', () => {
    const r = conValoresMaximos({ 'E 02': 1 });
    expect(r.insumos['E 02'].valorMaximo).toBe(1);
    expect(r.insumos['E 05'].valorMaximo).toBe(REGLAS_PRECIOS_DEFAULT.insumos['E 05'].valorMaximo);
    expect(r.recetas).toBe(REGLAS_PRECIOS_DEFAULT.recetas);
  });
});

describe('resolverReceta', () => {
  it('cada familia conocida usa la suya', () => {
    expect(resolverReceta('DUOBK_P', false)).toBe(RECETAS_DEFAULT.DUOBK_P);
    expect(resolverReceta('SCREEN_S', false)).toBe(RECETAS_DEFAULT.SCREEN_S);
  });

  it('una familia desconocida cae en la de su gama', () => {
    expect(resolverReceta('FOO_S', false)).toBe(RECETAS_DEFAULT.BLACKOUT_S);
    expect(resolverReceta('SCREENX_S', false)).toBe(RECETAS_DEFAULT.SCREEN_S);
    expect(resolverReceta('FOO_P', false)).toBe(RECETAS_DEFAULT.BLACKOUT_P);
  });
});

describe('claveReceta — el nombre de la receta que se termina usando', () => {
  const CODS = [
    'BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S', 'SCREEN_P', 'SCREEN_D', 'SCREEN_S',
    'DUOBK_P', 'DUOBK_D', 'DUOBK_S', 'DUOPOLI_P', 'DUOPOLI_D', 'DUOPOLI_S',
    'FOO_P', 'FOO_S', 'SCREENX_S', 'DUO_X', 'BEEBLACK', '',
  ];

  it('nombra exactamente la receta que devuelve resolverReceta', () => {
    for (const cod of CODS) {
      for (const esVertical of [false, true]) {
        expect(RECETAS_DEFAULT[claveReceta(cod, esVertical)]).toBe(resolverReceta(cod, esVertical));
      }
    }
  });

  it('la familia con receta propia se nombra a sí misma; la desconocida no', () => {
    expect(claveReceta('DUOPOLI_D', false)).toBe('DUOPOLI_D');
    expect(claveReceta('DUO_X', false)).toBe('DUO_GENERICO');
    expect(claveReceta('BEEBLACK', false)).toBe('BLACKOUT_P');
    expect(claveReceta('BLACKOUT_D', true)).toBe('VERTICAL');
  });

  it('las tres familias beeblack tienen receta propia', () => {
    for (const fam of FAMILIAS_BEEBLACK) {
      expect(claveReceta(fam, false)).toBe(fam);
      expect(RECETAS_DEFAULT[fam]).toBeDefined();
    }
  });
});

describe('sistemas con reglas propias (beeblack)', () => {
  const bb = REGLAS_PRECIOS_DEFAULT.sistemas.beeblack;

  it('trae los números de la copia beeblack del Excel', () => {
    expect(bb.margenInsumo).toBe(0.6);
    expect(bb.extraAltoM).toBe(1);
    expect(bb.manoObra).toBe(83300);
    expect(bb.traslado).toBe(47600);
    // Los dos valores de instalación son distintos a propósito.
    expect(bb.instalacionEmbebida).toBe(41650);
    expect(bb.instalacionLinea).toBe(35000);
  });

  it('sistemaDeFamilia encuentra las beeblack y deja fuera al resto', () => {
    for (const fam of FAMILIAS_BEEBLACK) {
      expect(sistemaDeFamilia(fam)?.nombre).toBe('Beeblack');
    }
    expect(sistemaDeFamilia('BLACKOUT_P')).toBeUndefined();
    expect(sistemaDeFamilia('VERTICAL')).toBeUndefined();
  });

  it('sus precios de insumo PISAN a los generales', () => {
    // PUB 01 y MAT00001 existen en las dos listas con valores distintos.
    expect(REGLAS_PRECIOS_DEFAULT.insumos['PUB 01'].valorMaximo).toBe(1400);
    expect(bb.insumos['PUB 01'].valorMaximo).toBe(3076.8);
    const paraBb = insumosParaFamilia('BEE_BK', REGLAS_PRECIOS_DEFAULT);
    expect(paraBb['PUB 01'].valorMaximo).toBe(3076.8);
    expect(paraBb.MAT00001.valorMaximo).toBe(30768);
    // Un insumo que solo está en la lista general sigue disponible.
    expect(paraBb['E 02'].valorMaximo).toBe(REGLAS_PRECIOS_DEFAULT.insumos['E 02'].valorMaximo);
    // Una familia sin sistema no ve los precios beeblack.
    const paraRoller = insumosParaFamilia('BLACKOUT_P', REGLAS_PRECIOS_DEFAULT);
    expect(paraRoller['PUB 01'].valorMaximo).toBe(1400);
    expect(paraRoller.SLM01).toBeUndefined();
  });

  it('las variantes de color comparten precio con su representante', () => {
    expect(bb.insumos.SLM02.valorMaximo).toBe(bb.insumos.SLM01.valorMaximo);
    expect(bb.insumos.SML36.valorMaximo).toBe(bb.insumos.SML35.valorMaximo);
    expect(grupoDelInsumo('SLM02')).toEqual(['SLM01', 'SLM02', 'SLM03']);
  });

  it('el riel cobra ancho×2 y alto×2; el zuncho conserva el ×16 del Excel', () => {
    const receta = RECETAS_DEFAULT.BEE_BK;
    const rieles = receta.filter((l) => l.insumo === 'SLM01');
    // Los 4 perfiles del mismo riel: arriba/abajo por ancho, costados por
    // alto. La copia canónica (COTAP-8003, decisión del 2026-08-19) cobra así;
    // otras copias tienen la fila «ALTO» rota (copia el total de la de ancho).
    expect(rieles).toHaveLength(2);
    expect(rieles[0].cantidad).toEqual({ tipo: 'sumaAnchos', factor: 2 });
    expect(rieles[1].cantidad).toEqual({ tipo: 'sumaAltos', factor: 2 });
    // El zuncho lleva el x4 dos veces: ese error SÍ está en la copia canónica
    // y se replica a propósito.
    const zuncho = receta.find((l) => l.insumo === 'SML38');
    expect(zuncho?.cantidad).toEqual({ tipo: 'sumaAltos', factor: 16 });
    // Las tres telas comparten la misma lista.
    expect(RECETAS_DEFAULT.BEE_MOSQ).toBe(receta);
    expect(RECETAS_DEFAULT.BEE_TRAS).toBe(receta);
  });

  it('lo guardado completa campo por campo contra el de fábrica', () => {
    const r = normalizarReglasPrecios({
      sistemas: { beeblack: { manoObra: 90000 } },
    });
    expect(r.sistemas.beeblack.manoObra).toBe(90000);
    // Lo que no venía guardado queda como de fábrica.
    expect(r.sistemas.beeblack.margenInsumo).toBe(0.6);
    expect(r.sistemas.beeblack.familias).toEqual([...FAMILIAS_BEEBLACK]);
    expect(r.sistemas.beeblack.insumos.SLM01.valorMaximo).toBe(24999);
  });

  it('acepta un sistema inventado por la empresa', () => {
    const r = normalizarReglasPrecios({
      sistemas: { toldos: { nombre: 'Toldos', familias: ['TOLDO_P'], manoObra: 50000 } },
    });
    expect(r.sistemas.toldos.nombre).toBe('Toldos');
    expect(r.sistemas.toldos.manoObra).toBe(50000);
    // Sin margen guardado cae al del roller, no a cero.
    expect(r.sistemas.toldos.margenInsumo).toBe(0.65);
    // Y el beeblack de fábrica sigue ahí.
    expect(r.sistemas.beeblack.manoObra).toBe(83300);
  });

  it('valida los números del sistema', () => {
    const malo = clonar(REGLAS_PRECIOS_DEFAULT);
    malo.sistemas.beeblack.margenInsumo = 0;
    malo.sistemas.beeblack.manoObra = -1;
    const { errores } = validarReglasPrecios(malo);
    expect(errores.some((e) => e.includes('margen'))).toBe(true);
    expect(errores.some((e) => e.includes('mano de obra'))).toBe(true);
  });

  it('una receta de sistema no exige que su insumo esté en la lista general', () => {
    // SLM01 solo vive en la tabla del beeblack: no puede dar error.
    const { errores } = validarReglasPrecios(REGLAS_PRECIOS_DEFAULT);
    expect(errores).toEqual([]);
    // Pero si se le borra de las dos, sí.
    const sinRiel = clonar(REGLAS_PRECIOS_DEFAULT);
    delete sinRiel.sistemas.beeblack.insumos.SLM01;
    expect(validarReglasPrecios(sinRiel).errores.some((e) => e.includes('SLM01'))).toBe(true);
  });

  it('reponer insumos de fábrica respeta la tabla del sistema', () => {
    // Se guarda una lista general mínima; las líneas beeblack se cobran con la
    // tabla del sistema, así que SLM01 no debe colarse a la lista general.
    const r = normalizarReglasPrecios({ insumos: { 'E 02': 4462.5 } });
    expect(r.insumos.SLM01).toBeUndefined();
    expect(r.sistemas.beeblack.insumos.SLM01.valorMaximo).toBe(24999);
    // Y un insumo de receta roller sí se repone.
    expect(r.insumos['MEC 18']).toBeDefined();
  });
});

describe('tela de referencia vacía = la más cara de la familia', () => {
  it('las beeblack vienen sin código y las roller con el suyo', () => {
    for (const fam of FAMILIAS_BEEBLACK) {
      expect(REGLAS_PRECIOS_DEFAULT.arquetipos[fam]).toBe('');
    }
    expect(REGLAS_PRECIOS_DEFAULT.arquetipos.BLACKOUT_P).toBe('BK-P');
  });

  it('el vacío no es un error de validación en las beeblack, pero sí en las roller', () => {
    expect(validarReglasPrecios(REGLAS_PRECIOS_DEFAULT).errores).toEqual([]);
    const sinTela = clonar(REGLAS_PRECIOS_DEFAULT);
    sinTela.arquetipos.BLACKOUT_P = '';
    expect(validarReglasPrecios(sinTela).errores.some((e) => e.includes('BLACKOUT_P'))).toBe(true);
  });

  it('se puede fijar un código y volver a dejarlo vacío', () => {
    const fijado = normalizarReglasPrecios({ arquetipos: { BEE_BK: 'BEE-BK' } });
    expect(fijado.arquetipos.BEE_BK).toBe('BEE-BK');
    const vuelto = normalizarReglasPrecios({ arquetipos: { BEE_BK: '' } });
    expect(vuelto.arquetipos.BEE_BK).toBe('');
  });

  // Antes el vacío solo se respetaba donde el default ya era vacío, así que
  // borrar el código de una roller o de una vertical era un no-op silencioso:
  // se guardaba y al recargar reaparecía el valor anterior.
  it('el vacío se guarda en CUALQUIER familia, aunque el default traiga código', () => {
    expect(normalizarReglasPrecios({ arquetipos: { BLACKOUT_P: '' } }).arquetipos.BLACKOUT_P).toBe('');
    expect(
      normalizarReglasPrecios({ baseVertical: { BLACKOUT_V_D: '' } }).baseVertical.BLACKOUT_V_D,
    ).toBe('');
  });

  it('vaciar una roller sí es un error de validación (ahí el vacío no es una regla)', () => {
    const vacia = normalizarReglasPrecios({ arquetipos: { BLACKOUT_P: '' } });
    expect(validarReglasPrecios(vacia).errores.some((e) => e.includes('BLACKOUT_P'))).toBe(true);
  });
});

describe('validación de sistemas y verticales', () => {
  it('dos sistemas con el mismo nombre son un error (se fundirían en la instalación)', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.sistemas.otro = { ...r.sistemas.beeblack, familias: ['OTRA_FAM'] };
    const e = validarReglasPrecios(r).errores.join(' ');
    expect(e).toContain('se llaman igual');
  });

  it('una familia en dos sistemas a la vez es un error', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.sistemas.otro = { ...r.sistemas.beeblack, nombre: 'Otro', familias: ['BEE_BK'] };
    expect(validarReglasPrecios(r).errores.some((x) => x.includes('dos sistemas'))).toBe(true);
  });

  it('sacar un insumo de la tabla del sistema avisa que pasa a cobrar el precio general', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    delete r.sistemas.beeblack.insumos['PUB 01'];
    const av = validarReglasPrecios(r).avisos.join(' ');
    expect(av).toContain('PUB 01');
    expect(av).toContain('valor general');
    // Y NO es un error: la receta igual encuentra el precio global.
    expect(validarReglasPrecios(r).errores.some((x) => x.includes('PUB 01'))).toBe(false);
  });

  it('una familia vertical sin base es un error', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    delete (r.baseVertical as Record<string, string>).SCREEN_V_P;
    expect(validarReglasPrecios(r).errores.some((x) => x.includes('SCREEN_V_P'))).toBe(true);
  });

  it('cobrar por lamas con la tela del roller avisa (pero no bloquea)', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.telaVertical = { ...r.telaVertical, modo: 'lamas' };
    const v = validarReglasPrecios(r);
    expect(v.errores).toEqual([]);
    expect(v.avisos.join(' ')).toContain('la tela del roller');
  });

  it('con la tela propia de cada vertical, el aviso desaparece', () => {
    const r = clonar(REGLAS_PRECIOS_DEFAULT);
    r.telaVertical = { ...r.telaVertical, modo: 'lamas' };
    r.baseVertical = { ...BASE_VERTICAL_PROPIA };
    expect(validarReglasPrecios(r).avisos.join(' ')).not.toContain('la tela del roller');
  });

  it('las reglas de fábrica no tienen errores ni avisos de sistema', () => {
    expect(validarReglasPrecios(REGLAS_PRECIOS_DEFAULT).errores).toEqual([]);
  });
});
