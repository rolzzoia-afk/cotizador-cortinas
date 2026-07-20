import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Copy, Palette, Pencil, Plus, RotateCw, Save, Trash2, Printer, Search, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCatalogoProductos, useAnchoRollo } from '@/modules/cotizador/catalogo';
import { recargoTarjetaEfectivo, useParametrosCotizador } from '@/modules/cotizador/parametros';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  chipDualPorLadoColor,
  modeloDesdeChipMecanismo,
  modeloVentanaPorAncho,
} from '@/modules/descuentos/chips';
import { categoriaEsDual, modelosParaCategoria } from '@/modules/descuentos/tipos';
import { otToRow } from '@/modules/ots/mappers';
import { useOT } from '@/modules/ots/hooks';
import type { AdicionalFase0Persistido, OT, VentanaItem } from '@/modules/ots/types';
import {
  cotizarFase0,
  type LineaResultado,
  type AdicionalResultado,
} from '@/modules/cotizador/motorFase0';
import { formatCLP } from '@/modules/cotizador/calculos';
import type { Producto } from '@/modules/cotizador/types';
import { categoriasTela } from '@/modules/cotizador/categoriaTela';
import {
  dualLadoDesdeDireccion,
  enriquecerVentanaDesdeFase0,
  tipoTelaDesdeProducto,
} from '@/modules/cotizador/fase0-sync';
import { emparejarDualesFase0 } from '@/modules/cotizador/fase0-dual';
import { OPCIONES_MECANISMO_DUAL } from '@/modules/cotizador/fase2';
import { debeInvertirPano, resolverAnchoRollo } from '@/modules/cotizador/tela';
import {
  agruparFilasPorVentana,
  construirPanosDeGrupo,
  explotarVentanasAFilas,
} from '@/modules/cotizador/fase0-reconcile';
import {
  derivarAdicionalesCenefaDesdeVentanas,
  existeCenefaManualEnUbic,
  tipoCenefaDesdeAdicional,
} from '@/modules/descuentos/adicionales-cenefa';
import ProductoCatalogoDialog from '@/components/cotizador/ProductoCatalogoDialog';
import ChipsColoresDialog from '@/components/cotizador/ChipsColoresDialog';
import BannerCuotas from '@/components/cotizador/BannerCuotas';
import { estiloChipHex, useChipsColores } from '@/modules/cotizador/chipsColores';
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
  type CampoFase0,
} from '@/modules/cotizador/importarExcelFase0';

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
  sentido: string;
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
  /** id de la ventana original (si la fila viene de una OT existente). */
  vid?: string;
  /** índice del paño dentro de su ventana (una fila por paño en la cotización). */
  panoIndex?: number;
};

// Campos de nivel VENTANA: al editarlos en una fila-paño se replican a los
// demás paños de la misma ventana (`vid`) para que no diverjan (el re-agrupado
// toma el primer paño). ancho/alto/color/descuento quedan por paño.
const CAMPOS_NIVEL_VENTANA: (keyof FilaUI)[] = [
  'codInt', 'categoria', 'direccion', 'sentido', 'cantidad', 'ubicacion',
];
const nuevaFila = (): FilaUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  categoria: '',
  direccion: '',
  sentido: '',
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
const SENTIDOS = ['INTERNO', 'EXTERNO'];
const CATEGORIAS_MECANISMO = [
  'ROL', 'ROL_DUAL', 'ROL_MANUAL_CENEFA_OVALADA_38mm', 'ROL_MANUAL_CENEFA_OVALADA_45mm',
  'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', 'ROL_CENEFA_OVALADA_MOTOR_GRANDE', 'PLETINA_ROLLER_V',
  'DUO_MANUAL_38mm', 'DUO_MANUAL_45mm', 'DUO_MOTOR_PEQUEÑO_38mm', 'DUO_MOTOR_GRANDE_45mm',
  'PLETINA_DUO_V', 'VERTICAL', 'SOFT_LIGHT_38mm', 'SOFT_LIGHT_45mm', 'DARK_38mm', 'DARK_45mm',
  'OSCURANTI_63mm', 'BEEBLACK',
];

