/**
 * Modal "Editar stock asignado" — solo visible para usuarios con rol 'admin'.
 * Permite modificar rollos, metros por rollo y total metros directamente,
 * sin pasar por DESCUENTO/INCREMENTO. Usado para correcciones de inventario
 * cuando se asignan/quitan rollos al CyberDay.
 */

import { useState } from 'react';
import { Pencil, X, AlertTriangle } from 'lucide-react';
import type { InventoryItem } from '../types';

interface EditStockModalProps {
  item: InventoryItem;
  onClose: () => void;
  onConfirm: (rollos: number, metrosPorRollo: number, totalMetros: number, comentario: string) => void;
}

export default function EditStockModal({ item, onClose, onConfirm }: EditStockModalProps) {
  const [rollos, setRollos] = useState<string>(String(item.rollos));
  const [metrosPorRollo, setMetrosPorRollo] = useState<string>(String(item.metros));
  const [totalMetros, setTotalMetros] = useState<string>(String(item.totalMetros));
  const [comentario, setComentario] = useState<string>('');
  const [autoCalcular, setAutoCalcular] = useState<boolean>(true);

  const r = parseInt(rollos) || 0;
  const mr = parseFloat(metrosPorRollo) || 0;
  const totalCalc = autoCalcular ? r * mr : parseFloat(totalMetros) || 0;

  const cambio =
    r !== item.rollos ||
    mr !== item.metros ||
    totalCalc !== item.totalMetros;

  const submit = () => {
    if (!comentario.trim()) {
      alert('Tienes que escribir un motivo para la edición (queda registrado en historial).');
      return;
    }
    onConfirm(r, mr, totalCalc, comentario);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#121212] border border-neutral-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Pencil size={16} className="text-amber-400" />
              <h3 className="text-white font-bold text-sm tracking-tight">Editar Stock Asignado</h3>
            </div>
            <p className="text-[11px] text-neutral-400">
              {item.cod_int && item.cod_int !== '-' ? `${item.cod_int} · ` : ''}
              {item.descripcion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-200 leading-snug">
            Esta opción <strong>reemplaza</strong> los valores actuales (no descuenta ni suma).
            Usar solo cuando asignás nuevo metraje o corregís un error.
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
                Rollos
              </label>
              <input
                type="number"
                min="0"
                value={rollos}
                onChange={(e) => setRollos(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Actual: {item.rollos}
              </p>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
                Metros por rollo
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={metrosPorRollo}
                onChange={(e) => setMetrosPorRollo(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Actual: {item.metros}
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[11px] text-neutral-300 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCalcular}
                onChange={(e) => setAutoCalcular(e.target.checked)}
                className="accent-amber-500"
              />
              Calcular total automáticamente (rollos × metros por rollo)
            </label>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
                Total metros
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={autoCalcular ? totalCalc : totalMetros}
                onChange={(e) => setTotalMetros(e.target.value)}
                disabled={autoCalcular}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60 disabled:opacity-60"
              />
              <p className="text-[10px] text-neutral-500 mt-1">
                Actual: {item.totalMetros}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
              Motivo de la edición *
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ej: Reasignación de stock CyberDay, corrección de error de carga, llegó nuevo lote..."
              rows={2}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60 resize-none"
            />
            <p className="text-[10px] text-neutral-500 mt-1">
              Queda registrado en el historial junto con tu email.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 text-xs font-semibold hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!cambio || !comentario.trim()}
            className="px-4 py-2 rounded-md bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Guardar cambio
          </button>
        </div>
      </div>
    </div>
  );
}
