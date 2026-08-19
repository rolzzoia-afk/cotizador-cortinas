// Orquestador del Panel de Administrador.
//
// Antes era un scroll único de ~690 líneas con 14 bloques apilados: había que
// bajar a ciegas para encontrar cualquier cosa. Ahora las secciones se agrupan
// en 6 pestañas por tema y esta página solo decide cuál mostrar — el patrón
// que ya usan Telas, Historial de tubos y Ojo de Dios.
//
// Las secciones NO cambiaron de lógica: son los mismos componentes de
// src/components/admin/, más las dos vistas que estaban inline y se extrajeron
// a ./admin/vistas/.

import { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Boxes,
  Brain,
  BriefcaseBusiness,
  ClipboardList,
  Coins,
  FileText,
  Home,
  LineChart,
  Package,
  Ruler,
  Scissors,
  Server,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import TabButton from '@/pages/historial-tubos/components/TabButton';
import { AuditLogSection } from '@/components/admin/AuditLogSection';
import { AgenteIASection } from '@/components/admin/AgenteIASection';
import { UsuariosRolesSection } from '@/components/admin/UsuariosRolesSection';
import { SuscripcionSection } from '@/components/admin/SuscripcionSection';
import { TerminosSection } from '@/components/admin/TerminosSection';
import { ChecklistVisitaSection } from '@/components/admin/ChecklistVisitaSection';
import { BloquesInformeSection } from '@/components/admin/BloquesInformeSection';
import { IntrosInformeSection } from '@/components/admin/IntrosInformeSection';
import { DocumentoSection } from '@/components/admin/DocumentoSection';
import { OrphanPlansBanner } from '@/components/admin/OrphanPlansBanner';
// El tab «Optimizador» calcula la hoja de corte de una OT (tablas pesadas y la
// consulta a la colmena): se carga al abrirlo, no al entrar al panel.
const OptimizadorOTSection = lazy(() =>
  import('@/components/admin/OptimizadorOTSection').then((m) => ({
    default: m.OptimizadorOTSection,
  })),
);
import VistaSistema from './admin/vistas/VistaSistema';
import VistaInventario from './admin/vistas/VistaInventario';
import VistaCatalogo from './admin/vistas/VistaCatalogo';
import VistaPrecios from './admin/vistas/VistaPrecios';

type Tab =
  | 'sistema'
  | 'inventario'
  | 'optimizador'
  | 'precios'
  | 'cotizador'
  | 'catalogo'
  | 'usuarios'
  | 'agente'
  | 'auditoria';

const TABS: Array<{ id: Tab; label: string; icon: typeof Server }> = [
  { id: 'sistema', label: 'Sistema', icon: Server },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'optimizador', label: 'Optimizador', icon: Scissors },
  { id: 'precios', label: 'Precios', icon: Coins },
  { id: 'cotizador', label: 'Documento', icon: FileText },
  { id: 'catalogo', label: 'Catálogo técnico', icon: Ruler },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'agente', label: 'Agente IA', icon: Bot },
  { id: 'auditoria', label: 'Auditoría', icon: ClipboardList },
];

const MODULOS_QUICK = [
  { to: '/ventas', label: 'KPI Ventas', icon: LineChart },
  { to: '/panel?rol=admin', label: 'Cotizaciones / OTs', icon: BriefcaseBusiness },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/inteligencia', label: 'Inteligencia', icon: Brain },
  { to: '/bodeguero', label: 'Bodeguero', icon: Boxes },
  { to: '/landing', label: 'Inicio', icon: Home },
];

export function AdminPanel() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState<Tab>('sistema');

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header>
        <h1 className="text-2xl font-bold">Panel de Administrador</h1>
        <p className="text-sm text-muted-foreground">
          Sistema y taller · Inventario · Optimizador · Precios · Cotizador · Catálogo técnico ·
          Usuarios · Agente IA · Auditoría.
        </p>
      </header>

      <OrphanPlansBanner />

      {/* Accesos rápidos */}
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

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabButton>
        ))}
      </div>

      {tab === 'sistema' && <VistaSistema empresaId={empresaId} />}
      {tab === 'inventario' && <VistaInventario empresaId={empresaId} />}
      {tab === 'optimizador' && (
        <Suspense
          fallback={<p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>}
        >
          <OptimizadorOTSection />
        </Suspense>
      )}
      {tab === 'cotizador' && (
        <div className="space-y-6">
          <TerminosSection />
          <ChecklistVisitaSection />
          {/* El informe se arma de arriba abajo: primero los pasos de luz, después
              las habitaciones (datos de la orden) y al final los bloques fijos. */}
          <IntrosInformeSection />
          <BloquesInformeSection />
          <DocumentoSection />
        </div>
      )}
      {tab === 'precios' && <VistaPrecios />}
      {tab === 'catalogo' && <VistaCatalogo />}
      {tab === 'usuarios' && (
        <div className="space-y-6">
          <SuscripcionSection />
          <UsuariosRolesSection />
        </div>
      )}
      {tab === 'agente' && <AgenteIASection />}
      {tab === 'auditoria' && <AuditLogSection />}
    </div>
  );
}
