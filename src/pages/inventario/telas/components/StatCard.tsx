// Card de KPI numérico de la tab Catálogo.

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
}

export default function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      style={{ borderColor: color ? `${color}40` : undefined }}
    >
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
