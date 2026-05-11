import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Brain,
  BriefcaseBusiness,
  Eye,
  Home,
  LineChart,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import { useAuth } from '@/lib/auth';
import { formatDate, formatDateTime } from '@/lib/formatters';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AuditLogSection } from '@/components/admin/AuditLogSection';
import { AgenteIASection } from '@/components/admin/AgenteIASection';
import { InventoryBaselineSection } from '@/components/admin/InventoryBaselineSection';
import { OrphanPlansBanner } from '@/components/admin/OrphanPlansBanner';

type Tubo = {
  id: string;
  n_colmena: string | null;
  cod: string | null;
  medida_cm: number | null;
  medida_mm: number | null;
  serial: string | null;
  agregado_por_admin: boolean | null;
  created_at: string | null;
};

type PlanCorte = {
  id: string;
  fecha: string;
  optimizer_email: string | null;
  fecha_correccion: string | null;
  resultados: unknown;
  ordenes: unknown;
};

type PlanResultado = {
  colmena?: string;
  colmena_sobrante?: string;
  codigo?: string;
  codigo_original?: string;
  color?: string;
  medida_cm?: number;
  medida_origen?: number;
  sobrante_cm?: number;
  fuente?: string;
  nombreMaterialNuevo?: string;
  es_intermedio?: boolean;
  es_desecho?: boolean;
};

function parsearResultados(raw: unknown): PlanResultado[] {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw as PlanResultado[];
    return [];
  } catch {
    return [];
  }
}

const MODULOS_QUICK = [
  { to: '/ventas', label: 'KPI Ventas', icon: LineChart, color: 'from-green-600 to-green-500' },
  {
    to: '/panel?rol=admin',
    label: 'Cotizaciones / OTs',
    icon: BriefcaseBusiness,
    color: 'from-indigo-600 to-indigo-500',
  },
  { to: '/inventario', label: 'Inventario', icon: Package, color: 'from-sky-700 to-sky-500' },
  {
    to: '/inteligencia',
    label: 'Inteligencia',
    icon: Brain,
    color: 'from-purple-700 to-purple-500',
  },
  {
    to: '/bodeguero',
    label: 'Bodeguero',
    icon: Boxes,
    color: 'from-cyan-700 to-cyan-500',
  },
  { to: '/landing', label: 'Inicio', icon: Home, color: 'from-slate-700 to-slate-500' },
];

