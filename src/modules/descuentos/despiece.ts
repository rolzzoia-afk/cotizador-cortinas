// ─────────────────────────────────────────────────────────────────────
// MOTOR DE DESPIECE (Fase C del plan de descuentos de fabricación).
//
// Convierte la medida nominal vendida (ancho en cm) en las medidas de
// corte de cada componente, según el modelo del catálogo de descuentos.
// Reglas VALIDADAS contra OTs reales (3024/3029/3031) y el dueño
// (2026-06-12), que corrigen al README del Excel:
//   · corte tubo/pletina = ancho − dcto_tubo
//   · corte tela (ancho) = peso − suma_peso_cm   (la tela se cuelga del PESO,
//     0.1 más angosta que el peso = tubo − 0.4 − 0.1; confirmado OT 3074)
//   · peso               = tubo − 0.4  (constante de taller, confirmada en
//     todas las OTs reales; NO usa la columna suma_peso)
//   · cenefa ovalada     = ancho − dcto_tubo − dcto_cenefa
//   · DÚO peso interno   = baseTubo − dcto_tela_cm  (= MISMO ancho que la tela;
//     el peso interno se cose dentro de la tela. Validado con OT 3048.)
//   · DÚO peso U         = baseTubo − peso_u_duo_cm  (validado con OT 3048)
//   · cenefa del./tras.  = ancho − dcto_cenefa_del / dcto_cenefa_tra
// Nota: en DÚO, dcto_tela_cm (0.5) ES el descuento de la tela → fija también el
// ancho del peso interno. En roller la tela usa peso − suma_peso (ver abajo).
//
// `columnaExcel` corresponde a las COLUMNAS_CORTE que el optimizador
// legacy procesa al cargar el Excel de órdenes (multi-corte). La TELA no
// viaja en ese Excel (va por el flujo de telas), por eso va sin columna.
//
// Los sistemas de OSCURIDAD (SOFT_LIGHT*, DARK_ROLLER, OSCURANTI) tienen
// además perfiles que dependen de la INSTALACIÓN (a muro/piso, izq/der)
// y de reglas medida mayor/menor — eso NO está cubierto aún: el despiece
// de esos sistemas se marca `aproximado` y el taller debe revisarlo.
// Módulo puro: sin React/Supabase.
// ─────────────────────────────────────────────────────────────────────
import type { ModeloDespiece } from './tipos';
import {
  cortesOscuridad,
  familiaOscuridad,
  normalizarVarianteOscuridad,
  type MedidasPerfilesOscuridad,
  type PerfilesOscuridad,
} from './reglas-oscuridad';
import {
  cortesBeeblack,
  esCategoriaBeeblack,
  normalizarVarianteBeeblack,
  type MedidasBeeblack,
  type TogglesBeeblack,
  type VarianteBeeblack,
} from './reglas-beeblack';

export type ContextoDespiece = {
  categoria?: string;
  sentido?: string | null;
  /** Alto nominal (cm) — necesario para perfiles laterales de oscuridad. */
  altoCm?: number;
  /** Tipo de cenefa del paño ('Cuadrada' activa la familia con cenefa cuadrada). */
  cenefa?: string | null;
  /** Variante de instalación elegida en Fase 2 (INTERNO|SEMI|EXTERNO). */
  oscuridadVariante?: string | null;
  /** Interruptores ON/OFF de perfiles (Fase 2). */
  perfiles?: PerfilesOscuridad;
  /** Medidas manuales (cm) que sobreescriben la calculada de cada perfil. */
  perfilesMedidas?: MedidasPerfilesOscuridad;
  /** BEEBLACK: variante INTERNO | EXTERNO_SEMI. */
  beeblackVariante?: string | null;
  beeblackToggles?: TogglesBeeblack;
  beeblackMedidas?: MedidasBeeblack;
};

export type CorteDespiece = {
  componente: string;
  /** Columna del Excel de órdenes del optimizador ('' = no viaja en él). */
  columnaExcel: string;
  medidaCm: number;
};

export type Despiece = {
  cortes: CorteDespiece[];
  /** true en sistemas de oscuridad: faltan reglas de perfiles/instalación. */
  aproximado: boolean;
  notas: string[];
};

