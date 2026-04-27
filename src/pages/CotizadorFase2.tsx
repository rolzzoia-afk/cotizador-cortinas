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
  PANO_COLORS,
  postInstalacionVacia,
  resumenPanos,
  TIPOS_VENTANA,
  tipoVentanaLabel,
  validarVentana,
  type PostInstalacionData,
} from '@/modules/cotizador/fase2';
import { CATEGORIAS_FASE1, catBadgeColor } from '@/modules/cotizador/categorias';
import { PanoEditor } from '@/components/cotizador/PanoEditor';
import { PostInstalacion } from '@/components/cotizador/PostInstalacion';
import type { Pano, Ventana } from '@/modules/cotizador/types';

type Tab = 'ventanas' | 'post';

export function CotizadorFase2() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { ot, loading, guardar } = useOT(otId);

  const [tab, setTab] = useState<Tab>('ventanas');
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

  const iniciarEdicion = (v: Ventana) => {
    setEditandoId(v.id);
    setVentanaForm({ ...v, panos: v.panos.length > 0 ? v.panos : [crearPanoVacio()] });
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
      return { ...v, panos };
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
    // Propagar ancho/alto/color del primer paño al nivel ventana si están vacíos
    const primer = ventanaForm.panos[0];
    const vent: Ventana = {
      ...ventanaForm,
      alto: parseFloat(String(primer?.alto)) || ventanaForm.alto || 0,
      color: primer?.color || ventanaForm.color || 'Blanco',
    };
    const err = validarVentana(vent);
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
    if (!confirm('¿Eliminar esta ventana?')) return;
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
      toast.error('Agregá al menos 1 ventana antes de avanzar');
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
      <div className="flex h-full items-center justify-center text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando…
      </div>
    );
  }
  if (!ot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
        <p>OT no encontrada.</p>
        <Link to="/panel" className="text-sm text-indigo-300 hover:underline">
          Volver al Panel
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/panel')}
            className="rounded p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            title="Volver al Panel"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Fase 2 — Terreno</h2>
            <p className="text-xs text-zinc-500">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'} ·{' '}
              {ventanas.length} ventana{ventanas.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
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
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-white/10 bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Ventanas de la OT
              </h3>
              <button
                onClick={iniciarNueva}
                className="flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[0.7rem] text-indigo-300 hover:bg-indigo-500/20"
              >
                <Plus className="h-3 w-3" /> Nueva
              </button>
            </div>
            {ventanas.length === 0 ? (
              <p className="p-6 text-center text-xs text-zinc-500">
                No hay ventanas todavía. Agregá una desde "Nueva" o desde Fase 1.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {ventanas.map((v) => {
                  const badge = catBadgeColor(v.categoria || '');
                  const activa = editandoId === v.id;
                  return (
                    <li
                      key={String(v.id)}
                      className={cn(
                        'cursor-pointer p-3 hover:bg-white/5',
                        activa && 'bg-indigo-500/10',
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
                      <div className="mt-0.5 text-[0.7rem] text-zinc-500">
                        {tipoVentanaLabel(v.panos.length)} · {resumenPanos(v.panos)}
                      </div>
                      <div className="mt-1 flex justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            iniciarEdicion(v);
                          }}
                          className="rounded border border-white/10 bg-white/5 p-1 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarVentana(v.id);
                          }}
                          className="rounded border border-red-500/30 bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20"
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
              <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-500">
                <Pencil className="h-10 w-10 opacity-40" />
                <p className="text-sm">
                  Seleccioná una ventana de la lista o creá una nueva para editar.
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
                <div className="mb-3 rounded-md border border-white/10 bg-zinc-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {ventanas.find((v) => v.id === ventanaForm.id)
                        ? 'Editar ventana'
                        : 'Nueva ventana'}
                    </h3>
                    <button
                      onClick={cancelarEdicion}
                      className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
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
                        onChange={(e) => actualizarVentana({ categoria: e.target.value })}
                        className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
                      >
                        <option value="">— Seleccioná —</option>
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
                                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                                : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
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
                  <div className="mb-3 flex flex-wrap gap-1 border-b border-white/10 pb-2">
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
                              ? 'border-b-indigo-500 bg-white/5 text-zinc-100'
                              : 'border-b-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
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
        <div className="border-t border-white/10 bg-zinc-900/60 px-4 py-2.5">
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
          ? 'bg-indigo-500 text-white shadow'
          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100',
      )}
    >
      {children}
    </button>
  );
}
