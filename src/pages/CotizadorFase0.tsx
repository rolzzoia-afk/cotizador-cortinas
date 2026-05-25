import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCatalogoProductos, useAnchoRollo } from '@/modules/cotizador/catalogo';
import { cotizarFase0, type LineaResultado } from '@/modules/cotizador/motorFase0';
import { formatCLP } from '@/modules/cotizador/calculos';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Cliente = {
  nombre: string;
  rut: string;
  mail: string;
  telefono: string;
  direccion: string;
};
const EMPTY_CLIENTE: Cliente = { nombre: '', rut: '', mail: '', telefono: '', direccion: '' };

type FilaUI = { id: string; codInt: string; ancho: number; alto: number; cantidad: number };
const nuevaFila = (): FilaUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  ancho: 0,
  alto: 0,
  cantidad: 1,
});

export function CotizadorFase0() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { empresaId } = useAuth();
  const { catalogo } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();

  const [cliente, setCliente] = useState<Cliente>(EMPTY_CLIENTE);
  const [filas, setFilas] = useState<FilaUI[]>([nuevaFila()]);

  // Prefill del cliente desde un lead (?lead=<id>)
  useEffect(() => {
    const leadId = params.get('lead');
    if (!leadId || !empresaId) return;
    (async () => {
      const { data } = await supabase
        .from('leads' as any)
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      if (data) {
        const l = data as any;
        setCliente({
          nombre: l.nombre || '',
          rut: l.rut || '',
          mail: l.email || '',
          telefono: l.whatsapp_phone || '',
          direccion: '',
        });
      }
    })();
  }, [params, empresaId]);

  const opciones = useMemo(
    () =>
      Object.entries(catalogo)
        .map(([codInt, p]) => ({ codInt, nombre: p.producto }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [catalogo],
  );

  const resultado = useMemo(
    () => cotizarFase0(filas, catalogo, anchoRollo),
    [filas, catalogo, anchoRollo],
  );

  // Mapea cada fila válida a su línea calculada (mismo orden tras el filtro).
  const lineaDeFila = useMemo(() => {
    const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);
    const m = new Map<string, LineaResultado>();
    validas.forEach((f, i) => {
      const ln = resultado.lineas[i];
      if (ln) m.set(f.id, ln);
    });
    return m;
  }, [filas, resultado]);

  const setFila = (id: string, patch: Partial<FilaUI>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const quitarFila = (id: string) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));

  const t = resultado.totales;

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* HEADER */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <span className="text-base font-bold">Cotización · Fase 0</span>
        <Button onClick={() => window.print()} size="sm" variant="outline" className="gap-1.5">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      {/* Aviso de validación */}
      <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning print:hidden">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Precios en validación. El motor está calibrado para cortinas roller (Blackout/Screen/Dúo);
          las demás familias se afinan luego. Conviene comparar un caso contra el Excel antes de usar
          en clientes.
        </span>
      </div>

      <div className="px-5 py-4">
        {/* DATOS DEL CLIENTE */}
        <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nombre" value={cliente.nombre} onChange={(v) => setCliente({ ...cliente, nombre: v })} />
          <Campo label="RUT" value={cliente.rut} onChange={(v) => setCliente({ ...cliente, rut: v })} />
          <Campo label="Teléfono" value={cliente.telefono} onChange={(v) => setCliente({ ...cliente, telefono: v })} />
          <Campo label="Mail" value={cliente.mail} onChange={(v) => setCliente({ ...cliente, mail: v })} />
          <Campo label="Dirección" value={cliente.direccion} onChange={(v) => setCliente({ ...cliente, direccion: v })} />
        </section>

        {/* GRILLA DE PRODUCTOS */}
        <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Producto</th>
                <th className="px-2 py-2 text-right">Ancho (m)</th>
                <th className="px-2 py-2 text-right">Alto (m)</th>
                <th className="px-2 py-2 text-right">Cant</th>
                <th className="px-2 py-2 text-right">m²</th>
                <th className="px-2 py-2 text-right">Valor unit.</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const ln = lineaDeFila.get(f.id);
                return (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-2 py-1.5">
                      <select
                        value={f.codInt}
                        onChange={(e) => setFila(f.id, { codInt: e.target.value })}
                        className="w-56 rounded-md border border-border bg-card px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                      >
                        <option value="">— Elegir producto —</option>
                        {opciones.map((o) => (
                          <option key={o.codInt} value={o.codInt}>
                            {o.nombre} ({o.codInt})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={f.ancho || ''}
                        onChange={(e) => setFila(f.id, { ancho: parseFloat(e.target.value) || 0 })}
                        className="w-20 text-right"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={f.alto || ''}
                        onChange={(e) => setFila(f.id, { alto: parseFloat(e.target.value) || 0 })}
                        className="w-20 text-right"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Input
                        type="number"
                        min="1"
                        value={f.cantidad || 1}
                        onChange={(e) => setFila(f.id, { cantidad: parseInt(e.target.value) || 1 })}
                        className="w-16 text-right"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground">
                      {ln ? ln.m2.toFixed(2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right">{ln ? formatCLP(ln.valorUnit) : '—'}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      {ln ? formatCLP(ln.total) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right print:hidden">
                      <button
                        onClick={() => quitarFila(f.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Quitar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-border p-2 print:hidden">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setFilas((p) => [...p, nuevaFila()])}>
              <Plus className="h-3.5 w-3.5" /> Agregar cortina
            </Button>
          </div>
        </section>

        {/* TOTALES */}
        <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <Fila label="Subtotal neto" valor={formatCLP(t.subtotalNeto)} />
          <Fila label="IVA 19%" valor={formatCLP(t.ivaTransferencia)} />
          <Fila label="Total transferencia" valor={formatCLP(t.totalTransferencia)} fuerte />
          <div className="my-1 border-t border-border" />
          <Fila label="Total tarjeta crédito" valor={formatCLP(t.totalTarjeta)} />
          <Fila label="Abono 50% (inicio)" valor={formatCLP(t.abono50)} />
        </section>

        {/* CONDICIONES (resumen del Formato) */}
        <section className="mt-4 rounded-lg border border-border bg-card/40 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <div className="mb-1 font-semibold text-foreground">Condiciones</div>
          Cotización válida por 5 días. Pago: 50% para iniciar la fabricación y 50% al finalizar la
          instalación. Tarjeta de crédito hasta 6 cuotas sin interés (recargo MercadoPago 13,8%).
          Primera visita sin costo previa cotización (RM en AVN). Las cortinas se fabrican a medida;
          una vez confeccionadas no hay devolución de dinero. Verificar stock de la tela antes de pagar.
        </section>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-muted-foreground', fuerte && 'font-semibold text-foreground')}>{label}</span>
      <span className={cn('tabular-nums', fuerte ? 'text-base font-bold text-foreground' : 'text-foreground')}>
        {valor}
      </span>
    </div>
  );
}
