// Punto de color con label, para la leyenda del Rack.

interface LegendDotProps {
  color: string;
  label: string;
}

export default function LegendDot({ color, label }: LegendDotProps) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
