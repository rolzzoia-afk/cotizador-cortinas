// ─────────────────────────────────────────────────────────────────────
// PDF "INVENTARIO — ENTREGA Y RECEPCIÓN DE MATERIAL"
//
// Hoja de bodega que se entrega con la OT. Cuatro bloques:
//   1. Detalle por cortina (identidad: producto/tipo/mecanismo/tubería/
//      accionamiento/peso cadena/ubic/medidas, con descripciones completas)
//      — reusa la identidad del Cálculo general (mismo motor de datos).
//   2. INSUMOS consolidados en tablas por destino: «INSUMOS» (tapas de peso,
//      tornillos, tarugos, suplementos), «INSUMOS DE PRODUCCIÓN» (taller:
//      mecanismo de cenefa ovalada + motor de ovaladas; en vertical, peso de
//      lama + sujetador), «INSUMOS ESTRUCTURA» (vertical: ferretería del sistema
//      de lamas — peso cordón, carritos, cordón, kit, peso cadena) e «INSUMOS
//      DE INSTALACIÓN» (terreno: manillas, brackets, cadena, peso de cadena,
//      resto del kit de motor, tapa de cenefa cuadrada, etc.). Cada tabla se
//      imprime solo si tiene filas.
//   3. ETIQUETAS ROLZZO: una fila por código según color de accesorios
//      (blancos/grises → INS 95-1 blanca; resto → INS 95 negra), 1 por paño
//      —salvo el beeblack doble, que es UNA cortina y lleva 1 etiqueta, y la
//      categoría B, que se entrega sin etiqueta Rolzzo—.
//   4. NOTAS DE TERRENO: lo que el vendedor anotó en Fase 2 (retiro,
//      material de instalación, cortes, suplementos, comentarios) por
//      ubicación — solo se imprime si alguna cortina tiene notas.
//
// Lógica pura salvo `generarPdfInventario`, que dibuja con jsPDF.
// ─────────────────────────────────────────────────────────────────────
//
// Este archivo es el MODELO puro. El PDF que lo dibuja vive en
// `pdfInventario.ts`; acá no entra jsPDF, para que la pantalla de bodega
// (/produccion → Inventario) pueda pedir los mismos insumos sin cargarse
// 400 KB de librería de PDF en una tablet del galpón.
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { AdicionalFase0Persistido, VentanaItem } from '@/modules/ots/types';
import { ubicPanoVentana } from '@/modules/descuentos/adicionales-cenefa';
import { construirCalculoGeneral, type FilaCalculo } from './calculoGeneral';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import { construirEtiquetas, type EtiquetaLinea } from './inventario';
import {
  codPesoAuto,
  LARGO_CADENA_VERTICAL,
  codCadenaAutoPorAlto,
  codCadenaVertical,
  colorCadenaVertical,
  derivarLargoColor,
  descripcionCadenaInventario,
  textoPesoCadenaInventario,
  type CadenaInsumo,
} from './cadenas';
import { esCenefaCuadrada } from './fase2';
import { rotuloForma } from './wizard/selectorVentanas';
import {
  categoriaRequiereMecanismo,
  chipMecanismoPorNumero,
  codigoTuberiaDeChip,
  colorAccesoriosDePano,
  esChipDual,
  mecanismoParaPano,
  numeroMecDeChip,
  tuberiaParaPano,
} from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import {
  categoriaLlevaCadenaRoller,
  codigoInsumoMec,
  esCategoriaVertical,
  kitTraeCadenaIncorporada,
  normalizarColorAccesorio,
  opcionesMecanismoResolucion,
} from '@/modules/descuentos/reglas-mecanismo';
import { esLineaB } from './lineaB';
import { opcionesTuberiaResolucion } from '@/modules/descuentos/reglas-tuberia';
import type { ColorAccesorio } from '@/modules/descuentos/coloresAccesorio';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import { esFamiliaDark, familiaOscuridad } from '@/modules/descuentos/reglas-oscuridad';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { calculoVertical, cordonBeeblackDePano } from '@/modules/descuentos/despiece';
import {
  MANILLAS,
  codigoManillaPorColor,
  esCategoriaDuo,
  esCenefaOvalada,
  esCodigoMotor,
  cenefaCuadradaTapasFijas,
  beeblackEsDoble,
  faltantesAdicionalesInventario,
  faltantesDomoticaInventario,
  faltantesManillasInventario,
  insumosBeeblackDeCortina,
  insumosDePano,
  insumosMotorDePano,
  insumosVerticalDePano,
  registrarKitEmitido,
  tapaCenefaCuadrada,
} from './insumosCortina';

