// Una de las tres bolsas que arma el bodeguero para la OT.
//
// La columna se lee de arriba abajo: estado, lo que hay que juntar, dónde
// queda la bolsa y cuánto tomó. El botón OK es grande a propósito: se toca con
// guantes y con la otra mano ocupada.

import { Check, MapPin, Printer } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import {
  claveCheckBodega,
  estadoColumna,
  qrBolsa,
  type ColumnaConItems,
} from '@/modules/produccion/bodega';
import { getRacks } from '@/modules/inventario/rackConfig';

const COLOR_ESTADO: Record<string, string> = {
  EMPEZAR: 'bg-secondary text-muted-foreground',
  'EN PROCESO': 'bg-amber-500/20 text-amber-300',
  COMPLETADO: 'bg-emerald-500/20 text-emerald-300',
};

/** Todos los racks del galpón, para elegir dónde queda la bolsa. */
const RACKS = [...getRacks('LIBERADO'), ...getRacks('MATERIAS_PRIMAS')].map((r) => r.nombre);

export default function ColumnaBodega({
  col,
  ot,
  hechas,
  rack,
  minutos,
  finalizada,
  onMarcar,
  onVerMapa,
  onCambiarRack,
  onFinalizar,
}: {
  col: ColumnaConItems;
  ot: string;
  hechas: Set<string>;
  rack: string;
  minutos: number | null;
  finalizada: boolean;
  onMarcar: (clave: string, hecho: boolean) => void;
  onVerMapa: (insumo: InsumoConsolidado) => void;
  onCambiarRack: (rack: string) => void;
  onFinalizar: () => void;
}) {
  const items = col.secciones.flatMap((s) => s.items);
  const hechos = items.filter((i) => hechas.has(claveCheckBodega(col.columna, i))).length;
  const estado = estadoColumna(col.total, hechos);
  const idQR = `qr-bolsa-${col.columna}`;

  const imprimir = () => {
    const canvas = document.getElementById(idQR) as HTMLCanvasElement | null;
    const img = canvas?.toDataURL() || '';
    const w = window.open('', '_blank', 'width=640,height=480');
    if (!w) {
      toast.error('El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes.');
      return;
    }
    const html = `<!doctype html><html><head><title>Bolsa ${col.label} — OT ${ot}</title>
<style>
body { font-family: sans-serif; margin: 0; padding: 20px; }
.etiqueta { display: inline-block; border: 2px solid #000; border-radius: 8px; padding: 12px 16px;
            text-align: center; width: 220px; }
.etiqueta img { width: 150px; height: 150px; display: block; margin: 0 auto 6px; }
.etiqueta .ot { font-size: 22px; font-weight: bold; }
.etiqueta .area { font-size: 13px; background: #f0f0f0; border-radius: 3px; padding: 2px 6px;
                  display: inline-block; margin: 4px 0; }
.etiqueta .sub { font-size: 11px; color: #555; }
@media print { body { padding: 0; } }
</style></head>
<body>
<div class="etiqueta">
  ${img ? `<img src="${img}" alt="QR bolsa">` : ''}
  <div class="ot">OT ${ot}</div>
  <div class="area">${col.label.toUpperCase()}</div>
  <div class="sub">${col.total} insumo(s)</div>
  <div class="sub">${rack ? `Rack: ${rack}` : 'Sin rack asignado'}</div>
</div>
<script>window.onload = () => setTimeout(() => { window.print(); window.close(); }, 250);</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card">
      <header className="border-b p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-sm">{col.label}</strong>
            <p className="text-[11px] text-muted-foreground">{col.ayuda}</p>
          </div>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              COLOR_ESTADO[estado],
            )}
          >
            {estado}
          </span>
        </div>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {hechos} de {col.total}
          {minutos != null && ` · ${minutos} min`}
        </p>
      </header>

      <div className="flex-1 divide-y divide-border/50 overflow-y-auto">
        {col.total === 0 && (
          <p className="p-6 text-center text-xs text-muted-foreground">
            Esta OT no lleva nada en esta bolsa.
          </p>
        )}
        {col.secciones.map((sec) => (
          <div key={sec.seccion}>
            <p className="bg-secondary/40 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {sec.seccion}
            </p>
            <ul className="divide-y divide-border/50">
              {sec.items.map((i) => {
                const clave = claveCheckBodega(col.columna, i);
                const ok = hechas.has(clave);
                return (
                  <li
                    key={clave}
                    className={cn('flex items-center gap-2 p-2', ok && 'bg-emerald-500/5')}
                  >
                    <button
                      type="button"
                      onClick={() => onMarcar(clave, !ok)}
                      aria-label={ok ? 'Desmarcar insumo' : 'Marcar insumo como juntado'}
                      aria-pressed={ok}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors',
                        ok
                          ? 'border-emerald-500/60 bg-emerald-500/25 text-emerald-300'
                          : 'border-border hover:bg-secondary',
                      )}
                    >
                      {ok ? <Check className="h-5 w-5" /> : <span className="text-[10px]">OK</span>}
                    </button>
                    <div className={cn('min-w-0 flex-1', ok && 'opacity-50')}>
                      <p className="truncate text-xs">
                        {i.codigo && <strong>[{i.codigo}] </strong>}
                        {i.descripcion}
                      </p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {i.cantidad}
                        {i.unidad ? ` ${i.unidad}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onVerMapa(i)}
                      title="Ver dónde está"
                      aria-label={`Ver ubicación de ${i.descripcion}`}
                      className="shrink-0 rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <MapPin className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t p-3">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
            La bolsa queda en
          </span>
          <select
            value={rack}
            onChange={(e) => onCambiarRack(e.target.value)}
            className="w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs"
          >
            <option value="">— Sin asignar —</option>
            {RACKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={imprimir} className="flex-1">
            <Printer className="mr-1.5 h-4 w-4" />
            Etiqueta
          </Button>
          <Button
            size="sm"
            onClick={onFinalizar}
            disabled={col.total === 0 || hechos < col.total || finalizada}
            className="flex-1"
          >
            {finalizada ? 'Lista ✓' : 'Finalizar'}
          </Button>
        </div>
        <div className="hidden">
          <QRCodeCanvas id={idQR} value={qrBolsa(ot, col.columna)} size={150} level="M" />
        </div>
      </footer>
    </section>
  );
}
