// Si cambias quién ve qué submódulo del inventario, estos tests son la red de
// seguridad. La matriz de abajo es la que aprobó el dueño en la lámina «Mapa
// del módulo» (docs/diseno/inventario/Mapa.dc.html).

import { describe, expect, it } from 'vitest';
import { ROLES_DISPONIBLES } from '@/lib/roles';
import {
  DATOS_SENSIBLES,
  GRUPOS_INVENTARIO,
  SUBMODULOS_INVENTARIO,
  esRutaPlena,
  itemsMenuInferior,
  puedeEditar,
  puedeVer,
  puedeVerDato,
  puedeVerMontos,
  rolesDeSubmodulo,
  submoduloDeRuta,
  submodulosVisibles,
} from './navegacion';

// '●' entra y edita · '◐' entra y solo mira · '—' no lo ve.
// Admin ve y edita todo, así que no está en la tabla.
const MATRIZ: Record<string, Record<string, '●' | '◐' | '—'>> = {
  //             ventas bodeguero produccion dimensionado telas operario pruebas
  tablero: { ventas: '◐', bodeguero: '●', produccion: '●', dimensionado: '●', telas: '●', operario: '●', pruebas: '—' }, // prettier-ignore
  insumos: { ventas: '—', bodeguero: '●', produccion: '◐', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  telas: { ventas: '◐', bodeguero: '●', produccion: '●', dimensionado: '●', telas: '●', operario: '●', pruebas: '—' }, // prettier-ignore
  colmena: { ventas: '—', bodeguero: '●', produccion: '●', dimensionado: '●', telas: '●', operario: '●', pruebas: '—' }, // prettier-ignore
  tubos: { ventas: '—', bodeguero: '◐', produccion: '●', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  camionetas: { ventas: '—', bodeguero: '●', produccion: '—', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  despacho: { ventas: '—', bodeguero: '●', produccion: '—', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  movimientos: { ventas: '—', bodeguero: '●', produccion: '●', dimensionado: '—', telas: '●', operario: '●', pruebas: '—' }, // prettier-ignore
  conteo: { ventas: '—', bodeguero: '◐', produccion: '—', dimensionado: '—', telas: '—', operario: '◐', pruebas: '—' }, // prettier-ignore
  contar: { ventas: '—', bodeguero: '●', produccion: '—', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  mermas: { ventas: '—', bodeguero: '●', produccion: '●', dimensionado: '●', telas: '●', operario: '●', pruebas: '—' }, // prettier-ignore
  alertas: { ventas: '—', bodeguero: '●', produccion: '◐', dimensionado: '—', telas: '—', operario: '●', pruebas: '—' }, // prettier-ignore
  compras: { ventas: '—', bodeguero: '—', produccion: '—', dimensionado: '—', telas: '—', operario: '—', pruebas: '—' }, // prettier-ignore
  reportes: { ventas: '—', bodeguero: '—', produccion: '—', dimensionado: '—', telas: '—', operario: '—', pruebas: '—' }, // prettier-ignore
  configuracion: { ventas: '—', bodeguero: '—', produccion: '—', dimensionado: '—', telas: '—', operario: '—', pruebas: '—' }, // prettier-ignore
  auditoria: { ventas: '—', bodeguero: '—', produccion: '—', dimensionado: '—', telas: '—', operario: '—', pruebas: '—' }, // prettier-ignore
};

describe('el registro está sano', () => {
  it('no hay dos submódulos con el mismo id ni con la misma ruta', () => {
    const ids = SUBMODULOS_INVENTARIO.map((s) => s.id);
    const rutas = SUBMODULOS_INVENTARIO.map((s) => s.ruta);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('todas las rutas cuelgan de /inventario y no terminan en barra', () => {
    for (const s of SUBMODULOS_INVENTARIO) {
      expect(s.ruta === '/inventario' || s.ruta.startsWith('/inventario/'), s.id).toBe(true);
      expect(s.ruta.endsWith('/'), s.id).toBe(false);
    }
  });

  it('los roles que nombra existen de verdad', () => {
    for (const s of SUBMODULOS_INVENTARIO) {
      for (const rol of rolesDeSubmodulo(s)) {
        expect(ROLES_DISPONIBLES as readonly string[], `${s.id} → ${rol}`).toContain(rol);
      }
    }
  });

  it('nadie aparece a la vez como editor y como mirón del mismo submódulo', () => {
    for (const s of SUBMODULOS_INVENTARIO) {
      for (const rol of s.lectura ?? []) {
        expect(s.roles, `${s.id} → ${rol}`).not.toContain(rol);
      }
    }
  });

  it('cada submódulo cae en uno de los tres grupos de la barra', () => {
    const grupos = GRUPOS_INVENTARIO.map((g) => g.id);
    for (const s of SUBMODULOS_INVENTARIO) {
      expect(grupos, s.id).toContain(s.grupo);
    }
  });

  it('la matriz del test cubre exactamente los submódulos que hay', () => {
    expect(Object.keys(MATRIZ).sort()).toEqual(SUBMODULOS_INVENTARIO.map((s) => s.id).sort());
  });
});

describe('quién ve qué', () => {
  it('respeta la matriz que aprobó el dueño', () => {
    for (const sub of SUBMODULOS_INVENTARIO) {
      const fila = MATRIZ[sub.id];
      for (const [rol, marca] of Object.entries(fila)) {
        const etiqueta = `${rol} → ${sub.id}`;
        expect(puedeVer(rol, sub), etiqueta).toBe(marca !== '—');
        expect(puedeEditar(rol, sub.id), etiqueta).toBe(marca === '●');
      }
    }
  });

  it('el admin entra y edita en todos, incluso en los pendientes', () => {
    for (const rol of ['admin', 'superadmin', 'ADMIN', ' admin ']) {
      for (const sub of SUBMODULOS_INVENTARIO) {
        expect(puedeVer(rol, sub), `${rol} → ${sub.id}`).toBe(true);
        expect(puedeEditar(rol, sub.id), `${rol} → ${sub.id}`).toBe(true);
      }
    }
  });

  it('un rol vacío o desconocido no entra a ninguno', () => {
    for (const rol of ['', '   ', null, undefined, 'vendedor', 'jefe']) {
      for (const sub of SUBMODULOS_INVENTARIO) {
        expect(puedeVer(rol, sub), `${String(rol)} → ${sub.id}`).toBe(false);
      }
      expect(submodulosVisibles(rol)).toEqual([]);
    }
  });

  it('pruebas no ve nada del inventario', () => {
    expect(submodulosVisibles('pruebas')).toEqual([]);
    expect(itemsMenuInferior('pruebas')).toEqual([]);
  });

  it('ventas entra al tablero y a telas, pero no a los insumos', () => {
    expect(submodulosVisibles('ventas').map((s) => s.id)).toEqual(['tablero', 'telas']);
    expect(puedeEditar('ventas', 'telas')).toBe(false);
  });

  it('puedeEditar con un submódulo que no existe dice que no', () => {
    expect(puedeEditar('bodeguero', 'compras-recepcion')).toBe(false);
    expect(puedeEditar('admin', 'no-existe')).toBe(true); // admin puede todo
  });
});

describe('la barra lateral', () => {
  it('no muestra la pantalla de contar (se llega desde Conteo o del celular)', () => {
    for (const rol of ROLES_DISPONIBLES) {
      expect(submodulosVisibles(rol).map((s) => s.id), rol).not.toContain('contar');
    }
  });

  it('le muestra al bodeguero sus siete lugares, con Compras y Reportes fuera', () => {
    expect(submodulosVisibles('bodeguero').map((s) => s.id)).toEqual([
      'tablero',
      'insumos',
      'telas',
      'colmena',
      'tubos',
      'camionetas',
      'despacho',
      'movimientos',
      'conteo',
      'mermas',
      'alertas',
    ]);
  });

  it('mantiene el orden del registro (Operación, Control, Administración)', () => {
    const grupos = submodulosVisibles('admin').map((s) => s.grupo);
    const primerControl = grupos.indexOf('control');
    const primerAdmin = grupos.indexOf('administracion');
    expect(grupos.lastIndexOf('operacion')).toBeLessThan(primerControl);
    expect(grupos.lastIndexOf('control')).toBeLessThan(primerAdmin);
  });
});

describe('de una ruta al submódulo', () => {
  it('el tablero solo calza con la ruta exacta', () => {
    expect(submoduloDeRuta('/inventario')?.id).toBe('tablero');
    expect(submoduloDeRuta('/inventario/')?.id).toBe('tablero');
    expect(submoduloDeRuta('/inventario/insumos')?.id).toBe('insumos');
  });

  it('gana la ruta más larga: contar no se come con conteo', () => {
    expect(submoduloDeRuta('/inventario/conteo')?.id).toBe('conteo');
    expect(submoduloDeRuta('/inventario/conteo/tubos')?.id).toBe('conteo');
    expect(submoduloDeRuta('/inventario/conteo/contar')?.id).toBe('contar');
  });

  it('una subruta hereda su submódulo', () => {
    expect(submoduloDeRuta('/inventario/insumos/MEC%2018')?.id).toBe('insumos');
    expect(submoduloDeRuta('/inventario/insumos/ubicaciones')?.id).toBe('insumos');
    expect(submoduloDeRuta('/inventario/telas/BK%2007')?.id).toBe('telas');
  });

  it('una ruta de afuera no calza con ninguno', () => {
    for (const ruta of ['/telas', '/inventario-conteo', '/inventario-telas-prueba', '/panel']) {
      expect(submoduloDeRuta(ruta), ruta).toBeUndefined();
    }
  });
});

describe('pantalla plena', () => {
  it('despachar y contar tapan la barra; el resto no', () => {
    expect(esRutaPlena('/inventario/despacho')).toBe(true);
    expect(esRutaPlena('/inventario/conteo/contar')).toBe(true);
    expect(esRutaPlena('/inventario/conteo')).toBe(false);
    expect(esRutaPlena('/inventario')).toBe(false);
    expect(esRutaPlena('/inventario/insumos')).toBe(false);
  });

  it('una ruta de afuera del módulo no es plena', () => {
    expect(esRutaPlena('/panel')).toBe(false);
  });
});

describe('el menú de abajo del celular', () => {
  it('le da al bodeguero los cinco botones del diseño, en orden', () => {
    expect(itemsMenuInferior('bodeguero').map((s) => s.id)).toEqual([
      'tablero',
      'despacho',
      'insumos',
      'contar',
      'alertas',
    ]);
  });

  it('no rellena los huecos: al que le falta uno, le falta', () => {
    // Telas solo trabaja el tablero y las telas: no despacha, no cuenta.
    expect(itemsMenuInferior('telas').map((s) => s.id)).toEqual(['tablero']);
    expect(itemsMenuInferior('ventas').map((s) => s.id)).toEqual(['tablero']);
  });

  it('nunca muestra un submódulo pendiente', () => {
    for (const rol of ROLES_DISPONIBLES) {
      for (const s of itemsMenuInferior(rol)) {
        expect(s.estado, `${rol} → ${s.id}`).toBe('listo');
      }
    }
  });
});

describe('la plata la ve solo quien administra', () => {
  it('admin y superadmin ven los montos', () => {
    expect(puedeVerMontos('admin')).toBe(true);
    expect(puedeVerMontos('superadmin')).toBe(true);
    expect(puedeVerMontos('ADMIN')).toBe(true);
  });

  it('ningún otro rol los ve, ni siquiera el que edita el catálogo', () => {
    for (const rol of ROLES_DISPONIBLES.filter((r) => r !== 'admin')) {
      expect(puedeVerMontos(rol), rol).toBe(false);
    }
  });

  it('sin rol tampoco', () => {
    expect(puedeVerMontos(null)).toBe(false);
    expect(puedeVerMontos(undefined)).toBe(false);
    expect(puedeVerMontos('')).toBe(false);
  });

  it('un dato que no está en la tabla no se abre por descuido', () => {
    expect(puedeVerDato('bodeguero', 'inventado' as never)).toBe(false);
    // Admin es la excepción: puede todo, exista o no la fila.
    expect(puedeVerDato('admin', 'inventado' as never)).toBe(true);
  });

  it('cada dato sensible dice qué es y dónde aparece', () => {
    expect(DATOS_SENSIBLES.length).toBeGreaterThan(0);
    for (const d of DATOS_SENSIBLES) {
      expect(d.titulo, d.id).toBeTruthy();
      expect(d.detalle, d.id).toBeTruthy();
      expect(d.donde.length, d.id).toBeGreaterThan(0);
    }
  });

  it('los ids no se repiten', () => {
    const ids = DATOS_SENSIBLES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
