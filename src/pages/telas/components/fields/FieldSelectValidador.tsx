// Select con label, opciones desde los validadores + permite mantener el
// valor actual si no está en la lista (data legacy).

import { Label } from '@/components/ui/label';

interface FieldSelectValidadorProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: string[];
}

export default function FieldSelectValidador({
  label,
  value,
  onChange,
  opts,
}: FieldSelectValidadorProps) {
  const todas = value && !opts.includes(value) ? [value, ...opts] : opts;
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
      >
        <option value="">— Seleccionar —</option>
        {todas.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
