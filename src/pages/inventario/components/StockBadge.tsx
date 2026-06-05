// Badge de estado de stock: OK / BAJO MIN / SIN STOCK.

import { type Insumo, getStockTotal } from '@/modules/inventario/helpers';

interface StockBadgeProps {
  insumo: Insumo;
}

export default function StockBadge({ insumo }: StockBadgeProps) {
  const st = getStockTotal(insumo);
  const sin = st <= 0;
  const bajo = (insumo.minimo || 0) > 0 && st < (insumo.minimo || 0);
  if (sin) {
    return (
      <span className="rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-[0.62rem] font-semibold text-destructive">
        SIN STOCK
      </span>
    );
  }
  if (bajo) {
    return (
      <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[0.62rem] font-semibold text-warning">
        BAJO MIN
      </span>
    );
  }
  return (
    <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[0.62rem] font-semibold text-success">
      OK
    </span>
  );
}
