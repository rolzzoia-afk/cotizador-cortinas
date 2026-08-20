import { describe, expect, it } from 'vitest';
import { seccionesTipoCortina } from './selectorTipoCortina';
import { CATEGORIAS_FASE1 } from '@/modules/cotizador/categorias';
import type { TipoCortina } from '@/modules/descuentos/tiposCortina';

const variantesHabilitadas = (tipos?: readonly TipoCortina[]) =>
  seccionesTipoCortina(tipos)
    .flatMap((s) => s.tarjetas)
    .filter((t) => !t.deshabilitada)
    .flatMap((t) => t.variantes.map((v) => v.categoria));

describe('seccionesTipoCortina — la pantalla visual del tipo de cortina', () => {
  it('las variantes habilitadas cubren EXACTAMENTE las categorías del select de Fase 1', () => {
    // Si aparece una categoría nueva en el select y acá no, el vendedor de
    // terreno no la puede elegir; si acá hay una que el select no conoce, se
    // cotizaría algo que Fase 1 no sabe mostrar. Ambas cosas revientan acá.
    const delSelect = CATEGORIAS_FASE1.flatMap((g) => g.options.map((o) => o.value)).sort();
    expect([...variantesHabilitadas()].sort()).toEqual(delSelect);
  });

  it('cada categoría aparece UNA sola vez (sin tarjetas que se pisen)', () => {
    const todas = variantesHabilitadas();
    expect(new Set(todas).size).toBe(todas.length);
  });

  it('el toque en la tarjeta elige la variante por defecto (la primera)', () => {
    const porId = new Map(
      seccionesTipoCortina()
        .flatMap((s) => s.tarjetas)
        .map((t) => [t.id, t.variantes[0]?.categoria]),
    );
    expect(porId.get('roller')).toBe('ROL');
    expect(porId.get('dual')).toBe('ROL_DUAL');
    expect(porId.get('duo')).toBe('DUO_MANUAL_38mm');
    expect(porId.get('vertical')).toBe('VERTICAL');
    expect(porId.get('softlight')).toBe('SOFT_LIGHT_38mm');
    expect(porId.get('dark')).toBe('DARK_38mm');
    expect(porId.get('oscuranti')).toBe('OSCURANTI_63mm');
    expect(porId.get('beeblack')).toBe('BEEBLACK');
  });

  it('lo que la app no fabrica va deshabilitado y sin variantes (S. Dreams, Toldos)', () => {
    const tarjetas = seccionesTipoCortina().flatMap((s) => s.tarjetas);
    for (const id of ['sdreams', 'toldo']) {
      const t = tarjetas.find((x) => x.id === id);
      expect(t?.deshabilitada, id).toBeTruthy();
      expect(t?.variantes, id).toEqual([]);
    }
  });

  it('los tipos propios ACTIVOS entran como tarjeta en la sección de su grupo', () => {
    const tipos: TipoCortina[] = [
      { categoria: 'DARK_ECO', nombre: 'Dark económico', grupo: 'Sistemas de oscuridad', base: 'DARK_38mm', activo: true },
      { categoria: 'ROL_VIEJO', nombre: 'Roller viejo', grupo: '', base: 'ROL', activo: false },
    ];
    const secciones = seccionesTipoCortina(tipos);
    const oscuridad = secciones.find((s) => s.titulo === 'Sistemas de oscuridad');
    expect(oscuridad?.tarjetas.some((t) => t.id === 'tipo:DARK_ECO')).toBe(true);
    // El inactivo no aparece en ninguna parte.
    expect(
      secciones.flatMap((s) => s.tarjetas).some((t) => t.id === 'tipo:ROL_VIEJO'),
    ).toBe(false);
    // Un grupo desconocido crea sección propia al final.
    const propio = seccionesTipoCortina([
      { categoria: 'X_1', nombre: 'Equis', grupo: 'Inventos', base: 'ROL', activo: true },
    ]);
    expect(propio.at(-1)?.titulo).toBe('Inventos');
    expect(propio.at(-1)?.tarjetas[0]?.variantes[0]?.categoria).toBe('X_1');
  });
});
