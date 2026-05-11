import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  Bot,
  Boxes,
  Brain,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Info,
  Kanban,
  Lightbulb,
  Package,
  RefreshCw,
  ShoppingCart,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type OT = {
  id: string | number;
  estado: string | null;
  datos_generales: Record<string, unknown> | null;
  items: unknown[] | null;
  fecha_creacion: string | null;
  fecha_modificacion: string | null;
  total: number | null;
};

type Insumo = {
  cod: string | null;
  nemotecnico: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  minimo: number | null;
  categoria: string | null;
  sub_categoria: string | null;
  ubicacion: string | null;
  stock_total: number;
  unidad?: string;
};

type Mov = {
  id?: string | number;
  tipo: string | null;
  cantidad: number | null;
  fecha: string | null;
  codigo: string | null;
  producto: string | null;
  ot: string | null;
  almacen: string | null;
  responsable_entrega: string | null;
  bitacora: string | null;
};

type Rack = {
  rack: string;
  fila: string | number;
  columna: string | number;
  codigo_insumo: string | null;
  almacen: string | null;
};

type ErrorCorte = {
  motivo: string | null;
  created_at: string;
  ot: string | null;
  cod_original: string | null;
  medida_cm: number | null;
  reemplazo_cod: string | null;
  reemplazo_colmena: string | null;
  registrado_por: string | null;
};

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const ESTADOS_ACTIVOS = [
  'cotizacion',
  'medicion',
  'aprobado',
  'produccion',
  'listo',
  'instalacion',
];
const ESTADOS_PRODUCCION = ['aprobado', 'produccion', 'listo', 'instalacion'];

const COLORES_ERROR: Record<string, string> = {
  'Error de corte (operario)': '#ef4444',
  'Falla en el tubo': '#f97316',
  'Error del vendedor': '#f59e0b',
  'Error del instalador': '#3b82f6',
  'Medida incorrecta en plano': '#8b5cf6',
  'Material defectuoso': '#22c55e',
  Otro: '#a1a1aa',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('es-CL', { maximumFractionDigits: 1 });
}

