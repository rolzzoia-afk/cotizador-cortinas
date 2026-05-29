/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { InventoryItem, CompanyProfile, DiscountHistoryEntry } from './types';
import { INITIAL_INVENTORY_ITEMS, DEFAULT_COMPANY_PROFILE } from './data/initialInventory';
import CompanyProfilePanel from './components/CompanyProfilePanel';
import InventoryStats from './components/InventoryStats';
import AdjustStockModal from './components/AdjustStockModal';
import AddProductModal from './components/AddProductModal';
import HistoryLog from './components/HistoryLog';
import ProductTable from './components/ProductTable';

import { 
  Building2, 
  Database, 
  History, 
  Scissors, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Instagram, 
  Globe 
} from 'lucide-react';

export default function InventarioTelasPruebaPagina() {
  // --- States ---
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_COMPANY_PROFILE);
  const [historyLogs, setHistoryLogs] = useState<DiscountHistoryEntry[]>([]);
  
  // Navigation
  const [activeTab, setActiveTab] = useState<'inventario' | 'historial' | 'empresa'>('inventario');
  const [isProfileExpanded, setIsProfileExpanded] = useState<boolean>(true);

  // Modals / Selected items for adjustment
  const [selectedAdjustItem, setSelectedAdjustItem] = useState<InventoryItem | null>(null);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Contextual success notice state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // --- Initialize state from LocalStorage or Data Defaults ---
  useEffect(() => {
    try {
      const storedItems = localStorage.getItem('inv_telas_prueba_items');
      if (storedItems) {
        setItems(JSON.parse(storedItems));
      } else {
        setItems(INITIAL_INVENTORY_ITEMS);
        localStorage.setItem('inv_telas_prueba_items', JSON.stringify(INITIAL_INVENTORY_ITEMS));
      }

      const storedProfile = localStorage.getItem('inv_telas_prueba_profile');
      if (storedProfile) {
        setProfile(JSON.parse(storedProfile));
      } else {
        setProfile(DEFAULT_COMPANY_PROFILE);
        localStorage.setItem('inv_telas_prueba_profile', JSON.stringify(DEFAULT_COMPANY_PROFILE));
      }

      const storedHistory = localStorage.getItem('inv_telas_prueba_history');
      if (storedHistory) {
        setHistoryLogs(JSON.parse(storedHistory));
      } else {
        setHistoryLogs([]);
      }
    } catch (e) {
      console.error("No se pudo cargar datos de localStorage, usando fallback estático:", e);
      setItems(INITIAL_INVENTORY_ITEMS);
      setProfile(DEFAULT_COMPANY_PROFILE);
    }
  }, []);

  // --- Auto-saver side effects on state changes ---
  const saveItemsToStorage = (updatedItems: InventoryItem[]) => {
    setItems(updatedItems);
    localStorage.setItem('inv_telas_prueba_items', JSON.stringify(updatedItems));
  };

  const saveProfileToStorage = (updatedProfile: CompanyProfile) => {
    setProfile(updatedProfile);
    localStorage.setItem('inv_telas_prueba_profile', JSON.stringify(updatedProfile));
  };

  const saveHistoryToStorage = (updatedHistory: DiscountHistoryEntry[]) => {
    setHistoryLogs(updatedHistory);
    localStorage.setItem('inv_telas_prueba_history', JSON.stringify(updatedHistory));
  };

  // Show a disappearing status card
  const triggerNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // --- Core inventory decrement & increment logic ---
  const handleStockAdjustment = (
    itemId: string,
    meters: number,
    actionType: 'DESCUENTO' | 'INCREMENTO',
    comment: string
  ) => {
    const updated = items.map((item) => {
      if (item.id === itemId) {
        const previousMeters = item.totalMetros;
        let newMeters = previousMeters;

        if (actionType === 'DESCUENTO') {
          newMeters = Math.max(0, previousMeters - meters);
        } else {
          newMeters = previousMeters + meters;
        }

        // Create transaction log item code block
        const transactionId = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newLog: DiscountHistoryEntry = {
          id: transactionId,
          itemId: item.id,
          producto: item.producto,
          cod_int: item.cod_int,
          descripcion: item.descripcion,
          cantidadMetros: meters,
          anteriorMetros: previousMeters,
          nuevoMetros: parseFloat(newMeters.toFixed(2)),
          tipoAccion: actionType,
          fecha: new Date().toISOString(),
          comentario: comment
        };
        
        // Dynamic stock warnings
        const actionLabel = actionType === 'DESCUENTO' ? 'descontaron' : 'añadieron';
        triggerNotification(
          `¡Stock modificado con éxito! Se ${actionLabel} ${meters} metros de "${item.descripcion}".`
        );

        // Prepend transaction log safely
        saveHistoryToStorage([newLog, ...historyLogs]);

        // Adjust rolls estimate inside items lists block
        // Each roll is 30m / 50m typically. Let's mathematically recalculate rollos left
        let calculatedRollos = item.rollos;
        if (item.metros > 0) {
          calculatedRollos = Math.ceil(newMeters / item.metros);
        }

        return {
          ...item,
          totalMetros: parseFloat(newMeters.toFixed(2)),
          rollos: calculatedRollos,
          comentario: newMeters === 0 ? 'STOCK LIMITADO' : item.comentario
        };
      }
      return item;
    });

    saveItemsToStorage(updated);
  };

  // --- Add entirely custom product ---
  const handleAddProduct = (newProduct: Omit<InventoryItem, 'id'>) => {
    const freshId = `custom-item-${Date.now()}`;
    const freshItem: InventoryItem = {
      id: freshId,
      ...newProduct
    };

    const finalItems = [...items, freshItem];
    saveItemsToStorage(finalItems);
    triggerNotification(`Se añadió el producto "${freshItem.descripcion}" al catálogo de Cortinas Rolzzo.`);
  };

  // --- Delete product by ID ---
  const handleDeleteItem = (itemId: string) => {
    const targetItem = items.find(item => item.id === itemId);
    const finalItems = items.filter(item => item.id !== itemId);
    saveItemsToStorage(finalItems);
    if (targetItem) {
      triggerNotification(`Se eliminó "${targetItem.descripcion}" de la lista de existencias.`, 'info');
    }
  };

  // --- Reset to default original PDF inventory sheet ---
  const handleResetToDefault = () => {
    if (confirm("¿Estás seguro de reiniciar todo el inventario? Esto descartará tus descuentos de metrajes y restablecerá los valores del PDF original.")) {
      saveItemsToStorage(INITIAL_INVENTORY_ITEMS);
      saveProfileToStorage(DEFAULT_COMPANY_PROFILE);
      saveHistoryToStorage([]);
      triggerNotification("Se han reinstaurado con éxito los valores iniciales de Cortinas Rolzzo y limpiado el historial.", "info");
    }
  };

  // --- Reset corporate profile to Rolzzo Standard ---
  const handleResetProfile = () => {
    if (confirm("¿Restablecer datos de la empresa a los valores de Cortinas Rolzzo SpA?")) {
      saveProfileToStorage(DEFAULT_COMPANY_PROFILE);
      triggerNotification("Se restauró el perfil corporativo de Cortinas Rolzzo SpA.", "info");
    }
  };

  // --- Audit Logs deletion ---
  const handleClearLogs = () => {
    if (confirm("¿Seguro de vaciar el historial de movimientos? Esta acción es irreversible.")) {
      saveHistoryToStorage([]);
      triggerNotification("Se vació el historial de auditoría.", "info");
    }
  };

  const handleDeleteLogItem = (logId: string) => {
    const finalLogs = historyLogs.filter(log => log.id !== logId);
    saveHistoryToStorage(finalLogs);
  };

  // --- Export Excel Compatibility tool ---
  const handleExportCSV = () => {
    try {
      // Create BOM for UTF-8 compatibility in Excel
      let csvContent = "\uFEFF";
      csvContent += "COD;Producto;COD_INT;Tipo;Descripcion;Tela Cortinas Verticales;Descuento;Rollos;Metros Individuales;Total Metros;Comentario\r\n";
      
      items.forEach((item) => {
        const row = [
          item.cod,
          item.producto,
          item.cod_int,
          item.tipo,
          item.descripcion,
          item.telaVerticales,
          item.descuento,
          item.rollos,
          item.metros,
          item.totalMetros,
          item.comentario
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(";");
        
        csvContent += row + "\r\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Inventario_Cortinas_Rolzzo_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      triggerNotification("Se descargó el inventario como archivo CSV (Separado por punto y coma para Excel).");
    } catch (e) {
      console.error("Fallo al exportar planilla:", e);
      alert("Hubo un error al generar el archivo de planilla.");
    }
  };

  // --- Triggers for Modals ---
  const handleOpenAdjustModal = (item: InventoryItem) => {
    setSelectedAdjustItem(item);
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200 antialiased font-sans pb-16">
      
      {/* 1. Header Brandeable de la Aplicación */}
      <header className="sticky top-0 z-40 bg-[#121212]/90 backdrop-blur-md border-b border-neutral-800/70 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Left Corporate Brand block */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-650 flex items-center justify-center text-white shadow-lg border border-indigo-500/30">
                {profile.logoUrl ? (
                  <img 
                    src={profile.logoUrl} 
                    alt="Logo Rolzzo" 
                    className="w-full h-full object-contain rounded-xl p-0.5 bg-neutral-900"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Scissors size={20} className="stroke-2" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base tracking-tight font-sans">
                    {profile.razonSocial}
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-900/40 px-1.5 py-0.5 rounded-sm">
                    Inventario de Rollos
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 tracking-wide font-medium">{profile.rut || 'RUT S/I'} · {profile.direccion ? 'Fábrica Activa' : 'Sin dirección'}</p>
              </div>
            </div>

            {/* Middle Nav Tabs (Quick Toggle Mode) */}
            <nav className="hidden md:flex space-x-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setActiveTab('inventario')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'inventario'
                    ? 'bg-neutral-800 text-white border border-neutral-700/50 shadow-sm'
                    : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                <Database size={13} />
                Control de Inventario
              </button>
              
              <button
                onClick={() => setActiveTab('historial')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'historial'
                    ? 'bg-neutral-800 text-white border border-neutral-700/50 shadow-sm'
                    : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                <History size={13} />
                Historial de Metrajes ({historyLogs.length})
              </button>

              <button
                onClick={() => setActiveTab('empresa')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'empresa'
                    ? 'bg-[#1e1e1e] text-white border border-neutral-700/50 shadow-sm'
                    : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                <Building2 size={13} />
                Perfil Empresa
              </button>
            </nav>

            {/* Right Contact details fallback bar */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <a 
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-1 text-neutral-400 hover:text-indigo-400 transition-colors"
              >
                <Instagram size={13} />
                {profile.instagram}
              </a>
              <span className="hidden lg:inline text-neutral-800">|</span>
              <a 
                href={profile.paginaWeb.startsWith('http') ? profile.paginaWeb : `https://${profile.paginaWeb}`}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-1 text-neutral-400 hover:text-indigo-400 transition-colors"
                title="Página web comercial"
              >
                <Globe size={13} />
                Web
              </a>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile Tab Navigator (Only shown on small viewports) */}
      <div className="md:hidden bg-neutral-900 border-b border-neutral-800 sticky top-16 z-30 p-2 flex gap-1">
        <button
          onClick={() => setActiveTab('inventario')}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
            activeTab === 'inventario' ? 'bg-indigo-950 text-indigo-300 border border-indigo-920 font-extrabold' : 'text-neutral-400'
          }`}
        >
          Inventario
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
            activeTab === 'historial' ? 'bg-indigo-950 text-indigo-300 border border-indigo-920 font-extrabold' : 'text-neutral-400'
          }`}
        >
          Historial ({historyLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('empresa')}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
            activeTab === 'empresa' ? 'bg-indigo-950 text-indigo-300 border border-indigo-920 font-extrabold' : 'text-neutral-400'
          }`}
        >
          Perfil
        </button>
      </div>

      {/* Main Container Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        
        {/* Disappearing status Toast */}
        {notification && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-medium shadow-lg transition-all duration-300 animate-bounce ${
            notification.type === 'success' 
              ? 'bg-[#121c17] border-emerald-550/30 text-emerald-300 shadow-emerald-900/10' 
              : 'bg-indigo-950/80 border-indigo-900/50 text-indigo-300 shadow-indigo-900/10'
          }`}>
            <CheckCircle2 size={16} className={notification.type === 'success' ? 'text-emerald-400' : 'text-indigo-400'} />
            <p className="flex-1">{notification.message}</p>
            <button 
              onClick={() => setNotification(null)}
              className="text-[10px] hover:underline font-bold uppercase opacity-80 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Collapsible Company Card at top (shows Logo, RUT, Banner) */}
        {activeTab === 'inventario' && (
          <div className="bg-[#121212] rounded-2xl border border-neutral-800/80 shadow-md overflow-hidden">
            <button
              onClick={() => setIsProfileExpanded(!isProfileExpanded)}
              className="w-full px-5 py-3.5 bg-neutral-900 hover:bg-neutral-850 flex items-center justify-between transition-colors border-b border-neutral-850 cursor-pointer"
            >
              <div className="flex items-center gap-2 text-left">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-550 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Panel de la Empresa & Branding de Cortinas Rolzzo
                </span>
                <span className="hidden sm:inline-block text-[10px] text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded-full border border-neutral-800/60">
                  Configurado para logo y listado PDF
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-350">
                <span className="text-[10px] font-medium">{isProfileExpanded ? 'Ocultar Cabezal' : 'Ver Cabezal'}</span>
                {isProfileExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {isProfileExpanded && (
              <div className="p-4 bg-neutral-950/20">
                <CompanyProfilePanel 
                  profile={profile} 
                  onUpdateProfile={(updated) => {
                    saveProfileToStorage(updated);
                    triggerNotification("Información comercial actualizada con éxito.");
                  }} 
                  onReset={handleResetProfile}
                />
              </div>
            )}
          </div>
        )}

        {/* Dynamic Navigation rendering */}
        {activeTab === 'inventario' && (
          <div className="space-y-6">
            
            {/* Quick calculations stats bar */}
            <InventoryStats items={items} />

            {/* Primary Inventory catalog table management */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Scissors size={18} className="text-indigo-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white border-transparent">
                  Catálogo Digital & Descuento de Metraje
                </h2>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Haz clic en el botón <strong>"Descontar"</strong> de cualquier fila para registrar mermas o ventas. Los rollos totales se recalculan automáticamente basándose en los metros disponibles.
              </p>
              
              <ProductTable 
                items={items}
                onSelectAdjustItem={handleOpenAdjustModal}
                onAddNewProductClick={() => setIsAddModalOpen(true)}
                onDeleteItem={handleDeleteItem}
                onResetToDefault={handleResetToDefault}
                onExportCSV={handleExportCSV}
              />
            </div>

          </div>
        )}

        {activeTab === 'historial' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <History size={18} className="text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Historial de Movimientos de telas
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              A continuación se listan todas las acciones de reducción y reabastecimiento realizadas durante la sesión laboral.
            </p>
            <HistoryLog 
            logs={historyLogs}
            onClearLogs={handleClearLogs}
            onDeleteLogItem={handleDeleteLogItem}
            />
          </div>
        )}

        {activeTab === 'empresa' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-indigo-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Información Corporativa de Cortinas Rolzzo
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Personaliza el nombre de la empresa, RUT principal de facturación, perfil de Instagram comercial, link del sitio web y bodegas centralizadas. Puedes cargar imágenes corporativas en formato JPG, PNG o vectores SVG.
            </p>
            <CompanyProfilePanel 
              profile={profile} 
              onUpdateProfile={(updated) => {
                saveProfileToStorage(updated);
                triggerNotification("Información comercial de Cortinas Rolzzo grabada con éxito.");
                setActiveTab('inventario');
              }} 
              onReset={handleResetProfile}
            />
          </div>
        )}

      </main>

      {/* --- Overlay Modals --- */}
      
      {/* 1. Pop up to discount or add stock */}
      <AdjustStockModal 
        item={selectedAdjustItem}
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setSelectedAdjustItem(null);
        }}
        onSubmitAdjustment={handleStockAdjustment}
      />

      {/* 2. Pop up to insert custom element */}
      <AddProductModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddProduct={handleAddProduct}
      />

    </div>
  );
}
