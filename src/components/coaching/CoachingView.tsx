import { useMemo, useState } from 'react';
import {
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import {
  useCoaching,
  crearObjecion,
  actualizarObjecion,
  archivarObjecion,
  crearTip,
  actualizarTip,
  archivarTip,
} from '@/modules/coaching/coaching';
import {
  CATEGORIA_ORDEN,
  CATEGORIA_DESC,
  labelCategoria,
  type CoachingObjecion,
  type CoachingTip,
  type ObjecionCategoria,
} from '@/modules/coaching/types';

export function CoachingView() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const { objeciones, tips, loading, error, refrescar } = useCoaching();

  const [query, setQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [expandida, setExpandida] = useState<Set<string>>(new Set());
  const [editandoObjId, setEditandoObjId] = useState<string | null>(null);
  const [creandoObj, setCreandoObj] = useState(false);
  const [editandoTipId, setEditandoTipId] = useState<string | null>(null);
  const [creandoTip, setCreandoTip] = useState(false);

  const q = query.trim().toLowerCase();

  const objecionesFiltradas = useMemo(() => {
    if (!q) return objeciones;
    return objeciones.filter(
      (o) =>
        o.objecion.toLowerCase().includes(q) ||
        o.respuesta.toLowerCase().includes(q) ||
        labelCategoria(o.categoria).toLowerCase().includes(q),
    );
  }, [objeciones, q]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, CoachingObjecion[]>();
    for (const o of objecionesFiltradas) {
      const arr = map.get(o.categoria) ?? [];
      arr.push(o);
      map.set(o.categoria, arr);
    }
    return map;
  }, [objecionesFiltradas]);

  const categoriasOrdenadas = useMemo(() => {
    return Array.from(porCategoria.keys()).sort((a, b) => {
      const ia = CATEGORIA_ORDEN.indexOf(a as ObjecionCategoria);
      const ib = CATEGORIA_ORDEN.indexOf(b as ObjecionCategoria);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [porCategoria]);

  const tipsFiltrados = useMemo(() => {
    if (!q) return tips;
    return tips.filter(
      (t) => t.titulo.toLowerCase().includes(q) || t.contenido.toLowerCase().includes(q),
    );
  }, [tips, q]);

  const toggle = (id: string) => {
    setExpandida((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleArchivarObj = async (o: CoachingObjecion) => {
    if (!confirm('¿Archivar esta objeción? Quedará oculta, pero no se borra de la base de datos.')) return;
    try {
      await archivarObjecion(o.id);
      toast.success('Objeción archivada');
      await refrescar();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleArchivarTip = async (t: CoachingTip) => {
    if (!confirm('¿Archivar este tip? Quedará oculto, pero no se borra de la base de datos.')) return;
    try {
      await archivarTip(t.id);
      toast.success('Tip archivado');
      await refrescar();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando coaching…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <BookOpen className="h-5 w-5 text-accent" /> Coaching de ventas
          </h2>
          <p className="text-xs text-muted-foreground">
            Cómo responder a las objeciones más comunes y tips para vender mejor. Estos consejos
            también aparecen solos dentro de cada lead según su etapa.
          </p>
        </div>
        {esAdmin && (
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setEditMode((v) => !v);
              setEditandoObjId(null);
              setEditandoTipId(null);
              setCreandoObj(false);
              setCreandoTip(false);
            }}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            {editMode ? 'Listo' : 'Editar contenido'}
          </Button>
        )}
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar objeción o palabra clave…"
          className="pl-8"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* ── Objeciones ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Manual de objeciones
            </h3>
            {esAdmin && editMode && !creandoObj && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setCreandoObj(true)}>
                <Plus className="h-3.5 w-3.5" /> Agregar objeción
              </Button>
            )}
          </div>

          {esAdmin && editMode && creandoObj && (
            <ObjecionForm
              onCancel={() => setCreandoObj(false)}
              onSaved={async () => {
                setCreandoObj(false);
                await refrescar();
              }}
            />
          )}

          {categoriasOrdenadas.length === 0 && !creandoObj && (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
              {q ? 'Sin resultados para tu búsqueda.' : 'Todavía no hay objeciones cargadas.'}
            </div>
          )}

          {categoriasOrdenadas.map((cat) => {
            const items = porCategoria.get(cat) ?? [];
            return (
              <section key={cat} className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    {labelCategoria(cat)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {(CATEGORIA_DESC as Record<string, string>)[cat] ?? ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((o) =>
                    esAdmin && editMode && editandoObjId === o.id ? (
                      <ObjecionForm
                        key={o.id}
                        initial={o}
                        onCancel={() => setEditandoObjId(null)}
                        onSaved={async () => {
                          setEditandoObjId(null);
                          await refrescar();
                        }}
                      />
                    ) : (
                      <ObjecionCard
                        key={o.id}
                        objecion={o}
                        abierta={!!q || expandida.has(o.id)}
                        onToggle={() => toggle(o.id)}
                        editMode={esAdmin && editMode}
                        onEdit={() => setEditandoObjId(o.id)}
                        onArchivar={() => handleArchivarObj(o)}
                      />
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* ── Tips ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Lightbulb className="h-4 w-4 text-warning" /> Tips de venta
            </h3>
            {esAdmin && editMode && !creandoTip && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setCreandoTip(true)}>
                <Plus className="h-3.5 w-3.5" /> Agregar tip
              </Button>
            )}
          </div>

          {esAdmin && editMode && creandoTip && (
            <TipForm
              onCancel={() => setCreandoTip(false)}
              onSaved={async () => {
                setCreandoTip(false);
                await refrescar();
              }}
            />
          )}

          {tipsFiltrados.length === 0 && !creandoTip && (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
              {q ? 'Sin tips para tu búsqueda.' : 'Todavía no hay tips cargados.'}
            </div>
          )}

          {tipsFiltrados.map((t) =>
            esAdmin && editMode && editandoTipId === t.id ? (
              <TipForm
                key={t.id}
                initial={t}
                onCancel={() => setEditandoTipId(null)}
                onSaved={async () => {
                  setEditandoTipId(null);
                  await refrescar();
                }}
              />
            ) : (
              <TipCard
                key={t.id}
                tip={t}
                editMode={esAdmin && editMode}
                onEdit={() => setEditandoTipId(t.id)}
                onArchivar={() => handleArchivarTip(t)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tarjeta de objeción (colapsable)
// ─────────────────────────────────────────────────────────────────────
function ObjecionCard({
  objecion,
  abierta,
  onToggle,
  editMode,
  onEdit,
  onArchivar,
}: {
  objecion: CoachingObjecion;
  abierta: boolean;
  onToggle: () => void;
  editMode: boolean;
  onEdit: () => void;
  onArchivar: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card/40">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-foreground"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
              abierta && 'rotate-180',
            )}
          />
          <span>“{objecion.objecion}”</span>
        </button>
        {editMode && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onArchivar}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Archivar"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {abierta && (
        <div className="border-t border-border bg-secondary/30 px-3 py-2.5 pl-9 text-sm leading-relaxed text-foreground">
          {objecion.respuesta}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tarjeta de tip
// ─────────────────────────────────────────────────────────────────────
function TipCard({
  tip,
  editMode,
  onEdit,
  onArchivar,
}: {
  tip: CoachingTip;
  editMode: boolean;
  onEdit: () => void;
  onArchivar: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
          {tip.titulo}
        </div>
        {editMode && (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onArchivar}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Archivar"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.contenido}</p>
      {tip.fuente && (
        <div className="mt-1.5 text-[10px] uppercase tracking-wide text-accent">{tip.fuente}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Formulario de objeción (crear / editar) — solo admin
// ─────────────────────────────────────────────────────────────────────
function ObjecionForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: CoachingObjecion;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { empresaId } = useAuth();
  const [categoria, setCategoria] = useState<string>(initial?.categoria ?? 'precio');
  const [objecion, setObjecion] = useState(initial?.objecion ?? '');
  const [respuesta, setRespuesta] = useState(initial?.respuesta ?? '');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!objecion.trim() || !respuesta.trim()) {
      toast.error('Completa la objeción y la respuesta');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await actualizarObjecion(initial.id, { categoria, objecion, respuesta });
      } else if (empresaId) {
        await crearObjecion(empresaId, { categoria, objecion, respuesta });
      }
      toast.success('Guardado');
      await onSaved();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <select
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        {CATEGORIA_ORDEN.map((c) => (
          <option key={c} value={c}>
            {labelCategoria(c)}
          </option>
        ))}
      </select>
      <Input
        value={objecion}
        onChange={(e) => setObjecion(e.target.value)}
        placeholder="Lo que dice el cliente (ej. “Está muy caro”)"
      />
      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        placeholder="Cómo responder…"
        rows={4}
        className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        <Button onClick={guardar} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Guardar
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Formulario de tip (crear / editar) — solo admin
// ─────────────────────────────────────────────────────────────────────
function TipForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: CoachingTip;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { empresaId } = useAuth();
  const [titulo, setTitulo] = useState(initial?.titulo ?? '');
  const [contenido, setContenido] = useState(initial?.contenido ?? '');
  const [fuente, setFuente] = useState(initial?.fuente ?? '');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      toast.error('Completa el título y el contenido');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await actualizarTip(initial.id, { titulo, contenido, fuente });
      } else if (empresaId) {
        await crearTip(empresaId, { titulo, contenido, fuente });
      }
      toast.success('Guardado');
      await onSaved();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
      <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título del tip" />
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        placeholder="Contenido…"
        rows={3}
        className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <Input
        value={fuente ?? ''}
        onChange={(e) => setFuente(e.target.value)}
        placeholder="Fuente o categoría (opcional)"
      />
      <div className="flex gap-2">
        <Button onClick={guardar} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Guardar
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
