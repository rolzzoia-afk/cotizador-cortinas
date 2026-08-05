import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OPCIONES_ARMADO,
  OPCIONES_BRACKET_TIPO,
  OPCIONES_CENEFA,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CENEFA_TIRA,
  OPCIONES_CIERRE_VERT,
  OPCIONES_CORTES,
  OPCIONES_LADO_MOTOR,
  OPCIONES_LARGO_CADENA,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_DUAL_LADO,
  OPCIONES_MECANISMO,
  OPCIONES_MOTOR_MODELO,
  OPCIONES_ORDEN_DOBLE,
  OPCIONES_RELACION_MARCO,
  OPCIONES_SUPLEMENTO,
  OPCIONES_SUPERFICIE,
  OPCIONES_TIPO_MECANISMO,
  OPCIONES_TIPO_TELA,
  OPCIONES_TUBERIA,
  esCenefaCuadrada,
  parcheSuperficiePerfil,
  type SuperficiePerfilOscuridad,
} from '@/modules/cotizador/fase2';
import type { Pano } from '@/modules/cotizador/types';
import { debeInvertirPano } from '@/modules/cotizador/tela';
import { cantidadSuplementosAuto } from '@/modules/cotizador/insumosCortina';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { colorAccesorioCorto } from '@/modules/cotizador/fase0-sync';
import { coloresParaUso, opcionesColorConGuardado } from '@/modules/descuentos/coloresAccesorio';
import {
  cadenasRoller,
  etiquetaCadena,
  derivarLargoColor,
  pesosSeleccionables,
  type CadenaInsumo,
} from '@/modules/cotizador/cadenas';
import {
  aplicarDefaultsPerfiles,
  cortesOscuridad,
  esFamiliaSoftLight,
  esFamiliaSoftLightCC,
  familiaOscuridadConDiametro,
  medidaPerfilOscuridad,
  montajeBaseDisponible,
  normalizarMontajeBase,
  normalizarPerforacion,
  normalizarVarianteOscuridad,
  type MedidasPerfilesOscuridad,
  type PerfilesOscuridad,
  type PerforacionPerfil,
  type SuperficiePerfilKey,
  type VarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import { codigoTuberiaDeChip, diametroDeCodigoTubo } from '@/modules/descuentos/reglas-tuberia';
import {
  codigoManillaBeeblack,
  codigoPerfilBeeblack,
  codigoSeparadorPerfil,
} from '@/modules/descuentos/codigos-estructura';
import { colorPerfilDesdeAdicional, type TipoPerfilAdicional } from '@/modules/descuentos/adicionales-perfil';
import { colorPesoInfOscuridadExcel } from '@/modules/descuentos/peso-oscuridad';
import {
  cortesBeeblack,
  esCategoriaBeeblack,
  esCierreVerticalBeeblack,
  INSTALACIONES_BEEBLACK,
  LABEL_INSTALACION_BEEBLACK,
  medidaComponenteBeeblack,
  normalizarInstalacionBeeblack,
  normalizarVarianteBeeblack,
  TOGGLES_BEEBLACK,
  type TogglesBeeblack,
  type VarianteBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import { FORMULAS_DEFAULT, type FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import {
  REGLAS_SELECCION_DEFAULT,
  type ReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccion';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';

type Props = {
  pano: Pano;
  onChange: (patch: Partial<Pano>) => void;
  panoNum: number;
  /** Cadenas reales del inventario (CAD01…) para el selector. */
  cadenas?: CadenaInsumo[];
  /** Pesos de cadena del inventario (PCA01/PCA04) para el selector. */
  pesos?: CadenaInsumo[];
  /** Opciones filtradas de mecanismo (default: todas). */
  opcionesMecanismo?: readonly string[];
  /** Opciones filtradas de tubería (default: todas). */
  opcionesTuberia?: readonly string[];
  /** Nota cuando el mecanismo quedó fijo (p.ej. roller >3 m → 63 mm). */
  mecanismoFijoNota?: string;
  /** Ocultar sección mecanismo (VERTICAL, BEEBLACK). */
  ocultarMecanismo?: boolean;
  /** Categoría de la ventana (para detectar sistemas de oscuridad). */
  categoria?: string;
  /** Color de la ventana (fallback del color de accesorios). */
  colorVentana?: string | null;
  /** Caída de la ventana heredada de Fase 0 (INTERNO/EXTERNO). */
  sentidoVentana?: string | null;
  /** Variante de oscuridad de la ventana (INTERNO/SEMI/EXTERNO), asignada en Fase 1. */
  varianteVentana?: string | null;
  /** Dirección/cierre de la ventana. En BEEBLACK, 'DE ARRIBA ABAJO' gira la cortina. */
  direccionVentana?: string | null;
  /** Adicionales Fase 0 (colores de perfiles). */
  adicionalesFase0?: AdicionalFase0Persistido[];
  /** Ancho del rollo (m) para auto-sugerir corte invertido. Default 2,98. */
  anchoRollo?: number;
  /** Fórmulas de corte editadas en Admin (Catálogo técnico). */
  formulas?: FormulasFamilias;
  /** Reglas de tubería/mecanismo editadas en Admin (para leer el diámetro de un
   *  tubo dado de alta ahí). Sin esto, las de fábrica. */
  reglas?: ReglasSeleccion;
};

// Perfiles de oscuridad POR LADO (izq / der / base). Cada lado tiene: activo,
// perforación (INT/EXT, anotación de taller), superficie (muro/piso/marco = medida)
// y override cm. La variante en Fase 1 activa los laterales; la superficie y el
// perfil base se completan en Fase 2. "Marco" (dentro del marco, solo INTERNO)
// mide como piso (alto real).
type LadoPerfil = {
  side: 'izq' | 'der' | 'inf';
  label: string;
  activo: keyof Pano;
  perf: keyof Pano;
  muro: keyof Pano;
  piso: keyof Pano;
  marco: keyof Pano;
  muroKey: SuperficiePerfilKey;
  pisoKey: SuperficiePerfilKey;
  marcoKey: SuperficiePerfilKey;
  muroCm: keyof Pano;
  pisoCm: keyof Pano;
  marcoCm: keyof Pano;
  tipoAdic: TipoPerfilAdicional;
  /** Separador (E41/E42/E43) del mismo lado. */
  sepActivo: keyof Pano;
  sepCm: keyof Pano;
  sepColumna: string;
};

const PERFILES_LADO: LadoPerfil[] = [
  { side: 'izq', label: 'Perfil izquierdo', activo: 'perfilIzqActivo', perf: 'perfilIzqPerf', muro: 'perfilIzqMuro', piso: 'perfilIzqPiso', marco: 'perfilIzqMarco', muroKey: 'izqMuro', pisoKey: 'izqPiso', marcoKey: 'izqMarco', muroCm: 'perfilIzqMuroCm', pisoCm: 'perfilIzqPisoCm', marcoCm: 'perfilIzqMarcoCm', tipoAdic: 'izq', sepActivo: 'separadorIzq', sepCm: 'separadorIzqCm', sepColumna: 'SEPARADOR (IZQ)' },
  { side: 'der', label: 'Perfil derecho', activo: 'perfilDerActivo', perf: 'perfilDerPerf', muro: 'perfilDerMuro', piso: 'perfilDerPiso', marco: 'perfilDerMarco', muroKey: 'derMuro', pisoKey: 'derPiso', marcoKey: 'derMarco', muroCm: 'perfilDerMuroCm', pisoCm: 'perfilDerPisoCm', marcoCm: 'perfilDerMarcoCm', tipoAdic: 'der', sepActivo: 'separadorDer', sepCm: 'separadorDerCm', sepColumna: 'SEPARADOR (DER)' },
  { side: 'inf', label: 'Perfil base', activo: 'perfilInfActivo', perf: 'perfilInfPerf', muro: 'perfilInfMuro', piso: 'perfilInfPiso', marco: 'perfilInfMarco', muroKey: 'infMuro', pisoKey: 'infPiso', marcoKey: 'infMarco', muroCm: 'perfilInfMuroCm', pisoCm: 'perfilInfPisoCm', marcoCm: 'perfilInfMarcoCm', tipoAdic: 'inf', sepActivo: 'separadorInf', sepCm: 'separadorInfCm', sepColumna: 'SEPARADOR BASE' },
];

const OPCIONES_PERFORACION = [
  { value: 'INTERNO', label: 'Int' },
  { value: 'EXTERNO', label: 'Ext' },
] as const;

// Superficie del perfil = MEDIDA. Muro = alto+10; piso y marco = alto real. La
// opción "Dentro del marco" solo se ofrece en sistemas INTERNOS.
const OPCIONES_SUPERFICIE_PERFIL = [
  { value: 'muro', label: 'Muro', soloInterno: false },
  { value: 'piso', label: 'Piso', soloInterno: false },
  { value: 'marco', label: 'Dentro del marco', soloInterno: true },
] as const;

// Montaje del perfil base (solo soft light INTERNO): entre los laterales (más
// corto, ancho − 13,3) o de pared a pared (ancho completo).
const OPCIONES_MONTAJE_BASE = [
  { value: 'DENTRO', label: 'Dentro de perfiles' },
  { value: 'PARED', label: 'Pared a pared' },
] as const;

// Cargador/hub del motor: OPCIONAL — no todos los motores llevan hub, así que
// el default es 'No lleva' y el vendedor lo agrega cuando el cliente lo compra.
// El hub típico depende del motor (DOM38 → hub domótica DOM43; DOM41 → HUB USB
// DOM03); DOM33 (adaptador) es la alternativa manual en ambos.
const OPCIONES_CARGADOR_DOM38 = [
  { value: 'NINGUNO', label: 'No lleva' },
  { value: 'DOM43', label: 'Hub domótica (DOM43)' },
  { value: 'DOM33', label: 'Adaptador (DOM33)' },
] as const;
const OPCIONES_CARGADOR_DOM41 = [
  { value: 'NINGUNO', label: 'No lleva' },
  { value: 'DOM03', label: 'HUB USB (DOM03)' },
  { value: 'DOM33', label: 'Adaptador (DOM33)' },
] as const;
// Etiquetas para mostrar un cargador guardado que no está en las opciones del
// modelo actual (ej. DOM03 guardado y luego el motor cambió a DOM38).
const LABEL_CARGADOR: Record<string, string> = {
  DOM43: 'Hub domótica (DOM43)',
  DOM03: 'HUB USB (DOM03)',
  DOM33: 'Adaptador (DOM33)',
};

const OPCIONES_VARIANTE_OSCURIDAD = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'EXTERNO', label: 'Externo' },
] as const;

const OPCIONES_VARIANTE_BEEBLACK = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'EXTERNO', label: 'Externo' },
] as const;

