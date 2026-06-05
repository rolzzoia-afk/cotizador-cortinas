// Lista de chips removibles para el ConfigDialog (canales, vendedoras, terreno).

import { X } from 'lucide-react';

interface ChipListProps {
  items: string[];
  onRemove: (idx: number) => void;
}

export default function ChipList({ items, onRemove }: ChipListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div
          key={`${item}-${i}`}
          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
        >
          {item}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-destructive hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
