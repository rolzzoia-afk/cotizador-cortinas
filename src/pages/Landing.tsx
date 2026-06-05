// Landing v7 — Real-Time Operations Landing (patrón ui-ux-pro-max).
//
// v6 → v7: el patrón "Operations Landing" requiere LIVE STATUS en hero +
// key metrics section. v6 era solo tool picker. Ahora es morning briefing
// + tool picker (estilo Stripe/Linear dashboard home).
//
// Cambios:
// - Sección "Hoy" entre hero y grid con 3 KPIs vivos desde Supabase
// - Sparklines mini en cada KPI mostrando tendencia 7d
// - Live indicator pulsing arriba del bloque
// - Footer con última sincronización

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Calculator,
  ClipboardCheck,
  FlaskConical,
  Layers,
  LineChart,
  LogOut,
  Package,
  Ruler,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import Sparkline from './inteligencia/components/Sparkline';
import FlowFieldBackground from '@/components/FlowFieldBackground';

type CatKey = 'operaciones' | 'comercial' | 'admin';

interface CategoriaMeta {
  key: CatKey;
  label: string;
  bgHover: string;
  borderHover: string;
  textAccent: string;
  dotBg: string;
}

const CATEGORIAS: Record<CatKey, CategoriaMeta> = {
  operaciones: {
    key: 'operaciones',
    label: 'Operaciones',
    bgHover: 'group-hover:bg-sky-400/[0.06]',
    borderHover: 'group-hover:border-sky-400/40',
    textAccent: 'group-hover:text-sky-300',
    dotBg: 'bg-sky-400',
  },
  comercial: {
    key: 'comercial',
    label: 'Comercial',
    bgHover: 'group-hover:bg-emerald-400/[0.06]',
    borderHover: 'group-hover:border-emerald-400/40',
    textAccent: 'group-hover:text-emerald-300',
    dotBg: 'bg-emerald-400',
  },
  admin: {
    key: 'admin',
    label: 'Acceso completo',
    bgHover: 'group-hover:bg-amber-400/[0.06]',
    borderHover: 'group-hover:border-amber-400/40',
    textAccent: 'group-hover:text-amber-300',
    dotBg: 'bg-amber-400',
  },
};

type Role = {
  title: string;
  desc: string;
  to: string;
  icon: LucideIcon;
  tags: string[];
  categoria: CatKey;
  wide?: boolean;
  rolesVisibles: string[];
};

