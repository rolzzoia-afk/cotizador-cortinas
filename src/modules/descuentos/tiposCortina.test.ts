import { describe, expect, it } from 'vitest';
import { CATEGORIAS_FASE1 } from '@/modules/cotizador/categorias';
import {
  BASES_PERMITIDAS,
  CATEGORIAS_BUILTIN,
  baseEsOscuridad,
  categoriaEfectiva,
  categoriasParaSelect,
  diametroDelNombre,
  esTipoPropio,
  tipoPorCategoria,
  tiposActivos,
  validarTipos,
  type TipoCortina,
} from './tiposCortina';

const tipo = (over: Partial<TipoCortina> = {}): TipoCortina => ({
  categoria: 'INDUSTRIAL_38mm',
  nombre: 'Roller industrial',
  grupo: 'Tipos propios',
  base: 'ROL',
  activo: true,
  ...over,
});

describe('catálogo de categorías', () => {
  it('CATEGORIAS_BUILTIN tiene las 19 nativas', () => {
    expect(CATEGORIAS_BUILTIN).toHaveLength(19);
  });

  it('el select de Fase 1 ofrece exactamente las nativas (sin duplicar la lista)', () => {
    const delSelect = CATEGORIAS_FASE1.flatMap((g) => g.options.map((o) => o.value));
    expect([...delSelect].sort()).toEqual([...CATEGORIAS_BUILTIN].sort());
  });

  it('vertical y bee black no son moldes', () => {
    expect(BASES_PERMITIDAS).toHaveLength(17);
    expect(BASES_PERMITIDAS).not.toContain('VERTICAL');
    expect(BASES_PERMITIDAS).not.toContain('BEEBLACK');
  });

  it('reconoce los moldes de oscuridad', () => {
    expect(baseEsOscuridad('DARK_38mm')).toBe(true);
    expect(baseEsOscuridad('OSCURANTI_63mm')).toBe(true);
    expect(baseEsOscuridad('ROL')).toBe(false);
  });
});

describe('categoriaEfectiva', () => {
  const tipos = [tipo(), tipo({ categoria: 'BLACKOUT_TOTAL_38mm', base: 'DARK_38mm' })];

  it('sin tipos creados es la identidad', () => {
    expect(categoriaEfectiva('ROL')).toBe('ROL');
    expect(categoriaEfectiva('DARK_38mm', [])).toBe('DARK_38mm');
  });

  it('un tipo propio resuelve a su molde', () => {
    expect(categoriaEfectiva('INDUSTRIAL_38mm', tipos)).toBe('ROL');
    expect(categoriaEfectiva('BLACKOUT_TOTAL_38mm', tipos)).toBe('DARK_38mm');
  });

  it('una categoría nativa nunca se toca', () => {
    expect(categoriaEfectiva('SOFT_LIGHT_38mm', tipos)).toBe('SOFT_LIGHT_38mm');
  });

  it('una categoría desconocida se devuelve tal cual', () => {
    expect(categoriaEfectiva('LO_QUE_SEA', tipos)).toBe('LO_QUE_SEA');
  });

  it('un tipo DESACTIVADO sigue resolviendo (las órdenes viejas se calculan igual)', () => {
    const guardados = [tipo({ activo: false })];
    expect(categoriaEfectiva('INDUSTRIAL_38mm', guardados)).toBe('ROL');
    expect(esTipoPropio('INDUSTRIAL_38mm', guardados)).toBe(true);
  });

  it('ignora mayúsculas y espacios', () => {
    expect(categoriaEfectiva('  industrial_38mm ', tipos)).toBe('ROL');
    expect(tipoPorCategoria('INDUSTRIAL_38MM', tipos)?.base).toBe('ROL');
  });
});

