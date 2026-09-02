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
  type EstiloViz,
  type PerfilesViz,
  type PiezaViz,
  type VarianteViz,
} from '@/modules/cotizador/wizard/cortinaViz';

/**
 * El grupo de ventanas («2 ventanas» = 2 cortinas separadas en el mismo muro):
 * el vidrio se parte en tantos paños como cortinas, cada uno con su color de
 * contorno, y los números de abajo cambian de cortina con un clic.
 */
export type GrupoViz = {
  /** Cuál de los paños de vidrio es el de ESTA cortina (0-based). */
  indice: number;
  /** Un color por ventana del grupo; el largo define cuántos paños se dibujan. */
  colores: string[];
  /** true = esa cortina ya existe (se puede abrir); false = falta cargarla. */
  abiertas: boolean[];
  onClickVentana?: (i: number) => void;
};

type Props = {
  variante: VarianteViz;
  /** Cuánto lleva armada cada pieza (0..1). Se suaviza dentro del componente. */
  progreso: Partial<Record<PiezaViz, number>>;
  estilo: EstiloViz;
  /** Pieza del paso activo: se destaca. */
  activa?: PiezaViz | null;
  onClickPieza?: (p: PiezaViz) => void;
  /** Sin grupo (o con 1 sola), el vidrio va limpio, sin separaciones. */
  grupo?: GrupoViz | null;
  className?: string;
};

