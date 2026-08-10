// El banco de pruebas de Admin: verifica que lo que muestra sea EXACTAMENTE lo
// que produce el motor, y que reaccione a la configuración guardada (fórmulas
// editadas, tipos propios, colores nuevos). Si estos tests pasan, lo que se ve
// en el banco es lo que va a salir en producción.
import { describe, expect, it } from 'vitest';
import { resolverCortinaDePrueba } from './probadorCortina';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import { REGLAS_SELECCION_DEFAULT } from '@/modules/descuentos/reglasSeleccion';
import { FORMULAS_DEFAULT } from '@/modules/descuentos/formulasFamilias';
import { COLORES_BUILTIN, type ColorAccesorio } from '@/modules/descuentos/coloresAccesorio';
import { REGLAS_MECANISMO } from '@/modules/descuentos/reglas-mecanismo';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';
import type { CadenaInsumo } from './cadenas';

const modelo = (over: Partial<ModeloDespiece>): ModeloDespiece => ({
  sistema: '',
  tipo_rol: '',
  mecanismo: '',
  codigos_tubo: '',
  diametro_tubo_mm: 0,
  dcto_tubo_cm: 0,
  dcto_tela_cm: 0,
  suma_peso_cm: 0,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 99,
  activo: true,
  notas: '',
  ...over,
});

const CATALOGO: ModeloDespiece[] = [
  modelo({
    sistema: 'ROLLER_SIMPLE',
    tipo_rol: 'MANUAL_38',
    mecanismo: 'MEC_33_ROLLER_BLANCO',
    diametro_tubo_mm: 38,
    dcto_tubo_cm: 3.8,
    dcto_tela_cm: 0.5,
    suma_peso_cm: 0.1,
  }),
  modelo({
    sistema: 'ROLLER_SIMPLE',
    tipo_rol: 'MANUAL_38',
    mecanismo: 'MEC_32_ROLLER_NEGRO',
    diametro_tubo_mm: 38,
    dcto_tubo_cm: 3.8,
    dcto_tela_cm: 0.5,
    suma_peso_cm: 0.1,
  }),
  modelo({ sistema: 'DARK_ROLLER', tipo_rol: 'DARK_38mm', diametro_tubo_mm: 38 }),
  modelo({ sistema: 'OSCURANTI', tipo_rol: 'OSCURANTI_63mm', diametro_tubo_mm: 63 }),
];

const medida = (r: { cortes: Array<{ componente: string; medidaCm: number }> }, comp: string) =>
  r.cortes.find((c) => c.componente === comp)?.medidaCm;
const codigo = (r: { cortes: Array<{ componente: string; cod: string }> }, comp: string) =>
  r.cortes.find((c) => c.componente === comp)?.cod;

const CADENAS: CadenaInsumo[] = [
  { cod: 'CAD03', nemotecnico: 'CADENA INFINITA 4 METROS', color: 'NEGRO' } as CadenaInsumo,
  { cod: 'CAD06', nemotecnico: 'CADENA INFINITA 3 METROS', color: 'BLANCO' } as CadenaInsumo,
  { cod: 'CAD07', nemotecnico: 'CADENA INFINITA 4 METROS', color: 'BLANCO' } as CadenaInsumo,
];

describe('roller de fábrica', () => {
  const r = resolverCortinaDePrueba(
    { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'BCO' },
    { modelos: CATALOGO, cadenas: CADENAS },
  );

  it('elige modelo, kit por color, tubo y cadena de una vez', () => {
    expect(r.modelo?.mecanismo).toBe('MEC_33_ROLLER_BLANCO');
    expect(r.kit).toContain('[MEC 33]');
    expect(r.reglaKit).toBe('kit por color de accesorios');
    expect(r.tubo).toBeTruthy();
    expect(r.cadena).toEqual({ cod: 'CAD07', largo: '4mts', color: 'BCO' });
  });

  it('el despiece trae medidas y códigos de bodega', () => {
    expect(medida(r, 'Tubo')).toBe(150 - 3.8);
    expect(codigo(r, 'Peso')).toBe('E15'); // barra de peso blanca
  });

  it('los insumos son los mismos que van al inventario', () => {
    const map = Object.fromEntries(r.insumos.map((i) => [i.codigo, i.cantidad]));
    expect(map).toMatchObject({ TAP19: 1, TAP01: 1, TOR02: 2 });
  });

  it('sin nada raro, no hay avisos', () => {
    expect(r.avisos).toEqual([]);
  });
});

