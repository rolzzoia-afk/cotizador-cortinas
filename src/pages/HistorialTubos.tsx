import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowLeftRight,
  Box,
  Clock,
  Eraser,
  History,
  Link2,
  Pencil,
  RotateCw,
  Ruler,
  Scissors,
  Search,
  Trash2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Evento = {
  id: string;
  cod: string;
  n_colmena: string | null;
  evento: string;
  medida_cm: number | null;
  medida_resultado_cm: number | null;
  ot: string | null;
  notas: string | null;
  fuente: string | null;
  registrado_por: string | null;
  tubo_raiz_id: string | null;
  created_at: string;
};

type EvCfg = {
  color: string;
  icon: LucideIcon;
  label: string;
  esRestauracion?: boolean;
};

const EV: Record<string, EvCfg> = {
  ingreso: { color: 'text-success', icon: Box, label: 'Ingreso' },
  corte: { color: 'text-accent', icon: Scissors, label: 'Corte' },
  sobrante: { color: 'text-accent', icon: ArrowLeftRight, label: 'Sobrante' },
  merma: { color: 'text-destructive', icon: Trash2, label: 'Merma' },
  error_reemplazo: { color: 'text-warning', icon: RotateCw, label: 'Reemplazo error' },
  sobrante_error: { color: 'text-fuchsia-400', icon: ArrowLeftRight, label: 'Sobrante error' },
  ajuste: { color: 'text-warning', icon: Pencil, label: 'Ajuste admin' },
  eliminado: { color: 'text-muted-foreground', icon: XCircle, label: 'Eliminado' },
  restauracion: { color: 'text-pink-400', icon: History, label: 'Restauración', esRestauracion: true },
};

const FUENTE_CFG: Record<string, { label: string }> = {
  excel: { label: 'Carga Excel' },
  optimizador_nuevo: { label: 'Tubo nuevo (opt.)' },
  retroactivo: { label: 'Registro retroactivo' },
  manual: { label: 'Ingreso manual' },
};

const PALETA = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e', '#a1a1aa'];

function formatFechaHora(d: string | null) {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMes(d: string) {
  const x = new Date(d);
  return x.toLocaleDateString('es-CL', { month: '2-digit', year: 'numeric' });
}

export function HistorialTubos() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState<'trazabilidad' | 'historial' | 'merma'>('trazabilidad');

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex items-center gap-2">
        <Ruler className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Historial de tubos</h1>
          <p className="text-xs text-muted-foreground">Trazabilidad · Merma mensual</p>
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b">
        <TabButton active={tab === 'trazabilidad'} onClick={() => setTab('trazabilidad')}>
          <Link2 className="h-4 w-4" />
          Trazabilidad
        </TabButton>
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
          <Clock className="h-4 w-4" />
          Historial técnico
        </TabButton>
        <TabButton active={tab === 'merma'} onClick={() => setTab('merma')}>
          <Trash2 className="h-4 w-4" />
          Merma mensual
        </TabButton>
      </div>

      {tab === 'trazabilidad' && <VistaTrazabilidad empresaId={empresaId} />}
      {tab === 'historial' && <VistaHistorial empresaId={empresaId} />}
      {tab === 'merma' && <VistaMerma empresaId={empresaId} />}
    </div>
  );
}

