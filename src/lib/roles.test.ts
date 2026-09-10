// Tests de la matriz de permisos (src/lib/roles.ts).
// Si cambias quién puede entrar a qué ruta, estos tests son tu red de
// seguridad: documentan el comportamiento esperado por rol.
import { describe, expect, it } from 'vitest';
import { SUBMODULOS_INVENTARIO, rolesDeSubmodulo } from '@/modules/inventario/navegacion';
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
    for (const ruta of [
      '/admin',
      '/optimizador',
      '/bodeguero',
      '/historial-corte',
      '/inventario/insumos',
      '/inventario/camionetas',
      '/inventario/tubos',
    ]) {
      expect(puedeAccederRuta('ventas', ruta), ruta).toBe(false);
    }
  });

  // Decisión del dueño en la lámina del mapa: ventas mira el tablero del
  // inventario y el catálogo de telas (para «descontar por venta» en terreno),
  // pero no entra a la bodega.
  it('ventas SÍ mira el tablero del inventario y las telas', () => {
    expect(puedeAccederRuta('ventas', '/inventario')).toBe(true);
    expect(puedeAccederRuta('ventas', '/inventario/telas')).toBe(true);
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
  // /produccion es el taller en pantalla: entra todo el que trabaja una OT en
  // el galpón, incluido el bodeguero (prepara los materiales de la orden).
  it('todo el taller entra a /produccion', () => {
    for (const rol of ['produccion', 'dimensionado', 'telas', 'operario', 'pruebas', 'bodeguero']) {
      expect(puedeAccederRuta(rol, '/produccion'), `${rol} → /produccion`).toBe(true);
    }
  });
  it('ventas NO entra a /produccion, y sin rol tampoco', () => {
    expect(puedeAccederRuta('ventas', '/produccion')).toBe(false);
    expect(puedeAccederRuta('', '/produccion')).toBe(false);
    expect(puedeAccederRuta('rol-inventado', '/produccion')).toBe(false);
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

// Las reglas de /inventario/* se GENERAN desde SUBMODULOS_INVENTARIO. Estos
// tests son el puente: que lo que dice el registro sea lo que bloquea la app.
describe('puedeAccederRuta — submódulos de /inventario', () => {
  it('cada submódulo deja entrar exactamente a los roles de su registro', () => {
    for (const sub of SUBMODULOS_INVENTARIO) {
      if (sub.estado !== 'listo') continue;
      for (const rol of ROLES_DISPONIBLES) {
        const esperado = rol === 'admin' || rolesDeSubmodulo(sub).includes(rol);
        expect(puedeAccederRuta(rol, sub.ruta), `${rol} → ${sub.ruta}`).toBe(esperado);
      }
    }
  });

  it('una ruta más larga manda sobre la más corta que la contiene', () => {
    // Contar es de bodega; el resto de Conteo lo abre y lo cierra el admin.
    expect(puedeAccederRuta('bodeguero', '/inventario/conteo/contar')).toBe(true);
    expect(puedeAccederRuta('bodeguero', '/inventario/conteo')).toBe(true);
    expect(puedeAccederRuta('produccion', '/inventario/conteo/contar')).toBe(false);
    // Y el Tablero no le abre la puerta a sus hijos.
    expect(puedeAccederRuta('dimensionado', '/inventario')).toBe(true);
    expect(puedeAccederRuta('dimensionado', '/inventario/insumos')).toBe(false);
    expect(puedeAccederRuta('ventas', '/inventario/telas')).toBe(true);
    expect(puedeAccederRuta('ventas', '/inventario/camionetas')).toBe(false);
  });

  it('una subruta hereda el permiso de su submódulo', () => {
    expect(puedeAccederRuta('bodeguero', '/inventario/insumos/MEC 18')).toBe(true);
    expect(puedeAccederRuta('bodeguero', '/inventario/insumos/ubicaciones')).toBe(true);
    expect(puedeAccederRuta('ventas', '/inventario/insumos/MEC 18')).toBe(false);
  });

  it('las rutas viejas parecidas siguen con su propia regla', () => {
    // Se parecen a /inventario pero NO cuelgan de él: la regla generada pide
    // que después venga una barra o el final.
    expect(puedeAccederRuta('bodeguero', '/inventario-conteo')).toBe(true);
    expect(puedeAccederRuta('bodeguero', '/inventario-telas-prueba')).toBe(false);
    expect(puedeAccederRuta('produccion', '/inventario-conteo')).toBe(false);
  });

  it('Compras la abre bodega y la mira producción; el resto no entra', () => {
    // Bodega pide lo que falta y recibe lo que llega; producción solo quiere
    // saber qué viene en camino. Ventas, dimensionado, telas y pruebas no
    // tienen nada que hacer ahí.
    for (const rol of ['bodeguero', 'operario', 'produccion', 'admin']) {
      expect(puedeAccederRuta(rol, '/inventario/compras'), rol).toBe(true);
    }
    for (const rol of ROLES_DISPONIBLES) {
      if (['admin', 'bodeguero', 'operario', 'produccion'].includes(rol)) continue;
      expect(puedeAccederRuta(rol, '/inventario/compras'), rol).toBe(false);
    }
    // La ficha de una orden hereda el mismo permiso que la lista.
    expect(puedeAccederRuta('bodeguero', '/inventario/compras/abc-123')).toBe(true);
    expect(puedeAccederRuta('ventas', '/inventario/compras/abc-123')).toBe(false);
  });
});