describe('las reglas se ven y se explican', () => {
  it('sobre 3 m manda la regla por ancho, y el banco dice cuál fue', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 3.5, altoM: 2.4, color: 'BCO' },
      { modelos: CATALOGO },
    );
    expect(r.kit).toContain('[MEC 28]');
    expect(r.reglaKit).toContain('regla por ancho');
  });

  it('la banda E78 solo se activa con el toggle, y se nota en el kit', () => {
    const entrada = { categoria: 'ROL', anchoM: 2.5, altoM: 2.4, color: 'BCO' };
    const sin = resolverCortinaDePrueba(entrada, { modelos: CATALOGO });
    const con = resolverCortinaDePrueba(
      { ...entrada, usarTuboE78: true },
      { modelos: CATALOGO },
    );
    expect(sin.kit).toContain('[MEC 33]');
    expect(con.kit).toContain('[MEC 18]');
    expect(con.reglaKit).toContain('regla por ancho');
  });

  it('una banda editada en Admin cambia desde dónde aplica', () => {
    // El admin baja el mínimo de la banda de 2,2 a 2,0: a 2,1 m ya debe entrar.
    const reglas = {
      ...REGLAS_SELECCION_DEFAULT,
      mecanismo: {
        ...REGLAS_MECANISMO,
        reglasAncho: REGLAS_MECANISMO.reglasAncho.map((r) =>
          r.mecPorColor && r.anchoMinM === 2.2 ? { ...r, anchoMinM: 2.0 } : r,
        ),
      },
    };
    const entrada = { categoria: 'ROL', anchoM: 2.1, altoM: 2.4, color: 'BCO', usarTuboE78: true };
    expect(resolverCortinaDePrueba(entrada, { modelos: CATALOGO }).kit).toContain('[MEC 33]');
    expect(resolverCortinaDePrueba(entrada, { modelos: CATALOGO, reglas }).kit).toContain('[MEC 18]');
  });

  it('el color de accesorios cambia el kit y la cadena juntos', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'NEG' },
      { modelos: CATALOGO, cadenas: CADENAS },
    );
    expect(r.kit).toContain('[MEC 32]');
    expect(r.cadena?.cod).toBe('CAD03');
    expect(codigo(r, 'Peso')).toBe('E14');
  });
});

describe('fórmulas: el banco refleja lo editado en Admin', () => {
  it('DARK 38 INTERNO a 200 reproduce la pizarra', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'DARK_38mm', anchoM: 2.0, altoM: 2.4, color: 'BCO', variante: 'INTERNO' },
      { modelos: CATALOGO },
    );
    expect(medida(r, 'Cenefa Delantera')).toBe(199.7);
    expect(medida(r, 'Cenefa Trasera')).toBe(198.7);
    expect(medida(r, 'Tubo')).toBe(193.9);
    expect(medida(r, 'Tela (ancho)')).toBe(193.3);
    expect(medida(r, 'Peso')).toBe(193.5);
  });

  it('OSCURANTI INTERNO a 330 reproduce la pizarra', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'OSCURANTI_63mm', anchoM: 3.3, altoM: 2.4, color: 'BCO', variante: 'INTERNO' },
      { modelos: CATALOGO },
    );
    expect(medida(r, 'Perfil superior')).toBe(329.7);
    expect(medida(r, 'Tubo')).toBe(323.9);
    expect(medida(r, 'Tela (ancho)')).toBe(323.3);
    expect(medida(r, 'Peso')).toBe(323.5);
  });

  it('al editar el paso del tubo, el corte se mueve en el banco', () => {
    const formulas = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        tuboPaso: { ...FORMULAS_DEFAULT.oscuridad.tuboPaso, DARK: [10, 5, 5.4] as [number, number, number] },
      },
    };
    const entrada = {
      categoria: 'DARK_38mm',
      anchoM: 2.0,
      altoM: 2.4,
      color: 'BCO',
      variante: 'INTERNO' as const,
    };
    const antes = resolverCortinaDePrueba(entrada, { modelos: CATALOGO });
    const despues = resolverCortinaDePrueba(entrada, { modelos: CATALOGO, formulas });
    expect(medida(antes, 'Tubo')).toBe(193.9);
    // El tubo baja 5,2 más (10 en vez de 4,8) y la cadena arrastra a la tela.
    expect(medida(despues, 'Tubo')).toBe(188.7);
    expect(medida(despues, 'Cenefa Delantera')).toBe(199.7); // lo de arriba no se mueve
  });
});