const SISTEMAS_OSCURIDAD = ['SOFT_LIGHT', 'SOFT_LIGHT_CENEFA_CUAD', 'DARK_ROLLER', 'OSCURANTI'];

/** Columna del Excel de órdenes para pesos de sistemas de oscuridad (≠ PESO roller). */
export const COLUMNA_PESO_OSCURIDAD = 'PESO SOFT LIGHT';

/** Regla de taller: el peso roller se corta SIEMPRE 0.4 cm menos que el tubo. */
export const PESO_VS_TUBO_CM = 0.4;

const r1 = (n: number) => Math.round(n * 10) / 10;

function columnaPesoExcel(modelo: ModeloDespiece): string {
  return SISTEMAS_OSCURIDAD.includes(modelo.sistema) ? COLUMNA_PESO_OSCURIDAD : 'PESO';
}

/**
 * Calcula el despiece de UNA cortina.
 * @param modelo  fila del catálogo de descuentos (snapshot)
 * @param anchoCm ancho nominal vendido, en cm
 * @param ctx     categoría y sentido de la ventana (Soft Light 38 mm)
 */
export function calcularDespiece(
  modelo: ModeloDespiece,
  anchoCm: number,
  ctx?: ContextoDespiece,
): Despiece {
  const cortes: CorteDespiece[] = [];
  const notas: string[] = [];
  if (!anchoCm || anchoCm <= 0) return { cortes, aproximado: false, notas: ['Sin ancho.'] };

  // ── BEEBLACK: cierre horizontal con lamas ──
  if (esCategoriaBeeblack(ctx?.categoria)) {
    const variante = normalizarVarianteBeeblack(
      ctx?.beeblackVariante ?? ctx?.sentido,
      'INTERNO',
    ) as VarianteBeeblack;
    const altoCm = ctx?.altoCm ?? 0;
    const cortesBb = cortesBeeblack(
      variante,
      anchoCm,
      altoCm,
      ctx?.beeblackToggles ?? {},
      ctx?.beeblackMedidas ?? {},
    );
    for (const c of cortesBb) {
      cortes.push({ componente: c.componente, columnaExcel: c.columnaExcel, medidaCm: c.medidaCm });
    }
    return { cortes, aproximado: false, notas };
  }

  // ── Sistemas de oscuridad: motor dedicado con fórmulas del Excel ──
  // (Soft Light 38/45, Soft Light con cenefa cuadrada, Oscuranti, Dark).
  const familia = familiaOscuridad(ctx?.categoria, ctx?.cenefa);
  if (familia) {
    const variante = normalizarVarianteOscuridad(
      ctx?.oscuridadVariante ?? ctx?.sentido,
      'INTERNO',
    );
    const altoCm = ctx?.altoCm ?? 0;
    const cortesOsc = cortesOscuridad(
      familia,
      variante,
      anchoCm,
      altoCm,
      ctx?.perfiles ?? {},
      ctx?.perfilesMedidas ?? {},
    );
    for (const c of cortesOsc) {
      cortes.push({ componente: c.componente, columnaExcel: c.columnaExcel, medidaCm: c.medidaCm });
    }
    if (modelo.notas) notas.push(modelo.notas);
    return { cortes, aproximado: false, notas };
  }

  const esDuo = modelo.sistema === 'CENEFA_OVALADA_DUO' || modelo.sistema === 'PLETINA_DUO';
  const conTubo = modelo.diametro_tubo_mm > 0;
  // En cenefa ovalada la TAPA (cenefa) es la pieza más ancha = ancho − dcto_cenefa,
  // y el TUBO va detrás, deducido por tubo + cenefa. (Antes el tubo restaba solo
  // dcto_tubo y la cenefa restaba ambos → quedaban invertidos vs. el manual.)
  const tieneCenefaOvalada = modelo.dcto_cenefa_cm > 0;
  const baseTubo =
    anchoCm - modelo.dcto_tubo_cm - (tieneCenefaOvalada ? modelo.dcto_cenefa_cm : 0);

  {
    // Tubo o pletina (en pletinas el dcto_tubo aplica a la pletina)
    if (modelo.dcto_tubo_cm > 0 || conTubo) {
      cortes.push({
        componente: conTubo ? 'Tubo' : 'Pletina',
        columnaExcel: conTubo ? 'TUBO' : 'PLETINA',
        medidaCm: r1(baseTubo),
      });
    }

    // Tela (ancho) = PESO − suma_peso_cm. La tela se cuelga del PESO (no del
    // tubo): queda 0.1 más angosta que el peso (= tubo − 0.4 − 0.1). Regla del
    // taller confirmada con OT 3074 (roller) y la cenefa ovalada. Referencial:
    // viaja por el flujo de telas, no por el Excel de órdenes.
    if (modelo.suma_peso_cm > 0) {
      const refTela = baseTubo - PESO_VS_TUBO_CM; // = peso
      cortes.push({
        componente: 'Tela (ancho)',
        columnaExcel: '',
        medidaCm: r1(refTela - modelo.suma_peso_cm),
      });
    }

    // Pesos DÚO (validados con OT real 3048, ovalada 38 mm):
    //   · Peso interno (E13) → se corta al MISMO ancho que la tela = baseTubo −
    //     dcto_tela_cm. El peso interno se cose dentro de la bolsa de la tela,
    //     por eso va exactamente del ancho de la tela (regla "peso interno = tela"
    //     confirmada por el dueño). `peso_interno_duo_cm` solo marca que el modelo
    //     LLEVA peso interno; la medida la da dcto_tela_cm.
    //   · Peso U (lágrima)   = baseTubo − peso_u_duo_cm.
    if (esDuo) {
      // Tela dúo: en dúo NO corre la regla peso − suma_peso (suma_peso_cm=0);
      // el ancho de la tela lo fija dcto_tela_cm sobre el tubo. Referencial
      // (etiqueta/hoja cálculo): viaja por el flujo de telas, no por el Excel.
      if (modelo.dcto_tela_cm > 0) {
        cortes.push({
          componente: 'Tela (ancho)',
          columnaExcel: '',
          medidaCm: r1(baseTubo - modelo.dcto_tela_cm),
        });
      }
      if (modelo.peso_interno_duo_cm > 0) {
        cortes.push({
          componente: 'Peso interno (E13)',
          columnaExcel: 'PESO INTERNO',
          medidaCm: r1(baseTubo - modelo.dcto_tela_cm),
        });
      }
      if (modelo.peso_u_duo_cm > 0) {
        cortes.push({
          componente: 'Peso U (lágrima)',
          columnaExcel: 'PESO U',
          medidaCm: r1(baseTubo - modelo.peso_u_duo_cm),
        });
      }
    } else if (conTubo || modelo.dcto_tubo_cm > 0) {
      // Regla de taller validada con OTs reales: peso = tubo − 0.4 SIEMPRE.
      cortes.push({
        componente: 'Peso',
        columnaExcel: columnaPesoExcel(modelo),
        medidaCm: r1(baseTubo - PESO_VS_TUBO_CM),
      });
    }
  }

  // Cenefa ovalada: la TAPA cubre el ancho con su propio despeje = ancho − dcto_cenefa
  // (es la pieza más ancha; el tubo va detrás, ya deducido tubo + cenefa en baseTubo).
  if (modelo.dcto_cenefa_cm > 0) {
    cortes.push({
      componente: 'Cenefa ovalada',
      columnaExcel: 'CENEFA OVALADA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_cm),
    });
  }

  // Cenefas delantera/trasera (sistemas de oscuridad / cenefa cuadrada)
  if (modelo.dcto_cenefa_del_cm > 0) {
    cortes.push({
      componente: 'Cenefa delantera',
      columnaExcel: 'CENEFA DELANTERA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_del_cm),
    });
  }
  if (modelo.dcto_cenefa_tra_cm > 0) {
    cortes.push({
      componente: 'Cenefa trasera',
      columnaExcel: 'CENEFA TRASERA',
      medidaCm: r1(anchoCm - modelo.dcto_cenefa_tra_cm),
    });
  }

  const aproximado = SISTEMAS_OSCURIDAD.includes(modelo.sistema);
  if (aproximado) {
    notas.push(
      'Sistema de oscuridad: los PERFILES dependen de la instalación (muro/piso, izq/der) y no se calculan aún — revisar manualmente.',
    );
  }
  if (modelo.notas) notas.push(modelo.notas);

  return { cortes, aproximado, notas };
}

