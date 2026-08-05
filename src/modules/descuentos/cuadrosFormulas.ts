// ─────────────────────────────────────────────────────────────────────
// Cuadros de fórmulas por tipo de cortina (Admin → Catálogo técnico).
//
// Réplica de las pizarras del taller: por cada sistema y variante, la lista
// de piezas con su descuento/suma en cm y la medida que sale sobre una
// medida de prueba.
//
// REGLA DE ORO: el total NO se recalcula acá. Cada cuadro llama al motor de
// producción (`calcularDespiece`, que despacha a reglas-oscuridad /
// reglas-beeblack / calculoVertical), así que lo que se ve en pantalla es
// exactamente lo que se va a cortar. Este módulo solo ORDENA y ETIQUETA.
//
// Módulo puro: sin React ni Supabase.
// ─────────────────────────────────────────────────────────────────────
import { calcularDespiece, MODELO_DESPIECE_STUB, type ContextoDespiece } from './despiece';
import { FORMULAS_DEFAULT, type FormulasFamilias } from './formulasFamilias';
import {
  aplicarDefaultsPerfiles,
  familiaOscuridadConDiametro,
  medidaPerfilOscuridad,
  montajeBaseDisponible,
  type PerfilesOscuridad,
  type SuperficiePerfilKey,
  type VarianteOscuridad,
} from './reglas-oscuridad';
import { modelosParaCategoria, type ModeloDespiece } from './tipos';
import {
  GRUPO_TIPOS_PROPIOS,
  baseEsOscuridad,
  diametroDelNombre,
  esTipoPropio,
  tiposActivos,
  type TipoCortina,
} from './tiposCortina';

/** Contra qué medida se compara la pieza para mostrar su descuento o suma. */
export type ReferenciaMedida = 'ancho' | 'alto' | 'cantidad' | 'fija';

export type FilaCuadro = {
  componente: string;
  /** Columna del Excel de órdenes ('' = no viaja en él). */
  columnaExcel: string;
  medidaCm: number;
  referencia: ReferenciaMedida;
  /** medida − referencia: negativo = descuento, positivo = suma. null si no aplica. */
  ajusteCm: number | null;
  perforacion?: 'INTERNO' | 'EXTERNO';
  /** El perfil está activo pero le falta elegir superficie en Fase 2. */
  pendiente?: boolean;
  /**
   * Ruta del número editable de esta pieza dentro de `FormulasFamilias`
   * (por ejemplo `oscuridad.cenefaAdj.DARK.0`). Sin ruta, la medida no se
   * calibra desde acá: sale de la fila del catálogo o de otra pieza.
   */
  campo?: string;
  /** De dónde se mide, cuando NO es el ancho ("desde la cenefa trasera"). */
  desde?: string;
  /** El número lo comparten varios cuadros: tocarlo mueve a todos. */
  compartido?: boolean;
};

/** Un perfil opcional: se prende o apaga en Fase 2 y su medida depende de eso. */
export type FilaPerfilCuadro = {
  key: string;
  etiqueta: string;
  medidaCm: number;
  referencia: ReferenciaMedida;
  ajusteCm: number | null;
  /** Viene encendido de fábrica para esta familia y variante. */
  activoPorDefecto: boolean;
};

export type CuadroFormula = {
  id: string;
  titulo: string;
  subtitulo: string;
  /** Encabezado bajo el que se agrupa en pantalla. */
  grupo: string;
  filas: FilaCuadro[];
  /** Perfiles opcionales (oscuridad). Vacío en el resto de los sistemas. */
  perfiles: FilaPerfilCuadro[];
  /** Se ofrece elegir el montaje del perfil base (dentro / pared a pared). */
  montajeBase: boolean;
  aproximado: boolean;
  notas: string[];
  /** No hay fila en el catálogo para este sistema: se calculó con valores en cero. */
  sinModelo: boolean;
};

export type MedidaPrueba = { anchoCm: number; altoCm: number };

/** La misma medida redonda que usan las pizarras del taller. */
export const MEDIDA_PRUEBA_DEFAULT: MedidaPrueba = { anchoCm: 200, altoCm: 240 };

const VARIANTES: VarianteOscuridad[] = ['INTERNO', 'SEMI', 'EXTERNO'];

