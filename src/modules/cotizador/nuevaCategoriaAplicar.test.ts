import { describe, expect, it } from 'vitest';
import { aplicarNuevaCategoria } from './nuevaCategoriaAplicar';
import { borrador, ctx, fila } from './__fixtures__/nuevaCategoria';
import { flujoDeProducto } from './flujoCatalogo';
import { chipDeProducto, filtrosCatalogoCon } from './filtrosCatalogo';
import {
  SISTEMA_INVERTIDA_KEY,
  SISTEMA_VERTICAL_KEY,
  normalizarReglasPrecios,
  validarReglasPrecios,
} from './reglasPrecios';

/** El caso del dueño: LINO roller con su tela de referencia y dos telas más. */
function lino() {
  const c = ctx();
  const base = borrador({ moldes: { LINO_P: 'BLACKOUT_P', LINO_D: 'BLACKOUT_D' } });
  const b = {
    ...base,
    filas: [
      fila(base, c, {
        codInt: 'LN-P',
        descripcion: 'COLOR POR DEFINIR',
        referencia: true,
        costo: 22869,
        precio: 41868,
        anchoRolloM: 2.95,
      }),
      fila(base, c, { codInt: 'LN 01', descripcion: 'RUSTICO TOSTADO', precio: 30000 }),
      fila(base, c, {
        codInt: 'LN 02',
        tipo: 'DELUX',
        producto: 'ROLLER LINO DELUX',
        descripcion: 'IVORY',
        precio: 35000,
      }),
    ],
  };
  return { b, c, r: aplicarNuevaCategoria(b, c) };
}

describe('aplicarNuevaCategoria — el catálogo', () => {
  it('escribe cada producto con su familia y su ficha completa', () => {
    const { r } = lino();
    const p = r.catalogo['LN 01'];
    expect(p.cod).toBe('LINO_P');
    expect(p.producto).toBe('ROLLER LINO PREMIUM');
    expect(p.tipo).toBe('PREMIUM');
    expect(p.precio).toBe(30000);
    expect(p.fechaAlta).toBe('2026-09-14');
    expect(p.ganancia).toBe(0.65);
    expect(p.categoriaFabricacion).toBe('ROL');
    expect(r.catalogo['LN 02'].cod).toBe('LINO_D');
    // El ancho de rollo va a su mapa, que es el que mira el motor.
    expect(r.anchoRollo['LN 01']).toBe(2.98);
    expect(r.anchoRollo['LN-P']).toBe(2.95);
  });

  it('no toca el catálogo que recibió', () => {
    const { c, r } = lino();
    expect(c.catalogo['LN 01']).toBeUndefined();
    expect(Object.keys(r.catalogo)).toContain('BK 18');
  });

  it('el descuento se guarda como fracción, que es lo que lee la grilla', () => {
    const c = ctx();
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const r = aplicarNuevaCategoria(
      { ...b, filas: [fila(b, c, { descuentoPct: 25, referencia: true })] },
      c,
    );
    expect(r.catalogo['LN 01'].descuento).toBe(0.25);
  });
});

