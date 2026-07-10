import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOT } from '@/modules/ots/hooks';
import {
  crearPanoVacio,
  OPCIONES_MECANISMO,
  OPCIONES_MECANISMO_DUAL,
  OPCIONES_MECANISMO_RESOLUCION,
  OPCIONES_TUBERIA,
  PANO_COLORS,
  postInstalacionVacia,
  resumenPanos,
  tipoVentanaLabel,
  validarVentana,
  type PostInstalacionData,
} from '@/modules/cotizador/fase2';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { obtenerAnchoRollo } from '@/modules/cotizador/tela';
import {
  COLORES_CONJUNTO,
  coloresPorGrupo,
  esVentanaInvertida,
  juntarVentanas,
  limpiarGruposHuerfanos,
  quitarDeConjunto,
} from '@/modules/cotizador/conjuntos';
import { JuntarConjuntoDialog } from '@/components/cotizador/JuntarConjuntoDialog';
import { CATEGORIAS_FASE1, catBadgeColor } from '@/modules/cotizador/categorias';
import {
  direccionDesdeCierre,
  enriquecerPanoDesdeFase0,
  enriquecerVentanaDesdeFase0,
  sentidoDesdeArmado,
} from '@/modules/cotizador/fase0-sync';
import { ProductoSelectorFase2 } from '@/components/cotizador/ProductoSelectorFase2';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { esCadenaRoller, esPesoSeleccionable, type CadenaInsumo } from '@/modules/cotizador/cadenas';
import { PanoEditor } from '@/components/cotizador/PanoEditor';
import { PostInstalacion } from '@/components/cotizador/PostInstalacion';
import type { Pano, Ventana } from '@/modules/cotizador/types';
import { confirmar } from '@/components/ui/confirm';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  categoriaEsDual,
  claveModelo,
  elegirModeloPorColor,
  modelosParaCategoria,
} from '@/modules/descuentos/tipos';
import {
  canonizarChipTuberia,
  categoriaRequiereMecanismo,
  chipDualPorLadoColor,
  colorAccesoriosDePano,
  esChipDual,
  ladoColorDesdeChipDual,
  mecanismoParaPano,
  modeloDesdeChipMecanismo,
  modeloPorAncho,
  modeloSimple38PorColor,
  opcionesMecanismoFiltradas,
  opcionesTuberiaFiltradas,
  tuberiaCorregidaPorMecanismo,
  tuberiaParaPano,
} from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

type Tab = 'ventanas' | 'post';

