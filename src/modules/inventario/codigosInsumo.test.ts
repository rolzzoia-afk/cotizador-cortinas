import { describe, it, expect } from 'vitest';
import {
  abreviaturaColor,
  codigoVisible,
  codigoVisibleDe,
  coincideBusquedaInsumo,
  compararCodigos,
  familiaDeCodigo,
  formatearCodigo,
  lineaConCodigoVisible,
  mapaColoresPorCodigo,
  partirLineaConCodigo,
  mensajeErrorAlta,
  normalizarCodigoInsumo,
  partesDeCodigo,
  proponerCodigo,
  RE_CODIGO_INSUMO,
  SUFIJOS,
  validarFormaCodigo,
  type FamiliaInsumo,
} from './codigosInsumo';

const familia = (p: Partial<FamiliaInsumo> & { prefijo: string }): FamiliaInsumo => ({
  nombre: p.prefijo,
  categoria: 'INSUMO',
  sub_categoria: null,
  digitos: 2,
  siguiente: 1,
  activo: true,
  descripcion: null,
  ...p,
});

describe('normalizarCodigoInsumo', () => {
  it('deja el código en mayúsculas y sin espacios', () => {
    expect(normalizarCodigoInsumo(' mec 18 ')).toBe('MEC18');
    expect(normalizarCodigoInsumo('DOM 18')).toBe('DOM18');
    expect(normalizarCodigoInsumo('cad13')).toBe('CAD13');
  });

  // El guion es parte del código («-B» es la categoría B): borrarlo colapsaría
  // MEC44-B con un MEC44B que no existe.
  it('conserva el guion', () => {
    expect(normalizarCodigoInsumo('mec44-b')).toBe('MEC44-B');
    expect(normalizarCodigoInsumo(' e69 - b ')).toBe('E69-B');
  });

  it('con nada devuelve una cadena vacía, no revienta', () => {
    expect(normalizarCodigoInsumo(null)).toBe('');
    expect(normalizarCodigoInsumo(undefined)).toBe('');
    expect(normalizarCodigoInsumo('')).toBe('');
    expect(normalizarCodigoInsumo(1234)).toBe('1234');
  });
});

describe('la forma del código', () => {
  it('acepta los códigos que existen hoy', () => {
    for (const c of [
      'MEC44-B',
      'E69-B',
      'INS20-1',
      'LAMP01',
      'UTEN01',
      'WALL01',
      'ESTU02',
      'INS100',
      'INM179',
      'DOM18',
      'E01',
      'TOR109',
    ]) {
      expect(validarFormaCodigo(c), c).toBeNull();
      expect(RE_CODIGO_INSUMO.test(c), c).toBe(true);
    }
  });

  it('rechaza lo que no es un código', () => {
    for (const c of ['INS-1234', 'E1', '0', 'MEC44-BB1', 'MECAN01', 'INS', '12345']) {
      expect(validarFormaCodigo(c), c).not.toBeNull();
    }
  });

  it('un código vacío pide que se escriba uno', () => {
    expect(validarFormaCodigo('')).toBe('Escribe un código.');
    expect(validarFormaCodigo(null)).toBe('Escribe un código.');
  });

  // Se normaliza ANTES de validar: quien escribe «CAD 13» está escribiendo
  // CAD13, no un código inválido.
  it('normaliza antes de juzgar: «CAD 13» y «mec18» son válidos', () => {
    expect(validarFormaCodigo('CAD 13')).toBeNull();
    expect(validarFormaCodigo('mec18')).toBeNull();
  });

  it('la regla es la misma que el CHECK de la base', () => {
    expect(RE_CODIGO_INSUMO.source).toBe('^[A-Z]{1,4}[0-9]{2,3}(-[A-Z0-9]{1,2})?$');
  });
});

describe('partesDeCodigo', () => {
  it('parte un código en prefijo, número y sufijo', () => {
    expect(partesDeCodigo('INS20-1')).toEqual({
      prefijo: 'INS',
      numero: 20,
      digitos: 2,
      sufijo: '1',
    });
    expect(partesDeCodigo('MEC44-B')).toEqual({
      prefijo: 'MEC',
      numero: 44,
      digitos: 2,
      sufijo: 'B',
    });
  });

  it('cuenta los dígitos que trae el código', () => {
    expect(partesDeCodigo('INS100')?.digitos).toBe(3);
    expect(partesDeCodigo('INS01')?.digitos).toBe(2);
  });

  it('lo que no es un código devuelve null', () => {
    expect(partesDeCodigo('X')).toBeNull();
    expect(partesDeCodigo('')).toBeNull();
    expect(partesDeCodigo(null)).toBeNull();
  });
});

