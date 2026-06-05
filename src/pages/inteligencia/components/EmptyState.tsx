// Placeholder cuando una card no tiene datos.

interface EmptyStateProps {
  icon: string;
  text: string;
}

export default function EmptyState({ icon, text }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-7 text-center">
      <div className="text-base opacity-50" aria-hidden>
        {icon}
      </div>
      <div className="text-[11px] text-muted-foreground">{text}</div>
    </div>
  );
}
