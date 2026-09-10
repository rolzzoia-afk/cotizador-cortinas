// ─────────────────────────────────────────────────────────────────────
// Registro de los submódulos de /inventario — ÚNICA fuente de verdad de la
// navegación del módulo.
//
// De acá salen tres cosas que antes se mantenían a mano por separado y se
// desincronizaban: la barra lateral del escritorio, el menú de abajo del
// celular y las reglas de acceso de `lib/roles.ts`. Agregar un submódulo es
// agregar una fila a esta tabla.
//
// Módulo PURO: sin React, sin Supabase y sin iconos importados (el nombre del
// icono se resuelve en la UI). Así lo puede importar `lib/roles.ts`, que la
// carga toda la app, sin arrastrar nada.
// ─────────────────────────────────────────────────────────────────────

/** Grupos de la barra lateral, en el orden en que se muestran. */
export type GrupoInventario = 'operacion' | 'control' | 'administracion';

/**
 * Nombre del icono lucide. Se guarda como texto y no como componente para que
 * este módulo siga siendo puro; la UI lo traduce con un mapa.
 */
export type IconoInventario =
  | 'LayoutDashboard'
  | 'Package'
  | 'Layers'
  | 'Grid3x3'
  | 'AlignJustify'
  | 'Truck'
  | 'ShoppingBag'
  | 'ArrowLeftRight'
  | 'ClipboardList'
  | 'Scissors'
  | 'TriangleAlert'
  | 'ShoppingCart'
  | 'BarChart3'
  | 'Settings'
  | 'ShieldCheck';

/**
 * Qué badge muestra el ítem en la barra. El número lo pone la UI; acá solo se
 * declara CUÁL, para que el layout sepa qué contar.
 */
export type BadgeInventario = 'alertas' | 'conteo' | 'despacho';

/** Dónde vive el ítem en el menú de abajo del celular (5 lugares fijos). */
export type LugarMovil = 'inicio' | 'despacho' | 'buscar' | 'contar' | 'alertas';

export type SubmoduloInventario = {
  id: string;
  /** Ruta absoluta, sin barra final. */
  ruta: string;
  titulo: string;
  grupo: GrupoInventario;
  icono: IconoInventario;
  /**
   * Roles que ENTRAN Y EDITAN, además de admin (que siempre puede).
   * Vacío = solo admin.
   */
  roles: readonly string[];
  /** Roles que entran pero solo miran. La pantalla esconde lo que escribe. */
  lectura?: readonly string[];
  /**
   * 'pleno' = pantalla completa para trabajar con las manos ocupadas (despacho
   * y conteo): sin barra lateral ni menú de abajo, con cabecera de volver.
   */
  modo: 'escritorio' | 'pleno';
  /** 'pendiente' = se ve en la barra, apagado y sin ruta. */
  estado: 'listo' | 'pendiente';
  badge?: BadgeInventario;
  /** false = no aparece en la barra lateral (se llega desde otra pantalla). */
  enMenu: boolean;
  movil?: LugarMovil;
};

/** Todos los que trabajan el galpón (los mismos de /produccion, sin pruebas). */
const TALLER = ['bodeguero', 'produccion', 'dimensionado', 'telas', 'operario'] as const;
const BODEGA = ['bodeguero', 'operario'] as const;