describe('formatearCodigo', () => {
  it('rellena con ceros hasta los dígitos de la familia', () => {
    expect(formatearCodigo('E', 5, 2)).toBe('E05');
    expect(formatearCodigo('INS', 270, 3)).toBe('INS270');
    expect(formatearCodigo('E', 5, 2, 'B')).toBe('E05-B');
  });

  // Pasado el tope de dígitos NO se trunca: MEC100 es feo pero es correcto;
  // truncar daría MEC00, que es otro artículo.
  it('no trunca cuando el número pasa los dígitos', () => {
    expect(formatearCodigo('MEC', 100, 2)).toBe('MEC100');
  });
});

describe('compararCodigos — orden natural', () => {
  it('INS99 va antes que INS100', () => {
    expect(compararCodigos('INS99', 'INS100')).toBeLessThan(0);
    expect(compararCodigos('INS100', 'INS99')).toBeGreaterThan(0);
  });

  it('el que no lleva sufijo va primero', () => {
    expect(compararCodigos('MEC44', 'MEC44-B')).toBeLessThan(0);
    expect(compararCodigos('E01', 'E01-B')).toBeLessThan(0);
  });

  it('ordena por prefijo antes que por número', () => {
    expect(compararCodigos('CAD13', 'INS01')).toBeLessThan(0);
  });

  it('un código igual a sí mismo empata', () => {
    expect(compararCodigos('MEC18', 'mec 18')).toBe(0);
  });

  it('ordena una lista como la leería una persona', () => {
    const lista = ['INS100', 'INS99', 'DOM18', 'INS9X', 'MEC44-B', 'MEC44'];
    expect([...lista].sort(compararCodigos)).toEqual([
      'DOM18',
      'INS99',
      'INS100',
      'MEC44',
      'MEC44-B',
      'INS9X',
    ]);
  });

  it('lo que no tiene forma de código se va al final, sin perderse', () => {
    expect(compararCodigos('INS9X', 'INS01')).toBeGreaterThan(0);
    expect(compararCodigos(null, 'INS01')).toBeGreaterThan(0);
    expect(compararCodigos(null, undefined)).toBe(0);
  });
});

describe('proponerCodigo', () => {
  it('propone el siguiente de la familia', () => {
    expect(proponerCodigo(familia({ prefijo: 'MEC', digitos: 2, siguiente: 46 }))).toEqual({
      cod: 'MEC46',
      siguiente: 47,
    });
  });

  it('salta los que ya existen', () => {
    expect(
      proponerCodigo(familia({ prefijo: 'MEC', digitos: 2, siguiente: 46 }), ['MEC46', 'MEC47']),
    ).toEqual({ cod: 'MEC48', siguiente: 49 });
  });

  // Un hueco es un código dado de baja: sus etiquetas y su historial siguen
  // vivos en el galpón, así que no se reutiliza.
  it('NO reutiliza los huecos de la numeración', () => {
    expect(proponerCodigo(familia({ prefijo: 'MEC', digitos: 2, siguiente: 43 }), ['MEC41'])).toEqual(
      { cod: 'MEC43', siguiente: 44 },
    );
  });

  it('respeta los tres dígitos de las familias grandes', () => {
    expect(proponerCodigo(familia({ prefijo: 'INS', digitos: 3, siguiente: 270 })).cod).toBe(
      'INS270',
    );
  });

  it('compara sin espacios: «MEC 46» ocupa el lugar de MEC46', () => {
    expect(proponerCodigo(familia({ prefijo: 'MEC', digitos: 2, siguiente: 46 }), ['MEC 46']).cod)
      .toBe('MEC47');
  });
});

describe('familiaDeCodigo', () => {
  const familias = [
    familia({ prefijo: 'MEC', siguiente: 46 }),
    familia({ prefijo: 'SLM', activo: false }),
  ];

  it('encuentra la familia por el prefijo', () => {
    expect(familiaDeCodigo('MEC44-B', familias)?.prefijo).toBe('MEC');
  });

  it('encuentra la familia aunque esté inactiva', () => {
    expect(familiaDeCodigo('SLM01', familias)?.prefijo).toBe('SLM');
  });

  it('un prefijo desconocido no inventa familia', () => {
    expect(familiaDeCodigo('ZZZ01', familias)).toBeNull();
    expect(familiaDeCodigo('no-es-un-codigo', familias)).toBeNull();
  });
});