const N = (s?: string) => (s || '').toUpperCase();

const CHIP_DE_CODINT: Record<string, string> = {
  // MOT
  'DOM 01': 'MOT', 'DOM 02': 'MOT', 'DOM 03': 'MOT', 'DOM 05': 'MOT', INSTMOT: 'MOT',
  // MOTOR MG
  'DOM 33': 'MOTOR_MG', 'DOM 34': 'MOTOR_MG', 'DOM 38': 'MOTOR_MG', 'DOM 39': 'MOTOR_MG', INSTMOTMG: 'MOTOR_MG',
  // SOFT
  SOFTLDER: 'SOFT', SOFTLIZQ: 'SOFT', 'CENF O': 'SOFT', INSTSOFT: 'SOFT',
  // OSCURA
  'CEN-PRO': 'OSCURA', 'P-DER': 'OSCURA', 'P-IZQ': 'OSCURA', 'P-INST': 'OSCURA',
  // MOT VERT
  'MOT 01': 'MOT_VERT', 'MOT 03': 'MOT_VERT', 'INSTMOT-VERT': 'MOT_VERT',
  // MOTOR GRANDE
  'DOM 35': 'MOTOR_GRANDE', 'DOM 36': 'MOTOR_GRANDE', 'DOM 37': 'MOTOR_GRANDE', INSTMOTCA: 'MOTOR_GRANDE',
};

type Filtro = {
  id: string;
  label: string;
  cls: string;
  /** Color por defecto del chip (equivalente hex de sus clases Tailwind). */
  hexDefault: string;
  match: (p: Producto, codInt: string) => boolean;
};
const enChip = (ci: string, chip: string) => CHIP_DE_CODINT[ci.trim()] === chip;
const FILTROS_CATALOGO: Filtro[] = [
  { id: 'BK', label: 'BK', cls: 'bg-amber-100 text-amber-900 border-amber-400', hexDefault: '#fef3c7',
    match: (p) => ['BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S'].includes(N(p.cod)) },
  { id: 'BK_V', label: 'BK VERT', cls: 'bg-orange-200 text-orange-900 border-orange-400', hexDefault: '#fed7aa',
    match: (p) => N(p.cod).startsWith('BLACKOUT_V') },
  { id: 'SCR', label: 'SCR', cls: 'bg-green-200 text-green-900 border-green-500', hexDefault: '#bbf7d0',
    match: (p) => ['SCREEN_P', 'SCREEN_D', 'SCREEN_S'].includes(N(p.cod)) },
  { id: 'SC_V', label: 'SC VERT', cls: 'bg-emerald-300 text-emerald-900 border-emerald-600', hexDefault: '#6ee7b7',
    match: (p) => N(p.cod).startsWith('SCREEN_V') },
  { id: 'DUO_BK', label: 'DUO BK', cls: 'bg-sky-200 text-sky-900 border-sky-400', hexDefault: '#bae6fd',
    match: (p) => N(p.cod).startsWith('DUOBK') },
  { id: 'DUO_POLI', label: 'DUO POLI', cls: 'bg-blue-200 text-blue-900 border-blue-500', hexDefault: '#bfdbfe',
    match: (p) => N(p.cod).startsWith('DUOPOLI') },
  { id: 'SOFT', label: 'SOFT', cls: 'bg-lime-400 text-lime-950 border-lime-600', hexDefault: '#a3e635',
    match: (_p, ci) => enChip(ci, 'SOFT') },
  { id: 'OSCURA', label: 'OSCURA', cls: 'bg-teal-400 text-teal-950 border-teal-600', hexDefault: '#2dd4bf',
    match: (_p, ci) => enChip(ci, 'OSCURA') },
  { id: 'MOT_VERT', label: 'MOT VERT', cls: 'bg-purple-300 text-purple-950 border-purple-600', hexDefault: '#d8b4fe',
    match: (_p, ci) => enChip(ci, 'MOT_VERT') },
  { id: 'MOT', label: 'MOT', cls: 'bg-amber-700 text-white border-amber-800', hexDefault: '#b45309',
    match: (_p, ci) => enChip(ci, 'MOT') },
  { id: 'MOTOR_GRANDE', label: 'MOTOR GRANDE', cls: 'bg-fuchsia-500 text-white border-fuchsia-700', hexDefault: '#d946ef',
    match: (_p, ci) => enChip(ci, 'MOTOR_GRANDE') },
  { id: 'MOTOR_MG', label: 'MOTOR MG', cls: 'bg-gray-400 text-gray-950 border-gray-600', hexDefault: '#9ca3af',
    match: (_p, ci) => enChip(ci, 'MOTOR_MG') },
];