describe('aplicarNuevaCategoria — cómo se cobra', () => {
  it('copia la receta del molde, con sus variantes, sin compartir objetos', () => {
    const { c, r } = lino();
    expect(r.reglas.recetas.LINO_P).toEqual(c.reglas.recetas.BLACKOUT_P);
    expect(r.reglas.recetas.LINO_P).not.toBe(c.reglas.recetas.BLACKOUT_P);
    expect(r.reglas.recetas.LINO_P[0]).not.toBe(c.reglas.recetas.BLACKOUT_P[0]);
    // Las variantes del molde viajan con él: sin la `|B`, una tela de gama B
    // de esta familia se cobraría con la receta de la gama A.
    expect(r.reglas.recetas['LINO_P|B']).toEqual(c.reglas.recetas['BLACKOUT_P|B']);
    expect(r.reglas.recetas['LINO_P|INV']).toEqual(c.reglas.recetas['BLACKOUT_P|INV']);
    expect(r.reglas.recetas['LINO_D|INV']).toEqual(c.reglas.recetas['BLACKOUT_D|INV']);
  });

  it('una familia que se invierte entra al sistema de la invertida', () => {
    const { c, r } = lino();
    const antes = c.reglas.sistemas[SISTEMA_INVERTIDA_KEY].familias;
    const ahora = r.reglas.sistemas[SISTEMA_INVERTIDA_KEY].familias;
    expect(ahora).toContain('LINO_P');
    expect(ahora).toContain('LINO_D');
    expect(antes).not.toContain('LINO_P'); // el original no se movió
  });

  it('la standard no se inventa una invertida que su molde no tiene', () => {
    const c = ctx();
    const b = borrador({ moldes: { LINO_S: 'BLACKOUT_S' } });
    const r = aplicarNuevaCategoria(
      { ...b, filas: [fila(b, c, { tipo: 'STANDARD', referencia: true })] },
      c,
    );
    expect(r.reglas.recetas['LINO_S|INV']).toBeUndefined();
    expect(r.reglas.sistemas[SISTEMA_INVERTIDA_KEY].familias).not.toContain('LINO_S');
  });

  it('la tela de referencia queda declarada; sin ella, vacío = la más cara', () => {
    const { r } = lino();
    expect(r.reglas.arquetipos.LINO_P).toBe('LN-P');
    expect(r.reglas.arquetipos.LINO_D).toBe('');
  });

  // La prueba de fuego: cotizar un producto nuevo con las reglas nuevas.
  it('la tela nueva se cobra con SU receta y al precio de su referencia', () => {
    const { r } = lino();
    const f = flujoDeProducto(r.catalogo['LN 01'], 'LN 01', r.catalogo, r.reglas);
    expect(f.entra).toBe('cortina');
    expect(f.cod).toBe('LINO_P');
    expect(f.recetaKey).toBe('LINO_P');
    expect(f.recetaPropia).toBe(true);
    expect(f.telaReferencia).toBe('LN-P');
    expect(f.precioMl).toBe(41868);
    expect(f.origenPrecio).toBe('arquetipo');
    expect(f.referenciaDeclaradaRota).toBe('');
  });

  it('las reglas nuevas pasan la validación y sobreviven al viaje a la base', () => {
    const { r } = lino();
    expect(validarReglasPrecios(r.reglas).errores).toEqual([]);
    const ida = normalizarReglasPrecios(JSON.parse(JSON.stringify(r.reglas)));
    expect(ida.recetas.LINO_P).toEqual(r.reglas.recetas.LINO_P);
    expect(ida.arquetipos.LINO_P).toBe('LN-P');
    expect(ida.sistemas[SISTEMA_INVERTIDA_KEY].familias).toContain('LINO_P');
  });
});

describe('aplicarNuevaCategoria — verticales, dúos y accesorios', () => {
  it('una vertical entra al sistema vertical y declara de dónde sale su tela', () => {
    const c = ctx();
    const b = borrador({ tipo: 'vertical', categoriaFabricacion: 'VERTICAL' });
    const f = fila(b, c, {
      codInt: 'LN-V-P',
      producto: 'CORTINA VERTICAL LINO PREMIUM',
      referencia: true,
      precio: 40000,
    });
    const r = aplicarNuevaCategoria({ ...b, filas: [f] }, c);
    expect(r.reglas.baseVertical.LINO_V_P).toBe('LN-V-P');
    // Sin esto sus insumos VER* se cobrarían $0: ya no están en la tabla general.
    expect(r.reglas.sistemas[SISTEMA_VERTICAL_KEY].familias).toContain('LINO_V_P');
    // La receta es la de todas las verticales: no se copia ninguna.
    expect(r.reglas.recetas.LINO_V_P).toBeUndefined();
    const flujo = flujoDeProducto(r.catalogo['LN-V-P'], 'LN-V-P', r.catalogo, r.reglas);
    expect(flujo.esVertical).toBe(true);
    expect(flujo.recetaKey).toBe('VERTICAL');
    expect(validarReglasPrecios(r.reglas).errores).toEqual([]);
  });

  it('una vertical puede sacar el precio de un código que ya existe', () => {
    const c = ctx();
    const b = borrador({ tipo: 'vertical', categoriaFabricacion: 'VERTICAL' });
    // Más barata que la base: así el precio lo fija la base y no ella misma
    // (la referencia es un PISO, y una tela vendida más cara le gana).
    const f = fila(b, c, {
      codInt: 'LN-V-01',
      producto: 'CORTINA VERTICAL LINO PREMIUM',
      precio: 20000,
    });
    const r = aplicarNuevaCategoria(
      { ...b, filas: [f], baseVerticalDe: { LINO_V_P: 'BK-P' } },
      c,
    );
    expect(r.reglas.baseVertical.LINO_V_P).toBe('BK-P');
    const flujo = flujoDeProducto(r.catalogo['LN-V-01'], 'LN-V-01', r.catalogo, r.reglas);
    expect(flujo.origenPrecio).toBe('baseVertical');
    expect(flujo.precioMl).toBe(29231);
  });

  it('un dúo se cobra como dúo', () => {
    const c = ctx();
    const b = borrador({
      tipo: 'duo',
      baseCod: 'DUOLINO',
      categoriaFabricacion: 'DUO_MANUAL_38mm',
      moldes: { DUOLINO_P: 'DUOBK_P' },
    });
    const f = fila(b, c, { codInt: 'DL 01', producto: 'DUO LINO PREMIUM', referencia: true });
    const r = aplicarNuevaCategoria({ ...b, filas: [f] }, c);
    expect(r.reglas.recetas.DUOLINO_P).toEqual(c.reglas.recetas.DUOBK_P);
    const flujo = flujoDeProducto(r.catalogo['DL 01'], 'DL 01', r.catalogo, r.reglas);
    expect(flujo.esDuo).toBe(true);
    expect(flujo.recetaPropia).toBe(true);
  });

  it('una categoría de accesorios no toca las reglas de precio', () => {
    const c = ctx();
    const b = borrador({ tipo: 'accesorio', nombre: 'Promo', baseCod: 'PROMO' });
    const f = fila(b, c, { codInt: 'PR 01', tipo: 'ACCESORIO' });
    const r = aplicarNuevaCategoria({ ...b, filas: [f] }, c);
    expect(r.reglas).toBe(c.reglas);
    expect(r.catalogo['PR 01'].cod).toBe('ACCESORIO');
    expect(r.catalogo['PR 01'].categoriaFabricacion).toBeUndefined();
    expect(r.resumen.adicionales).toEqual(['PR 01']);
  });

  it('agregar productos a una familia existente no toca reglas ni pastillas', () => {
    const c = ctx();
    const b = borrador({ familiaExistente: 'BLACKOUT_P' });
    const r = aplicarNuevaCategoria({ ...b, filas: [fila(b, c, { codInt: 'BK 99' })] }, c);
    expect(r.reglas).toBe(c.reglas);
    expect(r.chips).toEqual([...c.chips]);
    expect(r.catalogo['BK 99'].cod).toBe('BLACKOUT_P');
    expect(r.catalogo['BK 99'].chip).toBeUndefined();
  });
});

