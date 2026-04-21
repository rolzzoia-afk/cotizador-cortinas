import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardCheck,
  Layers,
  LineChart,
  Package,
  Ruler,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = {
  title: string;
  desc: string;
  to: string;
  icon: LucideIcon;
  color: string;
  tags: string[];
  wide?: boolean;
};

const ROLES: Role[] = [
  {
    title: 'Bodeguero',
    desc: 'Despacho y recepción de materiales con escaneo QR.',
    to: '/?rol=bodeguero',
    icon: Package,
    color: 'text-cyan-400 border-cyan-400/40 hover:shadow-cyan-400/30',
    tags: ['Despacho', 'QR', 'Stock', 'Camionetas'],
  },
  {
    title: 'Ventas',
    desc: 'KPIs diarios del equipo comercial: llamadas, visitas, cierres y fuentes.',
    to: '/ventas',
    icon: LineChart,
    color: 'text-green-400 border-green-400/40 hover:shadow-green-400/30',
    tags: ['KPIs', 'Llamadas', 'Cierres', 'Terreno'],
  },
  {
    title: 'Cotizaciones',
    desc: 'Gestión de OTs, cotizaciones y seguimiento de despachos.',
    to: '/?rol=ventas',
    icon: BriefcaseBusiness,
    color: 'text-indigo-400 border-indigo-400/40 hover:shadow-indigo-400/30',
    tags: ['Panel OTs', 'Cotizador'],
  },
  {
    title: 'Producción',
    desc: 'Optimizador de corte de tubos, historial y trazabilidad de materiales.',
    to: '/?rol=produccion',
    icon: Wrench,
    color: 'text-amber-400 border-amber-400/40 hover:shadow-amber-400/30',
    tags: ['Optimizador', 'Historial corte', 'Tubos'],
  },
  {
    title: 'Telas',
    desc: 'Gestión y control de stock de telas por rollo.',
    to: '/?rol=telas',
    icon: Layers,
    color: 'text-pink-400 border-pink-400/40 hover:shadow-pink-400/30',
    tags: ['Stock telas', 'Colmena'],
  },
  {
    title: 'Dimensionado',
    desc: 'Corte de tela por cortina según planes de producción.',
    to: '/?rol=dimensionado',
    icon: Ruler,
    color: 'text-green-400 border-green-400/40 hover:shadow-green-400/30',
    tags: ['Corte tela', 'Planes de corte'],
  },
  {
    title: 'Pruebas',
    desc: 'Control de calidad final antes de enviar a instalación.',
    to: '/?rol=pruebas',
    icon: ClipboardCheck,
    color: 'text-sky-400 border-sky-400/40 hover:shadow-sky-400/30',
    tags: ['Panel OTs', 'Control calidad'],
  },
  {
    title: 'Administrador',
    desc: 'Acceso completo al sistema — inventario, inteligencia de negocio, panel admin y todos los módulos.',
    to: '/?rol=admin',
    icon: ShieldCheck,
    color: 'text-purple-400 border-purple-400/40 hover:shadow-purple-400/30',
    tags: [
      'Panel OTs',
      'Cotizador',
      'Ventas KPI',
      'Bodeguero',
      'Insumos',
      'Telas',
      'Producción',
      'Inteligencia',
      'Todo',
    ],
    wide: true,
  },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const fecha = now.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return { time, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1) };
}

export function Landing() {
  const { time, fecha } = useClock();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070d] text-slate-100">
      {/* Fondo con orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-36 -top-24 h-[600px] w-[600px] animate-pulse rounded-full bg-indigo-500 opacity-15 blur-[120px]" />
        <div className="absolute -bottom-24 -right-24 h-[500px] w-[500px] animate-pulse rounded-full bg-cyan-500 opacity-15 blur-[120px]" />
        <div className="absolute left-[40%] top-[40%] h-[400px] w-[400px] animate-pulse rounded-full bg-amber-500 opacity-10 blur-[120px]" />
      </div>

      {/* Reloj */}
      <div className="fixed right-6 top-5 z-10 hidden text-right text-xs text-slate-500 sm:block">
        <div className="font-semibold tabular-nums text-white/70">{time}</div>
        <div>{fecha}</div>
      </div>

      {/* Contenido */}
      <div className="relative z-10 flex min-h-screen flex-col items-center px-6 py-12">
        <div className="mb-12 text-center">
          <div className="mb-4 font-[cursive] text-5xl leading-none tracking-wide text-white drop-shadow-[0_2px_30px_rgba(99,102,241,0.4)]">
            Rolzzo
          </div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
            Cortinas Rolzzo · Sistema de Gestión Interna
          </div>
          <h1 className="mb-1 text-2xl font-bold text-white">¿A qué área vas hoy?</h1>
          <p className="text-sm text-slate-500">
            Selecciona tu rol para acceder a tu módulo de trabajo
          </p>
        </div>

        <div className="grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-3">
          {ROLES.map((r) => (
            <Link
              key={r.title}
              to={r.to}
              className={cn(
                'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-white/[0.07] hover:shadow-2xl',
                r.color,
                r.wide && 'col-span-2 flex items-center gap-5 md:col-span-3',
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-all group-hover:bg-white/10',
                  r.wide && 'h-14 w-14 flex-shrink-0',
                )}
              >
                <r.icon className="h-5 w-5" />
              </div>

              <div className="flex-1">
                <div className="mb-1 text-base font-bold text-white">{r.title}</div>
                <div className="mb-2 text-xs leading-snug text-slate-500">{r.desc}</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <ArrowUpRight className="absolute right-5 top-5 h-4 w-4 text-white/20 transition-all group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-current" />
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-xs text-white/20">
          <span className="text-white/30">Cortinas Rolzzo</span> · Sistema de gestión interna · v1.0
        </div>
      </div>
    </div>
  );
}
