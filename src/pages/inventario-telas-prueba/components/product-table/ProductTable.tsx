// Orquestador de la tabla de productos.
//
// Maneja el estado local de filtros/sort y la lista derivada de items
// visibles. Delega la presentación a 3 componentes hijos:
//   - TableFilters  (search + acciones globales + chips)
//   - ProductRow    (cada fila de la tabla)
//   - StockBar      (barra de progreso dentro de cada fila — viene a través de ProductRow)

import { useState, useMemo } from 'react';
import { ArrowUpDown, AlertCircle } from 'lucide-react';
import type { InventoryItem } from '../../types';
import TableFilters, { type StockFilter, type VerticalFilter } from './TableFilters';
import ProductRow from './ProductRow';

interface ProductTableProps {
  items: InventoryItem[];
  onSelectAdjustItem: (item: InventoryItem) => void;
  onSelectIncrementItem?: (item: InventoryItem) => void;
  onAddNew?: () => void;
  onReset?: () => void;
  onSelectEditItem?: (item: InventoryItem) => void;
  puedeEditarStock?: boolean;
  onAddNewProductClick?: () => void;
  onResetToDefault?: () => void;
  onDeleteItem: (itemId: string) => void;
  onExportCSV: () => void;
}

type SortField = 'descripcion' | 'cod' | 'totalMetros' | 'rollos' | 'descuento' | 'cod_int' | 'producto';
type SortOrder = 'asc' | 'desc';

export default function ProductTable({
  items,
  onSelectAdjustItem,
  onSelectIncrementItem,
  onAddNew,
  onReset,
  onSelectEditItem,
  puedeEditarStock = false,
  onAddNewProductClick,
  onResetToDefault,
  onDeleteItem,
  onExportCSV,
}: ProductTableProps) {
  const handleAddNew = onAddNew || onAddNewProductClick || (() => {});
  const handleReset = onReset || onResetToDefault || (() => {});

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [verticalFilter, setVerticalFilter] = useState<VerticalFilter>('ALL');
  const [stockFilter, setStockFilter] = useState<StockFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('cod');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const uniqueCategories = useMemo(() => {
    const setOfCods = new Set(items.map((i) => i.cod));
    return Array.from(setOfCods);
  }, [items]);

  const itemsByCategoryCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) map[i.cod] = (map[i.cod] || 0) + 1;
    return map;
  }, [items]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const processedItems = useMemo(() => {
    return items
      .filter((item) => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          item.producto.toLowerCase().includes(term) ||
          item.descripcion.toLowerCase().includes(term) ||
          item.cod_int.toLowerCase().includes(term) ||
          item.cod.toLowerCase().includes(term);
        const matchesCategory = categoryFilter === 'ALL' || item.cod === categoryFilter;
        const matchesVertical = verticalFilter === 'ALL' || item.telaVerticales === verticalFilter;
        let matchesStock = true;
        if (stockFilter === 'LOW_STOCK') {
          matchesStock = item.totalMetros === 0 || item.comentario.includes('LIMIT');
        } else if (stockFilter === 'IN_STOCK') {
          matchesStock = item.totalMetros > 0 && !item.comentario.includes('LIMIT');
        }
        return matchesSearch && matchesCategory && matchesVertical && matchesStock;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [items, searchTerm, categoryFilter, verticalFilter, stockFilter, sortField, sortOrder]);

  return (
    <div id="product-table-wrapper" className="space-y-4">
      <TableFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        verticalFilter={verticalFilter}
        setVerticalFilter={setVerticalFilter}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        uniqueCategories={uniqueCategories}
        totalItems={items.length}
        itemsByCategoryCount={itemsByCategoryCount}
        onAddNew={handleAddNew}
        onReset={handleReset}
        onExportCSV={onExportCSV}
      />

      {/* Result count + clear search */}
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

      {/* Main table */}
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
                  <SortableTh field="cod" current={sortField} onSort={handleSort} className="w-28">COD</SortableTh>
                  <SortableTh field="producto" current={sortField} onSort={handleSort}>Producto</SortableTh>
                  <SortableTh field="cod_int" current={sortField} onSort={handleSort} className="w-24">COD_INT</SortableTh>
                  <SortableTh field="descripcion" current={sortField} onSort={handleSort}>Descripción (Color / Textura)</SortableTh>
                  <th className="py-3 px-4 text-center w-24">Cortinas Verticales</th>
                  <SortableTh field="descuento" current={sortField} onSort={handleSort} center className="w-20">Descuento</SortableTh>
                  <SortableTh field="rollos" current={sortField} onSort={handleSort} center className="w-20">Rollos / Unids</SortableTh>
                  <SortableTh field="totalMetros" current={sortField} onSort={handleSort} className="text-right w-36">Métrica Total</SortableTh>
                  <th className="py-3 px-4 text-center w-36 text-neutral-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900 text-xs">
                {processedItems.map((item) => (
                  <ProductRow
                    key={item.id}
                    item={item}
                    puedeEditarStock={puedeEditarStock}
                    onSelectAdjustItem={onSelectAdjustItem}
                    onSelectIncrementItem={onSelectIncrementItem}
                    onSelectEditItem={onSelectEditItem}
                    onDeleteItem={onDeleteItem}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper interno: encabezado de columna ordenable. No vale la pena
// mover esto a un archivo propio porque solo se usa acá.
function SortableTh({
  field,
  current,
  onSort,
  children,
  className = '',
  center = false,
}: {
  field: SortField;
  current: SortField;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <th
      onClick={() => onSort(field)}
      className={`py-3 px-4 cursor-pointer hover:bg-neutral-850 transition-colors group ${className} ${center ? 'text-center' : ''}`}
    >
      <div className={`flex items-center gap-1.5 ${center ? 'justify-center' : ''}`}>
        {children}
        <ArrowUpDown size={11} className={`text-neutral-500 opacity-60 group-hover:opacity-100 ${current === field ? 'text-indigo-400 opacity-100' : ''}`} />
      </div>
    </th>
  );
}
