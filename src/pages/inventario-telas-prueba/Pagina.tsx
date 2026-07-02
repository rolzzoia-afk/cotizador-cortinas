/**
 * Inventario de Telas (PRUEBA) — versión Supabase
 *
 * Orquestador del módulo. Mantiene la composición pero delega:
 *   - Datos / mutations / storage / perfil / permisos → hooks/
 *   - Handlers async con notificación → hooks/useInventarioHandlers
 *   - Notificación banner → hooks/useNotification
 *   - Header con tabs → components/ModuleHeader
 *   - Export CSV → utils/export-csv
 *
 * IMPORTANTE: todos los hooks se llaman al principio del componente,
 * SIEMPRE en el mismo orden y SIN early returns entre medio.
 * React tira "Rendered more hooks than during the previous render" si
 * cambia la lista de hooks entre renders.
 *
 * Tablas usadas:
 *   - inv_rollos, inv_movimientos, inv_empresa_perfil, inv_permisos
 * Storage: inv-empresa-assets (logo y banner).
 */

import { useState } from 'react';
import { CheckCircle2, Loader2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import CompanyProfilePanel from './components/company-profile/CompanyProfilePanel';
import InventoryStats from './components/InventoryStats';
import AdjustStockModal from './components/modals/AdjustStockModal';
import AddProductModal from './components/modals/AddProductModal';
import HistoryLog from './components/HistoryLog';
import ProductTable from './components/product-table/ProductTable';
import ModuleHeader, { type TabId } from './components/ModuleHeader';

import { usePermisoInventario } from './hooks/usePermisoInventario';
import { useInventarioData } from './hooks/useInventarioData';
import { useInventarioMutations } from './hooks/useInventarioMutations';
import { useImagenStorage } from './hooks/useImagenStorage';
import { usePerfilEmpresa } from './hooks/usePerfilEmpresa';
import { useNotification } from './hooks/useNotification';
import { useInventarioHandlers } from './hooks/useInventarioHandlers';

import { exportInventarioCSV } from './utils/export-csv';
import type { InventoryItem } from './types';

export default function InventarioTelasPruebaPagina() {
  // ── Hooks ──────────────────────────────────────────────────────────
  // Todos al principio, en el mismo orden en cada render.
  const permiso = usePermisoInventario();
  const inv = useInventarioData(permiso.empresaId);
  const muts = useInventarioMutations(permiso.empresaId, inv.rollosRaw, inv.refresh);
  const imagen = useImagenStorage(permiso.empresaId);
  const perfilEmpresa = usePerfilEmpresa(permiso.empresaId);
  const { notification, triggerNotification } = useNotification();

  const [activeTab, setActiveTab] = useState<TabId>('inventario');
  const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(true);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDefaultMode, setAdjustDefaultMode] = useState<'DESCUENTO' | 'INCREMENTO' | undefined>(undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const puedeEditarStock = permiso.rol === 'admin';

  // Los handlers también son un hook (useCallback adentro) — deben llamarse antes de cualquier return.
  // Los inputs admiten profile=null para los renders durante la carga.
  const handlers = useInventarioHandlers({
    items: inv.items,
    historyLogs: inv.historyLogs,
    profile: perfilEmpresa.profile,
    puedeEditarStock,
    emailUsuario: permiso.email,
    muts,
    imagen,
    perfilEmpresa,
    triggerNotification,
  });

  // ── Gates: permiso, carga ───────────────────────────────────────────
  if (permiso.loading) {
    return <CenteredLoader text="Verificando acceso…" />;
  }
  if (!permiso.tieneAcceso) {
    return <AccesoRestringido email={permiso.email} />;
  }
  if (inv.loading || perfilEmpresa.loading || !perfilEmpresa.profile) {
    return <CenteredLoader text="Cargando inventario…" />;
  }

  const profile = perfilEmpresa.profile;
  const items = inv.items;
  const historyLogs = inv.historyLogs;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 antialiased font-sans pb-16">
      <ModuleHeader
        profile={profile}
        email={permiso.email}
        rol={permiso.rol}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {notification && (
          <div
            className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                : notification.type === 'info'
                ? 'bg-blue-950/40 border-blue-800/50 text-blue-300'
                : 'bg-red-950/40 border-red-800/50 text-red-300'
            }`}
          >
            <CheckCircle2 size={16} />
            <span className="text-sm">{notification.message}</span>
          </div>
        )}

        {activeTab === 'empresa' && (
          <CompanyProfilePanel
            profile={profile}
            onSave={handlers.handleSaveProfile}
            onReset={() => { /* sin reset: persistente */ }}
            isExpanded={isProfileExpanded}
            setIsExpanded={setIsProfileExpanded}
            onUploadImage={handlers.handleUploadImage}
          />
        )}

        {activeTab === 'inventario' && (
          <div className="space-y-4">
            <InventoryStats items={items} />
            <ProductTable
              items={items}
              onSelectAdjustItem={(item) => { setAdjustDefaultMode('DESCUENTO'); setSelectedAdjustItem(item); }}
              onSelectIncrementItem={(item) => { setAdjustDefaultMode('INCREMENTO'); setSelectedAdjustItem(item); }}
              onDeleteItem={handlers.handleDeleteItem}
              onAddNew={() => setIsAddModalOpen(true)}
              onReset={handlers.handleResetInventario}
              onExportCSV={() => exportInventarioCSV(items)}
              puedeEditarStock={puedeEditarStock}
            />
          </div>
        )}

        {activeTab === 'historial' && (
          <HistoryLog
            logs={historyLogs}
            onClearLogs={handlers.handleClearLogs}
            onDeleteLogItem={handlers.handleDeleteLog}
          />
        )}
      </main>

      <AdjustStockModal
        item={selectedAdjustItem}
        isOpen={!!selectedAdjustItem}
        defaultActionType={adjustDefaultMode}
        onClose={() => { setSelectedAdjustItem(null); setAdjustDefaultMode(undefined); }}
        onSubmitAdjustment={(itemId, meters, type, comment) => {
          handlers.handleStockAdjustment(itemId, meters, type, comment);
          setSelectedAdjustItem(null);
          setAdjustDefaultMode(undefined);
        }}
      />

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={(p) => { handlers.handleAddProduct(p); setIsAddModalOpen(false); }}
      />
    </div>
  );
}

// ── Sub-componentes locales ───────────────────────────────────────────

function CenteredLoader({ text }: { text: string }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-neutral-300">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      {text}
    </div>
  );
}

function AccesoRestringido({ email }: { email: string | null }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="text-white text-lg font-bold mb-2">Acceso restringido</h2>
        <p className="text-neutral-400 text-sm mb-4">
          Este módulo solo está disponible para vendedores y administradores autorizados.
          Si necesitas acceso, contacta a gerencia para que te agregue a la lista de permisos.
        </p>
        {email && (
          <p className="text-neutral-500 text-xs mb-6">
            Tu email: <span className="text-neutral-300">{email}</span>
          </p>
        )}
        <Link to="/" className="inline-block px-4 py-2 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm hover:bg-neutral-800">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