export function CotizadorFase2() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const { catalogo } = useCatalogoProductos();
  const { parametros } = useParametrosCotizador();

  const { empresaId } = useAuth();
  const { modelos } = useDescuentosModelo();
  const [tab, setTab] = useState<Tab>('ventanas');
  const [cadenas, setCadenas] = useState<CadenaInsumo[]>([]);
  const [pesos, setPesos] = useState<CadenaInsumo[]>([]);
  const [editandoId, setEditandoId] = useState<string | number | null>(null);
  const [ventanaForm, setVentanaForm] = useState<Ventana | null>(null);
  const [panoActivo, setPanoActivo] = useState(0);
  const [postData, setPostData] = useState<PostInstalacionData>(postInstalacionVacia());
  const [savingPost, setSavingPost] = useState(false);
  const [savingVentana, setSavingVentana] = useState(false);
  const [avanzando, setAvanzando] = useState(false);
  // Conjuntos de cortinas invertidas: dialog "¿Juntar con otra cortina?" y
  // los ids que ya dijeron "No juntar" (no volver a preguntar en la sesión).
  const [dialogJuntar, setDialogJuntar] = useState(false);
  const [juntarDescartado, setJuntarDescartado] = useState<Set<string | number>>(new Set());

  const ventanas: Ventana[] = useMemo(
    () => ((ot?.storeVentanas || []) as unknown as Ventana[]),
    [ot],
  );

  // Color de destacado por conjunto (grupoId → índice en la paleta, por
  // orden de aparición en storeVentanas).
  const colorIdxGrupos = useMemo(() => coloresPorGrupo(ventanas), [ventanas]);
  const claseDeGrupo = (gid?: string | null) =>
    gid && colorIdxGrupos.has(gid)
      ? COLORES_CONJUNTO[colorIdxGrupos.get(gid)! % COLORES_CONJUNTO.length]
      : undefined;
  // Invertida efectiva con el MISMO ancho de rollo que ve PanoEditor en esta
  // pantalla (catálogo; el map global de ancho_rollo_data es cosa de Fase 0).
  const esInvertidaV = (v: Ventana) =>
    esVentanaInvertida(v, obtenerAnchoRollo(v.codInt, catalogo, parametros.anchoRolloDefaultM));

  // Cargar las cadenas del inventario (CAD01…) para el selector del paño.
  useEffect(() => {
    if (!empresaId) return;
    let activo = true;
    supabase
      .from('insumos')
      .select('cod,nemotecnico,color,status')
      .eq('empresa_id', empresaId)
      .then(({ data }) => {
        if (!activo || !data) return;
        const insumos = data as CadenaInsumo[];
        setCadenas(insumos.filter((i) => esCadenaRoller(i.cod)));
        setPesos(insumos.filter((i) => esPesoSeleccionable(i.cod)));
      });
    return () => {
      activo = false;
    };
  }, [empresaId]);

  // Cargar post-instalación existente al abrir la OT
  useEffect(() => {
    if (!ot) return;
    const existente = (ot.datosGenerales?.postInstalacion as PostInstalacionData | undefined);
    if (existente) {
      setPostData({
        checks:
          existente.checks && existente.checks.length > 0
            ? existente.checks
            : postInstalacionVacia().checks,
        encuesta:
          existente.encuesta && existente.encuesta.length > 0
            ? existente.encuesta
            : postInstalacionVacia().encuesta,
        observaciones: existente.observaciones || '',
      });
    }
  }, [ot]);

  // Marca en los paños los chips de MECANISMO y TUBERÍA (reglas-mecanismo /
  // reglas-tuberia). Usa la lista de RESOLUCIÓN (incluye chips legacy) para
  // no perder mecanismos guardados en OTs viejas. Además fija la cenefa
  // Ovalada cuando la propia categoría la implica (ROL_*_CENEFA_OVALADA_*).
  const sincronizarChips = (
    v: Ventana,
    modelo: ModeloDespiece | null,
    forzarTuberia = false,
  ): Ventana => {
    const categoriaImplicaOvalada = (v.categoria || '')
      .toUpperCase()
      .includes('CENEFA_OVALADA');
    // La categoría ROL_DUAL implica mecanismo dual: fuerza dual=true en los paños
    // (sin esto quedaba un kit simple con modelo dual → BOM/despiece incoherentes).
    const categoriaImplicaDual = categoriaEsDual(v.categoria || '');
    const esDualV = categoriaImplicaDual || (v.panos || []).some((p) => p.dual);
    // Modelo efectivo por ANCHO (roller simple >3 m → fila 63 mm/tubo E65; al
    // bajar de 3 m vuelve al 38 mm). Es la contraparte "al abrir/sincronizar" de
    // la cascada que corre al editar: sin esto, una OT >3 m abierta se queda con
    // el modelo de 38 mm y muestra E66 en vez de E65. No aplica a dual (mantiene
    // su modelo ROLLER_DUAL).
    const anchoRef = (v.panos || []).reduce(
      (mx, p) => Math.max(mx, parseFloat(String(p.ancho ?? 0)) || 0),
      0,
    );
    const colorRef = colorAccesoriosDePano(v.panos?.[0] || {}, v.color);
    const modeloEf = esDualV
      ? modelo
      : modeloPorAncho(modelos, v.categoria || '', anchoRef, modelo, colorRef);
    return {
      ...v,
      modelo: modeloEf,
      panos: v.panos.map((p) => {
        const dual = categoriaImplicaDual || !!p.dual;
        const pDual = dual === !!p.dual ? p : { ...p, dual };
        const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
        const mecanismo =
          mecanismoParaPano(pDual, v.color, modeloEf, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoM) ||
          p.mecanismo;
        // Canoniza siempre el chip guardado (solo formato): una OT vieja con
        // "0,38mm [E02] 1,2mm" migra a "E02-TUBO…" aunque no haya modelo/ancho
        // para pre-seleccionar, así el chip guardado queda resaltado en el editor.
        const tuberia = canonizarChipTuberia(
          modeloEf && anchoM > 0
            ? tuberiaParaPano(anchoM, modeloEf, p.tuberia as string, OPCIONES_TUBERIA, v.categoria)
            : forzarTuberia && modeloEf
              ? tuberiaParaPano(anchoM, modeloEf, p.tuberia as string, OPCIONES_TUBERIA, v.categoria) ||
                (p.tuberia as string)
              : (p.tuberia as string) || '',
          OPCIONES_TUBERIA,
        );
        const cenefa =
          categoriaImplicaOvalada && (!p.cenefa || p.cenefa === 'No')
            ? 'Ovalada'
            : p.cenefa;
        // Si quedó un chip dual, rellena lado/color derivados (coherencia con el
        // toggle Simple/Dual, que sí los setea).
        const lc = dual && esChipDual(mecanismo) ? ladoColorDesdeChipDual(mecanismo) : null;
        return {
          ...p,
          dual,
          mecanismo,
          ...(lc ? { dualLado: lc.lado, dualColor: lc.dualColor } : {}),
          tuberia,
          cenefa,
        };
      }),
    };
  };

  const panoEnEdicion = ventanaForm?.panos[panoActivo];

  const opcionesMecVentana = useMemo(() => {
    if (!ventanaForm) return OPCIONES_MECANISMO;
    const stored = (panoEnEdicion?.mecanismo as string) || '';
    // Mecanismo dual: la lista son los 8 chips duales (+ escape del guardado).
    if (panoEnEdicion?.dual) {
      const base: string[] = [...OPCIONES_MECANISMO_DUAL];
      if (stored && !base.includes(stored)) base.push(stored);
      return base;
    }
    const opts = opcionesMecanismoFiltradas(
      modelos,
      ventanaForm.categoria,
      colorAccesoriosDePano(panoEnEdicion || {}, ventanaForm.color),
      OPCIONES_MECANISMO,
      stored,
    );
    // Escape: un chip legacy guardado (OT vieja) se muestra igual aunque ya
    // no se ofrezca en la lista limpia.
    if (stored && opts.length > 0 && !opts.includes(stored)) return [...opts, stored];
    return opts;
  }, [
    ventanaForm,
    panoEnEdicion?.colorMecanismo,
    panoEnEdicion?.colorPeso,
    panoEnEdicion?.colorCadena,
    panoEnEdicion?.color,
    panoEnEdicion?.mecanismo,
    panoEnEdicion?.dual,
    modelos,
  ]);

  // Cascada mecanismo → tubería: el chip de tubería solo ofrece las opciones
  // compatibles con el diámetro del mecanismo elegido (o del modelo si no
  // hay mecanismo). La tubería guardada siempre se conserva (OTs viejas).
  const opcionesTubVentana = useMemo(() => {
    if (!ventanaForm) return OPCIONES_TUBERIA;
    return opcionesTuberiaFiltradas(OPCIONES_TUBERIA, {
      mecanismoChip: (panoEnEdicion?.mecanismo as string) || null,
      modelo: ventanaForm.modelo ?? null,
      categoria: ventanaForm.categoria,
      tuberiaActual: (panoEnEdicion?.tuberia as string) || null,
    });
  }, [ventanaForm, panoEnEdicion?.mecanismo, panoEnEdicion?.tuberia]);

  // Pre-seleccionar mecanismo inventario al editar o cambiar paño/color accesorios
  useEffect(() => {
    if (!ventanaForm || editandoId == null) return;
    setVentanaForm((v) => {
      if (!v) return v;
      const synced = sincronizarChips(v, v.modelo ?? null);
      const igual = v.panos.every(
        (p, i) =>
          p.mecanismo === synced.panos[i]?.mecanismo &&
          p.tuberia === synced.panos[i]?.tuberia &&
          p.cenefa === synced.panos[i]?.cenefa,
      );
      return igual ? v : synced;
    });
  }, [
    editandoId,
    panoActivo,
    ventanaForm?.categoria,
    ventanaForm?.modelo,
    panoEnEdicion?.ancho,
    panoEnEdicion?.colorMecanismo,
    panoEnEdicion?.colorPeso,
    panoEnEdicion?.colorCadena,
  ]);

  const iniciarEdicion = (v: Ventana) => {
    setDialogJuntar(false);
    setEditandoId(v.id);
    // Autocompletar el modelo de fabricación si la ventana tiene categoría
    // pero aún no tiene modelo (OTs creadas antes o desde el Panel). El
    // mecanismo se elige según el color de accesorios (GRIS→MEC_13, etc.).
    let modelo = v.modelo ?? null;
    if (!modelo && v.categoria) {
      modelo = elegirModeloPorColor(
        modelosParaCategoria(modelos, v.categoria),
        (v.panos?.[0]?.colorMecanismo as string) ||
          (v.panos?.[0]?.color as string) ||
          v.color,
      );
    }
    // OT dual (flag guardado): asegura el modelo ROLLER_DUAL (despiece 3,9 mm)
    // aunque la categoría de la ventana sea ROL. Deriva el chip del lado/color.
    const p0 = v.panos?.[0];
    // Dual por flag guardado O por categoría ROL_DUAL (que implica dual aunque el
    // paño no traiga el flag, p.ej. OT creada eligiendo esa categoría).
    const esDualOT = !!p0 && (p0.dual || categoriaEsDual(v.categoria || ''));
    if (esDualOT && (!modelo || modelo.sistema !== 'ROLLER_DUAL')) {
      const chipDual =
        (esChipDual(p0!.mecanismo as string) && (p0!.mecanismo as string)) ||
        chipDualPorLadoColor(p0!.dualLado, colorAccesoriosDePano(p0!, v.color), OPCIONES_MECANISMO_DUAL);
      const md = chipDual ? modeloDesdeChipMecanismo(modelosParaCategoria(modelos, 'ROL_DUAL'), chipDual) : null;
      if (md) modelo = md;
    }
    const adicionalesFase0 = ot?.datosGenerales.adicionalesFase0;
    const enriquecida = enriquecerVentanaDesdeFase0(v, catalogo, adicionalesFase0);
    const panos =
      enriquecida.panos.length > 0
        ? enriquecida.panos
        : [
            enriquecerPanoDesdeFase0(crearPanoVacio(), enriquecida, catalogo, {
              adicionalesFase0,
              panoIndex: 0,
              totalPanos: 1,
            }),
          ];
    const base: Ventana = { ...enriquecida, modelo, panos };
    setVentanaForm(sincronizarChips(base, modelo));
    setPanoActivo(0);
    // Cortina invertida sin conjunto: ofrecer juntarla con otra (una vez por
    // sesión; "Juntar con…" del panel lo reabre a mano cuando se quiera).
    if (
      esInvertidaV(v) &&
      !v.grupoId &&
      ventanas.length > 1 &&
      !juntarDescartado.has(v.id)
    ) {
      setDialogJuntar(true);
    }
  };

  const iniciarNueva = () => {
    const nueva: Ventana = {
      id: crypto.randomUUID(),
      ubicacion: '',
      codInt: '',
      producto: '',
      tipo: '',
      color: 'Blanco',
      alto: 0,
      precio: 0,
      cantidad: 1,
      categoria: '',
      grupoId: null,
      grupoOrden: 0,
      panos: [crearPanoVacio()],
    };
    setEditandoId(nueva.id);
    setVentanaForm(nueva);
    setPanoActivo(0);
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setVentanaForm(null);
    setPanoActivo(0);
    setDialogJuntar(false);
  };

  const actualizarVentana = (patch: Partial<Ventana>) =>
    setVentanaForm((v) => (v ? { ...v, ...patch } : v));

  // Sincronización inversa mecanismo → modelo + tubería. Al elegir un chip
  // (a mano, por ancho >3 m = MEC 28, dual, o kit por color) se actualiza el
  // modelo de fabricación y se corrige la tubería si quedó incompatible con el
  // diámetro. Los kits de inventario (32/33/34) y el kit 63 mm (MEC 28) no
  // existen como modelo en su categoría, por eso los fallbacks explícitos.
  const aplicarCascadaMecanismo = (nuevo: Ventana, idx: number, chip: string): Ventana => {
    const dual = esChipDual(chip);
    const candidatos = modelosParaCategoria(modelos, dual ? 'ROL_DUAL' : nuevo.categoria);
    let nm = modeloDesdeChipMecanismo(candidatos, chip);
    if (!nm && !dual) {
      // Kit por color (sin modelo propio) o vuelta de 63 mm/dual a simple 38.
      const curr = nuevo.modelo;
      if (!curr || curr.diametro_tubo_mm !== 38 || curr.sistema !== 'ROLLER_SIMPLE') {
        const color = colorAccesoriosDePano(nuevo.panos[idx] || {}, nuevo.color);
        nm = modeloSimple38PorColor(modelos, nuevo.categoria, color);
      }
    }
    if (nm) nuevo = { ...nuevo, modelo: nm };
    const anchoMidx = parseFloat(String(nuevo.panos[idx]?.ancho ?? 0)) || 0;
    const tuberiaActual = nuevo.panos[idx]?.tuberia as string;
    const corregida = tuberiaCorregidaPorMecanismo(chip, tuberiaActual, anchoMidx, OPCIONES_TUBERIA, nuevo.categoria);
    const tub = corregida ??
      (nm ? tuberiaParaPano(anchoMidx, nm, tuberiaActual, OPCIONES_TUBERIA, nuevo.categoria) : null);
    if (tub && tub !== tuberiaActual) {
      nuevo = { ...nuevo, panos: nuevo.panos.map((p, i) => (i === idx ? { ...p, tuberia: tub } : p)) };
    }
    return nuevo;
  };

  const actualizarPano = (idx: number, patch: Partial<Pano>) =>
    setVentanaForm((v) => {
      if (!v) return v;
      const panos = [...v.panos];
      panos[idx] = { ...panos[idx], ...patch };
      let nuevo: Ventana = { ...v, panos };
      const setPano = (mod: Partial<Pano>) => {
        nuevo = { ...nuevo, panos: nuevo.panos.map((p, i) => (i === idx ? { ...p, ...mod } : p)) };
      };
      const anchoIdx = () => parseFloat(String(nuevo.panos[idx]?.ancho ?? 0)) || 0;

      // Toggle tipo Simple/Dual: represelecciona mecanismo + modelo + tubería.
      if (patch.dual !== undefined) {
        const colorAcc = colorAccesoriosDePano(nuevo.panos[idx] || {}, v.color);
        if (patch.dual) {
          const chip = chipDualPorLadoColor(nuevo.panos[idx].dualLado || 'DERECHO', colorAcc, OPCIONES_MECANISMO_DUAL);
          if (chip) {
            const lc = ladoColorDesdeChipDual(chip);
            setPano({ mecanismo: chip, ...(lc ? { dualLado: lc.lado, dualColor: lc.dualColor } : {}) });
            nuevo = aplicarCascadaMecanismo(nuevo, idx, chip);
          } else {
            // Color de accesorios sin mecanismo dual (MET/CAFÉ: los 8 duales solo
            // existen en BCO/NEG/GRS): igual fija el modelo ROLLER_DUAL para que el
            // despiece use el +1 mm, y limpia el mecanismo para que el vendedor
            // elija uno de los chips duales (validarVentana exige mecanismo).
            const md = elegirModeloPorColor(modelosParaCategoria(modelos, 'ROL_DUAL'), colorAcc);
            setPano({ mecanismo: '' });
            if (md) nuevo = { ...nuevo, modelo: md };
          }
        } else {
          const chip = mecanismoParaPano(
            { ...nuevo.panos[idx], dual: false, mecanismo: '' },
            v.color, null, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoIdx(),
          );
          setPano({ mecanismo: chip, dualLado: '', dualColor: '' });
          if (chip) nuevo = aplicarCascadaMecanismo(nuevo, idx, chip);
        }
        return nuevo;
      }

      // F15: la cenefa ovalada no admite el motor DOM41 → cae a DOM38.
      if (patch.cenefa === 'Ovalada' && nuevo.panos[idx].motorModelo === 'DOM41') {
        setPano({ motorModelo: 'DOM38' });
      }

      // Cambio de color de accesorios → represelecciona el mecanismo (con ancho,
      // para respetar la regla >3 m = MEC 28). Dual: represelecciona chip por color.
      if (patch.colorMecanismo !== undefined || patch.colorPeso !== undefined || patch.colorCadena !== undefined || patch.color !== undefined) {
        const mec = mecanismoParaPano(nuevo.panos[idx], v.color, nuevo.modelo ?? null, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoIdx());
        if (mec && mec !== nuevo.panos[idx].mecanismo) setPano({ mecanismo: mec });
      }

      // Cambio de ancho → si cruza 3 m cambia el mecanismo (MEC 28 ↔ kit), y en
      // todo caso ajusta la tubería (E02/E66 y E47/E65).
      if (patch.ancho !== undefined) {
        const mec = mecanismoParaPano(nuevo.panos[idx], v.color, nuevo.modelo ?? null, OPCIONES_MECANISMO_RESOLUCION, v.categoria, anchoIdx());
        if (mec && mec !== nuevo.panos[idx].mecanismo) {
          setPano({ mecanismo: mec });
          nuevo = aplicarCascadaMecanismo(nuevo, idx, mec);
        } else if (nuevo.modelo) {
          const tub = tuberiaParaPano(anchoIdx(), nuevo.modelo, nuevo.panos[idx].tuberia as string, OPCIONES_TUBERIA, v.categoria);
          if (tub && tub !== nuevo.panos[idx].tuberia) setPano({ tuberia: tub });
        }
      }

      // Cambio manual del chip de MECANISMO → modelo + tubería (y lado/color si dual).
      if (typeof patch.mecanismo === 'string' && patch.mecanismo) {
        if (esChipDual(patch.mecanismo)) {
          const lc = ladoColorDesdeChipDual(patch.mecanismo);
          if (lc) setPano({ dualLado: lc.lado, dualColor: lc.dualColor });
        }
        nuevo = aplicarCascadaMecanismo(nuevo, idx, patch.mecanismo);
      }
      return nuevo;
    });

  const guardarVentana = async () => {
    if (!ot || !ventanaForm) return;
    const primer = ventanaForm.panos[0];
    const ventBase: Ventana = {
      ...ventanaForm,
      alto: parseFloat(String(primer?.alto)) || ventanaForm.alto || 0,
      color: primer?.color || ventanaForm.color || 'Blanco',
      // Sentido/dirección para la cotización (Fase 1/3): se derivan del primer
      // paño (armado/cierre) si no venían de Fase 0. No afectan el precio.
      sentido: ventanaForm.sentido || sentidoDesdeArmado(primer?.armado) || undefined,
      direccion: ventanaForm.direccion || direccionDesdeCierre(primer?.cierreVert) || undefined,
    };
    const vent = sincronizarChips(ventBase, ventBase.modelo ?? null, true);
    const err = validarVentana(vent, {
      requiereMecanismo: categoriaRequiereMecanismo(vent.categoria),
    });
    if (err) {
      toast.error(err);
      return;
    }
    setSavingVentana(true);
    try {
      const existe = ventanas.find((v) => v.id === vent.id);
      const nuevasVentanas = existe
        ? ventanas.map((v) => (v.id === vent.id ? vent : v))
        : [...ventanas, vent];
      await guardar({ storeVentanas: nuevasVentanas });
      toast.success(existe ? 'Ventana actualizada' : 'Ventana agregada');
      cancelarEdicion();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar: ' + msg);
    } finally {
      setSavingVentana(false);
    }
  };

  const eliminarVentana = async (id: string | number) => {
    if (!ot) return;
    if (!await confirmar('¿Eliminar esta ventana?')) return;
    try {
      // Si el conjunto queda con 1 miembro, se disuelve también.
      const nuevas = limpiarGruposHuerfanos(ventanas.filter((v) => v.id !== id));
      await guardar({ storeVentanas: nuevas });
      toast.success('Ventana eliminada');
      if (editandoId === id) cancelarEdicion();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // ── Conjuntos de cortinas invertidas ──
  // Junta la cortina en edición con las seleccionadas: mismo grupoId, la
  // ficha de la más grande copiada a las demás (conservan ubicación/medidas)
  // y todos los paños invertidos. Un solo guardado atómico de storeVentanas.
  const juntarCon = async (ids: Array<string | number>) => {
    if (!ot || !ventanaForm) return;
    const sel = new Set(ids);
    // Si alguna seleccionada YA está en un conjunto, el resultado adopta ese
    // grupoId y arrastra a TODOS sus miembros (cruzar 2 conjuntos = fusión).
    const gruposPrevios = new Set(
      ventanas.filter((v) => sel.has(v.id) && v.grupoId).map((v) => v.grupoId as string),
    );
    const gid = gruposPrevios.size > 0 ? [...gruposPrevios][0] : crypto.randomUUID();
    const idsMiembros = new Set<string | number>([
      ventanaForm.id,
      ...ids,
      ...ventanas.filter((v) => v.grupoId && gruposPrevios.has(v.grupoId)).map((v) => v.id),
    ]);
    // La cortina en edición participa con sus ediciones vigentes (el form).
    const miembros = ventanas
      .filter((v) => idsMiembros.has(v.id))
      .map((v) => (v.id === ventanaForm.id ? ventanaForm : v));
    try {
      const actualizados = juntarVentanas(miembros, gid);
      const porId = new Map(actualizados.map((v) => [v.id, v]));
      const nuevas = ventanas.map((v) => porId.get(v.id) ?? v);
      await guardar({ storeVentanas: nuevas });
      const actual = porId.get(ventanaForm.id);
      if (actual) {
        setVentanaForm(sincronizarChips(actual, actual.modelo ?? null));
        setPanoActivo(0);
      }
      setDialogJuntar(false);
      toast.success(`Conjunto de ${actualizados.length} cortinas guardado`);
    } catch (e) {
      toast.error('Error al juntar: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const quitarDelConjunto = async () => {
    if (!ot || !ventanaForm?.grupoId) return;
    try {
      await guardar({ storeVentanas: quitarDeConjunto(ventanas, ventanaForm.id) });
      setVentanaForm((v) => (v ? { ...v, grupoId: null, grupoOrden: 0 } : v));
      toast.success('Cortina quitada del conjunto');
    } catch {
      toast.error('Error al quitar del conjunto');
    }
  };

  const guardarPostInstalacion = async () => {
    if (!ot) return;
    setSavingPost(true);
    try {
      await guardar({
        datosGenerales: {
          ...(ot.datosGenerales || {}),
          postInstalacion: postData,
        },
      });
      toast.success('Post-instalación guardada');
    } catch (e) {
      toast.error('Error al guardar');
    } finally {
      setSavingPost(false);
    }
  };

  const avanzarAFase3 = async () => {
    if (!ot) return;
    if (ventanas.length === 0) {
      toast.error('Agrega al menos 1 ventana antes de avanzar');
      return;
    }
    setAvanzando(true);
    try {
      const dg = {
        ...(ot.datosGenerales || {}),
        postInstalacion: postData,
        historialEstados: [
          ...(ot.datosGenerales?.historialEstados || []),
          { de: ot.estado, a: 'aprobada' as const, fecha: new Date().toISOString() },
        ],
      };
      await guardar({ estado: 'aprobada', datosGenerales: dg });
      toast.success('OT aprobada — pasa a Fase 3');
      navigate(`/ots/${ot.id}/fase3`);
    } catch (e) {
      toast.error('Error al avanzar');
    } finally {
      setAvanzando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
      </div>
    );
  }
  if (!ot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>OT no encontrada.</p>
        <Link to="/panel" className="text-sm text-accent hover:underline">
          Volver al Panel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/panel')}
            className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            title="Volver al Panel"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Fase 2 — Terreno</h2>
            <p className="text-xs text-muted-foreground">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'} ·{' '}
              {ventanas.length} ventana{ventanas.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <TabBtn active={tab === 'ventanas'} onClick={() => setTab('ventanas')}>
            Ventanas
          </TabBtn>
          <TabBtn active={tab === 'post'} onClick={() => setTab('post')}>
            <ClipboardCheck className="h-3.5 w-3.5" /> Post-instalación
          </TabBtn>
        </nav>
      </div>

      {tab === 'ventanas' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Lista de ventanas */}
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-card/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ventanas de la OT
              </h3>
              <button
                onClick={iniciarNueva}
                className="flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[0.7rem] text-accent hover:bg-accent/20"
              >
                <Plus className="h-3 w-3" /> Nueva
              </button>
            </div>
            {ventanas.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                No hay ventanas todavía. Agrega una desde "Nueva" o desde Fase 1.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {ventanas.map((v) => {
                  const badge = catBadgeColor(v.categoria || '');
                  const activa = editandoId === v.id;
                  const claseGrupo = claseDeGrupo(v.grupoId);
                  return (
                    <li
                      key={String(v.id)}
                      className={cn(
                        'cursor-pointer p-3 hover:bg-card',
                        activa && 'bg-accent/10',
                      )}
                      // Miembro de un conjunto: borde izquierdo grueso del
                      // color del grupo (inline: no depende del JIT).
                      style={
                        claseGrupo
                          ? { borderLeft: `4px solid ${claseGrupo.base}` }
                          : undefined
                      }
                      onClick={() => iniciarEdicion(v)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="truncate text-sm font-medium"
                          style={claseGrupo ? { color: claseGrupo.base } : undefined}
                        >
                          {v.ubicacion || '(sin ubicación)'}
                        </span>
                        {claseGrupo && (
                          <span
                            className="shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase"
                            style={{
                              backgroundColor: claseGrupo.suave,
                              borderColor: claseGrupo.base,
                              color: claseGrupo.base,
                            }}
                          >
                            Conjunto
                          </span>
                        )}
                        <span
                          className="shrink-0 rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold"
                          style={{
                            backgroundColor: badge.bg,
                            borderColor: badge.border,
                            color: badge.color,
                          }}
                        >
                          {v.categoria || '—'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                        {tipoVentanaLabel(v.panos.length)} · {resumenPanos(v.panos)}
                      </div>
                      <div className="mt-1 flex justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            iniciarEdicion(v);
                          }}
                          className="rounded border border-border bg-card p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarVentana(v.id);
                          }}
                          className="rounded border border-destructive/30 bg-destructive/15 p-1 text-destructive hover:bg-destructive/15"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Editor */}
          <section className="flex-1 overflow-y-auto p-4">
            {!ventanaForm ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Pencil className="h-10 w-10 opacity-40" />
                <p className="text-sm">
                  Selecciona una ventana de la lista o crea una nueva para editar.
                </p>
                <Button onClick={iniciarNueva} className="gap-1" size="sm">
                  <Plus className="h-4 w-4" /> Nueva ventana
                </Button>
                {ventanas.length > 0 && (
                  <Button
                    onClick={avanzarAFase3}
                    disabled={avanzando}
                    variant="outline"
                    className="gap-1"
                    size="sm"
                  >
                    {avanzando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Aprobar y pasar a Fase 3 <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Datos de la ventana */}
                {(() => {
                  const claseForm = claseDeGrupo(ventanaForm.grupoId);
                  const existeEnOT = !!ventanas.find((v) => v.id === ventanaForm.id);
                  return (
                <div
                  className="mb-3 rounded-md border border-border bg-card/40 p-3"
                  // Contorno del color del conjunto (el mismo de su card).
                  style={
                    claseForm
                      ? { border: `2px solid ${claseForm.base}`, boxShadow: `0 0 0 1px ${claseForm.suave}` }
                      : undefined
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      {existeEnOT ? 'Editar ventana' : 'Nueva ventana'}
                      {claseForm && (
                        <span
                          className="rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase"
                          style={{
                            backgroundColor: claseForm.suave,
                            borderColor: claseForm.base,
                            color: claseForm.base,
                          }}
                        >
                          Conjunto
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {ventanaForm.grupoId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={quitarDelConjunto}
                          title="Sacar esta cortina del conjunto (si queda una sola, el conjunto se disuelve)"
                        >
                          <Unlink className="h-3 w-3" /> Quitar del conjunto
                        </Button>
                      ) : (
                        existeEnOT &&
                        ventanas.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setDialogJuntar(true)}
                            title="Juntar con otra cortina: copia la ficha de la más grande y las marca invertidas"
                          >
                            <Link2 className="h-3 w-3" /> Juntar con…
                          </Button>
                        )
                      )}
                      <button
                        onClick={cancelarEdicion}
                        className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                        title="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <div>
                      <Label>Ubicación</Label>
                      <Input
                        value={ventanaForm.ubicacion}
                        onChange={(e) => actualizarVentana({ ubicacion: e.target.value })}
                        placeholder="Living, Dormitorio 1…"
                      />
                    </div>
                    <div>
                      <Label>Categoría</Label>
                      <select
                        value={ventanaForm.categoria}
                        onChange={(e) => {
                          const categoria = e.target.value;
                          // Pre-seleccionar el modelo de fabricación cuando la
                          // categoría mapea a candidatos del catálogo.
                          const candidatos = modelosParaCategoria(modelos, categoria);
                          const actualSirve =
                            ventanaForm.modelo &&
                            candidatos.some(
                              (m) => claveModelo(m) === claveModelo(ventanaForm.modelo!),
                            );
                          const nuevoModelo = actualSirve
                            ? ventanaForm.modelo!
                            : elegirModeloPorColor(
                                candidatos,
                                (ventanaForm.panos?.[0]?.colorMecanismo as string) ||
                                  (ventanaForm.panos?.[0]?.color as string) ||
                                  ventanaForm.color,
                              ) ?? ventanaForm.modelo ?? null;
                          setVentanaForm((v) =>
                            v
                              ? sincronizarChips(
                                  { ...v, categoria, modelo: nuevoModelo },
                                  nuevoModelo,
                                  !actualSirve,
                                )
                              : v,
                          );
                        }}
                        className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
                      >
                        <option value="">— Selecciona —</option>
                        {CATEGORIAS_FASE1.map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.options.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Producto</Label>
                      <ProductoSelectorFase2
                        value={ventanaForm.codInt}
                        catalogo={catalogo}
                        onSelect={(sel) =>
                          actualizarVentana({
                            codInt: sel.codInt,
                            producto: sel.producto,
                            tipo: sel.tipo,
                            descripcion: sel.descripcion,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={ventanaForm.cantidad || 1}
                        onChange={(e) =>
                          actualizarVentana({ cantidad: parseInt(e.target.value, 10) || 1 })
                        }
                      />
                    </div>
                  </div>

                  {/* El "Modelo de fabricación" y la "Cantidad de paños" ya no
                      se muestran (2026-07-09, confundían en Terreno): el
                      modelo se elige solo por categoría + color, y las
                      ventanas multi-paño existentes conservan sus tabs. */}
                </div>
                  );
                })()}

                {/* Tabs por paño */}
                {ventanaForm.panos.length > 1 && (
                  <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-2">
                    {ventanaForm.panos.map((_, i) => {
                      const color = PANO_COLORS[i] || PANO_COLORS[0];
                      const active = panoActivo === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setPanoActivo(i)}
                          className={cn(
                            'flex items-center gap-1.5 rounded-t border-b-2 px-3 py-1.5 text-xs transition-colors',
                            active
                              ? 'border-b-indigo-500 bg-card text-foreground'
                              : 'border-b-transparent text-muted-foreground hover:bg-card hover:text-foreground',
                          )}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: color.hex }}
                          />
                          Paño {i + 1}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Ficha técnica del paño activo */}
                <PanoEditor
                  pano={ventanaForm.panos[panoActivo] || crearPanoVacio()}
                  panoNum={panoActivo + 1}
                  onChange={(patch) => actualizarPano(panoActivo, patch)}
                  cadenas={cadenas}
                  pesos={pesos}
                  opcionesMecanismo={opcionesMecVentana}
                  opcionesTuberia={opcionesTubVentana}
                  ocultarMecanismo={!categoriaRequiereMecanismo(ventanaForm.categoria)}
                  categoria={ventanaForm.categoria}
                  colorVentana={ventanaForm.color}
                  sentidoVentana={ventanaForm.sentido}
                  adicionalesFase0={ot?.datosGenerales.adicionalesFase0}
                  anchoRollo={obtenerAnchoRollo(ventanaForm.codInt, catalogo, parametros.anchoRolloDefaultM)}
                />

                {/* Acciones */}
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={cancelarEdicion}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={guardarVentana}
                    disabled={savingVentana}
                    className="gap-1"
                  >
                    {savingVentana ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar ventana
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === 'post' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-3xl">
            <PostInstalacion data={postData} onChange={(p) => setPostData((s) => ({ ...s, ...p }))} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/panel')}>
                Volver al Panel
              </Button>
              <Button
                onClick={guardarPostInstalacion}
                disabled={savingPost}
                className="gap-1"
              >
                {savingPost ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Guardar post-instalación
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Barra fija inferior para avanzar a Fase 3 (solo visible en tab ventanas con editor cerrado) */}
      {tab === 'ventanas' && !ventanaForm && ventanas.length > 0 && (
        <div className="border-t border-border bg-card/60 px-4 py-2.5">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/panel')}>
              Volver al Panel
            </Button>
            <Button onClick={avanzarAFase3} disabled={avanzando} className="gap-1">
              {avanzando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Aprobar y pasar a Fase 3 <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog "¿Juntar con otra cortina?" (conjuntos de invertidas) */}
      {dialogJuntar && ventanaForm && (
        <JuntarConjuntoDialog
          ventanaActual={ventanaForm}
          candidatas={ventanas.filter((v) => v.id !== ventanaForm.id)}
          esInvertida={esInvertidaV}
          colorDeGrupo={claseDeGrupo}
          onJuntar={juntarCon}
          onCerrar={() => {
            setDialogJuntar(false);
            setJuntarDescartado((prev) => new Set(prev).add(ventanaForm.id));
          }}
        />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.78rem] font-medium transition-colors',
        active
          ? 'bg-accent text-foreground shadow'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
