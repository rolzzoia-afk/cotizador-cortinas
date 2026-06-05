// Zona superior de la tabla de productos: search bar + acciones globales
// (export CSV, reiniciar inventario, nuevo item) + chips de categoría +
// filtros secundarios (verticales SI/NO, stock disponible/agotado).
//
// Componente "tonto": solo renderiza y emite callbacks. No tiene estado
// propio — todo lo controla el padre (ProductTable).

import { Search, Download, Plus, RefreshCw } from 'lucide-react';

export type VerticalFilter = 'ALL' | 'SI' | 'NO';
export type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK';

interface TableFiltersProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  categoryFilter: string;
  setCategoryFilter: (s: string) => void;
  verticalFilter: VerticalFilter;
  setVerticalFilter: (s: VerticalFilter) => void;
  stockFilter: StockFilter;
  setStockFilter: (s: StockFilter) => void;
  uniqueCategories: string[];
  totalItems: number;
  itemsByCategoryCount: Record<string, number>;
  onAddNew: () => void;
  onReset: () => void;
  onExportCSV: () => void;
}

export default function TableFilters({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
  verticalFilter,
  setVerticalFilter,
  stockFilter,
  setStockFilter,
  uniqueCategories,
  totalItems,
  itemsByCategoryCount,
  onAddNew,
  onReset,
  onExportCSV,
}: TableFiltersProps) {
  return (
    <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/85 shadow-md space-y-4">
      {/* Search + actions row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por color, código, descripción o categoría (ej: Rústico TOSTADO, SC 10)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs outline-none focus:bg-neutral-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-white placeholder-neutral-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onExportCSV}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-800/80 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Descargar listado actual como archivo compatible con Excel (CSV)"
          >
            <Download size={14} />
            Exportar Excel
          </button>

          <button
            onClick={onReset}
            className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-800/80 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Restablecer base de datos a los valores originales del PDF"
          >
            <RefreshCw size={12} />
            Reiniciar Inventario
          </button>

          <button
            id="btn-add-item-trigger"
            onClick={onAddNew}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-500/20"
          >
            <Plus size={14} />
            Nuevo Item
          </button>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 pt-1 border-t border-neutral-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-450 font-bold uppercase tracking-wider text-[10px]">Categoría:</span>
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
              categoryFilter === 'ALL'
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-neutral-900 text-neutral-350 border-neutral-800 hover:bg-neutral-800'
            }`}
          >
            Cualquiera ({totalItems})
          </button>
          {uniqueCategories.map((cat) => {
            const count = itemsByCategoryCount[cat] || 0;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-all border ${
                  categoryFilter === cat
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-neutral-900 text-neutral-350 border-neutral-800 hover:bg-neutral-800'
                }`}
              >
                {cat.replace('_P', '').replace('_D', '')} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Secondary filters row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
        {/* Verticales filter */}
        <div className="flex items-center gap-3">
          <span className="text-neutral-450 font-bold uppercase tracking-wider text-[10px] shrink-0">Tela Cortinas Verticales:</span>
          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg w-full max-w-xs border border-neutral-800">
            {(['ALL', 'SI', 'NO'] as VerticalFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setVerticalFilter(v)}
                className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  verticalFilter === v ? 'bg-neutral-800 text-white border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                {v === 'ALL' ? 'Todos' : v === 'SI' ? 'Sí (SI)' : 'No'}
              </button>
            ))}
          </div>
        </div>

        {/* Stock filter */}
        <div className="flex items-center gap-3 md:justify-end">
          <span className="text-neutral-450 font-bold uppercase tracking-wider text-[10px] shrink-0">Filtro de Existencias:</span>
          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg w-full max-w-xs border border-neutral-800">
            <button
              onClick={() => setStockFilter('ALL')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                stockFilter === 'ALL' ? 'bg-neutral-800 text-white border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-neutral-200'
              }`}
            >
              Cualquiera
            </button>
            <button
              onClick={() => setStockFilter('IN_STOCK')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                stockFilter === 'IN_STOCK' ? 'bg-neutral-805 text-emerald-400 border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-emerald-400'
              }`}
            >
              Con Stock
            </button>
            <button
              onClick={() => setStockFilter('LOW_STOCK')}
              className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                stockFilter === 'LOW_STOCK' ? 'bg-neutral-805 text-rose-400 border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-rose-405'
              }`}
            >
              Agotado / Crítico
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
