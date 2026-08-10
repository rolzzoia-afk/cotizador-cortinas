// ─────────────────────────────────────────────────────────────────────
// CATÁLOGO DE COLORES DE ACCESORIOS
//
// Hasta ahora los colores vivían como listas cerradas en el código (los
// botones de Fase 2) y como ~14 mapas color→código repartidos por los módulos
// de insumos. Dar de alta un color nuevo (un dorado, por ejemplo) obligaba a
// tocar todos esos archivos.
//
// Acá el color es DATO: código corto, nombre largo, en qué selectores aparece
// y —opcionalmente— qué código de insumo le corresponde a cada pieza. Ese
// último mapa es un OVERLAY: si el color no declara un código, el consumidor
// cae a su tabla de siempre. Por eso los cinco colores de fábrica no declaran
// ninguno y el comportamiento no cambia mientras nadie agregue un color.
//
// Módulo hoja: no importa nada del repo (igual que tiposCortina.ts), así que
// puede usarse desde cualquier capa sin ciclos.
// ─────────────────────────────────────────────────────────────────────

/** Dónde se ofrece el color. Cada selector de Fase 2 mira su propio uso. */
export type UsoColor = 'accesorio' | 'manilla' | 'tapaOvalada' | 'tapaCuadrada';

export const USOS_COLOR: readonly UsoColor[] = [
  'accesorio',
  'manilla',
  'tapaOvalada',
  'tapaCuadrada',
] as const;

/** Etiqueta de cada uso para el asistente de Admin. */
export const NOMBRE_USO: Record<UsoColor, string> = {
  accesorio: 'Accesorios (mecanismo, cadena, peso)',
  manilla: 'Manilla',
  tapaOvalada: 'Tapa de cenefa ovalada',
  tapaCuadrada: 'Tapa de cenefa cuadrada',
};

/**
 * Códigos de insumo propios de un color. TODO es opcional: lo que no se
 * declara cae a la tabla de fábrica del módulo que lo consume, y si tampoco
 * está ahí, la pieza sale SIN código (con su descripción y el color), que es
 * como el sistema ya trataba a los colores sin catalogar.
 */
export type InsumosColor = {
  /** N° MEC del kit simple (el default de este color). */
  kitSimple?: number;
  /** N° MEC del kit reforzado. */
  kitReforzado?: number;
  /** N° MEC del kit de cenefa ovalada. */
  kitOvalada?: number;
  /** Tapas de peso roller, por lado (TAP19/TAP01 en blanco). */
  tapaPesoIzq?: string;
  tapaPesoDer?: string;
  /** Tapa exterior de peso dúo (TAP12 en blanco). */
  tapaDuo?: string;
  /** Tapa de cenefa cuadrada (TAP33 en blanco). */
  tapaCuadrada?: string;
  /** Tapa de peso de soft light / dark (TAP26 en blanco). */
  tapaOscuridad?: string;
  /** Manilla (HER48 en blanco). */
  manilla?: string;
  /** Barra de peso roller (E15 en blanco). */
  pesoRoller?: string;
  /** Peso U de dúo lágrima (E19 en blanco). */
  pesoU?: string;
  /** Peso inferior de oscuridad (E24 en blanco). */
  pesoOscuridad?: string;
  /** Cenefa ovalada (E27 en blanco). */
  cenefaOvalada?: string;
  /** Cenefa cuadrada (E30 en blanco). */
  cenefaCuadrada?: string;
  /** Perfil zócalo de oscuridad (E32 en blanco). */
  zocalo?: string;
  /** Perfil separador de oscuridad (E41 en blanco). */
  separador?: string;
  /** Perfil superior de oscuranti (E50 en blanco). */
  perfilSuperior?: string;
  // ── Categoría B (gama económica) ──────────────────────────────────
  // La misma cortina con otro juego de herrajes: su peso y su cenefa tienen
  // código PROPIO por color. Van aparte de los campos de arriba (que son los
  // de la línea A) porque las dos líneas conviven en la misma OT.
  /** Barra de peso roller de categoría B (E40 en blanco). */
  pesoRollerB?: string;
  /** Peso U de dúo de categoría B (E25 en blanco). */
  pesoUB?: string;
  /** Peso interno de dúo de categoría B (E79-B en blanco). En la línea A este
   *  peso es E13 fijo, sin importar el color. */
  pesoInternoB?: string;
  /** Cenefa ovalada de categoría B (E60 en blanco). */
  cenefaOvaladaB?: string;
};