const BEEBLACK_TOGGLE_FIELD: Record<keyof TogglesBeeblack, keyof Pano> = {
  manillaIzq: 'beeblackManillaIzq',
  manillaDer: 'beeblackManillaDer',
  sepIzq: 'separadorIzq',
  sepDer: 'separadorDer',
  sepSup: 'separadorSup',
  sepInf: 'separadorInf',
};

// Separadores del BEEBLACK (E41/E42/E43): opt-in por lado, la medida la hereda
// del perfil de ese lado (laterales → alto, superior/inferior → ancho).
const BEEBLACK_SEPARADORES: Array<{
  key: 'sepIzq' | 'sepDer' | 'sepSup' | 'sepInf';
  label: string;
  cm: keyof Pano;
  columna: string;
}> = [
  { key: 'sepSup', label: 'Separador superior', cm: 'separadorSupCm', columna: 'SEPARADOR SUPERIOR' },
  { key: 'sepInf', label: 'Separador base', cm: 'separadorInfCm', columna: 'SEPARADOR BASE' },
  { key: 'sepIzq', label: 'Separador izquierdo', cm: 'separadorIzqCm', columna: 'SEPARADOR (IZQ)' },
  { key: 'sepDer', label: 'Separador derecho', cm: 'separadorDerCm', columna: 'SEPARADOR (DER)' },
];

const BEEBLACK_MANILLA_MEDIDA_FIELD: Record<'manillaIzq' | 'manillaDer', keyof Pano> = {
  manillaIzq: 'beeblackManillaIzqCm',
  manillaDer: 'beeblackManillaDerCm',
};

const BEEBLACK_FIJO_ROWS: Array<{
  key: keyof import('@/modules/descuentos/reglas-beeblack').MedidasBeeblack;
  label: string;
  field: keyof Pano;
  calcKey: Parameters<typeof medidaComponenteBeeblack>[1];
}> = [
  { key: 'perfilSupAncho', label: 'Perfil superior (ancho)', field: 'beeblackPerfilSupAnchoCm', calcKey: 'perfilSupAncho' },
  { key: 'perfilInfAncho', label: 'Perfil inferior (ancho)', field: 'beeblackPerfilInfAnchoCm', calcKey: 'perfilInfAncho' },
  { key: 'perfilLatIzq', label: 'Perfil lateral izq (alto)', field: 'beeblackPerfilLatIzqCm', calcKey: 'perfilLatIzq' },
  { key: 'perfilLatDer', label: 'Perfil lateral der (alto)', field: 'beeblackPerfilLatDerCm', calcKey: 'perfilLatDer' },
  { key: 'anchoTela', label: 'Ancho tela', field: 'beeblackAnchoTelaCm', calcKey: 'anchoTela' },
  { key: 'altoTela', label: 'Alto tela', field: 'beeblackAltoTelaCm', calcKey: 'altoTela' },
  { key: 'totalLamas', label: 'Total lamas (unidades)', field: 'beeblackTotalLamasCm', calcKey: 'totalLamas' },
];

