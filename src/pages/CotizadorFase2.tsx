import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCheck,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOT } from '@/modules/ots/hooks';
import {
  ajustarPanos,
  crearPanoVacio,
  OPCIONES_MECANISMO,
  OPCIONES_TUBERIA,
  PANO_COLORS,
  postInstalacionVacia,
  resumenPanos,
  TIPOS_VENTANA,
  tipoVentanaLabel,
  validarVentana,
  type PostInstalacionData,
} from '@/modules/cotizador/fase2';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { obtenerAnchoRollo } from '@/modules/cotizador/tela';
import { CATEGORIAS_FASE1, catBadgeColor } from '@/modules/cotizador/categorias';
import { enriquecerPanoDesdeFase0, enriquecerVentanaDesdeFase0 } from '@/modules/cotizador/fase0-sync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { esCadenaRoller, esPesoSeleccionable, type CadenaInsumo } from '@/modules/cotizador/cadenas';
import { PanoEditor } from '@/components/cotizador/PanoEditor';
import { PostInstalacion } from '@/components/cotizador/PostInstalacion';
import type { Pano, Ventana } from '@/modules/cotizador/types';
import { confirmar } from '@/components/ui/confirm';
import { useDescuentosModelo } from '@/modules/descuentos/hooks';
import {
  claveModelo,
  elegirModeloPorColor,
  etiquetaModelo,
  modelosParaCategoria,
} from '@/modules/descuentos/tipos';
import { calcularDespiece, contextoDespieceDesdePano, MODELO_DESPIECE_STUB } from '@/modules/descuentos/despiece';
import { esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import {
  categoriaRequiereMecanismo,
  colorAccesoriosDePano,
  mecanismoParaPano,
  modeloDesdeChipMecanismo,
  opcionesMecanismoFiltradas,
  tuberiaParaPano,
} from '@/modules/descuentos/chips';
import type { ModeloDespiece } from '@/modules/descuentos/tipos';

type Tab = 'ventanas' | 'post';

export function CotizadorFase2() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);
  const { catalogo } = useCatalogoProductos();

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

  const ventanas: Ventana[] = useMemo(
    () => ((ot?.storeVentanas || []) as unknown as Ventana[]),
    [ot],
  );

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

  // Marca en los paños los chips de MECANISMO y TUBERÍA (reglas-mecanismo / reglas-tuberia).
  const sincronizarChips = (
    v: Ventana,
    modelo: ModeloDespiece | null,
    forzarTuberia = false,
  ): Ventana => {
    return {
      ...v,
      panos: v.panos.map((p) => {
        const anchoM = parseFloat(String(p.ancho ?? 0)) || 0;
        const mecanismo = mecanismoParaPano(p, v.color, modelo, OPCIONES_MECANISMO, v.categoria);
        const tuberia =
          modelo && anchoM > 0
            ? tuberiaParaPano(anchoM, modelo, p.tuberia as string, OPCIONES_TUBERIA, v.categoria)
            : forzarTuberia && modelo
              ? tuberiaParaPano(anchoM, modelo, p.tuberia as string, OPCIONES_TUBERIA, v.categoria) ||
                (p.tuberia as string)
              : (p.tuberia as string) || '';
        return {
          ...p,
          mecanismo: mecanismo || p.mecanismo,
          tuberia,
        };
      }),
    };
  };

  const modelosDeVentana = useMemo(
    () => modelosParaCategoria(modelos, ventanaForm?.categoria || ''),
    [modelos, ventanaForm?.categoria],
  );

  const sistemasDeVentana = useMemo(
    () => [...new Set(modelosDeVentana.map((m) => m.sistema))],
    [modelosDeVentana],
  );

  const panoEnEdicion = ventanaForm?.panos[panoActivo];

  const opcionesMecVentana = useMemo(() => {
    if (!ventanaForm) return OPCIONES_MECANISMO;
    return opcionesMecanismoFiltradas(
      modelos,
      ventanaForm.categoria,
      colorAccesoriosDePano(panoEnEdicion || {}, ventanaForm.color),
      OPCIONES_MECANISMO,
      (panoEnEdicion?.mecanismo as string) || '',
    );
  }, [
    ventanaForm,
    panoEnEdicion?.colorMecanismo,
    panoEnEdicion?.colorPeso,
    panoEnEdicion?.colorCadena,
    panoEnEdicion?.color,
    panoEnEdicion?.mecanismo,
    modelos,
  ]);

  // Pre-seleccionar mecanismo inventario al editar o cambiar paño/color accesorios
  useEffect(() => {
    if (!ventanaForm || editandoId == null) return;
    setVentanaForm((v) => {
      if (!v) return v;
      const synced = sincronizarChips(v, v.modelo ?? null);
      const igual = v.panos.every(
        (p, i) =>
          p.mecanismo === synced.panos[i]?.mecanismo &&
          p.tuberia === synced.panos[i]?.tuberia,
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
  };

  const actualizarVentana = (patch: Partial<Ventana>) =>
    setVentanaForm((v) => (v ? { ...v, ...patch } : v));

  const actualizarPano = (idx: number, patch: Partial<Pano>) =>
    setVentanaForm((v) => {
      if (!v) return v;
      const panos = [...v.panos];
      panos[idx] = { ...panos[idx], ...patch };
      let nuevo: Ventana = { ...v, panos };

      if (patch.colorMecanismo !== undefined || patch.colorPeso !== undefined || patch.colorCadena !== undefined || patch.color !== undefined) {
        const mec = mecanismoParaPano(panos[idx], v.color, v.modelo ?? null, OPCIONES_MECANISMO, v.categoria);
        if (mec) {
          panos[idx] = { ...panos[idx], mecanismo: mec };
          nuevo = { ...nuevo, panos: [...panos] };
        }
      }

      if (patch.ancho !== undefined && v.modelo) {
        const anchoM = parseFloat(String(panos[idx].ancho ?? 0)) || 0;
        const tub = tuberiaParaPano(anchoM, v.modelo, panos[idx].tuberia as string, OPCIONES_TUBERIA, v.categoria);
        if (tub) {
          panos[idx] = { ...panos[idx], tuberia: tub };
          nuevo = { ...nuevo, panos: [...panos] };
        }
      }

      // Sincronización inversa: si el operario cambia el chip de MECANISMO,
      // actualizar el modelo de fabricación al candidato correspondiente
      // (y con él, los descuentos del despiece).
      if (typeof patch.mecanismo === 'string' && patch.mecanismo) {
        const candidatos = modelosParaCategoria(modelos, v.categoria);
        const nuevoModelo = modeloDesdeChipMecanismo(candidatos, patch.mecanismo);
        if (nuevoModelo) {
          nuevo = { ...nuevo, modelo: nuevoModelo };
          const anchoMidx = parseFloat(String(nuevo.panos[idx]?.ancho ?? 0)) || 0;
          const tub = tuberiaParaPano(anchoMidx, nuevoModelo, nuevo.panos[idx]?.tuberia as string, OPCIONES_TUBERIA, v.categoria);
          if (tub) {
            nuevo.panos = nuevo.panos.map((p, i) =>
              i === idx ? { ...p, tuberia: tub } : p,
            );
          }
        }
      }
      return nuevo;
    });

  const cambiarTipoVentana = (n: number) => {
    setVentanaForm((v) => {
      if (!v) return v;
      return { ...v, panos: ajustarPanos(v.panos, n) };
    });
    if (panoActivo >= n) setPanoActivo(n - 1);
  };

  const guardarVentana = async () => {
    if (!ot || !ventanaForm) return;
    const primer = ventanaForm.panos[0];
    const ventBase: Ventana = {
      ...ventanaForm,
      alto: parseFloat(String(primer?.alto)) || ventanaForm.alto || 0,
      color: primer?.color || ventanaForm.color || 'Blanco',
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
      const nuevas = ventanas.filter((v) => v.id !== id);
      await guardar({ storeVentanas: nuevas });
      toast.success('Ventana eliminada');
      if (editandoId === id) cancelarEdicion();
    } catch {
      toast.error('Error al eliminar');
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
                  return (
                    <li
                      key={String(v.id)}
                      className={cn(
                        'cursor-pointer p-3 hover:bg-card',
                        activa && 'bg-accent/10',
                      )}
                      onClick={() => iniciarEdicion(v)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {v.ubicacion || '(sin ubicación)'}
                        </span>
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
                <div className="mb-3 rounded-md border border-border bg-card/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {ventanas.find((v) => v.id === ventanaForm.id)
                        ? 'Editar ventana'
                        : 'Nueva ventana'}
                    </h3>
                    <button
                      onClick={cancelarEdicion}
                      className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
                      title="Cancelar"
                    >
                      <X className="h-4 w-4" />
                    </button>
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
                      <Label>Código producto</Label>
                      <Input
                        value={ventanaForm.codInt}
                        onChange={(e) => actualizarVentana({ codInt: e.target.value })}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  {/* Modelo de fabricación (catálogo de descuentos → despiece) */}
                  {modelos.length > 0 && !esCategoriaBeeblack(ventanaForm.categoria) && (
                    <div className="mt-3">
                      <Label>Modelo de fabricación</Label>
                      <select
                        value={ventanaForm.modelo ? claveModelo(ventanaForm.modelo) : ''}
                        onChange={(e) => {
                          const m = modelos.find((x) => claveModelo(x) === e.target.value) ?? null;
                          setVentanaForm((v) =>
                            v ? sincronizarChips({ ...v, modelo: m }, m, true) : v,
                          );
                        }}
                        className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
                      >
                        <option value="">— Sin modelo (despiece manual) —</option>
                        {sistemasDeVentana.map((s) => (
                          <optgroup key={s} label={s.replaceAll('_', ' ')}>
                            {modelosDeVentana
                              .filter((m) => m.sistema === s)
                              .map((m) => (
                                <option key={claveModelo(m)} value={claveModelo(m)}>
                                  {etiquetaModelo(m)}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      {ventanaForm.modelo && (
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          Ancho máx {ventanaForm.modelo.ancho_max_m} m · dcto tubo{' '}
                          {ventanaForm.modelo.dcto_tubo_cm} cm · tela{' '}
                          {ventanaForm.modelo.dcto_tela_cm} cm
                          {ventanaForm.modelo.notas && ` · ${ventanaForm.modelo.notas}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Despiece en vivo (roller/oscuridad con modelo, BEEBLACK sin modelo) */}
                  {(ventanaForm.modelo || esCategoriaBeeblack(ventanaForm.categoria)) &&
                    (() => {
                      const esBb = esCategoriaBeeblack(ventanaForm.categoria);
                      const modeloDesp = ventanaForm.modelo ?? MODELO_DESPIECE_STUB;
                      const conMedidas = ventanaForm.panos
                        .map((p, i) => ({
                          i,
                          p,
                          anchoM: parseFloat(String(p.ancho ?? 0)) || 0,
                          altoM: parseFloat(String(p.alto ?? 0)) || 0,
                        }))
                        .filter((x) => x.anchoM > 0 && (!esBb || x.altoM > 0));
                      if (conMedidas.length === 0) return null;
                      const despieces = conMedidas.map((x) => ({
                        ...x,
                        d: calcularDespiece(
                          modeloDesp,
                          x.anchoM * 100,
                          contextoDespieceDesdePano(ventanaForm, x.p),
                        ),
                      }));
                      return (
                        <div className="mt-2 rounded-md border border-border bg-card/60 p-2.5">
                          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Despiece (medidas de corte)
                          </p>
                          {despieces.map(({ i, anchoM, altoM, d }) => (
                            <p key={i} className="text-[12.5px] tabular-nums">
                              <span className="font-semibold">
                                {ventanaForm.panos.length > 1 ? `Paño ${i + 1}` : 'Cortina'}
                              </span>{' '}
                              ({anchoM.toFixed(2)} × {altoM.toFixed(2)} m):{' '}
                              {d.cortes
                                .map((c) => `${c.componente} ${c.medidaCm.toFixed(1)}`)
                                .join(' · ')}
                            </p>
                          ))}
                          {despieces.some(({ d }) => d.aproximado) && (
                            <p className="mt-1 text-[11.5px] font-medium text-warning">
                              ⚠ {despieces[0].d.notas[0]}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                  {/* Selector tipo ventana */}
                  <div className="mt-3">
                    <Label className="mb-1">Cantidad de paños</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {TIPOS_VENTANA.map((t) => {
                        const active = ventanaForm.panos.length === t.value;
                        return (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => cambiarTipoVentana(t.value)}
                            className={cn(
                              'flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs transition-colors',
                              active
                                ? 'border-accent/50 bg-accent/20 text-accent'
                                : 'border-border bg-card text-foreground hover:bg-card',
                            )}
                          >
                            <span className="font-mono">{t.icono}</span>
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

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
                  ocultarMecanismo={!categoriaRequiereMecanismo(ventanaForm.categoria)}
                  categoria={ventanaForm.categoria}
                  sentidoVentana={ventanaForm.sentido}
                  adicionalesFase0={ot?.datosGenerales.adicionalesFase0}
                  anchoRollo={obtenerAnchoRollo(ventanaForm.codInt, catalogo)}
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

            {/* Acción global: avanzar */}
            {!ventanaForm && ventanas.length > 0 && null}
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