const ROLES: Role[] = [
  { title: 'Bodeguero', desc: 'Despacho y recepción de materiales con escaneo QR.', to: '/bodeguero?rol=bodeguero', icon: Package, tags: ['Despacho', 'QR', 'Stock', 'Camionetas'], categoria: 'operaciones', rolesVisibles: ['bodeguero'] },
  { title: 'Producción', desc: 'Optimizador de corte de tubos, historial y trazabilidad de materiales.', to: '/optimizador?rol=produccion', icon: Wrench, tags: ['Optimizador', 'Historial corte', 'Tubos'], categoria: 'operaciones', rolesVisibles: ['produccion'] },
  { title: 'Telas', desc: 'Gestión y control de stock de telas por rollo.', to: '/telas?rol=telas', icon: Layers, tags: ['Stock telas', 'Colmena'], categoria: 'operaciones', rolesVisibles: ['bodeguero', 'produccion', 'telas', 'dimensionado'] },
  { title: 'Dimensionado', desc: 'Corte de tela por cortina según planes de producción.', to: '/historial-corte?rol=dimensionado', icon: Ruler, tags: ['Corte tela', 'Planes de corte'], categoria: 'operaciones', rolesVisibles: ['produccion', 'dimensionado'] },
  { title: 'Pruebas', desc: 'Control de calidad final antes de enviar a instalación.', to: '/panel?rol=pruebas', icon: ClipboardCheck, tags: ['Panel OTs', 'Control calidad'], categoria: 'operaciones', rolesVisibles: ['pruebas'] },
  { title: 'Ventas', desc: 'KPIs diarios del equipo comercial: llamadas, visitas, cierres y fuentes.', to: '/ventas?rol=ventas', icon: LineChart, tags: ['KPIs', 'Llamadas', 'Cierres', 'Terreno'], categoria: 'comercial', rolesVisibles: ['ventas'] },
  { title: 'Cotizaciones', desc: 'Gestión de OTs, cotizaciones y seguimiento de despachos.', to: '/panel?rol=ventas', icon: BriefcaseBusiness, tags: ['Panel OTs', 'Cotizador'], categoria: 'comercial', rolesVisibles: ['ventas'] },
  { title: 'Inventario de Telas', desc: 'App de la jefa para vendedores en terreno: descuentos de metraje de rollos por venta.', to: '/inventario-telas-prueba', icon: FlaskConical, tags: ['Rollos', 'Vendedores', 'Terreno', 'Beta'], categoria: 'comercial', rolesVisibles: ['ventas'] },
  { title: 'Cotizador Jefe', desc: 'Sistema de cotización OLZZO v1.1 con lista de precios, composición de modelos, cotizador y costo de producción.', to: '/cotizador-jefe', icon: Calculator, tags: ['Lista de precios', 'Modelos', 'Cotizador', 'Costos'], categoria: 'comercial', rolesVisibles: ['ventas'] },
  { title: 'Administrador', desc: 'Acceso completo al sistema. Inventario, inteligencia de negocio, panel admin y todos los módulos.', to: '/panel?rol=admin', icon: ShieldCheck, tags: ['Panel', 'Cotizador', 'Ventas', 'Bodega', 'Insumos', 'Telas', 'Producción', 'Inteligencia'], categoria: 'admin', wide: true, rolesVisibles: [] },
];

const ESTADOS_ACTIVOS = ['cotizacion', 'medicion', 'aprobado', 'produccion', 'listo', 'instalacion'];
const ESTADOS_PRODUCCION = ['produccion', 'listo', 'instalacion'];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const fecha = now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const hour = now.getHours();
  let saludo = 'Hola';
  if (hour < 12) saludo = 'Buenos días';
  else if (hour < 20) saludo = 'Buenas tardes';
  else saludo = 'Buenas noches';
  return { time, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), saludo };
}

function primerNombre(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return nombre.trim().split(/\s+/)[0];
}

interface Briefing {
  loading: boolean;
  otsActivas: number;
  otsEnProduccion: number;
  movsHoy: number;
  movsEntrada: number;
  movsSalida: number;
  alertasStock: number;
  otsDetenidas: number;
  serieMovs7d: number[];
  serieOTs7d: number[];
  lastUpdate: Date | null;
}