export type RGB = [number, number, number];

export type FilaInventario = {
  id: number;
  producto: string;
  tipo: string;
  codMecanismo: string;
  tuberia: string;
  adicional: string;
  accionamiento: string;
  pesoCadena: string;
  ubic: string;
  anchoMts: string;
  altoMts: string;
};

export type NotaTerreno = { ubic: string; notas: string };

/** Tabla de destino del insumo: bodega (INSUMOS), taller — montaje sobre la tela
 *  (PRODUCCION) o ferretería del sistema (ESTRUCTURA) — o terreno (INSTALACION). */
export type GrupoInsumo = 'INSUMOS' | 'PRODUCCION' | 'ESTRUCTURA' | 'INSTALACION';

/** Insumo consolidado para la tabla de entrega de material (manillas, tapas de
 *  peso, tornillos, brackets, tarugos, motor…). `codigo` opcional (manillas y
 *  tapas de cenefa no tienen insumo con código). */
export type InsumoConsolidado = {
  id: number;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  grupo: GrupoInsumo;
  /** Texto que acompaña a la cantidad ("TAPAS", "PIVOTES"); vacío = cantidad sola. */
  unidad?: string;
};

export type Inventario = {
  filas: FilaInventario[];
  /** Insumos consolidados de la OT (manillas + tapas/tornillos/brackets/tarugos/motor). */
  insumos: InsumoConsolidado[];
  /** Etiquetas por código según color de accesorios (blancos → INS 95-1).
   *  1 por paño; el beeblack doble cuenta como 1 sola cortina. */
  etiquetas: EtiquetaLinea[];
  /** Notas de terreno de Fase 2, una fila por paño con algo anotado. */
  notas: NotaTerreno[];
};

const mts3 = (n: number) => n.toFixed(3).replace('.', ',');

/**
 * Manillas consolidadas por color desde las filas del Cálculo General.
 * `f.manillas` viene como "9 CAFÉ" → { codigo: "HER49",
 * descripcion: "[HER49] MANILLA PLANA CAFE", cantidad: 9 }. Si el color no
 * calza con una manilla conocida, queda sin código (descripción genérica).
 */
export function consolidarManillas(
  filas: FilaCalculo[],
  colores?: readonly ColorAccesorio[],
): { codigo?: string; descripcion: string; cantidad: number }[] {
  const acc = new Map<string, { codigo?: string; cantidad: number }>();
  for (const f of filas) {
    const m = (f.manillas || '').trim();
    if (!m) continue;
    const [, cant, color] = m.match(/^(\d+)\s*(.*)$/) || [];
    const n = parseInt(cant || '', 10);
    if (!n) continue;
    const col = (color || '').trim();
    const cod = codigoManillaPorColor(col, colores);
    const descripcion = cod && MANILLAS[cod] ? `[${cod}] ${MANILLAS[cod].nombre}` : cod ? `[${cod}] MANILLA ${col}`.trim() : `MANILLA ${col}`.trim();
    const prev = acc.get(descripcion) || { codigo: cod || undefined, cantidad: 0 };
    acc.set(descripcion, { codigo: cod || undefined, cantidad: prev.cantidad + n });
  }
  return [...acc.entries()].map(([descripcion, v]) => ({
    codigo: v.codigo,
    descripcion,
    cantidad: v.cantidad,
  }));
}

/**
 * Tabla de destino de un insumo por su código:
 *  • INSUMOS (bodega): tapas de peso (TAP), tornillos (TOR), tarugos (TAR),
 *    suplementos (SUB) y topes de cadena (TOP). Excepción: la tapa de cenefa
 *    cuadrada (TAP32/33/34) se coloca en terreno y su emisión la fuerza a
 *    INSTALACIÓN (ver override abajo).
 *  • PRODUCCIÓN (taller): mecanismo de cenefa ovalada (MEC + "OVALADA"). El
 *    motor de una cortina ovalada también, pero eso se decide en
 *    `consolidarInsumos` con el contexto del paño (ver override).
 *  • INSTALACIÓN (terreno): todo lo demás — manillas, brackets, cadena (CAD),
 *    peso de cadena (PCA), resto del kit de motor (DOM), mecanismos simples,
 *    tapa de cenefa cuadrada, etc.
 */
