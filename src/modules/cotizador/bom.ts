// BOM (Bill of Materials / Lista de Materiales).
// Portado desde public/legacy/index.html (líneas 4949-5044, calcularBOM).
// Acumula tubería/mecanismo/cadena/motor/manilla/cenefa por especificación
// desde las filas del optimizador (OptimizerRow con pano).

import type { AdicionalFase0Persistido, BomItem } from '@/modules/ots/types';
import type { VentanaItem } from '@/modules/ots/types';
import { mecanismoParaPano, colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { codigoTuberiaDeChip, tuberiaParaPano } from '@/modules/descuentos/reglas-tuberia';
import { esCategoriaPletina, esCategoriaVertical, kitTraeCadenaIncorporada } from '@/modules/descuentos/reglas-mecanismo';
import { codCadenaVertical, colorCadenaVertical } from './cadenas';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { calculoVertical, cordonBeeblackDePano } from '@/modules/descuentos/despiece';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import type { Pano } from './types';
import type { OptimizerRow } from './tela';
import { opcionesMecanismoResolucion } from '@/modules/descuentos/reglas-mecanismo';
import { opcionesTuberiaResolucion } from '@/modules/descuentos/reglas-tuberia';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import {
  MANILLAS,
  beeblackEsDoble,
  cenefaCuadradaTapasFijas,
  codigoManillaPorColor,
  faltantesDomoticaInventario,
  faltantesManillasInventario,
  insumosBeeblackDeCortina,
  insumosDePano,
  insumosMotorDePano,
  insumosVerticalDePano,
  registrarKitEmitido,
  tapaCenefaCuadrada,
} from './insumosCortina';

const EMPTY_PANO: Partial<Pano> = {};

const CAT_ORDER = ['TUBERÍA', 'MECANISMO', 'CADENA', 'MOTOR', 'MANILLA', 'CENEFA', 'INSUMO', 'OTRO'];

function extraerSpec(s: string | undefined): string {
  if (!s) return '';
  const mec = s.match(/\[MEC (\d+)\]/i);
  if (mec) return `MEC ${mec[1]}`;
  const m = s.match(/\[(.+)\]/);
  return m ? m[1] : s;
}

function ventanaDeFila(row: OptimizerRow, ventanas?: VentanaItem[]): VentanaItem | undefined {
  if (!ventanas?.length) return undefined;
  return ventanas.find((v) => String(v.id) === String(row.ventanaId));
}

export function calcularBOM(
  rows: OptimizerRow[],
  ventanas?: VentanaItem[],
  usarTuboE78 = false,
  /** Adicionales Fase 0: para el top-up de motores cobrados (ver más abajo). */
  adicionalesFase0?: AdicionalFase0Persistido[],
  /** Fórmulas de corte editadas en Admin (sin esto, las de fábrica). */
  formulas?: FormulasFamilias,
  /** Reglas de tubería/mecanismo editadas en Admin (sin esto, las de fábrica). */
  reglas: ReglasSeleccion = REGLAS_SELECCION_DEFAULT,
): BomItem[] {
  // Contexto de CÁLCULO: siempre las listas de RESOLUCIÓN, nunca las de UI —
  // un chip o un tubo retirado tiene que seguir resolviendo las OTs viejas.
  const opcMec = opcionesMecanismoResolucion(reglas.mecanismo);
  const opcTub = opcionesTuberiaResolucion(reglas.tuberia);
  const acc = new Map<string, BomItem>();
  const add = (
    key: string,
    categoria: string,
    descripcion: string,
    especificacion: string,
    color: string,
    cantidad: number,
    unidad: string,
  ) => {
    const existing = acc.get(key);
    if (existing) {
      existing.cantidad += cantidad;
    } else {
      acc.set(key, { categoria, descripcion, especificacion, color, cantidad, unidad });
    }
  };

  // Kit de motor emitido por paño (la unidad, por código ORIGINAL) para el top-up
  // de lo cobrado en Fase 1 que no calzó con un paño (ver después del forEach).
  const kitEmitidoPorCodigo: Record<string, number> = {};
  /** Manillas ya emitidas por los paños, por código HER (para el top-up). */
  const manillasEmitidas: Record<string, number> = {};
  // Dual: el kit de mecanismo es UNO por ventana (un solo bracket dual) → se
  // emite una sola vez aunque la ventana tenga 2 paños.
  const dualMecEmitido = new Set<string>();

  rows.forEach((row) => {
    const p = row.pano || EMPTY_PANO;
    const v = ventanaDeFila(row, ventanas);
    const modelo = (v?.modelo as ModeloDespiece | null | undefined) ?? null;
    const categoria = (v?.categoria as string) || '';
    const ventanaColor = (v?.color as string) || (p.color as string) || '';
    const anchoM = row.ancho || parseFloat(String(p.ancho ?? 0)) || 0;

    // Línea de fabricación (A o B) ya resuelta en buildOptimizerRows: acá no
    // llega el catálogo de telas, así que viaja horneada en la fila.
    const lineaB = row.lineaB ?? false;

    const mecChip = mecanismoParaPano(
      p,
      ventanaColor,
      modelo,
      opcMec,
      categoria,
      anchoM,
      usarTuboE78,
      reglas,
      lineaB,
    );
    const mecSpec = extraerSpec(mecChip || (p.mecanismo as string));
    const mecColor = colorAccesoriosDePano(p, ventanaColor) || p.colorMecanismo || '';

    const tubChip = tuberiaParaPano(
      anchoM,
      modelo,
      p.tuberia as string,
      opcTub,
      categoria,
      reglas.tuberia,
      lineaB,
    );
    // El chip de tubería ahora es una descripción larga sin corchetes; el
    // código (E02…) es la especificación del stock. Fallback a extraerSpec
    // para VELCRO / chips no estándar.
    const tubSpec =
      codigoTuberiaDeChip(tubChip || (p.tuberia as string)) ||
      extraerSpec(tubChip || (p.tuberia as string));
    const anchoCm = row.anchoCm || row.ancho * 100;
    const tubLargoM = ((anchoCm - 3.8) / 100).toFixed(2);
    const tubColor = mecColor || p.color || '';
    const tubEspec = tubSpec ? `${tubSpec} · ${tubLargoM}m` : `${tubLargoM}m`;
    // Sistemas sin tubo ni kit de mecanismo: pletina (velcro), vertical (perfil
    // cabezal + varilla) y beeblack (cierre horizontal con lamas). NO van al
    // inventario ni como tubería ni como mecanismo — el PDF de inventario ya los
    // excluía por `categoriaRequiereMecanismo`, así que sin beeblack aquí los dos
    // documentos se contradecían.
    const esPletinaCat =
      esCategoriaPletina(categoria, reglas.tipos) ||
      esCategoriaVertical(categoria) ||
      esCategoriaBeeblack(categoria);
    if (!esPletinaCat) {
      const tubKey = `TUB|${tubSpec}|${tubLargoM}|${tubColor}`;
      add(tubKey, 'TUBERÍA', 'Tubo', tubEspec, tubColor, 1, 'unid.');
    }
    // Mecanismo: una sola línea, dual o simple (el chip dual ya trae [MEC 0N]).
    // El dual es 1 kit por VENTANA: se emite solo la primera vez (no ×2 paños);
    // la clave sin ventanaId deja que dos ventanas iguales sí consoliden.
    if (esPletinaCat) {
      // velcro: sin kit de mecanismo
    } else if (p.dual) {
      const vkey = String(row.ventanaId);
      if (!dualMecEmitido.has(vkey)) {
        dualMecEmitido.add(vkey);
        const dualKey = `DUAL|${mecSpec}|${mecColor}`;
        add(dualKey, 'MECANISMO', 'Mecanismo Dual', mecSpec || '', mecColor, 1, 'unid.');
      }
    } else if (mecSpec) {
      const mecKey = `MEC|${mecSpec}|${mecColor}`;
      add(mecKey, 'MECANISMO', 'Mecanismo', mecSpec, mecColor, 1, 'unid.');
    }

    const tieneMotor = !!(p.motorModelo || p.motorTipo);
    // Categoría vendida COMO motor (ROL/DUO ..._MOTOR_...): su precio incluye el
    // motor, no un kit manual → sin cadena/peso. Un motor asignado a una cortina
    // de categoría MANUAL SÍ conserva cadena+peso (van dentro del precio) — por eso
    // el gate es por categoría, no por `tieneMotor`.
    const catEsMotor = (categoria || '').toUpperCase().includes('MOTOR');

    // Cadena + peso: se emiten aunque el paño lleve motor; se omiten en las
    // categorías vendidas como motor y en las que NO llevan cadena de roller
    // (VERTICAL — tiene la suya, más abajo — y BEEBLACK). Sin ese segundo gate,
    // cualquier paño con `colorPeso` (que `fase0-sync` rellena a TODOS) emitía
    // un "Peso de cadena · BCO" sin código que duplicaba al VER52 de la
    // vertical, y una ventana convertida ROL→VERTICAL arrastraba su `codCadena`
    // viejo para siempre. Ojo: se excluyen esas dos categorías por nombre, NO
    // con `categoriaRequiereMecanismo`, porque esa devuelve false para categoría
    // vacía y una fila sin ventana asociada es un roller normal.
    const catSinCadenaRoller = esCategoriaVertical(categoria) || esCategoriaBeeblack(categoria);
    if (!catEsMotor && !catSinCadenaRoller) {
      // Cadena. Si el cotizador eligió la cadena real del inventario,
      // `codCadena` (CAD01…) va en la especificación para enlazar al stock
      // (mismo patrón que el mecanismo). Si no, cae al largo de texto antiguo.
      // El MEC 06 trae la cadena INCORPORADA: no se emite línea aunque el paño
      // arrastre una guardada de antes de cambiar el kit.
      const cadCod = (p.codCadena || '').trim();
      const cadLargo = p.largoCadena ? String(p.largoCadena) : '';
      const cadColor = p.colorCadena || '';
      if ((cadCod || cadLargo) && !kitTraeCadenaIncorporada(p.mecanismo)) {
        const cadKey = `CAD|${cadCod || cadLargo}|${cadColor}`;
        add(cadKey, 'CADENA', 'Cadena', cadCod || cadLargo, cadColor, 1, 'unid.');
      }
      // Peso de cadena. Si se eligió el peso real del inventario, su código
      // (PCA01/PCA04) va en la especificación para enlazar al stock.
      const pesoCod = (p.codPeso || '').trim();
      const pesoColor = p.colorPeso || '';
      if (pesoCod || pesoColor) {
        const pesoKey = `PESO|${pesoCod || pesoColor}`;
        add(pesoKey, 'CADENA', 'Peso de cadena', pesoCod, pesoColor, 1, 'unid.');
      }
    }

    // Kit de motor: además del kit manual, cuando el paño tiene un motor asignado.
    if (tieneMotor) {
      // Motor nuevo (DOM38/DOM41): kit con códigos DOM. Motor legacy o 'CABLE'
      // futuro: línea genérica como antes.
      const motorInsumos = insumosMotorDePano(p, categoria, reglas.tipos);
      if (motorInsumos.length > 0) {
        for (const ins of motorInsumos) {
          add(`MOT|${ins.codigo}|${ins.color}`, 'MOTOR', ins.descripcion, ins.codigo, ins.color, ins.cantidad, 'unid.');
          registrarKitEmitido(kitEmitidoPorCodigo, ins, p.motorModelo);
        }
      } else {
        const ladoMot = p.ladoMotor || '';
        const etiqueta = p.motorTipo || (p.motorModelo === 'CABLE' ? 'CON CABLE' : '');
        const motEspec = [etiqueta, ladoMot ? `Lado ${ladoMot}` : '']
          .filter(Boolean)
          .join(' — ');
        const motKey = `MOT|${etiqueta}|${mecColor}|${ladoMot}`;
        add(motKey, 'MOTOR', 'Motor', motEspec, mecColor, 1, 'unid.');
        if (p.motorControlAdic) add('MOT-CTRL', 'MOTOR', 'Control adicional motor', '', '', 1, 'unid.');
        if (p.motorHubUsb) add('MOT-HUB', 'MOTOR', 'Hub USB motor', '', '', 1, 'unid.');
      }
    }

    const manCant = parseInt(String(p.manillaCant ?? '0')) || 0;
    if (manCant > 0) {
      const manColor = p.manillaColor || '';
      const manCod = codigoManillaPorColor(manColor, reglas.colores);
      const manDesc = manCod ? MANILLAS[manCod].nombre : 'Manilla';
      const manKey = `MAN|${manColor}`;
      add(manKey, 'MANILLA', manDesc, manCod, manColor, manCant, 'unid.');
      if (manCod) manillasEmitidas[manCod] = (manillasEmitidas[manCod] || 0) + manCant;
    }

    const cenefaTipo = p.cenefa || 'No';
    if (cenefaCuadradaTapasFijas(categoria, p.cenefa, reglas.tipos)) {
      // Oscuridad con cenefa cuadrada (DARK y OSCURANTI implícitas · SOFT LIGHT CC): SIEMPRE 2
      // tapas por color de accesorios (TAP32 negro / TAP33 blanco / TAP34 café). La
      // cenefa en sí viaja por el Excel de órdenes (CENEFA DELANTERA), no como
      // línea de BOM ni con las tapas del selector `cenefaTapa`.
      const colorAcc = colorAccesoriosDePano(p, ventanaColor);
      const tapa = tapaCenefaCuadrada(colorAcc, reglas.colores);
      add(`TAPA|CUAD|${tapa.codigo || colorAcc}`, 'CENEFA', tapa.descripcion, tapa.codigo ?? '', colorAcc, 2, 'unid.');
    } else if (cenefaTipo && cenefaTipo !== 'No') {
      const cenColor = p.colorTapa || '';
      const cenKey = `CENEFA|${cenefaTipo}|${cenColor}`;
      add(cenKey, 'CENEFA', `Cenefa ${cenefaTipo}`, cenefaTipo, cenColor, 1, 'unid.');
      const tapasCount =
        p.cenefaTapa === 'CON_2_TAPAS' ? 2 : p.cenefaTapa === 'CON_1_TAPA' ? 1 : 0;
      if (tapasCount > 0) {
        const tapKey = `TAPA|${cenColor}`;
        add(tapKey, 'CENEFA', 'Tapa de cenefa', '', cenColor, tapasCount, 'unid.');
      }
    }

    // Insumos de instalación: tapas de peso, tornillos, brackets, tarugos. Dual:
    // el 2º+ paño omite las fijaciones (1 juego por cortina); las tapas van ×paño.
    const omitirFijaciones = !!p.dual && (row.panoIndex ?? 0) > 0;
    for (const ins of insumosDePano(p, { categoria, ventanaColor, anchoM, omitirFijaciones, tipos: reglas.tipos, colores: reglas.colores, lineaB: row.lineaB })) {
      add(`INS|${ins.codigo}|${ins.color}`, 'INSUMO', ins.descripcion, ins.codigo, ins.color, ins.cantidad, 'unid.');
    }

    // VERTICAL (lamas): insumos VER propios (carritos, cordón, sujetador, kit,
    // peso de cadena, bracket, cadena inferior). Los tarugos ya salieron por
    // insumosDePano (código TAR). Cordón y cadena inferior van "CALCULAR"
    // (cantidad 0 + unidad, se miden en terreno).
    if (esCategoriaVertical(categoria) && modelo) {
      const carritos = calculoVertical(modelo, anchoM * 100, 0).carritos;
      const colorAccVert = colorAccesoriosDePano(p, ventanaColor);
      // Cadena de la vertical: SIEMPRE la de 3 m, color por accesorios
      // (negro CAD04 / resto CAD06). Se calcula, no se lee del paño: así una
      // OT vieja con `codCadena` de roller se corrige sola al recalcular.
      const cadVert = codCadenaVertical(colorAccVert, reglas.cadenas);
      const cadVertColor = colorCadenaVertical(colorAccVert, reglas.cadenas);
      add(`CAD|${cadVert}|${cadVertColor}`, 'CADENA', 'Cadena', cadVert, cadVertColor, 1, 'unid.');
      for (const it of insumosVerticalDePano({
        colorAcc: colorAccVert,
        anchoM,
        carritos,
      })) {
        add(
          `INS|${it.codigo}|`,
          'INSUMO',
          it.descripcion,
          it.codigo,
          '',
          it.calcular ? 0 : it.cantidad,
          it.calcular ? 'CALCULAR' : 'unid.',
        );
      }
    }

    // BEEBLACK: kit SML propio, 1 por CORTINA (no por paño) — en el doble se
    // emite una vez con las cantidades ya duplicadas (salvo esquineros y tapas,
    // que son de la estructura). La barra de la manilla no es insumo: se cobra
    // en Fase 1 y se corta por la hoja de estructura.
    if (esCategoriaBeeblack(categoria) && (row.panoIndex ?? 0) === 0) {
      for (const it of insumosBeeblackDeCortina(
        colorAccesoriosDePano(p, ventanaColor),
        beeblackEsDoble(p),
        v ? cordonBeeblackDePano(v, { ...p, ancho: anchoM }, formulas) : 0,
      )) {
        add(
          `INS|${it.codigo}|`,
          'INSUMO',
          it.descripcion,
          it.codigo,
          '',
          it.calcular ? 0 : it.cantidad,
          it.calcular ? 'CALCULAR' : 'unid.',
        );
      }
    }
  });

  // Top-up de lo COBRADO en Fase 1 (motores + su cable DOM34, controles, hubs con
  // su router DOM05 y adaptador DOM33) que no salió por los paños. Consolida con
  // el kit por su código.
  for (const falta of faltantesDomoticaInventario(adicionalesFase0, kitEmitidoPorCodigo)) {
    add(`MOT|${falta.codigo}|`, 'MOTOR', falta.descripcion, falta.codigo, '', falta.cantidad, 'unid.');
  }
  // Ídem con las manillas planas cobradas: el cruce por ubicación no las baja al
  // paño cuando la ventana tiene varios paños (beeblack doble), así que salen acá.
  for (const falta of faltantesManillasInventario(adicionalesFase0, manillasEmitidas)) {
    add(`MAN|${falta.color}`, 'MANILLA', falta.descripcion, falta.codigo, falta.color, falta.cantidad, 'unid.');
  }

  return [...acc.values()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a.categoria);
    const ib = CAT_ORDER.indexOf(b.categoria);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

export type GuardarBomResult = {
  ordenMaterialesOk: boolean;
  errorOrdenMateriales?: string;
};

type BomRow = {
  empresa_id: string;
  ot_id: string;
  orden: number;
  categoria: string;
  descripcion: string;
  especificacion: string | null;
  color: string | null;
  cantidad_req: number;
  unidad: string;
  cantidad_despachada: number;
  estado: 'pendiente';
};

export function bomToOrdenMaterialesRows(
  items: BomItem[],
  empresaId: string,
  otId: string,
): BomRow[] {
  return items.map((it, i) => ({
    empresa_id: empresaId,
    ot_id: otId,
    orden: i + 1,
    categoria: it.categoria,
    descripcion: it.descripcion,
    especificacion: it.especificacion || null,
    color: it.color || null,
    cantidad_req: it.cantidad,
    unidad: it.unidad,
    cantidad_despachada: 0,
    estado: 'pendiente',
  }));
}