/** Piezas que son un CONTEO (no una medida): no tienen descuento contra el ancho. */
const COMPONENTES_CANTIDAD = ['Carritos', 'Lamas', 'Repuesto', 'Total lamas'];
/** Piezas de medida constante, que no dependen de la ventana. */
const COMPONENTES_FIJOS = ['Alto Tela Velcro'];

/**
 * Contra qué se mide cada pieza. Los nombres son los que ya viajan a los
 * documentos, así que sirven de clave estable.
 */
export function referenciaDe(componente: string): ReferenciaMedida {
  if (COMPONENTES_CANTIDAD.includes(componente)) return 'cantidad';
  if (COMPONENTES_FIJOS.includes(componente)) return 'fija';
  const c = componente.toLowerCase();
  // Laterales y manillas se cortan sobre el ALTO; el inferior y la base, sobre el ancho.
  if (c.includes('izquierdo') || c.includes('derecho') || c.includes('lateral') || c.includes('manilla')) {
    return 'alto';
  }
  if (c.startsWith('alto ') || c === 'alto de corte' || c === 'alto final') return 'alto';
  return 'ancho';
}

function ajuste(medidaCm: number, referencia: ReferenciaMedida, m: MedidaPrueba): number | null {
  if (referencia === 'cantidad' || referencia === 'fija') return null;
  const base = referencia === 'alto' ? m.altoCm : m.anchoCm;
  return Math.round((medidaCm - base) * 100) / 100;
}

/** Una definición de cuadro: qué categoría y variante dibujar. */
type DefinicionCuadro = {
  id: string;
  categoria: string;
  grupo: string;
  titulo: string;
  /** Variante de oscuridad o beeblack. */
  variante?: VarianteOscuridad;
  /** Tipo de cenefa que activa la familia con cenefa cuadrada. */
  cenefa?: string;
  /** Diámetro a forzar cuando no hay fila de catálogo (stub). */
  diametroMm?: number;
};

const OSCURIDAD: Array<{ categoria: string; grupo: string; nombre: string; cenefa?: string; diametroMm: number }> = [
  { categoria: 'SOFT_LIGHT_38mm', grupo: 'Soft Light', nombre: 'SOFT LIGHT (38 mm)', diametroMm: 38 },
  { categoria: 'SOFT_LIGHT_45mm', grupo: 'Soft Light', nombre: 'SOFT LIGHT (45 mm)', diametroMm: 45 },
  {
    categoria: 'SOFT_LIGHT_38mm',
    grupo: 'Soft Light',
    nombre: 'SOFT LIGHT 38 mm CON CENEFA CUADRADA',
    cenefa: 'Cuadrada',
    diametroMm: 38,
  },
  {
    categoria: 'SOFT_LIGHT_45mm',
    grupo: 'Soft Light',
    nombre: 'SOFT LIGHT 45 mm CON CENEFA CUADRADA',
    cenefa: 'Cuadrada',
    diametroMm: 45,
  },
  { categoria: 'DARK_38mm', grupo: 'Dark', nombre: 'DARK (38 mm)', diametroMm: 38 },
  { categoria: 'DARK_45mm', grupo: 'Dark', nombre: 'DARK (45 mm)', diametroMm: 45 },
  { categoria: 'OSCURANTI_63mm', grupo: 'Oscuranti', nombre: 'OSCURANTI (63 mm)', diametroMm: 63 },
];

/**
 * Cuadros de los tipos de cortina propios que se montan sobre un molde de
 * oscuridad. Heredan la forma del cuadro del molde (mismas piezas y variantes);
 * lo que cambia es que sus números salen del parche del tipo.
 */
function cuadrosDeTipos(tipos?: readonly TipoCortina[]): typeof OSCURIDAD {
  const out: typeof OSCURIDAD = [];
  for (const t of tiposActivos(tipos)) {
    if (!baseEsOscuridad(t.base)) continue;
    const molde = OSCURIDAD.filter((o) => o.categoria === t.base);
    for (const m of molde) {
      out.push({
        categoria: t.categoria,
        grupo: t.grupo || GRUPO_TIPOS_PROPIOS,
        nombre: m.cenefa ? `${t.nombre} CON CENEFA CUADRADA` : t.nombre,
        cenefa: m.cenefa,
        diametroMm: diametroDelNombre(t.categoria) ?? m.diametroMm,
      });
    }
  }
  return out;
}

