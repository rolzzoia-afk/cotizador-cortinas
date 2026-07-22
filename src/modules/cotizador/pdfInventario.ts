// ─────────────────────────────────────────────────────────────────────
// PDF "INVENTARIO — ENTREGA Y RECEPCIÓN DE MATERIAL"
//
// Hoja de bodega que se entrega con la OT. Cuatro bloques:
//   1. Detalle por cortina (identidad: producto/tipo/mecanismo/tubería/
//      accionamiento/peso cadena/ubic/medidas, con descripciones completas)
//      — reusa la identidad del Cálculo general (mismo motor de datos).
//   2. INSUMOS consolidados en TRES tablas por destino: «INSUMOS» (tapas de
//      peso, tornillos, tarugos, suplementos), «INSUMOS DE PRODUCCIÓN» (taller:
//      mecanismo de cenefa ovalada + el motor de cortinas ovaladas) e «INSUMOS
//      DE INSTALACIÓN» (terreno: manillas, brackets, cadena, peso de cadena,
//      resto del kit de motor, tapa de cenefa cuadrada, etc.). Cada tabla se
//      imprime solo si tiene filas.
//   3. ETIQUETAS ROLZZO: una fila por código según color de accesorios
//      (blancos/grises → INS 95-1 blanca; resto → INS 95 negra), 1 por paño.
//   4. NOTAS DE TERRENO: lo que el vendedor anotó en Fase 2 (retiro,
//      material de instalación, cortes, suplementos, comentarios) por
//      ubicación — solo se imprime si alguna cortina tiene notas.
//
// Lógica pura salvo `generarPdfInventario`, que dibuja con jsPDF.
// ─────────────────────────────────────────────────────────────────────
import jsPDF from 'jspdf';
import type { Ventana, CatalogoProductos } from '@/modules/cotizador/types';
import type { VentanaItem } from '@/modules/ots/types';
import { ubicPanoVentana } from '@/modules/descuentos/adicionales-cenefa';
import { construirCalculoGeneral, type FilaCalculo } from './pdfCalculoGeneral';
import { PARAMETROS_CORTE_DEFAULT, type ParametrosCorte } from './parametrosCorte';
import { construirEtiquetas, type EtiquetaLinea } from './inventario';
import {
  COD_PESO_AUTO,
  codCadenaAutoPorAlto,
  derivarLargoColor,
  descripcionCadenaInventario,
  textoPesoCadenaInventario,
  type CadenaInsumo,
} from './cadenas';
import { esCenefaCuadrada, OPCIONES_MECANISMO_RESOLUCION, OPCIONES_TUBERIA } from './fase2';
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
  MEC_KIT_OVALADA_POR_COLOR,
  esCategoriaVertical,
  normalizarColorAccesorio,
} from '@/modules/descuentos/reglas-mecanismo';
import { calculoVertical } from '@/modules/descuentos/despiece';
import {
  COD_HUB_DOMOTICA,
  MANILLAS,
  NOMBRE_HUB_DOMOTICA,
  codigoManillaPorColor,
  esCategoriaDuo,
  esCenefaOvalada,
  esCodigoMotor,
  insumosDePano,
  insumosMotorDePano,
  insumosVerticalDePano,
  panoLlevaDomotica,
  tapaCenefaCuadrada,
} from './insumosCortina';

type RGB = [number, number, number];

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

/** Tabla de destino del insumo: bodega (INSUMOS), taller (PRODUCCION) o
 *  terreno (INSTALACION). */
