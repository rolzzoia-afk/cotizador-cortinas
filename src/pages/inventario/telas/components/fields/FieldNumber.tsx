// Input numérico con label, mantiene null si está vacío.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FieldNumberProps {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
}

export default function FieldNumber({ label, value, onChange, step = 1 }: FieldNumberProps) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        step={step}
        min={0}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        className="border-border bg-secondary"
      />
    </div>
  );
}
