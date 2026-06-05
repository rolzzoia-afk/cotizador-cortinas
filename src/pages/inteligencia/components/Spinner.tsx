// Indicador de carga inicial.

interface SpinnerProps {
  label: string;
}

export default function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-6 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-border border-t-foreground" />
      <span>{label}</span>
    </div>
  );
}