function grupoInsumo(codigo: string | undefined, descripcion: string): GrupoInsumo {
  const c = (codigo || '').toUpperCase();
  const d = descripcion.toUpperCase();
  if (
    c.startsWith('TAP') ||
    c.startsWith('TOR') ||
    c.startsWith('TAR') ||
    c.startsWith('SUB') ||
    c.startsWith('TOP')
  ) {
    return 'INSUMOS';
  }
  if (c.startsWith('MEC') && d.includes('OVALADA')) return 'PRODUCCION';
  return 'INSTALACION';
}

/**
 * Descripción completa del kit de un número MEC para las líneas de tapas/pivotes
 * de la armadura E78 ovalada: "[MEC39] OVALADA BLANCO [MEC 39]" en vez de solo
 * "MEC 39" (así el bodeguero ve de qué kit salen). Cae a "MEC N" si no hay chip.
 */
function descKitMec(num: number, opcMec: readonly string[]): string {
  const cod = `MEC${String(num).padStart(2, '0')}`;
  const chip = chipMecanismoPorNumero(num, opcMec);
  return chip ? `[${cod}] ${chip}` : `MEC ${num}`;
}

/**
 * Todos los insumos de la OT consolidados para la hoja de inventario, ya
 * clasificados en INSUMOS / PRODUCCIÓN / INSTALACIÓN: manillas (por color), tapas
 * de peso, tornillos, brackets, tarugos, suplementos, mecanismos, cadenas, peso
 * de cadena y el kit de motor (códigos DOM). La domótica agrega 1× DOM43 por OT.
 * Además del grupo por código (`grupoInsumo`), hay overrides contextuales por
 * cortina: en una cenefa ovalada, su MECANISMO, su CADENA y su MOTOR van a
 * PRODUCCIÓN (aunque su código caería en otra tabla).
 */
