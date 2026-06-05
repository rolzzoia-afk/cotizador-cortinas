// Placeholder chiquito para cuando un chart no tiene datos.

interface EmptyMiniProps {
  text: string;
}

export default function EmptyMini({ text }: EmptyMiniProps) {
  return (
    <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
