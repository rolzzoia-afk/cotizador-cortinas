// La colmena dibujada como el rack físico (lámina «Colmena de paños»).
//
// Cada celda es una posición real del galpón: el color dice la familia de la
// tela y el borde naranja, que el paño lleva más de 90 días ahí. Las zonas de
// estante (Rolzzo) no tienen grilla —una repisa guarda varias telas—, así que
// se dibujan como estantes y el clic abre la lista.

import { cn } from '@/lib/utils';
import type { ColmenaPano } from '@/modules/admin/colmena';
import { medidaTexto } from '@/modules/inventario/colmenaVista';
import {
  claveCelda,
  tipoDeCodigo,
  tipoDominante,
  ZONAS,
  type MapaRack,
  type SlotGalpon,
  type TipoTela,
  type ZonaAgrupada,
} from '@/modules/telas/colmenaViva';

/** El relleno de cada familia. Tinte del tema, no colores sueltos. */
export const RELLENO_FAMILIA: Record<TipoTela, string> = {
  BK: 'bg-foreground/[0.09]',
  DU: 'bg-accent/[0.16]',
  SC: 'bg-success/[0.16]',
  TR: 'bg-warning/[0.16]',
  OTRO: 'bg-secondary',
};

export type EstadoCelda = {
  /** Más de los días de alerta sin usarse: borde naranja. */
  alerta: boolean;
  /** La tela tiene una falla sin resolver. */
  falla: boolean;
  /** Lo apaga un filtro (por ejemplo, «solo disponibles»). */
  apagado: boolean;
  /** Lo encontró la búsqueda o la medida pedida. */
  resaltado: boolean;
};

function clasesDeCelda(p: ColmenaPano, e: EstadoCelda, elegido: boolean): string {
  return cn(
    'flex h-[41px] flex-col items-center justify-center gap-px overflow-hidden rounded-[5px] border border-border px-0.5 leading-none transition-colors',
    e.falla ? 'bg-destructive/[0.16]' : RELLENO_FAMILIA[tipoDeCodigo(p.codigo)],
    e.alerta && 'border-warning/60 shadow-[inset_0_0_0_1px_hsl(var(--warning)/0.35)]',
    e.resaltado && 'border-accent ring-2 ring-accent/40',
    elegido && 'border-accent ring-2 ring-accent',
    e.apagado && 'opacity-25',
    !p.disponible && !e.apagado && 'opacity-60',
  );
}

