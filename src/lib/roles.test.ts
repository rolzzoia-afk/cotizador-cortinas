// Tests de la matriz de permisos (src/lib/roles.ts).
// Si cambias quién puede entrar a qué ruta, estos tests son tu red de
// seguridad: documentan el comportamiento esperado por rol.
import { describe, expect, it } from 'vitest';
import { esRolAdmin, puedeAccederRuta, ROLES_DISPONIBLES } from './roles';

describe('esRolAdmin', () => {
  it('admin y superadmin son admin', () => {
    expect(esRolAdmin('admin')).toBe(true);
    expect(esRolAdmin('superadmin')).toBe(true);
    expect(esRolAdmin('  ADMIN  ')).toBe(true);
  });

  it('los demás roles no son admin', () => {
    for (const rol of ['ventas', 'bodeguero', 'produccion', 'operario', '', null, undefined]) {
      expect(esRolAdmin(rol)).toBe(false);
    }
  });
});

describe('puedeAccederRuta — admin', () => {
  it('admin accede a todo', () => {
    for (const ruta of ['/admin', '/ojo-de-dios', '/panel', '/leads', '/optimizador', '/bodeguero', '/ots/123/fase2']) {
      expect(puedeAccederRuta('admin', ruta)).toBe(true);
    }
  });
});

describe('puedeAccederRuta — secciones solo admin', () => {
  const soloAdmin = ['/admin', '/ojo-de-dios', '/inventario-telas-prueba'];
  it('ningún rol no-admin entra a Admin ni Ojo de Dios', () => {
    for (const rol of ROLES_DISPONIBLES.filter((r) => r !== 'admin')) {
      for (const ruta of soloAdmin) {
        expect(puedeAccederRuta(rol, ruta), `${rol} → ${ruta}`).toBe(false);
      }
    }
  });
});

describe('puedeAccederRuta — ventas', () => {
  it('ventas accede a sus secciones', () => {
    for (const ruta of ['/panel', '/cotizar', '/ventas', '/leads', '/inteligencia', '/cotizador-jefe', '/ots/abc/fase1']) {
      expect(puedeAccederRuta('ventas', ruta)).toBe(true);
    }
  });
  it('ventas NO accede al taller ni al admin', () => {
    for (const ruta of ['/admin', '/optimizador', '/bodeguero', '/inventario', '/historial-corte']) {
      expect(puedeAccederRuta('ventas', ruta)).toBe(false);
    }
  });
});

describe('puedeAccederRuta — taller', () => {
  it('operario accede a todas las secciones de taller', () => {
    for (const ruta of ['/telas', '/inventario', '/inventario-conteo', '/optimizador', '/bodeguero', '/camionetas', '/historial-corte', '/historial-tubos']) {
      expect(puedeAccederRuta('operario', ruta)).toBe(true);
    }
  });
  it('operario NO accede a ventas/leads/admin', () => {
    for (const ruta of ['/ventas', '/leads', '/inteligencia', '/admin', '/panel']) {
      expect(puedeAccederRuta('operario', ruta)).toBe(false);
    }
  });
  it('bodeguero accede a bodega pero no al optimizador', () => {
    expect(puedeAccederRuta('bodeguero', '/bodeguero')).toBe(true);
    expect(puedeAccederRuta('bodeguero', '/camionetas')).toBe(true);
    expect(puedeAccederRuta('bodeguero', '/optimizador')).toBe(false);
  });
  it('produccion accede al optimizador e historiales', () => {
    expect(puedeAccederRuta('produccion', '/optimizador')).toBe(true);
    expect(puedeAccederRuta('produccion', '/historial-corte')).toBe(true);
    expect(puedeAccederRuta('produccion', '/historial-tubos')).toBe(true);
  });
});

describe('puedeAccederRuta — roles vacíos o desconocidos', () => {
  it('sin rol no entra a NINGUNA sección con regla', () => {
    for (const ruta of ['/admin', '/panel', '/optimizador', '/leads', '/bodeguero']) {
      expect(puedeAccederRuta('', ruta)).toBe(false);
      expect(puedeAccederRuta(null, ruta)).toBe(false);
      expect(puedeAccederRuta('rol-inventado', ruta)).toBe(false);
    }
  });
  it('cualquier usuario logueado accede a rutas sin regla (landing, setup)', () => {
    expect(puedeAccederRuta('', '/')).toBe(true);
    expect(puedeAccederRuta('rol-inventado', '/landing')).toBe(true);
    expect(puedeAccederRuta(null, '/setup')).toBe(true);
  });
});

describe('puedeAccederRuta — prefijos no se confunden', () => {
  it('/inventario-conteo no hereda la regla de /inventario (y viceversa)', () => {
    // ambos son de bodeguero/operario, pero verificamos que el orden de
    // reglas resuelva el prefijo más específico primero
    expect(puedeAccederRuta('bodeguero', '/inventario-conteo')).toBe(true);
    expect(puedeAccederRuta('produccion', '/inventario-conteo')).toBe(false);
  });
  it('/inventario-telas-prueba es solo admin aunque empiece con /inventario', () => {
    expect(puedeAccederRuta('bodeguero', '/inventario-telas-prueba')).toBe(false);
  });
  it('/optimizador-tela no hereda la regla de /optimizador (telas/dimensionado sí entran)', () => {
    expect(puedeAccederRuta('telas', '/optimizador-tela')).toBe(true);
    expect(puedeAccederRuta('dimensionado', '/optimizador-tela')).toBe(true);
    // telas NO entra al optimizador de tubos
    expect(puedeAccederRuta('telas', '/optimizador')).toBe(false);
  });
});
