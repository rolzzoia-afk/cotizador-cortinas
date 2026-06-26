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
  { patron: /^\/inventario/, roles: ['bodeguero', 'operario'] },
  { patron: /^\/optimizador-tela/, roles: ['produccion', 'dimensionado', 'telas', 'operario'] },
  { patron: /^\/optimizador/, roles: ['produccion', 'operario'] },
  { patron: /^\/bodeguero/, roles: ['bodeguero', 'operario'] },
  { patron: /^\/camionetas/, roles: ['bodeguero', 'operario'] },
  { patron: /^\/historial-corte/, roles: ['produccion', 'dimensionado', 'operario'] },
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