/** Grupo de `CAMPOS_INSUMO_COLOR` con los códigos de la categoría B. Se edita
 *  en su propia sección del catálogo técnico, no en el asistente de colores. */
export const GRUPO_INSUMOS_B = 'Categoría B';

/** Campos de `InsumosColor`, en el orden en que los pregunta el asistente. */
export const CAMPOS_INSUMO_COLOR: ReadonlyArray<{
  campo: keyof InsumosColor;
  label: string;
  grupo: string;
  ejemplo: string;
}> = [
  { campo: 'kitSimple', label: 'Kit simple', grupo: 'Mecanismos', ejemplo: 'MEC 33' },
  { campo: 'kitReforzado', label: 'Kit reforzado', grupo: 'Mecanismos', ejemplo: 'MEC 41' },
  { campo: 'kitOvalada', label: 'Kit de cenefa ovalada', grupo: 'Mecanismos', ejemplo: 'MEC 39' },
  { campo: 'tapaPesoIzq', label: 'Tapa de peso roller izquierda', grupo: 'Tapas', ejemplo: 'TAP19' },
  { campo: 'tapaPesoDer', label: 'Tapa de peso roller derecha', grupo: 'Tapas', ejemplo: 'TAP01' },
  { campo: 'tapaDuo', label: 'Tapa de peso dúo (exterior)', grupo: 'Tapas', ejemplo: 'TAP12' },
  { campo: 'tapaCuadrada', label: 'Tapa de cenefa cuadrada', grupo: 'Tapas', ejemplo: 'TAP33' },
  { campo: 'tapaOscuridad', label: 'Tapa de peso soft light / dark', grupo: 'Tapas', ejemplo: 'TAP26' },
  { campo: 'manilla', label: 'Manilla', grupo: 'Tapas', ejemplo: 'HER48' },
  { campo: 'pesoRoller', label: 'Barra de peso roller', grupo: 'Perfiles y pesos', ejemplo: 'E15' },
  { campo: 'pesoU', label: 'Peso U (dúo lágrima)', grupo: 'Perfiles y pesos', ejemplo: 'E19' },
  { campo: 'pesoOscuridad', label: 'Peso inferior de oscuridad', grupo: 'Perfiles y pesos', ejemplo: 'E24' },
  { campo: 'cenefaOvalada', label: 'Cenefa ovalada', grupo: 'Perfiles y pesos', ejemplo: 'E27' },
  { campo: 'cenefaCuadrada', label: 'Cenefa cuadrada', grupo: 'Perfiles y pesos', ejemplo: 'E30' },
  { campo: 'zocalo', label: 'Perfil zócalo', grupo: 'Perfiles y pesos', ejemplo: 'E32' },
  { campo: 'separador', label: 'Perfil separador', grupo: 'Perfiles y pesos', ejemplo: 'E41' },
  { campo: 'perfilSuperior', label: 'Perfil superior (oscuranti)', grupo: 'Perfiles y pesos', ejemplo: 'E50' },
  { campo: 'pesoRollerB', label: 'Barra de peso roller (categoría B)', grupo: GRUPO_INSUMOS_B, ejemplo: 'E40' },
  { campo: 'pesoUB', label: 'Peso U de dúo (categoría B)', grupo: GRUPO_INSUMOS_B, ejemplo: 'E25' },
  { campo: 'pesoInternoB', label: 'Peso interno de dúo (categoría B)', grupo: GRUPO_INSUMOS_B, ejemplo: 'E79-B' },
  { campo: 'cenefaOvaladaB', label: 'Cenefa ovalada (categoría B)', grupo: GRUPO_INSUMOS_B, ejemplo: 'E60' },
];

