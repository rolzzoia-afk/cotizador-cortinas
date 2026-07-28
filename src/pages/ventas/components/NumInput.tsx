// Input numérico sin spinners nativos (oculta las flechas de Chrome/Firefox).
// Limita min/max y emite onChange con número limpio.

import { cn } from '@/lib/utils';

interface NumInputProps {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  /** En modo semana/mes el valor es un total acumulado: no se edita. */
  disabled?: boolean;
}

export default function NumInput({
  value,
  onChange,
  className,
  min = 0,
  max,
  disabled = false,
}: NumInputProps) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      readOnly={disabled}
      onChange={(e) => {
        if (disabled) return;
        const raw = Number(e.target.value) || 0;
        let v = Math.max(min, raw);
        if (max != null) v = Math.min(max, v);
        onChange(v);
      }}
      className={cn(
        '[appearance:textfield] transition-opacity duration-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        disabled && 'cursor-default opacity-70',
        className,
      )}
    />
  );
}