function definiciones(tipos?: readonly TipoCortina[]): DefinicionCuadro[] {
  const defs: DefinicionCuadro[] = [];
  // Los tipos propios montados sobre un molde de oscuridad tienen su propio
  // cuadro: mismas piezas que el molde, pero editando el parche del tipo.
  const oscuridad = [...OSCURIDAD, ...cuadrosDeTipos(tipos)];
  for (const f of oscuridad) {
    for (const v of VARIANTES) {
      defs.push({
        id: `${f.categoria}|${f.cenefa ?? ''}|${v}`,
        categoria: f.categoria,
        grupo: f.grupo,
        titulo: `${f.nombre} ${v}`,
        variante: v,
        cenefa: f.cenefa,
        diametroMm: f.diametroMm,
      });
    }
  }
  for (const v of VARIANTES) {
    defs.push({
      id: `BEEBLACK|${v}`,
      categoria: 'BEEBLACK',
      grupo: 'Bee Black',
      titulo: `BEE BLACK ${v}`,
      variante: v,
    });
  }
  defs.push({ id: 'VERTICAL', categoria: 'VERTICAL', grupo: 'Vertical', titulo: 'VERTICAL (lamas 8,9)' });
  return defs;
}

/** Modelo del catálogo que corresponde a una categoría (el primero activo). */
function modeloDe(
  modelos: ModeloDespiece[],
  def: DefinicionCuadro,
  tipos?: readonly TipoCortina[],
): ModeloDespiece | null {
  const candidatos = modelosParaCategoria(modelos, def.categoria, tipos);
  if (candidatos.length === 0) return null;
  if (!def.diametroMm) return candidatos[0];
  return candidatos.find((m) => m.diametro_tubo_mm === def.diametroMm) ?? candidatos[0];
}

/** Índice de la variante dentro de las tablas [INTERNO, SEMI, EXTERNO]. */
const VI: Record<VarianteOscuridad, 0 | 1 | 2> = { INTERNO: 0, SEMI: 1, EXTERNO: 2 };

/** Las familias que cortan con descuento NETO sobre el ancho (no encadenan). */
const FAMILIAS_NETAS = ['SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC'];

/**
 * Qué número de las fórmulas gobierna cada pieza de un cuadro de oscuridad.
 * Devuelve la ruta dentro de `FormulasFamilias` más, si encadena, desde qué
 * pieza se mide (para que el editor no haga creer que el número es un
 * descuento contra el ancho).
 */
function campoOscuridad(
  componente: string,
  familia: string,
  variante: VarianteOscuridad,
  tipoCategoria?: string,
): { campo?: string; desde?: string; compartido?: boolean } {
  const vi = VI[variante];
  const neta = FAMILIAS_NETAS.includes(familia);
  // Un tipo propio edita SU parche; el molde, su tabla por familia.
  const tabla = (nombre: string) =>
    tipoCategoria
      ? "oscuridad.porTipo." + tipoCategoria + "." + nombre + "." + vi
      : "oscuridad." + nombre + "." + familia + "." + vi;
  switch (componente) {
    case 'Cenefa':
    case 'Cenefa Delantera':
    case 'Perfil superior':
      return { campo: tabla('cenefaAdj') };
    case 'Cenefa Trasera':
      return { campo: 'oscuridad.cenefaTraseraDesc', desde: 'la cenefa delantera', compartido: true };
    case 'Tubo':
      return neta
        ? { campo: tabla('tuboAdj') }
        : {
            campo: tabla('tuboPaso'),
            desde: familia.startsWith('DARK') ? 'la cenefa trasera' : 'la pieza frontal',
          };
    case 'Tela (ancho)':
      return neta
        ? { campo: tabla('telaAdj') }
        : { campo: 'oscuridad.telaPasoCm', desde: 'el tubo', compartido: true };
    case 'Peso':
      return neta
        ? { campo: tabla('pesoAdj') }
        : { campo: 'oscuridad.pesoPasoCm', desde: 'la tela', compartido: true };
    case 'Alto Tela Velcro':
      return { campo: 'oscuridad.altoTelaVelcroCm', compartido: true };
    case 'Alto tela':
      return { campo: 'oscuridad.altoTelaExtraCm', desde: 'el alto', compartido: true };
    default:
      // Ancho Tela Velcro copia la cenefa; los perfiles van en su propio bloque.
      return {};
  }
}