/** Modelo vacío para calcularDespiece cuando la categoría no usa catálogo (BEEBLACK). */
export const MODELO_DESPIECE_STUB: import('./tipos').ModeloDespiece = {
  sistema: 'STUB',
  tipo_rol: 'STUB',
  mecanismo: '',
  codigos_tubo: '',
  diametro_tubo_mm: 0,
  dcto_tubo_cm: 0,
  dcto_tela_cm: 0,
  suma_peso_cm: 0,
  dcto_cenefa_cm: 0,
  dcto_cenefa_del_cm: 0,
  dcto_cenefa_tra_cm: 0,
  dcto_perfiles_cm: 0,
  peso_interno_duo_cm: 0,
  peso_u_duo_cm: 0,
  ancho_max_m: 99,
  activo: true,
  notas: '',
};

/** Construye el contexto de despiece desde ventana + paño (Fase 2 / Excel). */
export function contextoDespieceDesdePano(
  v: { categoria?: string; sentido?: string | null },
  p: {
    alto?: number | string;
    cenefa?: string | null;
    oscuridadVariante?: string | null;
    perfilIzqMuro?: boolean;
    perfilIzqPiso?: boolean;
    perfilDerMuro?: boolean;
    perfilDerPiso?: boolean;
    perfilInfMuro?: boolean;
    perfilInfPiso?: boolean;
    perfilIzqMuroCm?: number;
    perfilIzqPisoCm?: number;
    perfilDerMuroCm?: number;
    perfilDerPisoCm?: number;
    perfilInfMuroCm?: number;
    perfilInfPisoCm?: number;
    beeblackVariante?: string | null;
    beeblackManillaIzq?: boolean;
    beeblackManillaDer?: boolean;
    beeblackExtraSupInfIzq?: boolean;
    beeblackExtraSupInfDer?: boolean;
    beeblackExtraLatSup?: boolean;
    beeblackExtraLatInf?: boolean;
    beeblackPerfilSupAnchoCm?: number;
    beeblackPerfilInfAnchoCm?: number;
    beeblackPerfilLatIzqCm?: number;
    beeblackPerfilLatDerCm?: number;
    beeblackManillaIzqCm?: number;
    beeblackManillaDerCm?: number;
    beeblackAnchoTelaCm?: number;
    beeblackAltoTelaCm?: number;
    beeblackTotalLamasCm?: number;
  },
): ContextoDespiece {
  const altoCm = (parseFloat(String(p.alto ?? 0)) || 0) * 100;
  return {
    categoria: v.categoria,
    sentido: v.sentido,
    altoCm,
    cenefa: p.cenefa,
    oscuridadVariante: p.oscuridadVariante,
    perfiles: {
      izqMuro: p.perfilIzqMuro,
      izqPiso: p.perfilIzqPiso,
      derMuro: p.perfilDerMuro,
      derPiso: p.perfilDerPiso,
      infMuro: p.perfilInfMuro,
      infPiso: p.perfilInfPiso,
    },
    perfilesMedidas: {
      izqMuro: p.perfilIzqMuroCm,
      izqPiso: p.perfilIzqPisoCm,
      derMuro: p.perfilDerMuroCm,
      derPiso: p.perfilDerPisoCm,
      infMuro: p.perfilInfMuroCm,
      infPiso: p.perfilInfPisoCm,
    },
    beeblackVariante: p.beeblackVariante,
    beeblackToggles: {
      manillaIzq: p.beeblackManillaIzq,
      manillaDer: p.beeblackManillaDer,
      extraAnchoIzq: p.beeblackExtraSupInfIzq,
      extraAnchoDer: p.beeblackExtraSupInfDer,
      extraAltoSup: p.beeblackExtraLatSup,
      extraAltoInf: p.beeblackExtraLatInf,
    },
    beeblackMedidas: {
      perfilSupAncho: p.beeblackPerfilSupAnchoCm,
      perfilInfAncho: p.beeblackPerfilInfAnchoCm,
      perfilLatIzq: p.beeblackPerfilLatIzqCm,
      perfilLatDer: p.beeblackPerfilLatDerCm,
      manillaIzq: p.beeblackManillaIzqCm,
      manillaDer: p.beeblackManillaDerCm,
      anchoTela: p.beeblackAnchoTelaCm,
      altoTela: p.beeblackAltoTelaCm,
      totalLamas: p.beeblackTotalLamasCm,
    },
  };
}
