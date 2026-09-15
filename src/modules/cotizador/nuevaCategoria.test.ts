import { describe, expect, it } from 'vitest';
import {
  COD_ACCESORIO,
  baseCodSugerido,
  codFamilia,
  familiasDelBorrador,
  filaDeReferencia,
  filaNueva,
  moldeSugerido,
  moldesDisponibles,
  nombreProductoSugerido,
  precioDesdeCosto,
  recalcularFila,
  siglaBase,
  slugBase,
  variantesDeMolde,
} from './nuevaCategoria';
import { validarBorrador, hayErroresDeFila } from './nuevaCategoriaValidar';
import { esDuoDe, esVerticalDe } from './flujoCatalogo';
import { REGLAS_PRECIOS_DEFAULT } from './reglasPrecios';
import { borrador, ctx, fila } from './__fixtures__/nuevaCategoria';

describe('el código de la familia', () => {
  it('el nombre se convierte en código', () => {
    expect(slugBase('Lino Rústico')).toBe('LINO_RUSTICO');
    expect(slugBase('  duo  lino ')).toBe('DUO_LINO');
    expect(slugBase('###')).toBe('');
    expect(siglaBase('LINO')).toBe('LN');
    expect(siglaBase('DUOLINO')).toBe('DL');
  });

  it('un dúo nace con DUO adelante: el motor lo deduce del código', () => {
    expect(baseCodSugerido('Lino', 'duo')).toBe('DUOLINO');
    expect(baseCodSugerido('Duo Lino', 'duo')).toBe('DUO_LINO');
    expect(baseCodSugerido('Lino', 'roller')).toBe('LINO');
    expect(baseCodSugerido('Lino', 'vertical')).toBe('LINO');
  });

  it('cada gama arma su familia, como en el Excel', () => {
    const b = borrador();
    const c = ctx();
    expect(codFamilia(b, fila(b, c, { tipo: 'PREMIUM' }))).toBe('LINO_P');
    expect(codFamilia(b, fila(b, c, { tipo: 'DELUX' }))).toBe('LINO_D');
    expect(codFamilia(b, fila(b, c, { tipo: 'STANDARD' }))).toBe('LINO_S');
    // BASIC comparte la familia de STANDARD (ninguna de fábrica la separa).
    expect(codFamilia(b, fila(b, c, { tipo: 'BASIC' }))).toBe('LINO_S');
  });

  it('lo que no es cortina no tiene familia propia', () => {
    const b = borrador();
    const c = ctx();
    expect(codFamilia(b, fila(b, c, { tipo: 'ACCESORIO' }))).toBe(COD_ACCESORIO);
    expect(codFamilia(borrador({ tipo: 'accesorio' }), fila(b, c))).toBe(COD_ACCESORIO);
  });

  // Lo importante: el código y el nombre tienen que decirle al MOTOR lo mismo
  // que la persona eligió, o la cortina se cobra como otra cosa.
  it('el código y el nombre calzan con lo que deduce el motor', () => {
    for (const tipo of ['roller', 'duo', 'vertical'] as const) {
      const b = borrador({ tipo, baseCod: baseCodSugerido('Lino', tipo) });
      const c = ctx();
      const f = fila(b, c);
      const cod = codFamilia(b, f);
      const nombre = nombreProductoSugerido(b, f.tipo);
      expect(esDuoDe(cod, nombre), `${tipo} → ${cod}`).toBe(tipo === 'duo');
      expect(esVerticalDe(cod, nombre), `${tipo} → ${cod}`).toBe(tipo === 'vertical');
    }
  });

  it('la familia existente manda sobre todo', () => {
    const b = borrador({ familiaExistente: 'SCREEN_P' });
    const c = ctx();
    expect(codFamilia(b, fila(b, c, { tipo: 'DELUX' }))).toBe('SCREEN_P');
    expect(familiasDelBorrador({ ...b, filas: [fila(b, c)] })).toEqual([]);
  });

  it('las familias del borrador salen de los tipos usados, sin repetir', () => {
    const b = borrador();
    const c = ctx();
    const conFilas = {
      ...b,
      filas: [
        fila(b, c, { tipo: 'PREMIUM' }),
        fila(b, c, { tipo: 'PREMIUM' }),
        fila(b, c, { tipo: 'DELUX' }),
        fila(b, c, { tipo: 'ACCESORIO' }),
      ],
    };
    expect(familiasDelBorrador(conFilas)).toEqual(['LINO_P', 'LINO_D']);
  });
});

