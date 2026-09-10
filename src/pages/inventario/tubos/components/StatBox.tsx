// Caja de KPI numérico para el dashboard de Merma.

interface StatBoxProps {
  value: string;
  label: string;
}

export default function StatBox({ value, label }: StatBoxProps) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-xl font-extrabold">{value}</div>
      <div className="text-[12px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
