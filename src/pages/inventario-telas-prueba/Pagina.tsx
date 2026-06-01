/**
 * Inventario de Telas (PRUEBA) — versión Supabase
 *
 * Reemplaza la versión original con localStorage por una que persiste
 * en Supabase. Mantiene la UI/UX que la jefa diseñó, pero:
 *   - Rollos en `inv_rollos`.
 *   - Movimientos en `inv_movimientos`.
 *   - Perfil empresa en `inv_empresa_perfil`.
 *   - Imágenes (logo/banner) en Storage bucket `inv-empresa-assets`.
 *   - Solo emails listados en `inv_permisos` pueden entrar (gate).
 *   - Solo rol `admin` puede editar metraje asignado (edición directa).
 */

import { useState } from 'react';
import {
  Building2,
  Database,
  History,
  Scissors,
  CheckCircle2,
  Loader2,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import CompanyProfilePanel from './components/CompanyProfilePanel';
import InventoryStats from './components/InventoryStats';
import AdjustStockModal from './components/AdjustStockModal';
import AddProductModal from './components/AddProductModal';
import HistoryLog from './components/HistoryLog';
import ProductTable from './components/ProductTable';
import { useInventarioSupabase, usePermisoInventario } from './useInventarioSupabase';
import type { InventoryItem, CompanyProfile } from './types';

export default function InventarioTelasPruebaPagina() {
  const permiso = usePermisoInventario();
  const data = useInventarioSupabase(permiso.empresaId);

  const [activeTab, setActiveTab] = useState<'inventario' | 'historial' | 'empresa'>('inventario');
  const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(true);
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDefaultMode, setAdjustDefaultMode] = useState<'DESCUENTO' | 'INCREMENTO' | undefined>(undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const triggerNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4500);
  };

  if (permiso.loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-neutral-300">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Verificando acceso…
      </div>
    );
  }

  if (!permiso.tieneAcceso) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-red-950/40 border border-red-900/50 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-white text-lg font-bold mb-2">Acceso restringido</h2>
          <p className="text-neutral-400 text-sm mb-4">
            Este módulo solo está disponible para vendedores y administradores autorizados.
            Si necesitas acceso, contactá a gerencia para que te agregue a la lista de permisos.
          </p>
          {permiso.email && (
            <p className="text-neutral-500 text-xs mb-6">
              Tu email: <span className="text-neutral-300">{permiso.email}</span>
            </p>
          )}
          <Link to="/" className="inline-block px-4 py-2 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-sm hover:bg-neutral-800">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (data.loading || !data.profile) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-neutral-300">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Cargando inventario…
      </div>
    );
  }

  const { items, profile, historyLogs } = data;
  const puedeEditarStock = permiso.rol === 'admin';

  const handleStockAdjustment = async (
    itemId: string,
    meters: number,
    actionType: 'DESCUENTO' | 'INCREMENTO',
    comment: string,
  ) => {
    try {
      await data.ajustarStock(itemId, meters, actionType, comment, permiso.email || 'desconocido');
      const item = items.find((i) => i.id === itemId);
      const verbo = actionType === 'DESCUENTO' ? 'descontaron' : 'añadieron';
      triggerNotification(`¡Stock modificado! Se ${verbo} ${meters} metros de "${item?.descripcion || ''}".`);
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleAddProduct = async (newProduct: Omit<InventoryItem, 'id'>) => {
    try {
      await data.agregarRollo(newProduct);
      triggerNotification(`Se añadió "${newProduct.descripcion}" al catálogo.`);
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const target = items.find((i) => i.id === itemId);
      await data.eliminarRollo(itemId);
      triggerNotification(`Se eliminó "${target?.descripcion || ''}".`, 'info');
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleSaveProfile = async (newProfile: CompanyProfile) => {
    try {
      await data.guardarPerfil(newProfile);
      triggerNotification('Perfil corporativo guardado.');
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleUploadImage = async (file: File, tipo: 'logo' | 'banner') => {
    const url = await data.subirImagen(file, tipo);
    const updated = { ...profile, [tipo === 'logo' ? 'logoUrl' : 'bannerUrl']: url };
    await data.guardarPerfil(updated);
    triggerNotification(`${tipo === 'logo' ? 'Logo' : 'Banner'} subido correctamente.`);
    return url;
  };

  const handleDeleteLog = async (logId: string) => {
    try {
      await data.borrarMovimiento(logId);
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleResetInventario = async () => {
    if (!puedeEditarStock) {
      triggerNotification('Solo administradores pueden reiniciar el inventario.', 'error');
      return;
    }
    if (!confirm('¿Reiniciar TODO el inventario? Cada rollo vuelve a su stock original (descarta todos los descuentos). Queda registro de cada cambio en el historial.')) return;
    try {
      await data.reiniciarInventario(permiso.email || 'desconocido');
      triggerNotification('Inventario reiniciado al stock original.', 'info');
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('¿Vaciar TODO el historial? No se puede deshacer.')) return;
    try {
      for (const log of historyLogs) {
        await data.borrarMovimiento(log.id);
      }
      triggerNotification('Historial vaciado.', 'info');
    } catch (e) {
      triggerNotification('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 antialiased font-sans pb-16">
      <header className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-neutral-800/70 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-650 flex items-center justify-center text-white shadow-lg border border-indigo-500/30">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-xl p-0.5 bg-neutral-900" referrerPolicy="no-referrer" />
                ) : (
                  <Scissors size={20} className="stroke-2" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base tracking-tight">{profile.razonSocial}</span>
                  <span className="text-[9px] font-mono font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-1.5 py-0.5 rounded-sm">
                    Inventario de Rollos
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 tracking-wide font-medium">
                  {profile.rut || 'RUT S/I'} · {permiso.email} ({permiso.rol})
                </p>
              </div>
            </div>

            <nav className="hidden md:flex space-x-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {([
                { id: 'inventario', label: 'Inventario', icon: Database },
                { id: 'historial', label: 'Historial', icon: History },
                { id: 'empresa', label: 'Empresa', icon: Building2 },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                    activeTab === t.id
                      ? 'bg-neutral-800 text-white border border-neutral-700/50 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </nav>

            <Link to="/" className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded-md border border-neutral-800 hover:border-neutral-700">
              ← Salir
            </Link>
          </div>
        </div>
      </header>

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
            onSave={handleSaveProfile}
            onReset={() => { /* sin reset: persistente */ }}
            isExpanded={isProfileExpanded}
            setIsExpanded={setIsProfileExpanded}
            onUploadImage={handleUploadImage}
          />
        )}

        {activeTab === 'inventario' && (
          <div className="space-y-4">
            <InventoryStats items={items} />
            <ProductTable
              items={items}
              onSelectAdjustItem={(item) => { setAdjustDefaultMode('DESCUENTO'); setSelectedAdjustItem(item); }}
              onSelectIncrementItem={(item) => { setAdjustDefaultMode('INCREMENTO'); setSelectedAdjustItem(item); }}
              onDeleteItem={handleDeleteItem}
              onAddNew={() => setIsAddModalOpen(true)}
              onReset={handleResetInventario}
              onExportCSV={() => exportCSV(items)}
              puedeEditarStock={puedeEditarStock}
            />
          </div>
        )}

        {activeTab === 'historial' && (
          <HistoryLog
            logs={historyLogs}
            onClearLogs={handleClearLogs}
            onDeleteLogItem={handleDeleteLog}
          />
        )}
      </main>
      <AdjustStockModal
        item={selectedAdjustItem}
        isOpen={!!selectedAdjustItem}
        defaultActionType={adjustDefaultMode}
        onClose={() => { setSelectedAdjustItem(null); setAdjustDefaultMode(undefined); }}
        onSubmitAdjustment={(itemId, meters, type, comment) => {
          handleStockAdjustment(itemId, meters, type, comment);
          setSelectedAdjustItem(null);
          setAdjustDefaultMode(undefined);
        }}
      />

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={(p) => { handleAddProduct(p); setIsAddModalOpen(false); }}
      />
    </div>
  );
}

function exportCSV(items: InventoryItem[]) {
  let csv = '\ufeffCOD;Producto;COD_INT;Tipo;Descripcion;Tela Verticales;Descuento;Rollos;Metros Ind;Total Metros;Comentario\r\n';
  items.forEach((it) => {
    csv += [it.cod, it.producto, it.cod_int, it.tipo, it.descripcion, it.telaVerticales, it.descuento, it.rollos, it.metros, it.totalMetros, it.comentario]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';') + '\r\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Inventario_Rolzzo_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
