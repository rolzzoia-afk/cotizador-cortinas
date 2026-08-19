import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Palette, Pencil, Plus, RotateCw, Save, Trash2, Printer, Search, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';
import { useCatalogoProductos, useAnchoRollo } from '@/modules/cotizador/catalogo';
import { esCortinaTipo } from '@/modules/cotizador/flujoCatalogo';
import { claveCatalogoCanonica } from '@/modules/cotizador/importarCatalogo';
import { pendientesFase2, resumenPendientes } from '@/modules/cotizador/fase2-completitud';
import type { Ventana as VentanaFase2 } from '@/modules/cotizador/types';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  chipDualPorLadoColor,
  modeloDesdeChipMecanismo,
  modeloPorAncho,
  modeloVentanaPorAncho,
  resincronizarChipsPanos,
} from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';
import { categoriaEsDual, modelosParaCategoria } from '@/modules/descuentos/tipos';
import { otToRow } from '@/modules/ots/mappers';
import { useOT } from '@/modules/ots/hooks';
import { resolverNumeroOT } from '@/modules/ots/numeroOT';
import { puertoSupabaseNumeroOT } from '@/modules/ots/numeroOTStore';
import type { AdicionalFase0Persistido, OT, VentanaItem } from '@/modules/ots/types';
import {
  cotizarFase0,
  textoInstalacion,
  type LineaResultado,
  type AdicionalResultado,
} from '@/modules/cotizador/motorFase0';
import { formatCLP } from '@/modules/cotizador/calculos';
import { categoriasTela } from '@/modules/cotizador/categoriaTela';
import { categoriasDeVentanas } from '@/modules/cotizador/terminos';
import { useTerminos } from '@/modules/cotizador/terminosStore';
import { useLayoutDoc } from '@/modules/cotizador/docCotizacionStore';
import {
  bloquesEnFlujo,
  bloquesJuntoATotales,
  esSeccion,
  flotantesDe,
} from '@/modules/cotizador/docCotizacion';
import {
  dualLadoDesdeDireccion,
  enriquecerVentanaDesdeFase0,
  tipoTelaDesdeProducto,
} from '@/modules/cotizador/fase0-sync';
import { emparejarDualesFase0, esGrupoDobleTela } from '@/modules/cotizador/fase0-dual';
import {
  esCategoriaPletina,
  esCategoriaVertical,
  mecLineaB,
} from '@/modules/descuentos/reglas-mecanismo';
import { categoriaTieneLineaB, esLineaB, gamaTelaEsB } from '@/modules/cotizador/lineaB';
import { familiaOscuridad } from '@/modules/descuentos/reglas-oscuridad';
import { categoriasParaSelect, type TipoCortina } from '@/modules/descuentos/tiposCortina';
import { OPCIONES_MECANISMO_DUAL } from '@/modules/cotizador/fase2';
import { useReglasSeleccion } from '@/modules/descuentos/reglasSeleccionStore';
import { useFormulasFamilias } from '@/modules/descuentos/formulasStore';
import { useReglasPrecios } from '@/modules/cotizador/reglasPreciosStore';
import { codigosInstalacionAutomatica } from '@/modules/cotizador/reglasPrecios';
import { anchoEmpaquePeorCasoM } from '@/modules/cotizador/empaqueFase0';
import { derivarOpciones } from '@/modules/descuentos/reglasSeleccion';
import { debeInvertirPano, resolverAnchoRollo } from '@/modules/cotizador/tela';
import {
  agruparFilasPorVentana,
  construirPanosDeGrupo,
  explotarVentanasAFilas,
} from '@/modules/cotizador/fase0-reconcile';
import {
  derivarAdicionalesCenefaDesdeVentanas,
  filtrarDerivadosPorCupoManual,
} from '@/modules/descuentos/adicionales-cenefa';
import { PanelFamilia, nombresDePiezas } from '@/components/cotizador/DesglosePrecio';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProductoCatalogoDialog from '@/components/cotizador/ProductoCatalogoDialog';
import ChipsColoresDialog from '@/components/cotizador/ChipsColoresDialog';
import BloqueDocRender, { SeccionDocumento } from '@/components/cotizador/BloquesDocumento';
import { estiloChipHex, useChipsColores } from '@/modules/cotizador/chipsColores';
import { CHIP_OTROS, FILTROS_CATALOGO, chipDeProducto } from '@/modules/cotizador/filtrosCatalogo';
import { COMUNAS_SANTIAGO } from '@/modules/cotizador/comunas';
import {
  REGIONES_CHILE,
  REGION_METROPOLITANA,
  esRegionMetropolitana,
  esComunaRM,
} from '@/modules/cotizador/regiones-chile';
import {
  parsearExcelFase0,
  validarFilaFase0,
  canonizar,
  categoriaImplicita,
  norm,
  type CampoFase0,
} from '@/modules/cotizador/importarExcelFase0';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Cliente = {
  nombre: string;
  rut: string;
  mail: string;
  telefono: string;
  direccion: string;
  comuna: string;
  region: string;
};
const EMPTY_CLIENTE: Cliente = {
  nombre: '', rut: '', mail: '', telefono: '', direccion: '', comuna: '', region: '',
};

type FilaUI = {
  id: string;
  codInt: string;
  categoria: string;
  direccion: string;
  /** Caída del enrollado (INTERNO/EXTERNO) — dato de la cotización. */
  sentido: string;
  /** Variante de instalación del sistema de oscuridad (INTERNO/SEMI/EXTERNO),
   *  independiente de la caída; se asigna en Fase 1. */
  oscuridadVariante?: string;
  cantidad: number;
  ubicacion: string;
  colorAcc: string;
  ancho: number;
  alto: number;
  descuento: number;
  /**
   * Corte invertido (rotado) EXPLÍCITO — por paño, tri-estado como en
   * PanoEditor: undefined = auto según ancho de rollo; el click lo fija.
   */
  invertida?: boolean;
  /**
   * Línea de fabricación B (gama económica) EXPLÍCITA — por paño, tri-estado
   * igual que `invertida`: undefined = auto según la categoría de la tela.
   */
  lineaB?: boolean;
  /** id de la ventana original (si la fila viene de una OT existente). */
  vid?: string;
  /** índice del paño dentro de su ventana (una fila por paño en la cotización). */
  panoIndex?: number;
};

// Campos de nivel VENTANA: al editarlos en una fila-paño se replican a los
// demás paños de la misma ventana (`vid`) para que no diverjan (el re-agrupado
// toma el primer paño). ancho/alto/color/descuento quedan por paño.
const CAMPOS_NIVEL_VENTANA: (keyof FilaUI)[] = [
  'codInt', 'categoria', 'direccion', 'sentido', 'oscuridadVariante',
  'cantidad', 'ubicacion',
];
const nuevaFila = (): FilaUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  categoria: '',
  direccion: '',
  sentido: '',
  oscuridadVariante: '',
  cantidad: 1,
  ubicacion: '',
  colorAcc: '',
  ancho: 0,
  alto: 0,
  descuento: 0,
});

type AdicionalUI = {
  id: string;
  codInt: string;
  cantidad: number;
  descuento: number;
  ubicacion: string;
  colorAcc: string;
  /** Cenefa ovalada con tira (solo derivados de paño). */
  conTira?: boolean;
  /** 'pano' = derivado de una cenefa de paño (no editable, se regenera). */
  origen?: 'manual' | 'pano';
};
const nuevoAdicional = (): AdicionalUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  cantidad: 1,
  descuento: 0,
  ubicacion: '',
  colorAcc: '',
});

function adicionalesToPersist(list: AdicionalUI[]): AdicionalFase0Persistido[] {
  return list.map(({ id, codInt, cantidad, descuento, ubicacion, colorAcc, conTira, origen }) => ({
    id,
    codInt: codInt.trim(),
    cantidad,
    descuento,
    ubicacion,
    colorAcc,
    conTira,
    origen,
  }));
}

function adicionalesFromPersist(raw: unknown): AdicionalUI[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => {
    const row = a as Partial<AdicionalFase0Persistido>;
    return {
      id: row.id || crypto.randomUUID(),
      codInt: row.codInt || '',
      cantidad: row.cantidad ?? 1,
      descuento: row.descuento ?? 0,
      ubicacion: row.ubicacion || '',
      colorAcc: row.colorAcc || '',
      conTira: row.conTira,
      origen: row.origen,
    };
  });
}

const DIRECCIONES = [
  'CAD [IZQUIERDA]',
  'CAD [DERECHA]',
  'CIERRE [DERECHO]',
  'CIERRE [IZQUIERDO]',
  'CIERRE [MEDIO]',
];
// BEEBLACK: su planilla renombra DIRECC. CAD/CIERRE a "CIERRE" y trae otros
// valores — el acordeón corre de lado o de arriba abajo, no lleva cadena.
const DIRECCIONES_BEEBLACK = ['IZQUIERDA-DERECHA', 'DERECHA-IZQUIERDA', 'DE ARRIBA ABAJO'];
const SENTIDOS = ['INTERNO', 'EXTERNO'];
// Sistemas de oscuridad (Soft Light / Dark / Oscuranti): SIEMPRE caen INTERNO
// (la caída es el armado tela/tubo, no la variante). La variante de instalación
// (INTERNO/SEMI/EXTERNO) se elige en Fase 2, no en Fase 1.
const CAIDA_OSCURIDAD = 'INTERNO';
const esCategoriaOscuridad = (
  categoria: string | undefined,
  tipos?: readonly TipoCortina[],
): boolean => familiaOscuridad(categoria, undefined, tipos) != null;

// Filtro especial del catálogo: lista TODO (no es un chip, no vive en
// FILTROS_CATALOGO). Antes "Todos" solo limpiaba el filtro y no mostraba nada,
// así que un producto sin chip solo se encontraba por el buscador.
const FILTRO_TODOS = '__TODOS__';
// Cuántas filas del catálogo se dibujan de una (mismo tope que la tabla de
// Admin → Precios); el resto se alcanza afinando la búsqueda.
const TOPE_FILAS_CATALOGO = 500;

// % es-CL con hasta 2 decimales: 0.138 → "13,8" · 0.0415 → "4,15".
const fmtPct = (v: number) => (Math.round(v * 10000) / 100).toLocaleString('es-CL');

// Las instalaciones que el motor calcula SOLO salen de las reglas: la roller
// ('INST') más el código que declare cada sistema (el beeblack, 'INST-BB'). Un
// sistema nuevo trae el suyo y queda cubierto sin tocar esta pantalla. Ver
// `codigosInstalacionAutomatica`.

/**
 * Cotizador compartido. `modo` define el papel en el flujo:
 *   · 'fase1' = entrada (cliente + cortinas + precio inicial). Oculta las
 *     columnas COD SEC / DIRECC. CAD-CIERRE / SENT. CORT (se capturan en
 *     Terreno). Al guardar avanza a Terreno.
 *   · 'fase3' = cotización final tras Terreno. Muestra todas las columnas,
 *     reconcilia una línea por paño, deriva cenefas cobrables, y aprueba a
 *     Producción.
 */
