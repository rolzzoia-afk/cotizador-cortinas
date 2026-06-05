// Una fila de la tabla de productos. Renderiza las 9 columnas
// (código, producto, cod_int, descripción, verticales, descuento,
// rollos, métrica + barra, acciones) para un único InventoryItem.

import { Pencil, Plus, Minus, Trash2 } from 'lucide-react';
import type { InventoryItem } from '../../types';
import StockBar from './StockBar';

interface ProductRowProps {
  item: InventoryItem;
  puedeEditarStock?: boolean;
  onSelectAdjustItem: (item: InventoryItem) => void;
  onSelectIncrementItem?: (item: InventoryItem) => void;
  onSelectEditItem?: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
}

export default function ProductRow({
  item,
  puedeEditarStock = false,
  onSelectAdjustItem,
  onSelectIncrementItem,
  onSelectEditItem,
  onDeleteItem,
}: ProductRowProps) {
  const isAgotado = item.totalMetros === 0;
  const isLimited = item.comentario.toUpperCase().includes('LIMIT');

  const onIncrement = onSelectIncrementItem || onSelectAdjustItem;

  return (
    <tr
      key={item.id}
      className={`hover:bg-neutral-900/50 transition-all ${
        isAgotado ? 'bg-neutral-950/40 opacity-80' : ''
      }`}
    >
      {/* COD */}
      <td className="py-3 px-4">
        <span className="font-mono text-[10px] font-bold text-neutral-300 bg-neutral-950 px-2 py-1 rounded-sm border border-neutral-800/60 block w-fit">
          {item.cod}
        </span>
      </td>

      {/* Producto */}
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

      {/* COD_INT */}
      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
        {item.cod_int === '-' ? (
          <span className="text-neutral-700">-</span>
        ) : (
          item.cod_int
        )}
      </td>

      {/* Descripción / Color */}
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

      {/* Verticales SI / NO */}
      <td className="py-3 px-4 text-center">
        <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
          item.telaVerticales === 'SI'
            ? 'bg-teal-950/70 text-teal-300 border border-teal-900/30 font-bold'
            : 'bg-neutral-900 text-neutral-500 font-normal border border-neutral-850'
        }`}>
          {item.telaVerticales}
        </span>
      </td>

      {/* Descuento */}
      <td className="py-3 px-4 text-center">
        <span className="font-mono font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-900/35 px-1.5 py-0.5 rounded text-[10px]">
          {item.descuento}
        </span>
      </td>

      {/* Rollos */}
      <td className="py-3 px-4 text-center font-mono font-medium text-neutral-400">
        {item.rollos}
      </td>

      {/* Métrica + barra */}
      <td className="py-3 px-4">
        <StockBar item={item} />
      </td>

      {/* Acciones */}
      <td className="py-3 px-4 text-center">
        <div className="flex items-center justify-center gap-1.5">
          {/* Editar stock asignado — solo admins */}
          {puedeEditarStock && onSelectEditItem && (
            <button
              onClick={() => onSelectEditItem(item)}
              className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 border border-amber-500/20"
              title="Editar stock asignado (rollos y metros) — solo admin"
            >
              <Pencil size={11} />
              Editar
            </button>
          )}

          {/* Sumar metros */}
          <button
            onClick={() => onIncrement(item)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 border border-emerald-500/20"
            title="Sumar metros (devolver un descuento, recepción de mercadería, etc.)"
          >
            <Plus size={11} />
            Sumar
          </button>

          {/* Descontar */}
          <button
            onClick={() => onSelectAdjustItem(item)}
            className="bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 active:scale-95 border border-rose-500/20"
            title="Descontar metros del stock"
          >
            <Minus size={11} />
            Descontar
          </button>

          {/* Eliminar */}
          <button
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar "${item.descripcion}" del catálogo? esta accion no borrará su historial anterior.`)) {
                onDeleteItem(item.id);
              }
            }}
            className="text-neutral-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Eliminar del catálogo"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