describe('abreviaturaColor', () => {
  it('traduce los colores del cotizador', () => {
    expect(abreviaturaColor('BLANCO')).toBe('BCO');
    expect(abreviaturaColor('Blanca')).toBe('BCO');
    expect(abreviaturaColor('negro')).toBe('NEG');
    expect(abreviaturaColor('GRIS')).toBe('GRS');
    expect(abreviaturaColor('METAL')).toBe('MET');
    expect(abreviaturaColor('TRANSPARENTE')).toBe('TRA');
  });

  it('«CAFÉ» y «CAFE» son el mismo color', () => {
    expect(abreviaturaColor('CAFÉ')).toBe('CAFE');
    expect(abreviaturaColor('CAFE')).toBe('CAFE');
    expect(abreviaturaColor('Madera')).toBe('CAFE');
  });

  it('sin color no hay abreviatura', () => {
    expect(abreviaturaColor('')).toBeNull();
    expect(abreviaturaColor(null)).toBeNull();
    expect(abreviaturaColor('N/A')).toBeNull();
  });

  // Inventar un «-AZ» que nadie definió haría leer el código como otro
  // artículo. Los colores sueltos se muestran sin sufijo.
  it('un color fuera del vocabulario no inventa abreviatura', () => {
    expect(abreviaturaColor('AZUL')).toBeNull();
    expect(abreviaturaColor('BEIGE')).toBeNull();
    expect(abreviaturaColor('DORADO')).toBeNull();
  });
});

describe('codigoVisible', () => {
  it('agrega el color al final', () => {
    expect(codigoVisible('MEC32', 'BLANCO')).toBe('MEC32-BCO');
    expect(codigoVisible('CAD04', 'NEGRO')).toBe('CAD04-NEG');
  });

  it('el color va después del «-B» de la categoría B', () => {
    expect(codigoVisible('MEC44-B', 'BLANCO')).toBe('MEC44-B-BCO');
    expect(codigoVisible('MEC42-B', 'NEGRO')).toBe('MEC42-B-NEG');
  });

  it('sin color queda la llave sola', () => {
    expect(codigoVisible('TOR02', 'N/A')).toBe('TOR02');
    expect(codigoVisible('INS01', '')).toBe('INS01');
    expect(codigoVisible('HER28', 'AZUL')).toBe('HER28');
  });

  it('sin código no hay nada que mostrar', () => {
    expect(codigoVisible('', 'BLANCO')).toBe('');
    expect(codigoVisible(null, 'BLANCO')).toBe('');
  });
});

describe('coincideBusquedaInsumo', () => {
  const mec = {
    cod: 'MEC32',
    color: 'BLANCO',
    nemotecnico: 'MECANISMO ROLLER BLANCO',
    descriptor_proveedor: 'CH-4518',
  };

  it('encuentra por la llave', () => {
    expect(coincideBusquedaInsumo(mec, 'MEC32')).toBe(true);
    expect(coincideBusquedaInsumo(mec, 'mec32')).toBe(true);
  });

  // La gente escribe el código con espacio porque así lo ve en las recetas de
  // precios y en el catálogo de productos.
  it('encuentra aunque lo escriban con espacio', () => {
    expect(coincideBusquedaInsumo(mec, 'MEC 32')).toBe(true);
  });

  it('encuentra por el código visible', () => {
    expect(coincideBusquedaInsumo(mec, 'MEC32-BCO')).toBe(true);
    expect(coincideBusquedaInsumo(mec, 'mec32-bco')).toBe(true);
  });

  it('encuentra por nombre, por descriptor y por color', () => {
    expect(coincideBusquedaInsumo(mec, 'ROLLER')).toBe(true);
    expect(coincideBusquedaInsumo(mec, 'CH-4518')).toBe(true);
    expect(coincideBusquedaInsumo(mec, 'BLANCO')).toBe(true);
  });

  it('no encuentra lo que no está', () => {
    expect(coincideBusquedaInsumo(mec, 'CAD13')).toBe(false);
    expect(coincideBusquedaInsumo(mec, 'NEGRO')).toBe(false);
  });

  it('sin búsqueda pasan todos', () => {
    expect(coincideBusquedaInsumo(mec, '')).toBe(true);
    expect(coincideBusquedaInsumo(mec, '   ')).toBe(true);
  });

  it('un artículo sin datos no revienta la búsqueda', () => {
    expect(coincideBusquedaInsumo({}, 'MEC')).toBe(false);
  });
});

describe('mensajeErrorAlta', () => {
  it('traduce el código repetido', () => {
    expect(mensajeErrorAlta('IN013')).toContain('ya existe');
    expect(mensajeErrorAlta('23505')).toContain('ya existe');
  });

  it('la familia desconocida manda a Configuración', () => {
    expect(mensajeErrorAlta('IN011')).toContain('Configuración');
  });

  it('la falta de migración se dice como tal', () => {
    expect(mensajeErrorAlta('42883')).toContain('sql/20260910_insumos_01_familias.sql');
  });

  it('lo que no reconoce lo dice tal cual en vez de inventar', () => {
    expect(mensajeErrorAlta('XXXXX', 'se cayó la red')).toContain('se cayó la red');
    expect(mensajeErrorAlta(undefined)).toBe('No se pudo crear el artículo.');
  });
});

