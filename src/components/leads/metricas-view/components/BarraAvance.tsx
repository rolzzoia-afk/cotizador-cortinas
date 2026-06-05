// Barra de progreso de avance vs meta. Color según pct.

interface BarraAvanceProps {
  pct: number;
}

export default function BarraAvance({ pct }: BarraAvanceProps) {
  const w = Math.min(100, Math.max(0, pct));
  const color =
    pct >= 100 ? '#1D9E75' : pct >= 60 ? '#7F77DD' : pct >= 30 ? '#EF9F27' : '#E24B4A';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${w}%`, background: color }}
      />
    </div>
  );
}