describe('el nombre del producto', () => {
  it('sigue la convención de la que dependen el motor y las etiquetas', () => {
    expect(nombreProductoSugerido(borrador(), 'PREMIUM')).toBe('ROLLER LINO PREMIUM');
    expect(nombreProductoSugerido(borrador({ tipo: 'duo' }), 'DELUX')).toBe('DUO LINO DELUX');
    expect(nombreProductoSugerido(borrador({ tipo: 'vertical' }), 'DELUX')).toBe(
      'CORTINA VERTICAL LINO DELUX',
    );
    expect(nombreProductoSugerido(borrador({ tipo: 'accesorio' }), 'ACCESORIO')).toBe('LINO');
  });
});

describe('el precio sale del costo, como en el Excel', () => {
  it('costo ÷ ganancia × (1 + IVA) — la fila real de la planilla', () => {
    // BLACKOUT_D del Excel maestro: 22.869 → 41.868, al peso.
    expect(precioDesdeCosto(22869, 0.65, 0.19)).toBe(41868);
    // BLACKOUT_P: el Excel muestra 29.231 y acá sale 29.230, porque su columna
    // de costo viene redondeada (15.966 con decimales escondidos). Por eso el
    // precio se puede escribir a mano: manda la planilla, no la cuenta.
    expect(precioDesdeCosto(15966, 0.65, 0.19)).toBe(29230);
  });

  it('sin costo o sin ganancia no se inventa un precio', () => {
    expect(precioDesdeCosto(0, 0.65, 0.19)).toBe(0);
    expect(precioDesdeCosto(1000, 0, 0.19)).toBe(0);
  });

  it('la fila recalcula el precio mientras nadie lo escriba a mano', () => {
    const b = borrador();
    const c = ctx();
    const base = { ...filaNueva(b, c), costo: 22869 };
    expect(recalcularFila(base, b, c).precio).toBe(41868);
    expect(recalcularFila({ ...base, precioManual: true, precio: 40000 }, b, c).precio).toBe(40000);
  });

  it('la fila nueva trae la ganancia de la empresa y la fecha de hoy', () => {
    const f = filaNueva(borrador(), ctx());
    expect(f.gananciaPct).toBe(65);
    expect(f.fechaAlta).toBe('2026-09-14');
    expect(f.producto).toBe('ROLLER LINO PREMIUM');
    expect(f.tipo).toBe('PREMIUM');
  });

  it('la fila de referencia nace como la del Excel', () => {
    const f = filaDeReferencia(borrador(), ctx(), 'DELUX');
    expect(f.codInt).toBe('LN-D');
    expect(f.descripcion).toBe('COLOR POR DEFINIR');
    expect(f.referencia).toBe(true);
  });
});