// `x0`/`x1` (los extremos de la cortina) NO se destructuran acá: con un grupo
// de ventanas la cortina ocupa SOLO su paño de vidrio, así que se calculan
// dentro del componente.
const { cy, tr, gx0, gx1, gy0, gy1, cola, caidaMax, dualDy, dualFrente } = VIZ;
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
  grupo,
  className,
}: Props) {
  // Paños de VIDRIO de la ventana física. Una ventana individual va limpia
  // (sin travesaño); «2/3/4 ventanas» la parten en 2/3/4.
  const panesN = Math.max(1, grupo?.colores.length ?? 1);
  const paneGlassW = (gx1 - gx0) / panesN;
  const paneX = (i: number) => gx0 + i * paneGlassW;
  const idxPane = Math.min(Math.max(0, grupo?.indice ?? 0), panesN - 1);

  // LA CORTINA OCUPA SOLO SU PAÑO: cada una del grupo es independiente. Estos
  // locales le hacen sombra a la geometría de módulo, así que TODO el dibujo
  // (soportes, tubo, tela, peso, guías, cenefa…) se confina solo.
  const x0 = panesN > 1 ? r3(paneX(idxPane) - 12) : VIZ.x0;
  const x1 = panesN > 1 ? r3(paneX(idxPane) + paneGlassW + 12) : VIZ.x1;
  const VIZ_W = x1 - x0;
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

  // ── Oscuridad (DARK / SOFT LIGHT / OSCURANTI): el esqueleto del roller más
  // guías laterales, zócalo y cajón. El OSCURANTI solo cambia el tubo (63 mm).
  const esOscuridad = variante === 'oscuridad' || variante === 'oscuranti';
  // Qué perfiles lleva (solo oscuridad). Sin dato: laterales sí, base no —
  // el mismo default que impone la variante.
  const perf: PerfilesViz = estilo.perfiles ?? {
    izq: true,
    der: true,
    base: false,
    sepIzq: false,
    sepDer: false,
    sepBase: false,
  };

  // ── Estado del rollo ──
  // Con zócalo, el peso aterriza sobre él, un poco antes que el roller (que
  // baja hasta el marco); sin zócalo llega al alféizar como cualquier roller.
  const caidaMaxE = esOscuridad && perf.base ? caidaMax - 14 : caidaMax;
  const colaAhora = cola * easeOut(clamp01(tTela * 1.35 - 0.25));
  const caida = tDesp > 0 ? mezcla(colaAhora, caidaMaxE, easeInOut(tDesp)) : colaAhora;
  const envuelto = tTela > 0 ? mezcla(0, caidaMaxE - cola, easeInOut(clamp01(tTela * 1.25))) : 0;
  const enrollado = tDesp > 0 ? Math.max(0, caidaMaxE - caida) : envuelto;
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

  // ── Oscuridad: geometría de los perfiles (fotos del dueño, 2026-08-21) ──
  // La guía es un perfil ANCHO y plano (≈ un 8 % del ancho) que nace bajo la
  // cenefa, llega al piso y tapa el borde de la tela: la tela corre por dentro
  // de su canal. El zócalo va ENTRE las guías, no por encima. Se dibujan solo
  // los perfiles que la ficha lleva (el base es opcional).
  // Ancho de la guía proporcional a la cortina (≈8 % del ancho, como el 56 de
  // la cortina completa): en un paño de grupo no puede comerse media ventana.
  const GUIA_W = Math.max(24, Math.min(56, Math.round(VIZ_W * 0.08)));
  const guiaTop = cy + 30;
  const guiaBot = gy1 + 18;
  const ZOC_H = 30;
  const zocY = gy1 - 12;
  const zocX0 = perf.izq ? x0 - 16 + GUIA_W : x0 - 16;
  const zocX1 = perf.der ? x1 + 16 - GUIA_W : x1 + 16;
  // El peso de la oscuridad es una barra más gorda (sus puntas corren por
  // dentro de las guías) y de su propio color: solo blanco o negro.
  const pesoH = esOscuridad ? 32 : 26;

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
  const peso = estilo.pesoHex;
  const patronTela = url('pTela');

  // ── Dónde va el contorno de color de ESTA cortina ──
  // Abraza la cortina DIBUJADA, no el hueco del vidrio: una vez armada, el
  // rectángulo fijo del vano quedaba flotando alrededor y se leía como un
  // recuadro pegado encima. Mientras no hay nada armado sí marca el vano —
  // ahí el contorno dice «esta ventana es la que estás cargando».
  const contornoActual = (() => {
    const M = 8;
    const caja = (top: number, bot: number) => ({
      x: r3(x0 - M),
      y: r3(top - M),
      w: r3(VIZ_W + 2 * M),
      h: r3(Math.max(24, bot - top) + 2 * M),
    });
    if (tSop < 0.02 && tTubo < 0.02 && tTela < 0.02) {
      return {
        x: r3(paneX(idxPane) + 8),
        y: gy0 + 8,
        w: r3(paneGlassW - 16),
        h: gy1 - gy0 - 16,
      };
    }
    if (esVertical) return caja(cy - 18, tTela > 0.02 ? lamaBot : cy + 40);
    if (esBee) return caja(beeTop - 16, beeBot + 8);
    // Con rollo: desde la cenefa (o el rollo desnudo) hasta el peso.
    const top = tCen > 0.02 ? cy - RMAX - 14 : cy - radio;
    return caja(top, Math.max(barraY, cy + radio));
  })();

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
      {/* El peso inferior lleva su propio color (en oscuridad, blanco o negro). */}
      <linearGradient id={id('gPeso')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(peso, -0.35)} />
        <stop offset="6%" stopColor={tono(peso, 0.28)} />
        <stop offset="16%" stopColor={tono(peso, 0.45)} />
        <stop offset="30%" stopColor={tono(peso, 0.05)} />
        <stop offset="62%" stopColor={tono(peso, -0.15)} />
        <stop offset="88%" stopColor={tono(peso, -0.35)} />
        <stop offset="100%" stopColor={tono(peso, -0.5)} />
      </linearGradient>
      {/* Guías laterales de oscuridad: perfil plano, la luz entra por fuera. */}
      {(['gGuiaIzq', 'gGuiaDer'] as const).map((n) => (
        <linearGradient
          key={n}
          id={id(n)}
          x1={n === 'gGuiaIzq' ? '0' : '1'}
          y1="0"
          x2={n === 'gGuiaIzq' ? '1' : '0'}
          y2="0"
        >
          <stop offset="0%" stopColor={tono(herr, 0.3)} />
          <stop offset="30%" stopColor={tono(herr, 0.05)} />
          <stop offset="100%" stopColor={tono(herr, -0.3)} />
        </linearGradient>
      ))}
      {/* Cenefa CUADRADA: cara plana, casi sin degradado — es una caja. */}
      <linearGradient id={id('gCajon')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(herr, 0.1)} />
        <stop offset="55%" stopColor={tono(herr, -0.04)} />
        <stop offset="100%" stopColor={tono(herr, -0.26)} />
      </linearGradient>
      {/* Cenefa OVALADA: la cara redondeada — banda de luz arriba, sombra abajo. */}
      <linearGradient id={id('gOval')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={tono(herr, -0.2)} />
        <stop offset="16%" stopColor={tono(herr, 0.42)} />
        <stop offset="38%" stopColor={tono(herr, 0.12)} />
        <stop offset="72%" stopColor={tono(herr, -0.18)} />
        <stop offset="100%" stopColor={tono(herr, -0.55)} />
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
        {/* Travesaños: uno por división del grupo. La ventana individual va
            limpia — antes había uno fijo al medio y toda ventana se veía doble. */}
        {Array.from({ length: panesN - 1 }, (_, i) => (
          <rect
            key={i}
            x={r3(paneX(i + 1) - 5)}
            y={gy0}
            width={10}
            height={gy1 - gy0}
            fill="#2a2724"
          />
        ))}
        <rect x={gx0} y={gy0} width={gx1 - gx0} height={3} fill="#fff" opacity={0.5} />
      </g>
      <g fill="#2a2724">
        <rect x={gx0 - 16} y={gy0 - 16} width={gx1 - gx0 + 32} height={16} />
        <rect x={gx0 - 16} y={gy1} width={gx1 - gx0 + 32} height={18} />
        <rect x={gx0 - 16} y={gy0 - 16} width={16} height={gy1 - gy0 + 34} />
        <rect x={gx1} y={gy0 - 16} width={16} height={gy1 - gy0 + 34} />
      </g>

      {/* Las hermanas del grupo que YA están cargadas: su cortina enrollada,
          en silueta, sobre su propio paño. El muro se lee completo — esta
          ventana ya tiene la suya — sin dibujar su ficha entera. */}
      {grupo && panesN > 1 && (
        <g pointerEvents="none">
          {/* El borde de color no va acá: lo pone el contorno del grupo. */}
          {grupo.colores.map((_col, i) => {
            if (i === idxPane || !(grupo.abiertas[i] ?? false)) return null;
            const sx0 = r3(paneX(i) - 8);
            const sw = r3(paneGlassW + 16);
            return (
              <g key={i} opacity={0.5}>
                <rect x={sx0} y={cy - tr} width={sw} height={tr * 2} rx={5} fill="#55524c" />
                <rect x={sx0 + 2} y={cy + tr} width={sw - 4} height={34} fill="#55524c" opacity={0.55} />
                <rect x={sx0 + 2} y={cy + tr + 30} width={sw - 4} height={7} rx={2} fill="#3d3a35" />
              </g>
            );
          })}
        </g>
      )}
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
      <Pieza pieza="peso" hit={{ x: x0 - 10, y: barraY - pesoH - 8, w: VIZ_W + 20, h: pesoH + 18 }}>
        {tPeso < 0.02 ? (
          <Fantasma x={x0 - 2} y={barraY - pesoH} w={VIZ_W + 4} h={pesoH} rx={3} />
        ) : (
          <g
            opacity={r3(clamp01(tPeso * 4))}
            transform={`translate(${r3(-70 * (1 - easeBack(tPeso)))},0)`}
          >
            <rect x={x0 - 2} y={barraY - pesoH} width={VIZ_W + 4} height={pesoH} rx={3} fill={url('gPeso')} />
            <rect x={x0 - 2} y={barraY - pesoH + 2} width={VIZ_W + 4} height={2} fill={tono(peso, 0.45)} opacity={0.4} />
            <rect x={x0 - 2} y={barraY - 6} width={VIZ_W + 4} height={6} fill="#000" opacity={0.35} />
            {/* La placa ROLZZO va hacia la derecha de la barra, como en las
                fotos. En un paño angosto de grupo no cabe y se omite. */}
            {VIZ_W > 260 && (
              <>
                <rect x={x1 - 158} y={barraY - pesoH / 2 - 8.5} width={90} height={17} rx={3} fill={tono(peso, -0.55)} />
                <text
                  x={x1 - 113}
                  y={barraY - pesoH / 2 + 3.5}
                  textAnchor="middle"
                  fill={tono(peso, 0.75)}
                  opacity={0.85}
                  style={{ font: '500 9px monospace', letterSpacing: '0.3em' }}
                >
                  ROLZZO
                </text>
              </>
            )}
          </g>
        )}
      </Pieza>
      )}

      {/* Zona de clic del despliegue: el vidrio que ESTA cortina va tapando
          (solo su paño, no el muro entero). */}
      {conRollo && (
      <Pieza pieza="despliegue" hit={{ x: x0 + 3, y: barraY + 12, w: VIZ_W - 6, h: Math.max(20, gy1 - barraY - 12) }}>
        {tDesp < 0.02 && tTela > 0.02 && (
          <Fantasma x={x0 + 9} y={barraY + 20} w={VIZ_W - 18} h={Math.max(24, gy1 - barraY - 30)} />
        )}
      </Pieza>
      )}
      {/* Vertical: el despliegue son las lamas girando de canto a cerradas. El
          clic va en el tramo bajo del vidrio para no taparle el clic a la tela. */}
      {esVertical && (
      <Pieza pieza="despliegue" hit={{ x: x0 + 3, y: gy0 + (gy1 - gy0) * 0.6, w: VIZ_W - 6, h: (gy1 - gy0) * 0.4 }}>
        {tDesp < 0.02 && tTela > 0.02 && (
          <Fantasma x={x0 + 9} y={gy0 + (gy1 - gy0) * 0.6} w={VIZ_W - 18} h={(gy1 - gy0) * 0.4 - 8} />
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
            ? { x: x0 + 3, y: gy0 + (gy1 - gy0) * 0.62, w: VIZ_W - 6, h: (gy1 - gy0) * 0.38 }
            : { x: x0 + VIZ_W * 0.62, y: gy0, w: VIZ_W * 0.38, h: gy1 - gy0 }
        }
      >
        {tDesp < 0.02 && tTela > 0.02 && (
          beeVert ? (
            <Fantasma x={x0 + 8} y={gy0 + (gy1 - gy0) * 0.62} w={VIZ_W - 16} h={(gy1 - gy0) * 0.38 - 8} />
          ) : (
            <Fantasma x={x0 + VIZ_W * 0.62} y={gy0 + 8} w={VIZ_W * 0.38 - 8} h={gy1 - gy0 - 16} />
          )
        )}
      </Pieza>
      )}

      {/* ── Oscuridad: guías laterales + zócalo (pieza «Perfiles y guías») ──
          Las guías se atornillan al marco y la tela corre POR DENTRO de su
          canal (por eso tapan su borde); el zócalo sella abajo, entre las dos.
          Son la seña de identidad del sistema, así que van sobre la tela y el
          peso. Un perfil que la ficha no lleva no se dibuja (ni punteado): el
          clic en su zona sigue llevando al paso, donde se activa. */}
      {esOscuridad &&
        (() => {
          const guiaH = guiaBot - guiaTop;
          const guia = (lado: 'izq' | 'der') => {
            const izq = lado === 'izq';
            const gx = izq ? x0 - 16 : x1 + 16 - GUIA_W;
            const sep = izq ? perf.sepIzq : perf.sepDer;
            return (
              <g
                opacity={r3(clamp01(tPerf * 2.4))}
                transform={`translate(${r3((izq ? -46 : 46) * (1 - easeBack(tPerf)))},0)`}
              >
                {/* El separador: una lista pegada por fuera de la guía. */}
                {sep && (
                  <rect x={izq ? gx - 9 : gx + GUIA_W} y={guiaTop} width={9} height={guiaH} fill={tono(herr, -0.4)} />
                )}
                <rect x={gx} y={guiaTop} width={GUIA_W} height={guiaH} rx={2} fill={url(izq ? 'gGuiaIzq' : 'gGuiaDer')} />
                {/* Filo de luz arriba y arista brillante por fuera. */}
                <rect x={gx} y={guiaTop} width={GUIA_W} height={2} fill={tono(herr, 0.5)} opacity={0.45} />
                <rect x={izq ? gx + 1 : gx + GUIA_W - 3} y={guiaTop} width={2} height={guiaH} fill={tono(herr, 0.55)} opacity={0.35} />
                {/* El canal por donde corre la tela: la ranura oscura del borde interior. */}
                <rect x={izq ? gx + GUIA_W - 8 : gx} y={guiaTop} width={8} height={guiaH} fill="#000" opacity={0.26} />
                <rect x={izq ? gx + GUIA_W - 2 : gx} y={guiaTop} width={2} height={guiaH} fill="#000" opacity={0.32} />
              </g>
            );
          };
          const hitGuia = (lado: 'izq' | 'der') => ({
            x: lado === 'izq' ? x0 - 32 : x1 - GUIA_W,
            y: guiaTop - 8,
            w: GUIA_W + 16,
            h: guiaH + 16,
          });
          const zocW = zocX1 - zocX0;
          return (
            <>
              <Pieza pieza="perfiles" hit={hitGuia('izq')}>
                {perf.izq &&
                  (tPerf < 0.02 ? (
                    <Fantasma x={x0 - 16} y={guiaTop} w={GUIA_W} h={guiaH} rx={3} />
                  ) : (
                    guia('izq')
                  ))}
              </Pieza>
              <Pieza pieza="perfiles" hit={hitGuia('der')}>
                {perf.der &&
                  (tPerf < 0.02 ? (
                    <Fantasma x={x1 + 16 - GUIA_W} y={guiaTop} w={GUIA_W} h={guiaH} rx={3} />
                  ) : (
                    guia('der')
                  ))}
              </Pieza>
              <Pieza pieza="perfiles" hit={{ x: zocX0 - 6, y: zocY - 10, w: zocW + 12, h: ZOC_H + 24 }}>
                {perf.base &&
                  (tPerf < 0.02 ? (
                    <Fantasma x={zocX0} y={zocY} w={zocW} h={ZOC_H} rx={3} />
                  ) : (
                    <g
                      opacity={r3(clamp01(tPerf * 2.4))}
                      transform={`translate(0,${r3(64 * (1 - easeBack(tPerf)))})`}
                    >
                      {perf.sepBase && (
                        <rect x={zocX0} y={zocY + ZOC_H} width={zocW} height={8} fill={tono(herr, -0.4)} />
                      )}
                      <rect x={zocX0} y={zocY} width={zocW} height={ZOC_H} rx={3} fill={url('gHerr')} />
                      <rect x={zocX0} y={zocY + 2} width={zocW} height={2.5} fill={tono(herr, 0.45)} opacity={0.4} />
                      <rect x={zocX0} y={zocY + ZOC_H - 6} width={zocW} height={6} fill="#000" opacity={0.3} />
                    </g>
                  ))}
              </Pieza>
            </>
          );
        })()}

      {/* ── Cenefa ──
          Fotos del dueño (2026-08-21): es la pieza más grande del conjunto y
          monta POR FUERA de las guías. La OVALADA tiene la cara redondeada
          (banda de luz arriba, sombra abajo) y tapas ovales que asoman; la
          CUADRADA es una caja: cara plana, arista superior iluminada y tapas
          rectas. En la oscuridad el cajón tapa además los soportes. */}
      {estilo.cenefa !== 'no' &&
        (() => {
          const redonda = estilo.cenefa === 'ovalada';
          const cx0 = esOscuridad ? x0 - 36 : x0 - 22;
          const cx1 = esOscuridad ? x1 + 36 : x1 + 22;
          const cw = cx1 - cx0;
          const ch = RMAX * 2 + 30;
          const cy0 = cy - RMAX - 14;
          const cyB = cy0 + ch;
          const TAPA_W = 12;
          return (
            <Pieza pieza="cenefa" hit={{ x: cx0, y: cy0 - 10, w: cw, h: ch + 20 }}>
              {tCen < 0.02 ? (
                <Fantasma x={cx0} y={cy0} w={cw} h={ch} rx={redonda ? ch / 2 : 4} />
              ) : (
                <g
                  opacity={r3(clamp01(tCen * 3))}
                  transform={`translate(0,${r3(-110 * (1 - easeBack(tCen)))})`}
                >
                  {/* La sombra que echa sobre la tela y las guías. */}
                  <rect
                    x={cx0 + 2}
                    y={cyB - 6}
                    width={cw - 4}
                    height={26}
                    rx={6}
                    fill="#141110"
                    opacity={0.42}
                    filter={url('fCorto')}
                  />
                  {redonda ? (
                    <>
                      {/* Tapas ovales: asoman por fuera del cuerpo. */}
                      <ellipse cx={cx0 + TAPA_W} cy={cy0 + ch / 2} rx={TAPA_W + 4} ry={ch / 2} fill={url('gTapa')} />
                      <ellipse cx={cx1 - TAPA_W} cy={cy0 + ch / 2} rx={TAPA_W + 4} ry={ch / 2} fill={url('gTapa')} />
                      {/* El cuerpo: la cara redondeada. */}
                      <rect x={cx0 + TAPA_W} y={cy0} width={cw - 2 * TAPA_W} height={ch} fill={url('gOval')} />
                      <rect x={cx0 + TAPA_W} y={cy0 + ch * 0.14} width={cw - 2 * TAPA_W} height={3} fill="#fff" opacity={0.22} />
                      {/* Las juntas de las tapas. */}
                      <rect x={cx0 + TAPA_W} y={cy0} width={1.5} height={ch} fill="#000" opacity={0.35} />
                      <rect x={cx1 - TAPA_W - 1.5} y={cy0} width={1.5} height={ch} fill="#000" opacity={0.35} />
                    </>
                  ) : (
                    <>
                      {/* La cara plana del cajón. */}
                      <rect x={cx0} y={cy0} width={cw} height={ch} fill={url('gCajon')} />
                      {/* La arista superior: la cara de arriba recibe la luz. */}
                      <rect x={cx0} y={cy0} width={cw} height={9} fill={tono(herr, 0.38)} />
                      <rect x={cx0} y={cy0 + 9} width={cw} height={1.5} fill="#000" opacity={0.3} />
                      {/* El canto inferior, en sombra. */}
                      <rect x={cx0} y={cyB - 4} width={cw} height={4} fill={tono(herr, -0.55)} />
                      {/* Tapas rectas con su junta. */}
                      <rect x={cx0} y={cy0} width={TAPA_W} height={ch} fill={url('gTapa')} />
                      <rect x={cx1 - TAPA_W} y={cy0} width={TAPA_W} height={ch} fill={url('gTapa')} />
                      <rect x={cx0 + TAPA_W} y={cy0} width={1.5} height={ch} fill="#000" opacity={0.3} />
                      <rect x={cx1 - TAPA_W - 1.5} y={cy0} width={1.5} height={ch} fill="#000" opacity={0.3} />
                    </>
                  )}
                </g>
              )}
            </Pieza>
          );
        })()}

      {/* ── El contorno de color de cada ventana del grupo ──
          Encima de todo, para que se vea siempre: la actual fuerte, las otras
          tenues y las que faltan por cargar punteadas (el mismo lenguaje de
          toda pieza que aún no existe). */}
      {grupo && panesN > 1 && (
        <g pointerEvents="none">
          {grupo.colores.map((col, i) => {
            const actual = i === grupo.indice;
            const abierta = grupo.abiertas[i] ?? false;
            // La actual abraza su cortina; una hermana ya cargada, su silueta
            // enrollada; un lugar vacío, el vano — que es lo que hay ahí.
            const caja = actual
              ? contornoActual
              : abierta
                ? {
                    x: r3(paneX(i) - 14),
                    y: cy - tr - 6,
                    w: r3(paneGlassW + 28),
                    h: tr * 2 + 49,
                  }
                : {
                    x: r3(paneX(i) + 8),
                    y: gy0 + 8,
                    w: r3(paneGlassW - 16),
                    h: gy1 - gy0 - 16,
                  };
            return (
              <rect
                key={i}
                x={caja.x}
                y={caja.y}
                width={caja.w}
                height={caja.h}
                rx={6}
                fill="none"
                stroke={col}
                strokeWidth={actual ? 6 : 3}
                strokeDasharray={actual || abierta ? undefined : '14 10'}
                opacity={actual ? 0.9 : 0.5}
              />
            );
          })}
        </g>
      )}

      {/* ── Los números del grupo: uno por ventana, clicables ──
          Van al pie de su paño de vidrio, ENCIMA de la cortina (si no, la tela
          desplegada los taparía y no habría cómo cambiarse de ventana). */}
      {grupo && panesN > 1 && (
        <g>
          {grupo.colores.map((col, i) => {
            const actual = i === grupo.indice;
            const abierta = grupo.abiertas[i] ?? false;
            const cxB = r3(paneX(i) + paneGlassW / 2);
            const cyB = gy1 - 44;
            const rB = Math.min(26, r3(paneGlassW * 0.38));
            const titulo = actual
              ? `Ventana ${i + 1} — la que estás cargando`
              : abierta
                ? `Ir a la ventana ${i + 1} (ya cargada)`
                : `Cargar la ventana ${i + 1} ahora`;
            const click = grupo.onClickVentana;
            return (
              <g
                key={i}
                role={click ? 'button' : undefined}
                tabIndex={click ? 0 : undefined}
                aria-label={titulo}
                onClick={click ? () => click(i) : undefined}
                onKeyDown={
                  click
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          click(i);
                        }
                      }
                    : undefined
                }
                style={{ cursor: click && !actual ? 'pointer' : undefined, outline: 'none' }}
                opacity={actual || abierta ? 1 : 0.72}
              >
                <title>{titulo}</title>
                <circle
                  cx={cxB}
                  cy={cyB}
                  r={rB}
                  fill={actual ? col : '#1c1d20'}
                  fillOpacity={actual ? 1 : 0.85}
                  stroke={col}
                  strokeWidth={actual ? 0 : 3}
                  strokeDasharray={actual || abierta ? undefined : '7 6'}
                />
                <text
                  x={cxB}
                  y={cyB + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={actual ? '#101113' : col}
                  style={{ font: `700 ${Math.round(rB * 0.92)}px monospace` }}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </g>
      )}

      <rect x={0} y={0} width={VIZ.ancho} height={VIZ.alto} fill={url('gVineta')} pointerEvents="none" />
    </svg>
  );
});