function diasDesde(fecha: string | null): number {
  if (!fecha) return 999;
  const d = new Date(fecha);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function fmtFechaHora(fecha: string | null): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  return `${d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString(
    'es-CL',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function dgStr(ot: OT, keys: string[]): string | null {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  for (const k of keys) {
    const v = dg[k];
    if (v != null && v !== '') return String(v);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Glass card wrapper
// ─────────────────────────────────────────────────────────────
function GlassCard({
  title,
  icon,
  iconColor,
  count,
  countColor,
  extra,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  count?: number;
  countColor?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/85 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h6 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span style={{ color: iconColor }}>{icon}</span>
          {title}
        </h6>
        <div className="flex items-center gap-2">
          {extra}
          {count !== undefined && (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: countColor
                  ? `${countColor}20`
                  : 'rgba(124,117,240,0.15)',
                color: countColor ?? '#7C75F0',
                borderColor: countColor
                  ? `${countColor}55`
                  : 'rgba(124,117,240,0.35)',
              }}
            >
              {count}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
      <div className="text-2xl">{icon}</div>
      <div className="text-xs">{text}</div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-indigo-400" />
      <span>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Diagnóstico IA
// ─────────────────────────────────────────────────────────────
const CHIPS = [
  { emoji: '🎯', label: '¿Qué hacer hoy?', q: '¿Qué OTs están en riesgo y qué debería hacer hoy?' },
  { emoji: '🛒', label: '¿Qué comprar?', q: '¿Qué insumos tengo que comprar esta semana y cuánto?' },
  {
    emoji: '🔍',
    label: 'Revisa mis datos',
    q: '¿Hay algún problema o inconsistencia en mis datos que debería corregir?',
  },
  {
    emoji: '💡',
    label: 'Ideas de mejora',
    q: '¿Qué mejoras le harías a mi sistema de gestión basándote en estos datos?',
  },
  {
    emoji: '📦',
    label: 'Optimizar stock',
    q: '¿Cuáles son los insumos más críticos para la producción actual y cómo optimizo el stock?',
  },
  {
    emoji: '📊',
    label: 'Analizar patrones',
    q: '¿Qué patrones ves en mis movimientos de inventario que debería atender?',
  },
];

function generarTextoDiag(ots: OT[], insumos: Insumo[], movs: Mov[], racks: Rack[]): string {
  const lineas: string[] = [];
  const ahora = new Date().toLocaleString('es-CL');

  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('   DIAGNÓSTICO OPERACIONAL — CORTINAS ROLZZO');
  lineas.push(`   Generado: ${ahora}`);
  lineas.push('   Sistema: App de gestión de cortinas roller (Supabase)');
  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('');
  lineas.push('Contexto: Soy dueño/operario de una empresa de cortinas roller.');
  lineas.push('Tengo una app web propia conectada a Supabase que gestiona:');
  lineas.push('órdenes de trabajo (OTs), inventario de insumos, stock de telas,');
  lineas.push('bodeguero/despacho con QR, optimizador de corte de tubos y este panel.');
  lineas.push('');

  // 1. OTs
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('1. ESTADO DE LAS ÓRDENES DE TRABAJO (OTs)');
  lineas.push('───────────────────────────────────────────────────────');
  const porEstado: Record<string, number> = {};
  for (const ot of ots) {
    const e = ot.estado || 'sin estado';
    porEstado[e] = (porEstado[e] || 0) + 1;
  }
  lineas.push(`Total OTs en el sistema: ${ots.length}`);
  for (const [est, cant] of Object.entries(porEstado)) {
    lineas.push(`  · ${est}: ${cant}`);
  }
  lineas.push('');

  const otsActivas = ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''));
  lineas.push(`OTs activas (${otsActivas.length}):`);
  for (const ot of otsActivas.slice(0, 20)) {
    const otId = dgStr(ot, ['ot']) || '#' + String(ot.id).slice(-6);
    const cli = dgStr(ot, ['nombre_cliente', 'cliente']) || '(sin nombre)';
    const items = (ot.items || []).length;
    const dias = diasDesde(ot.fecha_modificacion);
    const fe = dgStr(ot, ['fecha_entrega', 'fechaEntrega']);
    const dEntr = fe ? diasHasta(fe) : null;
    let flags = '';
    if (ESTADOS_PRODUCCION.includes(ot.estado || '') && dias >= 3)
      flags += ` ⚠ ${dias}d sin movimiento`;
    if (dEntr !== null && dEntr <= 0) flags += ' 🔴 ENTREGA VENCIDA';
    else if (dEntr !== null && dEntr <= 5) flags += ` 🔴 entrega en ${dEntr}d`;
    lineas.push(`  OT ${otId} | ${cli} | ${ot.estado} | ${items} ventana(s)${flags}`);
  }
  if (otsActivas.length > 20) lineas.push(`  ... y ${otsActivas.length - 20} más`);
  lineas.push('');

  // 2. Inventario
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('2. INVENTARIO DE INSUMOS');
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push(`Total insumos en catálogo: ${insumos.length}`);
  lineas.push(`Posiciones de rack cargadas: ${racks.length}`);

  const sinStock = insumos.filter((i) => i.stock_total <= 0);
  const bajoMinimo = insumos.filter(
    (i) => i.minimo != null && i.stock_total > 0 && i.stock_total <= Number(i.minimo),
  );
  lineas.push(`Sin stock: ${sinStock.length}`);
  lineas.push(`Bajo stock mínimo: ${bajoMinimo.length}`);
  lineas.push('');

  if (sinStock.length > 0) {
    lineas.push('Insumos SIN STOCK:');
    for (const i of sinStock.slice(0, 15)) {
      lineas.push(`  · [${i.cod}] ${i.nemotecnico || i.cod} — ${i.categoria || '—'}`);
    }
    if (sinStock.length > 15) lineas.push(`  ... y ${sinStock.length - 15} más`);
    lineas.push('');
  }
  if (bajoMinimo.length > 0) {
    lineas.push('Insumos BAJO MÍNIMO:');
    for (const i of bajoMinimo.slice(0, 15)) {
      const pct = Math.round((i.stock_total / Number(i.minimo)) * 100);
      lineas.push(
        `  · [${i.cod}] ${i.nemotecnico || i.cod} — stock: ${i.stock_total} / mín: ${i.minimo} (${pct}%)`,
      );
    }
    if (bajoMinimo.length > 15) lineas.push(`  ... y ${bajoMinimo.length - 15} más`);
    lineas.push('');
  }

  // 3. Movimientos
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('3. MOVIMIENTOS DE INVENTARIO (últimos 30 días)');
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push(`Total movimientos: ${movs.length}`);
  const tiposCont: Record<string, number> = {};
  for (const m of movs) {
    const t = (m.tipo || 'sin tipo').toLowerCase();
    tiposCont[t] = (tiposCont[t] || 0) + 1;
  }
  for (const [t, n] of Object.entries(tiposCont)) {
    lineas.push(`  · ${t}: ${n} movimientos`);
  }
  lineas.push('');

  const salidas = movs.filter((m) =>
    ['salida', 'despacho'].includes((m.tipo || '').toLowerCase()),
  );
  const consumoMap: Record<string, number> = {};
  for (const m of salidas) {
    const k = (m.codigo || m.producto || '?').trim();
    consumoMap[k] = (consumoMap[k] || 0) + (Number(m.cantidad) || 0);
  }
  const topCons = Object.entries(consumoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (topCons.length > 0) {
    lineas.push('Top 10 insumos más consumidos:');
    for (const [cod, cant] of topCons) {
      const ins = insumos.find((x) => (x.cod || '').toUpperCase() === cod.toUpperCase());
      const desc = ins?.nemotecnico || ins?.cod || cod;
      const stk = ins ? ` | stock actual: ${ins.stock_total}` : '';
      lineas.push(`  · ${desc}: ${cant} unid.${stk}`);
    }
    lineas.push('');
  }

  // 4. Métricas
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('4. MÉTRICAS RÁPIDAS');
  lineas.push('───────────────────────────────────────────────────────');
  const valorPipeline = otsActivas.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  lineas.push(`Valor total OTs activas: $${valorPipeline.toLocaleString('es-CL')}`);
  const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const movsUltima = movs.filter((m) => m.fecha && new Date(m.fecha).getTime() >= hace7);
  lineas.push(`Movimientos últimos 7 días: ${movsUltima.length}`);
  lineas.push('');
  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('FIN DEL DIAGNÓSTICO — Puedes preguntarme cualquier cosa');
  lineas.push('sobre estos datos, pedir mejoras, detectar bugs o analizar patrones.');
  lineas.push('═══════════════════════════════════════════════════════');

  return lineas.join('\n');
}

function DiagDialog({
  open,
  onOpenChange,
  ots,
  insumos,
  movs,
  racks,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ots: OT[];
  insumos: Insumo[];
  movs: Mov[];
  racks: Rack[];
}) {
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCopiado(false);
    if (ots.length === 0 && insumos.length === 0) {
      setTexto(
        'Primero presiona "Actualizar" para cargar los datos, y después genera el diagnóstico.',
      );
    } else {
      setTexto(generarTextoDiag(ots, insumos, movs, racks));
    }
  }, [open, ots, insumos, movs, racks]);

  const agregar = (q: string) => {
    const sep = '\n\n══════════════════════════════════════\nMI PREGUNTA PARA CLAUDE:\n══════════════════════════════════════\n';
    if (texto.includes('MI PREGUNTA PARA CLAUDE:')) {
      setTexto(texto.replace(/\n\n══+\nMI PREGUNTA[\s\S]*$/, sep + q));
    } else {
      setTexto(texto + sep + q);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success('Texto copiado');
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto manualmente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Bot className="h-5 w-5 text-accent" /> Diagnóstico para Claude
            </DialogTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copiar} className="gap-1.5">
                {copiado ? (
                  <>
                    <Check className="h-4 w-4" /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="h-4 w-4" /> Copiar todo
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
          <strong>¿Cómo se usa?</strong> Copia el texto, abre una nueva conversación con Claude y
          pégalo. Luego escribe tu pregunta o problema. Claude va a tener todo el contexto de tu
          empresa para ayudarte.
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              onClick={() => agregar(c.q)}
              className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-foreground transition hover:border-accent/40 hover:bg-accent/10"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <textarea
          value={texto}
          readOnly
          className="h-[55vh] w-full resize-none rounded-lg border border-border bg-background p-3 font-mono text-[11px] text-foreground"
        />
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function Inteligencia() {
  const { empresaId } = useAuth();
  const [ots, setOts] = useState<OT[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [movsHoy, setMovsHoy] = useState<Mov[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [errores, setErrores] = useState<ErrorCorte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);

  const cargarTodo = async () => {
    if (!empresaId) return;
    setRefreshing(true);
    try {
      const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const hoy = new Date().toISOString().split('T')[0];

      const [rOts, rIns, rMovs, rRacks, rMovsHoy, rErrores] = await Promise.all([
        supabase
          .from('ots')
          .select('id,estado,datos_generales,items,fecha_creacion,fecha_modificacion,total')
          .eq('empresa_id', empresaId)
          .order('fecha_modificacion', { ascending: false }),
        supabase
          .from('insumos')
          .select('cod,nemotecnico,stock_mp,stock_liberado,minimo,categoria,sub_categoria,ubicacion')
          .eq('empresa_id', empresaId)
          .order('nemotecnico'),
        supabase
          .from('movimientos_insumos')
          .select('id,tipo,cantidad,fecha,codigo,producto,ot,almacen,responsable_entrega,bitacora')
          .eq('empresa_id', empresaId)
          .gte('fecha', hace30dias)
          .order('fecha', { ascending: false }),
        supabase
          .from('ubicaciones_rack')
          .select('rack,fila,columna,codigo_insumo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_insumos')
          .select('id,tipo,cantidad,fecha,codigo,producto,ot,almacen,responsable_entrega,bitacora')
          .eq('empresa_id', empresaId)
          .gte('fecha', hoy)
          .order('fecha', { ascending: false })
          .limit(50),
        supabase
          .from('errores_corte')
          .select('motivo,created_at,ot,cod_original,medida_cm,reemplazo_cod,reemplazo_colmena,registrado_por')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: true })
          .limit(500),
      ]);

      setOts((rOts.data as OT[]) || []);
      setInsumos(
        ((rIns.data as Omit<Insumo, 'stock_total'>[]) || []).map((i) => ({
          ...i,
          stock_total: (i.stock_mp || 0) + (i.stock_liberado || 0),
        })),
      );
      setMovs((rMovs.data as Mov[]) || []);
      setRacks((rRacks.data as Rack[]) || []);
      setMovsHoy((rMovsHoy.data as Mov[]) || []);
      setErrores((rErrores.data as ErrorCorte[]) || []);
      setLastUpdate(new Date());
    } catch (e) {
      toast.error('Error al cargar datos. Revisa la conexión.');
      console.error('[Inteligencia]', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    const id = setInterval(cargarTodo, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // ── Memos derivados ─────────────────────────────────────────
  const otsActivas = useMemo(
    () => ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || '')),
    [ots],
  );
  const otsProduccion = useMemo(
    () => ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || '')),
    [ots],
  );
  const stockBajo = useMemo(
    () =>
      insumos.filter(
        (i) => i.minimo != null && Number(i.minimo) > 0 && i.stock_total <= Number(i.minimo),
      ),
    [insumos],
  );
  const otsSinMov = useMemo(
    () =>
      ots.filter(
        (o) =>
          ESTADOS_PRODUCCION.includes(o.estado || '') && diasDesde(o.fecha_modificacion) >= 3,
      ),
    [ots],
  );

  // Salidas para análisis de consumo
  const salidas = useMemo(
    () =>
      movs.filter((m) => {
        const t = (m.tipo || '').toLowerCase();
        return t.includes('salida') || t.includes('despacho');
      }),
    [movs],
  );
  const consumoMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of salidas) {
      const k = (m.codigo || '').trim().toUpperCase();
      if (!k) continue;
      map[k] = (map[k] || 0) + (Number(m.cantidad) || 0);
    }
    return map;
  }, [salidas]);

  // ── Render: helpers ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background text-muted-foreground">
        <Spinner label="Cargando inteligencia…" />
      </div>
    );
  }

  // Summary text
  const hoyStr = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const summaryParts: string[] = [`Hoy, ${hoyStr}.`];
  if (otsActivas.length === 0) {
    summaryParts.push('No hay órdenes de trabajo activas.');
  } else {
    summaryParts.push(
      `Hay <strong>${otsActivas.length} OT${otsActivas.length > 1 ? 's' : ''} activa${
        otsActivas.length > 1 ? 's' : ''
      }</strong>, de las cuales <strong>${otsProduccion.length}</strong> están en producción.`,
    );
  }
  if (stockBajo.length > 0) {
    summaryParts.push(
      `⚠ <strong>${stockBajo.length} insumo${stockBajo.length > 1 ? 's' : ''}</strong> ${
        stockBajo.length > 1 ? 'están' : 'está'
      } por debajo del stock mínimo.`,
    );
  } else {
    summaryParts.push('✅ El stock de insumos está en niveles normales.');
  }
  if (otsSinMov.length > 0) {
    summaryParts.push(
      `🔴 <strong>${otsSinMov.length} OT${otsSinMov.length > 1 ? 's' : ''}</strong> sin movimiento hace 3+ días — revisar urgente.`,
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* HEADER */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-accent/30 bg-gradient-to-br from-indigo-500/10 to-zinc-900/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <span className="text-base font-bold text-foreground">Panel de Inteligencia</span>
          <span className="rounded-full border border-accent/35 bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-accent">
            ROLZZO
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[11px] text-muted-foreground">
              Actualizado{' '}
              {lastUpdate.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDiagOpen(true)}
            className="gap-1.5 border-purple-500/30 bg-accent/10 text-accent hover:bg-accent/20"
          >
            <Bot className="h-4 w-4" /> Diagnóstico IA
          </Button>
          <Button
            size="sm"
            onClick={cargarTodo}
            disabled={refreshing}
            className="gap-1.5 border border-accent/35 bg-accent/15 text-accent hover:bg-accent/25"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-3.5 p-4">
        {/* SUMMARY BANNER */}
        <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-gradient-to-br from-indigo-500/10 to-zinc-900 p-4">
          <div className="text-2xl">📊</div>
          <p
            className="m-0 text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: summaryParts.join(' ') }}
          />
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPICard
            icon={<Kanban className="h-5 w-5" />}
            color="#3b82f6"
            value={otsActivas.length}
            label="OTs activas"
            sub={`${otsProduccion.length} en producción`}
          />
          <KPICard
            icon={<AlertTriangle className="h-5 w-5" />}
            color="#ef4444"
            value={stockBajo.length}
            label="Alertas de stock"
            sub={stockBajo.length === 0 ? 'Todo en orden ✓' : 'insumos bajo mínimo'}
          />
          <KPICard
            icon={<Clock className="h-5 w-5" />}
            color="#f59e0b"
            value={otsSinMov.length}
            label="OTs en riesgo"
            sub="≥3 días sin movimiento"
          />
          <KPICard
            icon={<ArrowDownCircle className="h-5 w-5" />}
            color="#22c55e"
            value={movsHoy.length}
            label="Movimientos hoy"
            sub={`${movsHoy.filter((m) => (m.tipo || '').toLowerCase() === 'entrada').length} entradas · ${movsHoy.filter((m) => (m.tipo || '').toLowerCase() === 'salida').length} salidas`}
          />
        </div>

        {/* FILA 1 */}
        <div className="grid gap-3.5 md:grid-cols-2">
          <CrossAlertsCard
            insumos={insumos}
            stockBajo={stockBajo}
            racks={racks}
            ots={ots}
            movs={movs}
          />
          <OTRiskCard ots={ots} />
        </div>

        {/* FILA 2 */}
        <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <ConsumoCard salidas={salidas} insumos={insumos} />
          <ErroresCorteCard errores={errores} />
          <RestockCard insumos={insumos} consumoMap={consumoMap} />
        </div>

        {/* FILA 3 */}
        <div className="grid gap-3.5 md:grid-cols-2">
          <ActivityCard movs={movs} insumos={insumos} />
          <InsightsCard ots={ots} insumos={insumos} movs={movs} />
        </div>

        {/* FILA 4 */}
        <StockGeneralCard
          insumos={insumos}
          racks={racks}
          consumoMap={consumoMap}
          filtro={filtroCategoria}
          onFiltro={setFiltroCategoria}
        />
      </div>

      <DiagDialog
        open={diagOpen}
        onOpenChange={setDiagOpen}
        ots={ots}
        insumos={insumos}
        movs={movs}
        racks={racks}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────
function KPICard({
  icon,
  color,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card/85 p-4"
      style={{ borderColor: `${color}30` }}
    >
      <div
        className="absolute right-2 top-2 opacity-40"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Alertas cruzadas
// ─────────────────────────────────────────────────────────────
function CrossAlertsCard({
  stockBajo,
  racks,
  ots,
  movs,
}: {
  insumos: Insumo[];
  stockBajo: Insumo[];
  racks: Rack[];
  ots: OT[];
  movs: Mov[];
}) {
  const otsEnProd = ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || ''));

  const cruces = useMemo(() => {
    return stockBajo
      .map((ins) => {
        const codIns = (ins.cod || '').toUpperCase().trim();
        const otsAfectadas: { otId: string; cli: string; movs: number }[] = [];
        for (const ot of otsEnProd) {
          const otId = dgStr(ot, ['ot']) || String(ot.id);
          const cli = dgStr(ot, ['nombre_cliente', 'cliente']) || 'Sin nombre';
          const movsOT = movs.filter((m) => {
            const mc = (m.codigo || '').toUpperCase().trim();
            const otM = String(m.ot || '');
            return otM === String(ot.id) && mc === codIns;
          });
          if (movsOT.length > 0) otsAfectadas.push({ otId, cli, movs: movsOT.length });
        }
        const stock = ins.stock_total;
        const minimo = Number(ins.minimo) || 0;
        const pct = minimo > 0 ? Math.max(0, Math.min(100, (stock / minimo) * 100)) : 0;
        const nivel = stock <= 0 || stock < minimo * 0.5 ? 'red' : 'amber';
        const nivelTxt = stock <= 0 ? 'Sin stock' : 'Bajo mínimo';
        const rack = racks.find(
          (r) => (r.codigo_insumo || '').toUpperCase() === codIns,
        );
        const posicion = rack
          ? `${rack.rack} · ${rack.fila}-${rack.columna}`
          : ins.ubicacion || '—';
        return { ins, stock, minimo, pct, nivel, nivelTxt, posicion, otsAfectadas };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [stockBajo, racks, otsEnProd, movs]);

  return (
    <GlassCard
      title="Stock crítico cruzado con producción"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconColor="#ef4444"
      count={cruces.length}
      countColor={cruces.length > 0 ? '#ef4444' : '#7C75F0'}
    >
      <div className="max-h-80 overflow-y-auto">
        {cruces.length === 0 ? (
          <EmptyState icon="✅" text="Todos los insumos tienen stock suficiente" />
        ) : (
          cruces.map((c, i) => (
            <div
              key={`${c.ins.cod}-${i}`}
              className="flex items-start gap-2.5 border-b border-border py-2.5 last:border-0"
            >
              <div
                className={cn(
                  'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                  c.nivel === 'red' ? 'bg-destructive' : 'bg-warning',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">
                  {c.ins.nemotecnico || c.ins.cod}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  📦 Stock: <strong>{fmt(c.stock)}</strong> / mín {fmt(c.minimo)}
                  {c.posicion !== '—' && <> · 📍 {c.posicion}</>}
                </div>
                {c.otsAfectadas.length > 0 && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    🔗 OTs recientes:{' '}
                    {c.otsAfectadas
                      .slice(0, 2)
                      .map((o) => (
                        <em key={o.otId} className="text-muted-foreground">
                          {o.otId}
                        </em>
                      ))
                      .reduce<React.ReactNode[]>((acc, el, idx) => {
                        if (idx > 0) acc.push(', ');
                        acc.push(el);
                        return acc;
                      }, [])}
                  </div>
                )}
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full"
                    style={{
                      width: c.pct + '%',
                      background: c.nivel === 'red' ? '#ef4444' : '#f59e0b',
                    }}
                  />
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  c.nivel === 'red'
                    ? 'border-destructive/30 bg-destructive/15 text-destructive'
                    : 'border-warning/30 bg-warning/15 text-warning',
                )}
              >
                {c.nivelTxt}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// OTs en riesgo
// ─────────────────────────────────────────────────────────────
function OTRiskCard({ ots }: { ots: OT[] }) {
  const riesgos = useMemo(() => {
    const candidatas = ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''));
    return candidatas
      .map((ot) => {
        const otId = dgStr(ot, ['ot']) || '#' + String(ot.id).slice(-4);
        const cli = dgStr(ot, ['nombre_cliente', 'cliente']) || 'Sin nombre';
        const estado = ot.estado || '—';
        const diasSinMov = diasDesde(ot.fecha_modificacion);
        const fe = dgStr(ot, ['fecha_entrega', 'fechaEntrega']);
        const diasParaEntr = fe ? diasHasta(fe) : null;

        let riesgo = 0;
        const motivos: string[] = [];
        if (ESTADOS_PRODUCCION.includes(estado)) {
          if (diasSinMov >= 5) {
            riesgo += 3;
            motivos.push(`${diasSinMov}d sin movimiento`);
          } else if (diasSinMov >= 3) {
            riesgo += 2;
            motivos.push(`${diasSinMov}d sin actividad`);
          }
        }
        if (diasParaEntr !== null) {
          if (diasParaEntr <= 0) {
            riesgo += 4;
            motivos.push('¡Entrega vencida!');
          } else if (diasParaEntr <= 2) {
            riesgo += 3;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          } else if (diasParaEntr <= 5) {
            riesgo += 2;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          } else if (diasParaEntr <= 10) {
            riesgo += 1;
            motivos.push(`Entrega en ${diasParaEntr}d`);
          }
        }
        return { ot, otId, cli, estado, diasSinMov, diasParaEntr, riesgo, motivos };
      })
      .filter((r) => r.riesgo > 0)
      .sort((a, b) => b.riesgo - a.riesgo);
  }, [ots]);

  const estadoBadges: Record<string, { txt: string; cls: string }> = {
    cotizacion: { txt: 'Cotización', cls: 'border-blue-500/30 bg-accent/15 text-accent' },
    medicion: { txt: 'Medición', cls: 'border-blue-500/30 bg-accent/15 text-accent' },
    aprobado: { txt: 'Aprobado', cls: 'border-purple-500/30 bg-accent/15 text-accent' },
    produccion: { txt: 'Producción', cls: 'border-warning/30 bg-warning/15 text-warning' },
    listo: { txt: 'Listo', cls: 'border-success/30 bg-success/15 text-success' },
    instalacion: {
      txt: 'Instalación',
      cls: 'border-success/30 bg-success/15 text-success',
    },
  };

  return (
    <GlassCard
      title="OTs en riesgo operativo"
      icon={<Clock className="h-4 w-4" />}
      iconColor="#f59e0b"
      count={riesgos.length}
      countColor={riesgos.length > 0 ? '#f59e0b' : '#7C75F0'}
    >
      <div className="max-h-80 overflow-y-auto">
        {riesgos.length === 0 ? (
          <EmptyState icon="✅" text="No hay OTs en situación de riesgo" />
        ) : (
          riesgos.slice(0, 10).map((r) => {
            const borderCls =
              r.riesgo >= 4
                ? 'border-l-red-500'
                : r.riesgo >= 2
                  ? 'border-l-amber-500'
                  : 'border-l-blue-500';
            const badge = estadoBadges[r.estado] || {
              txt: r.estado,
              cls: 'border-blue-500/30 bg-accent/15 text-accent',
            };
            return (
              <div
                key={String(r.ot.id)}
                className={cn(
                  'mb-2 rounded-lg border border-border border-l-4 bg-white/[0.02] p-3',
                  borderCls,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold text-foreground">
                    📋 {r.otId} — {r.cli}
                  </span>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                      badge.cls,
                    )}
                  >
                    {badge.txt}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {r.motivos.map((m, i) => (
                    <span key={i}>
                      {i > 0 && '  ·  '}⚠ {m}
                    </span>
                  ))}
                  {r.diasParaEntr !== null && (
                    <div className="mt-1">
                      📅 Entrega:{' '}
                      {r.diasParaEntr <= 0 ? (
                        <strong className="text-destructive">VENCIDA</strong>
                      ) : (
                        fmtFecha(dgStr(r.ot, ['fecha_entrega', 'fechaEntrega']))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Top consumo 30 días
// ─────────────────────────────────────────────────────────────
function ConsumoCard({ salidas, insumos }: { salidas: Mov[]; insumos: Insumo[] }) {
  const { top, top5 } = useMemo(() => {
    if (salidas.length === 0) return { top: [], top5: [] };
    const mapa: Record<string, { desc: string; cantidad: number; movs: number }> = {};
    for (const m of salidas) {
      const key = (m.codigo || '').trim() || (m.producto || '?').trim();
      const desc = (m.producto || m.codigo || '?').trim();
      if (!mapa[key]) mapa[key] = { desc, cantidad: 0, movs: 0 };
      mapa[key].cantidad += Number(m.cantidad) || 0;
      mapa[key].movs++;
    }
    const sorted = Object.entries(mapa)
      .sort((a, b) => b[1].cantidad - a[1].cantidad)
      .slice(0, 7);
    const top5arr = sorted.slice(0, 5).map(([k, v]) => ({
      key: k,
      name: v.desc.length > 16 ? v.desc.slice(0, 14) + '…' : v.desc,
      value: v.cantidad,
    }));
    return { top: sorted, top5: top5arr };
  }, [salidas]);

  const barColors = ['#7C75F0', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <GlassCard
      title="Top insumos — últimos 30 días"
      icon={<Package className="h-4 w-4" />}
      iconColor="#7C75F0"
    >
      {top.length === 0 ? (
        <EmptyState icon="📊" text="Sin movimientos de salida en los últimos 30 días" />
      ) : (
        <>
          <div className="mb-2.5 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                <ReTooltip
                  contentStyle={{
                    background: '#141726',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${fmt(v)} unid.`, '']}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {top5.map((_, i) => (
                    <Cell key={i} fill={barColors[i % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {top.map(([key, val], i) => {
              const ins = insumos.find(
                (x) => (x.cod || '').toUpperCase() === key.toUpperCase(),
              );
              const cat = ins?.categoria || ins?.sub_categoria || '';
              const tasaDiaria = val.cantidad / 30;
              const diasStock =
                ins && ins.stock_total > 0 && tasaDiaria > 0
                  ? Math.floor(ins.stock_total / tasaDiaria)
                  : null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2.5 border-b border-border py-2 last:border-0"
                >
                  <span className="w-8 flex-shrink-0 text-xs font-bold text-muted-foreground">
                    #{i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">
                      {val.desc}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {cat}
                      {diasStock !== null && ` · ${diasStock}d de stock`}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-right text-[13px] font-bold text-foreground">
                    {fmt(val.cantidad)}
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {val.movs} mov.
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Errores de corte
// ─────────────────────────────────────────────────────────────
function ErroresCorteCard({ errores }: { errores: ErrorCorte[] }) {
  const { chartData, motivos, ultimos5 } = useMemo(() => {
    if (errores.length === 0) return { chartData: [], motivos: [], ultimos5: [] };
    const porDia: Record<string, Record<string, number>> = {};
    for (const e of errores) {
      const dia = new Date(e.created_at).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
      });
      if (!porDia[dia]) porDia[dia] = {};
      const m = e.motivo || 'Otro';
      porDia[dia][m] = (porDia[dia][m] || 0) + 1;
    }
    const dias = Object.keys(porDia);
    const motivosSet = [...new Set(errores.map((e) => e.motivo || 'Otro'))];
    const data = dias.map((dia) => {
      const row: Record<string, string | number> = { dia };
      for (const m of motivosSet) row[m] = porDia[dia][m] || 0;
      return row;
    });
    return { chartData: data, motivos: motivosSet, ultimos5: [...errores].reverse().slice(0, 5) };
  }, [errores]);

  return (
    <GlassCard
      title="Errores de corte — por motivo"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconColor="#ef4444"
      count={errores.length}
      countColor="#ef4444"
    >
      {errores.length === 0 ? (
        <EmptyState icon="✅" text="Sin errores registrados aún." />
      ) : (
        <>
          <div className="mb-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="dia" stroke="#71717a" tick={{ fontSize: 10 }} />
                <YAxis stroke="#71717a" tick={{ fontSize: 10 }} allowDecimals={false} />
                <ReTooltip
                  contentStyle={{
                    background: '#141726',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 11,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 9, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                {motivos.map((m) => (
                  <Bar
                    key={m}
                    dataKey={m}
                    stackId="errores"
                    fill={COLORES_ERROR[m] || '#a1a1aa'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Últimos registros
          </div>
          {ultimos5.map((e, i) => {
            const fecha = new Date(e.created_at).toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
            });
            const color = COLORES_ERROR[e.motivo || 'Otro'] || '#a1a1aa';
            const reemplazo = e.reemplazo_cod
              ? `→ ${e.reemplazo_cod} Col.${e.reemplazo_colmena}`
              : '';
            return (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-border py-1.5 last:border-0"
              >
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12px] font-semibold text-foreground">
                    {e.motivo}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {e.ot || '—'} · {e.cod_original || '—'}
                    {e.medida_cm != null && ` · ${Number(e.medida_cm).toFixed(1)} cm`}
                    {reemplazo && ` · ${reemplazo}`}
                  </div>
                </div>
                <span className="flex-shrink-0 text-[10px] text-muted-foreground">{fecha}</span>
              </div>
            );
          })}
        </>
      )}
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Restock
// ─────────────────────────────────────────────────────────────
function RestockCard({
  insumos,
  consumoMap,
}: {
  insumos: Insumo[];
  consumoMap: Record<string, number>;
}) {
  const sugerencias = useMemo(() => {
    const arr: {
      ins: Insumo;
      urgencia: number;
      motivo: string;
      cantSugerida: number;
    }[] = [];
    for (const ins of insumos) {
      const cod = (ins.cod || '').trim().toUpperCase();
      const stock = ins.stock_total;
      const min = ins.minimo != null ? Number(ins.minimo) : null;
      const consumo30d = consumoMap[cod] || 0;
      const tasaDiaria = consumo30d / 30;
      let urgencia = 0;
      let motivo = '';
      let cantSugerida = 0;
      if (min !== null && stock <= min) {
        urgencia = stock <= 0 ? 3 : stock < min * 0.5 ? 2 : 1;
        cantSugerida = Math.ceil(min - stock + consumo30d);
        motivo = stock <= 0 ? 'Sin stock' : `Stock bajo mínimo (${fmt(stock)}/${fmt(min)})`;
      } else if (tasaDiaria > 0 && stock > 0) {
        const diasRestantes = stock / tasaDiaria;
        if (diasRestantes < 15) {
          urgencia = diasRestantes < 7 ? 2 : 1;
          cantSugerida = Math.ceil(consumo30d * 1.5);
          motivo = `${Math.floor(diasRestantes)}d de stock al ritmo actual`;
        }
      }
      if (urgencia > 0) arr.push({ ins, urgencia, motivo, cantSugerida });
    }
    return arr.sort((a, b) => b.urgencia - a.urgencia);
  }, [insumos, consumoMap]);

  return (
    <GlassCard
      title="Sugerencias de reposición"
      icon={<ShoppingCart className="h-4 w-4" />}
      iconColor="#22c55e"
      count={sugerencias.length}
      countColor={sugerencias.length > 0 ? '#22c55e' : '#7C75F0'}
    >
      <div className="max-h-80 overflow-y-auto">
        {sugerencias.length === 0 ? (
          <EmptyState icon="✅" text="No hay necesidades de reposición urgentes" />
        ) : (
          sugerencias.slice(0, 10).map((s, i) => {
            const icon = s.urgencia >= 3 ? '🔴' : s.urgencia >= 2 ? '🟡' : '🟢';
            return (
              <div
                key={`${s.ins.cod}-${i}`}
                className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-0"
              >
                <span className="flex-shrink-0 text-base">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[13px] font-semibold text-foreground">
                    {s.ins.nemotecnico || s.ins.cod}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{s.motivo}</div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-bold text-foreground">{fmt(s.cantSugerida)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.ins.unidad || 'u.'}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Actividad reciente
// ─────────────────────────────────────────────────────────────
function ActivityCard({ movs, insumos }: { movs: Mov[]; insumos: Insumo[] }) {
  const recientes = movs.slice(0, 20);

  return (
    <GlassCard
      title="Últimos movimientos de bodega"
      icon={<Activity className="h-4 w-4" />}
      iconColor="#3b82f6"
    >
      <div className="max-h-80 overflow-y-auto">
        {recientes.length === 0 ? (
          <EmptyState icon="📭" text="Sin movimientos en los últimos 30 días" />
        ) : (
          recientes.map((m, i) => {
            const tipoRaw = (m.tipo || '').trim();
            const tipo = tipoRaw.toLowerCase();
            const esEntrada =
              tipo === 'entrada' ||
              tipoRaw === 'NUEVO INGRESO' ||
              tipoRaw === 'DEVOLUCION';
            const esSalida =
              tipo === 'salida' ||
              tipo === 'despacho' ||
              tipoRaw === 'SALIDA PRODUCCION';
            const esAjuste = tipo === 'ajuste';

            const iconBg = esEntrada
              ? 'bg-success/15 text-success'
              : esSalida
                ? 'bg-destructive/15 text-destructive'
                : esAjuste
                  ? 'bg-warning/15 text-warning'
                  : 'bg-muted/30 text-muted-foreground';
            const signo = esEntrada ? '+' : esSalida ? '−' : '';

            const codInsumo = (m.codigo || '').trim();
            const nomInsumo = (m.producto || '').trim();
            const insRec = codInsumo
              ? insumos.find((x) => (x.cod || '').toUpperCase() === codInsumo.toUpperCase())
              : null;
            const nombreFinal = nomInsumo || insRec?.nemotecnico || '—';

            const titulo = [
              tipoRaw || 'Movimiento',
              codInsumo && nombreFinal
                ? `${codInsumo} — ${nombreFinal}`
                : codInsumo || nombreFinal || 'Insumo sin nombre',
            ]
              .filter(Boolean)
              .join(': ');

            const cantStr = m.cantidad !== undefined ? `${signo}${fmt(m.cantidad)} uds.` : '';
            const almacen = m.almacen ? ` → ${m.almacen}` : '';
            const otRef = m.ot ? ` | OT ${m.ot}` : '';
            const resp = m.responsable_entrega ? ` | ${m.responsable_entrega}` : '';
            const obs = m.bitacora ? ` · ${m.bitacora}` : '';
            const detalle = `${cantStr}${almacen}${otRef}${resp}${obs}`;

            return (
              <div
                key={i}
                className="flex items-start gap-2.5 border-b border-border py-2 last:border-0"
              >
                <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                  {fmtFechaHora(m.fecha)}
                </span>
                <div
                  className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs font-bold',
                    iconBg,
                  )}
                >
                  {esEntrada ? '↓' : esSalida ? '↑' : esAjuste ? '✎' : '·'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-[12px] font-semibold text-foreground">
                    {titulo}
                  </div>
                  {detalle && (
                    <div className="truncate text-[10px] text-muted-foreground">{detalle}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Insights automáticos
// ─────────────────────────────────────────────────────────────
function InsightsCard({
  ots,
  insumos,
  movs,
}: {
  ots: OT[];
  insumos: Insumo[];
  movs: Mov[];
}) {
  const insights = useMemo(() => {
    const arr: { tipo: 'info' | 'warning' | 'success' | 'danger'; txt: string }[] = [];
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const actividadPorDia = [0, 0, 0, 0, 0, 0, 0];
    for (const m of movs) {
      if (!m.fecha) continue;
      actividadPorDia[new Date(m.fecha).getDay()]++;
    }
    const diaPico = actividadPorDia.indexOf(Math.max(...actividadPorDia));
    if (Math.max(...actividadPorDia) > 0) {
      arr.push({
        tipo: 'info',
        txt: `El día con más movimientos es el <strong>${diasSemana[diaPico]}</strong>`,
      });
    }

    const topOT = ots
      .filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''))
      .map((o) => ({ ot: o, cant: (o.items || []).length }))
      .sort((a, b) => b.cant - a.cant)[0];
    if (topOT && topOT.cant > 0) {
      const cli = dgStr(topOT.ot, ['nombre_cliente', 'cliente']) || 'un cliente';
      arr.push({
        tipo: 'info',
        txt: `La OT más grande es de <strong>${cli}</strong> con ${topOT.cant} ventana${topOT.cant > 1 ? 's' : ''}`,
      });
    }

    const codsConMov = new Set(movs.map((m) => (m.codigo || '').trim().toUpperCase()));
    const insDetenidos = insumos.filter(
      (ins) => ins.stock_total > 0 && !codsConMov.has((ins.cod || '').toUpperCase()),
    );
    if (insDetenidos.length > 0) {
      arr.push({
        tipo: 'warning',
        txt: `<strong>${insDetenidos.length} insumos</strong> tienen stock pero sin movimiento en 30 días`,
      });
    }

    const cotizacionAntigua = ots.filter(
      (o) => o.estado === 'cotizacion' && diasDesde(o.fecha_creacion) >= 14,
    );
    if (cotizacionAntigua.length > 0) {
      arr.push({
        tipo: 'warning',
        txt: `<strong>${cotizacionAntigua.length} cotización${cotizacionAntigua.length > 1 ? 'es' : ''}</strong> llevan 14+ días sin aprobar`,
      });
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const entregadasMes = ots.filter(
      (o) =>
        o.estado === 'entregado' &&
        o.fecha_modificacion &&
        new Date(o.fecha_modificacion) >= inicioMes,
    ).length;
    if (entregadasMes > 0) {
      arr.push({
        tipo: 'success',
        txt: `<strong>${entregadasMes} OT${entregadasMes > 1 ? 's' : ''}</strong> entregada${entregadasMes > 1 ? 's' : ''} este mes`,
      });
    }

    return arr;
  }, [ots, insumos, movs]);

  const tipoIcon = (t: string) => {
    switch (t) {
      case 'danger':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'warning':
        return <AlertTriangle className="h-3.5 w-3.5" />;
      case 'success':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      default:
        return <Info className="h-3.5 w-3.5" />;
    }
  };
  const tipoCls = (t: string) => {
    switch (t) {
      case 'danger':
        return 'border-destructive/30 bg-destructive/15 text-destructive';
      case 'warning':
        return 'border-warning/30 bg-warning/15 text-warning';
      case 'success':
        return 'border-success/30 bg-success/15 text-success';
      default:
        return 'border-blue-500/30 bg-accent/10 text-blue-300';
    }
  };

  return (
    <GlassCard
      title="Insights automáticos"
      icon={<Lightbulb className="h-4 w-4" />}
      iconColor="#f59e0b"
    >
      {insights.length === 0 ? (
        <EmptyState icon="💡" text="Acumula más datos para ver insights" />
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((i, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]',
                tipoCls(i.tipo),
              )}
            >
              <span className="mt-0.5 flex-shrink-0">{tipoIcon(i.tipo)}</span>
              <span dangerouslySetInnerHTML={{ __html: i.txt }} />
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────
// Stock general
// ─────────────────────────────────────────────────────────────
function StockGeneralCard({
  insumos,
  racks,
  consumoMap,
  filtro,
  onFiltro,
}: {
  insumos: Insumo[];
  racks: Rack[];
  consumoMap: Record<string, number>;
  filtro: string | null;
  onFiltro: (c: string | null) => void;
}) {
  const categorias = useMemo(
    () =>
      [
        ...new Set(insumos.map((i) => i.categoria || 'Sin categoría').filter(Boolean)),
      ].sort() as string[],
    [insumos],
  );

  const filtrados = filtro ? insumos.filter((i) => i.categoria === filtro) : insumos;

  return (
    <GlassCard
      title="Estado general del stock"
      icon={<Boxes className="h-4 w-4" />}
      iconColor="#7C75F0"
      extra={
        <div className="flex max-w-[60%] flex-wrap gap-1 md:max-w-none">
          <button
            onClick={() => onFiltro(null)}
            className={cn(
              'rounded-full border border-blue-500/30 bg-accent/10 px-2 py-0.5 text-[10px]',
              !filtro ? 'font-bold text-blue-300' : 'text-accent/70',
            )}
          >
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => onFiltro(c)}
              className={cn(
                'rounded-full border border-blue-500/30 bg-accent/10 px-2 py-0.5 text-[10px]',
                filtro === c ? 'font-bold text-blue-300' : 'text-accent/70',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      {insumos.length === 0 ? (
        <EmptyState icon="📦" text="Sin insumos en el catálogo" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-left font-semibold">Insumo</th>
                <th className="px-2 py-2 text-right font-semibold">Stock</th>
                <th className="px-2 py-2 text-right font-semibold">Mínimo</th>
                <th className="px-2 py-2 text-center font-semibold">Estado</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">Rack</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">30d</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((ins, i) => {
                const stock = ins.stock_total;
                const min = ins.minimo != null ? Number(ins.minimo) : null;
                const cod = (ins.cod || '').toUpperCase();
                const cons30 = consumoMap[cod] || 0;

                let badgeCls = 'border-success/30 bg-success/15 text-success';
                let badgeTxt = 'OK';
                let rowStyle = '';
                if (stock <= 0) {
                  badgeCls = 'border-destructive/30 bg-destructive/15 text-destructive';
                  badgeTxt = 'Sin stock';
                  rowStyle = 'bg-destructive/[0.04]';
                } else if (min !== null && stock <= min) {
                  badgeCls = 'border-warning/30 bg-warning/15 text-warning';
                  badgeTxt = 'Bajo min';
                  rowStyle = 'bg-warning/[0.04]';
                }

                const rack = racks.find(
                  (r) => (r.codigo_insumo || '').toUpperCase() === cod,
                );
                const pos = rack
                  ? `${rack.rack}·${rack.fila}-${rack.columna}`
                  : ins.ubicacion || '—';

                let tendColor = '#71717a';
                let tendTxt = '—';
                if (cons30 > 0) {
                  const tasaDiaria = cons30 / 30;
                  const diasRest = tasaDiaria > 0 ? Math.floor(stock / tasaDiaria) : null;
                  if (diasRest !== null) {
                    tendColor =
                      diasRest < 7 ? '#ef4444' : diasRest < 15 ? '#f59e0b' : '#22c55e';
                    tendTxt = `${diasRest}d`;
                  } else {
                    tendTxt = String(fmt(cons30));
                  }
                }

                return (
                  <tr
                    key={`${cod}-${i}`}
                    className={cn('border-b border-border', rowStyle)}
                  >
                    <td className="max-w-[160px] truncate px-2 py-1.5">
                      <strong className="text-foreground">
                        {ins.nemotecnico || ins.cod || '—'}
                      </strong>
                      <div className="text-[10px] text-muted-foreground">
                        {ins.cod || ''} · {ins.categoria || ins.sub_categoria || ''}
                      </div>
                    </td>
                    <td
                      className="px-2 py-1.5 text-right font-bold"
                      style={{
                        color:
                          stock <= 0
                            ? '#ef4444'
                            : min !== null && stock <= min
                              ? '#f59e0b'
                              : '#f4f4f5',
                      }}
                    >
                      {fmt(stock)}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {ins.unidad || ''}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">{fmt(min)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          badgeCls,
                        )}
                      >
                        {badgeTxt}
                      </span>
                    </td>
                    <td className="hidden px-2 py-1.5 text-right text-[10px] text-muted-foreground md:table-cell">
                      {pos}
                    </td>
                    <td
                      className="hidden px-2 py-1.5 text-right md:table-cell"
                      style={{ color: tendColor }}
                    >
                      <span className="text-[11px]">{tendTxt}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
