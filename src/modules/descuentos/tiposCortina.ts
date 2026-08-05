// ─────────────────────────────────────────────────────────────────────
// TIPOS DE CORTINA PROPIOS — Admin → Catálogo técnico → Tipos de cortina.
//
// Un TipoCortina es una categoría NUEVA que se comporta como una de las
// categorías nativas (su MOLDE o base): hereda el despiece, los insumos, las
// columnas del Excel, la etiqueta y el bloque del Cálculo General. Lo que puede
// tener propio son los NÚMEROS: un parche de fórmulas (moldes de oscuridad) o
// filas propias del catálogo `descuentos_modelo` (moldes roller/dúo/pletina).
//
// La categoría ORIGINAL es la que viaja en los datos (COD SEC del Excel, la
// ventana guardada, la UI). Los módulos de cálculo resuelven la categoría
// EFECTIVA —la base— justo antes de decidir, con `categoriaEfectiva()`.
//
// Los tipos se guardan en `configuracion.reglas_seleccion` (campo `tipos`) y
// viajan al motor por parámetro opcional, igual que las fórmulas y las reglas.
// Sin tipos creados, todo se comporta exactamente como antes.
//
// Módulo puro y hoja: no importa nada del repo (evita ciclos con reglas-*).
// ─────────────────────────────────────────────────────────────────────

/**
 * Las categorías nativas del cotizador. Es la ÚNICA fuente: el select de
 * Fase 1 (categorias.ts), el de Fase 0 y la validación del importador se
 * derivan de acá, y un test lo verifica.
 */
export const CATEGORIAS_BUILTIN = [
  'ROL',
  'ROL_DUAL',
  'ROL_MANUAL_CENEFA_OVALADA_38mm',
  'ROL_MANUAL_CENEFA_OVALADA_45mm',
  'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO',
  'ROL_CENEFA_OVALADA_MOTOR_GRANDE',
  'PLETINA_ROLLER_V',
  'DUO_MANUAL_38mm',
  'DUO_MANUAL_45mm',
  'DUO_MOTOR_PEQUEÑO_38mm',
  'DUO_MOTOR_GRANDE_45mm',
  'PLETINA_DUO_V',
  'VERTICAL',
  'SOFT_LIGHT_38mm',
  'SOFT_LIGHT_45mm',
  'DARK_38mm',
  'DARK_45mm',
  'OSCURANTI_63mm',
  'BEEBLACK',
] as const;

/**
 * Moldes válidos: todas las nativas MENOS vertical y bee black. Esos dos son
 * sistemas físicamente distintos (estructura propia, no un roller con otras
 * medidas): copiarlos con otros números no daría una cortina que se fabrique,
 * así que un sistema así sigue siendo desarrollo.
 */
export const BASES_PROHIBIDAS: readonly string[] = ['VERTICAL', 'BEEBLACK'];

export const BASES_PERMITIDAS: readonly string[] = CATEGORIAS_BUILTIN.filter(
  (c) => !BASES_PROHIBIDAS.includes(c),
);

/** Bases cuyo despiece pasa por las fórmulas de oscuridad (parche por tipo). */
export const BASES_OSCURIDAD: readonly string[] = [
  'SOFT_LIGHT_38mm',
  'SOFT_LIGHT_45mm',
  'DARK_38mm',
  'DARK_45mm',
  'OSCURANTI_63mm',
];

export type TipoCortina = {
  /**
   * Identificador: el valor del select de Fase 1, el COD SEC del Excel de
   * órdenes y la clave del parche de fórmulas. Sin puntos ni espacios porque
   * viaja dentro de rutas tipo `oscuridad.porTipo.<CATEGORIA>.cenefaAdj.0`.
   */
  categoria: string;
  /** Nombre visible en los selectores. */
  nombre: string;
  /** Grupo del selector de Fase 1 (optgroup). */
  grupo: string;
  /** Una de BASES_PERMITIDAS: define todo el comportamiento heredado. */
  base: string;
  /**
   * Sistemas del catálogo `descuentos_modelo` con las filas PROPIAS del tipo.
   * Si se omite, usa las mismas filas que su base.
   */
  sistemas?: readonly string[];
  /** Filtro sobre `tipo_rol` para elegir las filas propias dentro del sistema. */
  tipoIncluye?: string;
  /**
   * false = deja de ofrecerse en los selectores y en el importador, pero las
   * órdenes ya guardadas se siguen calculando igual (mismo criterio que un
   * tubo o un mecanismo oculto).
   */
  activo: boolean;
  notas?: string;
};