export function AdminPanel() {
  const { empresaId } = useAuth();

  const [version, setVersion] = useState<string | null>(null);
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [filtroTubos, setFiltroTubos] = useState('');
  const [optimizadores, setOptimizadores] = useState<string[]>([]);
  const [optimizerSel, setOptimizerSel] = useState('');
  const [planes, setPlanes] = useState<PlanCorte[]>([]);
  const [planDetalle, setPlanDetalle] = useState<PlanCorte | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [actualizandoVersion, setActualizandoVersion] = useState(false);

  // Cargar versión
  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'opt_version_minima')
        .maybeSingle<{ valor: string }>();
      setVersion(data?.valor ?? null);
    };
    run();

    // Realtime: recargar versión cuando cambie
    const ch = supabase
      .channel('admin-version')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracion',
          filter: `empresa_id=eq.${empresaId}`,
        },
        run,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  // Cargar inventario
  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('colmena_tubos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('n_colmena')
        .order('created_at');
      setTubos((data as Tubo[]) ?? []);
    };
    run();
    const ch = supabase
      .channel('admin-tubos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'colmena_tubos',
          filter: `empresa_id=eq.${empresaId}`,
        },
        run,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  // Cargar lista de optimizadores (emails únicos)
  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('planes_corte')
        .select('optimizer_email')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      const emails = [
        ...new Set(((data as { optimizer_email: string | null }[]) ?? [])
          .map((d) => d.optimizer_email)
          .filter((e): e is string => !!e)),
      ];
      setOptimizadores(emails);
      if (emails.length === 1) setOptimizerSel(emails[0]);
    };
    run();
  }, [empresaId]);

  // Cargar planes del optimizador seleccionado
  useEffect(() => {
    if (!empresaId || !optimizerSel) {
      setPlanes([]);
      return;
    }
    const run = async () => {
      const { data } = await supabase
        .from('planes_corte')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('optimizer_email', optimizerSel)
        .order('fecha', { ascending: false })
        .limit(30);
      setPlanes((data as PlanCorte[]) ?? []);
    };
    run();
  }, [empresaId, optimizerSel]);

  // Stats derivados
  const stats = useMemo(() => {
    const total = tubos.length;
    const admin = tubos.filter((t) => t.agregado_por_admin).length;
    const codigosUnicos = new Set(tubos.map((t) => (t.cod ?? '').toUpperCase())).size;
    return { total, admin, codigosUnicos };
  }, [tubos]);

  const tubosFiltrados = useMemo(() => {
    const q = filtroTubos.toLowerCase().trim();
    if (!q) return tubos;
    return tubos.filter((t) => {
      const txt = `${t.n_colmena ?? ''} ${t.cod ?? ''} ${t.serial ?? ''} ${t.medida_cm ?? ''}`.toLowerCase();
      return txt.includes(q);
    });
  }, [tubos, filtroTubos]);

  // Acciones
  const forzarActualizacion = async () => {
    if (!empresaId) return;
    const actual = version ?? '0.9';
    const num = parseFloat(actual);
    const nueva = (Math.round((num + 0.1) * 10) / 10).toFixed(1);

    const ok = window.confirm(
      `¿Subir la versión de "${version ?? 'N/A'}" a "${nueva}"?\n\n` +
        `Esto forzará una recarga inmediata en TODOS los navegadores del taller.`,
    );
    if (!ok) return;

    setActualizandoVersion(true);
    const { error } = await supabase
      .from('configuracion')
      .upsert(
        { empresa_id: empresaId, clave: 'opt_version_minima', valor: nueva },
        { onConflict: 'empresa_id,clave' },
      );
    setActualizandoVersion(false);
    if (error) {
      toast.error('Error al actualizar la versión: ' + error.message);
      return;
    }
    toast.success(`Versión actualizada a v${nueva}. Los dispositivos del taller se recargarán.`);
  };

  const restaurarPlan = async () => {
    if (!planDetalle || !empresaId) return;
    const fecha = formatDateTime(planDetalle.fecha);

    const ok = window.confirm(
      `¿Restaurar el plan del ${fecha} como plan activo?\n\n` +
        `Se creará una copia como el más reciente del optimizador "${planDetalle.optimizer_email}".`,
    );
    if (!ok) return;

    setRestaurando(true);
    const { error } = await supabase.from('planes_corte').insert({
      empresa_id: empresaId,
      optimizer_email: planDetalle.optimizer_email,
      resultados: planDetalle.resultados as Json,
      ordenes: planDetalle.ordenes as Json,
      fecha: new Date().toISOString(),
      fecha_correccion: null,
    });
    setRestaurando(false);

    if (error) {
      toast.error('Error durante la restauración: ' + error.message);
      return;
    }
    toast.success(`Plan restaurado. Se creó una copia del plan del ${fecha}.`);
    setPlanDetalle(null);
    // Recargar planes
    if (optimizerSel) setOptimizerSel((e) => e); // noop to trigger… instead do explicit
    const { data } = await supabase
      .from('planes_corte')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('optimizer_email', planDetalle.optimizer_email ?? '')
      .order('fecha', { ascending: false })
      .limit(30);
    setPlanes((data as PlanCorte[]) ?? []);
  };

  const detalleResultados = useMemo(
    () => (planDetalle ? parsearResultados(planDetalle.resultados) : []),
    [planDetalle],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Panel de Administrador</h1>
        <p className="text-sm text-muted-foreground">
          Control de sistema, inventario en vivo e historial de planes de corte.
        </p>
      </header>

      <OrphanPlansBanner />

      {/* Accesos rápidos */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          {MODULOS_QUICK.map((m) => (
            <Button key={m.to} asChild variant="secondary" size="sm">
              <Link to={m.to} className="flex items-center gap-1.5">
                <m.icon className="h-4 w-4" />
                {m.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      {/* Control de sistema */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Control de sistema</h2>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">
              Versión mínima requerida en Supabase
            </div>
            <div className="inline-block rounded-md border-2 border-cyan-500 bg-cyan-500/10 px-5 py-3 font-mono text-2xl font-bold text-cyan-500">
              {version ? `v${version}` : 'Sin configurar'}
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={forzarActualizacion}
            disabled={actualizandoVersion}
            className="font-semibold"
          >
            {actualizandoVersion
              ? 'Actualizando…'
              : 'Forzar actualización en taller (subir versión)'}
          </Button>
        </div>
      </section>

      {/* Inventario en vivo */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Inventario en vivo — Colmena de tubos
        </h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <StatCard value={stats.total} label="Tubos total" />
          <StatCard value={stats.total} label="Disponibles" />
          <StatCard value={stats.admin} label="Agregados por admin" />
          <StatCard value={stats.codigosUnicos} label="Códigos únicos" />
        </div>

        <Input
          placeholder="Buscar por código, colmena o serial…"
          value={filtroTubos}
          onChange={(e) => setFiltroTubos(e.target.value)}
          className="mb-3 max-w-sm"
        />

        <div className="max-h-[600px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>N° Colmena</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Medida (cm)</TableHead>
                <TableHead>Medida (mm)</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tubosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {tubos.length === 0 ? 'No hay tubos en el inventario' : 'Sin coincidencias'}
                  </TableCell>
                </TableRow>
              ) : (
                tubosFiltrados.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.n_colmena ?? '—'}</TableCell>
                    <TableCell className="font-mono">{t.cod ?? '—'}</TableCell>
                    <TableCell>{t.medida_cm ?? '—'}</TableCell>
                    <TableCell>{t.medida_mm ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.serial ?? '—'}</TableCell>
                    <TableCell>
                      {t.agregado_por_admin ? (
                        <Badge variant="warning">Admin</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{formatDate(t.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Historial de planes */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Historial de planes de corte
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Planes generados por el optimizador, guardados automáticamente en Supabase.
        </p>

        <div className="mb-3 flex items-center gap-3">
          <label htmlFor="optsel" className="text-sm text-muted-foreground">
            Email del optimizador:
          </label>
          <select
            id="optsel"
            value={optimizerSel}
            onChange={(e) => setOptimizerSel(e.target.value)}
            className="flex h-9 min-w-[250px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">-- Seleccionar optimizador --</option>
            {optimizadores.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[400px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Fecha / Hora</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cortes</TableHead>
                <TableHead>Corregido</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {optimizerSel
                      ? 'Sin planes registrados'
                      : 'Selecciona un optimizador para ver su historial'}
                  </TableCell>
                </TableRow>
              ) : (
                planes.map((p) => {
                  const cortes = parsearResultados(p.resultados).length;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{formatDateTime(p.fecha)}</TableCell>
                      <TableCell>{p.optimizer_email ?? '—'}</TableCell>
                      <TableCell>{cortes}</TableCell>
                      <TableCell>
                        {p.fecha_correccion ? (
                          <Badge variant="success">Corregido</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPlanDetalle(p)}
                          className="h-7 gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Cargar inventario base desde Excel */}
      <InventoryBaselineSection />

      {/* Agente IA */}
      <AgenteIASection />

      {/* Audit log */}
      <AuditLogSection />

      {/* Modal detalle */}
      <Dialog open={!!planDetalle} onOpenChange={(o) => !o && setPlanDetalle(null)}>
        <DialogContent>
          {planDetalle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Plan de corte — {formatDateTime(planDetalle.fecha)}
                </DialogTitle>
                <DialogDescription>
                  Email: {planDetalle.optimizer_email ?? '—'} · Cortes:{' '}
                  {detalleResultados.length} · ID: {planDetalle.id}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[500px] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Colmena</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Color</TableHead>
                      <TableHead>Medida (cm)</TableHead>
                      <TableHead>Origen (cm)</TableHead>
                      <TableHead>Sobrante (cm)</TableHead>
                      <TableHead>Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleResultados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                          Sin datos de resultados
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalleResultados.flatMap((r, i) => {
                        const codigoDisplay =
                          r.codigo_original && r.codigo && r.codigo_original !== r.codigo
                            ? `${r.codigo_original} → ${r.codigo}`
                            : r.codigo ?? r.codigo_original ?? '—';
                        const fuenteVariant: 'info' | 'warning' | 'secondary' =
                          r.fuente === 'tubo_nuevo'
                            ? 'warning'
                            : r.fuente === 'reemplazo'
                            ? 'info'
                            : 'secondary';
                        const main = (
                          <TableRow key={`${i}-main`}>
                            <TableCell>{r.colmena ?? r.nombreMaterialNuevo ?? '—'}</TableCell>
                            <TableCell className="font-mono">{codigoDisplay}</TableCell>
                            <TableCell>{r.color ?? '—'}</TableCell>
                            <TableCell>{r.medida_cm ?? '—'}</TableCell>
                            <TableCell>{r.medida_origen ?? '—'}</TableCell>
                            <TableCell>{r.sobrante_cm ?? '—'}</TableCell>
                            <TableCell>
                              <Badge variant={fuenteVariant}>
                                {(r.fuente ?? '').toUpperCase() || '—'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                        if (!r.sobrante_cm || r.sobrante_cm <= 0) return [main];
                        const accion = r.es_intermedio
                          ? 'RESERVAR EN MESA'
                          : r.es_desecho
                          ? 'DESECHAR MERMA'
                          : 'GUARDAR SOBRANTE';
                        const variant: 'warning' | 'destructive' | 'success' =
                          r.es_intermedio
                            ? 'warning'
                            : r.es_desecho
                            ? 'destructive'
                            : 'success';
                        const sub = (
                          <TableRow key={`${i}-sub`} className="bg-muted/40">
                            <TableCell>{r.colmena_sobrante ?? '—'}</TableCell>
                            <TableCell className="font-mono">{codigoDisplay}</TableCell>
                            <TableCell />
                            <TableCell colSpan={2}>{r.sobrante_cm} cm</TableCell>
                            <TableCell />
                            <TableCell>
                              <Badge variant={variant}>{accion}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                        return [main, sub];
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={restaurarPlan}
                  disabled={restaurando}
                >
                  {restaurando ? 'Restaurando…' : 'Restaurar este plan como activo'}
                </Button>
                <Button variant="secondary" onClick={() => setPlanDetalle(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[120px] rounded-md border bg-cyan-500/10 px-4 py-3 text-center">
      <div className="text-2xl font-bold text-cyan-500">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
