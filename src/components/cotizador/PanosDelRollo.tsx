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

import { useId } from 'react';
import { Scissors, RotateCw, Archive, Rows3, TriangleAlert } from 'lucide-react';
import {
  panosFisicos,
  type PanoDibujado,
  type PiezaDibujada,
  type SobranteDibujado,
} from '@/modules/cotizador/layoutPano';
import {
  resumenLibres,
  type FuncionalSobrante,
  type RectLibre,
} from '@/modules/produccion/salidasCorte';

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
/** Los cm² de la tela perdida se leen en metros cuadrados: «1,14 m²». */
const m2 = (cm2: number) => (cm2 / 10000).toFixed(2).replace('.', ',');

// Lo que queda del tiro se pinta con su semáforo: verde si vuelve al rack,
// rojo si es pérdida. Son los mismos dos destinos del cierre del corte.
const VERDE_SOBRANTE = '#22c55e';
const ROJO_MERMA = '#ef4444';
const colorSobrante = (s: SobranteDibujado) =>
  s.clase === 'sobrante' ? VERDE_SOBRANTE : ROJO_MERMA;

/** «SOBRANTE (ROLLER)» · «SOBRANTE (AMBAS)» · «MERMA». */
function rotuloSobrante(s: SobranteDibujado): string {
  if (s.clase === 'merma') return 'MERMA';
  return `SOBRANTE (${paraQue(s.funcional).toUpperCase()})`;
}

/** «roller y vertical» · «roller» · «vertical» — para qué alcanza el trozo. */
function paraQue(f: FuncionalSobrante): string {
  if (f.roller && f.vertical) return 'roller y vertical';
  return f.roller ? 'roller' : 'vertical';
}

/** «29 lamas + 2 de repuesto · lama 8,9 cm · alto final 222 cm». */
function textoLamas(p: PiezaDibujada): string {
  if (!p.lamas) return 'Se corta en lamas de 8,9 cm.';
  const { total, repuesto, anchoLamaCm, altoFinalCm } = p.lamas;
  const partes = [
    `${total} ${total === 1 ? 'lama' : 'lamas'}${repuesto > 0 ? ` + ${repuesto} de repuesto` : ''}`,
    `lama ${fmt(anchoLamaCm)} cm`,
  ];
  if (altoFinalCm) partes.push(`alto final ${fmt(altoFinalCm)} cm`);
  return partes.join(' · ');
}

/**
 * El cajón de la pizarra: ancho arriba, alto a la izquierda, ubicación adentro.
 *
 *        145,8
 *   275 ┌──────┐
 *       │ PPAL │
 *       └──────┘
 */
function CajonPizarra({
  pieza,
  color,
  esVertical,
}: {
  pieza: PiezaDibujada;
  color: string;
  esVertical: boolean;
}) {
  // La vertical se raya: ese cajón no es un paño, son lamas de 8,9 cm.
  const rayado = esVertical
    ? {
        backgroundImage: `repeating-linear-gradient(90deg, ${color}1f 0 5px, transparent 5px 7px)`,
      }
    : undefined;
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
        style={{ borderColor: color, color, ...rayado }}
        title={
          esVertical
            ? `Vertical: se corta en lamas de ${fmt(pieza.lamas?.anchoLamaCm ?? 8.9)} cm`
            : pieza.invertida
              ? 'Invertida: viene marcada así en la ficha'
              : pieza.girada
                ? 'Girada por el acomodo para que entrara en este paño; en la ficha NO va invertida'
                : undefined
        }
      >
        {pieza.invertida && '↺ '}
        {pieza.nombre}
        {/* El giro del acomodo se rotula con la palabra y no con la flecha de
            «invertida»: son decisiones distintas y el taller las confundía. */}
        {!pieza.invertida && pieza.girada && (
          <span className="ml-1.5 font-sans text-[0.62rem] font-semibold text-warning">
            ⟳ GIRADA
          </span>
        )}
        {esVertical && pieza.lamas && (
          <span className="ml-1.5 font-sans text-[0.62rem] font-semibold opacity-80">
            {pieza.lamas.total} lamas
          </span>
        )}
      </span>
    </div>
  );
}