/** Grupo por defecto de los tipos nuevos en el selector de Fase 1. */
export const GRUPO_TIPOS_PROPIOS = 'Tipos propios';

/** Categoría técnica válida: letra inicial y luego letras, números o guion bajo. */
export const RE_CATEGORIA = /^[A-Za-z][A-Za-z0-9_]*$/;

function norm(v: string | null | undefined): string {
  return (v || '').trim().toUpperCase();
}

/** Sufijo de diámetro del nombre de una categoría ('DARK_38mm' → 38). */
export function diametroDelNombre(categoria: string | null | undefined): number | null {
  const m = norm(categoria).match(/(\d{2})\s*MM/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * El tipo propio que corresponde a una categoría, o null si es nativa o
 * desconocida. Encuentra también los INACTIVOS: una orden guardada con un tipo
 * que se desactivó tiene que seguir calculándose con su molde.
 */
export function tipoPorCategoria(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): TipoCortina | null {
  if (!tipos || tipos.length === 0) return null;
  const c = norm(categoria);
  if (!c) return null;
  return tipos.find((t) => norm(t.categoria) === c) ?? null;
}

/**
 * Categoría con la que hay que DECIDIR: la base si es un tipo propio, la misma
 * si es nativa o desconocida. Es el resolver que usan los módulos de cálculo
 * justo antes de sus predicados (`esCategoriaPletina`, `familiaOscuridad`…).
 */
export function categoriaEfectiva(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): string {
  const tipo = tipoPorCategoria(categoria, tipos);
  return tipo ? tipo.base : (categoria || '');
}

/** true si la categoría es un tipo propio (activo o no). */
export function esTipoPropio(
  categoria: string | null | undefined,
  tipos?: readonly TipoCortina[],
): boolean {
  return tipoPorCategoria(categoria, tipos) != null;
}

/** Categorías que se OFRECEN: las nativas + los tipos propios activos. */
export function categoriasParaSelect(tipos?: readonly TipoCortina[]): string[] {
  const propias = (tipos ?? []).filter((t) => t.activo).map((t) => t.categoria);
  return [...CATEGORIAS_BUILTIN, ...propias];
}

/** Tipos propios activos, en el orden en que se crearon. */
export function tiposActivos(tipos?: readonly TipoCortina[]): readonly TipoCortina[] {
  return (tipos ?? []).filter((t) => t.activo);
}

/** true si el molde del tipo se despieza con las fórmulas de oscuridad. */
export function baseEsOscuridad(base: string | null | undefined): boolean {
  return BASES_OSCURIDAD.some((b) => norm(b) === norm(base));
}

// ── Validación ───────────────────────────────────────────────────────
// Varios módulos deciden por SUBSTRING del nombre de la categoría
// (`includes('PLETINA')`, `startsWith('DUO')`, `includes('SOFT_LIGHT')`…).
// Como la categoría efectiva se resuelve ANTES de esos predicados, el cálculo
// es correcto igual; pero un nombre que insinúe otro molde sería una trampa
// para cualquier lectura futura, así que se rechaza al guardar.

type ReglaNombre = {
  /** Se dispara si el nombre del tipo cumple esto… */
  test: (cat: string) => boolean;
  /** …y su base NO cumple esto otro. */
  baseOk: (base: string) => boolean;
  mensaje: string;
};

const REGLAS_NOMBRE: ReglaNombre[] = [
  {
    test: (c) => c.includes('PLETINA'),
    baseOk: (b) => b.includes('PLETINA'),
    mensaje: 'el nombre dice PLETINA pero el molde no es de pletina',
  },
  {
    test: (c) => c.includes('VERTICAL'),
    baseOk: () => false,
    mensaje: 'el nombre no puede decir VERTICAL: las verticales no son un molde',
  },
  {
    test: (c) => c.includes('BEE'),
    baseOk: () => false,
    mensaje: 'el nombre no puede decir BEE: el bee black no es un molde',
  },
  {
    test: (c) => c.startsWith('DUO'),
    baseOk: (b) => b.startsWith('DUO') || b.includes('DUAL'),
    mensaje: 'el nombre empieza con DUO pero el molde no es dúo',
  },
  {
    test: (c) => c.startsWith('ROL'),
    baseOk: (b) => b.startsWith('ROL') || b.includes('PLETINA_ROLLER'),
    mensaje: 'el nombre empieza con ROL pero el molde no es roller',
  },
  {
    test: (c) => c.includes('SOFT_LIGHT'),
    baseOk: (b) => b.includes('SOFT_LIGHT'),
    mensaje: 'el nombre dice SOFT_LIGHT pero el molde no es soft light',
  },
  {
    test: (c) => c.includes('DARK'),
    baseOk: (b) => b.includes('DARK'),
    mensaje: 'el nombre dice DARK pero el molde no es dark',
  },
  {
    test: (c) => c.includes('OSCURANTI'),
    baseOk: (b) => b.includes('OSCURANTI'),
    mensaje: 'el nombre dice OSCURANTI pero el molde no es oscuranti',
  },
];

export type ResultadoValidacionTipos = { errores: string[]; avisos: string[] };

export function validarTipos(tipos: readonly TipoCortina[]): ResultadoValidacionTipos {
  const errores: string[] = [];
  const avisos: string[] = [];
  const vistas = new Set<string>();
  const builtins = new Set(CATEGORIAS_BUILTIN.map((c) => norm(c)));

  for (const t of tipos) {
    const cat = (t.categoria || '').trim();
    const etiqueta = t.nombre?.trim() || cat || '(sin nombre)';

    if (!cat) {
      errores.push(`«${etiqueta}» no tiene categoría técnica.`);
      continue;
    }
    if (!RE_CATEGORIA.test(cat)) {
      errores.push(
        `La categoría «${cat}» solo puede tener letras, números y guion bajo, y empezar con una letra.`,
      );
    }
    if (builtins.has(norm(cat))) {
      errores.push(`La categoría «${cat}» ya existe en el sistema: elige otro nombre.`);
    }
    if (vistas.has(norm(cat))) {
      errores.push(`La categoría «${cat}» está repetida.`);
    }
    vistas.add(norm(cat));

    const base = (t.base || '').trim();
    if (!base) {
      errores.push(`«${etiqueta}» no tiene molde.`);
      continue;
    }
    if (BASES_PROHIBIDAS.some((b) => norm(b) === norm(base))) {
      errores.push(
        `«${etiqueta}» no puede usar ${base} como molde: es un sistema con estructura propia, no una variación de medidas. Un tipo así necesita desarrollo.`,
      );
      continue;
    }
    if (!BASES_PERMITIDAS.some((b) => norm(b) === norm(base))) {
      errores.push(`El molde «${base}» de «${etiqueta}» no existe.`);
      continue;
    }

    // Nombre que insinúa otro molde.
    const cu = norm(cat);
    const bu = norm(base);
    for (const r of REGLAS_NOMBRE) {
      if (r.test(cu) && !r.baseOk(bu)) {
        errores.push(`En «${cat}», ${r.mensaje} (${base}).`);
      }
    }

    // El sufijo de diámetro es semántico: de ahí sale el tubo de una ventana
    // todavía sin producto elegido.
    const dCat = diametroDelNombre(cat);
    const dBase = diametroDelNombre(base);
    if (dCat != null && dBase != null && dCat !== dBase) {
      errores.push(
        `«${cat}» dice ${dCat} mm pero su molde ${base} es de ${dBase} mm: el tubo se elegiría mal.`,
      );
    } else if (dCat == null && dBase != null) {
      avisos.push(
        `«${cat}» no dice el diámetro en el nombre. Agregarle «_${dBase}mm» ayuda a elegir el tubo antes de tener el producto.`,
      );
    }

    if (t.sistemas && t.sistemas.length === 0) {
      avisos.push(`«${cat}» quedó sin sistemas propios: usará las filas de ${base}.`);
    }
  }

  // Dos tipos que se pelean las mismas filas del catálogo.
  for (let i = 0; i < tipos.length; i++) {
    for (let j = i + 1; j < tipos.length; j++) {
      const a = tipos[i];
      const b = tipos[j];
      if (!a.sistemas?.length || !b.sistemas?.length) continue;
      const comparte = a.sistemas.some((s) => b.sistemas!.some((o) => norm(o) === norm(s)));
      if (comparte && norm(a.tipoIncluye) === norm(b.tipoIncluye)) {
        avisos.push(
          `«${a.categoria}» y «${b.categoria}» apuntan a las mismas filas del catálogo: podrían tomar medidas del otro.`,
        );
      }
    }
  }

  return { errores, avisos };
}
