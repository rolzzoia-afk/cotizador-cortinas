// ─────────────────────────────────────────────────────────────────────
// Control de acceso por rol — ÚNICA fuente de verdad de permisos del
// frontend. La usan ProtectedRoute (bloqueo real de rutas) y TopBar
// (visibilidad del menú), así nunca quedan desincronizados.
//
// Reglas:
// - 'admin' y 'superadmin' acceden a todo.
// - Un rol desconocido o vacío NO accede a nada (antes veía todo, lo
//   cual era un hueco de seguridad). El admin puede asignar el rol
//   correcto desde Admin → Usuarios y roles.
// - El parámetro ?rol= (ver-como) es solo visual y solo para admins.
// ─────────────────────────────────────────────────────────────────────

import { SUBMODULOS_INVENTARIO, rolesDeSubmodulo } from '@/modules/inventario/navegacion';

export const ROLES_DISPONIBLES = [
  'admin',
  'ventas',
  'bodeguero',
  'produccion',
  'dimensionado',
  'telas',
  'operario',
  'pruebas',
] as const;

export function esRolAdmin(rol: string | null | undefined): boolean {
  const r = (rol || '').toLowerCase().trim();
  return r === 'admin' || r === 'superadmin';
}

/**
 * Las reglas de `/inventario/*` salen del registro de submódulos, para que la
 * barra lateral y el permiso real no puedan decir cosas distintas.
 *
 * Van ORDENADAS DE RUTA MÁS LARGA A MÁS CORTA porque acá gana la primera que
 * calza: si `/inventario` quedara antes, `/inventario/conteo/contar` heredaría
 * los roles del Tablero.
 *
 * Los submódulos «pendiente» (Compras, Reportes) también generan su regla, aunque
 * todavía no tengan pantalla: así nacen cerrados. Si no, su ruta caería en la del
 * Tablero y el día que alguien la conecte quedaría abierta al taller entero.
 */
function reglasDeInventario(): Array<{ patron: RegExp; roles: string[] }> {
  const escapar = (ruta: string) => ruta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return SUBMODULOS_INVENTARIO.slice()
    .sort((a, b) => b.ruta.length - a.ruta.length)
    .map((s) => ({ patron: new RegExp(`^${escapar(s.ruta)}(/|$)`), roles: rolesDeSubmodulo(s) }));
}

// Rutas → roles permitidos (además de admin, que siempre puede).
// El orden importa: gana la primera regla cuyo patrón matchee.
const REGLAS: Array<{ patron: RegExp; roles: string[] }> = [
  // Solo admin
  { patron: /^\/admin/, roles: [] },
  { patron: /^\/ojo-de-dios/, roles: [] },
  { patron: /^\/inventario-telas-prueba/, roles: [] },
  // Ventas / oficina
  { patron: /^\/panel/, roles: ['ventas', 'pruebas'] },
  { patron: /^\/cotizar/, roles: ['ventas', 'pruebas'] },
  { patron: /^\/ventas/, roles: ['ventas'] },
  { patron: /^\/leads/, roles: ['ventas'] },
  { patron: /^\/inteligencia/, roles: ['ventas'] },
  { patron: /^\/cotizador-jefe/, roles: ['ventas'] }, // la página ya limita el modo vendedor
  // Taller / bodega
  { patron: /^\/telas/, roles: ['bodeguero', 'produccion', 'telas', 'dimensionado', 'operario'] },
  { patron: /^\/inventario-conteo/, roles: ['bodeguero', 'operario'] },
  ...reglasDeInventario(),
  { patron: /^\/optimizador-tela/, roles: ['produccion', 'dimensionado', 'telas', 'operario'] },
  { patron: /^\/optimizador/, roles: ['produccion', 'operario'] },
  { patron: /^\/bodeguero/, roles: ['bodeguero', 'operario'] },
  { patron: /^\/camionetas/, roles: ['bodeguero', 'operario'] },
  { patron: /^\/historial-corte/, roles: ['produccion', 'dimensionado', 'operario'] },
  // El taller en pantalla: entra todo el que trabaja una OT en el galpón. La
  // pestaña de costos se esconde adentro, por rol.
  {
    patron: /^\/produccion/,
    roles: ['produccion', 'dimensionado', 'telas', 'operario', 'pruebas', 'bodeguero'],
  },
  { patron: /^\/historial-tubos/, roles: ['produccion', 'operario'] },
  // Flujo de OTs (cotización + fases de producción)
  {
    patron: /^\/ots\//,
    roles: ['ventas', 'produccion', 'dimensionado', 'telas', 'operario', 'pruebas'],
  },
];

/** ¿Puede este rol acceder a esta ruta? (admin siempre puede) */
export function puedeAccederRuta(rol: string | null | undefined, pathname: string): boolean {
  if (esRolAdmin(rol)) return true;
  const r = (rol || '').toLowerCase().trim();
  const regla = REGLAS.find((re) => re.patron.test(pathname));
  // Sin regla específica (landing, setup, raíz) → cualquier usuario logueado.
  if (!regla) return true;
  return r !== '' && regla.roles.includes(r);
}