/** Los campos de `InsumosColor` que son número de MEC y no código de insumo. */
export const CAMPOS_MEC: ReadonlySet<keyof InsumosColor> = new Set([
  'kitSimple',
  'kitReforzado',
  'kitOvalada',
]);

export type ColorAccesorio = {
  /** Código corto: lo que se guarda en el paño y viaja al Excel ('BCO', 'DOR'). */
  codigo: string;
  /** Nombre largo: con él se buscan el modelo del catálogo y la cadena del
   *  inventario, que matchean por texto ('BLANCO', 'DORADO'). */
  nombre: string;
  /** En qué selectores aparece. */
  usos: Record<UsoColor, boolean>;
  /** Códigos propios (overlay). Los de fábrica no lo declaran. */
  insumos?: InsumosColor;
};

const usos = (...activos: UsoColor[]): Record<UsoColor, boolean> => ({
  accesorio: activos.includes('accesorio'),
  manilla: activos.includes('manilla'),
  tapaOvalada: activos.includes('tapaOvalada'),
  tapaCuadrada: activos.includes('tapaCuadrada'),
});

/**
 * Los cinco colores de fábrica. Los `usos` reproducen EXACTAMENTE las cuatro
 * listas que fase2.ts tenía escritas a mano (hay un test que lo verifica), y
 * el ORDEN es el de los botones en pantalla.
 *
 * Ninguno declara `insumos`: siguen resolviendo por las tablas de siempre
 * (insumosCortina.ts, codigos-estructura.ts, reglas-mecanismo.ts). Así, sin
 * colores nuevos, la app calcula exactamente igual que antes.
 */
export const COLORES_BUILTIN: readonly ColorAccesorio[] = [
  { codigo: 'MET', nombre: 'METAL', usos: usos('accesorio') },
  { codigo: 'NEG', nombre: 'NEGRO', usos: usos('accesorio', 'manilla', 'tapaOvalada', 'tapaCuadrada') },
  { codigo: 'BCO', nombre: 'BLANCO', usos: usos('accesorio', 'manilla', 'tapaOvalada', 'tapaCuadrada') },
  { codigo: 'GRS', nombre: 'GRIS', usos: usos('accesorio', 'tapaOvalada') },
  { codigo: 'CAFÉ', nombre: 'CAFÉ', usos: usos('manilla', 'tapaCuadrada') },
];

/** Códigos de fábrica: no se pueden repetir ni borrar desde el asistente. */
export const CODIGOS_BUILTIN: readonly string[] = COLORES_BUILTIN.map((c) => c.codigo);

/** Un código de color válido: letras (con tilde/ñ), dígitos y guion bajo. */
export const RE_CODIGO_COLOR = /^[A-Za-zÁÉÍÓÚÑÜ][A-Za-z0-9ÁÉÍÓÚÑÜ_]*$/;

/** Normaliza para comparar: sin espacios y en mayúsculas. */
function norm(v: string | null | undefined): string {
  return (v || '').trim().toUpperCase();
}

/** El color del catálogo que corresponde a un código o nombre. */
export function colorPorCodigo(
  codigo: string | null | undefined,
  colores: readonly ColorAccesorio[] = COLORES_BUILTIN,
): ColorAccesorio | null {
  const c = norm(codigo);
  if (!c) return null;
  return colores.find((x) => norm(x.codigo) === c || norm(x.nombre) === c) ?? null;
}

/** Códigos que se ofrecen para un uso, en el orden del catálogo. */
export function coloresParaUso(
  uso: UsoColor,
  colores: readonly ColorAccesorio[] = COLORES_BUILTIN,
): string[] {
  return colores.filter((c) => c.usos[uso]).map((c) => c.codigo);
}

