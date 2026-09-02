// Los paños que bajan del rollo, dibujados: qué cortinas salen de cada tiro y
// en qué orden se parte. Es lo que el dimensionador tiene delante cuando le
// entregan la tela enrollada desde la mesa de corte.
//
// El formato copia LA PIZARRA que el equipo de dimensionado usa hoy, para que
// se lea sin aprender nada nuevo:
//   · el título es el cliente y la OT, grande («Mariana 3213»);
//   · cada TELA es una sección con su color de plumón (SC-65 azul, BK-63
//     naranjo, BK-73 verde…);
//   · cada cortina es un cajón: el ANCHO arriba, el ALTO a la izquierda y la
//     UBICACIÓN adentro, con la coma decimal de siempre.
// Lo que la pizarra no puede mostrar se agrega al lado: el dibujo del tiro a
// escala y el orden de los cortes.
//
// Se dibuja en SVG (no canvas) para que escale solo en la tablet del galpón y
// respete el tema; los colores van inline porque son de dato, no de diseño.

import { Scissors, RotateCw, Archive, TriangleAlert } from 'lucide-react';
import type { PanoDibujado, PiezaDibujada } from '@/modules/cotizador/layoutPano';

// Colores de plumón, en orden de aparición de cada tela: azul, naranjo, verde…
// como los usa la pizarra. El color es DE LA TELA, no de la pieza.
const PLUMONES = [
  '#4080ff',
  '#f97316',
  '#20d164',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#f5a623',
  '#14d4c0',
];

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/**
 * El cajón de la pizarra: ancho arriba, alto a la izquierda, ubicación adentro.
 *
 *        145,8
 *   275 ┌──────┐
 *       │ PPAL │
 *       └──────┘
 */
function CajonPizarra({ pieza, color }: { pieza: PiezaDibujada; color: string }) {
  return (
    <div className="grid grid-cols-[auto_auto] items-center gap-x-1.5 gap-y-0.5">
      <span />
      <span className="text-center font-mono text-[0.72rem] font-bold" style={{ color }}>
        {fmt(pieza.anchoCm)}
      </span>
      <span className="text-right font-mono text-[0.72rem] font-bold" style={{ color }}>
        {fmt(pieza.altoCorteCm)}
      </span>
      <span
        className="rounded-sm border-2 px-2.5 py-1 text-center font-mono text-xs font-bold uppercase"
        style={{ borderColor: color, color }}
        title={pieza.invertida ? 'Invertida: se corta girada' : undefined}
      >
        {pieza.invertida && '↺ '}
        {pieza.nombre}
      </span>
    </div>
  );
}

