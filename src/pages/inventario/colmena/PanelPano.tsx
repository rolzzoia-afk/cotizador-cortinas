// El panel derecho de la colmena: todo lo que se sabe del paño elegido
// (lámina «Colmena de paños»).
//
// Lo que aporta sobre la celda es el dibujo a escala —un paño de 120 × 240 se
// ve alto y angosto— y de dónde salió. Un estante de Rolzzo guarda varias
// telas: las otras quedan listadas abajo para saltar entre ellas sin volver
// al mapa.

import { Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { ColmenaPano } from '@/modules/admin/colmena';
import {
  cajaAEscala,
  consejoDelPano,
  fechaLarga,
  medidaTexto,
  nombreFamiliaPano,
  origenTexto,
  sirveParaTexto,
  ubicacionTexto,
} from '@/modules/inventario/colmenaVista';
import type { EstadoColmena } from '@/modules/telas/colmenaViva';
import type { EtiquetaSobrante } from '@/modules/telas/etiquetaSobrante';

const BADGE_ESTADO: Record<EstadoColmena, { texto: string; variante: 'success' | 'warning' | 'muted' | 'destructive' }> = {
  activa: { texto: 'Disponible', variante: 'success' },
  alerta: { texto: '+90 días', variante: 'warning' },
  usada: { texto: 'Usado', variante: 'muted' },
  baja: { texto: 'Dado de baja', variante: 'destructive' },
};

const MAX_DIBUJO_PX = 130;

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  if (children == null || children === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-[0.78rem] last:border-0">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export function PanelPano({
  pano,
  etiqueta,
  estado,
  dias,
  tieneFalla,
  vecinos,
  puedeEditar,
  onElegir,
  onImprimir,
  onMover,
  onDarDeBaja,
  bajando,
}: {
  pano: ColmenaPano | null;
  /** Los datos de la etiqueta: de ahí salen el serial, la OT y para qué sirve. */
  etiqueta: EtiquetaSobrante | null;
  estado: EstadoColmena;
  dias: number | null;
  tieneFalla: boolean;
  /** Las otras telas del mismo estante (solo en las zonas de repisa). */
  vecinos: ColmenaPano[];
  puedeEditar: boolean;
  onElegir: (p: ColmenaPano) => void;
  onImprimir: () => void;
  onMover: () => void;
  onDarDeBaja: () => void;
  bajando: boolean;
}) {
  if (!pano || !etiqueta) {
    return (
      <div className="flex flex-col rounded-lg border border-border bg-card p-4">
        <EmptyState
          titulo="Paño seleccionado"
          texto="Haz clic en una celda del mapa para ver la medida, de qué OT salió y cuánto lleva ahí."
        />
      </div>
    );
  }

  const badge = BADGE_ESTADO[estado];
  const caja = cajaAEscala(pano.medida_ancho, pano.medida_alto, MAX_DIBUJO_PX);
  const familia = nombreFamiliaPano(pano.codigo);
  const nombre = pano.datos_extra?.nemotecnico;
  const consejo = consejoDelPano({ estado, dias, familia });
  const sirve = sirveParaTexto(etiqueta.funcional);
  const ingreso = fechaLarga(etiqueta.fechaISO);

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-serif text-[0.9375rem] font-medium">Paño seleccionado</h2>
        <div className="ml-auto flex gap-1.5">
          {tieneFalla && <Badge variant="destructive">Con falla</Badge>}
          <Badge variant={badge.variante}>{badge.texto}</Badge>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-base font-semibold">{pano.codigo}</span>
          <span className="truncate text-[0.78rem] text-muted-foreground">{nombre || familia}</span>
        </div>

        {/* El dibujo a escala: el paño se reconoce por su forma antes que por
            sus números. */}
        {caja && (
          <div className="mt-5 flex justify-center pb-1.5">
            <div
              className="relative flex items-center justify-center rounded-[3px] border-[1.5px] border-accent bg-accent/[0.09]"
              style={{ width: caja.ancho, height: caja.alto }}
            >
              <span className="whitespace-nowrap font-mono text-xs font-semibold">
                {medidaTexto(pano.medida_ancho, pano.medida_alto)}
              </span>
              <span className="absolute -top-[15px] left-0 right-0 whitespace-nowrap text-center font-mono text-[9.5px] text-muted-foreground">
                ancho {Math.round(Number(pano.medida_ancho ?? 0))} cm
              </span>
              <span className="absolute left-[calc(100%+6px)] top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
                alto {Math.round(Number(pano.medida_alto ?? 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3">
        <Dato rotulo="Ubicación">
          <span className="font-mono font-medium">{ubicacionTexto(pano)}</span>
        </Dato>
        <Dato rotulo="Serial">
          <span className="font-mono">{etiqueta.serial || '—'}</span>
        </Dato>
        <Dato rotulo="Origen">
          <span title={pano.datos_extra?.fuente || ''}>
            {origenTexto(pano.datos_extra?.fuente)}
          </span>
        </Dato>
        {etiqueta.origen && (
          <Dato rotulo="OT de origen">
            <span className="font-mono text-accent">{etiqueta.origen}</span>
          </Dato>
        )}
        {pano.ot_asignada && (
          <Dato rotulo="Se usó en">
            <span className="font-mono text-accent">OT {pano.ot_asignada}</span>
          </Dato>
        )}
        <Dato rotulo="Ingresó">
          {ingreso ? `${ingreso}${dias != null ? ` · hace ${dias} días` : ''}` : 'sin fecha'}
        </Dato>
        <Dato rotulo="Sirve para">
          {sirve.length > 0 ? (
            <span className="flex flex-wrap justify-end gap-1">
              {sirve.map((s) => (
                <Badge key={s} variant="muted">
                  {s}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">nada: es muy chico</span>
          )}
        </Dato>
      </div>

      {consejo && (
        <div
          className={cn(
            'mt-3 rounded-lg px-3 py-2.5 text-xs leading-relaxed',
            estado === 'alerta'
              ? 'border border-warning/30 bg-warning/[0.1]'
              : 'border border-border bg-secondary/40 text-muted-foreground',
          )}
        >
          {consejo}
        </div>
      )}

      {vecinos.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
            Otras {vecinos.length} en este estante
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vecinos.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onElegir(v)}
                className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6875rem] transition-colors hover:border-accent"
              >
                {v.codigo} · {medidaTexto(v.medida_ancho, v.medida_alto)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-3.5">
        <Button size="sm" onClick={onImprimir}>
          <Printer className="h-3.5 w-3.5" />
          Reimprimir etiqueta
        </Button>
        {puedeEditar && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onMover}>
              Mover
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDarDeBaja}
              disabled={bajando || estado === 'baja'}
              className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/[0.09] hover:text-destructive"
            >
              {bajando ? '…' : 'Dar de baja'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default PanelPano;