function Celda({
  p,
  estado,
  elegido,
  onClick,
}: {
  p: ColmenaPano;
  estado: EstadoCelda;
  elegido: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${p.codigo} · ${medidaTexto(p.medida_ancho, p.medida_alto)} cm${p.disponible ? '' : ' · usado'}`}
      className={clasesDeCelda(p, estado, elegido)}
    >
      <b className="max-w-full truncate font-mono text-[10px] font-semibold tracking-tight">
        {p.codigo}
      </b>
      <span className="max-w-full truncate font-mono text-[8.5px] text-muted-foreground">
        {medidaTexto(p.medida_ancho, p.medida_alto)}
      </span>
    </button>
  );
}

/** Una posición del rack sin nada dentro. */
function CeldaLibre() {
  return <div className="h-[41px] rounded-[5px] border border-dashed border-border/70 bg-secondary/40" />;
}

function Rack({
  rack,
  filaPrefix,
  filaDesc,
  estadoDe,
  elegidoId,
  onElegir,
}: {
  rack: MapaRack;
  filaPrefix: string;
  filaDesc: boolean;
  estadoDe: (p: ColmenaPano) => EstadoCelda;
  elegidoId: string | null;
  onElegir: (p: ColmenaPano) => void;
}) {
  const filas = filaDesc ? [...rack.filas].reverse() : rack.filas;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-center text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        Rack {rack.rack}
      </div>
      <div
        className="grid items-center gap-[3px]"
        style={{
          gridTemplateColumns: `20px repeat(${rack.cols.length}, minmax(0, 1fr))`,
        }}
      >
        {filas.map((fila) => (
          <FilaRack
            key={fila}
            rack={rack}
            fila={fila}
            rotulo={`${filaPrefix}${fila}`}
            estadoDe={estadoDe}
            elegidoId={elegidoId}
            onElegir={onElegir}
          />
        ))}
      </div>
    </div>
  );
}

function FilaRack({
  rack,
  fila,
  rotulo,
  estadoDe,
  elegidoId,
  onElegir,
}: {
  rack: MapaRack;
  fila: number;
  rotulo: string;
  estadoDe: (p: ColmenaPano) => EstadoCelda;
  elegidoId: string | null;
  onElegir: (p: ColmenaPano) => void;
}) {
  return (
    <>
      <span className="pr-[3px] text-right text-[9px] text-muted-foreground">{rotulo}</span>
      {rack.cols.map((col) => {
        const p = rack.celdas.get(claveCelda(fila, col));
        if (!p) return <CeldaLibre key={col} />;
        return (
          <Celda
            key={col}
            p={p}
            estado={estadoDe(p)}
            elegido={elegidoId === p.id}
            onClick={() => onElegir(p)}
          />
        );
      })}
    </>
  );
}

function Estante({
  slot,
  estadoDe,
  elegidoId,
  onElegir,
}: {
  slot: SlotGalpon;
  estadoDe: (p: ColmenaPano) => EstadoCelda;
  elegidoId: string | null;
  onElegir: (p: ColmenaPano) => void;
}) {
  // Un estante guarda varias telas: se pinta con la familia que manda y el
  // clic abre la primera; la lista completa la muestra el panel.
  //
  // El estado se calcula UNA vez por tela: Rolzzo tiene más de mil paños y
  // preguntarlo cuatro veces por cada uno se nota al desplazar.
  const estados = slot.panos.map((p) => [p, estadoDe(p)] as const);
  const dentro = estados.filter(([, e]) => !e.apagado).map(([p]) => p);
  const familia = tipoDominante(slot.panos);
  const alerta = estados.some(([, e]) => e.alerta);
  const falla = estados.some(([, e]) => e.falla);
  const resaltado = estados.some(([, e]) => e.resaltado);
  const elegido = slot.panos.some((p) => p.id === elegidoId);
  const primero = dentro[0] ?? slot.panos[0];

  return (
    <button
      type="button"
      onClick={() => primero && onElegir(primero)}
      title={`${slot.slot} · ${slot.panos.length} tela${slot.panos.length === 1 ? '' : 's'}`}
      className={cn(
        'flex h-[41px] w-[64px] flex-col items-center justify-center gap-px rounded-[5px] border border-border leading-none transition-colors',
        falla ? 'bg-destructive/[0.16]' : RELLENO_FAMILIA[familia],
        alerta && 'border-warning/60',
        resaltado && 'border-accent ring-2 ring-accent/40',
        elegido && 'border-accent ring-2 ring-accent',
        dentro.length === 0 && 'opacity-25',
      )}
    >
      <b className="font-mono text-[10px] font-semibold">{slot.slot}</b>
      <span className="font-mono text-[8.5px] text-muted-foreground">
        {dentro.length} tela{dentro.length === 1 ? '' : 's'}
      </span>
    </button>
  );
}

export function GrillaColmena({
  zona,
  estadoDe,
  elegidoId,
  onElegir,
}: {
  zona: ZonaAgrupada;
  estadoDe: (p: ColmenaPano) => EstadoCelda;
  elegidoId: string | null;
  onElegir: (p: ColmenaPano) => void;
}) {
  const cfg = ZONAS[zona.zona];

  return (
    <div className="flex flex-col gap-3.5">
      {zona.modo === 'grid' ? (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {zona.racks.map((r) => (
            <Rack
              key={r.rack}
              rack={r}
              filaPrefix={cfg?.filaPrefix ?? ''}
              filaDesc={cfg?.filaDesc ?? false}
              estadoDe={estadoDe}
              elegidoId={elegidoId}
              onElegir={onElegir}
            />
          ))}
        </div>
      ) : (
        zona.sectores.map((sec) => (
          <div key={sec.pref}>
            <div className="mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Sector {sec.pref}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sec.slots.map((s) => (
                <Estante
                  key={s.slot}
                  slot={s}
                  estadoDe={estadoDe}
                  elegidoId={elegidoId}
                  onElegir={onElegir}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {zona.huerfanos.length > 0 && (
        <div className="rounded-lg border border-warning/35 bg-warning/[0.09] px-3 py-2.5 text-xs">
          <div className="mb-1.5 font-medium">
            {zona.huerfanos.length} paño{zona.huerfanos.length === 1 ? '' : 's'} sin una posición que
            se entienda
          </div>
          <div className="flex flex-wrap gap-1.5">
            {zona.huerfanos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onElegir(p)}
                className={cn(
                  'rounded border border-border px-1.5 py-0.5 font-mono text-[0.6875rem] transition-colors hover:border-accent',
                  elegidoId === p.id && 'border-accent bg-accent/[0.12]',
                )}
              >
                {p.codigo} · {p.ubicacion || 'sin ubicación'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GrillaColmena;
