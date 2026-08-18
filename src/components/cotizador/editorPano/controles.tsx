// Controles compartidos del editor de paño. Nacieron privados dentro de
// PanoEditor.tsx; se extrajeron cuando el wizard de terreno (vista interactiva
// de Fase 2) necesitó los mismos chips y filas para que las dos vistas se vean
// y se comporten igual.
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function SeccionColapsable({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] normal-case tracking-normal text-amber-400">
              {badge}
            </span>
          )}
        </span>
        <span aria-hidden>{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

export type StringOption = string | { value: string; label: string };

export function RadioRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly StringOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          const active = value === val;
          return (
            <button
              type="button"
              key={val}
              onClick={() => onChange(active ? '' : val)}
              className={cn(
                'rounded border px-2 py-1 text-[0.7rem] transition-colors',
                active
                  ? 'border-accent/50 bg-accent/20 text-accent'
                  : 'border-border bg-card text-foreground hover:bg-card',
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MedidaEditableRow({
  label,
  medida,
  override,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          value={valorInput}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onMedidaChange(undefined);
            const n = parseFloat(raw);
            onMedidaChange(Number.isFinite(n) ? n : undefined);
          }}
          className={cn(
            'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
            editado ? 'border-amber-500/60' : 'border-border',
          )}
          title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
        />
        {editado && (
          <button
            type="button"
            onClick={() => onMedidaChange(undefined)}
            title={`Restablecer a ${medida}`}
            className="text-[0.7rem] text-muted-foreground hover:text-foreground"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

export function PerfilToggle({
  label,
  medida,
  override,
  colorPerfil,
  checked,
  onToggle,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  colorPerfil?: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {colorPerfil && (
          <span
            className={cn(
              'min-w-[52px] text-center text-[0.65rem] uppercase tracking-wide',
              checked ? 'text-muted-foreground' : 'text-muted-foreground/40',
            )}
            title="Color desde adicionales Fase 0"
          >
            {colorPerfil}
          </span>
        )}
        {checked ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              value={valorInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return onMedidaChange(undefined);
                const n = parseFloat(raw);
                onMedidaChange(Number.isFinite(n) ? n : undefined);
              }}
              className={cn(
                'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
                editado ? 'border-amber-500/60' : 'border-border',
              )}
              title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
            />
            {editado && (
              <button
                type="button"
                onClick={() => onMedidaChange(undefined)}
                title={`Restablecer a ${medida}`}
                className="text-[0.7rem] text-muted-foreground hover:text-foreground"
              >
                ↺
              </button>
            )}
          </div>
        ) : (
          <span className="min-w-[48px] text-right font-mono text-[0.72rem] text-muted-foreground/40">
            {medida > 0 ? medida : '—'}
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(!checked)}
          aria-pressed={checked}
          className={cn(
            'w-12 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide transition-colors',
            checked
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-border bg-card text-muted-foreground hover:bg-card',
          )}
        >
          {checked ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-card accent-indigo-500"
      />
      {label}
    </label>
  );
}
