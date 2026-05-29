/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Plus, X } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (newProduct: Omit<InventoryItem, 'id'>) => void;
}

export default function AddProductModal({ isOpen, onClose, onAddProduct }: AddProductModalProps) {
  const [cod, setCod] = useState('BLACKOUT_D');
  const [producto, setProducto] = useState('ROLLER BLACKOUT DELUX');
  const [codInt, setCodInt] = useState('');
  const [tipo, setTipo] = useState('DELUX');
  const [descripcion, setDescripcion] = useState('');
  const [telaVerticales, setTelaVerticales] = useState<'SI' | 'NO'>('SI');
  const [descuento, setDescuento] = useState('30%');
  const [rollos, setRollos] = useState<number>(3);
  const [metros, setMetros] = useState<number>(30);
  const [comentario, setComentario] = useState('S/C');

  if (!isOpen) return null;

  // Auto suggest product name based on COD selection
  const handleCodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCod = e.target.value;
    setCod(selectedCod);
    if (selectedCod === 'BLACKOUT_D') {
      setProducto('ROLLER BLACKOUT DELUX');
      setTipo('DELUX');
    } else if (selectedCod === 'BLACKOUT_P') {
      setProducto('ROLLER BLACKOUT PREMIUM');
      setTipo('PREMIUM');
    } else if (selectedCod === 'SCREEN_P') {
      setProducto('ROLLER SCREEN PREMIUM');
      setTipo('PREMIUM');
    } else if (selectedCod === 'DUOBK_P') {
      setProducto('ROLLER DUO BLACKOUT PREMIUM');
      setTipo('PREMIUM');
    } else if (selectedCod === 'DUOPOLI_P') {
      setProducto('ROLLER DUO POLIESTER PREMIUM');
      setTipo('PREMIUM');
    } else if (selectedCod === 'ACCESORIO') {
      setProducto('CENEFA CUADRADA');
      setTipo('-');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    // Calculate dynamic total meters
    const totalMetros = rollos * metros;

    onAddProduct({
      cod,
      producto,
      cod_int: codInt.trim() || '-',
      tipo,
      descripcion: descripcion.trim().toUpperCase(),
      telaVerticales,
      descuento,
      rollos,
      metros,
      totalMetros,
      comentario: comentario.trim() || 'S/C'
    });

    // Reset logic
    setCodInt('');
    setDescripcion('');
    setRollos(3);
    setMetros(30);
    setComentario('S/C');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="relative bg-[#121212] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all duration-300 border border-neutral-800/80">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5 animate-pulse">
              <Plus size={16} className="text-indigo-400" />
              Añadir Nuevo Producto al Inventario
            </h3>
            <p className="text-[10px] text-neutral-400 mt-0.5">Agrega telas de cortinas roller o accesorios personalizados</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Input fields */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* COD selector */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Código de Categoría (COD)</label>
              <select
                value={cod}
                onChange={handleCodChange}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all font-mono"
              >
                <option value="BLACKOUT_D">BLACKOUT_D</option>
                <option value="BLACKOUT_P">BLACKOUT_P</option>
                <option value="SCREEN_P">SCREEN_P</option>
                <option value="DUOBK_P">DUOBK_P</option>
                <option value="DUOPOLI_P">DUOPOLI_P</option>
                <option value="ACCESORIO">ACCESORIO</option>
              </select>
            </div>

            {/* Product description name based on category */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Nombre Comercial de Producto</label>
              <input
                type="text"
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
                placeholder="ROLLER BLACKOUT DELUX"
                required
              />
            </div>

            {/* Internal Code */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Código Interno (COD_INT)</label>
              <input
                type="text"
                value={codInt}
                onChange={(e) => setCodInt(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-600 outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-505 transition-all font-mono"
                placeholder="Ej: BK 77, SC 66, TR 04"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Tipo / Gama</label>
              <input
                type="text"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
                placeholder="Ej: DELUX, PREMIUM, ESTÁNDAR"
              />
            </div>

            {/* Description (Details of color/textures) */}
            <div className="md:col-span-2">
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Descripción (Color / Textura / Medida)</label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all uppercase placeholder-neutral-600"
                placeholder="Ej: BEIGE JASPEADO, GRIS TEXTURA H0082FWLS"
                required
              />
            </div>

            {/* Vertical installation toggle */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Apto para Cortinas Verticales</label>
              <select
                value={telaVerticales}
                onChange={(e) => setTelaVerticales(e.target.value as 'SI' | 'NO')}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
              >
                <option value="SI">SÍ (SI)</option>
                <option value="NO">NO</option>
              </select>
            </div>

            {/* Discount rate */}
            <div>
              <label className="block text-neutral-400 text-xs font-semibold mb-1">Descuento (%)</label>
              <input
                type="text"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-550/20 focus:border-indigo-500 transition-all font-mono"
                placeholder="Ej: 30%, 40%, 25%"
              />
            </div>

            {/* Rolls count */}
            <div>
              <label className="block text-[#ccc] text-xs font-semibold mb-1">Cantidad de Rollos / Tiras</label>
              <input
                type="number"
                min="0"
                value={rollos}
                onChange={(e) => setRollos(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            {/* Meters per roll */}
            <div>
              <label className="block text-[#ccc] text-xs font-semibold mb-1">Metros por Rollo / Medida Unitaria</label>
              <input
                type="number"
                step="any"
                min="0"
                value={metros}
                onChange={(e) => setMetros(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white font-mono outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-500 transition-all"
                required
              />
            </div>

            {/* Commentary field */}
            <div className="md:col-span-2">
              <label className="block text-[#ccc] text-xs font-semibold mb-1">Comentario / Estado de Alerta</label>
              <input
                type="text"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white outline-none focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-550 transition-all"
                placeholder="S/C, STOCK LIMITADO, etc."
              />
            </div>

          </div>

          {/* Quick summary check */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-850 rounded-xl grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-neutral-450 block text-[10px]">Metraje Total Calculado:</span>
              <span className="font-bold text-indigo-400 font-mono text-base">{(rollos * metros).toLocaleString('es-CL')} mts</span>
            </div>
            <div>
              <span className="text-neutral-450 block text-[10px]">Gama de Producto:</span>
              <span className="font-semibold text-neutral-200 text-xs block truncate mt-1">{producto} {codInt ? `(${codInt})` : ''}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:text-white rounded-xl transition-all hover:bg-neutral-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl border border-indigo-500/20 shadow-xs transition-all cursor-pointer"
            >
              Añadir Producto
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
