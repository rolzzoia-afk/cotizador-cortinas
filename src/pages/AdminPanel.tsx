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

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Boxes,
  Brain,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  Home,
  LineChart,
  Package,
  Ruler,
  Server,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import TabButton from '@/pages/historial-tubos/components/TabButton';
import { AuditLogSection } from '@/components/admin/AuditLogSection';
import { AgenteIASection } from '@/components/admin/AgenteIASection';
import { ParametrosCotizadorSection } from '@/components/admin/ParametrosCotizadorSection';
import { ComisionesTarjetaSection } from '@/components/admin/ComisionesTarjetaSection';
import { UsuariosRolesSection } from '@/components/admin/UsuariosRolesSection';
import { SuscripcionSection } from '@/components/admin/SuscripcionSection';
import { TerminosSection } from '@/components/admin/TerminosSection';
import { DocumentoSection } from '@/components/admin/DocumentoSection';
import { OrphanPlansBanner } from '@/components/admin/OrphanPlansBanner';
import VistaSistema from './admin/vistas/VistaSistema';
import VistaInventario from './admin/vistas/VistaInventario';
import VistaCatalogo from './admin/vistas/VistaCatalogo';

type Tab =
  | 'sistema'
  | 'inventario'
  | 'cotizador'
  | 'catalogo'
  | 'usuarios'
  | 'agente'
  | 'auditoria';

const TABS: Array<{ id: Tab; label: string; icon: typeof Server }> = [
  { id: 'sistema', label: 'Sistema', icon: Server },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'cotizador', label: 'Cotizador', icon: Calculator },
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
          Sistema y taller · Inventario · Cotizador · Catálogo técnico · Usuarios · Agente IA ·
          Auditoría.
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
      {tab === 'cotizador' && (
        <div className="space-y-6">
          <ParametrosCotizadorSection />
          <ComisionesTarjetaSection />
          <TerminosSection />
          <DocumentoSection />
        </div>
      )}
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