describe('tipos de cortina propios', () => {
  const TIPO: TipoCortina = {
    categoria: 'DARK_PRUEBA_38mm',
    nombre: 'Dark de prueba',
    grupo: 'Tipos propios',
    base: 'DARK_38mm',
    activo: true,
  };

  it('sin parche, el tipo propio corta igual que su molde', () => {
    const entrada = { anchoM: 2.0, altoM: 2.4, color: 'BCO', variante: 'INTERNO' as const };
    const molde = resolverCortinaDePrueba(
      { ...entrada, categoria: 'DARK_38mm' },
      { modelos: CATALOGO },
    );
    const propio = resolverCortinaDePrueba(
      { ...entrada, categoria: 'DARK_PRUEBA_38mm' },
      { modelos: CATALOGO, reglas: { ...REGLAS_SELECCION_DEFAULT, tipos: [TIPO] } },
    );
    expect(propio.cortes.map((c) => [c.componente, c.medidaCm])).toEqual(
      molde.cortes.map((c) => [c.componente, c.medidaCm]),
    );
  });

  it('con parche propio corta distinto, y el molde NO se contamina', () => {
    const reglas = { ...REGLAS_SELECCION_DEFAULT, tipos: [TIPO] };
    const formulas = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        porTipo: { DARK_PRUEBA_38mm: { tuboPaso: [10, 5, 5.4] as [number, number, number] } },
      },
    };
    const entrada = { anchoM: 2.0, altoM: 2.4, color: 'BCO', variante: 'INTERNO' as const };
    const propio = resolverCortinaDePrueba(
      { ...entrada, categoria: 'DARK_PRUEBA_38mm' },
      { modelos: CATALOGO, reglas, formulas },
    );
    const molde = resolverCortinaDePrueba(
      { ...entrada, categoria: 'DARK_38mm' },
      { modelos: CATALOGO, reglas, formulas },
    );
    expect(medida(propio, 'Tubo')).toBe(188.7);
    expect(medida(molde, 'Tubo')).toBe(193.9);
  });
});

describe('colores de accesorios nuevos', () => {
  const DORADO: ColorAccesorio = {
    codigo: 'DOR',
    nombre: 'DORADO',
    usos: { accesorio: true, manilla: false, tapaOvalada: false, tapaCuadrada: false },
    insumos: { kitSimple: 43, tapaPesoIzq: 'TAP80', tapaPesoDer: 'TAP81', pesoRoller: 'E90' },
  };
  const reglas = {
    ...REGLAS_SELECCION_DEFAULT,
    mecanismo: {
      ...REGLAS_MECANISMO,
      mecanismos: [
        ...REGLAS_MECANISMO.mecanismos,
        { chip: 'KIT SIMPLE DORADO 38MM [MEC 43]', estado: 'activo' as const },
      ],
      kitsInventario: [...REGLAS_MECANISMO.kitsInventario, 43],
      colorAMec: { ...REGLAS_MECANISMO.colorAMec, DOR: 43, DORADO: 43 },
    },
    colores: [...COLORES_BUILTIN, DORADO],
  };

  it('el kit, las tapas y el peso salen con los códigos del color', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'DOR' },
      { modelos: CATALOGO, reglas },
    );
    expect(r.kit).toContain('[MEC 43]');
    expect(codigo(r, 'Peso')).toBe('E90');
    expect(r.insumos.map((i) => i.codigo)).toContain('TAP80');
  });

  it('lo que no se catalogó se avisa en vez de desaparecer', () => {
    const pelado = {
      ...reglas,
      colores: [...COLORES_BUILTIN, { ...DORADO, insumos: { kitSimple: 43 } }],
    };
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'DOR' },
      { modelos: CATALOGO, reglas: pelado },
    );
    expect(r.avisos.join(' ')).toContain('Sin código de bodega');
    expect(r.avisos.join(' ')).toContain('Insumos sin código');
    // Los tornillos NO faltan aunque la tapa no tenga código.
    expect(r.insumos.find((i) => i.codigo === 'TOR02')?.cantidad).toBe(2);
  });

  it('un color sin kit mapeado (metálico) hereda el del modelo del catálogo', () => {
    // No hay kit metálico de bodega, así que la app cae al chip de la fila del
    // catálogo. El banco lo dice, que es justo lo que hoy no se ve en ningún lado.
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'MET' },
      { modelos: CATALOGO },
    );
    expect(r.kit).toContain('[MEC 33]');
    expect(r.reglaKit).toBe('kit guardado / del modelo del catálogo');
  });

  it('sin kit ni modelo del que heredarlo, avisa que lo pone el vendedor', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'MET' },
      { modelos: [] },
    );
    expect(r.kit).toBe('');
    expect(r.reglaKit).toContain('lo elige el vendedor');
    expect(r.avisos.join(' ')).toContain('kit');
  });
});