export function CotizadorFase0({ modo = 'fase1' }: { modo?: 'fase1' | 'fase3' } = {}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: editOtId } = useParams();
  // Columnas COD SEC / DIRECC. / SENT. solo en la cotización final (Fase 3).
  // Las columnas INVERTIDA y CATEGORÍA van en ambos modos (+2 a los colspans).
  const showCols = modo === 'fase3';
  const colSpanTotal = showCols ? 19 : 17;
  const colSpanInfo = showCols ? 12 : 10;
  const { ot: otCargada, guardarCompleto } = useOT(editOtId);
  const { empresaId, perfil } = useAuth();
  // Los precios del catálogo se editan en Admin → Precios. Acá se ven y se
  // cotizan; crear o cambiar un código toca el precio de todas las cotizaciones
  // futuras, así que queda en manos del administrador.
  const esAdmin = esRolAdmin(perfil?.rol);
  const { catalogo, refresh: refreshCatalogo } = useCatalogoProductos();
  const { anchoRollo, refresh: refreshAnchoRollo } = useAnchoRollo();
  const { parametros } = useParametrosCotizador();
  const { terminos } = useTerminos();
  const { layout: layoutDoc } = useLayoutDoc();
  // El orden del documento lo define el layout de Admin → Documento. Se aplica
  // con `order` de flexbox sobre el contenedor, así que las secciones se quedan
  // escritas donde están y solo cambia dónde se dibujan.
  const ordenDoc = useMemo(() => {
    const m = new Map<string, number>();
    layoutDoc.bloques.forEach((b, i) => m.set(b.id, i + 1));
    return (id: string) => m.get(id) ?? 99;
  }, [layoutDoc]);
  const bloquesTotales = useMemo(
    () => bloquesJuntoATotales(layoutDoc.bloques).filter((b) => b.visible),
    [layoutDoc],
  );
  const { modelos: modelosDespiece } = useDescuentosModelo();
  // Reglas de tubería/mecanismo editables en Admin. Al guardar se resincronizan
  // y PERSISTEN los chips de cada paño, así que Guardar espera a `loadingReglas`
  // (si no, una empresa con reglas propias guardaría con las de fábrica).
  const { reglas, loading: loadingReglas } = useReglasSeleccion();
  // Precios de insumo y recetas por familia (Admin → Precios). Mismo cuidado:
  // cotizar con las de fábrica y guardar dejaría precios que no son los de la
  // empresa escritos en la OT.
  const { reglas: reglasPrecios, loading: loadingPrecios } = useReglasPrecios();
  // Fórmulas del despiece (Admin → Catálogo técnico): de acá sale cuánta tela
  // consume cada montaje, para cotizar la oscuridad al peor caso.
  const { formulas } = useFormulasFamilias();
  // Categorías que se ofrecen: las nativas + los tipos de cortina propios
  // activos (Admin → Catálogo técnico). Es la misma lista que valida el import.
  const categoriasSelect = useMemo(() => categoriasParaSelect(reglas.tipos), [reglas.tipos]);
  // Instalaciones que arma el motor solo: se filtran de los adicionales para no
  // cobrarlas dos veces.
  const esInstalacionBase = useCallback(
    (ci: string) =>
      codigosInstalacionAutomatica(reglasPrecios.sistemas).has((ci || '').trim().toUpperCase()),
    [reglasPrecios.sistemas],
  );

  const [cliente, setCliente] = useState<Cliente>(EMPTY_CLIENTE);
  // N° de OT manual (transición desde el Excel legado): si viene, la OT se
  // crea con ESTE número en vez del correlativo automático de la app. Se
  // autocompleta al importar un Excel que traiga "OT CLIENTE" en el encabezado.
  const [otManual, setOtManual] = useState('');
  const [filas, setFilas] = useState<FilaUI[]>([nuevaFila()]);
  /** Familia cuyo desglose de precio se está mirando (null = ninguno). */
  const [desgloseCod, setDesgloseCod] = useState<string | null>(null);
  const [adicionales, setAdicionales] = useState<AdicionalUI[]>([]);
  // null = ningún filtro (la tabla ni se dibuja) · FILTRO_TODOS = el catálogo
  // entero · id de chip = ese chip. Arranca en null para no cargar la página
  // con cientos de filas de una.
  const [filtroActivo, setFiltroActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Editor del catálogo: undefined = cerrado, null = producto nuevo, string = editar ese COD_INT.
  const [editarProducto, setEditarProducto] = useState<string | null | undefined>(undefined);
  // Editor de colores de los chips de categoría.
  const [editarColores, setEditarColores] = useState(false);
  const { colores: chipsColores, guardar: guardarColoresChips } = useChipsColores();
  // Cotización a región: la instalación no es gratis por 4+ (usa el % de región).
  const [region, setRegion] = useState(false);
  // Descuento de instalación región de ESTA cotización, en % (0–100). null =
  // seguir el valor global de Admin; un número = override para esta OT.
  const [regionDescPct, setRegionDescPct] = useState<number | null>(null);
  // Sin instalación: el cliente retira / solo quiere la cortina (sin instalación).
  const [sinInstalacion, setSinInstalacion] = useState(false);
  // Envío: gratis o cobro en destino (lo paga el cliente al courier; no suma al total).
  const [envio, setEnvio] = useState<'gratis' | 'cobro_destino'>('gratis');
  // Tubo E78: habilita la banda 2,2–3,0 m (kit 45 mm + tubo E78) para esta OT.
  // Default false = el rango usa tubo E66 (38 mm) con kit normal.
  const [usarTuboE78, setUsarTuboE78] = useState(false);
  const opcSel = useMemo(() => derivarOpciones(reglas, usarTuboE78), [reglas, usarTuboE78]);
  /** Hay algo que dependa del toggle E78: alguna regla con gate o un ítem
   *  marcado "solo con E78". Sin nada de eso, el botón no tiene sentido. */
  const hayOptInE78 = useMemo(
    () =>
      reglas.mecanismo.reglasAncho.some((r) => r.requiereTuboE78) ||
      reglas.tuberia.tubos.some((t) => t.estado === 'opt_in') ||
      reglas.mecanismo.mecanismos.some((m) => m.estado === 'opt_in'),
    [reglas],
  );

  const [guardandoOT, setGuardandoOT] = useState(false);
  // Celdas a corregir a mano tras importar un Excel: id de fila → campos inválidos.
  const [erroresImport, setErroresImport] = useState<Map<string, Set<CampoFase0>>>(new Map());
  // Adicionales importados con COD_INT inválido: id de adicional → { 'codInt' }.
  const [erroresImportAdic, setErroresImportAdic] = useState<Map<string, Set<'codInt'>>>(new Map());
  const inputExcelRef = useRef<HTMLInputElement>(null);
  // Al editar una OT existente: ventanas originales (para preservar los
  // datos ricos de Fase 2 al volver a guardar) y bandera de carga única.
  const [origVentanas, setOrigVentanas] = useState<Record<string, Record<string, unknown>>>({});
  const [cargadoEdit, setCargadoEdit] = useState(false);

  useEffect(() => {
    if (!editOtId || !otCargada || cargadoEdit) return;
    const dg = (otCargada.datosGenerales || {}) as Record<string, string> & {
      adicionalesFase0?: AdicionalFase0Persistido[];
      region?: boolean;
      instalacionDescuentoRegion?: number;
      sinInstalacion?: boolean;
      envio?: 'gratis' | 'cobro_destino';
      usarTuboE78?: boolean;
    };
    setCliente({
      nombre: dg.cliente || '',
      rut: dg.rut || '',
      mail: dg.mail || '',
      telefono: dg.telefono || '',
      direccion: dg.direccion || '',
      comuna: dg.comuna || '',
      region: dg.regionNombre || '',
    });
    // Reconcilia la grilla desde las cortinas: UNA fila por paño (multi-paño =
    // varias líneas), conservando `vid`/`panoIndex` para re-agrupar al guardar.
    // El DCT% guardado en el paño se restaura; si no existe (cortina creada en
    // Terreno u OT vieja), se autollena con el % del catálogo, igual que al
    // elegir el COD_INT a mano.
    const vts = (otCargada.storeVentanas || []) as unknown as VentanaItem[];
    const { filas: nuevasFilas, orig } = explotarVentanasAFilas(
      vts,
      () => crypto.randomUUID(),
      dctDeCodigo,
    );
    // Oscuridad: la caída SIEMPRE es INTERNO (corrige OTs viejas con caída
    // EXTERNO/SEMI). Compat: una OT guardada ANTES de separar caída/variante trae
    // la variante en `sentido` y `oscuridadVariante` vacío → se recupera al campo.
    const filasMigradas = nuevasFilas.map((f) => {
      if (!esCategoriaOscuridad(f.categoria, reglas.tipos)) return f;
      const oscuridadVariante = f.oscuridadVariante || f.sentido || '';
      return { ...f, oscuridadVariante, sentido: CAIDA_OSCURIDAD };
    });
    setFilas(filasMigradas.length ? filasMigradas : [nuevaFila()]);
    // Adicionales = manuales persistidos + cenefas DERIVADAS de los paños.
    // 'INST' (instalación base) es automático → se descarta. Los derivados de
    // una apertura anterior (origen 'pano') se descartan y se regeneran acá,
    // así no se acumulan; y no se duplica lo que el usuario puso a mano.
    const persistidos = adicionalesFromPersist(dg.adicionalesFase0).filter(
      (a) => !esInstalacionBase(a.codInt),
    );
    const manuales = persistidos.filter((a) => a.origen !== 'pano');
    // Una cenefa escrita a mano tapa UNA cortina, no todas las de esa ubicación:
    // con tres cortinas en la misma UBIC. se cobraba una sola (OT 3169).
    const derivados = filtrarDerivadosPorCupoManual(
      derivarAdicionalesCenefaDesdeVentanas(vts),
      manuales,
    );
    const derivadosUI: AdicionalUI[] = derivados.map((d) => ({
      id: crypto.randomUUID(),
      codInt: d.codInt,
      cantidad: d.cantidad,
      descuento: dctDeCodigo(d.codInt),
      ubicacion: d.ubicacion || '',
      colorAcc: d.colorAcc || '',
      conTira: d.conTira,
      origen: 'pano',
    }));
    setAdicionales([...manuales, ...derivadosUI]);
    setRegion(!!dg.region);
    setRegionDescPct(
      typeof dg.instalacionDescuentoRegion === 'number'
        ? Math.round(dg.instalacionDescuentoRegion * 100)
        : null,
    );
    setSinInstalacion(!!dg.sinInstalacion);
    setEnvio(dg.envio === 'cobro_destino' ? 'cobro_destino' : 'gratis');
    setUsarTuboE78(!!dg.usarTuboE78);
    setOrigVentanas(orig as Record<string, Record<string, unknown>>);
    setCargadoEdit(true);
  }, [editOtId, otCargada, cargadoEdit]);

  // Guarda la cotización como OT: cliente + ventanas (con el modelo de
  // fabricación elegido por categoría y color) y sigue el flujo en Fase 2.
  const guardarComoOT = async (opts?: { aProduccion?: boolean }) => {
    if (!empresaId) return;
    // Guardar resincroniza los chips de cada paño: hacerlo antes de que lleguen
    // las reglas de la empresa los escribiría con las de fábrica.
    if (loadingReglas) {
      toast.error('Todavía se están cargando las reglas del catálogo. Reintenta en un segundo.');
      return;
    }
    if (loadingPrecios) {
      toast.error('Todavía se están cargando los precios. Reintenta en un segundo.');
      return;
    }
    if (!cliente.nombre.trim()) {
      toast.error('Ingresa el nombre del cliente antes de guardar la OT.');
      return;
    }
    const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);
    if (validas.length === 0) {
      toast.error('Agrega al menos una cortina con producto y medidas.');
      return;
    }
    if (erroresImport.size > 0 || erroresImportAdic.size > 0) {
      toast.error('Hay datos importados a corregir (en rojo). Complétalos antes de guardar.');
      return;
    }
    setGuardandoOT(true);
    try {
      const adicionalesGuardados = adicionalesToPersist(adicionales);
      // Re-agrupa las filas-paño por ventana (`vid`): reconstruye UNA ventana
      // con sus N paños, preservando la ficha rica de Terreno (mecanismo,
      // tubería, cenefa…) y solo actualizando ancho/alto/color desde la fila.
      // Las filas sin `vid` (alta manual/Excel) → ventana nueva de 1 paño.
      const construirVentanaGrupo = (
        g: ReturnType<typeof agruparFilasPorVentana>[number],
      ) => {
        const head = g.filas[0];
        const prod = catalogo[head.codInt.trim()];
        // Modelo por color + regla por ANCHO (banda 2,2–3,0 m → kit 45/E78; >3 m →
        // 63 mm/E65), igual que sincronizarChips en Fase 2. Sin esto una cortina
        // importada nace en 38 mm y el Excel de órdenes/optimizador salía en E66
        // hasta abrirla a mano en Fase 2.
        const esDual = categoriaEsDual(head.categoria, reglas.tipos);
        // El beeblack doble también lleva una tela por paño (blackout +
        // mosquitero): sin esto los dos paños se guardaban sin codInt propio y
        // al reabrir ambos heredaban la tela de la ventana (la SCREEN, que es
        // la que queda de cabeza tras el emparejado).
        const telaPorPano = esGrupoDobleTela(head.categoria, g.filas.length, reglas.tipos);
        const anchoGrupo = g.filas.reduce((mx, f) => Math.max(mx, f.ancho || 0), 0);
        // Categoría de FABRICACIÓN (A o B) por paño: lo forzado en la columna,
        // o la gama comercial de su tela. El MODELO es uno por ventana, así que
        // lo decide el primer paño (igual que la categoría o el color).
        //
        // Va con `esLineaB` —NO con `gamaTelaEsB`— porque acá se decide con qué
        // herrajes se GUARDA la cortina, y la categoría B solo existe en roller
        // simple, ovalada y dúo 38. Con la versión sin guarda, un soft light con
        // tela de gama B se guardaba con el tubo E01 (visto en la OT 268-3).
        // El distintivo de la grilla sí usa la versión sin guarda, a propósito:
        // ahí se muestra la gama de la TELA, no la de fabricación.
        const lineaBFilas = g.filas.map((f) =>
          esLineaB(f, head.codInt, catalogo, head.categoria, reglas.mecanismo, reglas.tipos),
        );
        const lineaBVentana = lineaBFilas[0] ?? false;
        let modeloCalc = modeloVentanaPorAncho(
          modelosDespiece,
          head.categoria,
          head.colorAcc,
          anchoGrupo,
          usarTuboE78,
          reglas.mecanismo,
          reglas.tipos,
          lineaBVentana,
        );
        // Dual: refinar el modelo al mecanismo dual exacto por lado+color (los 8
        // modelos comparten descuentos, así que es coherencia del snapshot).
        if (esDual) {
          const chip = chipDualPorLadoColor(
            dualLadoDesdeDireccion(head.direccion),
            head.colorAcc,
            OPCIONES_MECANISMO_DUAL,
          );
          const modeloDual = chip
            ? modeloDesdeChipMecanismo(
                modelosParaCategoria(modelosDespiece, head.categoria, reglas.tipos),
                chip,
              )
            : null;
          if (modeloDual) modeloCalc = modeloDual;
        }
        const orig = head.vid
          ? (origVentanas[head.vid] as Record<string, any> | undefined)
          : undefined;
        const precio = g.filas.reduce((s, f) => s + (lineaDeFila.get(f.id)?.valorUnit ?? 0), 0);
        const panos = construirPanosDeGrupo(
          g.filas,
          orig?.panos as Record<string, unknown>[] | undefined,
          { persistirCodInt: telaPorPano },
        );
        // Cada paño lleva SU tela (producto/descripción/tipoTela del catálogo);
        // la ventana conserva la del paño 0 (head) para consumidores nivel-ventana.
        if (telaPorPano) {
          panos.forEach((p, i) => {
            const f = g.filas[i];
            const prodP = f ? catalogo[(f.codInt || '').trim()] : undefined;
            p.codInt = f?.codInt || '';
            p.producto = prodP?.producto ?? '';
            p.descripcion = prodP?.descripcion ?? '';
            p.tipoTela = tipoTelaDesdeProducto(prodP?.cod, f?.codInt);
          });
        }
        // Modelo final: al re-guardar una OT existente, recalcula el modelo por
        // ancho con el flag E78 actual (banda ON → 45 mm/E78; OFF → revierte a 38
        // mm/E66 los colores con regla, respeta el 45 manual gris y las categorías
        // …_45mm por spec). El dual conserva su modelo (no lleva regla por ancho).
        const origModelo = orig?.modelo as ModeloDespiece | undefined;
        const modeloFinal = esDual
          ? (origModelo ?? modeloCalc)
          : origModelo
            ? modeloPorAncho(
                modelosDespiece,
                head.categoria,
                anchoGrupo,
                origModelo,
                head.colorAcc,
                usarTuboE78,
                reglas.mecanismo,
                reglas.tipos,
                lineaBVentana,
              )
            : modeloCalc;
        // Re-sincroniza los chips de mecanismo/tubería de los paños con el modelo
        // recalculado: baja MEC 18/23 → kit por color y E78 → E66 si eran auto (el
        // Excel de órdenes/etiquetas priorizan el CHIP guardado; un chip E78
        // huérfano con modelo 38 daría "38mm_E78"). También realinea el kit al
        // COLOR de accesorios de la fila (el dual solo eso: conserva su lado).
        resincronizarChipsPanos(
          panos,
          head.colorAcc,
          modeloFinal,
          head.categoria,
          opcSel.mecanismoResolucion,
          opcSel.tuberiaUI,
          usarTuboE78,
          reglas,
          lineaBFilas,
        );
        const ventana: Record<string, unknown> = {
          ...(orig ?? { id: crypto.randomUUID(), grupoId: null }),
          ubicacion: head.ubicacion || '',
          codInt: head.codInt.trim(),
          producto: prod?.producto ?? orig?.producto ?? '',
          tipo: prod?.tipo ?? orig?.tipo ?? '',
          descripcion: prod?.descripcion ?? orig?.descripcion ?? '',
          color: head.colorAcc || (orig?.color as string) || 'Blanco',
          alto: head.alto,
          precio: precio || (orig?.precio as number) || 0,
          cantidad: head.cantidad || 1,
          categoria: head.categoria || (orig?.categoria as string) || '',
          direccion: head.direccion || '',
          sentido: head.sentido || '',
          // Variante de oscuridad (INTERNO/SEMI/EXTERNO), independiente de la
          // caída. En oscuridad se fija SIEMPRE (default INTERNO) para que el
          // despiece no tenga que caer al `sentido` (que ahora es la caída).
          oscuridadVariante: esCategoriaOscuridad(head.categoria, reglas.tipos)
            ? (head.oscuridadVariante || 'INTERNO')
            : (head.oscuridadVariante || ''),
          panos,
          modelo: modeloFinal,
        };
        return ventana;
      };
      // Dos pasadas: primero se arman TODAS las ventanas y recién después se
      // enriquecen, porque decidir a qué cortina le toca una cenefa necesita ver
      // a las que comparten su ubicación.
      const ventanasBase = agruparFilasPorVentana(validas).map(construirVentanaGrupo);
      const ventanas = ventanasBase.map(
        (v) =>
          enriquecerVentanaDesdeFase0(
            v as never,
            catalogo,
            adicionalesGuardados,
            ventanasBase as never,
          ) as unknown as Record<string, unknown>,
      );
      const now = new Date().toISOString();

      // ── Editando una OT existente: actualizar la MISMA OT ──
      if (editOtId && otCargada) {
        const aProduccion = !!opts?.aProduccion;
        const dgBase = {
          ...(otCargada.datosGenerales || {}),
          cliente: cliente.nombre,
          rut: cliente.rut,
          mail: cliente.mail,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          regionNombre: cliente.region,
          adicionalesFase0: adicionalesGuardados,
          region,
          instalacionDescuentoRegion: Math.max(0, Math.min(1, regionPctEff / 100)),
          sinInstalacion,
          envio,
          usarTuboE78,
        };
        const actualizada: OT = {
          ...otCargada,
          estado: aProduccion ? 'produccion' : otCargada.estado,
          subEtapa: aProduccion ? 'Estructura' : otCargada.subEtapa,
          datosGenerales: aProduccion
            ? {
                ...dgBase,
                historialEstados: [
                  ...(otCargada.datosGenerales?.historialEstados || []),
                  { de: otCargada.estado, a: 'produccion' as const, fecha: now },
                ],
              }
            : dgBase,
          storeVentanas: ventanas as unknown as OT['storeVentanas'],
          fechaModificacion: now,
          totalConIva: t.totalTransferencia,
        };
        await guardarCompleto(actualizada);
        const numActual = (otCargada.datosGenerales as Record<string, string>)?.ot ?? '';
        if (aProduccion) {
          toast.success(`OT ${numActual} enviada a Producción.`);
          localStorage.setItem('activeOTId', otCargada.id);
          navigate(`/ots/${otCargada.id}/fase4`);
        } else if (modo === 'fase1') {
          toast.success(`OT ${numActual} actualizada · ${ventanas.length} cortina(s).`);
          navigate(`/ots/${otCargada.id}/fase2`);
        } else {
          toast.success(`Cotización guardada · ${ventanas.length} cortina(s).`);
        }
        return;
      }

      // ── Cotización nueva: N° manual (Excel legado) o correlativo automático ──
      let numOT: string;
      try {
        numOT = await resolverNumeroOT(puertoSupabaseNumeroOT, empresaId, otManual);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
        return;
      }

      const ot: OT = {
        id: crypto.randomUUID(),
        estado: 'cotizacion',
        subEtapa: null,
        datosGenerales: {
          cliente: cliente.nombre,
          rut: cliente.rut,
          mail: cliente.mail,
          telefono: cliente.telefono,
          direccion: cliente.direccion,
          comuna: cliente.comuna,
          regionNombre: cliente.region,
          ot: numOT,
          canal: 'Cotizador',
          fecha: now.split('T')[0],
          adicionalesFase0: adicionalesGuardados,
          region,
          instalacionDescuentoRegion: Math.max(0, Math.min(1, regionPctEff / 100)),
          sinInstalacion,
          envio,
          usarTuboE78,
        },
        storeVentanas: ventanas as unknown as OT['storeVentanas'],
        cotizacionCount: 1,
        fechaCreacion: now,
        fechaModificacion: now,
        notas: '',
        totalConIva: t.totalTransferencia,
      };
      const { error } = await supabase
        .from('ots')
        .upsert(otToRow(ot, empresaId) as unknown as never, { onConflict: 'id' });
      if (error) throw error;

      const sinModelo = ventanas.filter((v) => !v.modelo).length;
      toast.success(
        `OT ${numOT} creada con ${ventanas.length} cortina(s).` +
          (sinModelo > 0 ? ` ${sinModelo} sin modelo de fabricación (completar en Fase 2).` : ''),
      );
      navigate(`/ots/${ot.id}/fase2`);
    } catch (e) {
      toast.error('Error al guardar la OT: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardandoOT(false);
    }
  };

  // Validación de fabricabilidad por fila: categoría + ancho vs catálogo
  // de descuentos (ancho máximo entre los modelos de esa categoría).
  useEffect(() => {
    const leadId = params.get('lead');
    if (!leadId || !empresaId) return;
    (async () => {
      const { data } = await supabase
        .from('leads' as any)
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      if (data) {
        const l = data as any;
        setCliente({
          nombre: l.nombre || '',
          rut: l.rut || '',
          mail: l.email || '',
          telefono: l.whatsapp_phone || '',
          direccion: '',
          comuna: l.comuna || '',
          region: esComunaRM(l.comuna || '') ? REGION_METROPOLITANA : '',
        });
      }
    })();
  }, [params, empresaId]);

  // Descuento de instalación región efectivo: override de esta OT (regionDescPct)
  // o, si es null, el valor global configurado en Admin.
  const regionPctEff =
    regionDescPct ?? Math.round((parametros.instalacionDescuentoRegion || 0) * 100);

  // La región del cliente maneja el cobro de instalación: cualquier región
  // distinta de la Metropolitana activa el cobro (con el % de región). Si el
  // campo Región está vacío, se respeta el toggle manual de abajo.
  useEffect(() => {
    if (cliente.region) setRegion(!esRegionMetropolitana(cliente.region));
  }, [cliente.region]);

  const resultado = useMemo(() => {
    const filasMotor = filas.map((f) => ({
      codInt: f.codInt,
      ancho: f.ancho,
      alto: f.alto,
      cantidad: f.cantidad,
      descuento: f.descuento / 100,
      // Oscuridad y beeblack: la tela se corta a otra medida según el montaje,
      // que se elige recién en Fase 2. Mientras no se sepa, se cotiza el que
      // MÁS tela gasta (externo): antes se cotizaban todas como internas y la
      // diferencia se regalaba. Ver empaqueFase0.ts.
      anchoEmpaqueM: anchoEmpaquePeorCasoM(f.categoria, f.ancho, formulas, reglas.tipos),
      // Para la fila de instalación: en Fase 3 una ventana puede venir partida
      // en varios paños (un dual son dos telas y UNA instalación). En Fase 1
      // las filas no tienen ventana todavía y se cuentan de a una.
      ventanaId: f.vid,
    }));
    // La instalación base ('INST') se calcula automáticamente; se excluye de los
    // adicionales que van al motor para no cobrarla dos veces aunque alguien la
    // haya tipeado a mano en una fila (guard contra doble cobro).
    const adicMotor = adicionales
      .filter((a) => !esInstalacionBase(a.codInt))
      .map((a) => ({
        codInt: a.codInt,
        cantidad: a.cantidad,
        descuento: a.descuento / 100,
      }));
    // Para región, el % de descuento de instalación de esta OT sobreescribe el global.
    const paramsEff = region
      ? {
          ...parametros,
          instalacionDescuentoRegion: Math.max(0, Math.min(1, regionPctEff / 100)),
        }
      : parametros;
    return cotizarFase0(
      filasMotor, catalogo, anchoRollo, adicMotor, paramsEff, region, sinInstalacion, reglasPrecios,
    );
  }, [filas, adicionales, catalogo, anchoRollo, parametros, region, regionPctEff, sinInstalacion, reglasPrecios, formulas, reglas.tipos]);

  /** La familia que está mirando el desglose, si el diálogo está abierto. */
  const familiaDesglose = useMemo(
    () => (desgloseCod ? resultado.familias.find((f) => f.cod === desgloseCod) ?? null : null),
    [desgloseCod, resultado.familias],
  );

  // ¿Alguna fila se está cotizando al peor caso de montaje? (para el aviso)
  const conPeorCaso = useMemo(
    () =>
      filas.some(
        (f) =>
          f.ancho > 0 &&
          anchoEmpaquePeorCasoM(f.categoria, f.ancho, formulas, reglas.tipos) !== undefined,
      ),
    [filas, formulas, reglas.tipos],
  );

  const lineaDeFila = useMemo(() => {
    const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);
    const m = new Map<string, LineaResultado>();
    validas.forEach((f, i) => {
      const ln = resultado.lineas[i];
      if (ln) m.set(f.id, ln);
    });
    return m;
  }, [filas, resultado]);

  const adicResDeFila = useMemo(() => {
    // Mismo filtro que adicMotor (incluye excluir 'INST') para que los índices
    // de resultado.adicionales queden alineados con las filas mostradas.
    const validos = adicionales.filter(
      (a) => a.codInt && a.cantidad > 0 && !esInstalacionBase(a.codInt),
    );
    const m = new Map<string, AdicionalResultado>();
    validos.forEach((a, i) => {
      const r = resultado.adicionales[i];
      if (r) m.set(a.id, r);
    });
    return m;
  }, [adicionales, resultado]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    // Los COD_INT del catálogo llevan espacio ("DOM 42") pero en las planillas de
    // insumos se escriben pegados ("DOM42"): se busca también sin espacios.
    const qPegado = q.replace(/\s+/g, '');
    // TODOS no filtra: lista el catálogo entero (con tope de filas más abajo).
    const filtro =
      filtroActivo && filtroActivo !== FILTRO_TODOS
        ? FILTROS_CATALOGO.find((f) => f.id === filtroActivo)
        : null;
    return Object.entries(catalogo)
      .filter(([ci, p]) => {
        if (filtro && !filtro.match(p, ci)) return false;
        if (q) {
          const hay = `${ci} ${p.producto || ''} ${p.cod || ''}`.toUpperCase();
          if (!hay.includes(q) && !hay.replace(/\s+/g, '').includes(qPegado)) return false;
        }
        return true;
      })
      .sort((a, b) => (a[1].producto || '').localeCompare(b[1].producto || ''));
  }, [catalogo, filtroActivo, busqueda]);

  // Chips a dibujar: «Otros» solo aparece si de verdad hay algo ahí, para no
  // mostrarle a la vendedora una categoría vacía.
  const chipsVisibles = useMemo(() => {
    const hayOtros = Object.entries(catalogo).some(
      ([ci, p]) => chipDeProducto(p, ci) === CHIP_OTROS,
    );
    return hayOtros ? FILTROS_CATALOGO : FILTROS_CATALOGO.filter((f) => f.id !== CHIP_OTROS);
  }, [catalogo]);

  // COD_INT tal como vive en el catálogo ("DOM42" tecleado → "DOM 42"). Si no
  // existe se devuelve lo escrito (para que la celda quede marcada en rojo).
  const canonizarCodInt = useCallback(
    (ci: string | undefined): string => claveCatalogoCanonica(catalogo, ci) ?? (ci ?? ''),
    [catalogo],
  );

  // DCT% por defecto (0–100) del código, tomado del catálogo. Autollena la
  // columna al elegir/importar un COD_INT; el usuario lo puede editar después.
  // Se conservan hasta 2 decimales: el `Math.round` de antes convertía un
  // 37,5 % del catálogo en 38 % y esa media unidad se perdía en cada línea.
  const dctDeCodigo = (ci: string | undefined): number =>
    Math.round((Number(catalogo[canonizarCodInt(ci)]?.descuento) || 0) * 10000) / 100;

  const agregarProducto = (codInt: string) => {
    const prod = catalogo[codInt];
    if (!prod) return;
    if (esInstalacionBase(codInt)) {
      toast.info('La instalación se calcula sola (gratis desde 4 cortinas; % editable a región).');
      return;
    }
    const descuento = dctDeCodigo(codInt);
    if (esCortinaTipo(prod.tipo)) {
      setFilas((prev) => {
        const last = prev[prev.length - 1];
        if (last && !last.codInt && last.ancho === 0 && last.alto === 0) {
          return prev.map((f, i) => (i === prev.length - 1 ? { ...f, codInt, descuento } : f));
        }
        return [...prev, { ...nuevaFila(), codInt, descuento }];
      });
    } else {
      setAdicionales((prev) => [...prev, { ...nuevoAdicional(), codInt, descuento }]);
    }
  };

  const setFila = (id: string, patch: Partial<FilaUI>) => {
    // El COD_INT se guarda como está en el catálogo ("sc64" → "SC 64"): así el
    // producto, el precio y el DCT% se resuelven aunque se teclee sin espacio.
    if ('codInt' in patch) patch = { ...patch, codInt: canonizarCodInt(patch.codInt) };
    // Al cambiar el COD_INT, autollenar el DCT% con el descuento del código
    // (salvo que el patch ya traiga un descuento explícito).
    let conDct =
      'codInt' in patch && !('descuento' in patch)
        ? { ...patch, descuento: dctDeCodigo(patch.codInt) }
        : patch;
    // Al pasar una fila a VERTICAL se limpia el sentido de caída: no aplica
    // (la vertical corre de lado, no se enrolla) y la celda pasa a mostrar "—".
    if ('categoria' in patch && esCategoriaVertical(patch.categoria)) {
      conDct = { ...conDct, sentido: '' };
    }
    // PLETINA (velcro): el paño va PEGADO, no se enrolla ni lleva cadena. Se
    // limpian las dos: sin cadena no hay lado de accionamiento (DIRECC.) y sin
    // enrollado no hay caída (SENT.). Las dos celdas pasan a mostrar "—".
    if ('categoria' in patch && esCategoriaPletina(patch.categoria, reglas.tipos)) {
      conDct = { ...conDct, direccion: '', sentido: '' };
    }
    setFilas((prev) => {
      const fila = prev.find((f) => f.id === id);
      const vid = fila?.vid;
      // Los campos de nivel ventana se replican a los demás paños del mismo vid.
      const espejo =
        !!vid && Object.keys(conDct).some((k) => CAMPOS_NIVEL_VENTANA.includes(k as keyof FilaUI));
      // Dual y beeblack doble: cada paño (fila) mantiene SU tela → el codInt NO
      // se replica a los demás paños de la ventana (el resto de campos
      // nivel-ventana sí).
      const catEfectiva = (conDct.categoria as string) ?? fila?.categoria ?? '';
      const telaPorPanoFila = esGrupoDobleTela(catEfectiva, undefined, reglas.tipos);
      const soloVentana = (): Partial<FilaUI> => {
        const sub: Partial<FilaUI> = {};
        for (const k of CAMPOS_NIVEL_VENTANA) {
          if (k === 'codInt' && telaPorPanoFila) continue;
          if (k in conDct) (sub as Record<string, unknown>)[k] = (conDct as Record<string, unknown>)[k];
        }
        return sub;
      };
      return prev.map((f) => {
        if (f.id === id) return { ...f, ...conDct };
        if (espejo && f.vid === vid) return { ...f, ...soloVentana() };
        return f;
      });
    });
    // Al corregir una celda importada, le quitamos su marca roja.
    setErroresImport((prev) => {
      if (!prev.has(id)) return prev;
      const campos = new Set(prev.get(id));
      // `conDct`, no `patch`: incluye los campos derivados (p. ej. el sentido
      // que se limpia al pasar a VERTICAL), que también dejan de estar en rojo.
      for (const k of Object.keys(conDct)) campos.delete(k as CampoFase0);
      const next = new Map(prev);
      if (campos.size === 0) next.delete(id);
      else next.set(id, campos);
      return next;
    });
  };
  const quitarFila = (id: string) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));
  // Duplica una fila completa (con sus datos) justo debajo, con nuevo id,
  // para cargar varias cortinas parecidas sin reescribir todo.
  const duplicarFila = (id: string) =>
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx < 0) return prev;
      // La copia es una cortina NUEVA independiente: sin vid/panoIndex para no
      // engancharse al grupo multi-paño de la ventana original.
      const copia: FilaUI = { ...prev[idx], id: crypto.randomUUID(), vid: undefined, panoIndex: undefined };
      const next = [...prev];
      next.splice(idx + 1, 0, copia);
      return next;
    });

  // Importa una cotización desde Excel: REEMPLAZA las cortinas de la grilla
  // con las filas de la planilla. Las celdas con datos llave inválidos
  // (COD_INT inexistente, mecanismo/dirección/sentido fuera de lista, o
  // medida ≤ 0) quedan marcadas en rojo para corregir a mano antes de seguir.
  const importarExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const { cortinas, adicionales: adicCrudos, otCliente } = parsearExcelFase0(wb);
      if (cortinas.length === 0 && adicCrudos.length === 0) {
        toast.error('No se encontraron filas con COD_INT y ANCHO en la planilla.');
        return;
      }
      // N° de OT del encabezado del Excel manual → campo "N° OT (Excel manual)".
      // Al editar una OT existente el número no se toca (el campo no aplica).
      if (otCliente && !editOtId) setOtManual(otCliente);
      const opts = {
        codIntValidos: new Set(Object.keys(catalogo)),
        categorias: new Set(categoriasSelect),
        direcciones: new Set(DIRECCIONES),
        direccionesBeeblack: new Set(DIRECCIONES_BEEBLACK),
        // SENT. CORT es la caída del enrollado (INTERNO/EXTERNO). En oscuridad la
        // caída es INTERNO fija y la variante (interno/semi/externo) se elige en Fase 2.
        sentidos: new Set(SENTIDOS),
        tipos: reglas.tipos,
        // Fase 1 no muestra COD SEC / DIRECC. / SENT.: no se exigen. Marcarlas
        // dejaba la planilla mínima de entrada trabada — la celda roja no se
        // puede corregir sin su columna, y el guardado se bloquea con errores.
        modo,
      };

      // ── Cortinas ──
      const nuevas: FilaUI[] = [];
      const errores = new Map<string, Set<CampoFase0>>();
      // Filas beeblack marcadas DOBLE (columna TIPO): se emparejan por UBIC.
      const beeblackDoble = new Set<string>();
      for (const c of cortinas) {
        // "SC64" en la planilla → "SC 64" del catálogo (antes quedaba en rojo).
        c.codInt = canonizarCodInt(c.codInt);
        // La planilla de beeblack no trae COD SEC (renombró esa columna a TIPO DE
        // INSTALACIÓN): la categoría se deduce de sus códigos BEE-*.
        const categoria =
          canonizar(c.categoria, categoriasSelect) || categoriaImplicita(c.codInt);
        const esBeeblack = esCategoriaBeeblack(categoria);
        // PLETINA (velcro): paño pegado, sin cadena ni enrollado → ni dirección
        // ni caída, aunque la planilla traiga algo escrito en esas columnas.
        const esPletina = esCategoriaPletina(categoria, reglas.tipos);
        const direccion = esPletina
          ? ''
          : canonizar(c.direccion, esBeeblack ? DIRECCIONES_BEEBLACK : DIRECCIONES);
        // Caída (SENT. CORT): la vertical no se enrolla → vacío. Los sistemas de
        // oscuridad SIEMPRE caen INTERNO (aunque el Excel traiga otra cosa; la
        // variante interno/semi/externo se elige en Fase 2). El beeblack tampoco
        // se enrolla: su variante también se elige en Fase 2. Resto: del Excel.
        const sentido =
          esCategoriaVertical(categoria) || esBeeblack || esPletina
            ? ''
            : esCategoriaOscuridad(categoria, reglas.tipos)
              ? CAIDA_OSCURIDAD
              : canonizar(c.sentido, SENTIDOS);
        const fila: FilaUI = {
          id: crypto.randomUUID(),
          codInt: c.codInt,
          categoria,
          direccion,
          sentido,
          // Oscuridad: la variante parte en INTERNO y se elige en Fase 2 (el Excel
          // de cotización no la trae). La caída ya quedó fija en INTERNO arriba.
          oscuridadVariante: esCategoriaOscuridad(categoria, reglas.tipos) ? 'INTERNO' : '',
          cantidad: c.cantidad || 1,
          ubicacion: c.ubicacion,
          colorAcc: c.colorAcc,
          ancho: c.ancho,
          alto: c.alto,
          descuento: dctDeCodigo(c.codInt),
        };
        // El beeblack DOBLE se empareja después, por ubicación.
        if (esBeeblack && norm(c.tipoSimpleDoble) === 'DOBLE') beeblackDoble.add(fila.id);
        const malos = validarFilaFase0({ ...c, categoria, direccion, sentido }, opts);
        if (malos.length) errores.set(fila.id, new Set(malos));
        nuevas.push(fila);
      }

      // ── Adicionales (debajo del rótulo "ADICIONALES"): solo se valida que el
      //    COD_INT exista en el catálogo; el ancho del Excel se ignora. ──
      const nuevosAdic: AdicionalUI[] = [];
      const erroresAdic = new Map<string, Set<'codInt'>>();
      for (const a of adicCrudos) {
        // La instalación base es automática (Fase 2): no se importa como adicional.
        if (esInstalacionBase(a.codInt)) continue;
        const id = crypto.randomUUID();
        // "DOM42" de la planilla de insumos → "DOM 42" del catálogo.
        const codInt = canonizarCodInt(a.codInt);
        nuevosAdic.push({
          id,
          codInt,
          cantidad: a.cantidad || 1,
          descuento: dctDeCodigo(codInt),
          ubicacion: a.ubicacion,
          colorAcc: a.colorAcc,
        });
        if (!codInt || !catalogo[codInt]) erroresAdic.set(id, new Set(['codInt']));
      }

      // Dual (roller doble tela): las 2 filas ROL_DUAL de la misma UBIC se
      // fusionan en UNA cortina de 2 paños (SCR primero = tela al vidrio) con un
      // `vid` compartido + `panoIndex` 0/1. Las no-dual quedan como filas sueltas.
      // El BEEBLACK marcado DOBLE (blackout + mosquitero en la misma ubicación)
      // usa el mismo camino: mosquitero al vidrio primero.
      const esFilaDoble = (f: FilaUI) => categoriaEsDual(f.categoria, reglas.tipos) || beeblackDoble.has(f.id);
      const { grupos, avisos } = emparejarDualesFase0(
        nuevas,
        (f) => tipoTelaDesdeProducto(catalogo[f.codInt.trim()]?.cod, f.codInt),
        esFilaDoble,
      );
      const nuevasEmparejadas: FilaUI[] = [];
      for (const g of grupos) {
        if (g.length >= 2 && esFilaDoble(g[0])) {
          const vid = crypto.randomUUID();
          g.forEach((f, i) => nuevasEmparejadas.push({ ...f, vid, panoIndex: i }));
        } else {
          nuevasEmparejadas.push(...g);
        }
      }

      // Reemplazo COMPLETO de cortinas y adicionales con lo de la planilla.
      setFilas(nuevasEmparejadas.length ? nuevasEmparejadas : [nuevaFila()]);
      setAdicionales(nuevosAdic);
      setErroresImport(errores);
      setErroresImportAdic(erroresAdic);

      const conError = errores.size + erroresAdic.size;
      const resumen =
        `${nuevas.length} cortina(s) · ${nuevosAdic.length} adicional(es)` +
        (otCliente && !editOtId ? ` · OT ${otCliente}` : '');
      if (conError > 0) {
        toast.warning(`Importadas ${resumen} · ${conError} con datos a corregir (en rojo).`);
      } else {
        toast.success(`Importadas ${resumen}.`);
      }
      if (avisos.length) toast.warning(avisos.slice(0, 3).join(' '));
    } catch (e) {
      console.error(e);
      toast.error('No se pudo leer el Excel. Revisa que sea un archivo .xlsx válido.');
    }
  };

  const setAdic = (id: string, patch: Partial<AdicionalUI>) => {
    // Mismo criterio que las cortinas: se guarda la llave real del catálogo
    // ("dom42" → "DOM 42"), así el adicional trae producto, precio y DCT%.
    if ('codInt' in patch) patch = { ...patch, codInt: canonizarCodInt(patch.codInt) };
    const conDct =
      'codInt' in patch && !('descuento' in patch)
        ? { ...patch, descuento: dctDeCodigo(patch.codInt) }
        : patch;
    setAdicionales((prev) => prev.map((a) => (a.id === id ? { ...a, ...conDct } : a)));
    // Al editar el COD_INT de un adicional importado, le quitamos su marca roja.
    if ('codInt' in patch) {
      setErroresImportAdic((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  };
  const quitarAdic = (id: string) =>
    setAdicionales((prev) => prev.filter((a) => a.id !== id));

  const t = resultado.totales;
  const hayFiltro = filtroActivo !== null || busqueda.trim().length > 0;

  // Categorías de tela (A/B) de las CORTINAS de la cotización — distintivo en
  // la cabecera (también al importar una orden desde Excel). Los adicionales
  // (accesorios, cenefas) no cuentan: la categoría es un atributo de la tela.
  const catsTela = useMemo(
    () =>
      categoriasTela(
        filas.map((f) => f.codInt),
        catalogo,
      ),
    [filas, catalogo],
  );

  // Categorías de PRODUCTO de la cotización (ROL, BEEBLACK, DARK_38mm…): con
  // ellas y con las de tela se eligen los términos y condiciones que aplican.
  const catsProducto = useMemo(
    () => categoriasDeVentanas(filas.map((f) => ({ categoria: f.categoria }))),
    [filas],
  );

  // Lo que necesitan los bloques configurables para dibujarse.
  const datosBloques = useMemo(
    () => ({ terminos, categorias: catsProducto, telas: catsTela, parametros, fmtPct }),
    [terminos, catsProducto, catsTela, parametros],
  );

  // Cuántos paños tiene cada ventana (para el badge "Paño n/m" en la grilla).
  const panosPorVid = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filas) if (f.vid) m.set(f.vid, (m.get(f.vid) || 0) + 1);
    return m;
  }, [filas]);

  // Fase 3: solo lectura cuando la OT ya avanzó a Producción o más.
  const readOnlyFase3 =
    modo === 'fase3' &&
    !!otCargada &&
    ['produccion', 'lista', 'instalada', 'archivada'].includes(otCargada.estado);

  // Una OT que sigue en TERRENO no puede trabajarse en Fase 3 con la Fase 2 a
  // medias (se llegaba acá por URL o por el menú "Ir a fase" del Panel).
  useEffect(() => {
    if (modo !== 'fase3' || !otCargada || otCargada.estado !== 'terreno') return;
    const faltan = pendientesFase2(
      (otCargada.storeVentanas || []) as unknown as VentanaFase2[],
      undefined,
      reglas,
      catalogo,
    );
    if (faltan.length === 0) return;
    toast.error(`Falta completar la Fase 2: ${resumenPendientes(faltan)}.`);
    navigate(`/ots/${otCargada.id}/fase2`, { replace: true });
  }, [modo, otCargada, navigate]);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <span className="flex items-center gap-2 text-base font-bold">
          {(() => {
            const num =
              editOtId && otCargada
                ? `OT ${(otCargada.datosGenerales as Record<string, string>)?.ot ?? ''} · `
                : '';
            return modo === 'fase3'
              ? `${num}Cotización final (Fase 3)`
              : `${num}Cotización (Fase 1)`;
          })()}
          {readOnlyFase3 && (
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem] font-normal text-muted-foreground">
              Solo lectura ({otCargada?.estado})
            </span>
          )}
          {catsTela.map((c) => (
            <span
              key={c}
              title="Categoría de las telas de esta cotización (catálogo TELAS DEPURADAS)"
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs font-bold',
                c === 'B'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
              )}
            >
              Categoría {c}
            </span>
          ))}
        </span>
        <div className="flex items-center gap-2">
          <input
            ref={inputExcelRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importarExcel(file);
              e.target.value = ''; // permite re-importar el mismo archivo
            }}
          />
          <Button
            onClick={() => inputExcelRef.current?.click()}
            size="sm"
            variant="outline"
            className="gap-1.5"
            title="Cargar una cotización desde una planilla Excel"
          >
            <FileUp className="h-4 w-4" /> Importar Excel
          </Button>
          <Button onClick={() => window.print()} size="sm" variant="outline" className="gap-1.5">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* flex-col: el orden de las secciones y de los bloques del admin lo
          decide `order`, según el layout de Admin → Documento. */}
      <div className="flex flex-col px-5 py-4">
        {/* DATOS DEL CLIENTE */}
        <SeccionDocumento
          orden={ordenDoc('datos_cliente')}
          flotantes={flotantesDe(layoutDoc.bloques, 'datos_cliente')}
        >
        <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nombre" value={cliente.nombre} onChange={(v) => setCliente({ ...cliente, nombre: v })} />
          {!editOtId && (
            <Campo
              label="N° OT (Excel manual)"
              value={otManual}
              onChange={(v) => setOtManual(v)}
              placeholder="Vacío = automático"
              title="Número de OT de la planilla manual (OT CLIENTE). Si se deja vacío, la app asigna su correlativo automático. Se autocompleta al importar el Excel."
            />
          )}
          <Campo label="RUT" value={cliente.rut} onChange={(v) => setCliente({ ...cliente, rut: v })} />
          <Campo label="Teléfono" value={cliente.telefono} onChange={(v) => setCliente({ ...cliente, telefono: v })} />
          <Campo label="Mail" value={cliente.mail} onChange={(v) => setCliente({ ...cliente, mail: v })} />
          <Campo label="Dirección" value={cliente.direccion} onChange={(v) => setCliente({ ...cliente, direccion: v })} />
          <CampoComuna
            value={cliente.comuna}
            onChange={(v) =>
              setCliente((c) => ({
                ...c,
                comuna: v,
                // Si la comuna es de la RM, autocompleta la región.
                region: esComunaRM(v) ? REGION_METROPOLITANA : c.region,
              }))
            }
          />
          <CampoRegion
            value={cliente.region}
            onChange={(v) => setCliente((c) => ({ ...c, region: v }))}
          />
          <CampoEstado
            label="Instalación"
            value={sinInstalacion ? 'sin' : 'incluye'}
            onChange={(v) => setSinInstalacion(v === 'sin')}
            opciones={[
              { value: 'incluye', label: 'Incluye instalación', tono: 'ok' },
              { value: 'sin', label: 'Sin instalación', tono: 'mal' },
            ]}
          />
          <CampoEstado
            label="Envío"
            value={envio}
            onChange={(v) => setEnvio(v === 'cobro_destino' ? 'cobro_destino' : 'gratis')}
            opciones={[
              { value: 'gratis', label: 'Gratis', tono: 'ok' },
              { value: 'cobro_destino', label: 'Cobro en destino', tono: 'mal' },
            ]}
          />
          {/* Solo si alguna regla o algún ítem del catálogo depende del toggle
              (con los valores de fábrica, las 3 reglas de banda lo piden). */}
          {(hayOptInE78 || usarTuboE78) && (
            <CampoEstado
              label="Tubo E39 (2,2–3,0 m)"
              value={usarTuboE78 ? 'si' : 'no'}
              onChange={(v) => setUsarTuboE78(v === 'si')}
              opciones={[
                { value: 'no', label: 'Desactivado (tubo E66)' },
                { value: 'si', label: 'Activado (kit 45 + tubo E39)', tono: 'ok' },
              ]}
            />
          )}
          {region && !sinInstalacion && (
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                Descuento instalación región (%)
              </span>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                value={regionPctEff}
                onChange={(e) =>
                  setRegionDescPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                }
                title="0% = se cobra completa · 100% = gratis"
                className="text-right"
              />
            </label>
          )}
        </section>
        </SeccionDocumento>

        {/* CATÁLOGO con chips */}
        <SeccionDocumento
          orden={ordenDoc('catalogo')}
          flotantes={flotantesDe(layoutDoc.bloques, 'catalogo')}
        >
        <section className="mb-4 rounded-lg border border-border bg-card/40 p-3 print:hidden">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Catálogo · elige una categoría y agrega con un clic
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() =>
                setFiltroActivo(filtroActivo === FILTRO_TODOS ? null : FILTRO_TODOS)
              }
              title="Ver el catálogo completo"
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filtroActivo === FILTRO_TODOS
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary',
              )}
            >
              Todos
            </button>
            {chipsVisibles.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroActivo(filtroActivo === f.id ? null : f.id)}
                style={chipsColores[f.id] ? estiloChipHex(chipsColores[f.id]) : undefined}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-bold transition-all',
                  f.cls,
                  filtroActivo === f.id ? 'ring-2 ring-foreground ring-offset-1' : 'opacity-90 hover:opacity-100',
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setEditarColores(true)}
              className="rounded-md border border-border p-1 text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
              title="Editar los colores de las categorías"
            >
              <Palette className="h-3.5 w-3.5" />
            </button>
            <div className="relative ml-auto w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código…"
                className="h-8 pl-7 text-xs"
              />
            </div>
            {esAdmin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => setEditarProducto(null)}
                title="Crear un código nuevo en el catálogo"
              >
                <Plus className="h-3.5 w-3.5" /> Nuevo producto
              </Button>
            )}
          </div>

          {hayFiltro ? (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-[12px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <Th>COD_INT</Th>
                    <Th>PRODUCTO</Th>
                    <Th>DESCRIPCIÓN</Th>
                    <Th>TIPO</Th>
                    <Th className="text-right">PRECIO</Th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                        Sin productos para esta categoría/búsqueda.
                      </td>
                    </tr>
                  )}
                  {productosFiltrados.slice(0, TOPE_FILAS_CATALOGO).map(([ci, p]) => (
                    <tr key={ci} className="border-t border-border hover:bg-secondary/40">
                      <Td className="font-semibold">{ci}</Td>
                      <Td className="text-muted-foreground">{p.producto}</Td>
                      <Td className="text-[12px] text-muted-foreground">{p.descripcion}</Td>
                      <Td className="text-[12px] text-muted-foreground">{p.tipo}</Td>
                      <Td className="text-right tabular-nums">
                        {p.precio ? formatCLP(Number(p.precio)) : '—'}
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {esAdmin && (
                            <button
                              onClick={() => setEditarProducto(ci)}
                              className="rounded border border-border p-1 text-muted-foreground hover:border-accent/40 hover:text-accent"
                              title="Editar este producto del catálogo"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={() => agregarProducto(ci)}
                            className="rounded bg-accent px-2 py-0.5 text-[12px] font-semibold text-accent-foreground hover:bg-accent/90"
                            title={esCortinaTipo(p.tipo) ? 'Agregar como cortina' : 'Agregar como adicional'}
                          >
                            + Agregar
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productosFiltrados.length > TOPE_FILAS_CATALOGO && (
                <div className="border-t border-border bg-card/60 px-3 py-1 text-[12px] text-muted-foreground">
                  Mostrando {TOPE_FILAS_CATALOGO} de {productosFiltrados.length} — refina la
                  búsqueda para ver el resto.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
              Selecciona una categoría o escribe en el buscador para ver productos. También puedes
              seguir escribiendo el COD_INT directamente en la grilla de abajo.
            </div>
          )}
        </section>
        </SeccionDocumento>

        {/* GRILLA UNIFICADA (cortinas + adicionales con mismas columnas) */}
        <SeccionDocumento
          orden={ordenDoc('cortinas')}
          flotantes={flotantesDe(layoutDoc.bloques, 'cortinas')}
        >
        <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
          <datalist id="codint-options">
            {Object.entries(catalogo).map(([k, p]) => (
              <option key={k} value={k}>
                {p.producto}
              </option>
            ))}
          </datalist>

          <table className="w-full min-w-[1830px] border-collapse text-xs">
            <thead className="bg-card text-[12px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th colSpan={colSpanInfo} className="px-2 py-1.5 text-center font-semibold">Información del producto</th>
                <th colSpan={2} className="border-l border-border px-2 py-1.5 text-center font-semibold">Medidas</th>
                <th colSpan={4} className="border-l border-border px-2 py-1.5 text-center font-semibold">Precio</th>
                <th></th>
              </tr>
              <tr className="border-b border-border">
                <Th className="min-w-[6rem]">COD</Th>
                {showCols && (
                  <>
                    <Th className="min-w-[8rem]">COD SEC</Th>
                    <Th className="min-w-[8rem]">DIRECC. CAD/CIERRE</Th>
                    <Th className="min-w-[6rem]">SENT. CORT</Th>
                  </>
                )}
                <Th className="min-w-[3.5rem]">CANT</Th>
                <Th className="min-w-[12rem]">PRODUCTO</Th>
                <Th className="min-w-[6rem]">COD_INT</Th>
                <Th className="min-w-[5rem]">TIPO</Th>
                <Th className="min-w-[10rem]">DESCRIPCIÓN</Th>
                <Th className="min-w-[4.5rem] text-center">INVERTIDA</Th>
                <Th className="min-w-[5.5rem] text-center">CATEGORÍA</Th>
                <Th className="min-w-[5rem]">UBIC.</Th>
                <Th className="min-w-[7rem]">COLOR ACCESORIOS</Th>
                <Th className="min-w-[5rem] border-l border-border">ANCHO</Th>
                <Th className="min-w-[5rem]">ALTO</Th>
                <Th className="min-w-[4rem] border-l border-border">M²</Th>
                <Th className="min-w-[7rem]">VAL.UNIT.</Th>
                <Th className="min-w-[3.5rem]">DCT %</Th>
                <Th className="min-w-[7rem]">TOTAL</Th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {/* CORTINAS */}
              {filas.map((f) => {
                const prod = f.codInt ? catalogo[f.codInt.trim()] : undefined;
                const ln = lineaDeFila.get(f.id);
                const errs = erroresImport.get(f.id);
                // PLETINA (velcro): paño pegado, sin cadena ni enrollado → las dos
                // columnas de accionamiento/caída no aplican y se muestran "—".
                const esPletinaFila = esCategoriaPletina(f.categoria, reglas.tipos);
                return (
                  <tr key={f.id} className="border-t border-border align-middle">
                    <Td className="text-muted-foreground">{prod?.cod ?? '—'}</Td>
                    {showCols && (
                      <>
                        <Td><SelectCell value={f.categoria} onChange={(v) => setFila(f.id, esCategoriaOscuridad(v, reglas.tipos) ? { categoria: v, sentido: CAIDA_OSCURIDAD } : { categoria: v })} opciones={categoriasSelect} invalido={errs?.has('categoria')} /></Td>
                        <Td>
                          {/* La pletina va pegada con velcro: sin cadena no hay
                              lado de accionamiento que elegir. El beeblack sí lo
                              tiene, pero con su lista propia: su cierre corre de
                              lado o de arriba abajo, no lleva cadena. */}
                          {esPletinaFila ? (
                            <span
                              className="text-muted-foreground"
                              title="La cortina de velcro no lleva cadena: no tiene lado de accionamiento"
                            >
                              —
                            </span>
                          ) : (
                            <SelectCell value={f.direccion} onChange={(v) => setFila(f.id, { direccion: v })} opciones={esCategoriaBeeblack(f.categoria) ? DIRECCIONES_BEEBLACK : DIRECCIONES} invalido={errs?.has('direccion')} />
                          )}
                        </Td>
                        <Td>
                          {/* SENT. CORT = caída del enrollado (armado tela/tubo).
                              La vertical no se enrolla → sin caída. Los sistemas de
                              oscuridad SIEMPRE caen INTERNO (la variante interno/semi/
                              externo se elige en Fase 2). Resto: INTERNO/EXTERNO. */}
                          {esCategoriaVertical(f.categoria) || esCategoriaBeeblack(f.categoria) || esPletinaFila ? (
                            <span
                              className="text-muted-foreground"
                              title={
                                esCategoriaBeeblack(f.categoria)
                                  ? 'El beeblack no se enrolla; su variante de instalación se elige en Fase 2'
                                  : esPletinaFila
                                    ? 'La cortina de velcro no se enrolla: el paño va pegado'
                                    : 'La cortina vertical no tiene sentido de caída'
                              }
                            >
                              —
                            </span>
                          ) : esCategoriaOscuridad(f.categoria, reglas.tipos) ? (
                            <span
                              className="text-muted-foreground"
                              title="Los sistemas de oscuridad siempre caen INTERNO; la variante (interno/semi/externo) se elige en Fase 2"
                            >
                              INTERNO
                            </span>
                          ) : (
                            <SelectCell value={f.sentido} onChange={(v) => setFila(f.id, { sentido: v })} opciones={SENTIDOS} invalido={errs?.has('sentido')} />
                          )}
                        </Td>
                      </>
                    )}
                    <Td>
                      <CellInput type="number" min={1} value={f.cantidad || 1}
                        onChange={(e) => setFila(f.id, { cantidad: parseInt(e.target.value) || 1 })}
                        className="w-14 text-right" />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.producto ?? '—'}</Td>
                    <Td>
                      <CellInput list="codint-options" value={f.codInt}
                        onChange={(e) => setFila(f.id, { codInt: e.target.value })}
                        placeholder="ej. SC 68"
                        title={errs?.has('codInt') ? 'COD_INT no encontrado en el catálogo' : undefined}
                        className={cn(
                          'w-24',
                          errs?.has('codInt') && 'border-destructive bg-destructive/10 text-destructive',
                        )} />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.tipo ?? '—'}</Td>
                    <Td className="text-muted-foreground">{prod?.descripcion ?? '—'}</Td>
                    <Td className="text-center">
                      {(() => {
                        // Efectivo = flag explícito, o auto cuando el paño no
                        // entra normal en el rollo (misma regla que Fase 2).
                        const rollo = resolverAnchoRollo(
                          f.codInt, anchoRollo, catalogo, parametros.anchoRolloDefaultM,
                        );
                        const invEfectiva = f.invertida ?? debeInvertirPano(f.ancho, rollo);
                        return (
                          <button
                            onClick={() => setFila(f.id, { invertida: !invEfectiva })}
                            title={`Corte invertido (rotado): no entra normal en el rollo (${rollo.toFixed(2)} m)`}
                            className={cn(
                              'rounded-md border p-1.5 transition-colors',
                              invEfectiva
                                ? 'border-amber-400 bg-amber-500 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.55)]'
                                : 'border-border text-muted-foreground opacity-60 hover:border-amber-500/60 hover:text-amber-500 hover:opacity-100',
                            )}
                          >
                            <RotateCw className={cn('h-4 w-4', invEfectiva && 'stroke-[2.5]')} />
                          </button>
                        );
                      })()}
                    </Td>
                    <Td className="text-center">
                      {(() => {
                        // Efectivo = flag explícito, o la gama comercial de la
                        // tela. El clic lo fuerza para casos especiales (tela mal
                        // catalogada, o una cortina que va con otros herrajes).
                        // Acá SÍ va la versión sin guarda: el distintivo informa
                        // la gama de la TELA aunque el sistema no tenga herrajes
                        // B (lo aclara el globo, y `aplica` lo detecta abajo).
                        // Lo que se GUARDA usa `esLineaB`, con la guarda puesta.
                        const bEfectiva = f.lineaB ?? gamaTelaEsB(f.codInt, catalogo);
                        const forzada = f.lineaB !== undefined;
                        // La línea B solo tiene herrajes propios en roller simple,
                        // cenefa ovalada y dúo 38: en el resto de los sistemas la
                        // gama de la tela no cambia nada de la fabricación.
                        const aplica =
                          !f.categoria || categoriaTieneLineaB(f.categoria, reglas.mecanismo, reglas.tipos);
                        const sinReceta =
                          bEfectiva &&
                          aplica &&
                          !!f.categoria &&
                          mecLineaB(f.categoria, f.colorAcc, reglas.mecanismo, reglas.tipos) == null;
                        return (
                          <button
                            onClick={() => setFila(f.id, { lineaB: !bEfectiva })}
                            title={
                              (bEfectiva
                                ? 'Categoría B (gama económica: kit B, tubo E01). Clic para fabricarla en la categoría A.'
                                : 'Categoría A. Clic para fabricarla en la categoría B.') +
                              (forzada ? ' Forzada a mano.' : ' Según la tela del catálogo.') +
                              (bEfectiva && !aplica
                                ? ' Este sistema no tiene herrajes de categoría B: se fabrica igual que siempre.'
                                : '') +
                              (sinReceta
                                ? ' ⚠ La categoría B no tiene herrajes en este color: usa blanco o negro.'
                                : '')
                            }
                            className={cn(
                              'rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors',
                              sinReceta
                                ? 'border-destructive/50 bg-destructive/15 text-destructive'
                                : bEfectiva
                                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                                  : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25',
                              forzada && 'ring-1 ring-current',
                            )}
                          >
                            {bEfectiva ? 'B' : 'A'}
                          </button>
                        );
                      })()}
                    </Td>
                    <Td>
                      {f.vid && (panosPorVid.get(f.vid) || 0) > 1 && (
                        <span className="mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-accent">
                          Paño {(f.panoIndex ?? 0) + 1}/{panosPorVid.get(f.vid)}
                        </span>
                      )}
                      <CellInput value={f.ubicacion}
                        onChange={(e) => setFila(f.id, { ubicacion: e.target.value })}
                        placeholder="V1-G1" className="w-20" />
                    </Td>
                    <Td>
                      <CellInput value={f.colorAcc}
                        onChange={(e) => setFila(f.id, { colorAcc: e.target.value })}
                        placeholder="GRIS" className="w-24" />
                    </Td>
                    <Td className="border-l border-border">
                      <CellInput type="number" step="0.001" value={f.ancho || ''}
                        onChange={(e) => setFila(f.id, { ancho: parseFloat(e.target.value) || 0 })}
                        title={
                          errs?.has('ancho') ? 'Ancho inválido (debe ser mayor a 0, en metros)' : undefined
                        }
                        className={cn(
                          'w-20 text-right',
                          errs?.has('ancho') &&
                            'border-destructive bg-destructive/10 text-destructive',
                        )} />
                    </Td>
                    <Td>
                      <CellInput type="number" step="0.001" value={f.alto || ''}
                        onChange={(e) => setFila(f.id, { alto: parseFloat(e.target.value) || 0 })}
                        title={errs?.has('alto') ? 'Alto inválido (debe ser mayor a 0, en metros)' : undefined}
                        className={cn(
                          'w-20 text-right',
                          errs?.has('alto') && 'border-destructive bg-destructive/10 text-destructive',
                        )} />
                    </Td>
                    <Td className="border-l border-border text-right text-muted-foreground">
                      {ln ? ln.m2.toFixed(2) : '—'}
                    </Td>
                    <Td className="text-right">
                      {ln ? (
                        <button
                          type="button"
                          onClick={() => setDesgloseCod(ln.cod)}
                          className="underline decoration-dotted underline-offset-2 hover:text-accent print:no-underline"
                          title="Ver cómo se armó este precio"
                        >
                          {formatCLP(ln.valorUnit)}
                        </button>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <CellInput type="number" min={0} max={100} step="0.5" value={f.descuento || ''}
                        onChange={(e) => setFila(f.id, { descuento: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-right" placeholder="0" />
                    </Td>
                    <Td className="text-right font-semibold">{ln ? formatCLP(ln.total) : '—'}</Td>
                    <Td className="text-right print:hidden">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => duplicarFila(f.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent/10 hover:text-accent"
                          title="Duplicar fila">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => quitarFila(f.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Quitar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {/* Botón agregar cortina + categoría de todas de una vez */}
              <tr className="print:hidden">
                <td colSpan={colSpanTotal} className="border-t border-border bg-card/40 px-2 py-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => setFilas((p) => [...p, nuevaFila()])}>
                      <Plus className="h-3.5 w-3.5" /> Agregar cortina
                    </Button>
                    {/* Con muchas cortinas, cambiar la categoría una por una es
                        un suplicio: estos tres botones la fijan en TODAS las
                        filas de una vez (mismo efecto que el distintivo A/B de
                        cada fila). «Según tela» borra lo forzado y vuelve a la
                        gama de la tela del catálogo. */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Categoría de todas:</span>
                      {(
                        [
                          { txt: 'A', lineaB: false, title: 'Fabricar TODAS las cortinas en la categoría A' },
                          { txt: 'B', lineaB: true, title: 'Fabricar TODAS las cortinas en la categoría B (gama económica: kit B, tubo E01)' },
                          { txt: 'Según tela', lineaB: undefined, title: 'Quitar lo forzado a mano: cada cortina vuelve a la gama de su tela en el catálogo' },
                        ] as { txt: string; lineaB: boolean | undefined; title: string }[]
                      ).map((op) => (
                        <button
                          key={op.txt}
                          type="button"
                          title={op.title}
                          onClick={() => {
                            const n = filas.filter((f) => f.codInt).length;
                            setFilas((prev) => prev.map((f) => ({ ...f, lineaB: op.lineaB })));
                            toast.success(
                              op.lineaB === undefined
                                ? `${n} ${n === 1 ? 'cortina vuelve' : 'cortinas vuelven'} a la categoría de su tela.`
                                : `${n} ${n === 1 ? 'cortina' : 'cortinas'} a la categoría ${op.txt}.`,
                            );
                          }}
                          className={cn(
                            'rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors',
                            op.lineaB === true
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                              : op.lineaB === false
                                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                : 'border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {op.txt}
                        </button>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
              {/* Divisor ADICIONALES */}
              <tr>
                <td colSpan={colSpanTotal}
                  className="border-y-2 border-border bg-card/80 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Adicionales (instalaciones extras, cenefas, motores, controles, traslados…)
                </td>
              </tr>
              {/* ADICIONALES */}
              {adicionales.length === 0 && (
                <tr className="print:hidden">
                  <td colSpan={colSpanTotal} className="px-3 py-3 text-center text-xs text-muted-foreground">
                    Sin adicionales. Filtra el catálogo arriba para agregar con un clic, o usa el botón de abajo.
                  </td>
                </tr>
              )}
              {adicionales.map((a) => {
                const prod = a.codInt ? catalogo[a.codInt.trim()] : undefined;
                const r = adicResDeFila.get(a.id);
                return (
                  <tr key={a.id} className="border-t border-border align-middle">
                    <Td className="text-muted-foreground">
                      {prod?.cod ?? '—'}
                      {a.origen === 'pano' && (
                        <span
                          className="ml-1 rounded border border-accent/40 bg-accent/10 px-1 text-[9px] font-semibold text-accent"
                          title="Cenefa derivada del paño en Terreno. Para quitarla, cambia la cenefa en Fase 2."
                        >
                          auto
                        </span>
                      )}
                    </Td>
                    {showCols && (
                      <>
                        <Td className="text-center text-muted-foreground">—</Td>
                        <Td className="text-center text-muted-foreground">—</Td>
                        <Td className="text-center text-muted-foreground">—</Td>
                      </>
                    )}
                    <Td>
                      <CellInput type="number" step="0.01" value={a.cantidad || ''}
                        onChange={(e) => setAdic(a.id, { cantidad: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-right" />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.producto ?? '—'}</Td>
                    <Td>
                      <CellInput list="codint-options" value={a.codInt}
                        onChange={(e) => setAdic(a.id, { codInt: e.target.value })}
                        placeholder="ej. DOM 38"
                        title={erroresImportAdic.has(a.id) ? 'COD_INT no encontrado en el catálogo' : undefined}
                        className={cn(
                          'w-24',
                          erroresImportAdic.has(a.id) && 'border-destructive bg-destructive/10 text-destructive',
                        )} />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.tipo ?? '—'}</Td>
                    <Td className="text-muted-foreground">{prod?.descripcion ?? '—'}</Td>
                    <Td className="text-center text-muted-foreground">—</Td>
                    <Td>
                      <CellInput value={a.ubicacion}
                        onChange={(e) => setAdic(a.id, { ubicacion: e.target.value })}
                        placeholder="" className="w-20" />
                    </Td>
                    <Td>
                      <CellInput value={a.colorAcc}
                        onChange={(e) => setAdic(a.id, { colorAcc: e.target.value })}
                        placeholder="" className="w-24" />
                    </Td>
                    <Td className="border-l border-border text-center text-muted-foreground">—</Td>
                    <Td className="text-center text-muted-foreground">—</Td>
                    <Td className="border-l border-border text-center text-muted-foreground">—</Td>
                    <Td className="text-right">{r ? formatCLP(r.precioUnit) : '—'}</Td>
                    <Td>
                      <CellInput type="number" min={0} max={100} step="0.5" value={a.descuento || ''}
                        onChange={(e) => setAdic(a.id, { descuento: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-right" placeholder="0" />
                    </Td>
                    <Td className="text-right font-semibold">{r ? formatCLP(r.total) : '—'}</Td>
                    <Td className="text-right print:hidden">
                      <button onClick={() => quitarAdic(a.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Quitar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>
                );
              })}
              {/* Botón agregar adicional */}
              <tr className="print:hidden">
                <td colSpan={colSpanTotal} className="border-t border-border bg-card/40 px-2 py-2">
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => setAdicionales((p) => [...p, nuevoAdicional()])}>
                    <Plus className="h-3.5 w-3.5" /> Agregar adicional
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Avisos de importación de Excel (datos llave a corregir a mano) */}
        {(erroresImport.size > 0 || erroresImportAdic.size > 0) && (
          <section className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
            <p className="font-semibold">
              ⚠ Hay {erroresImport.size + erroresImportAdic.size} fila(s) importada(s)
              {erroresImport.size > 0 && ` · ${erroresImport.size} cortina(s)`}
              {erroresImportAdic.size > 0 && ` · ${erroresImportAdic.size} adicional(es)`}{' '}
              con datos a corregir (marcados en rojo en la grilla). Completa esas celdas para continuar.
            </p>
          </section>
        )}

        </SeccionDocumento>

        {/* TOTALES (los controles de Instalación / Envío / % región viven
            junto a los datos del cliente; acá solo van los montos). */}
        <SeccionDocumento
          orden={ordenDoc('totales')}
          flotantes={flotantesDe(layoutDoc.bloques, 'totales')}
        >
        {/* Los bloques marcados "junto a los totales" (por defecto, los
            términos) ocupan el espacio que quedaba vacío a la izquierda del
            recuadro de precios. En pantallas chicas se apilan. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start print:flex-row print:items-start">
          {bloquesTotales.length > 0 && (
            <div className="min-w-0 flex-1">
              {bloquesTotales.map((b) => (
                <BloqueDocRender key={b.id} bloque={b} datos={datosBloques} />
              ))}
            </div>
          )}
        <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
          {/* Bajo el mínimo de cortinas la instalación se cobra: mostrarla acá
              para que el subtotal no suba sin explicación. Con 4+ (o sin
              instalación) la línea vale 0 y no se muestra. El texto dice el
              MOTIVO: antes decía «bajo el mínimo» incluso en una cotización de
              región con más cortinas que el mínimo. */}
          {resultado.instalacion.total > 0 && (
            <>
              <FilaTotal
                label={`Instalación (${textoInstalacion(
                  resultado.instalacion,
                  parametros.instalacionGratisMinCortinas,
                )})`}
                valor={formatCLP(resultado.instalacion.total)}
              />
              {/* Con dos sistemas en juego (roller + beeblack) se instala a dos
                  precios: sin el desglose el total no cuadra a ojo. */}
              {resultado.instalacion.partes.length > 1 &&
                resultado.instalacion.partes.map((p) => (
                  <div
                    key={p.sistema}
                    className="flex justify-between pl-3 text-[11px] text-muted-foreground"
                  >
                    <span>
                      {p.sistema}: {p.cantidad} × {formatCLP(p.precioUnit)}
                    </span>
                    <span>{formatCLP(p.total)}</span>
                  </div>
                ))}
            </>
          )}
          <FilaTotal label="Subtotal neto" valor={formatCLP(t.subtotalNeto)} />
          <FilaTotal label={`IVA ${Math.round(parametros.iva * 100)}%`} valor={formatCLP(t.ivaTransferencia)} />
          {conPeorCaso && (
            <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
              Los sistemas de oscuridad se cotizan con el consumo de tela del montaje más caro
              (externo) mientras la instalación no se defina en Fase 2.
            </p>
          )}
          {/* Lo que el motor no pudo resolver: una tela fuera del catálogo o una
              familia sin precio dejan líneas en $0, y hasta ahora eso pasaba en
              silencio y el documento se mandaba igual. */}
          {resultado.avisos.length > 0 && (
            <div className="mt-1 rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] leading-snug print:hidden">
              {resultado.avisos.map((a, i) => (
                <p key={i}>{a.mensaje}</p>
              ))}
            </div>
          )}
          <FilaTotal label="Total transferencia" valor={formatCLP(t.totalTransferencia)} fuerte />
          <div className="my-1 border-t border-border" />
          <FilaTotal label="Total tarjeta crédito" valor={formatCLP(t.totalTarjeta)} />
          <FilaTotal
            label={`Abono ${Math.round(parametros.abonoInicial * 100)}% (inicio)`}
            valor={formatCLP(t.abono50)}
          />
          <div className="my-1 border-t border-border" />
          {modo === 'fase3' ? (
            readOnlyFase3 ? (
              <p className="text-center text-xs text-muted-foreground">
                La OT ya avanzó a {otCargada?.estado}: cotización en solo lectura.
              </p>
            ) : (
              <div className="space-y-2">
                <Button
                  onClick={() => guardarComoOT()}
                  disabled={guardandoOT}
                  variant="outline"
                  className="w-full gap-1.5"
                  title="Guarda los cambios de la cotización sin avanzar de fase"
                >
                  <Save className="h-4 w-4" />
                  {guardandoOT ? 'Guardando…' : 'Guardar cotización'}
                </Button>
                <Button
                  onClick={() => guardarComoOT({ aProduccion: true })}
                  disabled={guardandoOT}
                  className="w-full gap-1.5"
                  title="Aprueba la cotización y envía la OT a Producción (Fase 4)"
                >
                  <ArrowRight className="h-4 w-4" />
                  Aprobar y enviar a Producción
                </Button>
              </div>
            )
          ) : (
            <Button
              onClick={() => guardarComoOT()}
              disabled={guardandoOT}
              className="w-full gap-1.5"
              title="Crea la OT con las cortinas y el cliente, y continúa en Terreno (Fase 2)"
            >
              <Save className="h-4 w-4" />
              {guardandoOT ? 'Guardando…' : editOtId ? 'Guardar cambios en la OT' : 'Guardar como OT'}
            </Button>
          )}
        </section>
        </div>
        </SeccionDocumento>

        {editarProducto !== undefined && (
          <ProductoCatalogoDialog
            codInt={editarProducto}
            catalogo={catalogo}
            anchoRollo={anchoRollo}
            onClose={() => setEditarProducto(undefined)}
            onSaved={() => {
              refreshCatalogo();
              refreshAnchoRollo();
            }}
          />
        )}

        {editarColores && (
          <ChipsColoresDialog
            chips={FILTROS_CATALOGO.map((f) => ({
              id: f.id,
              label: f.label,
              hexDefault: f.hexDefault,
            }))}
            colores={chipsColores}
            onGuardar={guardarColoresChips}
            onClose={() => setEditarColores(false)}
          />
        )}

        {/* Cómo se armó el precio de una familia. Es el mismo panel del
            probador de Admin: la vendedora ve exactamente lo que vería quien
            edita los precios, sin tener que entrar al Admin. */}
        <Dialog open={desgloseCod !== null} onOpenChange={(v) => !v && setDesgloseCod(null)}>
          <DialogContent className="max-w-4xl print:hidden">
            <DialogHeader>
              <DialogTitle>Cómo se armó este precio</DialogTitle>
              <DialogDescription>
                Las cortinas de una misma familia se cotizan juntas: se suma la tela ya optimizada
                por paños, los materiales, la mano de obra y el traslado, y ese total se reparte
                entre los metros cuadrados de todas. Por eso agregar o quitar una cortina cambia el
                precio de las demás de su familia.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] overflow-y-auto">
              {familiaDesglose && (
                <PanelFamilia
                  f={familiaDesglose}
                  piezas={nombresDePiezas(
                    resultado.lineas.filter((l) => l.cod === familiaDesglose.cod),
                  )}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Bloques del admin (términos, banner de cuotas, cuadros de texto e
            imágenes). Van todos acá y cada uno se ubica con su `order`, así que
            pueden quedar entre cualquier par de secciones. Mismo componente que
            usa la vista previa del editor: lo que se configura es lo que se
            imprime. */}
        {bloquesEnFlujo(layoutDoc.bloques).map((b) =>
          esSeccion(b.tipo) || !b.visible ? null : (
            <div key={b.id} style={{ order: ordenDoc(b.id) }}>
              <BloqueDocRender bloque={b} datos={datosBloques} />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('whitespace-nowrap px-2 py-1.5 align-middle', className)}>{children}</td>;
}

function CellInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn(
        'h-7 rounded-md border-border bg-card px-2 py-0 text-xs focus:border-accent',
        props.className,
      )}
    />
  );
}

function SelectCell({
  value,
  onChange,
  opciones,
  invalido,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
  invalido?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-7 w-full max-w-[14rem] rounded-md border border-border bg-card px-1 text-xs focus:border-accent focus:outline-none',
        invalido && 'border-destructive bg-destructive/10 text-destructive',
      )}
    >
      <option value="">—</option>
      {opciones.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  title,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  title?: string;
}) {
  return (
    <label className="block" title={title}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

// Comuna: desplegable con las comunas de Santiago (RM). Combobox — si la
// comuna no está en la lista, igual se puede escribir a mano.
function CampoComuna({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Comuna</span>
      <Input
        list="comunas-santiago-rm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Elige o escribe…"
      />
      <datalist id="comunas-santiago-rm">
        {COMUNAS_SANTIAGO.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </label>
  );
}

// Desplegable de estado con código de color: la opción con tono 'ok' pinta el
// cuadro en verde (incluye instalación / envío gratis) y la de tono 'mal' en
// rojo (sin instalación / cobro en destino).
function CampoEstado({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: string;
  opciones: { value: string; label: string; tono?: 'ok' | 'mal' }[];
  onChange: (v: string) => void;
}) {
  const tono = opciones.find((o) => o.value === value)?.tono;
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 w-full rounded-md border px-2 text-sm font-semibold focus:outline-none',
          tono === 'ok' && 'border-success bg-success/25 text-success',
          tono === 'mal' && 'border-destructive bg-destructive/25 text-destructive',
          !tono && 'border-border bg-card',
        )}
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Región: desplegable con las 16 regiones de Chile. Combobox — se completa
// solo al elegir una comuna de la RM, y se puede cambiar a mano.
function CampoRegion({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Región</span>
      <Input
        list="regiones-chile"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Selecciona una región…"
      />
      <datalist id="regiones-chile">
        {REGIONES_CHILE.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </label>
  );
}

function FilaTotal({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-muted-foreground', fuerte && 'font-semibold text-foreground')}>{label}</span>
      <span className={cn('tabular-nums', fuerte ? 'text-base font-bold text-foreground' : 'text-foreground')}>
        {valor}
      </span>
    </div>
  );
}