function useBriefing(empresaId: string | null | undefined): Briefing {
  const [data, setData] = useState<Briefing>({
    loading: true,
    otsActivas: 0,
    otsEnProduccion: 0,
    movsHoy: 0,
    movsEntrada: 0,
    movsSalida: 0,
    alertasStock: 0,
    otsDetenidas: 0,
    serieMovs7d: [],
    serieOTs7d: [],
    lastUpdate: null,
  });

  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;

    (async () => {
      try {
        const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const hoy = new Date().toISOString().split('T')[0];

        const [rOts, rIns, rMovs7d, rMovsHoy] = await Promise.all([
          supabase.from('ots').select('id,estado,fecha_modificacion').eq('empresa_id', empresaId),
          supabase.from('insumos').select('cod,stock_mp,stock_liberado,minimo').eq('empresa_id', empresaId),
          supabase.from('movimientos_insumos').select('id,tipo,fecha').eq('empresa_id', empresaId).gte('fecha', hace7dias),
          supabase.from('movimientos_insumos').select('id,tipo').eq('empresa_id', empresaId).gte('fecha', hoy),
        ]);

        if (cancelled) return;

        const ots = (rOts.data || []) as { estado: string | null; fecha_modificacion: string | null }[];
        const insumos = (rIns.data || []) as { stock_mp: number | null; stock_liberado: number | null; minimo: number | null }[];
        const movs7d = (rMovs7d.data || []) as { tipo: string | null; fecha: string | null }[];
        const movsHoyArr = (rMovsHoy.data || []) as { tipo: string | null }[];

        const otsActivas = ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || '')).length;
        const otsEnProduccion = ots.filter((o) => ESTADOS_PRODUCCION.includes(o.estado || '')).length;
        const otsDetenidas = ots.filter((o) => {
          if (!ESTADOS_PRODUCCION.includes(o.estado || '')) return false;
          if (!o.fecha_modificacion) return false;
          const dias = (Date.now() - new Date(o.fecha_modificacion).getTime()) / (1000 * 60 * 60 * 24);
          return dias >= 3;
        }).length;

        const alertasStock = insumos.filter((i) => {
          const stock = (i.stock_mp || 0) + (i.stock_liberado || 0);
          return i.minimo != null && Number(i.minimo) > 0 && stock <= Number(i.minimo);
        }).length;

        // Serie 7d de movs
        const buckets = new Array(7).fill(0);
        for (const m of movs7d) {
          if (!m.fecha) continue;
          const dias = Math.floor((Date.now() - new Date(m.fecha).getTime()) / (1000 * 60 * 60 * 24));
          const idx = 6 - dias;
          if (idx >= 0 && idx < 7) buckets[idx]++;
        }

        const movsEntrada = movsHoyArr.filter((m) => (m.tipo || '').toLowerCase() === 'entrada').length;
        const movsSalida = movsHoyArr.filter((m) => (m.tipo || '').toLowerCase() === 'salida').length;

        setData({
          loading: false,
          otsActivas,
          otsEnProduccion,
          movsHoy: movsHoyArr.length,
          movsEntrada,
          movsSalida,
          alertasStock,
          otsDetenidas,
          serieMovs7d: buckets,
          serieOTs7d: [],
          lastUpdate: new Date(),
        });
      } catch (e) {
        console.error('[Landing briefing]', e);
        if (!cancelled) setData((d) => ({ ...d, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [empresaId]);

  return data;
}

export function Landing() {
  const { time, fecha, saludo } = useClock();
  const { perfil, signOut, empresaId } = useAuth();
  const navigate = useNavigate();
  const briefing = useBriefing(empresaId);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const rolActual = (perfil?.rol || '').toLowerCase().trim();
  const tilesParaRol = useMemo(
    () => ROLES.filter((r) => r.rolesVisibles.includes(rolActual)),
    [rolActual],
  );
  const esAdmin = rolActual === 'admin' || !rolActual || tilesParaRol.length === 0;
  const rolesVisibles = esAdmin ? ROLES : tilesParaRol;

  const operaciones = rolesVisibles.filter((r) => r.categoria === 'operaciones');
  const comercial = rolesVisibles.filter((r) => r.categoria === 'comercial');
  const admin = rolesVisibles.filter((r) => r.categoria === 'admin');

  const nombre = primerNombre(perfil?.nombre);
  const alertasTotal = briefing.alertasStock + briefing.otsDetenidas;

  return (
    <div className="theme-dp relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Flow-field calibrado — capa de fondo, detrás de ambient + contenido */}
      <FlowFieldBackground className="z-0" />
      <div className="dp-ambient pointer-events-none absolute inset-0 z-[1]" aria-hidden />

      <header className="relative z-10 border-b border-border">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between gap-4 px-8">
          <div className="flex items-baseline gap-3">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[22px] leading-none text-foreground"
                style={{
                  fontFamily: "'Fraunces', ui-serif, Georgia, serif",
                  fontVariationSettings: "'opsz' 144, 'SOFT' 50",
                  fontWeight: 500,
                  fontStyle: 'italic',
                  letterSpacing: '-0.02em',
                }}
              >
                Rolzzo
              </span>
              <span aria-hidden className="inline-block h-1.5 w-1.5 translate-y-[-2px] bg-accent" />
            </div>
            <span className="text-muted-foreground/30">·</span>
            <span className="text-[12px] text-muted-foreground">Sistema interno</span>
          </div>
          <div className="flex items-center gap-5">
            {perfil?.nombre && (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
                <div className="text-right">
                  <div className="text-[12.5px] font-medium text-foreground">{perfil.nombre}</div>
                  {perfil?.rol && <div className="text-[10.5px] text-muted-foreground">{perfil.rol}</div>}
                </div>
              </div>
            )}
            <div className="hidden text-right md:block">
              <div className="dp-num flex items-baseline justify-end gap-1 text-[12.5px] font-medium tabular-nums text-foreground">
                {time}
                <span className="dp-tick text-accent" aria-hidden>·</span>
              </div>
              <div className="text-[10.5px] text-muted-foreground first-letter:capitalize">{fecha}</div>
            </div>
            <button
              onClick={handleLogout}
              className="dp-press flex h-8 items-center gap-1.5 rounded-sm border border-border bg-transparent px-2.5 text-[12px] text-foreground/80 hover:border-foreground/30 hover:bg-foreground/[0.04] hover:text-foreground"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="dp-stagger relative z-10 mx-auto max-w-[1180px] px-8 py-14">
        {/* Hero — saludo personal */}
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1
              className="text-[44px] font-medium leading-[1.02] tracking-[-0.028em] text-foreground"
              style={{ textWrap: 'balance' }}
            >
              {saludo}
              {nombre && (
                <>
                  , <span className="text-foreground">{nombre}</span>
                  <span className="text-accent">.</span>
                </>
              )}
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-foreground">
              Esto es lo que está pasando hoy en Rolzzo.
            </p>
          </div>
          {rolActual && (
            <div className="text-[11.5px] text-muted-foreground md:text-right">
              Acceso de{' '}
              <span className="text-foreground underline decoration-accent decoration-1 underline-offset-[3px]">
                {esAdmin ? 'administrador' : rolActual}
              </span>
            </div>
          )}
        </div>

        {/* BRIEFING OPERACIONAL — la sección que faltaba */}
        <Link
          to="/panel?rol=admin"
          className="dp-press group relative mb-12 block rounded-sm border border-border bg-foreground/[0.015] p-6 hover:bg-foreground/[0.035] focus:outline-none focus-visible:bg-foreground/[0.035]"
        >
          <div className="mb-5 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="dp-live inline-block h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              <span className="text-[11.5px] font-medium text-foreground">En vivo</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-[11.5px] text-muted-foreground">Estado operacional hoy</span>
            </div>
            <span className="text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
              Ver inteligencia →
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-3">
            <KPI
              label="OTs activas"
              value={briefing.otsActivas}
              detail={`${briefing.otsEnProduccion} en producción`}
              loading={briefing.loading}
              tone="default"
            />
            <KPI
              label="Movimientos hoy"
              value={briefing.movsHoy}
              detail={`${briefing.movsEntrada} entradas · ${briefing.movsSalida} salidas`}
              loading={briefing.loading}
              tone="default"
              serie={briefing.serieMovs7d}
            />
            <KPI
              label="Alertas pendientes"
              value={alertasTotal}
              detail={`${briefing.alertasStock} stock · ${briefing.otsDetenidas} OTs detenidas`}
              loading={briefing.loading}
              tone={alertasTotal > 0 ? 'warning' : 'success'}
            />
          </div>
        </Link>

        {rolesVisibles.length === 0 && (
          <div className="rounded-sm border border-warning/30 bg-warning/[0.06] p-5 text-[13px] text-warning">
            <p className="font-medium">Tu cuenta no tiene módulos asignados.</p>
            <p className="mt-1 text-[11.5px] text-warning/70">
              Contacta al administrador para que configure tu rol.
            </p>
          </div>
        )}

        {operaciones.length > 0 && (
          <CategoryBlock cat={CATEGORIAS.operaciones} count={operaciones.length} roles={operaciones} />
        )}
        {comercial.length > 0 && (
          <CategoryBlock cat={CATEGORIAS.comercial} count={comercial.length} roles={comercial} />
        )}
        {admin.length > 0 && (
          <CategoryBlock cat={CATEGORIAS.admin} count={admin.length} roles={admin} featured />
        )}

        <footer className="mt-20 flex items-baseline justify-between border-t border-border pt-5 text-[11px] text-muted-foreground">
          <span>Cortinas Rolzzo · Sistema de gestión interna</span>
          <span className="dp-num tabular-nums">
            {briefing.lastUpdate ? `Sincronizado ${briefing.lastUpdate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : 'v1.0'}
          </span>
        </footer>
      </main>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────

function KPI({
  label,
  value,
  detail,
  loading,
  tone = 'default',
  serie,
}: {
  label: string;
  value: number;
  detail: string;
  loading: boolean;
  tone?: 'default' | 'warning' | 'success' | 'danger';
  serie?: number[];
}) {
  const color =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'danger'
        ? 'text-destructive'
        : tone === 'success'
          ? 'text-success'
          : 'text-foreground';

  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        {loading ? (
          <span className="dp-num inline-block h-[28px] w-12 rounded-sm bg-foreground/[0.06]" aria-hidden />
        ) : (
          <span className={cn('dp-display text-[28px] leading-none tabular-nums', color)}>
            {value}
          </span>
        )}
        {serie && serie.length > 1 && !loading && (
          <Sparkline values={serie} width={72} height={20} className={cn('flex-shrink-0', color)} />
        )}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        {loading ? <span className="inline-block h-3 w-32 rounded-sm bg-foreground/[0.04]" /> : detail}
      </div>
    </div>
  );
}

function CategoryBlock({ cat, count, roles, featured }: { cat: CategoriaMeta; count: number; roles: Role[]; featured?: boolean }) {
  return (
    <section className="mb-12 last:mb-0">
      <div className="mb-5 flex items-baseline justify-between border-b border-border pb-2.5">
        <h2 className="flex items-baseline gap-2.5">
          <span aria-hidden className={cn('inline-block h-2 w-2 translate-y-[-1px]', cat.dotBg)} />
          <span className="text-[14px] font-medium tracking-tight text-foreground">{cat.label}</span>
        </h2>
        <span className="dp-num text-[11px] tabular-nums text-muted-foreground">
          {count} {count === 1 ? 'módulo' : 'módulos'}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-sm bg-border sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <li key={r.title} className={cn(r.wide && 'sm:col-span-2 lg:col-span-3')}>
            <RoleCard role={r} cat={cat} featured={featured} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoleCard({ role, cat, featured }: { role: Role; cat: CategoriaMeta; featured?: boolean }) {
  return (
    <Link
      to={role.to}
      className={cn(
        'dp-press group relative block h-full overflow-hidden bg-background p-6',
        cat.bgHover,
        'focus:outline-none focus-visible:bg-foreground/[0.025]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0 right-0 top-0 h-px origin-left scale-x-0 transition-transform duration-200 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100',
          cat.dotBg,
        )}
      />
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border border-border bg-secondary/40',
            'text-foreground/75 transition-all duration-200 ease-out group-hover:scale-[1.04]',
            cat.borderHover,
            cat.bgHover,
            cat.textAccent,
            featured && cn(cat.borderHover.replace('group-hover:', ''), cat.bgHover.replace('group-hover:', ''), cat.textAccent.replace('group-hover:', '')),
          )}
        >
          <role.icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[14.5px] font-medium tracking-tight text-foreground">{role.title}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{role.desc}</p>
          {role.tags.length > 0 && (
            <div className="mt-3 text-[11px] text-muted-foreground/75">{role.tags.join(' · ')}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
