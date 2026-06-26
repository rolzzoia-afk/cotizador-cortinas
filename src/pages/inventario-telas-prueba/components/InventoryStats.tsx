/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InventoryItem } from '../types';
import { Layers, AlertTriangle, Scissors } from 'lucide-react';

interface InventoryStatsProps {
  items: InventoryItem[];
}

export default function InventoryStats({ items }: InventoryStatsProps) {
  // Total meters overall
  const totalMeters = items.reduce((acc, item) => acc + item.totalMetros, 0);
  
  // Total rolls of fabric
  const totalRolls = items.reduce((acc, item) => acc + (item.rollos || 0), 0);

  // Low stock / Limited stock count
  const lowStockItems = items.filter(item => 
    item.totalMetros === 0 || 
    item.comentario.toUpperCase().includes("LIMITAD") ||
    item.rollos === 0
  );

  // Group by category counts
  const categories = items.reduce((acc: { [key: string]: { meters: number; count: number } }, item) => {
    // Simplify code to category name
    let cat = 'Otros';
    if (item.cod.includes('BLACKOUT')) cat = 'Blackout';
    else if (item.cod.includes('SCREEN')) cat = 'Screen';
    else if (item.cod.includes('DUO') || item.cod.includes('DUOBK') || item.cod.includes('DUOPOLI')) cat = 'Duo';
    else if (item.cod.includes('ACCESORIO')) cat = 'Accesorios';

    if (!acc[cat]) {
      acc[cat] = { meters: 0, count: 0 };
    }
    acc[cat].meters += item.totalMetros;
    acc[cat].count += 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="inventory-stats">
      
      {/* Metric 1: Total Metros */}
      <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/80 shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Metraje Total Disponible</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">{totalMeters.toLocaleString('es-CL')}</span>
            <span className="text-xs font-semibold text-neutral-450">mts</span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-1">Total de rollos y unidades</p>
        </div>
        <div className="p-3 bg-indigo-950/40 text-indigo-405 rounded-xl border border-indigo-900/40">
          <Scissors size={20} className="text-indigo-400" />
        </div>
      </div>

      {/* Metric 2: Total Rolls */}
      <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/80 shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Rollos / Accesorios</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">{totalRolls}</span>
            <span className="text-xs font-semibold text-neutral-450">unds</span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-1">Suministro activo en local</p>
        </div>
        <div className="p-3 bg-teal-950/40 text-teal-400 rounded-xl border border-teal-900/40">
          <Layers size={21} />
        </div>
      </div>

      {/* Metric 3: Critical alerts */}
      <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/80 shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Stock Crítico / Agotado</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-rose-500 tracking-tight">{lowStockItems.length}</span>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${
              lowStockItems.length > 0 ? 'bg-amber-955/50 text-amber-300 border border-amber-900/40' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30'
            }`}>
              {lowStockItems.length > 0 ? 'Reabastecer' : 'Al día'}
            </span>
          </div>
          <p className="text-[12px] text-neutral-500 mt-1">Métricas con stock limitado</p>
        </div>
        <div className={`p-3 rounded-xl border ${lowStockItems.length > 0 ? 'bg-rose-950/40 border-rose-900/40 text-rose-455' : 'bg-neutral-900 border-neutral-800 text-neutral-600'}`}>
          <AlertTriangle size={20} className={lowStockItems.length > 0 ? 'text-rose-400' : 'text-neutral-500'} />
        </div>
      </div>

      {/* Metric 4: Quick Category Breakdown Visual */}
      <div className="bg-[#121212] p-5 rounded-2xl border border-neutral-800/80 shadow-md flex flex-col justify-between">
        <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-2.5">Distribución de Telas</span>
        <div className="space-y-1.5">
          {Object.entries(categories).map(([name, data]) => {
            const percent = totalMeters > 0 ? Math.round((data.meters / totalMeters) * 100) : 0;
            return (
              <div key={name} className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[12px] font-medium">
                  <span className="text-neutral-350 font-semibold">{name}</span>
                  <span className="text-neutral-450 font-mono">{data.meters.toFixed(1)}m ({percent}%)</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-neutral-900">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      name === 'Blackout' ? 'bg-indigo-500' :
                      name === 'Screen' ? 'bg-teal-500' :
                      name === 'Duo' ? 'bg-amber-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