export type GrupoInsumo = 'INSUMOS' | 'PRODUCCION' | 'INSTALACION';

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
  /** Etiquetas por código según color de accesorios (blancos → INS 95-1). */
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
): { codigo?: string; descripcion: string; cantidad: number }[] {
  const acc = new Map<string, { codigo?: string; cantidad: number }>();
  for (const f of filas) {
    const m = (f.manillas || '').trim();
    if (!m) continue;
    const [, cant, color] = m.match(/^(\d+)\s*(.*)$/) || [];
    const n = parseInt(cant || '', 10);
    if (!n) continue;
    const col = (color || '').trim();
    const cod = codigoManillaPorColor(col);
    const descripcion = cod ? `[${cod}] ${MANILLAS[cod].nombre}` : `MANILLA ${col}`.trim();
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
 *    suplementos (SUB). Excepción: la tapa de cenefa cuadrada (TAP32/33/34) se
 *    coloca en terreno y su emisión la fuerza a INSTALACIÓN (ver override abajo).
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
  if (c.startsWith('TAP') || c.startsWith('TOR') || c.startsWith('TAR') || c.startsWith('SUB')) {
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
function descKitMec(num: number): string {
  const cod = `MEC${String(num).padStart(2, '0')}`;
  const chip = chipMecanismoPorNumero(num, OPCIONES_MECANISMO_RESOLUCION);
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
): InsumoConsolidado[] {
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
  let llevaDomotica = false;
  for (const v of ventanas) {
    const modelo = (v.modelo as ModeloDespiece | null | undefined) ?? null;
    // Dual: el kit de mecanismo es 1 por ventana (un solo bracket dual).
    let dualKitEmitido = false;
    for (const [pi, p] of (v.panos || []).entries()) {
      const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
      const tieneMotor = !!(p.motorModelo || p.motorTipo) || (v.categoria || '').toUpperCase().includes('MOTOR');
      // Cenefa ovalada: por la cenefa guardada o por el SISTEMA del modelo (cubre
      // el dúo, cuya categoría "DUO_MANUAL_*" no dice "ovalada"). Con tubo E78 la
      // armadura es MIXTA (tapas del kit ovalada + pivotes del kit 45) y NO se
      // arma el mecanismo ovalada completo: por eso ese kit no se lista, solo las
      // tapas y los pivotes (más abajo).
      const ovalada = esCenefaOvalada(p.cenefa, v.categoria);
      const ovaladaSistema =
        ovalada || (modelo?.sistema || '').toUpperCase().includes('CENEFA_OVALADA');
      const esE78Ovalada =
        ovaladaSistema &&
        codigoTuberiaDeChip(
          tuberiaParaPano(anchoM, modelo, p.tuberia as string, OPCIONES_TUBERIA, v.categoria),
        ) === 'E78';

      // Mecanismo + cadena + peso: solo roller manual con mecanismo.
      if (!tieneMotor && categoriaRequiereMecanismo(v.categoria)) {
        const chip = mecanismoParaPano(p, v.color, modelo, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoM, usarTuboE78);
        const num = numeroMecDeChip(chip);
        // Una cortina con mecanismo de cenefa ovalada se arma en el taller: su
        // mecanismo Y su cadena van a PRODUCCIÓN. El resto de cadenas, a
        // INSTALACIÓN (grupo por defecto).
        const grupoOvalada: GrupoInsumo | undefined =
          chip && chip.toUpperCase().includes('OVALADA') ? 'PRODUCCION' : undefined;
        // E78 + ovalada NO usa el mecanismo completo (se desglosa en tapas +
        // pivotes), así que su kit NO se lista; el resto sí lleva su mecanismo.
        // Dual: 1 kit por ventana (no ×2 paños) → se emite solo una vez.
        if (chip && num != null && !esE78Ovalada) {
          const esDualChip = esChipDual(chip);
          if (!esDualChip || !dualKitEmitido) {
            const cod = `MEC${String(num).padStart(2, '0')}`;
            bump(cod, `[${cod}] ${chip}`, 1);
            if (esDualChip) dualKitEmitido = true;
          }
        }
        // Cadena: usa la elegida en Fase 2 (codCadena); si el paño no la guardó
        // (OT no sincronizada en Fase 2), la resuelve por alto + color con el
        // catálogo de cadenas — igual que Fase 2 — para que no falte en la hoja.
        if (p.codCadena) {
          bump(p.codCadena.toUpperCase(), descripcionCadenaInventario(p), 1, grupoOvalada);
        } else {
          const altoM = parseFloat(String(p.alto ?? v.alto ?? 0)) || 0;
          const codCad = codCadenaAutoPorAlto(altoM, colorAccesoriosDePano(p, v.color), v.categoria, cadenas);
          if (codCad) {
            const { largoCadena, colorCadena } = derivarLargoColor(codCad, cadenas);
            bump(codCad.toUpperCase(), descripcionCadenaInventario({ codCadena: codCad, largoCadena, colorCadena }), 1, grupoOvalada);
          }
        }
        // El peso de cadena es fijo (PCA04, transparente) para toda cortina de
        // cadena: se emite SIEMPRE, aunque el paño no lo tenga guardado — igual
        // que el mecanismo, que se resuelve en vivo. Si en Fase 2 se eligió otro
        // peso, se respeta.
        const cp = (p.codPeso || COD_PESO_AUTO).replace(/\s+/g, '').toUpperCase();
        bump(cp, `[${cp}] ${textoPesoCadenaInventario({ codPeso: cp })}`.trim(), 1);
      }

      // Dual: el 2º+ paño omite las fijaciones (1 juego por cortina); tapas ×paño.
      for (const ins of insumosDePano(p, {
        categoria: v.categoria,
        ventanaColor: v.color,
        anchoM,
        omitirFijaciones: !!p.dual && pi > 0,
      })) {
        bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad);
      }
      // VERTICAL (lamas): insumos VER propios (carritos, cordón, sujetador, kit,
      // peso de cadena, bracket, cadena inferior). Los tarugos ya salieron por
      // `insumosDePano` (código TAR → INSUMOS). Los "CALCULAR" (cordón, cadena
      // inferior) se emiten con cantidad 0 + unidad "CALCULAR": no llevan número.
      if (esCategoriaVertical(v.categoria) && modelo) {
        const carritos = calculoVertical(modelo, anchoM * 100, 0).carritos;
        for (const it of insumosVerticalDePano({
          colorAcc: colorAccesoriosDePano(p, v.color),
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
      // TUBO E78 + cenefa ovalada: armadura mixta que reemplaza al mecanismo
      // completo (por eso arriba no se lista el kit) — tapas del kit ovalada de
      // bodega (39 blanco / 38 negro / 12 gris, según color de accesorios) +
      // pivotes del kit 45 mm por color (18 blanco / 23 negro; GRIS queda manual
      // porque no hay kit 45 gris). Van al taller = PRODUCCIÓN. El dúo lleva 2
      // tubos → 4+4; resto 2+2. Se resuelve por COLOR (no por el chip de
      // mecanismo) para que también aplique a las ovaladas motorizadas.
      if (esE78Ovalada) {
        const nMix = esCategoriaDuo(v.categoria) ? 4 : 2;
        const colorAcc = normalizarColorAccesorio(colorAccesoriosDePano(p, v.color));
        const mecTapas = MEC_KIT_OVALADA_POR_COLOR[colorAcc];
        if (mecTapas != null) bump(undefined, descKitMec(mecTapas), nMix, 'PRODUCCION', 'TAPAS');
        // Pivotes: solo blanco→18 / negro→23. Gris (y colores sin kit 45) queda
        // manual — decisión del usuario 2026-07-15: sin línea automática.
        const mecPivotes =
          colorAcc === 'NEG' || colorAcc === 'NEGRO'
            ? 23
            : colorAcc === 'BCO' || colorAcc === 'BLANCO'
              ? 18
              : null;
        if (mecPivotes != null) bump(undefined, descKitMec(mecPivotes), nMix, 'PRODUCCION', 'PIVOTES');
      }
      // El MOTOR de una cortina con cenefa ovalada va a PRODUCCIÓN; el resto del
      // kit (control, cable, enchufe) y los motores de cortinas normales, a
      // INSTALACIÓN (grupo por defecto).
      const motorInsumos = insumosMotorDePano(p, v.categoria);
      if (motorInsumos.length > 0) {
        for (const ins of motorInsumos) {
          const grupo = ovalada && esCodigoMotor(ins.codigo) ? 'PRODUCCION' : undefined;
          bump(ins.codigo, `[${ins.codigo}] ${ins.descripcion}`, ins.cantidad, grupo);
        }
      } else if (p.motorModelo || p.motorTipo) {
        // Motor legacy o 'CABLE' futuro (sin código DOM): línea genérica, para que
        // el motor no se pierda de la hoja de entrega (el BOM también lo lista así).
        const etiqueta = (p.motorTipo || (p.motorModelo === 'CABLE' ? 'CON CABLE' : '')).trim();
        bump(undefined, etiqueta ? `MOTOR ${etiqueta}` : 'MOTOR', 1, ovalada ? 'PRODUCCION' : undefined);
      }
      if (panoLlevaDomotica(p)) llevaDomotica = true;
      // Tapa de cenefa cuadrada: 1 o 2 según cenefaTapa. Lleva código por color
      // (TAP32 negro / TAP33 blanco / TAP34 café) para que bodega enlace stock,
      // pero se FUERZA a INSTALACIÓN (se coloca en terreno): su código TAP caería
      // en INSUMOS por defecto. Gris u otro color sale sin código.
      if (esCenefaCuadrada(p.cenefa)) {
        const n = p.cenefaTapa === 'CON_2_TAPAS' ? 2 : p.cenefaTapa === 'CON_1_TAPA' ? 1 : 0;
        if (n > 0) {
          const tapa = tapaCenefaCuadrada(p.colorTapa);
          const desc = tapa.codigo ? `[${tapa.codigo}] ${tapa.descripcion}` : tapa.descripcion;
          bump(tapa.codigo, desc, n, 'INSTALACION');
        }
      }
    }
  }
  if (llevaDomotica) bump(COD_HUB_DOMOTICA, `[${COD_HUB_DOMOTICA}] ${NOMBRE_HUB_DOMOTICA}`, 1);

  const out: InsumoConsolidado[] = [];
  let id = 0;
  // Manillas primero (instalación), luego el resto de insumos ya clasificados.
  for (const m of consolidarManillas(filas)) {
    out.push({ id: ++id, codigo: m.codigo, descripcion: m.descripcion, cantidad: m.cantidad, grupo: 'INSTALACION' });
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
        ubic: ubicPanoVentana(v.ubicacion || '', i, panos.length),
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
): Inventario {
  const { filas } = construirCalculoGeneral(ventanas, catalogo, params, undefined, {
    usarTuboE78,
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
    insumos: consolidarInsumos(ventanas, filas, cadenas, usarTuboE78),
    etiquetas: construirEtiquetas(ventanas as unknown as VentanaItem[]),
    notas: notasTerreno(ventanas),
  };
}

// ── Render PDF ───────────────────────────────────────────────────────
export type MetaInventario = { ot: string; cliente?: string; empresa?: string };

const C_DARK: RGB = [55, 55, 62];
const C_WHITE: RGB = [255, 255, 255];
const C_LINE: RGB = [150, 150, 158];
const C_GREEN: RGB = [112, 173, 71];
const C_BLUE: RGB = [31, 119, 180];
const C_TEXT: RGB = [25, 25, 30];

type Col = { label: string; w: number; align?: 'l' | 'c' };

/**
 * Texto dentro de una celda, centrado verticalmente. Achica la fuente hasta
 * 8 pt para que quepa en UNA línea; si aún no entra, parte en DOS líneas en
 * vez de seguir encogiendo — así los textos largos (KIT SIMPLE…, UBIC.)
 * quedan del mismo porte que el resto de la tabla. Con `wrap: false`
 * (cabeceras) mantiene el comportamiento de una línea con mínimo 4 pt.
 */
function celda(
  doc: jsPDF,
  s: string,
  x: number,
  w: number,
  yTop: number,
  h: number,
  opts: { size?: number; bold?: boolean; color?: RGB; align?: 'l' | 'c'; wrap?: boolean } = {},
) {
  const { bold = false, color = C_TEXT, align = 'l', wrap = true } = opts;
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const maxW = w - 1.4;
  const txt = String(s ?? '');

  const dibujar = (t: string, yBase: number) => {
    if (align === 'c') doc.text(t, x + w / 2, yBase, { align: 'center' });
    else doc.text(t, x + 0.8, yBase, { align: 'left' });
  };

  let size = opts.size ?? 11;
  doc.setFontSize(size);
  // 7 pt como piso de UNA línea (antes 8): las columnas ya están dimensionadas
  // para que todo entre a 8 pt, así que este medio punto extra es solo la red
  // para una descripción excepcionalmente larga — cortar en dos líneas ahora
  // desbordaría la fila, que es más baja.
  const minUnaLinea = wrap ? 7 : 4;
  while (size > minUnaLinea && doc.getTextWidth(txt) > maxW) {
    size -= 0.3;
    doc.setFontSize(size);
  }
  if (!wrap || doc.getTextWidth(txt) <= maxW) {
    let t = txt;
    while (t.length > 1 && doc.getTextWidth(t) > maxW) t = t.slice(0, -1);
    dibujar(t, yTop + h / 2 + size * 0.17);
    return;
  }

  // Dos líneas (achicando un poco más solo si ni así entra).
  let lineas = doc.splitTextToSize(txt, maxW) as string[];
  while (size > 5.5 && lineas.length > 2) {
    size -= 0.3;
    doc.setFontSize(size);
    lineas = doc.splitTextToSize(txt, maxW) as string[];
  }
  lineas = lineas.slice(0, 2);
  const lh = size * 0.42;
  const y1 = yTop + h / 2 + size * 0.17 - lh / 2;
  dibujar(lineas[0], y1);
  if (lineas[1]) {
    let t2 = lineas[1];
    while (t2.length > 1 && doc.getTextWidth(t2) > maxW) t2 = t2.slice(0, -1);
    dibujar(t2, y1 + lh);
  }
}

/** Salto de página de una tabla: límite inferior + qué dibujar en la nueva página. */
type SaltoTabla = { bottom: number; onBreak: () => number };

/**
 * Dibuja una tabla (header oscuro + filas). Devuelve la y final. Si recibe
 * `salto`, corta en el límite inferior y sigue en página nueva repitiendo
 * la cabecera.
 */
function tabla(
  doc: jsPDF,
  x: number,
  yStart: number,
  cols: Col[],
  rows: string[][],
  opts: { headFill?: RGB; rowH?: number; headH?: number; greenCol?: number; salto?: SaltoTabla } = {},
): number {
  const headFill = opts.headFill ?? C_DARK;
  const rowH = opts.rowH ?? 6;
  // Cabecera compacta: el rótulo va en 8,5 pt (≈2,1 mm de altura de mayúscula),
  // así que 7 mm dejan ~2,4 mm de aire arriba y abajo.
  const headH = opts.headH ?? 7;
  const totalW = cols.reduce((a, c) => a + c.w, 0);

  const cabecera = (yy: number): number => {
    doc.setFillColor(headFill[0], headFill[1], headFill[2]);
    doc.rect(x, yy, totalW, headH, 'F');
    let cx = x;
    for (const c of cols) {
      doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, yy, c.w, headH);
      celda(doc, c.label, cx, c.w, yy, headH, {
        bold: true,
        color: C_WHITE,
        align: 'c',
        size: 8.5,
        wrap: false,
      });
      cx += c.w;
    }
    return yy + headH;
  };

  let y = cabecera(yStart);

  // Filas
  for (let i = 0; i < rows.length; i++) {
    if (opts.salto && y + rowH > opts.salto.bottom) {
      y = cabecera(opts.salto.onBreak());
    }
    const row = rows[i];
    const bg: RGB = i % 2 === 0 ? [245, 246, 248] : C_WHITE;
    let cx = x;
    cols.forEach((c, j) => {
      const fill = opts.greenCol === j ? C_GREEN : bg;
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.rect(cx, y, c.w, rowH, 'F');
      doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, y, c.w, rowH);
      const val = row[j] ?? '';
      celda(doc, val, cx, c.w, y, rowH, {
        align: c.align ?? 'l',
        bold: opts.greenCol === j,
        color: opts.greenCol === j ? C_WHITE : C_TEXT,
      });
      cx += c.w;
    });
    y += rowH;
  }
  return y;
}

/** Genera y descarga el PDF de la hoja INVENTARIO de una OT. */
export function generarPdfInventario(
  ventanas: Ventana[],
  catalogo: CatalogoProductos,
  meta: MetaInventario,
  params: ParametrosCorte = PARAMETROS_CORTE_DEFAULT,
  cadenas: CadenaInsumo[] = [],
  usarTuboE78 = false,
): void {
  const data = construirInventario(ventanas, catalogo, params, cadenas, usarTuboE78);
  if (data.filas.length === 0) {
    throw new Error('No hay cortinas en la OT.');
  }

  const doc = new jsPDF('l', 'mm', 'a4'); // 297 × 210
  const W = doc.internal.pageSize.getWidth();
  const mg = 8;
  const usable = W - mg * 2;
  // Ancho de las TABLAS (los títulos de bloque usan el mismo para no desalinearse).
  // Dimensionado para que NINGUNA celda parta en dos líneas: la descripción más
  // larga del catálogo ([PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM)
  // mide 92,8 mm a 8 pt, así que DESCRIPCIÓN necesita ≥ 95 mm. Con una sola línea
  // por fila el alto baja a 6 mm, que es lo que realmente comprime la hoja.
  const tablaW = Math.min(usable, 261);

  // ── Encabezado (se repite en cada página) ──────────────────────────
  let pagina = 0;
  const encabezado = (): number => {
    pagina++;
    doc.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('INVENTARIO', mg, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 110, 118);
    doc.text('[ ENTREGA Y RECEPCIÓN DE MATERIAL ]', mg, 18);

    doc.setTextColor(C_TEXT[0], C_TEXT[1], C_TEXT[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(`OT  ${meta.ot}`, W - mg, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Cliente: ${(meta.cliente || '—').toUpperCase()}`, W - mg, 18, { align: 'right' });
    doc.setDrawColor(C_LINE[0], C_LINE[1], C_LINE[2]);
    doc.setLineWidth(0.3);
    doc.line(mg, 21, W - mg, 21);
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 158);
    doc.text(`Página ${pagina}`, W - mg, 24.5, { align: 'right' });
    return 26;
  };
  let y = encabezado();

  // OTs largas: las tablas cortan al llegar al borde y siguen en página
  // nueva; los títulos de bloque saltan junto con su cabecera y ≥1 fila.
  const BOTTOM = doc.internal.pageSize.getHeight() - mg;
  const salto: SaltoTabla = {
    bottom: BOTTOM,
    onBreak: () => {
      doc.addPage();
      return encabezado();
    },
  };

  // ── INSUMOS: tres tablas (INSUMOS / PRODUCCIÓN / INSTALACIÓN) consolidadas.
  // La antigua tabla "detalle por cortina" se eliminó (pedido #20). Cada tabla
  // se imprime solo si tiene filas; el título salta con su cabecera y ≥1 fila.
  const titH = 7;
  const bloqueInsumos = (titulo: string, items: InsumoConsolidado[]) => {
    if (items.length === 0) return;
    y += 3;
    if (y + titH + 13 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_BLUE[0], C_BLUE[1], C_BLUE[2]);
    doc.rect(mg, y, tablaW, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titulo, mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ENTREGADO POR:', mg + tablaW * 0.5, y + titH / 2 + 2);
    y += titH;

    // Anchos en mm reales (suman tablaW, así que sc2 = 1). Cada uno está tomado
    // del texto más largo que puede recibir a 8 pt: DESCRIPCIÓN 92,8 + margen;
    // CANTIDAD/TOTAL 14,5 ("4 PIVOTES") + margen; ADICIONAL por su cabecera
    // (16,1 a 8,5 pt). El resto son casillas de firma.
    const w2 = [8, 96, 17, 18, 17, 24, 24, 21, 36];
    const sum2 = w2.reduce((a, b) => a + b, 0);
    const sc2 = tablaW / sum2;
    const cols2: Col[] = [
      { label: 'ID', align: 'c' },
      { label: 'DESCRIPCIÓN' },
      { label: 'CANTIDAD', align: 'c' },
      { label: 'ADICIONAL', align: 'c' },
      { label: 'TOTAL', align: 'c' },
      { label: 'INSTALACIÓN', align: 'c' },
      { label: 'PRODUCCIÓN', align: 'c' },
      { label: 'FECHA', align: 'c' },
      { label: 'PERSONA QUE RECIBE' },
    ].map((c, i) => ({ ...c, w: w2[i] * sc2 }) as Col);
    // Con cantidad 0 + unidad se muestra SOLO la unidad ("CALCULAR": el cordón y
    // la cadena inferior de la vertical se miden en terreno, sin número fijo).
    const cantTxt = (m: InsumoConsolidado) =>
      m.unidad ? (m.cantidad === 0 ? m.unidad : `${m.cantidad} ${m.unidad}`) : String(m.cantidad);
    const rows2 = items.map((m, i) => [
      String(i + 1),
      m.descripcion,
      cantTxt(m),
      '',
      cantTxt(m),
      '',
      '',
      '',
      '',
    ]);
    y = tabla(doc, mg, y, cols2, rows2, { rowH: 6, greenCol: 4, salto });
  };
  bloqueInsumos('INSUMOS', data.insumos.filter((m) => m.grupo === 'INSUMOS'));
  bloqueInsumos('INSUMOS DE PRODUCCIÓN', data.insumos.filter((m) => m.grupo === 'PRODUCCION'));
  bloqueInsumos('INSUMOS DE INSTALACIÓN', data.insumos.filter((m) => m.grupo === 'INSTALACION'));

  // ── BLOQUE 3: ETIQUETAS ROLZZO ─────────────────────────────────────
  y += 3;
  if (y + titH + 13 > BOTTOM) y = salto.onBreak();
  doc.setFillColor(C_GREEN[0], C_GREEN[1], C_GREEN[2]);
  doc.rect(mg, y, tablaW, titH, 'F');
  doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ETIQUETAS ROLZZO', mg + 2, y + titH / 2 + 2);
  doc.setFontSize(8.5);
  doc.text('ENTREGADO', mg + tablaW * 0.5, y + titH / 2 + 2);
  y += titH;

  // DESCRIPCIÓN alineada con la de las tablas de insumos (96 mm): la etiqueta
  // ("ETIQUETAS DE CORTINAS BLANCAS (ROLZZO)", 63,5 mm) entra holgada en UNA línea.
  const w3 = [18, 96, 17, 34, 34, 62];
  const sum3 = w3.reduce((a, b) => a + b, 0);
  const sc3 = tablaW / sum3;
  const cols3: Col[] = [
    { label: 'COD', align: 'c' },
    { label: 'DESCRIPCIÓN' },
    { label: 'CANTIDAD', align: 'c' },
    { label: 'INSTALACION', align: 'c' },
    { label: 'PRODUCCION', align: 'c' },
    { label: 'PERSONA QUE RECIBE' },
  ].map((c, i) => ({ ...c, w: w3[i] * sc3 }) as Col);
  const rows3 = data.etiquetas.map((e) => [
    e.cod,
    `ETIQUETAS DE CORTINAS ${e.color === 'BLANCA' ? 'BLANCAS' : 'NEGRAS'} (ROLZZO)`,
    String(e.cantidad),
    '',
    '',
    '',
  ]);
  y = tabla(doc, mg, y, cols3, rows3, { rowH: 6, greenCol: 2, salto });

  // ── BLOQUE 3: NOTAS DE TERRENO (solo si alguien anotó algo en Fase 2) ─
  if (data.notas.length > 0) {
    y += 3;
    if (y + titH + 16 > BOTTOM) y = salto.onBreak();
    doc.setFillColor(C_DARK[0], C_DARK[1], C_DARK[2]);
    doc.rect(mg, y, tablaW, titH, 'F');
    doc.setTextColor(C_WHITE[0], C_WHITE[1], C_WHITE[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('NOTAS DE TERRENO', mg + 2, y + titH / 2 + 2);
    doc.setFontSize(8.5);
    doc.text('ANOTADO EN FASE 2', mg + tablaW * 0.5, y + titH / 2 + 2);
    y += titH;

    const w4 = [55, 206];
    const sum4 = w4.reduce((a, b) => a + b, 0);
    const sc4 = tablaW / sum4;
    const cols4: Col[] = [
      { label: 'UBICACIÓN' },
      { label: 'NOTAS' },
    ].map((c, i) => ({ ...c, w: w4[i] * sc4 }) as Col);
    const rows4 = data.notas.map((n) => [n.ubic, n.notas]);
    // NOTAS conserva la fila alta: es texto libre del vendedor, sin largo acotado,
    // así que es la única tabla donde el corte en dos líneas es esperable.
    y = tabla(doc, mg, y, cols4, rows4, { rowH: 8.5, salto });
  }

  doc.save(`Inventario_${meta.ot}.pdf`);
}
