// ─────────────────────────────────────────────────────────────────────
// EL DIBUJO DE LA CORTINA que se arma solo.
//
// Cada pieza (soportes, tubo, mecanismo, cadena/motor, tela, peso, cenefa)
// entra cuando su paso del wizard queda listo, y se puede clicar para volver a
// ese paso. Las piezas que todavía no existen se dibujan como silueta punteada:
// así el vendedor ve lo que falta y puede saltar ahí de un clic.
//
// La geometría y los easings salen del boceto de referencia; el progreso, en
// cambio, no viene del scroll sino de los datos ya cargados (props), suavizado
// con un solo requestAnimationFrame.
// ─────────────────────────────────────────────────────────────────────
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  clamp01,
  easeBack,
  easeInOut,
  easeOut,
  mezcla,
  NOMBRE_PIEZA,
  PIEZAS_VIZ,
  r3,
  radioRollo,
  VIZ,
  VIZ_W,
  type EstiloViz,
  type PiezaViz,
  type VarianteViz,
} from '@/modules/cotizador/wizard/cortinaViz';

type Props = {
  variante: VarianteViz;
  /** Cuánto lleva armada cada pieza (0..1). Se suaviza dentro del componente. */
  progreso: Partial<Record<PiezaViz, number>>;
  estilo: EstiloViz;
  /** Pieza del paso activo: se destaca. */
  activa?: PiezaViz | null;
  onClickPieza?: (p: PiezaViz) => void;
  className?: string;
};

const { x0, x1, cy, tr, gx0, gx1, gy0, gy1, cola, caidaMax, dualDy, dualFrente } = VIZ;
const RMAX = radioRollo(caidaMax);