// El interruptor «Categoría B» tiene que mover TODO: la fila del catálogo, el
// kit, el tubo y los códigos de corte. Estaba a medio cablear (solo movía el
// tubo y los códigos), así que el banco mostraba un kit de la línea A.
describe('categoría B (gama económica)', () => {
  const CATALOGO_B: ModeloDespiece[] = [
    ...CATALOGO,
    modelo({
      sistema: 'ROLLER_SIMPLE',
      tipo_rol: 'MANUAL_38',
      mecanismo: 'MEC_06_LZ50_B_BLANCO',
      diametro_tubo_mm: 38,
      dcto_tubo_cm: 3.8,
      dcto_tela_cm: 0.5,
      suma_peso_cm: 0.1,
      notas: 'LINEA B',
    }),
    modelo({
      sistema: 'ROLLER_SIMPLE',
      tipo_rol: 'MANUAL_38',
      mecanismo: 'MEC_15_LZ50_B_NEGRO',
      diametro_tubo_mm: 38,
      dcto_tubo_cm: 3.3,
      dcto_tela_cm: 0.5,
      suma_peso_cm: 0.1,
      notas: 'LINEA B',
    }),
  ];
  const probar = (over: { color?: string; anchoM?: number; categoria?: string; lineaB?: boolean }) =>
    resolverCortinaDePrueba(
      {
        categoria: over.categoria ?? 'ROL',
        anchoM: over.anchoM ?? 1.5,
        altoM: 2.4,
        color: over.color ?? 'BCO',
        lineaB: over.lineaB ?? true,
      },
      { modelos: CATALOGO_B, cadenas: CADENAS },
    );

  it('blanco: fila B del catálogo, kit MEC 06, tubo E01 y peso E40', () => {
    const r = probar({});
    expect(r.modelo?.mecanismo).toBe('MEC_06_LZ50_B_BLANCO');
    expect(r.kit).toContain('[MEC 06]');
    expect(r.reglaKit).toContain('categoría B');
    expect(r.tubo).toContain('E01');
    expect(codigo(r, 'Peso')).toBe('E40');
  });

  it('negro: kit MEC 15 y peso E69-B', () => {
    const r = probar({ color: 'NEG' });
    expect(r.modelo?.mecanismo).toBe('MEC_15_LZ50_B_NEGRO');
    expect(r.kit).toContain('[MEC 15]');
    expect(codigo(r, 'Peso')).toBe('E69-B');
  });

  it('sobre el ancho de corte pasa al E39', () => {
    expect(probar({ anchoM: 2.8 }).tubo).toContain('E39');
    expect(probar({ anchoM: 2.4 }).tubo).toContain('E01');
  });

  it('el gris no tiene receta: sin kit y con aviso de bloqueo', () => {
    const r = probar({ color: 'GRS' });
    expect(r.kit).toBe('');
    expect(r.reglaKit).toContain('no cae a los de la línea A');
    expect(r.avisos.join(' ')).toContain('bloqueada');
  });

  it('una categoría sin recetas B avisa y se resuelve como la línea A', () => {
    const r = probar({ categoria: 'OSCURANTI_63mm', anchoM: 2.0 });
    expect(r.avisos.join(' ')).toContain('no tiene recetas de categoría B');
    // El tubo NO es el E01 de la categoría B: manda el modelo de siempre.
    expect(r.tubo).not.toContain('E01');
  });

  it('sin el interruptor todo sigue siendo línea A', () => {
    const r = probar({ lineaB: false });
    expect(r.modelo?.mecanismo).toBe('MEC_33_ROLLER_BLANCO');
    expect(codigo(r, 'Peso')).toBe('E15');
  });
});

describe('casos borde: el banco no explota', () => {
  it('categoría sin filas en el catálogo avisa y devuelve cortes vacíos', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 1.5, altoM: 2.4, color: 'BCO' },
      { modelos: [] },
    );
    expect(r.modelo).toBeNull();
    expect(r.avisos.join(' ')).toContain('No hay ninguna fila del catálogo');
    expect(r.cortes).toEqual([]);
  });

  it('ancho en cero no rompe nada', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'ROL', anchoM: 0, altoM: 0, color: 'BCO' },
      { modelos: CATALOGO },
    );
    expect(r.cortes).toEqual([]);
  });

  it('la pletina va con velcro, sin kit de mecanismo', () => {
    const r = resolverCortinaDePrueba(
      { categoria: 'PLETINA_ROLLER_V', anchoM: 1.5, altoM: 2.4, color: 'BCO' },
      { modelos: CATALOGO },
    );
    expect(r.kit).toBe('VELCRO');
    expect(r.reglaKit).toContain('velcro');
  });
});