export const SUBMODULOS_INVENTARIO: readonly SubmoduloInventario[] = [
  // ── Operación ──────────────────────────────────────────────────────
  {
    id: 'tablero',
    ruta: '/inventario',
    titulo: 'Tablero',
    grupo: 'operacion',
    icono: 'LayoutDashboard',
    roles: TALLER,
    lectura: ['ventas'],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
    movil: 'inicio',
  },
  {
    id: 'insumos',
    ruta: '/inventario/insumos',
    titulo: 'Insumos',
    grupo: 'operacion',
    icono: 'Package',
    roles: BODEGA,
    lectura: ['produccion'],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
    movil: 'buscar',
  },
  {
    id: 'telas',
    ruta: '/inventario/telas',
    titulo: 'Telas',
    grupo: 'operacion',
    icono: 'Layers',
    roles: TALLER,
    lectura: ['ventas'],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'colmena',
    ruta: '/inventario/colmena',
    titulo: 'Colmena de paños',
    grupo: 'operacion',
    icono: 'Grid3x3',
    roles: TALLER,
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'tubos',
    ruta: '/inventario/tubos',
    titulo: 'Tubos',
    grupo: 'operacion',
    icono: 'AlignJustify',
    roles: ['produccion', 'operario'],
    lectura: ['bodeguero'],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'camionetas',
    ruta: '/inventario/camionetas',
    titulo: 'Camionetas',
    grupo: 'operacion',
    icono: 'Truck',
    roles: BODEGA,
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'despacho',
    ruta: '/inventario/despacho',
    titulo: 'Despacho por OT',
    grupo: 'operacion',
    icono: 'ShoppingBag',
    roles: BODEGA,
    modo: 'pleno',
    estado: 'listo',
    badge: 'despacho',
    enMenu: true,
    movil: 'despacho',
  },

  // ── Control ────────────────────────────────────────────────────────
  {
    id: 'movimientos',
    ruta: '/inventario/movimientos',
    titulo: 'Kardex',
    grupo: 'control',
    icono: 'ArrowLeftRight',
    roles: ['bodeguero', 'produccion', 'telas', 'operario'],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'conteo',
    ruta: '/inventario/conteo',
    titulo: 'Conteo físico',
    grupo: 'control',
    icono: 'ClipboardList',
    // Abrir y cerrar es de admin; bodega y operario entran a ver y a contar.
    roles: [],
    lectura: BODEGA,
    modo: 'escritorio',
    estado: 'listo',
    badge: 'conteo',
    enMenu: true,
  },
  {
    // La pantalla del que cuenta: se llega desde Conteo o desde el celular.
    id: 'contar',
    ruta: '/inventario/conteo/contar',
    titulo: 'Contar',
    grupo: 'control',
    icono: 'ClipboardList',
    roles: BODEGA,
    modo: 'pleno',
    estado: 'listo',
    enMenu: false,
    movil: 'contar',
  },
  {
    id: 'mermas',
    ruta: '/inventario/mermas',
    titulo: 'Mermas y fallas',
    grupo: 'control',
    icono: 'Scissors',
    roles: TALLER,
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'alertas',
    ruta: '/inventario/alertas',
    titulo: 'Alertas y reposición',
    grupo: 'control',
    icono: 'TriangleAlert',
    roles: BODEGA,
    lectura: ['produccion'],
    modo: 'escritorio',
    estado: 'listo',
    badge: 'alertas',
    enMenu: true,
    movil: 'alertas',
  },

  // ── Administración ─────────────────────────────────────────────────
  {
    // La pantalla existe para acordar el alcance; el módulo NO se programa
    // hasta que la jefatura apruebe. Por eso entra pero no opera.
    id: 'compras',
    ruta: '/inventario/compras',
    titulo: 'Compras',
    grupo: 'administracion',
    icono: 'ShoppingCart',
    roles: [],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'reportes',
    ruta: '/inventario/reportes',
    titulo: 'Reportes',
    grupo: 'administracion',
    icono: 'BarChart3',
    roles: [],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'configuracion',
    ruta: '/inventario/configuracion',
    titulo: 'Configuración',
    grupo: 'administracion',
    icono: 'Settings',
    roles: [],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
  {
    id: 'auditoria',
    ruta: '/inventario/auditoria',
    titulo: 'Auditoría',
    grupo: 'administracion',
    icono: 'ShieldCheck',
    roles: [],
    modo: 'escritorio',
    estado: 'listo',
    enMenu: true,
  },
] as const;

export const GRUPOS_INVENTARIO: ReadonlyArray<{ id: GrupoInventario; titulo: string }> = [
  { id: 'operacion', titulo: 'Operación' },
  { id: 'control', titulo: 'Control' },
  { id: 'administracion', titulo: 'Administración' },
];

// ── Datos que se esconden DENTRO de una pantalla ──────────────────────
//
// Los submódulos de arriba deciden a qué pantalla se entra. Esto decide qué
// se ve una vez adentro: un bodeguero necesita el catálogo de insumos para
// trabajar, pero no tiene por qué saber cuánto costó cada tornillo.
//
// Va en la MISMA tabla que la navegación a propósito. La regla vivía repartida
// —la ficha del insumo tenía su propio `esAdmin`, la tabla del catálogo no
// tenía ninguno y mostraba el costo a todo el mundo—, y una regla escrita en
// tres lugares es una regla que se cumple en dos.

export type IdDatoSensible = 'montos';

export type DatoSensible = {
  id: IdDatoSensible;
  titulo: string;
  /** Qué es, en una línea. */
  detalle: string;
  /** Roles que lo ven ADEMÁS de admin. Vacío = solo admin. */
  roles: readonly string[];
  /** Dónde aparece, para poder revisarlo desde la pantalla. */
  donde: readonly string[];
};

export const DATOS_SENSIBLES: readonly DatoSensible[] = [
  {
    id: 'montos',
    titulo: 'Montos de dinero',
    detalle: 'Costos, precios y valorización del inventario.',
    roles: [],
    donde: [
      'Columna «Costo» del catálogo de insumos',
      'Costo neto y con IVA en la ficha del artículo',
      'Campo «Costo» al crear o editar un artículo',
      'Precios y costos del catálogo de telas (importar y clonar)',
      'Reportes: valorización y plata parada',
    ],
  },
] as const;

/** ¿Este rol ve este dato sensible? (admin siempre puede) */
export function puedeVerDato(rol: string | null | undefined, id: IdDatoSensible): boolean {
  if (esAdmin(rol)) return true;
  const dato = DATOS_SENSIBLES.find((d) => d.id === id);
  if (!dato) return false;
  const r = normalizarRol(rol);
  return r !== '' && dato.roles.includes(r);
}

/**
 * ¿Este rol ve la plata? Es la pregunta que hacen las pantallas, así que tiene
 * nombre propio: hoy es solo admin, y si mañana cambia se cambia en la tabla.
 */
export function puedeVerMontos(rol: string | null | undefined): boolean {
  return puedeVerDato(rol, 'montos');
}

function normalizarRol(rol: string | null | undefined): string {
  return (rol || '').toLowerCase().trim();
}

function esAdmin(rol: string | null | undefined): boolean {
  const r = normalizarRol(rol);
  return r === 'admin' || r === 'superadmin';
}

/** Todos los roles que ENTRAN a un submódulo (editan o solo miran). */
export function rolesDeSubmodulo(sub: SubmoduloInventario): string[] {
  return [...sub.roles, ...(sub.lectura ?? [])];
}

/** ¿Este rol entra a este submódulo? (admin siempre puede) */
export function puedeVer(rol: string | null | undefined, sub: SubmoduloInventario): boolean {
  if (esAdmin(rol)) return true;
  const r = normalizarRol(rol);
  return r !== '' && rolesDeSubmodulo(sub).includes(r);
}

/**
 * ¿Este rol EDITA acá, o solo mira? Las pantallas la usan para esconder los
 * botones que escriben en vez de mostrar un error después de apretarlos.
 */
export function puedeEditar(rol: string | null | undefined, idSubmodulo: string): boolean {
  if (esAdmin(rol)) return true;
  const sub = SUBMODULOS_INVENTARIO.find((s) => s.id === idSubmodulo);
  if (!sub) return false;
  const r = normalizarRol(rol);
  return r !== '' && sub.roles.includes(r);
}

/** Los submódulos que este rol ve en la barra lateral, en orden. */
export function submodulosVisibles(rol: string | null | undefined): SubmoduloInventario[] {
  return SUBMODULOS_INVENTARIO.filter((s) => s.enMenu && puedeVer(rol, s));
}

/**
 * A qué submódulo pertenece una ruta. Gana el de ruta MÁS LARGA que calce, para
 * que `/inventario/conteo/contar` no se confunda con `/inventario/conteo`. El
 * Tablero (`/inventario`) solo calza exacto.
 */
export function submoduloDeRuta(pathname: string): SubmoduloInventario | undefined {
  const p = (pathname || '').replace(/\/+$/, '') || '/';
  let mejor: SubmoduloInventario | undefined;
  for (const s of SUBMODULOS_INVENTARIO) {
    const calza = p === s.ruta || p.startsWith(`${s.ruta}/`);
    if (!calza) continue;
    if (!mejor || s.ruta.length > mejor.ruta.length) mejor = s;
  }
  return mejor;
}

/** ¿Esta ruta se muestra a pantalla plena (sin barra ni menú de abajo)? */
export function esRutaPlena(pathname: string): boolean {
  return submoduloDeRuta(pathname)?.modo === 'pleno';
}

/**
 * Los ítems del menú de abajo del celular para este rol, en el orden fijo del
 * diseño. Un rol que no ve alguno simplemente lo pierde: el menú no se rellena
 * con otra cosa, para que el dedo encuentre siempre el mismo botón.
 */
export function itemsMenuInferior(rol: string | null | undefined): SubmoduloInventario[] {
  const orden: LugarMovil[] = ['inicio', 'despacho', 'buscar', 'contar', 'alertas'];
  return orden
    .map((lugar) => SUBMODULOS_INVENTARIO.find((s) => s.movil === lugar))
    .filter((s): s is SubmoduloInventario => !!s && s.estado === 'listo' && puedeVer(rol, s));
}
