// Vista de despacho de una OT: muestra el BOM como lista de items con su
// ubicación (rack/colmena/tela) y permite iniciar el flujo de escaneo
// QR de cada item. Cuando todos están completos, habilita el botón
// "Firmar y confirmar entrega".

import { ArrowLeft, FileSignature } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  type BOMItem,
  type Insumo,
  type OT,
  type Rack,
  type TuboColmena,
  buscarInsumoMatchBOM,
  getColmenaPorCodTubo,
  getUbicacionBOM,
} from '@/modules/bodega/bomUtils';
import type { Contador } from '../Bodeguero.types';

interface DespachoViewProps {
  ot: OT;
  bomItems: BOMItem[];
  contadores: Record<number, Contador>;
  insumos: Insumo[];
  racks: Rack[];
  tubos: TuboColmena[];
  todosCompletos: boolean;
  onBack: () => void;
  onIniciarScan: (idx: number) => void;
  onIrAFirma: () => void;
}

export default function DespachoView({
  ot,
  bomItems,
  contadores,
  insumos,
  racks,
  tubos,
  todosCompletos,
  onBack,
  onIniciarScan,
  onIrAFirma,
}: DespachoViewProps) {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  const cliente = (dg.cliente as string) || '—';
  const fechaEntrega = dg.fechaEntrega as string | undefined;
  const badge =
    ot.estado === 'pendiente_firma'
      ? 'Pendiente firma'
      : ot.estado === 'lista'
        ? 'Lista p/ entrega'
        : 'En producción';

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> OTs
          </button>
          <h1 className="flex-1 text-base font-bold">
            OT {ot.numero_ot || ot.id.slice(-6)}
          </h1>
          <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {badge}
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                Cliente
              </div>
              <div className="font-semibold">{cliente}</div>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-wider text-muted-foreground">OT</div>
              <div className="font-semibold">{ot.numero_ot || '—'}</div>
            </div>
            {fechaEntrega && (
              <div>
                <div className="text-[12px] uppercase tracking-wider text-muted-foreground">
                  Entrega
                </div>
                <div className="font-semibold">{fechaEntrega}</div>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          BOM — Toca un ítem para escanear
        </div>

        {bomItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay BOM para esta OT.
            <br />
            <span className="text-[11px] text-muted-foreground">
              Genera Fase 4 en el cotizador primero.
            </span>
          </div>
        ) : (
          bomItems.map((item, idx) => {
            const cnt = contadores[idx];
            const completo = cnt?.estado === 'completo';
            const enProceso = cnt?.pickeado > 0 && !completo;
            const esTela = !!item._es_tela;

            let locText = '';
            let stockInfo = '';
            if (esTela) {
              locText = item._ubicacion_rack
                ? `📍 Rack: ${item._ubicacion_rack}`
                : '⚠ Sin posición registrada';
            } else if ((item.categoria || '').toUpperCase().includes('TUBER')) {
              const cod = (item.especificacion || '').split('·')[0].trim().toUpperCase();
              const col = getColmenaPorCodTubo(cod, tubos);
              locText = col ? `🗄 Colmena: ${col}` : '⚠ Sin colmena asignada';
            } else {
              const ubic = getUbicacionBOM(item, insumos, racks);
              locText = ubic ? ubic.display : racks.length ? '⚠ Sin rack asignado' : '';
              const insMatch = buscarInsumoMatchBOM(item, insumos);
              stockInfo = insMatch
                ? ` · Stock: ${(insMatch.stock_mp || 0) + (insMatch.stock_liberado || 0)}`
                : '';
            }

            return (
              <button
                key={idx}
                disabled={completo}
                onClick={() => !completo && onIniciarScan(idx)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition',
                  completo
                    ? 'border-success/30 bg-success/15 opacity-70'
                    : enProceso
                      ? 'border-warning/30 bg-warning/15 hover:border-warning/30'
                      : 'border-border hover:border-accent/40',
                  esTela && !completo && 'border-warning/30',
                )}
              >
                <div className="flex-shrink-0 text-2xl">
                  {esTela ? '🧵' : completo ? '✅' : enProceso ? '🔄' : '⬜'}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-[12px] font-bold uppercase tracking-wider',
                      esTela ? 'text-warning' : 'text-muted-foreground',
                    )}
                  >
                    {item.categoria}
                  </div>
                  <div className="truncate text-sm font-semibold">{item.descripcion}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[item.especificacion, item.color].filter(Boolean).join(' · ')}
                    {stockInfo}
                  </div>
                  {locText && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{locText}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div
                    className={cn(
                      'text-xl font-bold',
                      completo ? 'text-success' : esTela ? 'text-warning' : 'text-foreground',
                    )}
                  >
                    {cnt?.pickeado || 0}
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    /{cnt?.requerido} {item.unidad}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {todosCompletos && (
          <Button
            onClick={onIrAFirma}
            className="mt-2 h-12 gap-2 bg-success text-base hover:bg-success/90"
          >
            <FileSignature className="h-5 w-5" /> Firmar y confirmar entrega
          </Button>
        )}
      </div>
    </>
  );
}
