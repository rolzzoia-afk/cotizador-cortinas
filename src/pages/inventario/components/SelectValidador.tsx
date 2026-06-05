// Select que muestra las opciones validadas + permite valor custom.

interface SelectValidadorProps {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
}

export default function SelectValidador({ value, onChange, opciones }: SelectValidadorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
    >
      <option value="">—</option>
      {opciones.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {value && !opciones.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}
