/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DiscountHistoryEntry } from '../types';
import { ArrowDownRight, ArrowUpRight, Clock, Trash2, Search, Trash } from 'lucide-react';

interface HistoryLogProps {
  logs: DiscountHistoryEntry[];
  onClearLogs: () => void;
  onDeleteLogItem: (logId: string) => void;
}

export default function HistoryLog({ logs, onClearLogs, onDeleteLogItem }: HistoryLogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredLogs = logs.filter(log => 
    log.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.cod_int.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.comentario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="history-log-panel" className="bg-[#121212] rounded-2xl border border-neutral-800/80 shadow-md overflow-hidden animate-fade-in">
      
      {/* Header and tools */}
      <div className="p-5 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            Registro de Movimientos e Historial
          </h3>
          <p className="text-[12px] text-neutral-400 mt-0.5">Auditoría en tiempo real de descuentos y reposiciones de metraje</p>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-550" />
            <input
              type="text"
              placeholder="Buscar en historial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all w-48 font-medium text-white placeholder-neutral-550"
            />
          </div>

          {/* Clear Logs */}
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/50 text-rose-400 border border-rose-900/35 font-medium text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Borrar todo el historial de movimientos de almacenamiento"
            >
              <Trash2 size={12} />
              Vaciar Registro
            </button>
          )}
        </div>
      </div>

      {/* History table & content */}
      <div className="overflow-x-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 space-y-2 bg-neutral-950/10">
            <Clock size={36} className="mx-auto text-neutral-600 stroke-1" />
            <p className="text-xs font-medium text-neutral-300">No se han registrado movimientos aún</p>
            <p className="text-[12px] text-neutral-500 max-w-sm mx-auto">Cuando descuentes o aumentes metrajes en la tabla de arriba, aparecerán aquí.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#181818] border-b border-neutral-800 text-[12px] text-neutral-450 font-bold uppercase tracking-wider select-none">
                <th className="py-3 px-4">Acción</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4">Meteaje de Cambio</th>
                <th className="py-3 px-4">Balance General</th>
                <th className="py-3 px-4">Motivo / Comentario</th>
                <th className="py-3 px-4 text-right">Fecha y Hora</th>
                <th className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 text-xs">
              {filteredLogs.map((log) => {
                const isDiscount = log.tipoAccion === 'DESCUENTO';
                return (
                  <tr key={log.id} className="hover:bg-neutral-900/60 transition-colors">
                    
                    {/* Action pill */}
                    <td className="py-3.5 px-4 font-semibold">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-bold border ${
                        isDiscount 
                          ? 'bg-rose-950/40 text-rose-400 border-rose-900/30' 
                          : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30'
                      }`}>
                        {isDiscount ? (
                          <>
                            <ArrowDownRight size={11} className="stroke-2" />
                            DESCUENTO
                          </>
                        ) : (
                          <>
                            <ArrowUpRight size={11} className="stroke-2" />
                            INGRESO
                          </>
                        )}
                      </span>
                    </td>

                    {/* Product identification */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-neutral-100 block">{log.producto}</span>
                        <span className="text-[12px] text-neutral-450 font-medium font-mono">
                          {log.cod_int} · {log.descripcion}
                        </span>
                      </div>
                    </td>

                    {/* Quantity of change */}
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={isDiscount ? 'text-rose-400' : 'text-emerald-400'}>
                        {isDiscount ? '-' : '+'}{log.cantidadMetros} m
                      </span>
                    </td>

                    {/* Ledger audit */}
                    <td className="py-3.5 px-4 font-mono text-[12px] text-neutral-500">
                      <span>{log.anteriorMetros}m → <strong className="text-neutral-350">{log.nuevoMetros}m</strong></span>
                    </td>

                    {/* Comment */}
                    <td className="py-3.5 px-4 text-neutral-200 font-medium max-w-xs truncate" title={log.comentario}>
                      {log.comentario}
                    </td>

                    {/* Timestamps */}
                    <td className="py-3.5 px-4 text-right text-neutral-450 font-mono text-[12px]">
                      {new Date(log.fecha).toLocaleString('es-CL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onDeleteLogItem(log.id)}
                        className="text-neutral-500 hover:text-rose-450 hover:text-rose-400 p-1 rounded-md hover:bg-neutral-950 transition-all cursor-pointer"
                        title="Eliminar este registro del historial"
                      >
                        <Trash size={12} />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
