// Tab "Alertas": lista priorizada de insumos sin stock o bajo mínimo.
// Cada alerta tiene 2 acciones: ver en catálogo y registrar pedido.

import { AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Alerta, type Insumo, getStockTotal } from '@/modules/inventario/helpers';

interface AlertasTabProps {
  alertasOrdenadas: Alerta[];
  insumoByCod: Map<string, Insumo>;
  onVerEnCatalogo: (codigo: string) => void;
  onRegistrarReposicion: (codigo: string, falta: number) => void;
}

export default function AlertasTab({
  alertasOrdenadas,
  insumoByCod,
  onVerEnCatalogo,
  onRegistrarReposicion,
}: AlertasTabProps) {
  if (alertasOrdenadas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="mb-3 h-10 w-10 text-success/50" />
        <p>No hay alertas de stock.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alertasOrdenadas.map((a) => {
        const ins = insumoByCod.get(a.codigo);
        const st = ins ? getStockTotal(ins) : 0;
        const min = ins?.minimo || 0;
        const falta = min > 0 ? Math.max(0, min - st) : 0;
        const ubic = ins?.ubicacion || '—';
        const color = a.severity === 'danger' ? 'red' : 'amber';
        return (
          <div
            key={a.codigo + a.tipo}
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3',
              color === 'red'
                ? 'border-destructive/30 bg-destructive/15'
                : 'border-warning/30 bg-warning/15',
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded',
                color === 'red'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-warning/15 text-warning',
              )}
            >
              {color === 'red' ? (
                <XCircle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    color === 'red' ? 'text-destructive' : 'text-warning',
                  )}
                >
                  {a.tipo === 'SIN_STOCK' ? 'Sin stock' : 'Stock bajo'}
                </span>
                <span className="font-mono text-[0.7rem] text-muted-foreground">{a.codigo}</span>
              </div>
              <div className="text-sm text-foreground">{a.nombre || '—'}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
                <span>📍 {ubic}</span>
                <span>
                  Stock:{' '}
                  <strong className={color === 'red' ? 'text-destructive' : 'text-warning'}>
                    {st}
                  </strong>
                </span>
                {min > 0 && <span>Mínimo: {min}</span>}
                {falta > 0 && (
                  <span
                    className={cn(
                      'font-semibold',
                      color === 'red' ? 'text-destructive' : 'text-warning',
                    )}
                  >
                    Reponer: {falta}
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onVerEnCatalogo(a.codigo)}
                  className="rounded border border-border bg-card px-2.5 py-1 text-[0.72rem] text-foreground hover:bg-card"
                >
                  Ver ítem
                </button>
                <button
                  onClick={() => onRegistrarReposicion(a.codigo, falta || 1)}
                  className={cn(
                    'rounded border px-2.5 py-1 text-[0.72rem]',
                    color === 'red'
                      ? 'border-destructive/30 bg-destructive/15 text-red-200 hover:bg-destructive/15'
                      : 'border-warning/30 bg-warning/15 text-warning hover:bg-warning/15',
                  )}
                >
                  Registrar pedido
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