describe('con qué familia se cobra (el molde)', () => {
  it('ofrece las familias de su tipo y deja fuera las de sistema propio', () => {
    const roller = moldesDisponibles(REGLAS_PRECIOS_DEFAULT, 'roller');
    expect(roller).toEqual(['BLACKOUT_D', 'BLACKOUT_P', 'BLACKOUT_S', 'SCREEN_D', 'SCREEN_P', 'SCREEN_S']);
    const duo = moldesDisponibles(REGLAS_PRECIOS_DEFAULT, 'duo');
    expect(duo).toEqual(['DUOBK_D', 'DUOBK_P', 'DUOBK_S', 'DUOPOLI_D', 'DUOPOLI_P', 'DUOPOLI_S']);
    // El beeblack tiene sistema propio: copiar su receta sin su sistema daría
    // una cortina a medio cobrar.
    expect(roller).not.toContain('BEE_BK');
    // Y las verticales no eligen: su receta es una sola.
    expect(moldesDisponibles(REGLAS_PRECIOS_DEFAULT, 'vertical')).toEqual([]);
    expect(moldesDisponibles(REGLAS_PRECIOS_DEFAULT, 'accesorio')).toEqual([]);
  });

  it('propone el blackout de la misma gama', () => {
    expect(moldeSugerido('LINO_D', 'roller')).toBe('BLACKOUT_D');
    expect(moldeSugerido('DUOLINO_S', 'duo')).toBe('DUOBK_S');
  });

  it('las variantes del molde son las que hay que copiar con él', () => {
    expect(variantesDeMolde(REGLAS_PRECIOS_DEFAULT, 'BLACKOUT_P').sort()).toContain('|B');
    expect(variantesDeMolde(REGLAS_PRECIOS_DEFAULT, 'BLACKOUT_P')).toContain('|INV');
    // La standard no se invierte: no hay que inventarle una receta.
    expect(variantesDeMolde(REGLAS_PRECIOS_DEFAULT, 'BLACKOUT_S')).not.toContain('|INV');
  });
});