export function PanoEditor({
  pano,
  onChange,
  panoNum,
  cadenas = [],
  pesos = [],
  opcionesMecanismo = OPCIONES_MECANISMO,
  opcionesTuberia = OPCIONES_TUBERIA,
  mecanismoFijoNota,
  ocultarMecanismo = false,
  categoria,
  colorVentana,
  sentidoVentana,
  varianteVentana,
  direccionVentana,
  adicionalesFase0,
  anchoRollo = 2.98,
  formulas = FORMULAS_DEFAULT,
  reglas = REGLAS_SELECCION_DEFAULT,
}: Props) {
  const cadenasDisponibles = cadenasRoller(cadenas, {}, reglas.cadenas);
  const pesosDisponibles = pesosSeleccionables(pesos);

  // Colores del catálogo (Admin puede agregar los suyos). Cada selector ofrece
  // los de SU uso, más el valor guardado si el color ya se retiró: una OT vieja
  // nunca pierde su botón, igual que con los chips de mecanismo legacy.
  const coloresAcc = opcionesColorConGuardado(
    coloresParaUso('accesorio', reglas.colores),
    colorAccesorioCorto(colorAccesoriosDePano(pano, colorVentana)),
  );
  const coloresManilla = opcionesColorConGuardado(
    coloresParaUso('manilla', reglas.colores),
    pano.manillaColor as string,
  );
  const coloresTapaOvalada = opcionesColorConGuardado(
    coloresParaUso('tapaOvalada', reglas.colores),
    pano.colorTapa as string,
  );
  const coloresTapaCuadrada = opcionesColorConGuardado(
    coloresParaUso('tapaCuadrada', reglas.colores),
    pano.colorTapa as string,
  );

  // Corte invertido (rotado): se auto-sugiere cuando la cortina + borde (4 cm)
  // no entra en el ancho del rollo. El flag explícito del usuario manda.
  const anchoPanoM = parseFloat(String(pano.ancho)) || 0;
  const debeInvertir = debeInvertirPano(anchoPanoM, anchoRollo);
  const invertida = pano.invertida ?? debeInvertir;
  // Cantidad auto de suplementos (roller 2 / cenefa 1 por bracket); editable.
  const suplementoAuto = cantidadSuplementosAuto(pano, categoria, anchoPanoM);

  // ── Sistema de oscuridad (Soft Light / Oscuranti / Dark) ──
  // El diámetro sale del tubo YA elegido en el paño (chip): un soft light 38 mm
  // con tubo E78 (banda 2,2–3,0 m) muestra el corte de tubo de 45 mm, igual que
  // el despiece del Excel/Cálculo General.
  const familia = familiaOscuridadConDiametro(
    categoria,
    pano.cenefa,
    diametroDeCodigoTubo(codigoTuberiaDeChip(pano.tuberia as string), reglas.tuberia),
    reglas.tipos,
  );
  // La variante sale del paño → de la ventana (Fase 1). El `sentidoVentana` queda
  // como último recurso solo para OTs viejas donde la variante viajaba en la caída.
  const varianteOscuridad: VarianteOscuridad = normalizarVarianteOscuridad(
    pano.oscuridadVariante ?? varianteVentana ?? sentidoVentana,
    'INTERNO',
  );
  const anchoCmOsc = (parseFloat(String(pano.ancho ?? 0)) || 0) * 100;
  const altoCmOsc = (parseFloat(String(pano.alto ?? 0)) || 0) * 100;
  const perfilesOsc: PerfilesOscuridad = {
    izqMuro: !!pano.perfilIzqMuro,
    izqPiso: !!pano.perfilIzqPiso,
    izqMarco: !!pano.perfilIzqMarco,
    derMuro: !!pano.perfilDerMuro,
    derPiso: !!pano.perfilDerPiso,
    derMarco: !!pano.perfilDerMarco,
    infMuro: !!pano.perfilInfMuro,
    infPiso: !!pano.perfilInfPiso,
    infMarco: !!pano.perfilInfMarco,
    izqActivo: !!pano.perfilIzqActivo,
    derActivo: !!pano.perfilDerActivo,
    infActivo: !!pano.perfilInfActivo,
    izqPerf: normalizarPerforacion(pano.perfilIzqPerf),
    derPerf: normalizarPerforacion(pano.perfilDerPerf),
    infPerf: normalizarPerforacion(pano.perfilInfPerf),
    infMontaje: normalizarMontajeBase(pano.perfilInfMontaje),
    sepIzq: !!pano.separadorIzq,
    sepDer: !!pano.separadorDer,
    sepInf: !!pano.separadorInf,
  };
  // Overrides de medida (perfiles + separadores) para que la vista previa calce
  // con el Excel/despiece (los separadores derivan su medida del perfil del lado).
  const medidasOsc: MedidasPerfilesOscuridad = {
    izqMuro: pano.perfilIzqMuroCm,
    izqPiso: pano.perfilIzqPisoCm,
    izqMarco: pano.perfilIzqMarcoCm,
    derMuro: pano.perfilDerMuroCm,
    derPiso: pano.perfilDerPisoCm,
    derMarco: pano.perfilDerMarcoCm,
    infMuro: pano.perfilInfMuroCm,
    infPiso: pano.perfilInfPisoCm,
    infMarco: pano.perfilInfMarcoCm,
    sepIzq: pano.separadorIzqCm,
    sepDer: pano.separadorDerCm,
    sepInf: pano.separadorInfCm,
  };
  // Efectivo con defaults de la variante (laterales activos + perforación) — el
  // mismo criterio que el despiece, para que la UI muestre lo que sale en el Excel.
  const perfilesOscEff = aplicarDefaultsPerfiles(perfilesOsc, familia, varianteOscuridad);
  // Montaje del perfil base (soft light INTERNO/EXTERNO): dentro de laterales
  // (default) o pared a pared. SEMI no tiene selector (es siempre pared a pared).
  const montajeBase = normalizarMontajeBase(pano.perfilInfMontaje) ?? 'DENTRO';
  const mostrarMontajeBase = montajeBaseDisponible(familia, varianteOscuridad);
  // Soft light SEMI: el perfil base va SIEMPRE con perforación EXTERNA (fija).
  const perfBaseSemiForzada =
    !!familia && esFamiliaSoftLight(familia) && varianteOscuridad === 'SEMI';
  // Color de accesorios (mismo resolutor que producción): el tubo del soft light
  // 45 mm negro se corta distinto (cenefa − 2,9 en vez de − 3,1).
  const colorAccesoriosRaw = colorAccesoriosDePano(pano, colorVentana);
  const cortesOsc = familia
    ? cortesOscuridad(familia, varianteOscuridad, anchoCmOsc, altoCmOsc, perfilesOscEff, medidasOsc, colorAccesoriosRaw, formulas.oscuridad)
    : [];
  const componentesOsc = cortesOsc.filter((c) => !c.perfil);
  const colorPesoInfOscuridad = familia
    ? colorPesoInfOscuridadExcel(pano.colorPeso || pano.color)
    : '';

  // ── BEEBLACK ──
  const esBeeblack = esCategoriaBeeblack(categoria);
  // Color que resuelve los códigos de perfil/riel del beeblack (mismo criterio
  // que el badge de los separadores).
  const colorPerfilBb = pano.color || colorVentana;
  // Dúo (día/noche): pide el cierre de altura medido en terreno.
  const esDuo = (categoria || '').toUpperCase().includes('DUO');

  // ── Gates por categoría (con escape: si hay dato guardado, se muestra) ──
  const catUpper = (categoria || '').toUpperCase();
  const esMotorCat = catUpper.includes('MOTOR');
  const esVerticalCat = catUpper.includes('VERTICAL');
  const categoriaImplicaOvalada = catUpper.includes('CENEFA_OVALADA');
  // Color de accesorios único (Medidas): el mismo resolutor que producción.
  const colorAccesorios = colorAccesorioCorto(colorAccesoriosRaw);
  // Cierre Vertical/Medio solo aplica a VERTICAL; el resto ve Izq/Der
  // (más el valor guardado de OTs viejas, para no esconderlo).
  const opcionesCierre = esVerticalCat
    ? OPCIONES_CIERRE_VERT
    : OPCIONES_CIERRE_VERT.filter(
        (o) => o === 'Izquierda' || o === 'Derecha' || o === pano.cierreVert,
      );
  // Cenefa fija Ovalada cuando la categoría la implica (salvo dato legacy distinto).
  const cenefaFijaOvalada =
    categoriaImplicaOvalada && !esCenefaCuadrada(pano.cenefa);
  // F15: el motor DOM41 no se usa con cenefa ovalada (se cae a DOM38).
  const cenefaEsOvalada = pano.cenefa === 'Ovalada' || cenefaFijaOvalada;
  const opcionesMotorModelo = cenefaEsOvalada
    ? OPCIONES_MOTOR_MODELO.filter((o) => o.value !== 'DOM41')
    : OPCIONES_MOTOR_MODELO;
  // Cargador/hub del motor: opciones según el motor EFECTIVO (DOM41 con cenefa
  // ovalada cae a DOM38). Default 'No lleva' — no todos los motores llevan hub.
  // Un cargador guardado que no está en las opciones del modelo (cambio de motor)
  // se agrega como opción extra para no esconder el dato ni desalinear el kit.
  const motorModeloEfectivo =
    (pano.motorModelo || '').toUpperCase() === 'DOM41' && cenefaEsOvalada
      ? 'DOM38'
      : (pano.motorModelo || '').toUpperCase();
  const cargadorGuardado = (pano.motorCargador || '').toUpperCase();
  const opcionesCargadorBase =
    motorModeloEfectivo === 'DOM38' ? OPCIONES_CARGADOR_DOM38 : OPCIONES_CARGADOR_DOM41;
  const opcionesCargador: readonly { value: string; label: string }[] =
    LABEL_CARGADOR[cargadorGuardado] && !opcionesCargadorBase.some((o) => o.value === cargadorGuardado)
      ? [...opcionesCargadorBase, { value: cargadorGuardado, label: LABEL_CARGADOR[cargadorGuardado] }]
      : opcionesCargadorBase;
  const cargadorValue = opcionesCargador.some((o) => o.value === cargadorGuardado)
    ? cargadorGuardado
    : 'NINGUNO';
  // OTs viejas guardan 'Cuadrada' a secas: se muestra como chip extra para
  // no esconder el dato (al elegir muro/techo queda con el valor nuevo).
  const opcionesCenefa =
    pano.cenefa && esCenefaCuadrada(pano.cenefa) && !OPCIONES_CENEFA.includes(pano.cenefa as never)
      ? [...OPCIONES_CENEFA, pano.cenefa]
      : OPCIONES_CENEFA;
  const varianteBeeblack: VarianteBeeblack = normalizarVarianteBeeblack(
    pano.beeblackVariante ?? sentidoVentana,
    'INTERNO',
  );
  // Tipo de instalación: solo EXTERNO tiene dos opciones (techo a muro / fuera
  // del marco, que corta los laterales 1 cm más largos). Se canoniza contra la
  // variante, así un cambio de variante nunca deja una instalación imposible.
  const instalacionBeeblack = normalizarInstalacionBeeblack(
    pano.beeblackInstalacion,
    varianteBeeblack,
  );
  const opcionesInstalacionBb = INSTALACIONES_BEEBLACK[varianteBeeblack];
  const anchoCmBb = (parseFloat(String(pano.ancho ?? 0)) || 0) * 100;
  const altoCmBb = (parseFloat(String(pano.alto ?? 0)) || 0) * 100;
  const togglesBeeblack: TogglesBeeblack = {
    manillaIzq: pano.beeblackManillaIzq,
    manillaDer: pano.beeblackManillaDer,
    sepIzq: pano.separadorIzq,
    sepDer: pano.separadorDer,
    sepSup: pano.separadorSup,
    sepInf: pano.separadorInf,
  };
  const overridesBeeblack = {
    perfilSupAncho: pano.beeblackPerfilSupAnchoCm,
    perfilInfAncho: pano.beeblackPerfilInfAnchoCm,
    perfilLatIzq: pano.beeblackPerfilLatIzqCm,
    perfilLatDer: pano.beeblackPerfilLatDerCm,
    manillaIzq: pano.beeblackManillaIzqCm,
    manillaDer: pano.beeblackManillaDerCm,
    anchoTela: pano.beeblackAnchoTelaCm,
    altoTela: pano.beeblackAltoTelaCm,
    totalLamas: pano.beeblackTotalLamasCm,
    sepIzq: pano.separadorIzqCm,
    sepDer: pano.separadorDerCm,
    sepSup: pano.separadorSupCm,
    sepInf: pano.separadorInfCm,
  };
  // Cierre DE ARRIBA ABAJO: la cortina va girada 90° y ancho/alto cambian de
  // papel en todas las fórmulas (el preview de abajo ya sale invertido).
  const cierreVerticalBb = esCierreVerticalBeeblack(direccionVentana);
  const componentesBb =
    esBeeblack && anchoCmBb > 0 && altoCmBb > 0
      ? cortesBeeblack(
          varianteBeeblack,
          anchoCmBb,
          altoCmBb,
          togglesBeeblack,
          overridesBeeblack,
          cierreVerticalBb,
          instalacionBeeblack,
          formulas.beeblack,
        )
      : [];
  return (
    <div className="space-y-3">
      {/* 0. MEDIDAS */}
      <Section title={`Medidas — Paño ${panoNum}`}>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Ancho (m)</Label>
            <Input
              type="number"
              step="0.01"
              value={pano.ancho as string | number}
              onChange={(e) => onChange({ ancho: e.target.value })}
              placeholder="1.50"
            />
          </div>
          <div>
            <Label>Alto (m)</Label>
            <Input
              type="number"
              step="0.01"
              value={pano.alto as string | number}
              onChange={(e) => onChange({ alto: e.target.value })}
              placeholder="2.40"
            />
          </div>
          <div>
            <Label>Color accesorios</Label>
            {/* Control ÚNICO de color: escribe de una vez los 4 campos que
                leen los consumidores (mecanismo/cadena/peso/tela). */}
            <div className="pt-1.5">
              <RadioRow
                label=""
                value={colorAccesorios}
                options={coloresAcc}
                onChange={(v) =>
                  onChange({ color: v, colorMecanismo: v, colorCadena: v, colorPeso: v })
                }
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            label="Corte invertido (rotado)"
            checked={invertida}
            onChange={(v) => onChange({ invertida: v })}
          />
          {debeInvertir && pano.invertida === undefined && (
            <span className="text-[0.7rem] text-amber-500">
              auto: no entra normal en el rollo ({anchoRollo.toFixed(2)} m)
            </span>
          )}
          {pano.invertida === false && debeInvertir && (
            <span className="text-[0.7rem] text-destructive">
              ¡no entra normal! confirma que esta tela no se puede rotar
            </span>
          )}
        </div>
      </Section>

      {/* 1. ARMADO */}
      <Section title="Armado y tela">
        <RadioRow
          label="Armado"
          value={pano.armado || ''}
          options={OPCIONES_ARMADO}
          onChange={(v) => onChange({ armado: v })}
        />
        <RadioRow
          label="Tipo tela"
          value={pano.tipoTela || ''}
          options={OPCIONES_TIPO_TELA}
          onChange={(v) => onChange({ tipoTela: v })}
        />
        {esDuo && (
          /* Dúo: cierre de altura medido en terreno por el vendedor — va en
             la etiqueta de estructura y en la hoja de cálculo general. */
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">
              Cierre de altura (cm)
            </span>
            <Input
              type="number"
              min={0}
              step={0.1}
              className="h-7 w-28 text-[0.72rem]"
              value={String(pano.cierreAlturaCm ?? '')}
              onChange={(e) =>
                onChange({ cierreAlturaCm: e.target.value === '' ? undefined : e.target.value })
              }
              placeholder="cm"
            />
            {!(parseFloat(String(pano.cierreAlturaCm ?? '')) > 0) &&
              (pano.alturaCierre ? (
                <span className="text-[0.7rem] text-muted-foreground">
                  terreno (texto viejo): {pano.alturaCierre}
                </span>
              ) : (
                <span className="text-[0.7rem] text-amber-500">
                  falta el cierre (lo mide el vendedor en terreno)
                </span>
              ))}
          </div>
        )}
      </Section>

      {/* 2. CADENA — la vertical no lleva cadena roller (usa su propio peso de
          cadena VER, que se lista en la hoja de inventario); conserva solo el
          Cierre (que sí aplica: es el lado de accionamiento de las lamas). */}
      <Section title="Cadena">
        {!esVerticalCat &&
          (cadenasDisponibles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Cadena</span>
              <select
                className="flex-1 min-w-[200px] rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
                value={pano.codCadena || ''}
                onChange={(e) => {
                  const cod = e.target.value;
                  if (!cod) {
                    onChange({ codCadena: '', largoCadena: '', colorCadena: '' });
                    return;
                  }
                  const { largoCadena, colorCadena } = derivarLargoColor(cod, cadenas, reglas.cadenas);
                  onChange({ codCadena: cod, largoCadena, colorCadena });
                }}
              >
                <option value="">— Sin cadena —</option>
                {cadenasDisponibles.map((c) => (
                  <option key={c.cod} value={c.cod as string}>
                    {etiquetaCadena(c)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <RadioRow
              label="Largo"
              value={String(pano.largoCadena || '')}
              options={OPCIONES_LARGO_CADENA}
              onChange={(v) => onChange({ largoCadena: v })}
            />
          ))}
        <RadioRow
          label="Cierre"
          value={pano.cierreVert || ''}
          options={opcionesCierre}
          onChange={(v) => onChange({ cierreVert: v })}
        />
      </Section>

      {/* 2b. PESO DE CADENA — no aplica a la vertical (lleva su peso VER propio). */}
      {!esVerticalCat && pesosDisponibles.length > 0 && (
        <Section title="Peso de cadena">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Peso</span>
            <select
              className="flex-1 min-w-[200px] rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
              value={pano.codPeso || ''}
              onChange={(e) => onChange({ codPeso: e.target.value })}
            >
              <option value="">— Sin peso —</option>
              {pesosDisponibles.map((c) => (
                <option key={c.cod} value={c.cod as string}>
                  {etiquetaCadena(c)}
                </option>
              ))}
            </select>
          </div>
        </Section>
      )}

      {/* 3. MANILLA */}
      <Section title="Manilla">
        <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0}
              value={pano.manillaCant ?? 0}
              onChange={(e) => onChange({ manillaCant: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <RadioRow
            label="Color"
            value={pano.manillaColor || ''}
            options={coloresManilla}
            onChange={(v) => onChange({ manillaColor: v })}
          />
        </div>
      </Section>

      {/* 4. COLORES ACCESORIOS (detalle por pieza; el control único de
          "Color accesorios" de arriba pinta los tres de una vez). */}
      <Section title="Colores accesorios">
        {/* La vertical no elige peso ni cadena de roller: su peso es el VER52/
            VER64 del kit y su cadena es la de 3 m que fija el color de
            accesorios. Mostrar estos radios solo confundía (la sección
            "Cadena" y el bloque de peso ya están ocultos para vertical). */}
        {!esVerticalCat && (
          <RadioRow
            label="Peso inf."
            value={pano.colorPeso || ''}
            options={coloresAcc}
            onChange={(v) => onChange({ colorPeso: v })}
          />
        )}
        {!esVerticalCat && (
          <RadioRow
            label="Cadena"
            value={pano.colorCadena || ''}
            options={coloresAcc}
            onChange={(v) => onChange({ colorCadena: v })}
          />
        )}
        <RadioRow
          label="Mecanismo"
          value={pano.colorMecanismo || ''}
          options={coloresAcc}
          onChange={(v) => onChange({ colorMecanismo: v })}
        />
      </Section>

      {/* 5. CENEFA */}
      <Section title="Cenefa">
        {cenefaFijaOvalada ? (
          /* La categoría ya trae la cenefa ovalada: no se elige el tipo. */
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Tipo</span>
            <span className="rounded border border-accent/50 bg-accent/20 px-2 py-1 text-[0.7rem] text-accent">
              Ovalada — fija por categoría
            </span>
          </div>
        ) : (
          <RadioRow
            label="Tipo"
            value={pano.cenefa || 'No'}
            options={opcionesCenefa}
            onChange={(v) =>
              onChange({
                cenefa: v,
                // Ovalada arranca CON TIRA por default; el resto sin tira.
                cenefaTira: v === 'Ovalada' ? 'CON TIRA' : 'SIN TIRA',
              })
            }
          />
        )}
        {(pano.cenefa === 'Ovalada' || cenefaFijaOvalada) && (
          <>
            <RadioRow
              label="Tira"
              value={pano.cenefaTira || (cenefaEsOvalada ? 'CON TIRA' : 'SIN TIRA')}
              options={OPCIONES_CENEFA_TIRA}
              onChange={(v) => onChange({ cenefaTira: v })}
            />
            <RadioRow
              label="Color tapa"
              value={pano.colorTapa || ''}
              options={coloresTapaOvalada}
              onChange={(v) => onChange({ colorTapa: v })}
            />
            <RadioRow
              label="Bracket"
              value={pano.bracketTipo || 'CORTO'}
              options={OPCIONES_BRACKET_TIPO}
              onChange={(v) => onChange({ bracketTipo: v })}
            />
          </>
        )}
        {/* Soft light con cenefa CUADRADA (familias SOFT_LIGHT_CC / _CC_45): las
            tapas son fijas (2, color de accesorios), como DARK → no se ofrecen los
            selectores. Las cenefas cuadradas de roller/vertical sí los muestran. */}
        {esCenefaCuadrada(pano.cenefa) && !(familia && esFamiliaSoftLightCC(familia)) && (
          <>
            <RadioRow
              label="Tapas"
              value={!pano.cenefaTapa || pano.cenefaTapa === 'SIN_TAPA' ? 'MURO_MURO' : pano.cenefaTapa}
              options={OPCIONES_CENEFA_TAPA}
              onChange={(v) => onChange({ cenefaTapa: v })}
            />
            <RadioRow
              label="Color tapa"
              value={pano.colorTapa || ''}
              options={coloresTapaCuadrada}
              onChange={(v) => onChange({ colorTapa: v })}
            />
          </>
        )}
      </Section>

      {/* 5a. MATERIAL DE INSTALACIÓN — tipo de muro (define tarugos de vulcanita)
          y posición (techo/pared, cambia los tarugos de la cenefa ovalada). */}
      <Section title="Material de instalación">
        <RadioRow
          label="Tipo"
          value={pano.materialTipo || ''}
          options={OPCIONES_MATERIAL_TIPO}
          onChange={(v) => onChange({ materialTipo: v })}
        />
        <RadioRow
          label="Posición"
          value={pano.superficie || ''}
          options={OPCIONES_SUPERFICIE}
          onChange={(v) => onChange({ superficie: v })}
        />
      </Section>

      {/* 5a-bis. SUPLEMENTOS — opcional; cantidad auto (roller 2 / cenefa 1 por bracket). */}
      <Section title="Suplementos">
        <RadioRow
          label="Tipo"
          value={pano.suplementoTipo || ''}
          options={OPCIONES_SUPLEMENTO as unknown as readonly { value: string; label: string }[]}
          onChange={(v) => onChange({ suplementoTipo: v })}
        />
        {pano.suplementoTipo && (
          <div className="flex items-end gap-2">
            <div className="max-w-[150px]">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={0}
                value={pano.suplementoCant ?? suplementoAuto}
                onChange={(e) => onChange({ suplementoCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            {typeof pano.suplementoCant === 'number' && (
              <button
                type="button"
                onClick={() => onChange({ suplementoCant: undefined })}
                className="mb-2 text-[0.7rem] text-muted-foreground hover:text-foreground"
                title={`Auto: ${suplementoAuto}`}
              >
                ↺ auto
              </button>
            )}
          </div>
        )}
      </Section>

      {/* 5b. SISTEMA DE OSCURIDAD (Soft Light / Oscuranti / Dark) */}
      {familia && (
        <Section title="Sistema de oscuridad — perfiles">
          <RadioRow
            label="Instalación"
            value={varianteOscuridad}
            options={OPCIONES_VARIANTE_OSCURIDAD as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ oscuridadVariante: v || 'INTERNO' })}
          />
          {componentesOsc.length > 0 && (
            <div className="rounded border border-border/60 bg-background/40 p-2 text-[0.7rem]">
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Medidas de corte (cm)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {componentesOsc.map((c) => (
                  <div key={c.componente} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{c.componente}</span>
                    <span className="font-mono text-foreground">{c.medidaCm}</span>
                  </div>
                ))}
                {colorPesoInfOscuridad && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Color peso inf.</span>
                    <span className="font-mono text-foreground">{colorPesoInfOscuridad}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1">
            {PERFILES_LADO.map((L) => {
              const activo = !!perfilesOscEff[`${L.side}Activo` as keyof PerfilesOscuridad];
              const superficie = pano[L.muro] ? 'muro' : pano[L.piso] ? 'piso' : pano[L.marco] ? 'marco' : '';
              const perf =
                (perfilesOscEff[`${L.side}Perf` as keyof PerfilesOscuridad] as PerforacionPerfil | undefined) ?? '';
              // Soft light SEMI: la perforación del perfil base es fija EXTERNA.
              const perfBaseForzada = L.side === 'inf' && perfBaseSemiForzada;
              const perfEfectiva: PerforacionPerfil | '' = perfBaseForzada ? 'EXTERNO' : perf;
              // Medida según la superficie elegida (muro = alto+10; piso y marco = alto).
              // El perfil base soft light INTERNO además depende del montaje.
              const surfaceKey: SuperficiePerfilKey =
                superficie === 'piso' ? L.pisoKey : superficie === 'marco' ? L.marcoKey : L.muroKey;
              const medida = superficie
                ? medidaPerfilOscuridad(
                    familia,
                    varianteOscuridad,
                    surfaceKey,
                    anchoCmOsc,
                    altoCmOsc,
                    L.side === 'inf' ? montajeBase : undefined,
                    formulas.oscuridad,
                  )
                : 0;
              const overrideField =
                superficie === 'piso' ? L.pisoCm : superficie === 'marco' ? L.marcoCm : L.muroCm;
              const override = superficie ? (pano[overrideField] as number | undefined) : undefined;
              const colorPerfil = colorPerfilDesdeAdicional(L.tipoAdic, adicionalesFase0, categoria);
              // Elegir superficie: marca una (muro/piso/marco) y limpia las otras + sus
              // overrides; activa el perfil. "Marco" solo se ofrece en INTERNO. Un
              // LATERAL a piso apaga además el perfil base (llega hasta el suelo).
              const setSuperficie = (s: string) =>
                onChange(parcheSuperficiePerfil(L.side, s as SuperficiePerfilOscuridad));
              return (
                <div key={L.side} className="rounded border border-border/60 bg-card/40 px-2 py-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[0.72rem] text-foreground">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) =>
                          onChange({
                            [L.activo]: e.target.checked,
                            // Al desactivar, limpia superficie/override para que no
                            // reaparezca una medida vieja.
                            ...(e.target.checked
                              ? {}
                              : {
                                  [L.muro]: false,
                                  [L.piso]: false,
                                  [L.marco]: false,
                                  [L.muroCm]: undefined,
                                  [L.pisoCm]: undefined,
                                  [L.marcoCm]: undefined,
                                }),
                          } as Partial<Pano>)
                        }
                      />
                      {L.label}
                    </label>
                    {colorPerfil && (
                      <span
                        className={cn(
                          'text-[0.62rem] uppercase tracking-wide',
                          activo ? 'text-muted-foreground' : 'text-muted-foreground/40',
                        )}
                        title="Color desde adicionales Fase 0"
                      >
                        {colorPerfil}
                      </span>
                    )}
                  </div>
                  {activo && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[0.68rem]">
                      {/* Perforación INT/EXT (anotación de taller). Soft light SEMI:
                          el perfil base es EXT fija (chip estático, no editable). */}
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Perf.</span>
                        {perfBaseForzada ? (
                          <span
                            className="rounded bg-primary/80 px-1.5 py-0.5 text-[0.66rem] uppercase text-primary-foreground"
                            title="Soft light SEMI: perforación del perfil base fija en Externa"
                          >
                            Ext (fija)
                          </span>
                        ) : (
                          OPCIONES_PERFORACION.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => onChange({ [L.perf]: o.value } as Partial<Pano>)}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[0.66rem] uppercase',
                                perf === o.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o.label}
                            </button>
                          ))
                        )}
                      </div>
                      {/* Instalación muro/piso/marco → medida. "Dentro del marco"
                          solo en sistemas INTERNOS (o si ya venía seleccionada). */}
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Inst.</span>
                        {OPCIONES_SUPERFICIE_PERFIL.filter(
                          (o) => !o.soloInterno || varianteOscuridad === 'INTERNO' || superficie === o.value,
                        ).map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setSuperficie(o.value)}
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[0.66rem]',
                              superficie === o.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      {/* Montaje del perfil base (soft light INTERNO/EXTERNO):
                          dentro de laterales o pared a pared. SEMI no lo muestra. */}
                      {L.side === 'inf' && mostrarMontajeBase && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Base</span>
                          {OPCIONES_MONTAJE_BASE.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => onChange({ perfilInfMontaje: o.value } as Partial<Pano>)}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[0.66rem]',
                                montajeBase === o.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Medida (calculada + override cm) */}
                      {superficie ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={typeof override === 'number' ? override : medida > 0 ? medida : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v = raw === '' ? undefined : parseFloat(raw);
                              onChange({ [overrideField]: Number.isFinite(v as number) ? v : undefined } as Partial<Pano>);
                            }}
                            className={cn(
                              'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.7rem] text-foreground',
                              typeof override === 'number' ? 'border-amber-500/60' : 'border-border',
                            )}
                            title={typeof override === 'number' ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
                          />
                          <span className="text-muted-foreground">cm</span>
                        </div>
                      ) : (
                        <span className="text-amber-500">definir instalación</span>
                      )}
                      {!perfEfectiva && <span className="text-amber-500">definir perforación</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Perfiles SEPARADORES (E41/E42/E43) — para todo sistema de oscuridad.
              Se activan por lado; la medida sale del perfil del mismo lado salvo
              que el vendedor ingrese una medida especial. */}
          <div className="space-y-1">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Perfiles separadores
            </div>
            {PERFILES_LADO.map((L) => {
              const activo = !!pano[L.sepActivo];
              const corte = cortesOsc.find((c) => c.columnaExcel === L.sepColumna);
              const override = pano[L.sepCm] as number | undefined;
              const pendiente = !corte || corte.pendienteMedida;
              const medida = corte && !corte.pendienteMedida ? corte.medidaCm : 0;
              const colorPerfil = colorPerfilDesdeAdicional(L.tipoAdic, adicionalesFase0, categoria);
              const codigoSep = codigoSeparadorPerfil(colorPerfil);
              const sepLabel = L.label.replace('Perfil', 'Separador');
              return (
                <div key={L.side} className="rounded border border-border/60 bg-card/40 px-2 py-1.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[0.72rem] text-foreground">
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={(e) =>
                          onChange({
                            [L.sepActivo]: e.target.checked,
                            ...(e.target.checked ? {} : { [L.sepCm]: undefined }),
                          } as Partial<Pano>)
                        }
                      />
                      {sepLabel}
                    </label>
                    {codigoSep && (
                      <span
                        className={cn(
                          'text-[0.62rem] uppercase tracking-wide',
                          activo ? 'text-muted-foreground' : 'text-muted-foreground/40',
                        )}
                        title="Código del separador según color del perfil"
                      >
                        {codigoSep}
                      </span>
                    )}
                  </div>
                  {activo && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[0.68rem]">
                      {pendiente && typeof override !== 'number' ? (
                        <span className="text-amber-500">definir medida (o activar el perfil del lado)</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={typeof override === 'number' ? override : medida > 0 ? medida : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v = raw === '' ? undefined : parseFloat(raw);
                              onChange({ [L.sepCm]: Number.isFinite(v as number) ? v : undefined } as Partial<Pano>);
                            }}
                            className={cn(
                              'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.7rem] text-foreground',
                              typeof override === 'number' ? 'border-amber-500/60' : 'border-border',
                            )}
                            title={typeof override === 'number' ? `Del perfil: ${medida}` : 'Medida del perfil del lado (editable)'}
                          />
                          <span className="text-muted-foreground">cm</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 5c. BEEBLACK — cierre horizontal */}
      {esBeeblack && (
        <Section title="BEEBLACK — cierre horizontal">
          <RadioRow
            label="Variante"
            value={varianteBeeblack}
            options={OPCIONES_VARIANTE_BEEBLACK as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => {
              const nueva = normalizarVarianteBeeblack(v, 'INTERNO');
              onChange({
                beeblackVariante: nueva,
                // La instalación se reajusta sola: cada variante tiene su lista.
                beeblackInstalacion: normalizarInstalacionBeeblack(
                  pano.beeblackInstalacion,
                  nueva,
                ),
              });
            }}
          />
          {/* Tipo de instalación: INTERNO y SEMI tienen una sola posible (se
              muestra como dato); EXTERNO elige entre techo a muro y fuera del
              marco, que es lo único que cambia la medida de los laterales. */}
          {opcionesInstalacionBb.length > 1 ? (
            <RadioRow
              label="Instalación"
              value={instalacionBeeblack}
              options={opcionesInstalacionBb.map((i) => ({
                value: i,
                label: LABEL_INSTALACION_BEEBLACK[i],
              }))}
              onChange={(v) =>
                onChange({
                  beeblackInstalacion: normalizarInstalacionBeeblack(v, varianteBeeblack),
                })
              }
            />
          ) : (
            <div className="flex items-center gap-2 rounded border border-border/60 bg-card/40 px-2 py-1 text-[0.7rem]">
              <span className="text-muted-foreground">Instalación:</span>
              <span className="text-foreground">
                {LABEL_INSTALACION_BEEBLACK[instalacionBeeblack]}
              </span>
            </div>
          )}
          {direccionVentana && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border/60 bg-card/40 px-2 py-1 text-[0.7rem]">
              <span className="text-muted-foreground">
                Cierre: <span className="font-mono text-foreground">{direccionVentana}</span>
                {cierreVerticalBb && (
                  <span className="ml-1 text-amber-500">— gira 90°: lamas sobre el alto</span>
                )}
              </span>
            </div>
          )}
          {/* Doble = un beeblack con SCREEN + BLACKOUT: una sola estructura y dos
              telas (cada una con su manilla). Se marca en los dos paños; el 2º no
              repite perfiles ni manillas en la hoja de estructura. */}
          <label className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
            <span className="text-[0.72rem] text-foreground">
              Doble (screen + blackout)
              <span className="ml-1 text-muted-foreground">— una estructura, dos telas</span>
            </span>
            <input
              type="checkbox"
              checked={!!pano.dual}
              onChange={(e) => onChange({ dual: e.target.checked })}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          {componentesBb.length > 0 && (
            <div className="rounded border border-border/60 bg-background/40 p-2 text-[0.7rem]">
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Medidas de corte (cm)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {componentesBb.map((c) => (
                  <div key={c.componente} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{c.componente}</span>
                    <span className="font-mono text-foreground">{c.medidaCm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1">
            {BEEBLACK_FIJO_ROWS.map((row) => {
              const medida =
                anchoCmBb > 0 && altoCmBb > 0
                  ? medidaComponenteBeeblack(varianteBeeblack, row.calcKey, anchoCmBb, altoCmBb, cierreVerticalBb, instalacionBeeblack, formulas.beeblack)
                  : 0;
              const override = pano[row.field] as number | undefined;
              return (
                <MedidaEditableRow
                  key={row.key}
                  label={row.label}
                  medida={medida}
                  override={typeof override === 'number' ? override : undefined}
                  onMedidaChange={(v) => onChange({ [row.field]: v } as Partial<Pano>)}
                />
              );
            })}
          </div>
          {/* Manillas: opt-in en Fase 2. Un beeblack puede llevar 2 (screen +
              blackout: una manilla por tela). */}
          <div className="space-y-1">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Manillas
            </div>
            {TOGGLES_BEEBLACK.map((t) => {
              const field = BEEBLACK_TOGGLE_FIELD[t.key];
              const medidaField = BEEBLACK_MANILLA_MEDIDA_FIELD[t.key as 'manillaIzq' | 'manillaDer'];
              const medida =
                anchoCmBb > 0 && altoCmBb > 0
                  ? medidaComponenteBeeblack(varianteBeeblack, t.key as 'manillaIzq', anchoCmBb, altoCmBb, cierreVerticalBb, instalacionBeeblack, formulas.beeblack)
                  : 0;
              const override = pano[medidaField] as number | undefined;
              return (
                <PerfilToggle
                  key={t.key}
                  label={t.label}
                  medida={medida}
                  override={typeof override === 'number' ? override : undefined}
                  checked={!!pano[field]}
                  onToggle={(v) =>
                    onChange({
                      [field]: v,
                      ...(v ? {} : { [medidaField]: undefined }),
                    } as Partial<Pano>)
                  }
                  onMedidaChange={(v) => onChange({ [medidaField]: v } as Partial<Pano>)}
                />
              );
            })}
          </div>
          {/* Separadores (E41/E42/E43): opt-in por lado, misma lógica que en los
              sistemas de oscuridad — heredan la medida del perfil de ese lado. */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Perfiles separadores
              </div>
              {codigoSeparadorPerfil(pano.color || colorVentana) && (
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.62rem] text-muted-foreground">
                  {codigoSeparadorPerfil(pano.color || colorVentana)}
                </span>
              )}
            </div>
            {BEEBLACK_SEPARADORES.map((s) => {
              const corte = componentesBb.find((c) => c.columnaExcel === s.columna);
              const heredada = medidaComponenteBeeblack(
                varianteBeeblack,
                s.key === 'sepIzq' ? 'perfilLatIzq' : s.key === 'sepDer' ? 'perfilLatDer' : s.key === 'sepSup' ? 'perfilSupAncho' : 'perfilInfAncho',
                anchoCmBb,
                altoCmBb,
                cierreVerticalBb,
                instalacionBeeblack,
                formulas.beeblack,
              );
              const override = pano[s.cm] as number | undefined;
              return (
                <PerfilToggle
                  key={s.key}
                  label={s.label}
                  medida={corte?.medidaCm ?? (anchoCmBb > 0 && altoCmBb > 0 ? heredada : 0)}
                  override={typeof override === 'number' ? override : undefined}
                  checked={!!pano[BEEBLACK_TOGGLE_FIELD[s.key]]}
                  onToggle={(v) =>
                    onChange({
                      [BEEBLACK_TOGGLE_FIELD[s.key]]: v,
                      ...(v ? {} : { [s.cm]: undefined }),
                    } as Partial<Pano>)
                  }
                  onMedidaChange={(v) => onChange({ [s.cm]: v } as Partial<Pano>)}
                />
              );
            })}
          </div>
        </Section>
      )}

      {/* 8. ORDEN DOBLE — dúo, dual, o dato guardado de OT vieja. En dual el
          orden es inherente (2 telas): se oculta el checkbox "Es doble" y se
          muestra directo el selector (default SCR al vidrio). */}
      {(esDuo || pano.dual || pano.ordenDoble) && (
        <Section title="Orden doble (dual / duo)">
          {!pano.dual && (
            <Checkbox
              label="Es doble"
              checked={!!pano.ordenDoble}
              onChange={(v) => onChange({ ordenDoble: v })}
            />
          )}
          {(pano.dual || pano.ordenDoble) && (
            <RadioRow
              label="Orden"
              value={pano.ordenDobleOpcion || 'SCR_VID_BK'}
              options={OPCIONES_ORDEN_DOBLE as unknown as readonly { value: string; label: string }[]}
              onChange={(v) => onChange({ ordenDobleOpcion: v })}
            />
          )}
        </Section>
      )}

      {/* 9. MECANISMO — con selector de tipo Simple/Dual */}
      {!ocultarMecanismo && (
        <Section title="Mecanismo">
          <RadioRow
            label="Tipo"
            value={pano.dual ? 'DUAL' : 'SIMPLE'}
            options={OPCIONES_TIPO_MECANISMO as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ dual: v === 'DUAL' })}
          />
          {pano.dual && (
            <RadioRow
              label="Lado"
              value={pano.dualLado || ''}
              options={OPCIONES_DUAL_LADO}
              onChange={(v) => onChange({ dualLado: v })}
            />
          )}
          <RadioRow
            label=""
            value={pano.mecanismo || ''}
            options={opcionesMecanismo}
            onChange={(v) => onChange({ mecanismo: v })}
          />
          {mecanismoFijoNota && !pano.dual && (
            <p className="text-[0.7rem] text-amber-500">{mecanismoFijoNota}</p>
          )}
        </Section>
      )}

      {/* 11. MOTOR — modelo (todos inalámbricos hoy), domótica y adicionales.
          DOM41 no se ofrece con cenefa ovalada (regla F15). */}
      {(esMotorCat || !!pano.motorModelo || !!pano.motorTipo || !!pano.ladoMotor) && (
        <Section title="Motor">
          <RadioRow
            label="Modelo"
            value={pano.motorModelo || ''}
            options={opcionesMotorModelo as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ motorModelo: v })}
          />
          <RadioRow
            label="Domótica"
            value={pano.motorDomotica ? 'SI' : 'NO'}
            options={[{ value: 'NO', label: 'Sin domótica' }, { value: 'SI', label: 'Con domótica' }]}
            onChange={(v) => onChange({ motorDomotica: v === 'SI' })}
          />
          <RadioRow
            label="Cargador"
            value={cargadorValue}
            options={opcionesCargador}
            onChange={(v) => onChange({ motorCargador: v || 'NINGUNO' })}
          />
          <div className="flex flex-wrap items-end gap-4 pt-1">
            {/* El control NO es automático: el motor solo emite su unidad (y el
                cable DOM34 si es DOM38). Lo que se ponga acá es lo que se pide. */}
            <div className="max-w-[150px]">
              <Label>Controles</Label>
              <Input
                type="number"
                min={0}
                value={pano.motorControlAdicCant ?? 0}
                onChange={(e) => onChange({ motorControlAdicCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="max-w-[150px]">
              <Label>Hub USB adicionales</Label>
              <Input
                type="number"
                min={0}
                value={pano.motorHubUsbCant ?? 0}
                onChange={(e) => onChange({ motorHubUsbCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
          <RadioRow
            label="Lado motor"
            value={pano.ladoMotor || ''}
            options={OPCIONES_LADO_MOTOR}
            onChange={(v) => onChange({ ladoMotor: v })}
          />
        </Section>
      )}

      {/* 13. TUBERÍA — el BEEBLACK no lleva tubo: su estructura son los PERFILES
          (riel SML04/05/06 y agarraderas SML10/11/12, por color de accesorios),
          así que en su lugar se muestran esos códigos, sin selector. */}
      {esBeeblack ? (
        <Section title="Perfiles (no lleva tubería)">
          <div className="space-y-1">
            {[
              { label: 'Riel — perfiles sup./inf. y laterales', codigo: codigoPerfilBeeblack(colorPerfilBb) },
              { label: 'Agarradera — manillas', codigo: codigoManillaBeeblack(colorPerfilBb) },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1"
              >
                <span className="text-[0.72rem] text-foreground">{r.label}</span>
                <span className="rounded bg-card px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground">
                  {r.codigo || '—'}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : (
        <Section title="Tubería">
          <RadioRow
            label=""
            value={pano.tuberia || ''}
            options={opcionesTuberia}
            onChange={(v) => onChange({ tuberia: v })}
          />
        </Section>
      )}

      {/* 14. NOTAS DE TERRENO — agrupa retiro/material/cortes/comentarios.
          Colapsada por defecto; lo anotado sale en la hoja de INVENTARIO. */}
      <SeccionColapsable
        title="Notas de terreno"
        badge={tieneNotasTerreno(pano) ? 'con notas' : undefined}
      >
        <div className="max-w-[160px]">
          <Label>Retiro de cortinas</Label>
          <Input
            type="number"
            min={0}
            value={pano.retiro ?? 0}
            onChange={(e) => onChange({ retiro: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <RadioRow
          label="Cortes"
          value={pano.cortes || ''}
          options={OPCIONES_CORTES}
          onChange={(v) => onChange({ cortes: v })}
        />
        <Checkbox
          label="Ver video de terreno"
          checked={!!pano.verVideo}
          onChange={(v) => onChange({ verVideo: v })}
        />
        <RadioRow
          label="Relación marco"
          value={pano.relacionMarco || ''}
          options={OPCIONES_RELACION_MARCO}
          onChange={(v) => onChange({ relacionMarco: v })}
        />
        {/* Campo legado: solo se muestra si la OT ya lo traía escrito
            (el dato nuevo del dúo va en "Cierre de altura (cm)"). */}
        {!!pano.alturaCierre && (
          <div>
            <Label>Cerrada a altura de (texto viejo)</Label>
            <Input
              value={pano.alturaCierre || ''}
              onChange={(e) => onChange({ alturaCierre: e.target.value })}
              placeholder="Ej: 1.20m, ras de piso…"
            />
          </div>
        )}
        <div>
          <Label>Cotizar con y sin</Label>
          <Input
            value={pano.cotizarConSin || ''}
            onChange={(e) => onChange({ cotizarConSin: e.target.value })}
            placeholder="Ej: con cenefa, sin cenefa"
          />
        </div>
        <div>
          <Label>Suplementos</Label>
          <Input
            value={pano.suplementos || ''}
            onChange={(e) => onChange({ suplementos: e.target.value })}
          />
        </div>
        <div>
          <Label>Nota final</Label>
          <textarea
            rows={2}
            value={pano.comentarioFinal || ''}
            onChange={(e) => onChange({ comentarioFinal: e.target.value })}
            className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
          />
        </div>
      </SeccionColapsable>
    </div>
  );
}

/** ¿El paño tiene alguna nota de terreno anotada? (para el badge).
 *  superficie/materialTipo tienen su propia sección "Material de instalación". */
function tieneNotasTerreno(p: Pano): boolean {
  return !!(
    (p.retiro ?? 0) > 0 ||
    (p.cortes && p.cortes !== 'Nada') ||
    p.verVideo ||
    (p.relacionMarco && p.relacionMarco !== 'N/A') ||
    p.alturaCierre ||
    p.cotizarConSin ||
    p.suplementos ||
    p.comentarioFinal
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SeccionColapsable({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] normal-case tracking-normal text-amber-400">
              {badge}
            </span>
          )}
        </span>
        <span aria-hidden>{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

type StringOption = string | { value: string; label: string };

function RadioRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly StringOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          const active = value === val;
          return (
            <button
              type="button"
              key={val}
              onClick={() => onChange(active ? '' : val)}
              className={cn(
                'rounded border px-2 py-1 text-[0.7rem] transition-colors',
                active
                  ? 'border-accent/50 bg-accent/20 text-accent'
                  : 'border-border bg-card text-foreground hover:bg-card',
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MedidaEditableRow({
  label,
  medida,
  override,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          value={valorInput}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onMedidaChange(undefined);
            const n = parseFloat(raw);
            onMedidaChange(Number.isFinite(n) ? n : undefined);
          }}
          className={cn(
            'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
            editado ? 'border-amber-500/60' : 'border-border',
          )}
          title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
        />
        {editado && (
          <button
            type="button"
            onClick={() => onMedidaChange(undefined)}
            title={`Restablecer a ${medida}`}
            className="text-[0.7rem] text-muted-foreground hover:text-foreground"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

function PerfilToggle({
  label,
  medida,
  override,
  colorPerfil,
  checked,
  onToggle,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  colorPerfil?: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {colorPerfil && (
          <span
            className={cn(
              'min-w-[52px] text-center text-[0.65rem] uppercase tracking-wide',
              checked ? 'text-muted-foreground' : 'text-muted-foreground/40',
            )}
            title="Color desde adicionales Fase 0"
          >
            {colorPerfil}
          </span>
        )}
        {checked ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              value={valorInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return onMedidaChange(undefined);
                const n = parseFloat(raw);
                onMedidaChange(Number.isFinite(n) ? n : undefined);
              }}
              className={cn(
                'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
                editado ? 'border-amber-500/60' : 'border-border',
              )}
              title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
            />
            {editado && (
              <button
                type="button"
                onClick={() => onMedidaChange(undefined)}
                title={`Restablecer a ${medida}`}
                className="text-[0.7rem] text-muted-foreground hover:text-foreground"
              >
                ↺
              </button>
            )}
          </div>
        ) : (
          <span className="min-w-[48px] text-right font-mono text-[0.72rem] text-muted-foreground/40">
            {medida > 0 ? medida : '—'}
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(!checked)}
          aria-pressed={checked}
          className={cn(
            'w-12 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide transition-colors',
            checked
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-border bg-card text-muted-foreground hover:bg-card',
          )}
        >
          {checked ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-card accent-indigo-500"
      />
      {label}
    </label>
  );
}