/** Aclara/oscurece un hex para armar los degradados del herraje. */
function tono(hex: string, factor: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const mezclar = (canal: number) =>
    Math.max(0, Math.min(255, Math.round(factor >= 0 ? canal + (255 - canal) * factor : canal * (1 + factor))));
  const r = mezclar((n >> 16) & 255);
  const g = mezclar((n >> 8) & 255);
  const b = mezclar(n & 255);
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export const CortinaViz = memo(function CortinaViz({
  variante,
  progreso,
  estilo,
  activa,
  onClickPieza,
  className,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const url = (n: string) => `url(#${id(n)})`;

  // ── Suavizado ──
  // Un solo rAF mueve todas las piezas hacia su target. Con el motor de
  // accesibilidad en "menos movimiento" se salta la animación y se pinta el
  // estado final: el dibujo sigue siendo útil, solo deja de moverse.
  const sinMovimiento =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [p, setP] = useState<Record<string, number>>(() =>
    Object.fromEntries(PIEZAS_VIZ.map((k) => [k, sinMovimiento ? (progreso[k] ?? 0) : 0])),
  );
  const cur = useRef<Record<string, number>>({ ...p });
  const target = useRef(progreso);
  target.current = progreso;

  useEffect(() => {
    if (sinMovimiento) {
      setP(Object.fromEntries(PIEZAS_VIZ.map((k) => [k, progreso[k] ?? 0])));
      return;
    }
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let cambio = false;
      for (const k of PIEZAS_VIZ) {
        const t = target.current[k] ?? 0;
        const d = t - cur.current[k];
        if (Math.abs(d) < 0.0004) {
          if (cur.current[k] !== t) {
            cur.current[k] = t;
            cambio = true;
          }
          continue;
        }
        cur.current[k] += d * 0.13;
        cambio = true;
      }
      if (cambio) setP({ ...cur.current });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sinMovimiento, progreso]);

  const tSop = easeBack(clamp01(p.soportes));
  const tTubo = clamp01(p.tubo);
  const tMec = clamp01(p.mecanismo);
  const tAcc = clamp01(p.accionamiento);
  const tTela = clamp01(p.tela);
  const tPeso = clamp01(p.peso);
  const tDesp = clamp01(p.despliegue);
  const tCen = estilo.cenefa === 'no' ? 0 : clamp01(p.cenefa);
  const tPerf = clamp01(p.perfiles);

  // ── Estado del rollo ──
  const colaAhora = cola * easeOut(clamp01(tTela * 1.35 - 0.25));
  const caida = tDesp > 0 ? mezcla(colaAhora, caidaMax, easeInOut(tDesp)) : colaAhora;
  const envuelto = tTela > 0 ? mezcla(0, caidaMax - cola, easeInOut(clamp01(tTela * 1.25))) : 0;
  const enrollado = tDesp > 0 ? Math.max(0, caidaMax - caida) : envuelto;
  // El OSCURANTI monta tubo de 63 mm: se dibuja más gordo que el resto.
  const trE = variante === 'oscuranti' ? tr + 9 : tr;
  const radio = tTela > 0.02 ? Math.max(radioRollo(enrollado), trE) : trE;
  const barraY = cy + caida;
  const telaTop = cy + radio * 0.5;
  const telaH = Math.max(0, barraY - telaTop);

  // ── Dual: el segundo rollo ──
  // Son dos cortinas en un bracket, así que se dibujan las dos: la del vidrio
  // (paño 1, la screen) baja entera y la de adelante (paño 2, el blackout)
  // queda a media ventana. Es como se usa —y la única manera de ver las dos
  // telas de un vistazo (pedido del dueño 2026-08-20).
  const esDual = variante === 'dual';
  const cyF = cy + dualDy;
  const caidaF = caida * dualFrente;
  const enrolladoF = tDesp > 0 ? Math.max(0, caidaMax - caidaF) : envuelto;
  const radioF = tTela > 0.02 ? radioRollo(enrolladoF) : tr;
  const barraYF = cyF + caidaF;
  const telaTopF = cyF + radioF * 0.5;
  const telaHF = Math.max(0, barraYF - telaTopF);

  // ── Vertical: riel cabezal + lamas colgando (catálogo de diseños 2026-08-19).
  // Las lamas aparecen una a una con la tela y GIRAN de canto a cerradas con el
  // despliegue, que es como se ve una vertical de verdad al cerrarla.
  const esVertical = variante === 'vertical';
  const LAMA_W = 54;
  const LAMA_PASO = 60;
  const lamasN = Math.floor((VIZ_W - 12) / LAMA_PASO);
  const lamasX0 = x0 + (VIZ_W - (lamasN * LAMA_PASO - (LAMA_PASO - LAMA_W))) / 2;
  const lamaTop = cy + 24;
  const lamaBot = gy1 + 6;
  const lamaWAhora = LAMA_W * mezcla(0.34, 1, easeInOut(tDesp));

  // ── Oscuridad (DARK / SOFT LIGHT / OSCURANTI): el esqueleto del roller más
  // guías laterales, zócalo y cajón. El OSCURANTI solo cambia el tubo (63 mm).
  const esOscuridad = variante === 'oscuridad' || variante === 'oscuranti';

  // ── Beeblack: acordeón que corre de lado dentro de su marco ──
  const esBee = variante === 'beeblack';
  const conRollo = !esVertical && !esBee;
  const beeTop = cy - 10;
  const beeBot = gy1 + 8;
  const PLIEGUE_W = 34;
  // El cierre nombra el RECORRIDO del panel: la base dibuja anclado a la
  // IZQUIERDA cerrando hacia la derecha; 'der-izq' se espeja entero y
  // 'arriba-abajo' baja desde el riel superior (geometría propia).
  const beeCierre = estilo.beeCierre ?? 'izq-der';
  const beeVert = esBee && beeCierre === 'arriba-abajo';
  // Cuánto del vano cubre el panel. En las fotos del panal real (dueño,
  // 2026-08-20) el panel abierto queda COMPRIMIDO contra el riel, casi
  // invisible: el mínimo es chico y los pliegues no desaparecen — son un
  // NÚMERO FIJO que se aprieta (ver BEE_PLIEGUES*).
  const beeAncho = (VIZ_W - 8) * mezcla(0.07, 0.97, easeInOut(tDesp));
  const beeAlto = (beeBot - beeTop - 12) * mezcla(0.07, 0.97, easeInOut(tDesp));
  const beeX0 = x0 + 4;
  const beeY0 = beeTop + 6;
  const BEE_PLIEGUES = Math.max(8, Math.round((VIZ_W - 8) / PLIEGUE_W));
  const BEE_PLIEGUES_V = Math.max(8, Math.round((beeBot - beeTop - 12) / PLIEGUE_W));

  const apertura = esVertical
    ? 1 - easeInOut(tDesp) * clamp01(tTela * 2)
    : esBee
      ? 1 -
        (tTela > 0.02 ? (beeVert ? beeAlto / (beeBot - beeTop - 12) : beeAncho / (VIZ_W - 8)) : 0)
      : 1 - clamp01((barraY - gy0) / (gy1 - gy0));
  // Espejo cuando el mando va a la izquierda (en el beeblack, cuando el cierre
  // corre de derecha a izquierda): se voltea el grupo completo sobre el centro.
  const espejo = esBee ? beeCierre === 'der-izq' : estilo.lado === 'izquierda';
  const flip = `translate(${r3((x0 + x1))},0) scale(-1,1)`;

  const herr = estilo.herrajesHex;
  const patronTela = url('pTela');

  const defs = useMemo(
    () => (
      <defs>
        <linearGradient id={id('gPared')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9e3da" />
          <stop offset="46%" stopColor="#ddd6cc" />
          <stop offset="100%" stopColor="#c8c0b5" />
        </linearGradient>
        <linearGradient id={id('gPiso')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8e7157" />
          <stop offset="100%" stopColor="#5f4a38" />
        </linearGradient>
        <linearGradient id={id('gVidrio')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3f6f4" />
          <stop offset="30%" stopColor="#e2ebe6" />
          <stop offset="54%" stopColor="#cfd8cd" />
          <stop offset="70%" stopColor="#b9c3ae" />
          <stop offset="86%" stopColor="#a9b39f" />
          <stop offset="100%" stopColor="#cdd2c6" />
        </linearGradient>
        <linearGradient id={id('gLuz')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8e6" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#fff8e6" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={id('gVineta')} cx="0.5" cy="0.42" r="0.78">
          <stop offset="58%" stopColor="#000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000" stopOpacity={0.42} />
        </radialGradient>
        <filter id={id('fBlur')} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id={id('fSuave')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={id('fCorto')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id={id('cVidrio')}>
          <rect x={gx0} y={gy0} width={gx1 - gx0} height={gy1 - gy0} />
        </clipPath>
      </defs>
    ),
    // La habitación no depende de los datos de la cortina: se arma una vez.
    [uid],
  );

  /** Textura de UNA tela (se define una por rollo en la dual). */
  const patronTelaDefs = (
    nombre: string,
    hex: string,
    patron: EstiloViz['telaPatron'],
  ): React.ReactNode => {
    if (patron === 'solida') {
      return (
        <pattern key={nombre} id={id(nombre)} width={8} height={8} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill={hex} />
          <rect width={8} height={0.8} fill="#000" opacity={0.05} />
        </pattern>
      );
    }
    if (patron === 'bandas') {
      return (
        <pattern key={nombre} id={id(nombre)} width={12} height={48} patternUnits="userSpaceOnUse">
          <rect width={12} height={48} fill={hex} />
          <rect width={12} height={22} fill="#fff" opacity={0.2} />
          <rect y={22} width={12} height={2} fill="#000" opacity={0.14} />
          <rect y={46} width={12} height={2} fill="#000" opacity={0.14} />
        </pattern>
      );
    }
    return (
      <pattern key={nombre} id={id(nombre)} width={6} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={6} fill={hex} />
        <rect width={6} height={1.4} fill="#000" opacity={0.16} />
        <rect y={3} width={6} height={1.2} fill="#fff" opacity={0.09} />
        <rect width={1.4} height={6} fill="#000" opacity={0.1} />
        <rect x={3.2} width={1.2} height={6} fill="#fff" opacity={0.07} />
        <rect x={1.6} y={1.6} width={1.4} height={1.4} fill="#000" opacity={0.07} />
      </pattern>
    );
  };

  // Degradados que sí dependen del color de accesorios y de la tela.
  const defsColor = (
    <defs>
      <linearGradient id={id('gHerr')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(herr, -0.35)} />
        <stop offset="6%" stopColor={tono(herr, 0.28)} />
        <stop offset="16%" stopColor={tono(herr, 0.45)} />
        <stop offset="30%" stopColor={tono(herr, 0.05)} />
        <stop offset="62%" stopColor={tono(herr, -0.15)} />
        <stop offset="88%" stopColor={tono(herr, -0.35)} />
        <stop offset="100%" stopColor={tono(herr, -0.5)} />
      </linearGradient>
      <linearGradient id={id('gHerrPlano')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(herr, 0.12)} />
        <stop offset="40%" stopColor={tono(herr, -0.05)} />
        <stop offset="100%" stopColor={tono(herr, -0.4)} />
      </linearGradient>
      <linearGradient id={id('gTapa')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={tono(herr, 0.3)} />
        <stop offset="46%" stopColor={tono(herr, -0.08)} />
        <stop offset="100%" stopColor={tono(herr, -0.45)} />
      </linearGradient>
      <linearGradient id={id('gTubo')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(herr, -0.2)} />
        <stop offset="12%" stopColor={tono(herr, 0.35)} />
        <stop offset="28%" stopColor={tono(herr, 0.6)} />
        <stop offset="48%" stopColor={tono(herr, 0.1)} />
        <stop offset="74%" stopColor={tono(herr, -0.25)} />
        <stop offset="100%" stopColor={tono(herr, -0.5)} />
      </linearGradient>
      <linearGradient id={id('gTelaH')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#000" stopOpacity={0.3} />
        <stop offset="6%" stopColor="#000" stopOpacity={0.08} />
        <stop offset="20%" stopColor="#fff" stopOpacity={0.07} />
        <stop offset="52%" stopColor="#fff" stopOpacity={0.03} />
        <stop offset="84%" stopColor="#000" stopOpacity={0.07} />
        <stop offset="97%" stopColor="#000" stopOpacity={0.18} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.34} />
      </linearGradient>
      <linearGradient id={id('gTelaV')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000" stopOpacity={0.34} />
        <stop offset="4%" stopColor="#000" stopOpacity={0.1} />
        <stop offset="26%" stopColor="#fff" stopOpacity={0.02} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </linearGradient>
      {/* Textura de la tela: tejido screen, blackout liso o bandas del dúo.
          La dual define una por rollo (cada uno lleva su tela). */}
      {patronTelaDefs('pTela', estilo.telaHex, estilo.telaPatron)}
      {estilo.telaDual?.map((capa, i) =>
        patronTelaDefs(i === 0 ? 'pTelaVidrio' : 'pTelaFrente', capa.hex, capa.patron),
      )}
    </defs>
  );

  // ── Piezas clicables ──
  // Cada pieza va envuelta en un grupo con su área de clic. La que aún no
  // existe conserva el área: se puede saltar a su paso igual.
  const Pieza = ({
    pieza,
    hit,
    children,
  }: {
    pieza: PiezaViz;
    hit: { x: number; y: number; w: number; h: number };
    children: React.ReactNode;
  }) => (
    <g
      role={onClickPieza ? 'button' : undefined}
      tabIndex={onClickPieza ? 0 : undefined}
      aria-label={onClickPieza ? `Ir al paso: ${NOMBRE_PIEZA[pieza]}` : undefined}
      onClick={onClickPieza ? () => onClickPieza(pieza) : undefined}
      onKeyDown={
        onClickPieza
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClickPieza(pieza);
              }
            }
          : undefined
      }
      style={{ cursor: onClickPieza ? 'pointer' : undefined, outline: 'none' }}
    >
      <title>{NOMBRE_PIEZA[pieza]}</title>
      {activa === pieza && (
        <rect
          x={hit.x}
          y={hit.y}
          width={hit.w}
          height={hit.h}
          rx={10}
          fill="none"
          stroke="#5eead4"
          strokeWidth={3}
          strokeDasharray="10 7"
          opacity={0.85}
        />
      )}
      {children}
      <rect x={hit.x} y={hit.y} width={hit.w} height={hit.h} fill="transparent" />
    </g>
  );

  /** Silueta punteada de una pieza que todavía no se armó. */
  const Fantasma = ({ x, y, w, h, rx = 6 }: { x: number; y: number; w: number; h: number; rx?: number }) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={rx}
      fill="none"
      stroke="#7d756a"
      strokeWidth={2}
      strokeDasharray="8 8"
      opacity={0.3}
    />
  );

  const soporte = (lado: 'izq' | 'der') => {
    const px = lado === 'izq' ? x0 - 26 : x1 + 26;
    const dir = lado === 'izq' ? -1 : 1;
    const off = (1 - tSop) * 44 * dir;
    return (
      <g key={lado} opacity={r3(clamp01(p.soportes * 2.4))} transform={`translate(${r3(off)},0)`}>
        <rect x={px - 5} y={cy - 54} width={10} height={108} rx={2} fill={url('gHerrPlano')} />
        <rect x={px - 5} y={cy - 54} width={10} height={2} fill={tono(herr, 0.5)} opacity={0.5} />
        <rect
          x={lado === 'izq' ? px + 5 : px - 27}
          y={cy - 16}
          width={22}
          height={32}
          rx={3}
          fill={url('gHerr')}
        />
        {[cy - 36, cy + 36].map((yy) => (
          <g key={yy}>
            <circle cx={px} cy={yy} r={3.6} fill={tono(herr, -0.55)} />
            <circle cx={px} cy={yy} r={1.5} fill={tono(herr, 0.45)} opacity={0.6} />
          </g>
        ))}
      </g>
    );
  };

  const cadena = () => {
    const largo = 330 * easeOut(tAcc);
    if (largo < 4) return null;
    const bolitas = [];
    for (let y = cy + 32; y < cy + 24 + largo; y += 12.5) {
      bolitas.push(
        <g key={y}>
          <circle cx={x1 + 44} cy={y} r={4} fill={url('gTapa')} />
          <circle cx={x1 + 42.6} cy={y - 1.2} r={1.3} fill={tono(herr, 0.5)} opacity={0.55} />
          <circle cx={x1 + 63} cy={y} r={4} fill={url('gTapa')} />
        </g>,
      );
    }
    return (
      <g opacity={r3(clamp01(tAcc * 3))}>
        <path
          d={`M${x1 + 44} ${cy + 24} L${x1 + 44} ${r3(cy + 24 + largo)}`}
          stroke={tono(herr, -0.2)}
          strokeWidth={1.6}
          fill="none"
        />
        {bolitas}
        {largo > 280 && (
          <path
            d={`M${x1 + 44} ${r3(cy + 24 + largo)} Q${x1 + 54} ${r3(cy + 39 + largo)} ${x1 + 63} ${r3(cy + 24 + largo)}`}
            stroke={tono(herr, -0.05)}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </g>
    );
  };

  const cabezalMotor = () => (
    <g opacity={r3(clamp01(tAcc * 3))}>
      <rect x={x1 + 24} y={cy - 21} width={54} height={42} rx={8} fill={url('gHerr')} />
      <rect x={x1 + 30} y={cy - 12} width={42} height={4} fill={tono(herr, 0.4)} opacity={0.35} />
      <circle cx={x1 + 68} cy={cy + 12} r={4} fill="#7fe3a1" opacity={0.85} />
      <path
        d={`M${x1 + 78} ${cy} h26`}
        stroke={tono(herr, -0.3)}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </g>
  );

  /** Un paño de tela colgando: la tela, la luz que la atraviesa y sus sombras. */
  const panelTela = (top: number, bot: number, patron: string, solida: boolean, key: string) => {
    const h = Math.max(0, bot - top);
    if (h <= 2) return null;
    // Retroiluminación: solo el tramo de tela que tapa el vidrio.
    const bx = Math.max(x0 + 3, gx0);
    const bw = Math.min(x1 - 3, gx1) - bx;
    const by = Math.max(top, gy0);
    const bh = Math.min(bot, gy1) - by;
    return (
      <g key={key}>
        <rect x={x0 + 3} y={r3(top)} width={VIZ_W - 6} height={r3(h)} fill={patron} />
        {bw > 0 && bh > 0 && (
          <rect
            x={bx}
            y={r3(by)}
            width={bw}
            height={r3(bh)}
            fill="#fff6e2"
            opacity={solida ? 0.05 : 0.15}
            style={{ mixBlendMode: 'screen' }}
          />
        )}
        <rect x={x0 + 3} y={r3(top)} width={VIZ_W - 6} height={r3(h)} fill={url('gTelaH')} />
        <rect x={x0 + 3} y={r3(top)} width={VIZ_W - 6} height={r3(Math.min(h, 100))} fill={url('gTelaV')} />
        <rect x={x0 + 3} y={r3(bot - 30)} width={VIZ_W - 6} height={30} fill="#000" opacity={0.1} />
        <rect x={x0 + 3} y={r3(top)} width={3} height={r3(h)} fill="#000" opacity={0.2} />
        <rect x={x1 - 6} y={r3(top)} width={3} height={r3(h)} fill="#000" opacity={0.26} />
      </g>
    );
  };

  /** Barra inferior del rollo de adelante (la dual lleva una por paño). */
  const barraDual = (y: number) => (
    <g>
      <rect x={x0 - 2} y={r3(y - 20)} width={VIZ_W + 4} height={20} rx={3} fill={url('gHerr')} />
      <rect x={x0 - 2} y={r3(y - 18)} width={VIZ_W + 4} height={2} fill={tono(herr, 0.45)} opacity={0.4} />
      <rect x={x0 - 2} y={r3(y - 5)} width={VIZ_W + 4} height={5} fill="#000" opacity={0.32} />
    </g>
  );

  const rollo = (dy: number, radioRollo0: number, patron: string, key: string) => {
    const rr = Math.max(tr, radioRollo0);
    return (
      <g key={key} transform={`translate(0,${r3(dy)})`}>
        <rect x={x0 + 2} y={cy - rr} width={VIZ_W - 4} height={2 * rr} rx={5} fill={patron} />
        <rect x={x0 + 2} y={cy - rr} width={VIZ_W - 4} height={2 * rr} rx={5} fill={url('gTelaH')} />
        <rect x={x0 + 2} y={cy - rr * 0.6} width={VIZ_W - 4} height={6} fill="#fff" opacity={0.09} />
        <rect x={x0 + 2} y={cy + rr * 0.4} width={VIZ_W - 4} height={12} fill="#000" opacity={0.16} />
        <ellipse cx={x1 - 6} cy={cy} rx={11} ry={rr} fill={patron} />
        <ellipse cx={x1 - 6} cy={cy} rx={11} ry={rr} fill="#000" opacity={0.22} />
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${VIZ.ancho} ${VIZ.alto}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block h-full w-full', className)}
    >
      {defs}
      {defsColor}

      {/* ── Habitación ── */}
      <rect x={0} y={0} width={VIZ.ancho} height={812} fill={url('gPared')} />
      <rect x={0} y={806} width={VIZ.ancho} height={94} fill={url('gPiso')} />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={0} y={812 + i * 13} width={VIZ.ancho} height={1} fill="#000" opacity={0.13} />
      ))}
      <rect x={gx0 - 40} y={gy0 - 96} width={gx1 - gx0 + 80} height={gy1 - gy0 + 130} fill="#cfc7bb" />
      <rect x={gx0 - 40} y={gy0 - 96} width={14} height={gy1 - gy0 + 130} fill="#000" opacity={0.1} />
      <g clipPath={url('cVidrio')}>
        <rect x={gx0} y={gy0} width={gx1 - gx0} height={gy1 - gy0} fill={url('gVidrio')} />
        <g filter={url('fBlur')} opacity={0.85}>
          <rect x={gx0 - 20} y={gy0 + 250} width={gx1 - gx0 + 40} height={130} fill="#77875f" opacity={0.55} />
          <ellipse cx={gx0 + 190} cy={gy0 + 300} rx={130} ry={96} fill="#5f7048" opacity={0.5} />
          <ellipse cx={gx1 - 150} cy={gy0 + 270} rx={150} ry={110} fill="#6d7d52" opacity={0.42} />
          <rect x={gx0 - 20} y={gy0 + 430} width={gx1 - gx0 + 40} height={200} fill="#b3ac9b" opacity={0.6} />
        </g>
        <rect x={(gx0 + gx1) / 2 - 5} y={gy0} width={10} height={gy1 - gy0} fill="#2a2724" />
        <rect x={gx0} y={gy0} width={gx1 - gx0} height={3} fill="#fff" opacity={0.5} />
      </g>
      <g fill="#2a2724">
        <rect x={gx0 - 16} y={gy0 - 16} width={gx1 - gx0 + 32} height={16} />
        <rect x={gx0 - 16} y={gy1} width={gx1 - gx0 + 32} height={18} />
        <rect x={gx0 - 16} y={gy0 - 16} width={16} height={gy1 - gy0 + 34} />
        <rect x={gx1} y={gy0 - 16} width={16} height={gy1 - gy0 + 34} />
      </g>
      <path
        d={`M${gx0 - 30} 806 L${gx1 + 30} 806 L${gx1 + 150} 900 L${gx0 - 150} 900 Z`}
        fill={url('gLuz')}
        opacity={r3(0.75 * apertura)}
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Sombra del conjunto sobre el nicho */}
      {conRollo && tTubo > 0.3 && (
        <rect
          x={x0 + 20}
          y={cy - radio + 24}
          width={VIZ_W}
          height={Math.max(2 * radio, telaH + 2 * radio) + 8}
          rx={8}
          fill="#171310"
          opacity={r3(0.3 * tTubo)}
          filter={url('fSuave')}
        />
      )}
      {esVertical && tSop > 0.3 && (
        <rect
          x={x0 + 16}
          y={cy - 8}
          width={VIZ_W}
          height={lamaBot - cy}
          rx={8}
          fill="#171310"
          opacity={r3(0.22 * tSop)}
          filter={url('fSuave')}
        />
      )}
      {esBee && tSop > 0.3 && (
        <rect
          x={x0 + 16}
          y={beeTop - 4}
          width={VIZ_W}
          height={beeBot - beeTop + 12}
          rx={8}
          fill="#171310"
          opacity={r3(0.22 * tSop)}
          filter={url('fSuave')}
        />
      )}

      {/* ── Soportes ──
          El BEEBLACK no lleva los soportes del roller: su marco se ancla
          directo (dueño, 2026-08-20). Su pieza «soportes» ES el marco, que se
          dibuja abajo con tSop; acá solo queda el clic (el riel superior) y la
          silueta punteada mientras falte la instalación. */}
      {esBee ? (
        <Pieza pieza="soportes" hit={{ x: x0 - 16, y: beeTop - 26, w: VIZ_W + 32, h: 52 }}>
          {tSop < 0.02 && <Fantasma x={x0 - 6} y={beeTop - 16} w={VIZ_W + 12} h={26} />}
        </Pieza>
      ) : (
        <Pieza pieza="soportes" hit={{ x: x0 - 56, y: cy - 66, w: VIZ_W + 112, h: 132 }}>
          {p.soportes < 0.02 ? (
            <>
              <Fantasma x={x0 - 40} y={cy - 56} w={28} h={112} />
              <Fantasma x={x1 + 12} y={cy - 56} w={28} h={112} />
            </>
          ) : (
            <>
              {soporte('izq')}
              {soporte('der')}
            </>
          )}
        </Pieza>
      )}

      {/* ── Vertical: el riel cabezal entra con los soportes (no tiene paso propio) ── */}
      {esVertical && tSop > 0.02 && (
        <g opacity={r3(clamp01(tSop * 2))}>
          <rect x={x0} y={cy - 18} width={VIZ_W} height={36} rx={4} fill={url('gHerr')} />
          <rect x={x0} y={cy - 10} width={VIZ_W} height={3} fill={tono(herr, 0.5)} opacity={0.35} />
          <rect x={x0} y={cy + 12} width={VIZ_W} height={6} fill="#000" opacity={0.25} />
          <rect x={x0 - 4} y={cy - 18} width={8} height={36} rx={2} fill={url('gTapa')} />
          <rect x={x1 - 4} y={cy - 18} width={8} height={36} rx={2} fill={url('gTapa')} />
        </g>
      )}

      {/* Vertical: la cadena de mando cuelga del lado del cierre. */}
      {esVertical && (
        <g transform={espejo ? flip : undefined}>
          <Pieza pieza="accionamiento" hit={{ x: x1 + 20, y: cy - 30, w: 90, h: 380 }}>
            {tAcc < 0.02 ? (
              <Fantasma x={x1 + 34} y={cy + 24} w={38} h={300} rx={18} />
            ) : (
              cadena()
            )}
          </Pieza>
        </g>
      )}

      {/* ── Beeblack: el marco (rieles arriba, abajo y a los lados) entra con
          los soportes — los 4 perfiles salen del mismo riel. ── */}
      {esBee && tSop > 0.02 && (
        <g opacity={r3(clamp01(tSop * 2))}>
          <rect x={x0} y={beeTop - 16} width={VIZ_W} height={26} rx={4} fill={url('gHerr')} />
          <rect x={x0} y={beeTop - 10} width={VIZ_W} height={3} fill={tono(herr, 0.5)} opacity={0.35} />
          <rect x={x0} y={beeTop + 4} width={VIZ_W} height={5} fill="#000" opacity={0.25} />
          <rect x={x0} y={beeBot - 8} width={VIZ_W} height={16} rx={4} fill={url('gHerr')} />
          <rect x={x0 - 6} y={beeTop - 16} width={11} height={beeBot - beeTop + 24} rx={3} fill={url('gHerrPlano')} />
          <rect x={x1 - 5} y={beeTop - 16} width={11} height={beeBot - beeTop + 24} rx={3} fill={url('gHerrPlano')} />
          {/* Las tapas de esquina del marco (se ven en las fotos del panal). */}
          {([[x0 - 6, beeTop - 16], [x1 - 5, beeTop - 16], [x0 - 6, beeBot - 3], [x1 - 5, beeBot - 3]] as const).map(
            ([ex, ey], i) => (
              <rect key={i} x={ex} y={ey} width={11} height={11} rx={2} fill={tono(herr, -0.55)} />
            ),
          )}
        </g>
      )}

      {/* ── Tubo ── */}
      {conRollo && (
      <Pieza pieza="tubo" hit={{ x: x0 - 8, y: cy - trE - 10, w: VIZ_W + 16, h: trE * 2 + 20 }}>
        {tTubo < 0.02 ? (
          <Fantasma x={x0} y={cy - trE} w={VIZ_W} h={trE * 2} rx={trE} />
        ) : (
          <g
            opacity={r3(clamp01(tTubo * 3))}
            transform={`translate(0,${r3(-230 * (1 - easeBack(tTubo)))})`}
          >
            <rect x={x0} y={cy - trE} width={VIZ_W} height={trE * 2} rx={4} fill={url('gTubo')} />
            <rect x={x0} y={cy - trE * 0.5} width={VIZ_W} height={4} fill={tono(herr, 0.7)} opacity={0.3} />
            <ellipse cx={x0 + 4} cy={cy} rx={9} ry={trE} fill={url('gTapa')} />
            <ellipse cx={x1 - 4} cy={cy} rx={9} ry={trE} fill={url('gTapa')} />
            {/* Dual: el tubo del rollo de ADELANTE, un poco más abajo. */}
            {esDual && (
              <g transform={`translate(0,${dualDy})`} opacity={0.9}>
                <rect x={x0} y={cy - tr + 6} width={VIZ_W} height={tr * 2 - 12} rx={4} fill={url('gTubo')} />
                <ellipse cx={x1 - 4} cy={cy} rx={8} ry={tr - 6} fill={url('gTapa')} />
              </g>
            )}
          </g>
        )}
      </Pieza>
      )}

      {/* ── Mecanismo y accionamiento (espejados si el mando va a la izquierda) ── */}
      {conRollo && (
      <g transform={espejo ? flip : undefined}>
        <Pieza pieza="mecanismo" hit={{ x: x1 - 14, y: cy - 34, w: 96, h: 68 }}>
          {tMec < 0.02 ? (
            <Fantasma x={x1 - 10} y={cy - 28} w={80} h={56} />
          ) : (
            <g opacity={r3(clamp01(tMec * 3))}>
              <g transform={`translate(${r3(60 * (1 - easeBack(clamp01(tMec * 1.6))))},0)`}>
                <rect x={x1 - 10} y={cy - trE - 3} width={34} height={trE * 2 + 6} rx={5} fill={url('gHerr')} />
                <rect x={x1 + 24} y={cy - 19} width={12} height={38} rx={3} fill={tono(herr, -0.3)} />
                <rect x={x1 + 36} y={cy - 25} width={30} height={50} rx={7} fill={url('gHerr')} />
                <rect x={x1 + 36} y={cy - 13} width={30} height={2.5} fill={tono(herr, 0.5)} opacity={0.35} />
                <circle cx={x1 + 51} cy={cy} r={5} fill={tono(herr, -0.6)} opacity={0.8} />
              </g>
              <g transform={`translate(${r3(-60 * (1 - easeBack(clamp01(tMec * 1.6))))},0)`}>
                <rect x={x0 - 22} y={cy - 13} width={26} height={26} rx={4} fill={url('gHerr')} />
                <rect x={x0 - 31} y={cy - 6} width={11} height={12} rx={2} fill={tono(herr, -0.25)} />
              </g>
            </g>
          )}
        </Pieza>

        <Pieza pieza="accionamiento" hit={{ x: x1 + 20, y: cy - 30, w: 90, h: 380 }}>
          {tAcc < 0.02 ? (
            <Fantasma x={x1 + 34} y={cy + 24} w={38} h={300} rx={18} />
          ) : estilo.accionamiento === 'motor' ? (
            cabezalMotor()
          ) : (
            cadena()
          )}
        </Pieza>
      </g>
      )}

      {/* ── Vertical: las lamas son la tela ── */}
      {esVertical && (
        <Pieza pieza="tela" hit={{ x: x0, y: lamaTop, w: VIZ_W, h: lamaBot - lamaTop }}>
          {tTela < 0.02 ? (
            <Fantasma x={x0 + 8} y={lamaTop + 6} w={VIZ_W - 16} h={380} />
          ) : (
            <g>
              {Array.from({ length: lamasN }, (_, i) => {
                const op = clamp01(tTela * lamasN - i);
                if (op <= 0.01) return null;
                const cxL = lamasX0 + i * LAMA_PASO + LAMA_W / 2;
                const w = Math.max(10, lamaWAhora);
                const xL = cxL - w / 2;
                const caidaLama = -46 * (1 - easeOut(op));
                return (
                  <g key={i} opacity={r3(op)} transform={`translate(0,${r3(caidaLama)})`}>
                    {/* Carrito: el gancho que la cuelga del riel. */}
                    <rect x={r3(cxL - 2.5)} y={cy + 12} width={5} height={14} rx={1.5} fill={tono(herr, -0.35)} />
                    <rect x={r3(xL)} y={lamaTop} width={r3(w)} height={lamaBot - lamaTop} rx={3} fill={patronTela} />
                    <rect x={r3(xL)} y={lamaTop} width={r3(w)} height={lamaBot - lamaTop} rx={3} fill={url('gTelaH')} />
                    <rect x={r3(xL + w - 4)} y={lamaTop} width={4} height={lamaBot - lamaTop} fill="#000" opacity={0.16} />
                  </g>
                );
              })}
            </g>
          )}
        </Pieza>
      )}

      {/* ── Beeblack: el panel acordeón es la tela; corre desde el lado donde
          parte el cierre y la manilla viaja en su borde. ── */}
      {esBee && !beeVert && (
        <g transform={espejo ? flip : undefined}>
          <Pieza pieza="tela" hit={{ x: x0, y: beeTop + 6, w: VIZ_W, h: beeBot - beeTop - 12 }}>
            {tTela < 0.02 ? (
              <Fantasma x={x0 + 8} y={beeTop + 12} w={r3((VIZ_W - 8) * 0.4)} h={beeBot - beeTop - 24} />
            ) : (
              <g opacity={r3(clamp01(tTela * 3))}>
                <rect
                  x={beeX0}
                  y={beeTop + 6}
                  width={r3(beeAncho)}
                  height={beeBot - beeTop - 12}
                  fill={patronTela}
                />
                {/* Pliegues en ZIGZAG, como el panal real (fotos del dueño
                    2026-08-20): cada pliegue tiene una cara a la luz y otra en
                    sombra con la arista brillante al medio. El NÚMERO es fijo:
                    al abrir no desaparecen, se aprietan contra el riel. */}
                {Array.from({ length: BEE_PLIEGUES }, (_, i) => {
                  const pw = beeAncho / BEE_PLIEGUES;
                  const px = beeX0 + i * pw;
                  const h = beeBot - beeTop - 12;
                  return (
                    <g key={i}>
                      <rect x={r3(px)} y={beeTop + 6} width={r3(pw / 2)} height={h} fill="#fff" opacity={0.1} />
                      <rect x={r3(px + pw / 2)} y={beeTop + 6} width={r3(pw / 2)} height={h} fill="#000" opacity={0.16} />
                      {pw > 5 && (
                        <>
                          <rect x={r3(px + pw / 2 - 0.8)} y={beeTop + 6} width={1.6} height={h} fill="#fff" opacity={0.3} />
                          <rect x={r3(px)} y={beeTop + 6} width={1.2} height={h} fill="#000" opacity={0.28} />
                        </>
                      )}
                    </g>
                  );
                })}
                <rect
                  x={beeX0}
                  y={beeTop + 6}
                  width={r3(beeAncho)}
                  height={beeBot - beeTop - 12}
                  fill={url('gTelaH')}
                />
                {/* El perfil MÓVIL: la barra de aluminio que viaja con el borde
                    del panel — con el panel abierto es lo que más se ve. */}
                <rect
                  x={r3(beeX0 + beeAncho - 6)}
                  y={beeTop + 4}
                  width={13}
                  height={beeBot - beeTop - 8}
                  rx={3}
                  fill={url('gHerrPlano')}
                />
                <rect
                  x={r3(beeX0 + beeAncho + 4.5)}
                  y={beeTop + 4}
                  width={2.5}
                  height={beeBot - beeTop - 8}
                  fill="#000"
                  opacity={0.28}
                />
              </g>
            )}
          </Pieza>

          {/* La manilla: siempre va (no se marca), pero el paso del cierre la arma. */}
          <Pieza
            pieza="accionamiento"
            hit={{ x: r3(beeX0 + beeAncho - 26), y: (beeTop + beeBot) / 2 - 90, w: 52, h: 180 }}
          >
            {tAcc < 0.02 ? (
              tTela > 0.02 && (
                <Fantasma
                  x={r3(beeX0 + beeAncho - 14)}
                  y={(beeTop + beeBot) / 2 - 64}
                  w={16}
                  h={128}
                  rx={8}
                />
              )
            ) : (
              /* El agarre va MONTADO sobre el perfil móvil (misma línea). */
              <g opacity={r3(clamp01(tAcc * 3))}>
                <rect
                  x={r3(beeX0 + beeAncho - 9)}
                  y={(beeTop + beeBot) / 2 - 60}
                  width={19}
                  height={120}
                  rx={7}
                  fill={url('gHerr')}
                />
                <rect
                  x={r3(beeX0 + beeAncho - 5)}
                  y={(beeTop + beeBot) / 2 - 56}
                  width={3}
                  height={112}
                  fill={tono(herr, 0.5)}
                  opacity={0.4}
                />
              </g>
            )}
          </Pieza>
        </g>
      )}

      {/* ── Beeblack DE ARRIBA ABAJO: el panel baja plegándose desde el riel
          superior; los pliegues van horizontales y la manilla, acostada en el
          borde inferior de avance. ── */}
      {esBee && beeVert && (
        <g>
          <Pieza pieza="tela" hit={{ x: x0, y: beeTop + 6, w: VIZ_W, h: beeBot - beeTop - 12 }}>
            {tTela < 0.02 ? (
              <Fantasma x={x0 + 8} y={beeY0 + 6} w={VIZ_W - 16} h={r3((beeBot - beeTop - 24) * 0.4)} />
            ) : (
              <g opacity={r3(clamp01(tTela * 3))}>
                <rect x={beeX0} y={beeY0} width={VIZ_W - 8} height={r3(beeAlto)} fill={patronTela} />
                {/* Pliegues horizontales en ZIGZAG (número fijo, se aprietan
                    contra el riel superior al abrir — fotos del dueño). */}
                {Array.from({ length: BEE_PLIEGUES_V }, (_, i) => {
                  const ph = beeAlto / BEE_PLIEGUES_V;
                  const py = beeY0 + i * ph;
                  return (
                    <g key={i}>
                      <rect x={beeX0} y={r3(py)} width={VIZ_W - 8} height={r3(ph / 2)} fill="#fff" opacity={0.1} />
                      <rect x={beeX0} y={r3(py + ph / 2)} width={VIZ_W - 8} height={r3(ph / 2)} fill="#000" opacity={0.16} />
                      {ph > 5 && (
                        <>
                          <rect x={beeX0} y={r3(py + ph / 2 - 0.8)} width={VIZ_W - 8} height={1.6} fill="#fff" opacity={0.3} />
                          <rect x={beeX0} y={r3(py)} width={VIZ_W - 8} height={1.2} fill="#000" opacity={0.28} />
                        </>
                      )}
                    </g>
                  );
                })}
                <rect x={beeX0} y={beeY0} width={VIZ_W - 8} height={r3(beeAlto)} fill={url('gTelaH')} />
                {/* El perfil MÓVIL acostado, viajando con el borde inferior. */}
                <rect
                  x={beeX0 - 2}
                  y={r3(beeY0 + beeAlto - 6)}
                  width={VIZ_W - 4}
                  height={13}
                  rx={3}
                  fill={url('gHerrPlano')}
                />
                <rect
                  x={beeX0 - 2}
                  y={r3(beeY0 + beeAlto + 4.5)}
                  width={VIZ_W - 4}
                  height={2.5}
                  fill="#000"
                  opacity={0.28}
                />
              </g>
            )}
          </Pieza>

          {/* La manilla acostada, centrada en el borde inferior del panel. */}
          <Pieza
            pieza="accionamiento"
            hit={{ x: (x0 + x1) / 2 - 90, y: r3(beeY0 + beeAlto - 26), w: 180, h: 52 }}
          >
            {tAcc < 0.02 ? (
              tTela > 0.02 && (
                <Fantasma
                  x={(x0 + x1) / 2 - 64}
                  y={r3(beeY0 + beeAlto - 14)}
                  w={128}
                  h={16}
                  rx={8}
                />
              )
            ) : (
              /* El agarre va MONTADO sobre el perfil móvil (misma línea). */
              <g opacity={r3(clamp01(tAcc * 3))}>
                <rect
                  x={(x0 + x1) / 2 - 60}
                  y={r3(beeY0 + beeAlto - 9)}
                  width={120}
                  height={19}
                  rx={7}
                  fill={url('gHerr')}
                />
                <rect
                  x={(x0 + x1) / 2 - 56}
                  y={r3(beeY0 + beeAlto - 5)}
                  width={112}
                  height={3}
                  fill={tono(herr, 0.5)}
                  opacity={0.4}
                />
              </g>
            )}
          </Pieza>
        </g>
      )}

      {/* ── Tela + peso + despliegue ── */}
      {conRollo && (
      <Pieza pieza="tela" hit={{ x: x0, y: cy - RMAX, w: VIZ_W, h: Math.max(120, telaH + RMAX) }}>
        {tTela < 0.02 ? (
          <Fantasma x={x0 + 3} y={cy + 30} w={VIZ_W - 6} h={200} />
        ) : (
          <g opacity={r3(clamp01(tTela * 5))}>
            {esDual && estilo.telaDual ? (
              (() => {
                const [vidrio, frente] = estilo.telaDual;
                return (
                  <>
                    {/* Rollo del vidrio (paño 1): baja entero. */}
                    {panelTela(telaTop, barraY, url('pTelaVidrio'), vidrio.patron === 'solida', 'panelVidrio')}
                    {rollo(0, radio, url('pTelaVidrio'), 'rollo1')}
                    {/* Rollo de adelante (paño 2): a media caída, delante del otro.
                        Sin tela elegida se dibuja tenue y punteado, como el resto
                        de las piezas que faltan. */}
                    <g opacity={frente.definida ? 1 : 0.55}>
                      {panelTela(telaTopF, barraYF, url('pTelaFrente'), frente.patron === 'solida', 'panelFrente')}
                      {telaHF > 2 && !frente.definida && (
                        <Fantasma x={x0 + 3} y={telaTopF} w={VIZ_W - 6} h={telaHF} rx={2} />
                      )}
                      {telaHF > 2 && barraDual(barraYF)}
                      {rollo(dualDy, radioF, url('pTelaFrente'), 'rollo2')}
                    </g>
                  </>
                );
              })()
            ) : (
              <>
                {panelTela(telaTop, barraY, patronTela, estilo.telaPatron === 'solida', 'panel')}
                {rollo(0, radio, patronTela, 'rollo1')}
              </>
            )}
          </g>
        )}
      </Pieza>
      )}

      {conRollo && (
      <Pieza pieza="peso" hit={{ x: x0 - 10, y: barraY - 34, w: VIZ_W + 20, h: 44 }}>
        {tPeso < 0.02 ? (
          <Fantasma x={x0 - 2} y={barraY - 26} w={VIZ_W + 4} h={26} rx={3} />
        ) : (
          <g
            opacity={r3(clamp01(tPeso * 4))}
            transform={`translate(${r3(-70 * (1 - easeBack(tPeso)))},0)`}
          >
            <rect x={x0 - 2} y={barraY - 26} width={VIZ_W + 4} height={26} rx={3} fill={url('gHerr')} />
            <rect x={x0 - 2} y={barraY - 24} width={VIZ_W + 4} height={2} fill={tono(herr, 0.45)} opacity={0.4} />
            <rect x={x0 - 2} y={barraY - 6} width={VIZ_W + 4} height={6} fill="#000" opacity={0.35} />
            <rect x={x0 + VIZ_W / 2 - 62} y={barraY - 22} width={124} height={19} rx={4} fill={tono(herr, -0.55)} />
            <text
              x={x0 + VIZ_W / 2}
              y={barraY - 8}
              textAnchor="middle"
              fill={tono(herr, 0.75)}
              opacity={0.85}
              style={{ font: '500 9px monospace', letterSpacing: '0.3em' }}
            >
              ROLZZO
            </text>
          </g>
        )}
      </Pieza>
      )}

      {/* Zona de clic del despliegue: el vidrio que la cortina va tapando. */}
      {conRollo && (
      <Pieza pieza="despliegue" hit={{ x: gx0, y: barraY + 12, w: gx1 - gx0, h: Math.max(20, gy1 - barraY - 12) }}>
        {tDesp < 0.02 && tTela > 0.02 && (
          <Fantasma x={gx0 + 6} y={barraY + 20} w={gx1 - gx0 - 12} h={Math.max(24, gy1 - barraY - 30)} />
        )}
      </Pieza>
      )}
      {/* Vertical: el despliegue son las lamas girando de canto a cerradas. El
          clic va en el tramo bajo del vidrio para no taparle el clic a la tela. */}
      {esVertical && (
      <Pieza pieza="despliegue" hit={{ x: gx0, y: gy0 + (gy1 - gy0) * 0.6, w: gx1 - gx0, h: (gy1 - gy0) * 0.4 }}>
        {tDesp < 0.02 && tTela > 0.02 && (
          <Fantasma x={gx0 + 6} y={gy0 + (gy1 - gy0) * 0.6} w={gx1 - gx0 - 12} h={(gy1 - gy0) * 0.4 - 8} />
        )}
      </Pieza>
      )}

      {/* Beeblack: el despliegue es el acordeón extendiéndose. El clic va en el
          tramo del vidrio que el panel cubre al final, para no tapar la tela
          (con cierre DE ARRIBA ABAJO, la banda de abajo). */}
      {esBee && (
      <Pieza
        pieza="despliegue"
        hit={
          beeVert
            ? { x: gx0, y: gy0 + (gy1 - gy0) * 0.62, w: gx1 - gx0, h: (gy1 - gy0) * 0.38 }
            : { x: gx0 + (gx1 - gx0) * 0.62, y: gy0, w: (gx1 - gx0) * 0.38, h: gy1 - gy0 }
        }
      >
        {tDesp < 0.02 && tTela > 0.02 && (
          beeVert ? (
            <Fantasma x={gx0 + 8} y={gy0 + (gy1 - gy0) * 0.62} w={gx1 - gx0 - 16} h={(gy1 - gy0) * 0.38 - 8} />
          ) : (
            <Fantasma x={gx0 + (gx1 - gx0) * 0.62} y={gy0 + 8} w={(gx1 - gx0) * 0.38 - 8} h={gy1 - gy0 - 16} />
          )
        )}
      </Pieza>
      )}

      {/* ── Oscuridad: guías laterales + zócalo (pieza «Perfiles y guías») ──
          Las guías se atornillan al marco y la tela corre POR DENTRO; el zócalo
          sella abajo. Son la seña de identidad del sistema, así que van sobre
          la tela. */}
      {esOscuridad && (
        <>
          <Pieza pieza="perfiles" hit={{ x: x0 - 26, y: cy + 20, w: 52, h: gy1 - cy - 6 }}>
            {tPerf < 0.02 ? (
              <Fantasma x={x0 - 12} y={cy + 28} w={26} h={gy1 - cy - 16} />
            ) : (
              <g
                opacity={r3(clamp01(tPerf * 2.4))}
                transform={`translate(${r3(-46 * (1 - easeBack(tPerf)))},0)`}
              >
                <rect x={x0 - 12} y={cy + 28} width={26} height={gy1 - cy - 12} rx={3} fill={url('gHerrPlano')} />
                <rect x={x0 - 12} y={cy + 28} width={26} height={2} fill={tono(herr, 0.5)} opacity={0.4} />
                <rect x={x0 + 9} y={cy + 28} width={5} height={gy1 - cy - 12} fill="#000" opacity={0.24} />
              </g>
            )}
          </Pieza>
          <Pieza pieza="perfiles" hit={{ x: x1 - 26, y: cy + 20, w: 52, h: gy1 - cy - 6 }}>
            {tPerf < 0.02 ? (
              <Fantasma x={x1 - 14} y={cy + 28} w={26} h={gy1 - cy - 16} />
            ) : (
              <g
                opacity={r3(clamp01(tPerf * 2.4))}
                transform={`translate(${r3(46 * (1 - easeBack(tPerf)))},0)`}
              >
                <rect x={x1 - 14} y={cy + 28} width={26} height={gy1 - cy - 12} rx={3} fill={url('gHerrPlano')} />
                <rect x={x1 - 14} y={cy + 28} width={26} height={2} fill={tono(herr, 0.5)} opacity={0.4} />
                <rect x={x1 - 14} y={cy + 28} width={5} height={gy1 - cy - 12} fill="#000" opacity={0.24} />
              </g>
            )}
          </Pieza>
          <Pieza pieza="perfiles" hit={{ x: x0 - 14, y: gy1 - 28, w: VIZ_W + 28, h: 48 }}>
            {tPerf < 0.02 ? (
              <Fantasma x={x0 - 10} y={gy1 - 18} w={VIZ_W + 20} h={30} rx={4} />
            ) : (
              <g
                opacity={r3(clamp01(tPerf * 2.4))}
                transform={`translate(0,${r3(64 * (1 - easeBack(tPerf)))})`}
              >
                <rect x={x0 - 10} y={gy1 - 18} width={VIZ_W + 20} height={30} rx={4} fill={url('gHerr')} />
                <rect x={x0 - 10} y={gy1 - 16} width={VIZ_W + 20} height={2.5} fill={tono(herr, 0.45)} opacity={0.4} />
                <rect x={x0 - 10} y={gy1 + 6} width={VIZ_W + 20} height={6} fill="#000" opacity={0.3} />
              </g>
            )}
          </Pieza>
        </>
      )}

      {/* ── Cenefa ── */}
      {estilo.cenefa !== 'no' && (
        <Pieza pieza="cenefa" hit={{ x: x0 - 30, y: cy - RMAX - 30, w: VIZ_W + 60, h: RMAX * 2 + 60 }}>
          {tCen < 0.02 ? (
            <Fantasma x={x0 - 18} y={cy - RMAX - 18} w={VIZ_W + 36} h={RMAX * 2 + 38} rx={10} />
          ) : (
            (() => {
              const cy0 = cy - RMAX - 18;
              const ch = RMAX * 2 + 38;
              const dy = -110 * (1 - easeBack(tCen));
              const redonda = estilo.cenefa === 'ovalada';
              const d = redonda
                ? `M${x0 - 18} ${cy0 + 8} Q${x0 - 18} ${cy0} ${x0 - 10} ${cy0} H${x1 + 10} Q${x1 + 18} ${cy0} ${x1 + 18} ${cy0 + 8} V${cy0 + ch - 10} Q${x1 + 18} ${cy0 + ch} ${x1 + 6} ${cy0 + ch} H${x0 - 6} Q${x0 - 18} ${cy0 + ch} ${x0 - 18} ${cy0 + ch - 10} Z`
                : `M${x0 - 18} ${cy0} H${x1 + 18} V${cy0 + ch} H${x0 - 18} Z`;
              return (
                <g opacity={r3(clamp01(tCen * 3))} transform={`translate(0,${r3(dy)})`}>
                  <rect
                    x={x0 - 16}
                    y={cy0 + ch - 6}
                    width={VIZ_W + 32}
                    height={24}
                    rx={6}
                    fill="#141110"
                    opacity={0.4}
                    filter={url('fCorto')}
                  />
                  <path d={d} fill={url('gHerr')} />
                  <rect x={x0 - 16} y={cy0 + 4} width={VIZ_W + 32} height={3} fill={tono(herr, 0.5)} opacity={0.35} />
                  <rect x={x0 - 16} y={cy0 + ch - 22} width={VIZ_W + 32} height={14} fill="#000" opacity={0.22} />
                  <rect x={x0 - 18} y={cy0 + ch - 7} width={VIZ_W + 36} height={7} rx={2} fill={tono(herr, -0.5)} />
                </g>
              );
            })()
          )}
        </Pieza>
      )}

      <rect x={0} y={0} width={VIZ.ancho} height={VIZ.alto} fill={url('gVineta')} pointerEvents="none" />
    </svg>
  );
});
