/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../../types';
import { MinusCircle, PlusCircle, AlertCircle, Sparkles, X, Check } from 'lucide-react';

interface AdjustStockModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  defaultActionType?: 'DESCUENTO' | 'INCREMENTO';
  onClose: () => void;
  onSubmitAdjustment: (
    itemId: string,
    meters: number,
    actionType: 'DESCUENTO' | 'INCREMENTO',
    comment: string
  ) => void;
}

export default function AdjustStockModal({ item, isOpen, defaultActionType, onClose, onSubmitAdjustment }: AdjustStockModalProps) {
  const [actionType, setActionType] = useState<'DESCUENTO' | 'INCREMENTO'>('DESCUENTO');
  const [metersString, setMetersString] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset local state when item changes
  useEffect(() => {
    if (item) {
      setMetersString('');
      setComment('');
      setErrorMsg(null);
      // Use explicit default if provided; otherwise auto: descuento si hay stock, increment si está agotado
      if (defaultActionType) {
        setActionType(defaultActionType);
      } else {
        setActionType(item.totalMetros > 0 ? 'DESCUENTO' : 'INCREMENTO');
      }
    }
  }, [item, isOpen, defaultActionType]);

  if (!isOpen || !item) return null;

  const handleMetersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMetersString(val);
    
    // Auto validate
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setErrorMsg("Ingrese un metraje válido mayor a 0.");
    } else if (actionType === 'DESCUENTO' && num > item.totalMetros) {
      setErrorMsg(`No es posible descontar ${num}m. El stock actual es de solo ${item.totalMetros}m.`);
    } else {
      setErrorMsg(null);
    }
  };

  const handleActionTypeSwitch = (type: 'DESCUENTO' | 'INCREMENTO') => {
    setActionType(type);
    // Revalidate with new action type
    const num = parseFloat(metersString);
    if (!isNaN(num) && num > 0) {
      if (type === 'DESCUENTO' && num > item.totalMetros) {
        setErrorMsg(`No es posible descontar ${num}m. El stock actual es de solo ${item.totalMetros}m.`);
      } else {
        setErrorMsg(null);
      }
    } else {
      setErrorMsg(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(metersString);
    
    if (isNaN(num) || num <= 0) {
      setErrorMsg("Ingrese una cantidad válida de metros.");
      return;
    }

    if (actionType === 'DESCUENTO' && num > item.totalMetros) {
      setErrorMsg(`Excede los metros disponibles (${item.totalMetros}m)`);
      return;
    }

    if (!comment.trim()) {
      setErrorMsg("Por favor, ingrese un comentario o motivo del movimiento.");
      return;
    }

    // Call callback to parent state
    onSubmitAdjustment(item.id, num, actionType, comment.trim());
    onClose();
  };  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="adjust-stock-modal">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-[#121212] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all duration-300 border border-neutral-800/80">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight">Transacción de Metraje</h3>
            <p className="text-[10px] text-neutral-450 font-mono mt-0.5">{item.cod} · {item.cod_int}</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Target Product Summary card */}
          <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-850/80 flex flex-col gap-1.5">
            <span className="text-[9px] text-neutral-450 font-bold uppercase tracking-wider">Producto Seleccionado</span>
            <div>
              <span className="font-bold text-neutral-100 text-xs block">{item.producto}</span>
              <span className="text-neutral-400 text-xs">{item.descripcion}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1 pt-2 border-t border-neutral-900">
              <div className="text-left">
                <span className="block text-[9px] text-neutral-500">Stock Actual</span>
                <span className="font-mono text-sm font-bold text-white">{item.totalMetros} <span className="text-[10px] font-normal text-neutral-500">mts</span></span>
              </div>
              <div className="text-left">
                <span className="block text-[9px] text-neutral-500">Rollos / Descuento</span>
                <span className="text-xs font-semibold text-neutral-350">{item.rollos} rollos ({item.descuento})</span>
              </div>
            </div>
          </div>

          {/* Action Type Selector Toggles */}
          <div>
            <label className="block text-neutral-400 text-xs font-semibold mb-1.5">Tipo de Movimiento</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 border border-neutral-850/80 rounded-xl">
              <button
                type="button"
                onClick={() => handleActionTypeSwitch('DESCUENTO')}
                disabled={item.totalMetros === 0}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  actionType === 'DESCUENTO'
                    ? 'bg-neutral-800 text-rose-400 shadow-md border border-neutral-700/60 font-bold'
                    : 'text-neutral-450 hover:text-neutral-200 disabled:opacity-40'
                }`}
              >
                <MinusCircle size={14} />
                Descontar Stock
              </button>
              
              <button
                type="button"
                onClick={() => handleActionTypeSwitch('INCREMENTO')}
                className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  actionType === 'INCREMENTO'
                    ? 'bg-neutral-800 text-emerald-400 shadow-md border border-neutral-700/60 font-bold'
                    : 'text-neutral-450 hover:text-neutral-200'
                }`}
              >
                <PlusCircle size={14} />
                Ingresar Stock
              </button>
            </div>
          </div>

          {/* Input Quantity in Meters */}
          <div>
            <label className="block text-neutral-400 text-xs font-semibold mb-1">
              Metros {actionType === 'DESCUENTO' ? 'a Descontar' : 'a Ingresar'}
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={metersString}
                onChange={handleMetersChange}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500">metros</span>
            </div>
          </div>

          {/* Comment input */}
          <div>
            <label className="block text-neutral-400 text-xs font-semibold mb-1">Comentario / Motivo</label>
            <input
              type="text"
              placeholder={actionType === 'DESCUENTO' ? 'Ej: Venta cortina de living Pedro Pérez' : 'Ej: Recepción de importación'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all font-medium"
              required
            />
          </div>

          {/* Validation indicators */}
          {errorMsg && (
            <div className="p-3 bg-rose-95/40 bg-rose-950/60 text-rose-350 border border-rose-900/40 rounded-xl flex items-start gap-2 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!errorMsg && metersString && !isNaN(parseFloat(metersString)) && (
            <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
              actionType === 'DESCUENTO' 
                ? 'bg-amber-955/40 text-amber-300 border-amber-900/40 animate-pulse' 
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/45'
            }`}>
              <Sparkles size={14} className="shrink-0 mt-0.5" />
              <span>
                El metraje total pasará de <strong>{item.totalMetros}m</strong> a {' '}
                <strong>
                  {actionType === 'DESCUENTO' 
                    ? (item.totalMetros - parseFloat(metersString)).toFixed(2) 
                    : (item.totalMetros + parseFloat(metersString)).toFixed(2)
                  }m
                </strong>.
              </span>
            </div>
          )}

          {/* Submit Action Buttons */}
          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer hover:bg-neutral-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!!errorMsg || !metersString || !comment.trim()}
              className={`flex-1 px-4 py-2 rounded-md text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                actionType === 'DESCUENTO'
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <Check size={14} className="inline mr-1" />
              {actionType === 'DESCUENTO' ? 'Confirmar Descuento' : 'Confirmar Ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
