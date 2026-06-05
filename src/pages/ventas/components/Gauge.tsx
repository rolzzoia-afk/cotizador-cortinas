// Gauge SVG semicircular para mostrar el % de cierre de cotizaciones.
// Cuando hasData=false, muestra un fondo punteado y un guion en vez del %.

import { colorPct } from '../utils/helpers';

interface GaugeProps {
  pct: number;
  hasData: boolean;
}

export default function Gauge({ pct, hasData }: GaugeProps) {
  const cx = 80;
  const cy = 80;
  const r = 64;
  const startAngle = Math.PI;
  const endAngleFull = 2 * Math.PI;
  const realAngle = startAngle + Math.min(pct / 100, 1) * Math.PI;

  const toXY = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const bgStart = toXY(startAngle);
  const bgEnd = toXY(endAngleFull);
  const fillEnd = toXY(realAngle);
  const largeArc = realAngle - startAngle > Math.PI ? 1 : 0;

  return (
    <div className="relative mx-auto h-20 w-40 overflow-hidden">
      <svg viewBox="0 0 160 160" className="absolute left-0 top-0 h-40 w-40">
        {!hasData && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
            stroke="hsl(var(--border))"
            strokeWidth="16"
            strokeDasharray="6 6"
            fill="none"
          />
        )}
        {hasData && (
          <>
            <path
              d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`}
              stroke="hsl(var(--border))"
              strokeWidth="16"
              fill="none"
            />
            <path
              d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`}
              stroke={colorPct(pct, 50)}
              strokeWidth="16"
              strokeLinecap="butt"
              fill="none"
            />
          </>
        )}
      </svg>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[22px] font-extrabold leading-none"
        style={{ color: hasData ? colorPct(pct, 50) : '#64748b' }}
      >
        {hasData ? `${pct}%` : '—'}
      </div>
    </div>
  );
}