/**
 * Las opciones de un selector más el valor guardado, si ya no está en la lista.
 * Un paño de una OT vieja con un color retirado del catálogo sigue mostrando su
 * botón, igual que hacemos con los chips de mecanismo legacy.
 */
export function opcionesColorConGuardado(
  opciones: readonly string[],
  guardado: string | null | undefined,
): string[] {
  const g = (guardado || '').trim();
  if (!g || opciones.some((o) => norm(o) === norm(g))) return [...opciones];
  return [...opciones, g];
}

/** Nombre largo de un color; si no está en el catálogo, el propio código. */
export function nombreDeColor(
  codigo: string | null | undefined,
  colores: readonly ColorAccesorio[] = COLORES_BUILTIN,
): string {
  return colorPorCodigo(codigo, colores)?.nombre ?? norm(codigo);
}

/**
 * Código de insumo declarado por el color para una pieza, o null si no declaró
 * ninguno. El llamador cae entonces a su tabla de fábrica — ese es el contrato
 * del overlay y la razón de que los colores builtin no rompan nada.
 */
export function insumoDeColor(
  codigo: string | null | undefined,
  campo: keyof InsumosColor,
  colores: readonly ColorAccesorio[] | undefined,
): string | null {
  if (!colores) return null;
  const valor = colorPorCodigo(codigo, colores)?.insumos?.[campo];
  if (valor == null) return null;
  const texto = String(valor).trim();
  return texto || null;
}

/** Igual que `insumoDeColor` pero para los campos que son número de MEC. */
export function mecDeColor(
  codigo: string | null | undefined,
  campo: 'kitSimple' | 'kitReforzado' | 'kitOvalada',
  colores: readonly ColorAccesorio[] | undefined,
): number | null {
  if (!colores) return null;
  const valor = colorPorCodigo(codigo, colores)?.insumos?.[campo];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export type ResultadoValidacionColores = { errores: string[]; avisos: string[] };

/** Revisa el catálogo completo: códigos únicos y bien formados, nombres presentes. */
export function validarColores(
  colores: readonly ColorAccesorio[],
): ResultadoValidacionColores {
  const errores: string[] = [];
  const avisos: string[] = [];
  const vistos = new Map<string, number>();
  const nombres = new Map<string, string>();

  for (const c of colores) {
    const cod = norm(c.codigo);
    const nom = norm(c.nombre);
    const etiqueta = c.codigo?.trim() || '(sin código)';

    if (!cod) {
      errores.push('Hay un color sin código.');
      continue;
    }
    if (!RE_CODIGO_COLOR.test(c.codigo.trim())) {
      errores.push(
        `El código «${etiqueta}» no sirve: empieza con letra y sigue con letras, números o guion bajo (sin espacios ni símbolos).`,
      );
    }
    vistos.set(cod, (vistos.get(cod) ?? 0) + 1);
    if (vistos.get(cod) === 2) errores.push(`El código «${etiqueta}» está repetido.`);

    if (!nom) {
      errores.push(`El color «${etiqueta}» no tiene nombre. Con el nombre se buscan el modelo del catálogo y la cadena del inventario.`);
    } else {
      const dueño = nombres.get(nom);
      if (dueño && dueño !== cod) {
        errores.push(`«${etiqueta}» y «${dueño}» tienen el mismo nombre (${c.nombre.trim()}): elegirían el mismo modelo y la misma cadena.`);
      }
      nombres.set(nom, cod);
    }

    if (!USOS_COLOR.some((u) => c.usos?.[u])) {
      avisos.push(`«${etiqueta}» no está marcado para ningún uso: no aparecerá en ningún selector.`);
    }
  }

  for (const builtin of COLORES_BUILTIN) {
    if (!colores.some((c) => norm(c.codigo) === norm(builtin.codigo))) {
      avisos.push(
        `Se quitó el color de fábrica «${builtin.codigo}». Las órdenes guardadas lo conservan, pero deja de ofrecerse.`,
      );
    }
  }

  return { errores, avisos };
}
