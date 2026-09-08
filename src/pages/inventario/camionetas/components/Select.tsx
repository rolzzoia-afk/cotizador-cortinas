// Select nativo estilado, usado en Swap.

import { cn } from '@/lib/utils';

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  className?: string;
}

export default function Select({ value, onChange, options, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