/** El tiro con sus cortinas, a escala. Todo en el color de plumón de su tela. */
function DibujoPano({ pano, color }: { pano: PanoDibujado; color: string }) {
  const { anchoRolloCm: W, altoPanoCm: H } = pano;
  if (W <= 0 || H <= 0) return null;
  // El tiro es MUY alargado (300 × 1500 no cabe en pantalla): se dibuja con
  // proporción real pero con un alto máximo, que es como se lee mejor.
  const anchoPx = 260;
  const altoPx = Math.max(60, Math.min(340, (H / W) * anchoPx));
  const ex = anchoPx / W;
  const ey = altoPx / H;

  return (
    <svg
      viewBox={`0 0 ${anchoPx} ${altoPx}`}
      width={anchoPx}
      height={altoPx}
      className="rounded border border-border bg-muted/30"
      role="img"
      aria-label={`Paño ${pano.letra}: ${pano.piezas.length} cortinas`}
    >
      {pano.piezas.map((p, i) => {
        const x = p.px * ex;
        const y = p.py * ey;
        const w = p.pw * ex;
        const h = p.ph * ey;
        const nombre = p.invertida ? `↺ ${p.nombre}` : p.nombre;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={color + '26'}
              stroke={color}
              strokeWidth={1}
            />
            {w > 34 && h > 22 && (
              <>
                {/* Como en la pizarra: la medida a lo ancho arriba… */}
                <text
                  x={x + w / 2}
                  y={y + 9}
                  textAnchor="middle"
                  fill={color}
                  fontSize={7.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {fmt(p.pw)}
                </text>
                {/* …la ubicación al centro… */}
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {nombre.length > 13 ? nombre.slice(0, 12) + '…' : nombre}
                </text>
                {/* …y la medida a lo largo por el costado izquierdo. */}
                {h > 44 && (
                  <text
                    transform={`rotate(-90 ${x + 8} ${y + h / 2})`}
                    x={x + 8}
                    y={y + h / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={color}
                    fontSize={7.5}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {fmt(p.ph)}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      {/* Los cortes, punteados sobre el dibujo. */}
      {(pano.cortes ?? []).map((c) =>
        c.eje === 'transversal' ? (
          <line
            key={c.n}
            x1={c.region.x * ex}
            x2={(c.region.x + c.region.w) * ex}
            y1={(c.region.y + c.posicionCm) * ey}
            y2={(c.region.y + c.posicionCm) * ey}
            stroke="#f87171"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        ) : (
          <line
            key={c.n}
            y1={c.region.y * ey}
            y2={(c.region.y + c.region.h) * ey}
            x1={(c.region.x + c.posicionCm) * ex}
            x2={(c.region.x + c.posicionCm) * ex}
            stroke="#f87171"
            strokeWidth={1.2}
            strokeDasharray="4 3"
          />
        ),
      )}
      <rect
        x={0.5}
        y={0.5}
        width={anchoPx - 1}
        height={altoPx - 1}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.25}
      />
    </svg>
  );
}

function CardPano({ pano, color }: { pano: PanoDibujado; color: string }) {
  const n = pano.piezas.length;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-base font-bold text-primary">
            {pano.letra}
          </span>
          {pano.esVertical && (
            <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[0.65rem] text-success">
              VERTICAL
            </span>
          )}
          {pano.colmena && (
            <span className="flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[0.65rem] text-warning">
              <Archive className="h-3 w-3" /> colmena {pano.colmena}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">
            {n === 1 ? 'Sale 1 cortina' : `Salen ${n} cortinas`}
          </p>
          <p className="text-xs text-muted-foreground">
            Tiro de {fmt(pano.anchoRolloCm)} × <strong>{fmt(pano.altoPanoCm)} cm</strong>
          </p>
        </div>
      </div>

      {/* Los cajones de la pizarra, uno por cortina. */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {pano.piezas.map((p, i) => (
          <CajonPizarra key={i} pieza={p} color={color} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <DibujoPano pano={pano} color={color} />
        <div className="min-w-[14rem] flex-1 space-y-2">
          {pano.cortes === null ? (
            <p className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2 text-[0.7rem] text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Este acomodo no se puede cortar de punta a punta: hay que separarlo a mano. Pasa solo
              con la cortadora automática configurada.
            </p>
          ) : pano.cortes.length === 0 ? (
            <p className="text-[0.7rem] text-muted-foreground">
              Una sola cortina: se limpia el paño y queda a la medida.
            </p>
          ) : (
            <ol className="space-y-0.5 text-[0.7rem] text-muted-foreground">
              {pano.cortes.map((c) => (
                <li key={c.n} className="flex gap-1.5">
                  <span className="font-mono font-semibold text-foreground">{c.n}.</span>
                  <span>
                    {c.girar && (
                      <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-warning/15 px-1 font-semibold text-warning">
                        <RotateCw className="h-3 w-3" /> girar
                      </span>
                    )}
                    Corte {c.eje} a <strong className="text-foreground">{c.posicionCm} cm</strong> →
                    deja {c.deja[0]} | {c.deja[1]}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

type GrupoTela = {
  codInt: string;
  producto: string;
  color: string;
  panos: PanoDibujado[];
};

/** Una sección por tela, en orden de aparición, cada una con su plumón. */
function agruparPorTela(panos: PanoDibujado[]): GrupoTela[] {
  const grupos = new Map<string, GrupoTela>();
  for (const p of panos) {
    let g = grupos.get(p.codInt);
    if (!g) {
      g = {
        codInt: p.codInt,
        producto: p.producto,
        color: PLUMONES[grupos.size % PLUMONES.length],
        panos: [],
      };
      grupos.set(p.codInt, g);
    }
    g.panos.push(p);
  }
  return [...grupos.values()];
}

/**
 * Los paños de tela que se bajan del rollo para esta OT, en el formato de la
 * pizarra del dimensionado. `cliente` y `numeroOT` arman el título grande;
 * `titulo` y `nota` dejan adaptar el encabezado a la pantalla que lo muestre.
 */
export default function PanosDelRollo({
  panos,
  titulo = 'Paños que llegan del rollo',
  nota,
  cliente,
  numeroOT,
}: {
  panos: PanoDibujado[];
  titulo?: string;
  nota?: string;
  cliente?: string;
  numeroOT?: string;
}) {
  if (panos.length === 0) return null;
  const cortinas = panos.reduce((s, p) => s + p.piezas.length, 0);
  const metros = panos.reduce((s, p) => s + (p.colmena ? 0 : p.altoPanoCm), 0) / 100;
  const grupos = agruparPorTela(panos);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Scissors className="h-4 w-4" />
          {titulo}
        </h3>
        <p className="text-xs text-muted-foreground">
          {panos.length} {panos.length === 1 ? 'paño' : 'paños'} · {cortinas}{' '}
          {cortinas === 1 ? 'cortina' : 'cortinas'} · {fmt(metros)} m de rollo
        </p>
      </div>

      {/* El título de la pizarra: cliente y OT, grandes y al centro. */}
      {(cliente || numeroOT) && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
          {cliente && <span className="text-lg font-bold">{cliente}</span>}
          {numeroOT && <span className="ml-3 text-lg font-bold text-primary">{numeroOT}</span>}
        </div>
      )}

      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}

      {grupos.map((g) => {
        const nCort = g.panos.reduce((s, p) => s + p.piezas.length, 0);
        const m = g.panos.reduce((s, p) => s + (p.colmena ? 0 : p.altoPanoCm), 0) / 100;
        return (
          <div key={g.codInt} className="space-y-2">
            <div
              className="flex flex-wrap items-baseline gap-2 border-b-2 pb-1"
              style={{ borderColor: g.color }}
            >
              <span
                className="font-mono text-base font-extrabold tracking-wide"
                style={{ color: g.color }}
              >
                {g.codInt}
              </span>
              <span className="text-xs text-muted-foreground">{g.producto}</span>
              <span className="ml-auto text-[0.7rem] text-muted-foreground">
                {g.panos.length} {g.panos.length === 1 ? 'paño' : 'paños'} · {nCort}{' '}
                {nCort === 1 ? 'cortina' : 'cortinas'}
                {m > 0 && <> · {fmt(m)} m</>}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {g.panos.map((p) => (
                <CardPano key={`${p.pano}-${p.codInt}`} pano={p} color={g.color} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
