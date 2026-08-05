// Persistencia de los tipos de cortina: qué sobrevive a un JSON guardado a
// medias y cómo se ven en los cuadros de Admin.
import { describe, expect, it, vi } from 'vitest';
import { normalizarReglasSeleccion, validarReglasSeleccion } from './reglasSeleccion';
import { FORMULAS_DEFAULT, conCampoEditado, normalizarFormulas } from './formulasFamilias';
import { construirCuadros } from './cuadrosFormulas';
import { REGLAS_MECANISMO } from './reglas-mecanismo';
import { REGLAS_TUBERIA } from './reglas-tuberia';
import { COLORES_BUILTIN } from './coloresAccesorio';
import type { TipoCortina } from './tiposCortina';

const TIPO: TipoCortina = {
  categoria: 'DARK_PRO_38mm',
  nombre: 'Dark Pro',
  grupo: 'Tipos propios',
  base: 'DARK_38mm',
  activo: true,
};

describe('normalizar los tipos guardados', () => {
  it('sin tipos guardados la lista queda vacía (no cae al default)', () => {
    expect(normalizarReglasSeleccion({}).tipos).toEqual([]);
    expect(normalizarReglasSeleccion({ tipos: [] }).tipos).toEqual([]);
    expect(normalizarReglasSeleccion({ tipos: 'basura' }).tipos).toEqual([]);
  });

  it('conserva un tipo válido y completa lo que falta', () => {
    const r = normalizarReglasSeleccion({
      tipos: [{ categoria: 'MI_TIPO', base: 'ROL' }],
    });
    expect(r.tipos).toEqual([
      { categoria: 'MI_TIPO', nombre: 'MI_TIPO', grupo: 'Tipos propios', base: 'ROL', activo: true },
    ]);
  });

  it('descarta un tipo con molde inválido y avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = normalizarReglasSeleccion({
      tipos: [
        { categoria: 'BUENO', base: 'ROL' },
        { categoria: 'MALO', base: 'BEEBLACK' },
        { categoria: 'SIN_BASE' },
        { categoria: 'MI TIPO', base: 'ROL' },
      ],
    });
    expect(r.tipos.map((t) => t.categoria)).toEqual(['BUENO']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('el validador ve los tipos junto con las reglas', () => {
    const r = validarReglasSeleccion({
      mecanismo: REGLAS_MECANISMO,
      tuberia: REGLAS_TUBERIA,
      tipos: [{ ...TIPO, categoria: 'DARK_38mm' }],
      colores: COLORES_BUILTIN,
    });
    expect(r.errores.join(' ')).toContain('ya existe');
  });

  it('avisa cuando una regla quedó apuntando a un tipo desactivado', () => {
    const mecanismo = {
      ...REGLAS_MECANISMO,
      reglasAncho: [
        ...REGLAS_MECANISMO.reglasAncho,
        {
          descripcion: 'Banda del tipo propio',
          categoria: 'DARK_PRO_38mm',
          anchoMinM: 2.2,
          anchoMaxM: 3,
          mec: 28,
          tubo: 'E65',
          nota: '',
        },
      ],
    };
    const r = validarReglasSeleccion({
      mecanismo,
      tuberia: REGLAS_TUBERIA,
      tipos: [{ ...TIPO, activo: false }],
      colores: COLORES_BUILTIN,
    });
    expect(r.errores).toEqual([]);
    expect(r.avisos.join(' ')).toContain('desactivado');
  });
});