describe('listas para los selectores', () => {
  it('suma los tipos activos y deja fuera los desactivados', () => {
    const tipos = [tipo(), tipo({ categoria: 'VIEJO_38mm', activo: false })];
    const ofrecidas = categoriasParaSelect(tipos);
    expect(ofrecidas).toContain('INDUSTRIAL_38mm');
    expect(ofrecidas).not.toContain('VIEJO_38mm');
    expect(ofrecidas).toHaveLength(20);
    expect(tiposActivos(tipos)).toHaveLength(1);
  });

  it('sin tipos, son exactamente las nativas', () => {
    expect(categoriasParaSelect()).toEqual([...CATEGORIAS_BUILTIN]);
  });
});

describe('diametroDelNombre', () => {
  it('lee el sufijo de la categoría', () => {
    expect(diametroDelNombre('DARK_38mm')).toBe(38);
    expect(diametroDelNombre('OSCURANTI_63mm')).toBe(63);
    expect(diametroDelNombre('ROL')).toBeNull();
  });
});

describe('validarTipos', () => {
  const errores = (t: TipoCortina[]) => validarTipos(t).errores;

  it('un tipo bien formado no tiene errores', () => {
    expect(validarTipos([tipo()])).toEqual({ errores: [], avisos: [] });
  });

  it('rechaza una categoría que ya existe', () => {
    expect(errores([tipo({ categoria: 'DARK_38mm', base: 'DARK_38mm' })])[0]).toContain(
      'ya existe',
    );
  });

  it('rechaza categorías repetidas', () => {
    expect(errores([tipo(), tipo({ nombre: 'Otro' })]).join(' ')).toContain('repetida');
  });

  it('rechaza caracteres que romperían la ruta de la fórmula', () => {
    expect(errores([tipo({ categoria: 'MI.TIPO 38' })])[0]).toContain('letras, números');
  });

  it('rechaza vertical y bee black como molde, y explica por qué', () => {
    const msg = errores([tipo({ categoria: 'LAMAS_NUEVAS', base: 'VERTICAL' })])[0];
    expect(msg).toContain('estructura propia');
    expect(errores([tipo({ categoria: 'CIERRE_NUEVO', base: 'BEEBLACK' })])).toHaveLength(1);
  });

  it('rechaza un molde inexistente', () => {
    expect(errores([tipo({ base: 'NO_EXISTE' })])[0]).toContain('no existe');
  });

  it('rechaza nombres que insinúan otro molde', () => {
    expect(errores([tipo({ categoria: 'DUO_PREMIUM', base: 'ROL' })])[0]).toContain('DUO');
    expect(errores([tipo({ categoria: 'PLETINA_X', base: 'ROL' })])[0]).toContain('PLETINA');
    expect(errores([tipo({ categoria: 'DARK_PRO_38mm', base: 'ROL' })]).join(' ')).toContain(
      'DARK',
    );
    expect(errores([tipo({ categoria: 'VERTICAL_PRO', base: 'ROL' })])[0]).toContain('VERTICAL');
  });

  it('acepta un nombre coherente con su molde', () => {
    expect(errores([tipo({ categoria: 'DARK_PRO_38mm', base: 'DARK_38mm' })])).toEqual([]);
    expect(errores([tipo({ categoria: 'ROL_PESADO', base: 'ROL' })])).toEqual([]);
  });

  it('rechaza un diámetro que no calza con el del molde', () => {
    expect(errores([tipo({ categoria: 'DARK_PRO_45mm', base: 'DARK_38mm' })])[0]).toContain(
      'se elegiría mal',
    );
  });

  it('avisa (sin bloquear) cuando falta el diámetro en el nombre', () => {
    const r = validarTipos([tipo({ categoria: 'DARK_PRO', base: 'DARK_38mm' })]);
    expect(r.errores).toEqual([]);
    expect(r.avisos[0]).toContain('_38mm');
  });

  it('avisa si dos tipos se pelean las mismas filas del catálogo', () => {
    const a = tipo({ categoria: 'UNO', base: 'ROL', sistemas: ['ROLLER_SIMPLE'] });
    const b = tipo({ categoria: 'DOS', base: 'ROL', sistemas: ['ROLLER_SIMPLE'] });
    expect(validarTipos([a, b]).avisos.join(' ')).toContain('mismas filas');
  });
});