/** Ídem para el beeblack: sus piezas salen de la tabla de ajustes por variante. */
function campoBeeblack(componente: string, variante: string): { campo?: string; compartido?: boolean } {
  const base = `beeblack.ajustes.${variante}`;
  switch (componente) {
    case 'Perfil superior (ancho)':
    case 'Perfil inferior (ancho)':
      return { campo: `${base}.perfilAncho` };
    case 'Perfil lateral izq (alto)':
    case 'Perfil lateral der (alto)':
      return { campo: `${base}.perfilLateral` };
    case 'Manilla izq (alto)':
    case 'Manilla der (alto)':
      return { campo: `${base}.manilla` };
    case 'Ancho tela':
      return { campo: `${base}.anchoTela` };
    case 'Alto tela':
      return { campo: `${base}.altoTela` };
    case 'Total lamas':
      return { campo: `${base}.lamasDivisor` };
    default:
      return {};
  }
}

const ETIQUETA_PERFIL: Array<{ key: SuperficiePerfilKey; etiqueta: string }> = [
  { key: 'izqMuro', etiqueta: 'Perfil izquierdo a muro' },
  { key: 'izqPiso', etiqueta: 'Perfil izquierdo al piso' },
  { key: 'izqMarco', etiqueta: 'Perfil izquierdo dentro del marco' },
  { key: 'derMuro', etiqueta: 'Perfil derecho a muro' },
  { key: 'derPiso', etiqueta: 'Perfil derecho al piso' },
  { key: 'derMarco', etiqueta: 'Perfil derecho dentro del marco' },
  { key: 'infMuro', etiqueta: 'Perfil inferior a muro' },
  { key: 'infPiso', etiqueta: 'Perfil inferior al piso' },
  { key: 'infMarco', etiqueta: 'Perfil inferior dentro del marco' },
];

/** Un cuadro: el despiece del sistema más sus perfiles opcionales. */
export function construirCuadro(
  def: DefinicionCuadro,
  modelos: ModeloDespiece[],
  medida: MedidaPrueba,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
  tipos?: readonly TipoCortina[],
): CuadroFormula {
  const modelo = modeloDe(modelos, def, tipos);
  const efectivo: ModeloDespiece = modelo ?? {
    ...MODELO_DESPIECE_STUB,
    diametro_tubo_mm: def.diametroMm ?? 0,
  };

  const ctx: ContextoDespiece = {
    categoria: def.categoria,
    altoCm: medida.altoCm,
    cenefa: def.cenefa ?? null,
    oscuridadVariante: def.variante ?? null,
    beeblackVariante: def.variante ?? null,
    formulas,
    tipos,
  };
  const despiece = calcularDespiece(efectivo, medida.anchoCm, ctx);

  // Perfiles opcionales: solo las familias de oscuridad los tienen.
  const familia = familiaOscuridadConDiametro(
    def.categoria,
    def.cenefa ?? null,
    efectivo.diametro_tubo_mm,
    tipos,
  );
  // Si la categoría es un tipo propio, sus números viven en el parche.
  const tipoCat = esTipoPropio(def.categoria, tipos) ? def.categoria : undefined;
  const variante = def.variante ?? 'INTERNO';
  const esBeeblack = def.categoria === 'BEEBLACK';

  const filas: FilaCuadro[] = despiece.cortes.map((c) => {
    const referencia = referenciaDe(c.componente);
    const edicion = familia
      ? campoOscuridad(c.componente, familia, variante, tipoCat)
      : esBeeblack
        ? campoBeeblack(c.componente, variante)
        : {};
    return {
      componente: c.componente,
      columnaExcel: c.columnaExcel,
      medidaCm: c.medidaCm,
      referencia,
      ajusteCm: ajuste(c.medidaCm, referencia, medida),
      perforacion: c.perforacion,
      pendiente: c.pendienteMedida,
      ...edicion,
    };
  });
  const perfiles: FilaPerfilCuadro[] = [];
  if (familia) {
    const defaults: PerfilesOscuridad = aplicarDefaultsPerfiles({}, familia, variante);
    for (const p of ETIQUETA_PERFIL) {
      const medidaCm = medidaPerfilOscuridad(
        familia,
        variante,
        p.key,
        medida.anchoCm,
        medida.altoCm,
        undefined,
        formulas.oscuridad,
      );
      const referencia = p.key.startsWith('inf') ? 'ancho' : 'alto';
      perfiles.push({
        key: p.key,
        etiqueta: p.etiqueta,
        medidaCm,
        referencia,
        ajusteCm: ajuste(medidaCm, referencia, medida),
        activoPorDefecto: p.key.startsWith('izq')
          ? !!defaults.izqActivo
          : p.key.startsWith('der')
            ? !!defaults.derActivo
            : !!defaults.infActivo,
      });
    }
  }

  return {
    id: def.id,
    titulo: def.titulo,
    subtitulo: modelo
      ? `${modelo.sistema} · ${modelo.tipo_rol}`
      : 'sin fila en el catálogo de descuentos',
    grupo: def.grupo,
    filas,
    perfiles,
    montajeBase: familia ? montajeBaseDisponible(familia, variante) : false,
    aproximado: despiece.aproximado,
    notas: despiece.notas,
    sinModelo: !modelo,
  };
}

