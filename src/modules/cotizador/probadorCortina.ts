// ─────────────────────────────────────────────────────────────────────
// BANCO DE PRUEBAS — resolver una cortina imaginaria con la configuración
// guardada, sin crear una OT.
//
// Regla de oro (la misma de los cuadros de fórmulas): acá NO se calcula nada
// por cuenta propia. Se llama a las MISMAS funciones que usan Fase 2 y Fase 4
// —modeloVentanaPorAncho, mecanismoParaPano, tuberiaParaPano, calcularDespiece,
// codigoEstructura, insumosDePano— con las reglas, fórmulas y colores que están
// guardados. Si el banco muestra algo, eso es exactamente lo que va a salir en
// producción; si difiere, el bug está en el motor y no en la vista previa.
//
// Módulo puro: sin React ni Supabase (las dependencias entran por parámetro).
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import type { Pano } from './types';
import {
  MODELO_DESPIECE_STUB,
  calcularDespiece,
  contextoDespieceDesdePano,
} from '@/modules/descuentos/despiece';
import {
  codigoTuberiaDeChip,
  mecanismoParaPano,
  modeloVentanaPorAncho,
  tuberiaParaPano,
} from '@/modules/descuentos/chips';
import {
  categoriaRequiereMecanismo,
  reglaAnchoAplicable,
  reglaCategoriaAplicable,
  numeroMecPorColor,
} from '@/modules/descuentos/reglas-mecanismo';
import {
  REGLAS_SELECCION_DEFAULT,
  derivarOpciones,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import {
  FORMULAS_DEFAULT,
  type FormulasFamilias,
} from '@/modules/descuentos/formulasFamilias';
import {
  familiaOscuridad,
  type VarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import { esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { codigoEstructura } from '@/modules/descuentos/codigos-estructura';
import { insumosDePano, type InsumoCortina } from './insumosCortina';
import {
  codCadenaAutoPorAlto,
  colorCadenaCorto,
  derivarLargoColor,
  largoCadenaAuto,
  type CadenaInsumo,
} from './cadenas';

export type EntradaProbador = {
  categoria: string;
  anchoM: number;
  altoM: number;
  /** Color de accesorios (código corto del catálogo de colores). */
  color: string;
  /** 'No' | 'Ovalada' | 'Cuadrada a muro' | 'Cuadrada a techo'. */
  cenefa?: string;
  /** Solo sistemas de oscuridad. */
  variante?: VarianteOscuridad;
  usarTuboE78?: boolean;
};

export type DepsProbador = {
  /** Catálogo de modelos de despiece (useCatalogoEditable). */
  modelos: ModeloDespiece[];
  reglas?: ReglasSeleccion;
  formulas?: FormulasFamilias;
  /** Cadenas del inventario, para probar la auto-selección por alto y color. */
  cadenas?: CadenaInsumo[];
};

export type CorteProbador = {
  componente: string;
  columnaExcel: string;
  medidaCm: number;
  cod: string;
};

export type ResultadoProbador = {
  modelo: ModeloDespiece | null;
  /** Chip del kit, o '' si la configuración no elige uno (lo pone el vendedor). */
  kit: string;
  /** Qué decidió el kit, en palabras: sirve para auditar la configuración. */
  reglaKit: string;
  /** Chip de tubería, o '' si la categoría no lleva tubo. */
  tubo: string;
  cadena: { cod: string; largo: string; color: string } | null;
  /** Qué decidió la cadena, en palabras (espejo de `reglaKit`). */
  reglaCadena: string;
  cortes: CorteProbador[];
  insumos: InsumoCortina[];
  /** Lo que quedó a mano o sin catalogar, para verlo antes de vender. */
  avisos: string[];
};

/** Piezas que normalmente traen código de inventario: si salen sin él, se avisa. */
const COLUMNAS_CON_CODIGO = new Set([
  'TUBO',
  'PLETINA',
  'PESO',
  'PESO U',
  'PESO SOFT LIGHT',
  'CENEFA OVALADA',
]);

/**
 * Resuelve una cortina de prueba con la configuración dada. Todas las
 * dependencias tienen default de fábrica, así que llamarla sin nada muestra
 * cómo se comportaría la app recién instalada.
 */
export function resolverCortinaDePrueba(
  entrada: EntradaProbador,
  deps: DepsProbador,
): ResultadoProbador {
  const reglas = deps.reglas ?? REGLAS_SELECCION_DEFAULT;
  const formulas = deps.formulas ?? FORMULAS_DEFAULT;
  const { modelos, cadenas = [] } = deps;
  const { categoria, anchoM, altoM, color, cenefa } = entrada;
  const usarE78 = !!entrada.usarTuboE78;
  const avisos: string[] = [];

  const opc = derivarOpciones(reglas, usarE78);
  const esBeeblack = esCategoriaBeeblack(categoria);
  const esVertical = esCategoriaVertical(categoria);

  // ── Modelo de fabricación (default por color + regla por ancho)
  const modelo = modeloVentanaPorAncho(
    modelos,
    categoria,
    color,
    anchoM,
    usarE78,
    reglas.mecanismo,
    reglas.tipos,
  );
  if (!modelo && !esBeeblack) {
    avisos.push(
      'No hay ninguna fila del catálogo para esta categoría: el despiece sale con medidas en cero.',
    );
  }

  // El paño imaginario: lo mínimo que el motor necesita, con el color escrito
  // en los cuatro campos como lo hace el botón de Fase 2.
  const pano: Partial<Pano> = {
    ancho: anchoM,
    alto: altoM,
    color,
    colorMecanismo: color,
    colorCadena: color,
    colorPeso: color,
    cenefa: cenefa ?? 'No',
    oscuridadVariante: entrada.variante ?? '',
  };

  // ── Kit de mecanismo + de dónde salió
  const kit = mecanismoParaPano(
    pano,
    color,
    modelo,
    opc.mecanismoResolucion,
    categoria,
    anchoM,
    usarE78,
    reglas,
  );
  const reglaKit = explicarKit(categoria, anchoM, color, usarE78, reglas, kit);
  if (!kit && categoriaRequiereMecanismo(categoria, reglas.mecanismo) && !esVertical) {
    avisos.push('Ninguna regla elige un kit para este color: lo tiene que poner el vendedor.');
  }

  // ── Tubería (el beeblack no lleva: su estructura son los perfiles)
  const tubo =
    esBeeblack || !modelo
      ? ''
      : tuberiaParaPano(anchoM, modelo, '', opc.tuberiaUI, categoria, reglas.tuberia) || '';
  const tuberiaCod = codigoTuberiaDeChip(tubo);

  // ── Cadena automática por alto + color, contra el inventario
  const codCadena = codCadenaAutoPorAlto(altoM, color, categoria, cadenas, reglas.tipos, reglas.cadenas);
  const cadena = codCadena
    ? (() => {
        const d = derivarLargoColor(codCadena, cadenas, reglas.cadenas);
        return { cod: codCadena, largo: d.largoCadena, color: d.colorCadena };
      })()
    : null;
  const reglaCadena = explicarCadena(altoM, color, categoria, reglas, !!cadena);
  if (!cadena && cadenas.length > 0 && categoriaRequiereMecanismo(categoria, reglas.mecanismo)) {
    avisos.push(
      'No hay en el inventario una cadena de este largo y color: la elige el vendedor en Fase 2.',
    );
  }

  // ── Despiece con los códigos de estructura (mismo trío que usa Tela)
  const anchoCm = anchoM * 100;
  const ctx = contextoDespieceDesdePano(
    { categoria, alto: altoM, oscuridadVariante: entrada.variante ?? '' },
    pano as Parameters<typeof contextoDespieceDesdePano>[1],
    { formulas, tipos: reglas.tipos },
  );
  const cortes: CorteProbador[] =
    anchoCm > 0
      ? calcularDespiece(modelo ?? MODELO_DESPIECE_STUB, anchoCm, ctx).cortes.map((c) => ({
          componente: c.componente,
          columnaExcel: c.columnaExcel,
          medidaCm: c.medidaCm,
          cod: codigoEstructura(c.columnaExcel, color, tuberiaCod, reglas.colores),
        }))
      : [];
  const sinCodigo = cortes.filter((c) => !c.cod && COLUMNAS_CON_CODIGO.has(c.columnaExcel));
  if (sinCodigo.length > 0) {
    avisos.push(
      `Sin código de bodega en este color: ${sinCodigo.map((c) => c.componente).join(', ')}. ` +
        'Se fabrica igual, pero conviene catalogarlo.',
    );
  }

  // ── Insumos de bodega del paño
  const insumos = insumosDePano(pano, {
    categoria,
    ventanaColor: color,
    anchoM,
    tipos: reglas.tipos,
    colores: reglas.colores,
  });
  const insumosSinCodigo = insumos.filter((i) => !i.codigo);
  if (insumosSinCodigo.length > 0) {
    avisos.push(
      `Insumos sin código: ${insumosSinCodigo.map((i) => i.descripcion).join(', ')}.`,
    );
  }

  // La cortina de oscuridad se despieza por variante: avisar si no se eligió.
  if (familiaOscuridad(categoria, cenefa, reglas.tipos) && !entrada.variante) {
    avisos.push('Sin variante elegida se usa INTERNO, que es el default de Fase 1.');
  }

  return { modelo, kit, reglaKit, tubo, cadena, reglaCadena, cortes, insumos, avisos };
}

/**
 * En palabras, qué decidió el kit. El orden refleja el de `mecanismoParaPano`:
 * ancho → oscuridad de 45 → categoría → color. Sirve para auditar por qué la
 * configuración eligió lo que eligió, que es justo lo que cuesta ver hoy.
 */
function explicarKit(
  categoria: string,
  anchoM: number,
  color: string,
  usarE78: boolean,
  reglas: ReglasSeleccion,
  kit: string,
): string {
  if (!kit) return 'ninguna regla aplica: lo elige el vendedor';
  if (kit === 'VELCRO') return 'pletina: va con velcro, sin kit de mecanismo';

  const porAncho = reglaAnchoAplicable(categoria, anchoM, color, usarE78, reglas.mecanismo);
  if (porAncho) {
    return `regla por ancho «${porAncho.regla.descripcion || porAncho.regla.categoria}»`;
  }
  const porCategoria = reglaCategoriaAplicable(categoria, color, reglas.mecanismo);
  if (porCategoria) {
    return `regla por categoría «${porCategoria.descripcion || porCategoria.categoria}»`;
  }
  if (numeroMecPorColor(color, reglas.mecanismo) != null) {
    return 'kit por color de accesorios';
  }
  return 'kit guardado / del modelo del catálogo';
}

/**
 * En palabras, qué decidió la cadena. Mismo orden que `codCadenaAutoPorAlto`:
 * la categoría manda sobre la escalera, y el color puede vetar las dos.
 */
function explicarCadena(
  altoM: number,
  color: string,
  categoria: string,
  reglas: ReglasSeleccion,
  hayCadena: boolean,
): string {
  if (esCategoriaVertical(categoria)) {
    return `vertical: cadena fija de ${reglas.cadenas.verticalLargo === '3mts' ? '3 m' : reglas.cadenas.verticalLargo}`;
  }
  if (!categoriaRequiereMecanismo(categoria, reglas.mecanismo)) {
    return 'esta cortina no lleva cadena';
  }
  // El color veta antes que cualquier regla: los metálicos y cafés no tienen
  // cadena propia, así que la pone el vendedor por más que el alto calce.
  if (!colorCadenaCorto(color)) {
    return 'este color no tiene cadena: la elige el vendedor';
  }
  const elegido = largoCadenaAuto(altoM, categoria, reglas.tipos, reglas.cadenas);
  if (!elegido) {
    // Sin largo hay dos motivos posibles: el alto quedó bajo el tramo más chico
    // o el color no tiene cadena (metálicos y cafés).
    const bajoElMinimo = reglas.cadenas.tramosAlto.every((t) => altoM < t.altoMinM);
    return bajoElMinimo
      ? 'el alto queda bajo el tramo más chico: la elige el vendedor'
      : 'la elige el vendedor';
  }
  if (!hayCadena) {
    return `${elegido.motivo} — pero no hay una de ese color en el inventario`;
  }
  return elegido.motivo;
}