describe('SUFIJOS', () => {
  it('«-B» sigue vigente y «-1» está congelado', () => {
    expect(SUFIJOS.find((s) => s.sufijo === 'B')?.vigente).toBe(true);
    expect(SUFIJOS.find((s) => s.sufijo === '1')?.vigente).toBe(false);
  });
});

describe('mapaColoresPorCodigo', () => {
  it('arma el mapa con la llave normalizada', () => {
    const m = mapaColoresPorCodigo([
      { cod: 'mec 32', color: 'BLANCO' },
      { cod: 'CAD04', color: 'NEGRO' },
    ]);
    expect(m.get('MEC32')).toBe('BLANCO');
    expect(m.get('CAD04')).toBe('NEGRO');
  });

  it('deja fuera los que no tienen color o no tienen código', () => {
    const m = mapaColoresPorCodigo([
      { cod: 'TOR02', color: '' },
      { cod: 'TOR03', color: null },
      { cod: '', color: 'BLANCO' },
      { cod: null, color: 'NEGRO' },
    ]);
    expect(m.size).toBe(0);
  });
});

describe('codigoVisibleDe', () => {
  const colores = mapaColoresPorCodigo([
    { cod: 'MEC32', color: 'BLANCO' },
    { cod: 'TIR02', color: 'AZUL' },
  ]);

  it('pega el color del mapa', () => {
    expect(codigoVisibleDe('MEC32', colores)).toBe('MEC32-BCO');
    expect(codigoVisibleDe('mec 32', colores)).toBe('MEC32-BCO');
  });

  it('sin color conocido, o con un color sin abreviatura, devuelve la llave sola', () => {
    expect(codigoVisibleDe('TOR02', colores)).toBe('TOR02');
    // AZUL no tiene abreviatura: no se inventa un «-AZ».
    expect(codigoVisibleDe('TIR02', colores)).toBe('TIR02');
  });

  it('tolera que no haya mapa', () => {
    expect(codigoVisibleDe('MEC32')).toBe('MEC32');
    expect(codigoVisibleDe('MEC32', null)).toBe('MEC32');
    expect(codigoVisibleDe('', colores)).toBe('');
  });
});

describe('lineaConCodigoVisible', () => {
  const colores = mapaColoresPorCodigo([
    { cod: 'CAD01', color: 'GRIS' },
    { cod: 'MEC44-B', color: 'BLANCO' },
    { cod: 'TOR02', color: '' },
  ]);

  it('reescribe el código entre corchetes y deja el resto igual', () => {
    expect(lineaConCodigoVisible('[CAD01] CADENA INFINITA 3 METROS', colores)).toBe(
      '[CAD01-GRS] CADENA INFINITA 3 METROS',
    );
  });

  it('el color va después del «-B»', () => {
    expect(lineaConCodigoVisible('[MEC44-B] MECANISMO ROLLER CAT. B', colores)).toBe(
      '[MEC44-B-BCO] MECANISMO ROLLER CAT. B',
    );
  });

  it('sin color en la ficha, la línea no cambia', () => {
    expect(lineaConCodigoVisible('[TOR02] TORNILLO', colores)).toBe('[TOR02] TORNILLO');
  });

  it('una línea sin código entre corchetes vuelve intacta', () => {
    // Las manillas y las tapas de cenefa no tienen insumo con código.
    expect(lineaConCodigoVisible('MOTOR BOFU 1.1 Nm', colores)).toBe('MOTOR BOFU 1.1 Nm');
    expect(lineaConCodigoVisible('KIT MEC 18 [TAPAS]', colores)).toBe('KIT MEC 18 [TAPAS]');
  });

  it('tolera vacíos y la falta de mapa', () => {
    expect(lineaConCodigoVisible('', colores)).toBe('');
    expect(lineaConCodigoVisible(null, colores)).toBe('');
    expect(lineaConCodigoVisible('[CAD01] CADENA')).toBe('[CAD01] CADENA');
  });
});

describe('partirLineaConCodigo', () => {
  const colores = mapaColoresPorCodigo([{ cod: 'CAD01', color: 'GRIS' }]);

  it('separa el código del texto y no lo deja repetido', () => {
    // La hoja de bodega pintaba «[CAD01] [CAD01] CADENA…» porque escribía el
    // código aparte Y la descripción ya lo traía adentro.
    expect(partirLineaConCodigo('[CAD01] CADENA INFINITA 3 METROS', colores)).toEqual({
      codigo: 'CAD01-GRS',
      resto: 'CADENA INFINITA 3 METROS',
    });
  });

  it('sin corchetes, todo es texto', () => {
    expect(partirLineaConCodigo('MOTOR BOFU 1.1 Nm', colores)).toEqual({
      codigo: null,
      resto: 'MOTOR BOFU 1.1 Nm',
    });
  });

  it('tolera vacíos', () => {
    expect(partirLineaConCodigo(null)).toEqual({ codigo: null, resto: '' });
  });
});
