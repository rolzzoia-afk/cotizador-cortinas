import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  Loader2,
  MessageCircle,
  Plus,
  Scissors,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import { useOTs } from '@/modules/ots/hooks';
import {
  calcularPorcentaje,
  colorProgreso,
  formatTelefonoWhatsApp,
  OT_ESTADOS,
  OT_ESTADO_META,
  SUB_ETAPAS_PROD,
  WHATSAPP_MESSAGES,
} from '@/modules/ots/constants';
import type { DatosGenerales, OT, OTEstado, SubEtapaProd } from '@/modules/ots/types';
import { confirmar } from '@/components/ui/confirm';

const EMPTY_FORM: DatosGenerales = {
  cliente: '',
  rut: '',
  mail: '',
  telefono: '',
  direccion: '',
  comuna: '',
  ot: '',
  canal: '',
  fecha: new Date().toISOString().split('T')[0],
};

const CANALES = [
  'Instagram',
  'WhatsApp',
  'Referencia',
  'Google',
  'Web',
  'Llamada',
  'Otro',
];

export function Panel() {
  const navigate = useNavigate();
  const { empresaNombre } = useAuth();
  const {
    ots,
    loading,
    online,
    crearOT,
    moverEstado,
    moverSubEtapa,
    archivar,
    restaurar,
    eliminarDefinitivo,
  } = useOTs();

  const [busqueda, setBusqueda] = useState('');
  const [archivoOpen, setArchivoOpen] = useState(false);

  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [nuevoForm, setNuevoForm] = useState<DatosGenerales>({ ...EMPTY_FORM });
  const [creando, setCreando] = useState(false);

  const activas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ots.filter((o) => {
      if (o.estado === 'archivada') return false;
      if (!q) return true;
      const dg = o.datosGenerales || {};
      return (
        (dg.cliente || '').toLowerCase().includes(q) ||
        (dg.ot || '').toLowerCase().includes(q) ||
        (dg.telefono || '').includes(q)
      );
    });
  }, [ots, busqueda]);

  const archivadas = useMemo(() => ots.filter((o) => o.estado === 'archivada'), [ots]);

  const porColumna = useMemo(() => {
    const m: Record<string, OT[]> = {};
    for (const estado of OT_ESTADOS) m[estado] = [];
    for (const ot of activas) {
      if (m[ot.estado]) m[ot.estado].push(ot);
    }
    // Dentro de cada columna, más recientes primero
    for (const estado of OT_ESTADOS) {
      m[estado].sort((a, b) =>
        (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
      );
    }
    return m;
  }, [activas]);

  const abrirOT = (ot: OT) => {
    // Routing según estado (todo React):
    //   cotizacion / esperando → Fase 1
    //   terreno                → Fase 2
    //   aprobada               → Fase 3
    //   produccion             → Fase 4 (sub-etapas + BOM, plan de corte queda en tab Tela legacy)
    //   lista / instalada      → Fase 3 read-only
    localStorage.setItem('activeOTId', ot.id);
    if (ot.estado === 'cotizacion' || ot.estado === 'esperando') {
      navigate(`/ots/${ot.id}/fase1`);
    } else if (ot.estado === 'aprobada' || ot.estado === 'lista' || ot.estado === 'instalada') {
      navigate(`/ots/${ot.id}/fase3`);
    } else if (ot.estado === 'terreno') {
      navigate(`/ots/${ot.id}/fase2`);
    } else if (ot.estado === 'produccion') {
      navigate(`/ots/${ot.id}/fase4`);
    } else {
      // archivada u otros estados → Fase 1 por defecto
      navigate(`/ots/${ot.id}/fase1`);
    }
  };

  const handleCrear = async () => {
    const cliente = (nuevoForm.cliente || '').trim();
    const numeroOT = (nuevoForm.ot || '').trim();
    if (!cliente && !numeroOT) {
      toast.error('Ingresa al menos cliente o número de OT');
      return;
    }
    setCreando(true);
    try {
      const ot = await crearOT({ ...nuevoForm, cliente, ot: numeroOT });
      toast.success('OT creada');
      setNuevoOpen(false);
      setNuevoForm({ ...EMPTY_FORM, fecha: new Date().toISOString().split('T')[0] });
      // Al crear, abrir directamente en Fase 1 React
      localStorage.setItem('activeOTId', ot.id);
      navigate(`/ots/${ot.id}/fase1`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al crear: ' + msg);
    } finally {
      setCreando(false);
    }
  };

  const handleMoverEstado = async (id: string, nuevoEstado: OTEstado) => {
    try {
      await moverEstado(id, nuevoEstado);
    } catch (e) {
      toast.error('Error al mover estado');
    }
  };

  const handleArchivar = async (ot: OT) => {
    const nombre = ot.datosGenerales.cliente || 'esta OT';
    if (!(await confirmar({ titulo: 'Archivar OT', mensaje: `¿Archivar la OT de "${nombre}"?\nPodés restaurarla desde el Historial.`, confirmLabel: 'Archivar' }))) return;
    try {
      await archivar(ot.id);
      toast.success('OT archivada');
    } catch {
      toast.error('Error al archivar');
    }
  };

  const handleRestaurar = async (ot: OT) => {
    try {
      await restaurar(ot.id);
      toast.success('OT restaurada');
    } catch {
      toast.error('Error al restaurar');
    }
  };

  const handleEliminar = async (ot: OT) => {
    const nombre = ot.datosGenerales.cliente || 'esta OT';
    if (!(await confirmar({ titulo: 'Eliminar definitivamente', mensaje: `Eliminar definitivamente la cotización de "${nombre}"?\nEsta acción NO se puede deshacer.`, destructivo: true, confirmLabel: 'Eliminar' }))) return;
    try {
      await eliminarDefinitivo(ot.id);
      toast.success('OT eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleWhatsApp = (ot: OT) => {
    const dg = ot.datosGenerales;
    if (ot.estado === 'archivada') return;
    const nombre = dg.cliente || 'cliente';
    const numOT = dg.ot || '—';
    const mensaje = WHATSAPP_MESSAGES[ot.estado](nombre, numOT, empresaNombre ?? undefined);
    const telefono = formatTelefonoWhatsApp(dg.telefono || '');
    const url =
      telefono.length >= 11
        ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
        : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando OTs…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-3 py-3 sm:px-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Panel de OTs</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {activas.length} activas · {archivadas.length} archivadas
            </span>
            <span
              className={cn(
                'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.65rem]',
                online
                  ? 'border-success/30 bg-success/15 text-success'
                  : 'border-destructive/30 bg-destructive/15 text-destructive',
              )}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? 'en tiempo real' : 'sin conexión'}
            </span>
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente, OT o teléfono…"
              className="w-full pl-8 sm:w-[260px]"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button onClick={() => setNuevoOpen(true)} size="sm" className="shrink-0 gap-1">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva OT</span>
            <span className="sm:hidden">Nueva</span>
          </Button>
        </div>
      </div>

      {/* Kanban — snap horizontal en mobile/tablet para swipe decente */}
      <div className="flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden p-3 sm:p-4 lg:snap-none">
        <div className="flex h-full min-w-max gap-3">
          {OT_ESTADOS.map((estado) => {
            const meta = OT_ESTADO_META[estado];
            const lista = porColumna[estado] || [];
            return (
              <div
                key={estado}
                className="flex h-full w-[85vw] shrink-0 snap-start flex-col rounded-lg border border-border bg-card/40 sm:w-[300px] lg:w-[260px]"
              >
                <div
                  className="flex items-center justify-between rounded-t-lg border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: meta.bg,
                    borderColor: meta.border,
                    color: meta.color,
                  }}
                >
                  <span>{meta.label}</span>
                  <span
                    className="rounded-full bg-background/40 px-1.5 text-[0.7rem]"
                    style={{ color: meta.color }}
                  >
                    {lista.length}
                  </span>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {lista.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-muted-foreground">
                      <span className="text-2xl">{meta.emptyIcon}</span>
                      <span className="mt-1">{meta.emptyMsg}</span>
                      {busqueda && (
                        <span className="mt-1 text-[0.65rem] text-foreground">
                          no coincide con "{busqueda}"
                        </span>
                      )}
                    </div>
                  ) : (
                    lista.map((ot) => (
                      <OTCard
                        key={ot.id}
                        ot={ot}
                        onAbrir={() => abrirOT(ot)}
                        onIrAFase={(ruta) => {
                          localStorage.setItem('activeOTId', ot.id);
                          navigate(`/ots/${ot.id}/${ruta}`);
                        }}
                        onMoverEstado={(est) => handleMoverEstado(ot.id, est)}
                        onMoverSub={(sub) => moverSubEtapa(ot.id, sub)}
                        onArchivar={() => handleArchivar(ot)}
                        onWhatsApp={() => handleWhatsApp(ot)}
                        onEliminar={() => handleEliminar(ot)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Archivadas (drawer colapsable) */}
      <div className="border-t border-border bg-card/40">
        <button
          onClick={() => setArchivoOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-card"
        >
          <span className="flex items-center gap-2 font-medium">
            <Archive className="h-4 w-4" />
            Archivadas
            <span className="rounded-full bg-card px-2 py-0.5 text-[0.7rem] text-muted-foreground">
              {archivadas.length}
            </span>
          </span>
          {archivoOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {archivoOpen && (
          <div className="max-h-[30vh] overflow-y-auto px-4 pb-3">
            {archivadas.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sin OTs archivadas</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">OT</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Creación</th>
                    <th className="p-2 text-left">Modificación</th>
                    <th className="p-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {archivadas.map((ot) => (
                    <tr key={ot.id} className="border-t border-border">
                      <td className="p-2 font-mono">{ot.datosGenerales.ot || '—'}</td>
                      <td className="p-2">{ot.datosGenerales.cliente || '—'}</td>
                      <td className="p-2 text-muted-foreground">
                        {(ot.fechaCreacion || '').slice(0, 10)}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {(ot.fechaModificacion || '').slice(0, 10)}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleRestaurar(ot)}
                            className="rounded border border-border bg-card px-2 py-1 text-[0.7rem] text-foreground hover:bg-card"
                          >
                            <ArchiveRestore className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => handleEliminar(ot)}
                            className="rounded border border-destructive/30 bg-destructive/15 px-2 py-1 text-[0.7rem] text-destructive hover:bg-destructive/15"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal: Nueva OT */}
      <Dialog open={nuevoOpen} onOpenChange={(v) => (v ? null : setNuevoOpen(false))}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva OT</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Cliente *</Label>
              <Input
                value={nuevoForm.cliente || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, cliente: e.target.value }))}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <Label>Número OT</Label>
              <Input
                value={nuevoForm.ot || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, ot: e.target.value }))}
                placeholder="2913"
              />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={nuevoForm.fecha || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div>
              <Label>RUT</Label>
              <Input
                value={nuevoForm.rut || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, rut: e.target.value }))}
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                value={nuevoForm.telefono || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={nuevoForm.mail || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, mail: e.target.value }))}
                placeholder="cliente@correo.cl"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Dirección</Label>
              <Input
                value={nuevoForm.direccion || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Calle 123, depto 4"
              />
            </div>
            <div>
              <Label>Comuna</Label>
              <Input
                value={nuevoForm.comuna || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, comuna: e.target.value }))}
              />
            </div>
            <div>
              <Label>Canal de contacto</Label>
              <select
                value={nuevoForm.canal || ''}
                onChange={(e) => setNuevoForm((f) => ({ ...f, canal: e.target.value }))}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {CANALES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevoOpen(false)} disabled={creando}>
              Cancelar
            </Button>
            <Button onClick={handleCrear} disabled={creando}>
              {creando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear y abrir cotizador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card individual de OT
// ─────────────────────────────────────────────────────────────
const FASES_OT: Array<{ ruta: string; label: string }> = [
  { ruta: 'fase0', label: 'Fase 0 · Cotizar (agregar cortinas)' },
  { ruta: 'fase1', label: 'Fase 1 · Datos' },
  { ruta: 'fase2', label: 'Fase 2 · Terreno / Ventanas' },
  { ruta: 'fase3', label: 'Fase 3 · Aprobación' },
  { ruta: 'fase4', label: 'Fase 4 · Producción' },
  { ruta: 'tela', label: 'Optimizador de Tela' },
];

function OTCard({
  ot,
  onAbrir,
  onIrAFase,
  onMoverEstado,
  onMoverSub,
  onArchivar,
  onWhatsApp,
  onEliminar,
}: {
  ot: OT;
  onAbrir: () => void;
  onIrAFase: (ruta: string) => void;
  onMoverEstado: (e: OTEstado) => void;
  onMoverSub: (s: SubEtapaProd) => void;
  onArchivar: () => void;
  onWhatsApp: () => void;
  onEliminar: () => void;
}) {
  const [menuFases, setMenuFases] = useState(false);
  const dg = ot.datosGenerales || {};
  const idxEstado = (OT_ESTADOS as readonly OTEstado[]).indexOf(ot.estado);
  const prev = idxEstado > 0 ? OT_ESTADOS[idxEstado - 1] : null;
  const next = idxEstado >= 0 && idxEstado < OT_ESTADOS.length - 1 ? OT_ESTADOS[idxEstado + 1] : null;
  const enEtapaInicial = ot.estado === 'cotizacion' || ot.estado === 'esperando';
  const nVent = (ot.storeVentanas || []).length;
  const enCotizacion = ot.estado === 'cotizacion' || ot.estado === 'esperando';
  const itemCount = enCotizacion ? ot.cotizacionCount || 0 : nVent;
  const itemLabel = enCotizacion
    ? `${itemCount} cotizada${itemCount !== 1 ? 's' : ''}`
    : `${itemCount} ventana${itemCount !== 1 ? 's' : ''}`;
  const pct = calcularPorcentaje(ot.estado, ot.subEtapa);
  const color = colorProgreso(pct);

  return (
    <div className="rounded-md border border-border bg-secondary/50 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.72rem] font-semibold text-foreground">
          OT {dg.ot || '—'}
        </span>
        <span className="text-[0.65rem] text-muted-foreground">
          {(ot.fechaCreacion || '').slice(0, 10)}
        </span>
      </div>
      <div className="mt-1 truncate text-[0.82rem] font-medium text-foreground">
        {dg.cliente || '(sin cliente)'}
      </div>
      <div className="mt-0.5 text-[0.7rem] text-muted-foreground">{itemLabel}</div>

      {/* Progreso */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[0.6rem] text-muted-foreground">
          <span>Avance</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-card">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Sub-etapas (solo producción) */}
      {ot.estado === 'produccion' && (
        <div className="mt-2">
          <div className="flex gap-1">
            {SUB_ETAPAS_PROD.map((s) => {
              const subIdx = SUB_ETAPAS_PROD.indexOf(ot.subEtapa || 'Estructura');
              const thisIdx = SUB_ETAPAS_PROD.indexOf(s);
              const done = thisIdx < subIdx;
              const current = thisIdx === subIdx;
              return (
                <div
                  key={s}
                  title={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    done
                      ? 'bg-success'
                      : current
                        ? 'bg-sky-400 animate-pulse'
                        : 'bg-card',
                  )}
                />
              );
            })}
          </div>
          <select
            value={ot.subEtapa || 'Estructura'}
            onChange={(e) => onMoverSub(e.target.value as SubEtapaProd)}
            className="mt-1.5 w-full rounded border border-border bg-card px-1.5 py-1 text-[0.7rem]"
          >
            {SUB_ETAPAS_PROD.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Acciones */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          onClick={onAbrir}
          className="flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[0.7rem] font-medium text-accent hover:bg-accent/20"
          title="Abrir en la fase según el estado"
        >
          <FolderOpen className="h-3 w-3" /> Abrir
        </button>
        <div className="relative">
          <button
            onClick={() => setMenuFases((v) => !v)}
            className="flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[0.7rem] font-medium text-muted-foreground hover:text-foreground"
            title="Ir a una fase específica"
          >
            Ir a fase <ChevronDown className="h-3 w-3" />
          </button>
          {menuFases && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuFases(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border border-border bg-popover py-1 shadow-lg">
                {FASES_OT.map((f) => (
                  <button
                    key={f.ruta}
                    onClick={() => {
                      setMenuFases(false);
                      onIrAFase(f.ruta);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.72rem] text-foreground hover:bg-secondary"
                  >
                    {f.ruta === 'tela' && <Scissors className="h-3 w-3 text-accent" />}
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {prev && (
          <button
            onClick={() => onMoverEstado(prev)}
            className="rounded border border-border bg-card p-1 text-muted-foreground hover:bg-card hover:text-foreground"
            title={`Retroceder a ${OT_ESTADO_META[prev].label}`}
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
        )}
        {next && (
          <button
            onClick={() => onMoverEstado(next)}
            className="rounded border border-success/30 bg-success/15 p-1 text-success hover:bg-success/15"
            title={`Avanzar a ${OT_ESTADO_META[next].label}`}
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={onArchivar}
          className="rounded border border-border bg-card p-1 text-muted-foreground hover:bg-card hover:text-foreground"
          title="Archivar"
        >
          <Archive className="h-3 w-3" />
        </button>
        <button
          onClick={onWhatsApp}
          className="rounded border border-success/30 bg-success/15 p-1 text-success hover:bg-success/15"
          title="Notificar por WhatsApp"
        >
          <MessageCircle className="h-3 w-3" />
        </button>
        {enEtapaInicial && (
          <button
            onClick={onEliminar}
            className="rounded border border-destructive/30 bg-destructive/15 p-1 text-destructive hover:bg-destructive/15"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