export function consolidarInsumos(
  ventanas: Ventana[],
  filas: FilaCalculo[],
  cadenas: CadenaInsumo[] = [],
  usarTuboE78 = false,
  /** Adicionales de Fase 0: para que TODO motor cobrado (aunque no calce con un
   *  paño por ubicación) salga en el inventario con su cantidad real. */
  adicionalesFase0?: AdicionalFase0Persistido[],
  /** Fórmulas de corte editadas en Admin (el cordón beeblack sale de ellas). */
  formulas?: FormulasFamilias,
  /** Reglas de tubería/mecanismo editadas en Admin (sin esto, las de fábrica). */
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
  /** Catálogo de telas: resuelve la línea (A o B) de cada paño. */
  catalogo?: CatalogoProductos,
): InsumoConsolidado[] {
  // Consolidar es CÁLCULO: listas de resolución (incluye chips y tubos retirados).
  const opcMec = opcionesMecanismoResolucion(reglas.mecanismo);
  const opcTub = opcionesTuberiaResolucion(reglas.tuberia);
  const acc = new Map<string, { codigo?: string; descripcion: string; cantidad: number; grupo: GrupoInsumo; unidad?: string }>();
  // `grupoOverride` fuerza la tabla (el motor de una cortina ovalada va a
  // PRODUCCIÓN aunque su código DOM caiga por defecto en INSTALACIÓN). La clave
  // del acumulador incluye el grupo para que un mismo código pueda quedar en dos
  // tablas (ej. DOM38 en un paño ovalado y en uno normal) sin consolidarse.
  const bump = (
    codigo: string | undefined,
    descripcion: string,
    cantidad: number,
    grupoOverride?: GrupoInsumo,
    unidad?: string,
  ) => {
    const grupo = grupoOverride ?? grupoInsumo(codigo, descripcion);
    const key = `${grupo}|${codigo || descripcion}`;
    const prev = acc.get(key);
    if (prev) prev.cantidad += cantidad;
    else acc.set(key, { codigo, descripcion, cantidad, grupo, unidad });
  };
  // Kit de motor ya emitido por paño (la unidad, por código ORIGINAL del paño) y
  // el grupo con que se colocó cada código: para el top-up de lo cobrado en Fase 1
  // que no salió por ningún paño (ver abajo).
  const kitEmitidoPorCodigo: Record<string, number> = {};
  const grupoMotorPorCodigo: Record<string, GrupoInsumo | undefined> = {};
  for (const v of ventanas) {
    const modelo = (v.modelo as ModeloDespiece | null | undefined) ?? null;
    // Dual: el kit de mecanismo es 1 por ventana (un solo bracket dual).
    let dualKitEmitido = false;
    for (const [pi, p] of (v.panos || []).entries()) {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      // Categoría vendida COMO motor (ROL/DUO ..._MOTOR_...): su precio incluye el
      // motor, no un kit manual → sin mecanismo/cadena. En cambio, un motor
      // asignado a una cortina de categoría MANUAL (roller normal) NO le quita el
      // kit+cadena+peso: van dentro del precio y se entregan igual al cliente.
      const catEsMotor = (v.categoria || '').toUpperCase().includes('MOTOR');
      // Cenefa ovalada: por la cenefa guardada o por el SISTEMA del modelo (cubre
      // el dúo, cuya categoría "DUO_MANUAL_*" no dice "ovalada"). Con tubo E78 la
      // armadura es MIXTA (tapas del kit ovalada + pivotes del kit 45) y NO se
      // arma el mecanismo ovalada completo: por eso ese kit no se lista, solo las
      // tapas y los pivotes (más abajo).
      const ovalada = esCenefaOvalada(p.cenefa, v.categoria, reglas.tipos);
      // Los sistemas de oscuridad (soft light 38/45/CC) usan el kit ovalada y su
      // cenefa suele ser IMPLÍCITA (p.cenefa vacío, categoría SOFT_LIGHT_*): sobre
      // tubo E78 llevan la misma armadura mixta. Oscuranti es 63 mm (E47) → nunca E78.
      // El DARK queda FUERA (regla del usuario 2026-07-31): sobre tubería 0,45 usa el
      // kit COMPLETO MEC 18/23, sin nada de la armadura de cenefa ovalada.
      const famOsc = familiaOscuridad(v.categoria, p.cenefa as string | undefined, reglas.tipos);
      const esOscuridadOvalada = famOsc != null && !esFamiliaDark(famOsc);
      const ovaladaSistema =
        ovalada || esOscuridadOvalada || (modelo?.sistema || '').toUpperCase().includes('CENEFA_OVALADA');
      const lineaB = esLineaB(p, v.codInt, catalogo, v.categoria, reglas.mecanismo, reglas.tipos);
      // Armadura mixta del tubo de 45 mm. Se aceptan los DOS códigos: E39 es el
      // nombre desde 2026-08-14 y E78 el que quedó guardado en las OTs viejas.
      const codTuboPano = codigoTuberiaDeChip(
        tuberiaParaPano(anchoM, modelo, p.tuberia as string, opcTub, v.categoria, reglas.tuberia, lineaB),
      );
      const esE78Mixta = ovaladaSistema && (codTuboPano === 'E39' || codTuboPano === 'E78');

      // Mecanismo + cadena + peso: toda categoría con mecanismo que NO se venda
      // como motor (aunque el paño lleve un motor, va dentro del precio).
      if (!catEsMotor && categoriaRequiereMecanismo(v.categoria, reglas.mecanismo)) {
        const chip = mecanismoParaPano(p, v.color, modelo, opcMec, v.categoria, anchoM, usarTuboE78, reglas, lineaB);
        const num = numeroMecDeChip(chip);
        // Una cortina con mecanismo de cenefa ovalada se arma en el taller: su
        // mecanismo Y su cadena van a PRODUCCIÓN. El resto de cadenas, a
        // INSTALACIÓN (grupo por defecto).
        const grupoOvalada: GrupoInsumo | undefined =
          chip && chip.toUpperCase().includes('OVALADA') ? 'PRODUCCION' : undefined;
        // E78 + ovalada NO usa el mecanismo completo (se desglosa en tapas +
        // pivotes), así que su kit NO se lista; el resto sí lleva su mecanismo.
        // Dual: 1 kit por ventana (no ×2 paños) → se emite solo una vez.
        if (chip && num != null && !esE78Mixta) {
          const esDualChip = esChipDual(chip);
          if (!esDualChip || !dualKitEmitido) {
            // Los kits de la línea B llevan sufijo en bodega (MEC44-B/MEC45-B).
            const cod = codigoInsumoMec(num, reglas.mecanismo);
            bump(cod, `[${cod}] ${chip}`, 1);
            if (esDualChip) dualKitEmitido = true;
          }
        }
        // Cadena y peso SOLO en los sistemas que llevan cadena de roller. La
        // PLETINA (velcro) tiene mecanismo —VELCRO— pero es un paño PEGADO: no
        // sube ni baja, así que no lleva ni cadena ni peso de cadena. Sin este
        // gate el peso se emitía igual (se resuelve en vivo, no depende de que el
        // paño lo tenga guardado) y la hoja pedía un insumo que no se usa.
        if (categoriaLlevaCadenaRoller(v.categoria, reglas.tipos)) {
          // Cadena: usa la elegida en Fase 2 (codCadena); si el paño no la guardó
          // (OT no sincronizada en Fase 2), la resuelve por alto + color con el
          // catálogo de cadenas — igual que Fase 2 — para que no falte en la hoja.
          // El MEC 06 trae la cadena incorporada: ni la guardada ni el fallback.
          if (kitTraeCadenaIncorporada(p.mecanismo)) {
            // sin línea de cadena
          } else if (p.codCadena) {
            bump(p.codCadena.toUpperCase(), descripcionCadenaInventario(p), 1, grupoOvalada);
          } else {
            const altoM = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
            const codCad = codCadenaAutoPorAlto(
              altoM,
              colorAccesoriosDePano(p, v.color),
              v.categoria,
              cadenas,
              reglas.tipos,
              reglas.cadenas,
            );
            if (codCad) {
              const { largoCadena, colorCadena } = derivarLargoColor(codCad, cadenas, reglas.cadenas);
              bump(codCad.toUpperCase(), descripcionCadenaInventario({ codCadena: codCad, largoCadena, colorCadena }), 1, grupoOvalada);
            }
          }
          // El peso de cadena se emite SIEMPRE, aunque el paño no lo tenga
          // guardado — igual que el mecanismo, que se resuelve en vivo (PCA04
          // transparente; en gama B, PCA01 blanco). Si en Fase 2 se eligió otro
          // peso, se respeta.
          const cp = (p.codPeso || codPesoAuto(lineaB)).replace(/\s+/g, '').toUpperCase();
          bump(cp, `[${cp}] ${textoPesoCadenaInventario({ codPeso: cp })}`.trim(), 1);
        }
      }

      // Dual: el 2º+ paño omite las fijaciones (1 juego por cortina); tapas ×paño.
      // `tipos` y `colores` van SIEMPRE: sin ellos esta hoja ignoraba el catálogo
      // técnico y un color dado de alta en Admin salía con el código de fábrica
      // (o sin código), mientras el cuadro COMPONENTES —que sí los pasa— mostraba
      // el suyo. Las dos salidas tienen que decir lo mismo.
      for (const ins of insumosDePano(p, {
        categoria: v.categoria,
        ventanaColor: v.color,
        anchoM,
        omitirFijaciones: !!p.dual && pi > 0,
        tipos: reglas.tipos,
        colores: reglas.colores,
        lineaB,
      })) {
        bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad);
      }
      // VERTICAL (lamas): insumos VER propios (carritos, cordón, sujetador, kit,
      // peso de cadena, bracket, cadena inferior). Los tarugos ya salieron por
      // `insumosDePano` (código TAR → INSUMOS). Los "CALCULAR" (cordón, cadena
      // inferior) se emiten con cantidad 0 + unidad "CALCULAR": no llevan número.
      if (esCategoriaVertical(v.categoria) && modelo) {
        const carritos = calculoVertical(modelo, anchoM * 100, 0).carritos;
        const colorAccVert = colorAccesoriosDePano(p, v.color);
        // Cadena de la vertical: SIEMPRE la de 3 m (CAD04 negro / CAD06 resto),
        // calculada por color de accesorios — el alto no la cambia. Espejo de
        // `calcularBOM`, para que la hoja y el cuadro COMPONENTES coincidan.
        const cadVert = codCadenaVertical(colorAccVert, reglas.cadenas);
        bump(
          cadVert,
          descripcionCadenaInventario({
            codCadena: cadVert,
            largoCadena: LARGO_CADENA_VERTICAL,
            colorCadena: colorCadenaVertical(colorAccVert, reglas.cadenas),
          }),
          1,
        );
        for (const it of insumosVerticalDePano({
          colorAcc: colorAccVert,
          anchoM,
          carritos,
        })) {
          bump(
            it.codigo,
            `[${it.codigo}] ${it.descripcion}`,
            it.calcular ? 0 : it.cantidad,
            it.grupo,
            it.calcular ? 'CALCULAR' : undefined,
          );
        }
      }
      // BEEBLACK: kit SML propio, 1 por CORTINA (no por paño) — en el doble se
      // emite una vez con las cantidades ya duplicadas. Todo a PRODUCCIÓN salvo
      // la tapa de esquinero. La barra de la manilla NO es insumo: se cobra en
      // Fase 1 y se corta por la hoja de estructura.
      if (esCategoriaBeeblack(v.categoria) && pi === 0) {
        for (const it of insumosBeeblackDeCortina(
          colorAccesoriosDePano(p, v.color),
          beeblackEsDoble(p, (v.panos || []).length),
          cordonBeeblackDePano(v, p, formulas),
        )) {
          bump(
            it.codigo,
            `[${it.codigo}] ${it.descripcion}`,
            it.calcular ? 0 : it.cantidad,
            it.grupo,
            it.calcular ? 'CALCULAR' : undefined,
          );
        }
      }
      // TUBO E78 + cenefa ovalada: armadura mixta que reemplaza al mecanismo
      // completo (por eso arriba no se lista el kit) — tapas del kit ovalada de
      // bodega (39 blanco / 38 negro / 12 gris, según color de accesorios) +
      // pivotes del kit 45 mm por color (18 blanco / 23 negro; GRIS queda manual
      // porque no hay kit 45 gris). Van al taller = PRODUCCIÓN. El dúo lleva 2
      // tubos → 4+4; resto 2+2. Se resuelve por COLOR (no por el chip de
      // mecanismo) para que también aplique a las ovaladas motorizadas.
      if (esE78Mixta) {
        const nMix = esCategoriaDuo(v.categoria, reglas.tipos) ? 4 : 2;
        const colorAcc = normalizarColorAccesorio(colorAccesoriosDePano(p, v.color));
        const mecTapas = reglas.mecanismo.kitOvaladaPorColor[colorAcc];
        if (mecTapas != null) bump(undefined, descKitMec(mecTapas, opcMec), nMix, 'PRODUCCION', 'TAPAS');
        // Pivotes: solo blanco→18 / negro→23. Gris (y colores sin kit 45) queda
        // manual — decisión del usuario 2026-07-15: sin línea automática.
        const mecPivotes =
          colorAcc === 'NEG' || colorAcc === 'NEGRO'
            ? 23
            : colorAcc === 'BCO' || colorAcc === 'BLANCO'
              ? 18
              : null;
        if (mecPivotes != null) bump(undefined, descKitMec(mecPivotes, opcMec), nMix, 'PRODUCCION', 'PIVOTES');
      }
      // El MOTOR de una cortina con cenefa ovalada va a PRODUCCIÓN; el resto del
      // kit (control, cable, enchufe) y los motores de cortinas normales, a
      // INSTALACIÓN (grupo por defecto).
      const motorInsumos = insumosMotorDePano(p, v.categoria, reglas.tipos);
      if (motorInsumos.length > 0) {
        for (const ins of motorInsumos) {
          const esUnidad = esCodigoMotor(ins.codigo);
          const grupo = ovalada && esUnidad ? 'PRODUCCION' : undefined;
          bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad, grupo);
          // La unidad se cuenta por el código ORIGINAL del paño (el kit pudo
          // remapear DOM41→DOM38 en ovalada); el resto del kit, por el suyo.
          registrarKitEmitido(kitEmitidoPorCodigo, ins, p.motorModelo);
          if (esUnidad) grupoMotorPorCodigo[ins.codigo.toUpperCase()] = grupo;
        }
      } else if (p.motorModelo || p.motorTipo) {
        // Motor legacy o 'CABLE' futuro (sin código DOM): línea genérica, para que
        // el motor no se pierda de la hoja de entrega (el BOM también lo lista así).
        const etiqueta = (p.motorTipo || (p.motorModelo === 'CABLE' ? 'CON CABLE' : '')).trim();
        bump(undefined, etiqueta ? `MOTOR ${etiqueta}` : 'MOTOR', 1, ovalada ? 'PRODUCCION' : undefined);
      }
      // Tapa de cenefa cuadrada. Lleva código por color (TAP32 negro / TAP33
      // blanco / TAP34 café) para que bodega enlace stock, pero se FUERZA a
      // INSTALACIÓN (se coloca en terreno): su código TAP caería en INSUMOS por
      // defecto. Gris u otro color sale sin código.
      //   · Oscuridad con cenefa cuadrada (DARK y OSCURANTI implícitas · SOFT
      //     LIGHT CC): SIEMPRE 2, color de accesorios del paño.
      //   · Adicional roller/vertical (cenefa cuadrada elegible): 1 o 2 según
      //     cenefaTapa, color de tapa elegido.
      const tapasFijas = cenefaCuadradaTapasFijas(v.categoria, p.cenefa, reglas.tipos);
      if (esCenefaCuadrada(p.cenefa) || tapasFijas) {
        const n = tapasFijas
          ? 2
          : p.cenefaTapa === 'CON_2_TAPAS' ? 2 : p.cenefaTapa === 'CON_1_TAPA' ? 1 : 0;
        if (n > 0) {
          const colorTapa = tapasFijas ? colorAccesoriosDePano(p, v.color) : p.colorTapa;
          const tapa = tapaCenefaCuadrada(colorTapa, reglas.colores);
          const desc = tapa.codigo ? `[${tapa.codigo}] ${tapa.descripcion}` : tapa.descripcion;
          bump(tapa.codigo, desc, n, 'INSTALACION');
        }
      }
    }
  }
  // Top-up de lo COBRADO en Fase 1 (motores + su cable, controles, hubs con su
  // router y adaptador) que no salió por los paños. La unidad de motor consolida
  // en el mismo grupo que ya usa ese código; el resto cae en INSTALACIÓN.
  for (const falta of faltantesDomoticaInventario(adicionalesFase0, kitEmitidoPorCodigo)) {
    bump(
      falta.codigo,
      `[${falta.codigo}] ${falta.descripcion}`,
      falta.cantidad,
      grupoMotorPorCodigo[falta.codigo.toUpperCase()],
    );
  }

  const out: InsumoConsolidado[] = [];
  let id = 0;
  // Manillas primero (instalación), luego el resto de insumos ya clasificados.
  const manillas = consolidarManillas(filas, reglas.colores);
  // Top-up de las manillas COBRADAS en Fase 1 que no bajaron a ningún paño
  // (el cruce por ubicación falla en ventanas de varios paños — ver
  // faltantesManillasInventario). Sin esto se perdían del inventario.
  const manillasEmitidas: Record<string, number> = {};
  for (const m of manillas) if (m.codigo) manillasEmitidas[m.codigo] = (manillasEmitidas[m.codigo] || 0) + m.cantidad;
  for (const falta of faltantesManillasInventario(adicionalesFase0, manillasEmitidas)) {
    const desc = `[${falta.codigo}] ${falta.descripcion}`;
    const ya = manillas.find((m) => m.descripcion === desc);
    if (ya) ya.cantidad += falta.cantidad;
    else manillas.push({ codigo: falta.codigo, descripcion: desc, cantidad: falta.cantidad });
  }
  for (const m of manillas) {
    out.push({ id: ++id, codigo: m.codigo, descripcion: m.descripcion, cantidad: m.cantidad, grupo: 'INSTALACION' });
  }
  // Último top-up: cualquier OTRO adicional comprado en Fase 1 que sea material
  // y no haya salido por los paños ni por los dos top-ups de arriba (un PANEL
  // SOLAR, un motor de otro modelo…). Antes solo llegaban los códigos de esas
  // dos listas cerradas y el resto se perdía sin aviso. Va después de todo para
  // poder descontar lo ya emitido.
  // OJO: se cuenta sobre `manillas` YA con su top-up aplicado, no sobre
  // `manillasEmitidas` (que es solo lo que bajó de los paños): con el mapa viejo
  // una manilla comprada en Fase 1 salía dos veces.
  const emitidoPorCodigo: Record<string, number> = {};
  const sumarEmitido = (codigo: string | undefined, cantidad: number) => {
    const k = (codigo || '').replace(/\s+/g, '').toUpperCase();
    if (k) emitidoPorCodigo[k] = (emitidoPorCodigo[k] || 0) + cantidad;
  };
  for (const m of manillas) sumarEmitido(m.codigo, m.cantidad);
  for (const it of acc.values()) sumarEmitido(it.codigo, it.cantidad);
  for (const falta of faltantesAdicionalesInventario(
    adicionalesFase0,
    emitidoPorCodigo,
    (cod) => catalogo?.[cod]?.producto,
    (cod) => (catalogo?.[cod]?.cod || '').trim().toUpperCase() === 'INSTALACION',
  )) {
    bump(falta.codigo, `[${falta.codigo}] ${falta.descripcion}`, falta.cantidad);
  }
  for (const it of acc.values()) {
    out.push({ id: ++id, codigo: it.codigo, descripcion: it.descripcion, cantidad: it.cantidad, grupo: it.grupo, unidad: it.unidad });
  }
  return out;
}