const esCortinaTipo = (tipo: string): boolean =>
  ['PREMIUM', 'DELUX', 'STANDARD', 'BASIC'].includes((tipo || '').toUpperCase().trim());

// % es-CL con hasta 2 decimales: 0.138 → "13,8" · 0.0415 → "4,15".
const fmtPct = (v: number) => (Math.round(v * 10000) / 100).toLocaleString('es-CL');

// COD_INT de la instalación roller base. Desde Fase 2 la instalación se calcula
// automáticamente (regla 4+ gratis / región), así que se filtra de los
// adicionales manuales para no cobrarla dos veces (la instalación de motor,
// soft, cenefa —INSTMOT, INSTSOFT, INSTCENF…— sí siguen siendo manuales).
const COD_INSTALACION_BASE = 'INST';
const esInstalacionBase = (ci: string) => (ci || '').trim().toUpperCase() === COD_INSTALACION_BASE;

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
  // La columna INVERTIDA va en ambos modos (+1 a los colspans).
  const showCols = modo === 'fase3';
  const colSpanTotal = showCols ? 19 : 16;
  const colSpanInfo = showCols ? 12 : 9;
  const { ot: otCargada, guardarCompleto } = useOT(editOtId);
  const { empresaId } = useAuth();
  const { catalogo, refresh: refreshCatalogo } = useCatalogoProductos();
  const { anchoRollo, refresh: refreshAnchoRollo } = useAnchoRollo();
  const { parametros } = useParametrosCotizador();
  const { modelos: modelosDespiece } = useDescuentosModelo();

  const [cliente, setCliente] = useState<Cliente>(EMPTY_CLIENTE);
  // N° de OT manual (transición desde el Excel legado): si viene, la OT se
  // crea con ESTE número en vez del correlativo automático de la app. Se
  // autocompleta al importar un Excel que traiga "OT CLIENTE" en el encabezado.
  const [otManual, setOtManual] = useState('');
  const [filas, setFilas] = useState<FilaUI[]>([nuevaFila()]);
  const [adicionales, setAdicionales] = useState<AdicionalUI[]>([]);
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
    setFilas(nuevasFilas.length ? nuevasFilas : [nuevaFila()]);
    // Adicionales = manuales persistidos + cenefas DERIVADAS de los paños.
    // 'INST' (instalación base) es automático → se descarta. Los derivados de
    // una apertura anterior (origen 'pano') se descartan y se regeneran acá,
    // así no se acumulan; y no se duplica lo que el usuario puso a mano.
    const persistidos = adicionalesFromPersist(dg.adicionalesFase0).filter(
      (a) => !esInstalacionBase(a.codInt),
    );
    const manuales = persistidos.filter((a) => a.origen !== 'pano');
    const derivados = derivarAdicionalesCenefaDesdeVentanas(vts).filter((d) => {
      const tipo = tipoCenefaDesdeAdicional(d.codInt);
      return tipo ? !existeCenefaManualEnUbic(manuales, tipo, d.ubicacion || '') : true;
    });
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
    setOrigVentanas(orig as Record<string, Record<string, unknown>>);
    setCargadoEdit(true);
  }, [editOtId, otCargada, cargadoEdit]);

  // Guarda la cotización como OT: cliente + ventanas (con el modelo de
  // fabricación elegido por categoría y color) y sigue el flujo en Fase 2.
  const guardarComoOT = async (opts?: { aProduccion?: boolean }) => {
    if (!empresaId) return;
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
        const esDual = categoriaEsDual(head.categoria);
        const anchoGrupo = g.filas.reduce((mx, f) => Math.max(mx, f.ancho || 0), 0);
        let modeloCalc = modeloVentanaPorAncho(
          modelosDespiece,
          head.categoria,
          head.colorAcc,
          anchoGrupo,
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
                modelosParaCategoria(modelosDespiece, head.categoria),
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
          { persistirCodInt: esDual },
        );
        // Dual: cada paño lleva SU tela (producto/descripción/tipoTela del catálogo);
        // la ventana conserva la del paño 0 (head) para consumidores nivel-ventana.
        if (esDual) {
          panos.forEach((p, i) => {
            const f = g.filas[i];
            const prodP = f ? catalogo[(f.codInt || '').trim()] : undefined;
            p.codInt = f?.codInt || '';
            p.producto = prodP?.producto ?? '';
            p.descripcion = prodP?.descripcion ?? '';
            p.tipoTela = tipoTelaDesdeProducto(prodP?.cod, f?.codInt);
          });
        }
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
          panos,
          modelo: (orig?.modelo as unknown) ?? modeloCalc,
        };
        return enriquecerVentanaDesdeFase0(
          ventana as never,
          catalogo,
          adicionalesGuardados,
        ) as unknown as Record<string, unknown>;
      };
      const ventanas = agruparFilasPorVentana(validas).map(construirVentanaGrupo);
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
      let numOT = otManual.trim();
      if (numOT) {
        const { data: dups, error: errDup } = await supabase
          .from('ots')
          .select('id')
          .eq('empresa_id', empresaId)
          .eq('numero_ot', numOT)
          .limit(1);
        if (errDup) throw errDup;
        if ((dups ?? []).length > 0) {
          toast.error(
            `Ya existe una OT con el número ${numOT}. Usa otro (ej. ${numOT}-B) o deja el campo vacío para el correlativo automático.`,
          );
          return;
        }
      } else {
        const { data: numGen, error: errNum } = await supabase.rpc('generar_numero_ot' as never, {
          p_empresa_id: empresaId,
        } as never);
        if (errNum) throw errNum;
        numOT = String(numGen ?? '');
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
    return cotizarFase0(filasMotor, catalogo, anchoRollo, adicMotor, paramsEff, region, sinInstalacion);
  }, [filas, adicionales, catalogo, anchoRollo, parametros, region, regionPctEff, sinInstalacion]);

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
    const filtro = filtroActivo ? FILTROS_CATALOGO.find((f) => f.id === filtroActivo) : null;
    return Object.entries(catalogo)
      .filter(([ci, p]) => {
        if (filtro && !filtro.match(p, ci)) return false;
        if (q) {
          const hay = `${ci} ${p.producto || ''} ${p.cod || ''}`.toUpperCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a[1].producto || '').localeCompare(b[1].producto || ''));
  }, [catalogo, filtroActivo, busqueda]);

  // DCT% por defecto (0–100) del código, tomado del catálogo. Autollena la
  // columna al elegir/importar un COD_INT; el usuario lo puede editar después.
  const dctDeCodigo = (ci: string | undefined): number =>
    Math.round((Number(catalogo[(ci || '').trim()]?.descuento) || 0) * 100);

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
    // Al cambiar el COD_INT, autollenar el DCT% con el descuento del código
    // (salvo que el patch ya traiga un descuento explícito).
    const conDct =
      'codInt' in patch && !('descuento' in patch)
        ? { ...patch, descuento: dctDeCodigo(patch.codInt) }
        : patch;
    setFilas((prev) => {
      const fila = prev.find((f) => f.id === id);
      const vid = fila?.vid;
      // Los campos de nivel ventana se replican a los demás paños del mismo vid.
      const espejo =
        !!vid && Object.keys(conDct).some((k) => CAMPOS_NIVEL_VENTANA.includes(k as keyof FilaUI));
      // Dual: cada paño (fila) mantiene SU tela → el codInt NO se replica a los
      // demás paños de la ventana (el resto de campos nivel-ventana sí).
      const catEfectiva = (conDct.categoria as string) ?? fila?.categoria ?? '';
      const esDualFila = categoriaEsDual(catEfectiva);
      const soloVentana = (): Partial<FilaUI> => {
        const sub: Partial<FilaUI> = {};
        for (const k of CAMPOS_NIVEL_VENTANA) {
          if (k === 'codInt' && esDualFila) continue;
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
      for (const k of Object.keys(patch)) campos.delete(k as CampoFase0);
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
        categorias: new Set(CATEGORIAS_MECANISMO),
        direcciones: new Set(DIRECCIONES),
        sentidos: new Set(SENTIDOS),
      };

      // ── Cortinas ──
      const nuevas: FilaUI[] = [];
      const errores = new Map<string, Set<CampoFase0>>();
      for (const c of cortinas) {
        const categoria = canonizar(c.categoria, CATEGORIAS_MECANISMO);
        const direccion = canonizar(c.direccion, DIRECCIONES);
        const sentido = canonizar(c.sentido, SENTIDOS);
        const fila: FilaUI = {
          id: crypto.randomUUID(),
          codInt: c.codInt,
          categoria,
          direccion,
          sentido,
          cantidad: c.cantidad || 1,
          ubicacion: c.ubicacion,
          colorAcc: c.colorAcc,
          ancho: c.ancho,
          alto: c.alto,
          descuento: dctDeCodigo(c.codInt),
        };
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
        nuevosAdic.push({
          id,
          codInt: a.codInt,
          cantidad: a.cantidad || 1,
          descuento: dctDeCodigo(a.codInt),
          ubicacion: a.ubicacion,
          colorAcc: a.colorAcc,
        });
        if (!a.codInt || !catalogo[a.codInt.trim()]) erroresAdic.set(id, new Set(['codInt']));
      }

      // Dual (roller doble tela): las 2 filas ROL_DUAL de la misma UBIC se
      // fusionan en UNA cortina de 2 paños (SCR primero = tela al vidrio) con un
      // `vid` compartido + `panoIndex` 0/1. Las no-dual quedan como filas sueltas.
      const { grupos, avisos } = emparejarDualesFase0(nuevas, (f) =>
        tipoTelaDesdeProducto(catalogo[f.codInt.trim()]?.cod, f.codInt),
      );
      const nuevasEmparejadas: FilaUI[] = [];
      for (const g of grupos) {
        if (g.length >= 2 && categoriaEsDual(g[0].categoria)) {
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

      <div className="px-5 py-4">
        {/* DATOS DEL CLIENTE */}
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

        {/* CATÁLOGO con chips */}
        <section className="mb-4 rounded-lg border border-border bg-card/40 p-3 print:hidden">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Catálogo · elige una categoría y agrega con un clic
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFiltroActivo(null)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filtroActivo === null
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary',
              )}
            >
              Todos
            </button>
            {FILTROS_CATALOGO.map((f) => (
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
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setEditarProducto(null)}
              title="Crear un código nuevo en el catálogo"
            >
              <Plus className="h-3.5 w-3.5" /> Nuevo producto
            </Button>
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
                  {productosFiltrados.slice(0, 200).map(([ci, p]) => (
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
                          <button
                            onClick={() => setEditarProducto(ci)}
                            className="rounded border border-border p-1 text-muted-foreground hover:border-accent/40 hover:text-accent"
                            title="Editar este producto del catálogo"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
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
              {productosFiltrados.length > 200 && (
                <div className="border-t border-border bg-card/60 px-3 py-1 text-[12px] text-muted-foreground">
                  Mostrando 200 de {productosFiltrados.length} — refina la búsqueda para ver el resto.
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

        {/* GRILLA UNIFICADA (cortinas + adicionales con mismas columnas) */}
        <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
          <datalist id="codint-options">
            {Object.entries(catalogo).map(([k, p]) => (
              <option key={k} value={k}>
                {p.producto}
              </option>
            ))}
          </datalist>

          <table className="w-full min-w-[1760px] border-collapse text-xs">
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
                return (
                  <tr key={f.id} className="border-t border-border align-middle">
                    <Td className="text-muted-foreground">{prod?.cod ?? '—'}</Td>
                    {showCols && (
                      <>
                        <Td><SelectCell value={f.categoria} onChange={(v) => setFila(f.id, { categoria: v })} opciones={CATEGORIAS_MECANISMO} invalido={errs?.has('categoria')} /></Td>
                        <Td><SelectCell value={f.direccion} onChange={(v) => setFila(f.id, { direccion: v })} opciones={DIRECCIONES} invalido={errs?.has('direccion')} /></Td>
                        <Td><SelectCell value={f.sentido} onChange={(v) => setFila(f.id, { sentido: v })} opciones={SENTIDOS} invalido={errs?.has('sentido')} /></Td>
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
                    <Td className="text-right">{ln ? formatCLP(ln.valorUnit) : '—'}</Td>
                    <Td>
                      <CellInput type="number" min={0} max={100} step="1" value={f.descuento || ''}
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
              {/* Botón agregar cortina */}
              <tr className="print:hidden">
                <td colSpan={colSpanTotal} className="border-t border-border bg-card/40 px-2 py-2">
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => setFilas((p) => [...p, nuevaFila()])}>
                    <Plus className="h-3.5 w-3.5" /> Agregar cortina
                  </Button>
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
                      <CellInput type="number" min={0} max={100} step="1" value={a.descuento || ''}
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

        {/* TOTALES (los controles de Instalación / Envío / % región viven
            junto a los datos del cliente; acá solo van los montos). */}
        <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <FilaTotal label="Subtotal neto" valor={formatCLP(t.subtotalNeto)} />
          <FilaTotal label="IVA 19%" valor={formatCLP(t.ivaTransferencia)} />
          <FilaTotal label="Total transferencia" valor={formatCLP(t.totalTransferencia)} fuerte />
          <div className="my-1 border-t border-border" />
          <FilaTotal label="Total tarjeta crédito" valor={formatCLP(t.totalTarjeta)} />
          <FilaTotal label="Abono 50% (inicio)" valor={formatCLP(t.abono50)} />
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

        <section className="mt-4 rounded-lg border border-border bg-card/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Condiciones</div>
          Cotización válida por 5 días. Pago: 50% para iniciar la fabricación y 50% al finalizar la
          instalación.{' '}
          {parametros.proveedorTarjeta === 'flow'
            ? `Tarjeta de crédito vía Flow (recargo ${fmtPct(recargoTarjetaEfectivo(parametros))}%): las cuotas y sus intereses dependen de tu banco.`
            : `Tarjeta de crédito hasta 12 cuotas sin interés (recargo Mercado Pago ${fmtPct(recargoTarjetaEfectivo(parametros))}%).`}{' '}
          Primera visita sin costo previa cotización (RM en AVN). Las cortinas se fabrican a medida;
          una vez confeccionadas no hay devolución de dinero. Verificar stock de la tela antes de pagar.
        </section>

        {/* Banner de cuotas al pie de la cotización (visible también al imprimir).
            Con Flow no hay 12 cuotas sin interés: el banner cambia de mensaje. */}
        <div className="mt-6 flex justify-center pb-4">
          <BannerCuotas proveedor={parametros.proveedorTarjeta} />
        </div>
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
  opciones: { value: string; label: string; tono: 'ok' | 'mal' }[];
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