describe('validarBorrador — lo que impide crear', () => {
  const completo = () => {
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const c = ctx();
    return { b: { ...b, filas: [fila(b, c, { referencia: true })] }, c };
  };

  it('un borrador completo no tiene errores', () => {
    const { b, c } = completo();
    const v = validarBorrador(b, c);
    expect(v.errores).toEqual([]);
    expect(hayErroresDeFila(v)).toBe(false);
  });

  it('exige nombre, código y pastilla', () => {
    const { b, c } = completo();
    const v = validarBorrador({ ...b, nombre: '', baseCod: '' }, c);
    expect(v.errores.join(' ')).toMatch(/nombre/i);
    expect(v.errores.join(' ')).toMatch(/código/i);
    expect(
      validarBorrador({ ...b, pastilla: { modo: 'nueva', label: '', hex: '#fff' } }, c).errores.join(' '),
    ).toMatch(/pastilla/i);
  });

  it('un código que insinúa otro sistema se rechaza', () => {
    const { b, c } = completo();
    expect(validarBorrador({ ...b, baseCod: 'DUOLINO' }, c).errores.join(' ')).toMatch(/dúo/i);
    expect(validarBorrador({ ...b, baseCod: 'LINO_V' }, c).errores.join(' ')).toMatch(/vertical/i);
    const duo = borrador({ tipo: 'duo', baseCod: 'LINO', categoriaFabricacion: 'DUO_MANUAL_38mm' });
    expect(validarBorrador({ ...duo, filas: b.filas }, c).errores.join(' ')).toMatch(/DUO/);
  });

  it('una familia que ya existe no se puede crear de nuevo', () => {
    const { b, c } = completo();
    const v = validarBorrador({ ...b, baseCod: 'BLACKOUT' }, c);
    expect(v.errores.join(' ')).toMatch(/BLACKOUT_P/);
  });

  it('exige elegir el molde y la categoría de fabricación', () => {
    const { b, c } = completo();
    expect(validarBorrador({ ...b, moldes: {} }, c).errores.join(' ')).toMatch(/con qué familia/i);
    expect(validarBorrador({ ...b, categoriaFabricacion: '' }, c).errores.join(' ')).toMatch(
      /categoría de fabricación/i,
    );
    expect(validarBorrador({ ...b, categoriaFabricacion: 'NO_EXISTE' }, c).errores.join(' ')).toMatch(
      /ya no existe/i,
    );
    // La categoría VERTICAL es solo para verticales, y al revés.
    expect(validarBorrador({ ...b, categoriaFabricacion: 'VERTICAL' }, c).errores.join(' ')).toMatch(
      /VERTICAL/,
    );
  });

  it('una vertical necesita de dónde sale el precio de su tela', () => {
    const b = borrador({ tipo: 'vertical', baseCod: 'LINO', categoriaFabricacion: 'VERTICAL' });
    const c = ctx();
    const f = fila(b, c, { producto: 'CORTINA VERTICAL LINO PREMIUM' });
    expect(validarBorrador({ ...b, filas: [f] }, c).errores.join(' ')).toMatch(/precio de la tela/i);
    // Con una fila de referencia con precio, o con un código del catálogo, pasa.
    expect(
      validarBorrador({ ...b, filas: [{ ...f, referencia: true }] }, c).errores,
    ).toEqual([]);
    expect(
      validarBorrador({ ...b, filas: [f], baseVerticalDe: { LINO_V_P: 'BK-P' } }, c).errores,
    ).toEqual([]);
  });

  it('el nombre tiene que decir lo mismo que el código', () => {
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const c = ctx();
    const v = validarBorrador(
      { ...b, filas: [fila(b, c, { producto: 'DUO LINO PREMIUM', referencia: true })] },
      c,
    );
    expect(Object.values(v.porFila)[0].errores.producto).toMatch(/roller/i);
  });

  it('marca los códigos repetidos y los que ya están en el catálogo', () => {
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const c = ctx();
    const filas = [
      fila(b, c, { codInt: 'LN 01', referencia: true }),
      fila(b, c, { codInt: 'ln 01' }),
      fila(b, c, { codInt: 'BK 18' }),
      fila(b, c, { codInt: '' }),
    ];
    const v = validarBorrador({ ...b, filas }, c);
    const err = (i: number) => v.porFila[filas[i].id]?.errores.codInt;
    expect(err(0)).toBeUndefined();
    expect(err(1)).toMatch(/repetido/i);
    expect(err(2)).toMatch(/ya está en el catálogo/i);
    expect(err(3)).toMatch(/Falta/i);
  });

  it('la tela de referencia necesita precio y es una sola por familia', () => {
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const c = ctx();
    const v = validarBorrador(
      {
        ...b,
        filas: [
          fila(b, c, { codInt: 'LN 01', referencia: true, precio: 0 }),
          fila(b, c, { codInt: 'LN 02', referencia: true }),
        ],
      },
      c,
    );
    const porFila = Object.values(v.porFila);
    expect(porFila[0].errores.precio).toMatch(/referencia/i);
    expect(porFila[1].errores.referencia).toMatch(/ya tiene/i);
  });

  it('avisa —sin bloquear— de lo que conviene mirar', () => {
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const c = ctx();
    const v = validarBorrador(
      { ...b, filas: [fila(b, c, { anchoRolloM: 0, precio: 0, precioManual: false, costo: 0 })] },
      c,
    );
    expect(v.errores).toEqual([]);
    const f = Object.values(v.porFila)[0];
    expect(f.avisos.anchoRolloM).toMatch(/2\.45|2,45/);
    expect(f.avisos.precio).toMatch(/referencia/i);
    expect(v.avisos.join(' ')).toMatch(/sin tela de referencia/i);
  });

  it('sin filas no se crea nada', () => {
    const { b, c } = completo();
    expect(validarBorrador({ ...b, filas: [] }, c).errores.join(' ')).toMatch(/al menos un producto/i);
  });

  it('agregar productos a una familia existente no pide nada de la categoría', () => {
    const b = borrador({ familiaExistente: 'SCREEN_P', nombre: '', baseCod: '', moldes: {} });
    const c = ctx();
    expect(validarBorrador({ ...b, filas: [fila(b, c)] }, c).errores).toEqual([]);
  });
});