describe('aplicarNuevaCategoria — la pastilla del catálogo', () => {
  it('la pastilla nueva agrupa por familia: los productos no la nombran', () => {
    const { r } = lino();
    const chip = r.chips.at(-1)!;
    expect(chip.id).toBe('CUSTOM-LINO');
    expect(chip.familias).toEqual(['LINO_P', 'LINO_D']);
    expect(r.catalogo['LN 01'].chip).toBeUndefined();
    const ids = filtrosCatalogoCon(r.chips).map((f) => f.id);
    expect(chipDeProducto(r.catalogo['LN 01'], 'LN 01', ids, r.chips)).toBe('CUSTOM-LINO');
  });

  it('una pastilla de fábrica se escribe en cada producto', () => {
    const c = ctx();
    const b = borrador({
      pastilla: { modo: 'existente', id: 'BK' },
      moldes: { LINO_P: 'BLACKOUT_P' },
    });
    const r = aplicarNuevaCategoria({ ...b, filas: [fila(b, c, { referencia: true })] }, c);
    expect(r.chips).toEqual([]);
    expect(r.catalogo['LN 01'].chip).toBe('BK');
    expect(chipDeProducto(r.catalogo['LN 01'], 'LN 01')).toBe('BK');
  });

  it('una pastilla propia que ya existe suma la familia nueva', () => {
    const c = ctx({ chips: [{ id: 'CUSTOM-PROMO', label: 'Promo', hex: '#ff0000', familias: ['X_P'] }] });
    const b = borrador({
      pastilla: { modo: 'existente', id: 'CUSTOM-PROMO' },
      moldes: { LINO_P: 'BLACKOUT_P' },
    });
    const r = aplicarNuevaCategoria({ ...b, filas: [fila(b, c, { referencia: true })] }, c);
    expect(r.chips[0].familias).toEqual(['X_P', 'LINO_P']);
    expect(c.chips[0].familias).toEqual(['X_P']); // el original no se movió
  });
});

describe('aplicarNuevaCategoria — el resumen para el último paso', () => {
  it('dice dónde quedó conectada cada familia', () => {
    const { r } = lino();
    expect(r.resumen.productos).toBe(3);
    expect(r.resumen.categoriaFabricacion).toBe('ROL');
    expect(r.resumen.pastilla).toMatchObject({ id: 'CUSTOM-LINO', nueva: true, porFamilia: true });
    const premium = r.resumen.familias.find((f) => f.cod === 'LINO_P')!;
    expect(premium.molde).toBe('BLACKOUT_P');
    expect(premium.referencia).toBe('LN-P');
    expect(premium.enInvertida).toBe(true);
    expect(premium.recetasCopiadas).toContain('LINO_P|B');
  });

  it('avisa de las telas que quedan sin ancho de rollo', () => {
    const c = ctx();
    const b = borrador({ moldes: { LINO_P: 'BLACKOUT_P' } });
    const r = aplicarNuevaCategoria(
      { ...b, filas: [fila(b, c, { referencia: true, anchoRolloM: 0 })] },
      c,
    );
    expect(r.resumen.sinAncho).toEqual(['LN 01']);
    expect(r.avisos.join(' ')).toMatch(/sin ancho de rollo/i);
  });
});