describe('parche de fórmulas por tipo', () => {
  it('sobrevive a normalizarFormulas (el mapa es abierto)', () => {
    const guardado = {
      oscuridad: { porTipo: { DARK_PRO_38mm: { tuboPaso: [8, 5, 5.4] } } },
    };
    const f = normalizarFormulas(guardado);
    expect(f.oscuridad.porTipo.DARK_PRO_38mm.tuboPaso).toEqual([8, 5, 5.4]);
    // El resto sigue siendo el de fábrica.
    expect(f.oscuridad.tuboPaso.DARK).toEqual(FORMULAS_DEFAULT.oscuridad.tuboPaso.DARK);
  });

  it('descarta ternas corruptas pero conserva las buenas del mismo parche', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = normalizarFormulas({
      oscuridad: {
        porTipo: {
          DARK_PRO_38mm: { tuboPaso: [8, 5], cenefaAdj: [-0.3, 7.5, 15.8] },
        },
      },
    });
    expect(f.oscuridad.porTipo.DARK_PRO_38mm.tuboPaso).toBeUndefined();
    expect(f.oscuridad.porTipo.DARK_PRO_38mm.cenefaAdj).toEqual([-0.3, 7.5, 15.8]);
    warn.mockRestore();
  });

  it('descarta el parche entero si no quedó ningún número', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = normalizarFormulas({
      oscuridad: { porTipo: { X: { tuboPaso: 'no' }, '': { cenefaAdj: [1, 2, 3] } } },
    });
    expect(f.oscuridad.porTipo).toEqual({});
    warn.mockRestore();
  });

  it('sin nada guardado el mapa queda vacío', () => {
    expect(normalizarFormulas({}).oscuridad.porTipo).toEqual({});
    expect(normalizarFormulas(null).oscuridad.porTipo).toEqual({});
  });

  it('se edita por ruta como cualquier otra fórmula', () => {
    const conParche = {
      ...FORMULAS_DEFAULT,
      oscuridad: {
        ...FORMULAS_DEFAULT.oscuridad,
        porTipo: { DARK_PRO_38mm: { tuboPaso: [4.8, 5, 5.4] as [number, number, number] } },
      },
    };
    const editado = conCampoEditado(conParche, 'oscuridad.porTipo.DARK_PRO_38mm.tuboPaso.0', 9);
    expect(editado.oscuridad.porTipo.DARK_PRO_38mm.tuboPaso).toEqual([9, 5, 5.4]);
  });
});

describe('cuadros de Admin', () => {
  it('un tipo de oscuridad agrega sus cuadros (uno por variante)', () => {
    const sinTipos = construirCuadros([]);
    const conTipo = construirCuadros([], undefined, FORMULAS_DEFAULT, [TIPO]);
    expect(conTipo.length).toBe(sinTipos.length + 3);
    const propios = conTipo.filter((c) => c.id.startsWith('DARK_PRO_38mm|'));
    expect(propios).toHaveLength(3);
    expect(propios[0].grupo).toBe('Tipos propios');
    expect(propios[0].titulo).toContain('Dark Pro');
  });

  it('sus filas editan el parche del tipo, no la tabla del molde', () => {
    const [cuadro] = construirCuadros([], undefined, FORMULAS_DEFAULT, [TIPO]).filter((c) =>
      c.id.startsWith('DARK_PRO_38mm|'),
    );
    const campos = cuadro.filas.map((f) => f.campo).filter(Boolean);
    expect(campos.some((c) => c!.startsWith('oscuridad.porTipo.DARK_PRO_38mm.'))).toBe(true);
    expect(campos.some((c) => c!.includes('.DARK.'))).toBe(false);
  });

  it('un tipo sobre un molde de catálogo (roller) no agrega cuadro de oscuridad', () => {
    const rol: TipoCortina = { ...TIPO, categoria: 'ROL_PRO', base: 'ROL' };
    expect(construirCuadros([], undefined, FORMULAS_DEFAULT, [rol])).toHaveLength(
      construirCuadros([]).length,
    );
  });

  it('un tipo desactivado no aparece en los cuadros', () => {
    const off = construirCuadros([], undefined, FORMULAS_DEFAULT, [{ ...TIPO, activo: false }]);
    expect(off).toHaveLength(construirCuadros([]).length);
  });
});
