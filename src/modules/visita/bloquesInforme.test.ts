import { describe, expect, it } from 'vitest';
import {
  BLOQUES_INFORME_DEFAULT,
  bloquesActivos,
  idDeBloque,
  moverBloque,
  normalizarBloquesInforme,
  textoBloques,
  type BloquesInforme,
} from './bloquesInforme';

const bloque = (id: string, extra: Partial<BloquesInforme['bloques'][0]> = {}) => ({
  id,
  texto: `Texto de ${id}`,
  orden: 1,
  activo: true,
  condicion: 'siempre' as const,
  ...extra,
});

describe('bloques de fábrica', () => {
  it('trae los del correo real, activos y en orden', () => {
    const b = BLOQUES_INFORME_DEFAULT.bloques;
    expect(b.length).toBeGreaterThanOrEqual(5);
    expect(b.map((x) => x.orden)).toEqual(b.map((_, i) => i + 1));
    expect(b.every((x) => x.activo)).toBe(true);
    expect(b.every((x) => x.texto.length > 20)).toBe(true);
  });

  it('el aviso de sistemas de oscuridad es el único condicional', () => {
    const cond = BLOQUES_INFORME_DEFAULT.bloques.filter((x) => x.condicion === 'oscuridad');
    expect(cond).toHaveLength(1);
    expect(cond[0].id).toBe('sistemas-oscuridad');
  });
});

describe('idDeBloque', () => {
  it('convierte el título en una llave estable', () => {
    expect(idDeBloque('Límite de perforación')).toBe('limite-de-perforacion');
    expect(idDeBloque('  Rodapié  ')).toBe('rodapie');
  });
});

describe('normalizarBloquesInforme', () => {
  it('lo guardado corrupto cae a los de fábrica', () => {
    // El informe nunca debe quedarse sin sus compromisos comerciales.
    expect(normalizarBloquesInforme(null)).toBe(BLOQUES_INFORME_DEFAULT);
    expect(normalizarBloquesInforme('basura')).toBe(BLOQUES_INFORME_DEFAULT);
    expect(normalizarBloquesInforme({ bloques: [] })).toBe(BLOQUES_INFORME_DEFAULT);
  });

  it('un bloque SIN TEXTO se descarta, aunque tenga título', () => {
    const out = normalizarBloquesInforme({
      bloques: [bloque('a'), { id: 'b', titulo: 'Solo título', texto: '  ' }],
    });
    expect(out.bloques.map((b) => b.id)).toEqual(['a']);
  });

  it('dos bloques con el mismo id NO se pisan', () => {
    const out = normalizarBloquesInforme({ bloques: [bloque('x'), bloque('x')] });
    expect(out.bloques.map((b) => b.id)).toEqual(['x', 'x-2']);
  });

  it('renumera respetando el orden que traían', () => {
    const out = normalizarBloquesInforme({
      bloques: [bloque('b', { orden: 9 }), bloque('a', { orden: 2 })],
    });
    expect(out.bloques.map((b) => b.id)).toEqual(['a', 'b']);
    expect(out.bloques.map((b) => b.orden)).toEqual([1, 2]);
  });

  it('una condición desconocida cae a «siempre» (mejor de más que de menos)', () => {
    const out = normalizarBloquesInforme({
      bloques: [{ ...bloque('a'), condicion: 'vertical' }],
    });
    expect(out.bloques[0].condicion).toBe('siempre');
  });

  it('`activo` solo se apaga con un false explícito', () => {
    const out = normalizarBloquesInforme({
      bloques: [{ id: 'a', texto: 'A' }, { ...bloque('b'), activo: false }],
    });
    expect(out.bloques.map((b) => b.activo)).toEqual([true, false]);
  });
});

describe('bloquesActivos', () => {
  const c: BloquesInforme = {
    bloques: [
      bloque('siempre-1', { orden: 1 }),
      bloque('apagado', { orden: 2, activo: false }),
      bloque('solo-osc', { orden: 3, condicion: 'oscuridad' }),
    ],
  };

  it('sin oscuridad, el bloque condicional NO entra', () => {
    expect(bloquesActivos(c, false).map((b) => b.id)).toEqual(['siempre-1']);
  });

  it('con oscuridad, el condicional entra al final', () => {
    expect(bloquesActivos(c, true).map((b) => b.id)).toEqual(['siempre-1', 'solo-osc']);
  });

  it('un bloque apagado nunca entra, haya oscuridad o no', () => {
    expect(bloquesActivos(c, true).some((b) => b.id === 'apagado')).toBe(false);
  });
});

describe('textoBloques', () => {
  it('une los bloques con línea en blanco, y el título va sobre su texto', () => {
    const c: BloquesInforme = {
      bloques: [
        bloque('a', { orden: 1, texto: 'Primero.' }),
        { ...bloque('b', { orden: 2, texto: 'Segundo.' }), titulo: 'Encabezado' },
      ],
    };
    expect(textoBloques(c, false)).toBe('Primero.\n\nEncabezado\nSegundo.');
  });

  it('sin bloques aplicables devuelve vacío (no una línea suelta)', () => {
    const c: BloquesInforme = { bloques: [bloque('x', { condicion: 'oscuridad' })] };
    expect(textoBloques(c, false)).toBe('');
  });

  it('las fotos del bloque bajan debajo de su texto', () => {
    const url = 'https://p.supabase.co/storage/v1/object/public/informe-assets/e/b/1.jpg';
    const c: BloquesInforme = {
      bloques: [{ ...bloque('a', { texto: 'Rodapié.' }), fotos: [url] }],
    };
    expect(textoBloques(c, false)).toBe(`Rodapié.\n[foto: ${url}]`);
  });
});

describe('fotos guardadas', () => {
  it('`normalizarBloquesInforme` limpia las URLs inseguras', () => {
    const url = 'https://p.supabase.co/storage/v1/object/public/informe-assets/e/b/1.jpg';
    const out = normalizarBloquesInforme({
      bloques: [{ ...bloque('a'), fotos: [url, 'javascript:alert(1)', url] }],
    });
    expect(out.bloques[0].fotos).toEqual([url]);
  });

  it('un bloque sin fotos queda con lista vacía, no undefined', () => {
    const out = normalizarBloquesInforme({ bloques: [bloque('a')] });
    expect(out.bloques[0].fotos).toEqual([]);
  });
});

describe('moverBloque', () => {
  const c: BloquesInforme = {
    bloques: [bloque('a', { orden: 1 }), bloque('b', { orden: 2 }), bloque('c', { orden: 3 })],
  };

  it('sube y baja renumerando', () => {
    expect(moverBloque(c, 'b', -1).bloques.map((b) => b.id)).toEqual(['b', 'a', 'c']);
    expect(moverBloque(c, 'b', 1).bloques.map((b) => b.id)).toEqual(['a', 'c', 'b']);
  });

  it('en los extremos no hace nada', () => {
    expect(moverBloque(c, 'a', -1)).toBe(c);
    expect(moverBloque(c, 'c', 1)).toBe(c);
    expect(moverBloque(c, 'no-existe', 1)).toBe(c);
  });
});