/**
 * Notas de terreno anotadas en Fase 2, por paño. Concatena con rótulos solo
 * los campos con contenido real ('Nada' y 'N/A' cuentan como vacío). Si nadie
 * anotó nada, devuelve [] y el bloque no se imprime.
 */
export function notasTerreno(ventanas: Ventana[]): NotaTerreno[] {
  const out: NotaTerreno[] = [];
  for (const v of ventanas) {
    const panos = v.panos || [];
    const rotuloVentana = rotuloForma(v) ? `(${rotuloForma(v)})` : '';
    panos.forEach((p, i) => {
      const partes: string[] = [];
      const retiro = Number(p.retiro) || 0;
      if (retiro > 0) partes.push(`Retiro: ${retiro}`);
      const material = [p.superficie, p.materialTipo].filter(Boolean).join(' / ');
      if (material) partes.push(`Material: ${material}`);
      if (p.cortes && p.cortes !== 'Nada') partes.push(`Cortes: ${p.cortes}`);
      if (p.verVideo) partes.push('Ver video de terreno');
      if (p.relacionMarco && p.relacionMarco !== 'N/A') partes.push(`Marco: ${p.relacionMarco}`);
      if (p.cotizarConSin) partes.push(`Cotizar con y sin: ${p.cotizarConSin}`);
      if (p.suplementos) partes.push(`Suplementos: ${p.suplementos}`);
      // Campo legado (hoy el dúo usa cierreAlturaCm): se imprime si venía escrito.
      if (p.alturaCierre) partes.push(`Cerrada a altura de: ${p.alturaCierre}`);
      if (p.comentarioFinal) partes.push(`Nota: ${p.comentarioFinal}`);
      if (partes.length === 0) return;
      out.push({
        // Mismo rótulo de ventana en ángulo que la hoja de corte: si una tabla
        // dice «(BOW WINDOW)» y la otra no, parecen dos cortinas distintas.
        ubic: [ubicPanoVentana(v.ubicacion || '', i, panos.length), rotuloVentana]
          .filter(Boolean)
          .join(' '),
        notas: partes.join(' · '),
      });
    });
  }
  return out;
}

