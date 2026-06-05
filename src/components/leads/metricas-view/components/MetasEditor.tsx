// Editor de metas mensuales por vendedora. Solo visible para admin desde
// el panel de Reunión Diaria. Cada cambio se guarda llamando a onGuardarMeta.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VendedoraOpt } from '@/modules/leads/hooks';
import { fmtCLP } from '../utils/formato';

interface MetasEditorProps {
  vendedoras: VendedoraOpt[];
  metas: Record<string, number>;
  onGuardarMeta: (vendedoraId: string, monto: number) => Promise<void>;
}

export default function MetasEditor({ vendedoras, metas, onGuardarMeta }: MetasEditorProps) {
  const [valores, setValores] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    vendedoras.forEach((v) => {
      o[v.id] = metas[v.id] ? String(metas[v.id]) : '';
    });
    return o;
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const v of vendedoras) {
        const nuevo = Number(valores[v.id] || 0);
        if (nuevo !== (metas[v.id] ?? 0)) await onGuardarMeta(v.id, nuevo);
      }
      toast.success('Metas guardadas');
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      {vendedoras.map((v) => (
        <div key={v.id} className="flex items-center gap-2 text-xs">
          <span className="w-40 truncate text-foreground">{v.nombre}</span>
          <span className="text-muted-foreground">$</span>
          <input
            type="number"
            min={0}
            step={100000}
            value={valores[v.id] ?? ''}
            onChange={(e) => setValores((p) => ({ ...p, [v.id]: e.target.value }))}
            placeholder="0"
            className="w-40 rounded-md border border-border bg-card px-2 py-1 text-foreground focus:border-accent focus:outline-none"
          />
          {valores[v.id] && Number(valores[v.id]) > 0 && (
            <span className="text-muted-foreground">{fmtCLP(Number(valores[v.id]))}</span>
          )}
        </div>
      ))}
      <button
        onClick={guardar}
        disabled={guardando}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-60"
      >
        {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Guardar metas
      </button>
    </div>
  );
}
