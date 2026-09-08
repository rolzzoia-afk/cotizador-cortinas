// Select con label y opciones fijas {v, l}.

import { Label } from '@/components/ui/label';

interface FieldSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}

export default function FieldSelect({ label, value, onChange, options }: FieldSelectProps) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
