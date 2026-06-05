// Sección "Asignar vendedora": dropdown con todas las vendedoras + botón
// de asignar.

import { Button } from '@/components/ui/button';

interface AsignarVendedoraSectionProps {
  vendedoras: { id: string; nombre: string }[];
  vendedoraDraft: string;
  setVendedoraDraft: (v: string) => void;
  actualAsignada: string;
  onAsignar: () => void;
}

export default function AsignarVendedoraSection({
  vendedoras,
  vendedoraDraft,
  setVendedoraDraft,
  actualAsignada,
  onAsignar,
}: AsignarVendedoraSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Asignar vendedora
      </div>
      <div className="flex gap-2">
        <select
          value={vendedoraDraft}
          onChange={(e) => setVendedoraDraft(e.target.value)}
          className="flex-1 rounded-md border border-border bg-card px-2 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">— Sin asignar —</option>
          {vendedoras.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
        <Button onClick={onAsignar} size="sm" disabled={vendedoraDraft === actualAsignada}>
          Asignar
        </Button>
      </div>
    </section>
  );
}
