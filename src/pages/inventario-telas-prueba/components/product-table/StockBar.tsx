// Barra de progreso del stock de un rollo. Muestra "totalMetros / maxMeters"
// + barra coloreada (verde / ámbar / rosa) según el porcentaje vivo.
// Cálculo del denominador y del porcentaje viven en utils/stock-bar.ts.

import type { InventoryItem } from '../../types';
import { calcMaxMeters, calcStockPercent } from '../../utils/stock-bar';

interface StockBarProps {
  item: InventoryItem;
}

export default function StockBar({ item }: StockBarProps) {
  const isAgotado = item.totalMetros === 0;
  const maxMeters = calcMaxMeters(item);
  const stockPercent = calcStockPercent(item);

  return (
    <div className="text-right space-y-1">
      {/* Stock numerical indicator */}
      <div className="flex justify-end items-baseline gap-1">
        <span className={`font-mono font-extrabold text-xs ${
          isAgotado ? 'text-rose-500 line-through' : 'text-white'
        }`}>
          {item.totalMetros.toLocaleString('es-CL')}
        </span>
        <span className="text-[12px] text-neutral-500 font-medium"> / {maxMeters}m</span>
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
  );
}
