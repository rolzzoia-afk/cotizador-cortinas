// Input de texto con label encima.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FieldTextProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function FieldText({ label, value, onChange, placeholder }: FieldTextProps) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border bg-secondary"
      />
    </div>
  );
}