/** El tiro con sus cortinas, a escala. Todo en el color de plumón de su tela. */
function DibujoPano({ pano, color }: { pano: PanoDibujado; color: string }) {
  const uid = useId().replace(/:/g, '');
  const { anchoRolloCm: W, altoPanoCm: H } = pano;
  if (W <= 0 || H <= 0) return null;
  // El tiro es MUY alargado (300 × 1500 no cabe en pantalla): se dibuja con
  // proporción real pero con un alto máximo, que es como se lee mejor.
  const anchoPx = 260;
  const altoPx = Math.max(60, Math.min(340, (H / W) * anchoPx));
  const ex = anchoPx / W;
  const ey = altoPx / H;
  const sob = pano.sobrante;

  return (
    <svg
      viewBox={`0 0 ${anchoPx} ${altoPx}`}
      width={anchoPx}
      height={altoPx}
      className="rounded border border-border bg-muted/30"
      role="img"
      aria-label={`Paño ${pano.letra}: ${pano.piezas.length} cortinas${
        sob ? `, queda ${sob.anchoCm} por ${sob.altoCm} cm de ${sob.clase}` : ''
      }`}
    >
      {/* Rayado para lo que NO es cortina: la franja que queda y los huecos. */}
      <defs>
        {[
          ['sob', VERDE_SOBRANTE],
          ['mer', ROJO_MERMA],
        ].map(([k, c]) => (
          <pattern
            key={k}
            id={`ray-${k}-${uid}`}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={6} height={6} fill={c} fillOpacity={0.1} />
            <line x1={0} y1={0} x2={0} y2={6} stroke={c} strokeWidth={1.6} strokeOpacity={0.5} />
          </pattern>
        ))}
      </defs>

      {/* TODO lo que no es cortina, con su semáforo: verde si vuelve al rack,
          rojo si se perdió. Nada queda en negro ni en gris — la tela del tiro
          que no se usa es merma, y acá se ve dónde está. */}
      {pano.libres.map((r, i) => {
        const x = r.x * ex;
        const y = r.y * ey;
        const w = r.anchoCm * ex;
        const h = r.altoCm * ey;
        const c = r.clase === 'sobrante' ? VERDE_SOBRANTE : ROJO_MERMA;
        // El verde dice para qué alcanza: una franja pintada de verde sin
        // destino no le sirve a nadie en la mesa.
        const rotulo =
          r.clase === 'sobrante'
            ? `SOBRA ${fmt(r.anchoCm)}×${fmt(r.altoCm)} · ${paraQue(r.funcional).toUpperCase()}`
            : `MERMA ${fmt(r.anchoCm)}×${fmt(r.altoCm)}`;
        // En una franja alta y angosta el rótulo va girado, como en la pizarra.
        const girado = h > w;
        const largo = rotulo.length * 4.3;
        const cabe = girado ? h > largo && w > 11 : w > largo && h > 11;
        return (
          <g key={`libre-${i}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={`url(#ray-${r.clase === 'sobrante' ? 'sob' : 'mer'}-${uid})`}
              stroke={c}
              strokeWidth={0.8}
              strokeDasharray="3 2"
            />
            {cabe && (
              <text
                transform={girado ? `rotate(-90 ${x + w / 2} ${y + h / 2})` : undefined}
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={c}
                fontSize={7}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {rotulo}
              </text>
            )}
          </g>
        );
      })}

      {pano.piezas.map((p, i) => {
        const x = p.px * ex;
        const y = p.py * ey;
        const w = p.pw * ex;
        const h = p.ph * ey;
        const nombre = p.invertida ? `↺ ${p.nombre}` : p.girada ? `⟳ ${p.nombre}` : p.nombre;
        // La vertical no es un paño liso: de ese trozo salen tiras de 8,9 cm.
        const pasoLama = pano.esVertical ? (p.lamas?.anchoLamaCm ?? 8.9) * ex : 0;
        const rayasLama =
          pasoLama > 2.5 && w / pasoLama < 90
            ? Array.from({ length: Math.max(0, Math.ceil(w / pasoLama) - 1) }, (_, k) =>
                x + (k + 1) * pasoLama,
              )
            : [];
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
            {rayasLama.map((lx, k) => (
              <line
                key={k}
                x1={lx}
                x2={lx}
                y1={y}
                y2={y + h}
                stroke={color}
                strokeWidth={0.7}
                strokeOpacity={0.55}
                strokeDasharray="2 2"
              />
            ))}
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
  // La cuenta completa del tiro: lo que vuelve al rack y lo que se perdió.
  const { sobranteCm2, mermaCm2 } = resumenLibres(pano.libres);
  const areaTiro = pano.anchoRolloCm * pano.altoPanoCm;
  const pctMerma = areaTiro > 0 ? Math.round((mermaCm2 / areaTiro) * 100) : 0;
  // Los trozos que vuelven al rack, cada uno con para qué alcanza. La franja
  // del costado (`pano.sobrante`) ya tiene su propia línea: no se repite.
  const franja = pano.sobrante;
  const mismaQueLaFranja = (r: RectLibre) =>
    !!franja &&
    Math.abs(r.anchoCm - franja.anchoCm) < 1.5 &&
    Math.abs(r.altoCm - franja.altoCm) < 1.5;
  const vuelvenAlRack = pano.libres.filter((r) => r.clase === 'sobrante' && !mismaQueLaFranja(r));
  // Las que el ACOMODO acostó (≠ invertidas de la ficha, que sí salen en Fase 1).
  const giradas = pano.piezas.filter((p) => !p.invertida && p.girada);
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
            {/* El del rack no es un tiro: la tela ya está cortada. */}
            {pano.colmena ? 'Paño de' : 'Tiro de'} {fmt(pano.anchoRolloCm)} ×{' '}
            <strong>{fmt(pano.altoPanoCm)} cm</strong>
          </p>
          {/* Lo que queda del tiro, con el mismo criterio del cierre del corte:
              es la plata que vuelve al rack o la que se pierde. */}
          {pano.sobrante && (
            <p
              className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold"
              style={{
                color: colorSobrante(pano.sobrante),
                borderColor: colorSobrante(pano.sobrante) + '66',
                backgroundColor: colorSobrante(pano.sobrante) + '1a',
              }}
            >
              queda {fmt(pano.sobrante.anchoCm)} × {fmt(pano.sobrante.altoCm)} cm →{' '}
              {rotuloSobrante(pano.sobrante)}
            </p>
          )}
          {/* Lo que se pierde de VERDAD: la franja más los huecos de adentro. */}
          {mermaCm2 > 0 && (
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              se pierden{' '}
              <strong style={{ color: ROJO_MERMA }}>
                {m2(mermaCm2)} m² ({pctMerma} %)
              </strong>
              {sobranteCm2 > 0 && <> · vuelven al rack {m2(sobranteCm2)} m²</>}
            </p>
          )}
        </div>
      </div>

      {/* Los cajones de la pizarra, uno por cortina. */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {pano.piezas.map((p, i) => (
          <CajonPizarra key={i} pieza={p} color={color} esVertical={pano.esVertical} />
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

          {/* La vertical no se corta como paño: de ahí salen las tiras. */}
          {pano.esVertical &&
            pano.piezas.map((p, i) => (
              <p
                key={`lamas-${i}`}
                className="flex items-start gap-1.5 rounded border border-success/30 bg-success/10 p-1.5 text-[0.7rem] text-success"
              >
                <Rows3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {n > 1 && <strong>{p.nombre}: </strong>}
                  {textoLamas(p)}
                </span>
              </p>
            ))}

          {/* El giro del acomodo NO está en la ficha: quien lo busque en Fase 1
              no lo va a encontrar, así que la tarjeta lo dice. */}
          {giradas.length > 0 && (
            <p className="flex items-start gap-1.5 rounded border border-warning/40 bg-warning/10 p-1.5 text-[0.7rem] text-warning">
              <RotateCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{giradas.map((p) => p.nombre).join(', ')}</strong>{' '}
                {giradas.length === 1 ? 'va acostada' : 'van acostadas'} en el paño: el acomodo{' '}
                {giradas.length === 1 ? 'la giró' : 'las giró'} para que{' '}
                {giradas.length === 1 ? 'entrara' : 'entraran'}. Es una decisión del taller y se
                autoriza en el Plan de Corte: no es la columna INVERTIDA de la cotización, que ahí
                puede ir sin marcar.
              </span>
            </p>
          )}

          {franja && (
            <p className="text-[0.7rem]" style={{ color: colorSobrante(franja) }}>
              Del tiro queda una franja de{' '}
              <strong>
                {fmt(franja.anchoCm)} × {fmt(franja.altoCm)} cm
              </strong>
              {franja.clase === 'sobrante'
                ? ` → sirve para ${paraQue(franja.funcional)}; se guarda al cerrar el corte.`
                : ' → merma: no alcanza para otra cortina.'}
            </p>
          )}

          {/* Cada trozo verde con su destino: si no, el operario ve una franja
              pintada de verde y no sabe si guardarla ni para qué sirve. */}
          {vuelvenAlRack.map((r, i) => (
            <p key={`rack-${i}`} className="text-[0.7rem]" style={{ color: VERDE_SOBRANTE }}>
              Vuelve al rack:{' '}
              <strong>
                {fmt(r.anchoCm)} × {fmt(r.altoCm)} cm
              </strong>{' '}
              → sirve para {paraQue(r.funcional)}; se guarda al cerrar el corte.
            </p>
          ))}

          {/* Lo que se pierde de VERDAD: tela pagada que no vuelve a usarse. */}
          {mermaCm2 > 0 && (
            <p className="text-[0.7rem]" style={{ color: ROJO_MERMA }}>
              Se pierden{' '}
              <strong>
                {m2(mermaCm2)} m² ({pctMerma} %)
              </strong>
              : los rayados rojos del dibujo{' '}
              {n > 1
                ? '— lo que queda al costado y entre las cortinas'
                : '— lo que queda alrededor de la cortina'}
              . No alcanza para otra.
            </p>
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
  const mermaTotal = panos.reduce((s, p) => s + resumenLibres(p.libres).mermaCm2, 0);
  // Paños = trozos que se bajan del rollo, que es lo que el taller cuenta.
  const nPanos = panosFisicos(panos);
  // Los del rack se cuentan aparte: no bajan rollo, pero se van a buscar igual.
  const nColmena = panos.filter((p) => p.colmena).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Scissors className="h-4 w-4" />
          {titulo}
        </h3>
        <p className="text-xs text-muted-foreground">
          {nPanos} {nPanos === 1 ? 'paño' : 'paños'} de rollo
          {nColmena > 0 && (
            <> + {nColmena} {nColmena === 1 ? 'paño' : 'paños'} del rack</>
          )}{' '}
          · {cortinas} {cortinas === 1 ? 'cortina' : 'cortinas'} · {fmt(metros)} m de rollo
          {mermaTotal > 0 && (
            <>
              {' '}
              · se pierden <strong style={{ color: ROJO_MERMA }}>{m2(mermaTotal)} m²</strong>
            </>
          )}
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
        const nRack = g.panos.filter((p) => p.colmena).length;
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
                {panosFisicos(g.panos)} {panosFisicos(g.panos) === 1 ? 'paño' : 'paños'}
                {nRack > 0 && <> + {nRack} del rack</>} · {nCort}{' '}
                {nCort === 1 ? 'cortina' : 'cortinas'}
                {m > 0 && <> · {fmt(m)} m</>}
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {g.panos.map((p) => (
                <CardPano key={`${p.letra}-${p.pano}-${p.codInt}`} pano={p} color={g.color} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
