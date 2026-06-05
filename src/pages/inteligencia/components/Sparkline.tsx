// Sparkline minimalista para los KPIs del hero. SVG inline, no library.
// Toma una serie de números y dibuja una polyline + área tenue debajo.
// Mantiene el lenguaje "documento" del rediseño v3.

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showDot?: boolean;
}

export default function Sparkline({
  values,
  width = 90,
  height = 22,
  color = 'currentColor',
  className,
  showDot = true,
}: SparklineProps) {
  if (!values || values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        className={className}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeWidth="0.75"
          strokeOpacity="0.3"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;
  const padY = 2;
  const usableH = height - padY * 2;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = padY + usableH - ((v - min) / range) * usableH;
    return [x, y] as [number, number];
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L${(points[points.length - 1][0]).toFixed(1)},${height} L0,${height} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <path d={areaPath} fill={color} fillOpacity="0.08" />
      <path
        d={linePath}
        stroke={color}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r="1.5"
          fill={color}
        />
      )}
    </svg>
  );
}