/** Construye los datos de la hoja INVENTARIO para las ventanas de una OT. */
export function construirInventario(
  ventanas: Ventana[],
  catalogo: CatalogoProductos = {},
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  /** Catálogo de cadenas del inventario para resolver la cadena de paños sin
   *  codCadena guardado (OT no sincronizada en Fase 2). Vacío = sin resolución. */
  cadenas: CadenaInsumo[] = [],
  usarTuboE78 = false,
  /** Adicionales Fase 0: para el top-up de motores cobrados (ver consolidarInsumos). */
  adicionalesFase0?: AdicionalFase0Persistido[],
  /** Fórmulas de corte editadas en Admin (sin esto, las de fábrica). */
  formulas?: FormulasFamilias,
  /** Reglas de tubería/mecanismo editadas en Admin (sin esto, las de fábrica). */
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
): Inventario {
  const { filas } = construirCalculoGeneral(ventanas, catalogo, params, undefined, {
    usarTuboE78,
    formulas,
    reglas,
  });
  const filasInv: FilaInventario[] = filas.map((f, i) => ({
    id: i + 1,
    producto: f.producto,
    tipo: f.tipoRol,
    codMecanismo: f.codMecanismo,
    // f.tuberia ya llega con la descripción larga desde el Cálculo General.
    tuberia: f.tuberia,
    adicional: '0',
    // Descripción larga de la cadena ("[CAD05] CADENA INFINITA 4 METROS GRIS").
    accionamiento: f.codCadena ? descripcionCadenaInventario(f) : f.accionamiento,
    // Peso de cadena SOLO si se eligió un insumo en Fase 2 (codPeso). Sin peso
    // la celda queda vacía (antes mostraba el color de accesorios, ej. "GRIS").
    pesoCadena: f.codPeso
      ? `[${f.codPeso.replace(/\s+/g, '').toUpperCase()}] ${textoPesoCadenaInventario({ codPeso: f.codPeso })}`.trim()
      : '',
    ubic: f.ubic,
    anchoMts: mts3(f.anchoMts),
    altoMts: mts3(f.altoMts),
  }));
  return {
    filas: filasInv,
    insumos: consolidarInsumos(
      ventanas,
      filas,
      cadenas,
      usarTuboE78,
      adicionalesFase0,
      formulas,
      reglas,
      catalogo,
    ),
    etiquetas: construirEtiquetas(ventanas as unknown as VentanaItem[], catalogo, reglas),
    notas: notasTerreno(ventanas),
  };
}