/**
 * Los cuadros de las familias con fórmula propia (oscuridad, beeblack,
 * vertical), que son las que el taller consulta en pizarra.
 */
export function construirCuadros(
  modelos: ModeloDespiece[],
  medida: MedidaPrueba = MEDIDA_PRUEBA_DEFAULT,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
  tipos?: readonly TipoCortina[],
): CuadroFormula[] {
  return definiciones(tipos).map((d) => construirCuadro(d, modelos, medida, formulas, tipos));
}

/**
 * Los cuadros de roller, dúo, cenefa ovalada y pletina: uno por fila del
 * catálogo, porque ahí la fórmula ES la fila (sus descuentos son los campos).
 */
export function construirCuadrosDeCatalogo(
  modelos: ModeloDespiece[],
  medida: MedidaPrueba = MEDIDA_PRUEBA_DEFAULT,
  formulas: FormulasFamilias = FORMULAS_DEFAULT,
): CuadroFormula[] {
  const SISTEMAS_TABULARES = [
    'ROLLER_SIMPLE',
    'ROLLER_DUAL',
    'CENEFA_OVALADA',
    'CENEFA_OVALADA_DUO',
    'PLETINA_ROLLER',
    'PLETINA_DUO',
  ];
  return modelos
    .filter((m) => SISTEMAS_TABULARES.includes(m.sistema))
    .map((m) => {
      const categoria = m.sistema.startsWith('PLETINA')
        ? m.sistema === 'PLETINA_DUO'
          ? 'PLETINA_DUO_V'
          : 'PLETINA_ROLLER_V'
        : '';
      const despiece = calcularDespiece(m, medida.anchoCm, {
        categoria,
        altoCm: medida.altoCm,
        formulas,
      });
      const filas: FilaCuadro[] = despiece.cortes.map((c) => {
        const referencia = referenciaDe(c.componente);
        return {
          componente: c.componente,
          columnaExcel: c.columnaExcel,
          medidaCm: c.medidaCm,
          referencia,
          ajusteCm: ajuste(c.medidaCm, referencia, medida),
        };
      });
      return {
        id: `${m.sistema}|${m.tipo_rol}|${m.mecanismo}`,
        titulo: m.tipo_rol,
        subtitulo: [m.mecanismo, m.diametro_tubo_mm ? `${m.diametro_tubo_mm} mm` : '']
          .filter(Boolean)
          .join(' · '),
        grupo: m.sistema,
        filas,
        perfiles: [],
        montajeBase: false,
        aproximado: despiece.aproximado,
        notas: despiece.notas,
        sinModelo: false,
      } satisfies CuadroFormula;
    });
}

/**
 * Números que no son el ajuste de ninguna pieza concreta pero mueven el corte:
 * los conteos de la vertical, la distancia peso–tubo del roller y los extras
 * del beeblack. Se editan en su propio panel para que quede claro que no
 * pertenecen a un cuadro.
 */
export type ConstanteEditable = {
  campo: string;
  etiqueta: string;
  ayuda: string;
  unidad: string;
};

