/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { Search, ArrowUpDown, AlertCircle, Download, Plus, RefreshCw, Trash2 } from 'lucide-react';

interface ProductTableProps {
  items: InventoryItem[];
  onSelectAdjustItem: (item: InventoryItem) => void;
  onAddNewProductClick: () => void;
  onDeleteItem: (itemId: string) => void;
  onResetToDefault: () => void;
  onExportCSV: () => void;
}

type SortField = 'descripcion' | 'cod' | 'totalMetros' | 'rollos' | 'descuento' | 'cod_int' | 'producto';
type SortOrder = 'asc' | 'desc';

export default function ProductTable({
  items,
  onSelectAdjustItem,
  onAddNewProductClick,
  onDeleteItem,
  onResetToDefault,
  onExportCSV
}: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [verticalFilter, setVerticalFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<string>('ALL'); // ALL, IN_STOCK, LOW_STOCK
  
  const [sortField, setSortField] = useState<SortField>('cod');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Available unique custom CATEGORIES from actual stock items
  const uniqueCategories = useMemo(() => {
    const setOfCods = new Set(items.map(i => i.cod));
    return Array.from(setOfCods);
  }, [items]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort items dynamically
  const processedItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search term matching
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          item.producto.toLowerCase().includes(term) ||
          item.descripcion.toLowerCase().includes(term) ||
          item.cod_int.toLowerCase().includes(term) ||
          item.cod.toLowerCase().includes(term);

        // Category filter
        const matchesCategory = categoryFilter === 'ALL' || item.cod === categoryFilter;

        // Vertical blind filter
        const matchesVertical = 
          verticalFilter === 'ALL' || 
          item.telaVerticales === verticalFilter;

        // Stock status filter
        let matchesStock = true;
        if (stockFilter === 'LOW_STOCK') {
          matchesStock = item.totalMetros === 0 || item.comentario.includes("LIMIT");
        } else if (stockFilter === 'IN_STOCK') {
          matchesStock = item.totalMetros > 0 && !item.comentario.includes("LIMIT");
        }

        return matchesSearch && matchesCategory && matchesVertical && matchesStock;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Format numerical comparisons
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        // String comparison
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [items, searchTerm, categoryFilter, verticalFilter, stockFilter, sortField, sortOrder]);

  return (
    <div id="product-table-wrapper" className="space-y-4">
      
      {/* Search and Filters Hub */}
      <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/85 shadow-md space-y-4">
        
        {/* Search, Action bar */}
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
            
            {/* Export CVS */}
            <button
              onClick={onExportCSV}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-800/80 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Descargar listado actual como archivo compatible con Excel (CSV)"
            >
              <Download size={14} />
              Exportar Excel
            </button>

            {/* Restar inventory default sheet */}
            <button
              onClick={onResetToDefault}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs rounded-xl border border-neutral-800/80 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Restablecer base de datos a los valores originales del PDF"
            >
              <RefreshCw size={12} />
              Reiniciar Inventario
            </button>

            {/* Add new stock item */}
            <button
              id="btn-add-item-trigger"
              onClick={onAddNewProductClick}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-500/20"
            >
              <Plus size={14} />
              Nuevo Item
            </button>

          </div>

        </div>

        {/* Filter Badges Bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 pt-1 border-t border-neutral-800/60 text-xs">
          
          {/* Categories select */}
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
              Cualquiera ({items.length})
            </button>
            {uniqueCategories.map(cat => {
              const count = items.filter(i => i.cod === cat).length;
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
          
          {/* Vertical Blinds filter slider */}
          <div className="flex items-center gap-3">
            <span className="text-neutral-450 font-bold uppercase tracking-wider text-[10px] shrink-0">Tela Cortinas Verticales:</span>
            <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg w-full max-w-xs border border-neutral-800">
              <button
                onClick={() => setVerticalFilter('ALL')}
                className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  verticalFilter === 'ALL' ? 'bg-neutral-800 text-white border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setVerticalFilter('SI')}
                className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  verticalFilter === 'SI' ? 'bg-neutral-800 text-white border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                Sí (SI)
              </button>
              <button
                onClick={() => setVerticalFilter('NO')}
                className={`py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                  verticalFilter === 'NO' ? 'bg-neutral-800 text-white border border-neutral-700/40 shadow-xs' : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Stock range filter */}
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

      {/* Product Grid / Table results count */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-neutral-400 font-medium">
          Mostrando <strong>{processedItems.length}</strong> de {items.length} productos
        </span>
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')} 
            className="text-[11px] font-semibold text-indigo-400 hover:underline cursor-pointer"
          >
            Limpiar Filtro de Búsqueda
          </button>
        )}
      </div>

      {/* Main Table view */}
      <div className="bg-[#121212] rounded-2xl border border-neutral-800/80 shadow-md overflow-hidden animate-fade-in">
        <div className="overflow-x-auto">
          {processedItems.length === 0 ? (
            <div className="p-16 text-center text-neutral-500 space-y-3">
              <AlertCircle size={40} className="mx-auto text-neutral-600 stroke-1" />
              <p className="text-xs font-semibold text-neutral-300">Ningún producto coincide con los filtros especificados</p>
              <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">Prueba redactando otra descripción o seleccionando "Cualquiera" arriba.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-[#181818] border-b border-neutral-800 text-[10px] text-neutral-450 font-bold uppercase tracking-wider select-none">
                  <th 
                    onClick={() => handleSort('cod')} 
                    className="py-3 px-4 cursor-pointer hover:bg-neutral-850 transition-colors w-28 group"
                  >
                    <div className="flex items-center gap-1.5">
                      COD
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('producto')}
                    className="py-3 px-4 cursor-pointer hover:bg-neutral-850 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      Producto
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('cod_int')}
                    className="py-3 px-4 cursor-pointer hover:bg-neutral-850 transition-colors group w-24"
                  >
                    <div className="flex items-center gap-1.5">
                      COD_INT
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('descripcion')}
                    className="py-3 px-4 cursor-pointer hover:bg-neutral-850 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      Descripción (Color / Textura)
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center w-24">Cortinas Verticales</th>
                  <th 
                    onClick={() => handleSort('descuento')}
                    className="py-3 px-4 cursor-pointer text-center hover:bg-neutral-850 transition-colors group w-20"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Descuento
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('rollos')}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-neutral-850 transition-colors group w-20"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Rollos / Unids
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('totalMetros')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-neutral-850 transition-colors group w-36"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Métrica Total
                      <ArrowUpDown size={11} className="text-neutral-500 opacity-60 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center w-36 text-neutral-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-xs">
                {processedItems.map((item) => {
                  const isAgotado = item.totalMetros === 0;
                  const isLimited = item.comentario.toUpperCase().includes('LIMIT');
                  
                  // Calculate raw percentage bar based on original roll metrics
                  const maxMeters = Math.max(item.rollos * item.metros, 30);
                  const stockPercent = maxMeters > 0 ? Math.min(100, Math.round((item.totalMetros / maxMeters) * 100)) : 0;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-neutral-900/50 transition-all ${
                        isAgotado ? 'bg-neutral-950/40 opacity-80' : ''
                      }`}
                    >
                      {/* Code category pill */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] font-bold text-neutral-300 bg-neutral-950 px-2 py-1 rounded-sm border border-neutral-800/60 block w-fit">
                          {item.cod}
                        </span>
                      </td>

                      {/* Commercial product title */}
                      <td className="py-3 px-4 font-semibold text-neutral-200">
                        <div>
                          <span>{item.producto}</span>
                          {item.tipo && item.tipo !== '-' && (
                            <span className="text-[9px] text-indigo-300 font-bold ml-1 bg-indigo-950/60 px-1 border border-indigo-900/30 rounded-xs uppercase">
                              {item.tipo}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Internal alphanumeric code */}
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        {item.cod_int === '-' ? (
                          <span className="text-neutral-700">-</span>
                        ) : (
                          item.cod_int
                        )}
                      </td>

                      {/* Description / Color */}
                      <td className="py-3 px-4">
                        <div>
                          <span className="font-bold text-white tracking-tight uppercase">{item.descripcion}</span>
                          {isLimited && (
                            <span className="ml-1 text-[8px] font-extrabold px-1.5 py-0.5 rounded-sm bg-rose-950/70 text-rose-400 border border-rose-900/40 animate-pulse">
                              STOCK LIMITADO
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Vertical Blinds SI / NO compatibility */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                          item.telaVerticales === 'SI' 
                            ? 'bg-teal-950/70 text-teal-300 border border-teal-900/30 font-bold' 
                            : 'bg-neutral-900 text-neutral-500 font-normal border border-neutral-850'
                        }`}>
                          {item.telaVerticales}
                        </span>
                      </td>

                      {/* Discount Label */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-900/35 px-1.5 py-0.5 rounded text-[10px]">
                          {item.descuento}
                        </span>
                      </td>

                      {/* Rolls Count */}
                      <td className="py-3 px-4 text-center font-mono font-medium text-neutral-400">
                        {item.rollos}
                      </td>

                      {/* Dynamic meters progress calculation */}
                      <td className="py-3 px-4">
                        <div className="text-right space-y-1">
                          
                          {/* Stock numerical indicator */}
                          <div className="flex justify-end items-baseline gap-1">
                            <span className={`font-mono font-extrabold text-xs ${
                              isAgotado ? 'text-rose-500 line-through' : 'text-white'
                            }`}>
                              {item.totalMetros.toLocaleString('es-CL')}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-medium"> / {maxMeters}m</span>
                          </div>

                          {/* Level Bar */}
                          <div className="w-full h-1.5 bg-neutral-950 border border-neutral-900 rounded-full overflow-hidden ml-auto max-w-[120px]">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                isAgotado ? 'bg-neutral-700' : 
                                stockPercent < 25 ? 'bg-rose-500' :
                                stockPercent < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${stockPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Core transaction CTAs */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Main discount/adjustment action */}
                          <button
                            onClick={() => onSelectAdjustItem(item)}
                            className="bg-indigo-600 hover:bg-indigo-505 hover:bg-indigo-500 text-white px-3 py-1 text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 border border-indigo-500/20"
                          >
                            Descontar
                          </button>

                          {/* Delete Item icon */}
                          <button
                            onClick={() => {
                              if (confirm(`¿Estás seguro de eliminar "${item.descripcion}" del catálogo? esta accion no borrará su historial anterior.`)) {
                                onDeleteItem(item.id);
                              }
                            }}
                            className="text-neutral-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
                            title="Eliminar este ítem definitivamente de la lista"
                          >
                            <Trash2 size={13} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