function TabButton({
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
        'flex items-center gap-1.5 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// ── Vista: Trazabilidad (ficha de tubo + buscador) ──────────────────────
type TuboResultado = {
  tubo_raiz_id: string;
  cod: string | null;
  n_colmena: string | null;
  medida_cm: number | null;
  evento_en_ot: string;
  en_inventario: boolean;
  fecha_primera: string | null;
};

type FichaTuboResp = {
  tubo: {
    tubo_raiz_id: string;
    cod: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    en_inventario: boolean;
    estado_descripcion: string;
  };
  origen: {
    evento: string;
    fuente: string | null;
    fecha: string;
    ot: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    notas: string | null;
  } | null;
  padre: {
    tubo_raiz_id: string;
    cod: string | null;
    n_colmena: string | null;
    medida_cm: number | null;
    evento_corte_fecha: string;
    evento_corte_ot: string | null;
    evento_corte_linea: number | null;
  } | null;
  eventos: Evento[];
  hijos: Array<{
    tubo_raiz_id: string;
    evento: string;
    n_colmena: string | null;
    cod: string | null;
    medida_cm: number | null;
    fecha: string;
    ot: string | null;
    en_inventario: boolean;
  }>;
  consumido_en: {
    ot: string | null;
    linea_idx: number | null;
    medida_cortada: number | null;
    fecha: string;
  } | null;
};

function VistaTrazabilidad({ empresaId }: { empresaId: string | null }) {
  const [cod, setCod] = useState('');
  const [colmena, setColmena] = useState('');
  const [medida, setMedida] = useState('');
  const [otBuscar, setOTBuscar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<TuboResultado[] | null>(null);
  const [tuboSel, setTuboSel] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaTuboResp | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);

  const buscar = async () => {
    if (!empresaId) return;
    setError(null);
    if (!cod.trim() && !colmena.trim() && !medida.trim() && !otBuscar.trim()) {
      setError('Ingresa al menos un criterio: código, colmena, medida o número de OT.');
      setResultados(null);
      return;
    }
    let medidaNum: number | null = null;
    if (medida.trim()) {
      medidaNum = parseFloat(medida.trim().replace(',', '.'));
      if (!Number.isFinite(medidaNum) || medidaNum <= 0) {
        setError('La medida debe ser un número positivo (ej: 156 o 156.5).');
        setResultados(null);
        return;
      }
    }
    setLoading(true);
    setTuboSel(null);
    setFicha(null);
    // (supabase.rpc as any): RPCs nuevos, todavía no están en database.ts.
    const { data, error: err } = await (supabase.rpc as any)('buscar_tubos', {
      p_cod: cod.trim() || null,
      p_colmena: colmena.trim() || null,
      p_medida: medidaNum,
      p_ot: otBuscar.trim() || null,
      p_limit: 100,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      setResultados(null);
      return;
    }
    setResultados((data || []) as TuboResultado[]);
  };

  const verFicha = async (id: string) => {
    setTuboSel(id);
    setFicha(null);
    setLoadingFicha(true);
    const { data, error: err } = await (supabase.rpc as any)('ficha_tubo', {
      p_tubo_raiz_id: id,
    });
    setLoadingFicha(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFicha(data as FichaTuboResp);
    setTimeout(() => {
      document.getElementById('ficha-tubo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const limpiar = () => {
    setCod('');
    setColmena('');
    setMedida('');
    setOTBuscar('');
    setResultados(null);
    setTuboSel(null);
    setFicha(null);
    setError(null);
  };

  return (
    <>
      <div className="mb-3 rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Busca un tubo por sus datos físicos (código + colmena + medida) o por la OT en
          la que participó. Clickeá un resultado para ver su ficha completa: de dónde
          vino, qué se hizo con él, y qué piezas o sobrantes generó.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Código (ej: E13)"
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Input
            placeholder="Colmena (ej: A20)"
            value={colmena}
            onChange={(e) => setColmena(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Input
            placeholder="Medida cm (±0.5)"
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            inputMode="decimal"
          />
          <Input
            placeholder="OT (ej: 2944)"
            value={otBuscar}
            onChange={(e) => setOTBuscar(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <Button onClick={buscar} disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar tubo'}
          </Button>
          {(cod || colmena || medida || otBuscar || resultados) && (
            <Button variant="outline" onClick={limpiar}>
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!resultados && !loading && !error && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          Busca un tubo para ver su historia completa.
        </EmptyState>
      )}

      {resultados && resultados.length === 0 && (
        <EmptyState>
          <Search className="mx-auto mb-3 h-10 w-10" />
          No se encontraron tubos con esos criterios.
          <p className="mt-2 text-xs">
            Probá relajar algún criterio. Ten en cuenta que un tubo ya cortado no
            aparece por colmena/medida (cambia de identidad al cortarse) — para esos
            casos, buscá por OT.
          </p>
        </EmptyState>
      )}

      {resultados && resultados.length > 0 && (
        <div className="mb-3">
          <div className="mb-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{resultados.length}</strong> tubo(s)
            encontrado(s) · Click en una fila para ver la ficha completa
          </div>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colmena</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Medida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((t) => (
                  <TableRow
                    key={t.tubo_raiz_id}
                    onClick={() => verFicha(t.tubo_raiz_id)}
                    className={cn(
                      'cursor-pointer hover:bg-primary/5',
                      tuboSel === t.tubo_raiz_id && 'bg-primary/10',
                    )}
                  >
                    <TableCell className="font-semibold">{t.n_colmena ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.cod ?? '—'}</TableCell>
                    <TableCell>
                      {t.medida_cm != null
                        ? `${Number(t.medida_cm).toFixed(1)} cm`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {t.en_inventario ? (
                        <Badge className="bg-success/20 text-success">En stock</Badge>
                      ) : (
                        <Badge variant="secondary">Consumido</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">→</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {tuboSel && (
        <div id="ficha-tubo">
          {loadingFicha && (
            <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
              Cargando ficha...
            </div>
          )}
          {!loadingFicha && ficha && <FichaCard ficha={ficha} onVerTubo={verFicha} />}
        </div>
      )}
    </>
  );
}

function FichaCard({
  ficha,
  onVerTubo,
}: {
  ficha: FichaTuboResp;
  onVerTubo: (id: string) => void;
}) {
  const { tubo, origen, padre, eventos, hijos, consumido_en } = ficha;
  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <div>
            <div className="text-base font-bold">
              {tubo.n_colmena ?? '—'} · {tubo.cod ?? '—'} ·{' '}
              {tubo.medida_cm != null ? `${Number(tubo.medida_cm).toFixed(1)} cm` : '—'}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              ID: {tubo.tubo_raiz_id.slice(0, 8)}…
            </div>
          </div>
        </div>
        <Badge
          className={cn(
            tubo.en_inventario
              ? 'bg-success/20 text-success'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {tubo.estado_descripcion}
        </Badge>
      </div>

      <FichaSeccion title="De dónde vino" icon={<Box className="h-4 w-4 text-success" />}>
        {origen ? (
          <>
            <p>
              <strong>{labelOrigen(origen.evento, origen.fuente)}</strong>{' '}
              <span className="text-muted-foreground">· {formatFechaHora(origen.fecha)}</span>
            </p>
            {origen.ot && (
              <p className="text-xs text-muted-foreground">
                Asociado a OT <strong>{origen.ot}</strong>
              </p>
            )}
            {origen.notas && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                &ldquo;{origen.notas}&rdquo;
              </p>
            )}
            {padre && (
              <div className="mt-2 rounded border border-primary/30 bg-primary/5 p-2">
                <p className="text-xs">↑ Es el sobrante o merma del corte de:</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1"
                  onClick={() => onVerTubo(padre.tubo_raiz_id)}
                >
                  <Link2 className="h-3 w-3" />
                  {padre.n_colmena ?? '—'} · {padre.cod ?? '—'} ·{' '}
                  {padre.medida_cm != null
                    ? `${Number(padre.medida_cm).toFixed(1)} cm`
                    : '—'}
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  OT {padre.evento_corte_ot ?? '?'}
                  {padre.evento_corte_linea != null &&
                    ` · línea ${padre.evento_corte_linea + 1}`}
                  {' · '}
                  {formatFechaHora(padre.evento_corte_fecha)}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Sin evento de origen registrado.
          </p>
        )}
      </FichaSeccion>

      {consumido_en && (
        <FichaSeccion
          title="Qué pasó después"
          icon={<Scissors className="h-4 w-4 text-accent" />}
        >
          <p>
            Cortado para OT <strong>{consumido_en.ot ?? '?'}</strong>
            {consumido_en.linea_idx != null && ` (línea ${consumido_en.linea_idx + 1})`}{' '}
            <span className="text-muted-foreground">
              · {formatFechaHora(consumido_en.fecha)}
            </span>
          </p>
          {consumido_en.medida_cortada != null && (
            <p className="text-xs text-muted-foreground">
              {Number(consumido_en.medida_cortada).toFixed(1)} cm fueron usados.
            </p>
          )}
          {hijos.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold">
                Lo que generó el corte ({hijos.length} pieza{hijos.length !== 1 ? 's' : ''}):
              </p>
              <div className="space-y-1">
                {hijos.map((h) => (
                  <div
                    key={h.tubo_raiz_id}
                    className="flex items-center justify-between rounded border bg-muted/30 p-2"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto gap-1 p-0 text-xs"
                      onClick={() => onVerTubo(h.tubo_raiz_id)}
                    >
                      {h.evento === 'sobrante' || h.evento === 'sobrante_error' ? (
                        <ArrowLeftRight className="h-3 w-3 text-accent" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                      )}
                      <span className="font-semibold">
                        {h.evento === 'merma' ? 'Merma' : 'Sobrante'}
                      </span>
                      <span>·</span>
                      <span>{h.n_colmena ?? '—'}</span>
                      <span>·</span>
                      <span className="font-mono">{h.cod ?? '—'}</span>
                      <span>·</span>
                      <span>
                        {h.medida_cm != null
                          ? `${Number(h.medida_cm).toFixed(1)} cm`
                          : '—'}
                      </span>
                    </Button>
                    {h.en_inventario && (
                      <Badge className="bg-success/20 text-[10px] text-success">
                        En stock
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </FichaSeccion>
      )}

      <FichaSeccion title="Historia completa" icon={<History className="h-4 w-4 text-primary" />}>
        <ul className="space-y-1.5">
          {eventos.map((e) => {
            const cfg = EV[e.evento] ?? {
              color: 'text-muted-foreground',
              icon: Box,
              label: e.evento,
            };
            const Icon = cfg.icon;
            return (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <Icon className={cn('mt-0.5 h-3.5 w-3.5', cfg.color)} />
                <div className="flex-1">
                  <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatFechaHora(e.created_at)}
                  </span>
                  {e.ot && (
                    <span className="text-muted-foreground"> · OT {e.ot}</span>
                  )}
                  {e.notas && (
                    <p className="text-[11px] italic text-muted-foreground">
                      &ldquo;{e.notas}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </FichaSeccion>
    </div>
  );
}

function FichaSeccion({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="ml-5 text-sm">{children}</div>
    </div>
  );
}

function labelOrigen(evento: string, fuente: string | null): string {
  if (evento === 'ingreso') {
    if (fuente === 'carga_inicial') return 'Ingreso por carga inicial';
    if (fuente === 'optimizador_nuevo') return 'Tubo nuevo registrado en el optimizador';
    if (fuente === 'excel') return 'Ingreso desde Excel';
    if (fuente === 'manual') return 'Ingreso manual';
    if (fuente === 'consolidacion_peso' || fuente === 'consolidacion_peso_retroactivo')
      return 'Peso consolidado en su slot';
    return `Ingreso (${fuente ?? 'sin fuente'})`;
  }
  if (evento === 'sobrante') return 'Sobrante de un corte';
  if (evento === 'sobrante_error') return 'Sobrante por error de corte';
  if (evento === 'merma') return 'Merma';
  if (evento === 'restauracion') return 'Restauración (admin)';
  if (evento === 'ajuste') return 'Ajuste (admin)';
  return evento;
}

// ── Vista: Historial técnico ──────────────────────────────────────────
function VistaHistorial({ empresaId }: { empresaId: string | null }) {
  const [cod, setCod] = useState('');
  const [colmena, setColmena] = useState('');
  const [medida, setMedida] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    if (!empresaId) return;
    if (!cod.trim() && !colmena.trim() && !medida.trim()) {
      setError('Ingresa un código, colmena o medida para buscar.');
      setData(null);
      return;
    }
    // Si se ingresó medida, validar que sea numérica
    let medidaNum: number | null = null;
    if (medida.trim()) {
      medidaNum = parseFloat(medida.trim().replace(',', '.'));
      if (!Number.isFinite(medidaNum) || medidaNum <= 0) {
        setError('La medida debe ser un número positivo (ej: 382 o 382.5).');
        setData(null);
        return;
      }
    }
    setLoading(true);
    setError(null);

    let q = supabase
      .from('tubos_historial')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (cod.trim()) q = q.ilike('cod', `%${cod.trim().toUpperCase()}%`);
    if (colmena.trim()) q = q.ilike('n_colmena', `%${colmena.trim().toUpperCase()}%`);
    if (medidaNum !== null) {
      // Tolerancia ±0.5 cm: cubre decimales (382 matchea 382.5) y errores
      // de redondeo en sobrantes calculados (382.50000000000003).
      q = q.gte('medida_cm', medidaNum - 0.5).lte('medida_cm', medidaNum + 0.5);
    }

    const { data: rows, error: err } = await q;
    setLoading(false);
    if (err) {
      setError(err.message);
      setData(null);
      return;
    }
    setData((rows as Evento[]) ?? []);
  };

  const grupos = useMemo(() => {
    if (!data) return [];
    const mapa = new Map<string, Evento[]>();
    for (const e of data) {
      const k = e.tubo_raiz_id ?? 'sin_raiz';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(e);
    }
    return [...mapa.entries()];
  }, [data]);

  // ── Separa eventos de un tubo en "vidas" por cada 'eliminado' ───
  // Cada vida empieza tras un eliminado (o al principio) y termina con
  // el próximo eliminado o con el último evento del tubo.
  // eventos ya vienen ordenados ascendente por created_at.
  type Vida = {
    eventos: Evento[];
    terminada: boolean;  // último evento = 'eliminado'
    zombie: boolean;     // no es la primera vida Y no empezó con 'ingreso'
  };
  const splitVidas = (eventos: Evento[]): Vida[] => {
    if (eventos.length === 0) return [];
    const vidas: Evento[][] = [];
    let actual: Evento[] = [];
    for (const e of eventos) {
      actual.push(e);
      if (e.evento === 'eliminado') {
        vidas.push(actual);
        actual = [];
      }
    }
    if (actual.length > 0) vidas.push(actual);
    return vidas.map((evs, idx) => ({
      eventos: evs,
      terminada: evs[evs.length - 1]?.evento === 'eliminado',
      zombie: idx > 0 && evs[0]?.evento !== 'ingreso',
    }));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Código de tubo (ej: BK10, DU90…)"
          value={cod}
          onChange={(e) => setCod(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-xs"
        />
        <Input
          placeholder="N° Colmena"
          value={colmena}
          onChange={(e) => setColmena(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-[160px]"
        />
        <Input
          placeholder="Medida cm (±0.5)"
          value={medida}
          onChange={(e) => setMedida(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-[160px]"
          inputMode="decimal"
          title="Medida del tubo en cm. Tolerancia ±0.5 cm. Útil para encontrar sobrantes (corte, sobrante_error) que no aparecen al buscar por código."
        />
        <Button onClick={buscar} disabled={loading}>
          <Search className="h-4 w-4" />
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          Ingresa el código o número de colmena de un tubo para ver su historial completo.
        </EmptyState>
      )}

      {data && data.length === 0 && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          No se encontraron eventos para ese tubo.
          <p className="mt-2 text-xs">
            El historial solo registra eventos desde que se implementó esta función.
          </p>
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <>
          <div className="mb-3 px-1 text-xs text-muted-foreground">
            <strong className="text-foreground">{data.length}</strong> eventos · Código(s):{' '}
            <strong className="text-primary">
              {[...new Set(data.map((e) => e.cod))].join(', ')}
            </strong>
          </div>
          {grupos.map(([raizId, eventos]) => {
            const primero = eventos[0];
            const tieneMerma = eventos.some((e) => e.evento === 'merma');
            const esLinaje = raizId !== 'sin_raiz';
            const vidas = splitVidas(eventos);
            const unaSolaVida = vidas.length <= 1;
            return (
              <div key={raizId} className="mb-3 overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h6 className="flex items-center gap-1.5 text-sm font-bold">
                    <Link2 className="h-4 w-4 text-primary" />
                    {primero.cod} · Colmena {primero.n_colmena ?? '—'}
                    {tieneMerma && (
                      <span className="ml-1 text-xs text-destructive">→ MERMA</span>
                    )}
                  </h6>
                  <span className="text-right text-xs text-muted-foreground">
                    {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                    {vidas.length > 1 && (
                      <>
                        {' · '}
                        <strong className="text-foreground">
                          {vidas.length} vidas
                        </strong>
                      </>
                    )}
                    {esLinaje && (
                      <>
                        <br />
                        <span className="font-mono text-[10px]">
                          ID:{raizId.slice(0, 8)}…
                        </span>
                      </>
                    )}
                  </span>
                </div>
                {unaSolaVida ? (
                  <ul className="py-2">
                    {eventos.map((e) => (
                      <EventoItem key={e.id} e={e} />
                    ))}
                  </ul>
                ) : (
                  vidas.map((v, i) => {
                    const esUltima = i === vidas.length - 1;
                    const estado = v.zombie
                      ? 'zombie'
                      : v.terminada
                        ? 'terminada'
                        : esUltima
                          ? 'actual'
                          : 'terminada';
                    const headerTone =
                      estado === 'zombie'
                        ? 'border-warning/30 bg-warning/15 text-warning'
                        : estado === 'actual'
                          ? 'border-success/30 bg-success/[0.06] text-success'
                          : 'border-border bg-muted/40 text-muted-foreground';
                    const label =
                      estado === 'zombie'
                        ? `Vida ${i + 1} · sin ingreso previo (fantasma)`
                        : estado === 'actual'
                          ? `Vida ${i + 1} · actual`
                          : `Vida ${i + 1} · terminada`;
                    const desde = v.eventos[0]?.created_at;
                    const hasta = v.eventos[v.eventos.length - 1]?.created_at;
                    return (
                      <div key={i}>
                        <div
                          className={cn(
                            'flex items-center justify-between border-y px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider',
                            headerTone,
                          )}
                        >
                          <span>
                            {estado === 'zombie' && '⚠ '}
                            {label}
                          </span>
                          <span className="font-normal normal-case tracking-normal opacity-70">
                            {formatFechaHora(desde)}
                            {desde !== hasta && <> → {formatFechaHora(hasta)}</>}
                          </span>
                        </div>
                        <ul className="py-2">
                          {v.eventos.map((e) => (
                            <EventoItem key={e.id} e={e} />
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

function EventoItem({ e }: { e: Evento }) {
  const cfg = EV[e.evento] ?? { color: 'text-muted-foreground', icon: Box, label: e.evento };
  const Icon = cfg.icon;
  const medida = e.medida_cm != null ? `${Number(e.medida_cm).toFixed(1)} cm` : '—';
  const resultado =
    e.medida_resultado_cm != null ? `→ ${Number(e.medida_resultado_cm).toFixed(1)} cm` : '';
  const esRest = cfg.esRestauracion === true;
  const fuenteLabel =
    e.evento === 'ingreso'
      ? e.fuente
        ? FUENTE_CFG[e.fuente]?.label ?? e.fuente
        : 'Origen desconocido'
      : null;

  return (
    <>
      {esRest && (
        <li className="relative mx-4 my-1 border-t border-dashed border-pink-400/35 text-center">
          <span className="bg-background px-2 text-[10px] text-pink-400">
            — PUNTO DE RESTAURACIÓN —
          </span>
        </li>
      )}
      <li
        className={cn(
          'relative flex gap-3 px-4 py-2.5',
          esRest && 'mx-2 my-1 rounded-lg border border-pink-400/25 bg-pink-500/5',
        )}
      >
        <div
          className={cn(
            'mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted',
            cfg.color,
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
            <Badge
              variant="secondary"
              className={cn('uppercase tracking-wide', cfg.color)}
            >
              {cfg.label}
            </Badge>
            {!esRest && (
              <span className="font-normal text-muted-foreground">
                {medida} {resultado}
              </span>
            )}
            {fuenteLabel && (
              <Badge variant="outline" className="text-[10px]">
                {fuenteLabel}
              </Badge>
            )}
          </div>
          {e.ot && (
            <div className="text-xs text-muted-foreground">
              OT: <strong>{e.ot}</strong> · Colmena: {e.n_colmena ?? '—'}
            </div>
          )}
          {!e.ot && e.n_colmena && (
            <div className="text-xs text-muted-foreground">Colmena: {e.n_colmena}</div>
          )}
          {e.notas && (
            <div
              className={cn(
                'mt-1 text-xs italic text-muted-foreground',
                esRest && 'not-italic text-pink-400',
              )}
            >
              {e.notas}
            </div>
          )}
          <div className="mt-0.5 text-[10px] text-muted-foreground">
            {formatFechaHora(e.created_at)}
            {e.registrado_por ? ` · ${e.registrado_por}` : ''}
          </div>
        </div>
      </li>
    </>
  );
}

// ── Vista: Merma ─────────────────────────────────────────────────────
type MermaEvento = Pick<
  Evento,
  'cod' | 'medida_cm' | 'evento' | 'created_at' | 'n_colmena' | 'ot' | 'notas'
> & { id?: string };

function VistaMerma({ empresaId }: { empresaId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MermaEvento[]>([]);

  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      setLoading(true);
      const { data: rows } = await supabase
        .from('tubos_historial')
        .select('cod, medida_cm, evento, created_at, n_colmena, ot, notas')
        .eq('empresa_id', empresaId)
        .eq('evento', 'merma')
        .order('created_at', { ascending: false })
        .limit(500);
      setData((rows as MermaEvento[]) ?? []);
      setLoading(false);
    };
    run();
  }, [empresaId]);

  const { totalCm, totalM, porMes, meses, cods, chartData } = useMemo(() => {
    const porMes = new Map<
      string,
      Map<string, { total_cm: number; count: number; detalles: MermaEvento[] }>
    >();
    let totalCm = 0;
    for (const e of data) {
      totalCm += e.medida_cm ?? 0;
      const mes = formatMes(e.created_at);
      if (!porMes.has(mes)) porMes.set(mes, new Map());
      const codes = porMes.get(mes)!;
      if (!codes.has(e.cod)) codes.set(e.cod, { total_cm: 0, count: 0, detalles: [] });
      const entry = codes.get(e.cod)!;
      entry.total_cm += e.medida_cm ?? 0;
      entry.count += 1;
      entry.detalles.push(e);
    }
    const meses = [...porMes.keys()].reverse();
    const cods = [...new Set(data.map((e) => e.cod))];
    const chartData = meses.map((mes) => {
      const row: Record<string, number | string> = { mes };
      for (const c of cods) {
        const cm = porMes.get(mes)?.get(c)?.total_cm ?? 0;
        row[c] = Math.round(cm * 10) / 10;
      }
      return row;
    });
    return {
      totalCm,
      totalM: (totalCm / 100).toFixed(2),
      porMes,
      meses,
      cods,
      chartData,
    };
  }, [data]);

  if (loading) {
    return <EmptyState>Cargando merma…</EmptyState>;
  }

  if (data.length === 0) {
    return (
      <EmptyState>
        <Trash2 className="mx-auto mb-3 h-10 w-10" />
        No hay merma registrada aún.
        <p className="mt-2 text-xs">
          Se registrará automáticamente al guardar planes de corte desde el optimizador.
        </p>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatBox value={Math.round(totalCm).toLocaleString('es-CL')} label="cm total merma" />
        <StatBox value={totalM} label="metros merma" />
        <StatBox value={String(data.length)} label="eventos" />
      </div>

      <div className="mb-4 rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h6 className="flex items-center gap-1.5 text-sm font-bold">
            <Eraser className="h-4 w-4 text-destructive" />
            Merma por mes y código
          </h6>
        </div>
        <div className="h-[260px] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                formatter={(v: number) => [`${v} cm`]}
                cursor={{ fill: 'hsl(var(--accent) / 0.08)' }}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {cods.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="merma"
                  fill={PALETA[i % PALETA.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-4 pb-10">
        {meses.map((mes) => {
          const codes = porMes.get(mes)!;
          const totalMes = [...codes.values()].reduce((s, v) => s + v.total_cm, 0);
          const maxCm = Math.max(...[...codes.values()].map((v) => v.total_cm));
          const ordenados = [...codes.entries()].sort(
            (a, b) => b[1].total_cm - a[1].total_cm,
          );
          const totalEventos = [...codes.values()].reduce((s, v) => s + v.count, 0);

          return (
            <div key={mes}>
              <div className="mb-2 border-b pb-1 text-sm font-bold text-muted-foreground">
                📅 {mes} — total:{' '}
                <strong className="text-foreground">
                  {Math.round(totalMes).toLocaleString('es-CL')} cm
                </strong>{' '}
                ({(totalMes / 100).toFixed(2)} m)
              </div>
              {ordenados.map(([codigo, info]) => (
                <div
                  key={codigo}
                  className="flex items-center gap-3 border-b border-border/40 py-1.5"
                >
                  <div className="min-w-[80px] text-sm font-bold">{codigo}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-destructive"
                      style={{ width: `${(info.total_cm / maxCm) * 100}%` }}
                    />
                  </div>
                  <div className="min-w-[120px] text-right text-xs text-muted-foreground">
                    {Math.round(info.total_cm)} cm · {info.count} corte
                    {info.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Ver detalle de cada merma ({totalEventos} eventos)
                </summary>
                <div className="mt-2 overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Colmena</TableHead>
                        <TableHead className="text-right">cm</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...codes.values()]
                        .flatMap((v) => v.detalles)
                        .sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        )
                        .map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-bold">{e.cod}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.n_colmena ?? '—'}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-destructive">
                              {(e.medida_cm ?? 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {e.ot ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(e.created_at).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: '2-digit',
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
