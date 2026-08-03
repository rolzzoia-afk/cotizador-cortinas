// Tarjeta de un estante de la colmena de tubería: la ubicación (A4, L02…),
// cuántos tubos hay y su familia dominante (que decide el color).
//
// Espejo del "slot" de la colmena de paños: la estructura de la grilla NUNCA
// cambia con los filtros — filtrar ATENÚA (opacidad) y buscar RESALTA (borde
// ámbar), así los estantes no saltan de lugar mientras se escribe.

import type { EstanteTubos, FamiliaTubo } from '@/modules/tubos/colmenaTubos';

/** Color por familia de código (rgba inline: igual que la colmena de paños). */
export const COLOR_FAMILIA: Record<FamiliaTubo, { bg: string; border: string; color: string }> = {
  TUBO: { bg: 'rgba(59,130,246,0.20)', border: 'rgba(59,130,246,0.40)', color: '#93c5fd' },
  PESO: { bg: 'rgba(168,85,247,0.20)', border: 'rgba(168,85,247,0.40)', color: '#d8b4fe' },
  CENEFA: { bg: 'rgba(20,184,166,0.20)', border: 'rgba(20,184,166,0.40)', color: '#5eead4' },
  PERFIL: { bg: 'rgba(99,102,241,0.20)', border: 'rgba(99,102,241,0.40)', color: '#a5b4fc' },
  VERTICAL: { bg: 'rgba(34,197,94,0.20)', border: 'rgba(34,197,94,0.40)', color: '#86efac' },
  BEEBLACK: { bg: 'rgba(245,158,11,0.20)', border: 'rgba(245,158,11,0.40)', color: '#fcd34d' },
  OTRO: { bg: 'rgba(113,113,122,0.20)', border: 'rgba(113,113,122,0.35)', color: '#d4d4d8' },
};

interface EstanteTuboProps {
  estante: EstanteTubos;
  /** Tubos visibles tras el filtro de familia (para el conteo y la opacidad). */
  visibles: number;
  /** Hay búsqueda activa y este estante calza. */
  match: boolean;
  /** Hay búsqueda activa (aunque este estante no calce). */
  buscando: boolean;
  /** Tubos en alerta por antigüedad dentro del estante. */
  alertas: number;
  onClick: () => void;
}

export default function EstanteTubo({
  estante,
  visibles,
  match,
  buscando,
  alertas,
  onClick,
}: EstanteTuboProps) {
  const est = COLOR_FAMILIA[estante.familiaDominante];
  const opacity = visibles === 0 ? 0.15 : buscando && !match ? 0.35 : 1;

  return (
    <button
      onClick={onClick}
      className="relative flex h-[52px] w-[76px] flex-col items-center justify-center rounded-sm border px-0.5 text-[11px] leading-tight transition hover:scale-105"
      style={{
        background: est.bg,
        color: est.color,
        borderColor: match ? '#fbbf24' : est.border,
        opacity,
      }}
      title={`${estante.colmena} · ${estante.tubos.length} tubo(s) · ${estante.metros.toFixed(1)} m${
        estante.nota ? ` · ${estante.nota}` : ''
      }`}
    >
      {alertas > 0 && (
        <span
          className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full"
          style={{ background: '#f59e0b' }}
          title={`${alertas} tubo(s) con más de 90 días`}
        />
      )}
      <span className="truncate font-bold">{estante.colmena}</span>
      <span className="text-[10px] opacity-70">
        {visibles} tubo{visibles === 1 ? '' : 's'}
      </span>
      {estante.nota && (
        <span className="text-[9px] uppercase opacity-60">{estante.nota}</span>
      )}
    </button>
  );
}