export const CONSTANTES_EDITABLES: Array<{ grupo: string; items: ConstanteEditable[] }> = [
  {
    grupo: 'Vertical',
    items: [
      {
        campo: 'vertical.pasoCarritoCm',
        etiqueta: 'Paso del carrito',
        ayuda: 'Un carrito cada tantos cm de varilla.',
        unidad: 'cm',
      },
      {
        campo: 'vertical.extraCarrito',
        etiqueta: 'Carritos extra',
        ayuda: 'Se suman después de dividir (holgura del taller).',
        unidad: 'u',
      },
      {
        campo: 'vertical.lamasRepuesto',
        etiqueta: 'Lamas de repuesto',
        ayuda: 'Lamas de tela extra que se cortan y no se instalan.',
        unidad: 'u',
      },
    ],
  },
  {
    grupo: 'Roller y dúo',
    items: [
      {
        campo: 'roller.pesoVsTuboCm',
        etiqueta: 'Peso respecto del tubo',
        ayuda: 'El peso se corta siempre estos cm menos que el tubo.',
        unidad: 'cm',
      },
    ],
  },
  {
    grupo: 'Bee Black',
    items: [
      {
        campo: 'beeblack.extraCordonCm',
        etiqueta: 'Holgura del cordón',
        ayuda: 'Cordón = perfil superior + perfil lateral + esto.',
        unidad: 'cm',
      },
      {
        campo: 'beeblack.perfilLateralFueraMarcoCm',
        etiqueta: 'Lateral fuera del marco',
        ayuda: 'Pisa el ajuste de la variante cuando se instala fuera del marco.',
        unidad: 'cm',
      },
      {
        campo: 'beeblack.lamasExtra',
        etiqueta: 'Lamas extra',
        ayuda: 'Total de lamas = ancho ÷ divisor + esto, redondeado hacia arriba.',
        unidad: 'u',
      },
    ],
  },
  {
    grupo: 'Oscuridad (compartido)',
    items: [
      {
        campo: 'oscuridad.perfilLateralMuroSuma',
        etiqueta: 'Perfil lateral a muro',
        ayuda: 'Se suma al alto. A piso y dentro del marco van al alto exacto.',
        unidad: 'cm',
      },
      {
        campo: 'oscuridad.altoTelaExtraCm',
        etiqueta: 'Extra del alto de tela',
        ayuda: 'Reserva sobre el alto para el corte de la tela.',
        unidad: 'cm',
      },
      {
        campo: 'oscuridad.altoTelaVelcroCm',
        etiqueta: 'Alto de la tela de velcro',
        ayuda: 'Medida fija de la tira de velcro del DARK.',
        unidad: 'cm',
      },
    ],
  },
  {
    grupo: 'Cenefas de adicional',
    items: [
      {
        campo: 'adicionales.cenefaOvaladaCenefaCm',
        etiqueta: 'Cenefa ovalada',
        ayuda: 'Descuento al ancho cuando el modelo no trae el suyo.',
        unidad: 'cm',
      },
      {
        campo: 'adicionales.cuadradaCon1TapaCm',
        etiqueta: 'Cuadrada con 1 tapa',
        ayuda: 'Ajuste al ancho de corte.',
        unidad: 'cm',
      },
      {
        campo: 'adicionales.cuadradaCon2TapasCm',
        etiqueta: 'Cuadrada con 2 tapas',
        ayuda: 'Ajuste al ancho de corte.',
        unidad: 'cm',
      },
      {
        campo: 'adicionales.cuadradaMuroMuroCm',
        etiqueta: 'Cuadrada muro a muro',
        ayuda: 'Ajuste al ancho de corte (opción base).',
        unidad: 'cm',
      },
    ],
  },
];

/** Agrupa cuadros por su encabezado, conservando el orden de aparición. */
export function agruparCuadros(cuadros: CuadroFormula[]): Array<{ grupo: string; cuadros: CuadroFormula[] }> {
  const mapa = new Map<string, CuadroFormula[]>();
  for (const c of cuadros) {
    const lista = mapa.get(c.grupo);
    if (lista) lista.push(c);
    else mapa.set(c.grupo, [c]);
  }
  return [...mapa.entries()].map(([grupo, cs]) => ({ grupo, cuadros: cs }));
}

/** "−0,3" / "+7,5" / "—" para la columna de descuento. */
export function formatearAjuste(ajusteCm: number | null): string {
  if (ajusteCm === null) return '—';
  if (ajusteCm === 0) return '0';
  const txt = Math.abs(ajusteCm).toString().replace('.', ',');
  return `${ajusteCm < 0 ? '−' : '+'}${txt}`;
}
