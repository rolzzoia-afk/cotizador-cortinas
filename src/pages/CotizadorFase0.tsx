import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useCatalogoProductos, useAnchoRollo } from '@/modules/cotizador/catalogo';
import {
  cotizarFase0,
  type LineaResultado,
  type AdicionalResultado,
} from '@/modules/cotizador/motorFase0';
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

type FilaUI = {
  id: string;
  codInt: string;
  categoria: string;
  direccion: string;
  sentido: string;
  cantidad: number;
  ubicacion: string;
  colorAcc: string;
  ancho: number;
  alto: number;
  descuento: number; // porcentaje 0-100
};
const nuevaFila = (): FilaUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  categoria: '',
  direccion: '',
  sentido: '',
  cantidad: 1,
  ubicacion: '',
  colorAcc: '',
  ancho: 0,
  alto: 0,
  descuento: 0,
});

type AdicionalUI = {
  id: string;
  codInt: string;
  cantidad: number;
  descuento: number; // porcentaje 0-100
};
const nuevoAdicional = (): AdicionalUI => ({
  id: crypto.randomUUID(),
  codInt: '',
  cantidad: 1,
  descuento: 0,
});

const DIRECCIONES = [
  'CAD [IZQUIERDA]',
  'CAD [DERECHA]',
  'CIERRE [DERECHO]',
  'CIERRE [IZQUIERDO]',
  'CIERRE [MEDIO]',
];
const SENTIDOS = ['INTERNO', 'EXTERNO'];
const CATEGORIAS = [
  'ROL',
  'ROL_DUAL',
  'ROL_MANUAL_CENEFA_OVALADA_38mm',
  'ROL_MANUAL_CENEFA_OVALADA_45mm',
  'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO',
  'ROL_CENEFA_OVALADA_MOTOR_GRANDE',
  'PLETINA_ROLLER_V',
  'DUO_MANUAL_38mm',
  'DUO_MANUAL_45mm',
  'DUO_MOTOR_PEQUEÑO_38mm',
  'DUO_MOTOR_GRANDE_45mm',
  'PLETINA_DUO_V',
  'VERTICAL',
  'SOFT_LIGHT_38mm',
  'SOFT_LIGHT_45mm',
  'DARK_38mm',
  'DARK_45mm',
  'OSCURANTI_63mm',
];

export function CotizadorFase0() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { empresaId } = useAuth();
  const { catalogo } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();

  const [cliente, setCliente] = useState<Cliente>(EMPTY_CLIENTE);
  const [filas, setFilas] = useState<FilaUI[]>([nuevaFila()]);
  const [adicionales, setAdicionales] = useState<AdicionalUI[]>([]);

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

  const resultado = useMemo(() => {
    const filasMotor = filas.map((f) => ({
      codInt: f.codInt,
      ancho: f.ancho,
      alto: f.alto,
      cantidad: f.cantidad,
      descuento: f.descuento / 100,
    }));
    const adicMotor = adicionales.map((a) => ({
      codInt: a.codInt,
      cantidad: a.cantidad,
      descuento: a.descuento / 100,
    }));
    return cotizarFase0(filasMotor, catalogo, anchoRollo, adicMotor);
  }, [filas, adicionales, catalogo, anchoRollo]);

  const lineaDeFila = useMemo(() => {
    const validas = filas.filter((f) => f.codInt && f.ancho > 0 && f.alto > 0);
    const m = new Map<string, LineaResultado>();
    validas.forEach((f, i) => {
      const ln = resultado.lineas[i];
      if (ln) m.set(f.id, ln);
    });
    return m;
  }, [filas, resultado]);

  const adicResDeFila = useMemo(() => {
    const validos = adicionales.filter((a) => a.codInt && a.cantidad > 0);
    const m = new Map<string, AdicionalResultado>();
    validos.forEach((a, i) => {
      const r = resultado.adicionales[i];
      if (r) m.set(a.id, r);
    });
    return m;
  }, [adicionales, resultado]);

  const setFila = (id: string, patch: Partial<FilaUI>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const quitarFila = (id: string) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));

  const setAdic = (id: string, patch: Partial<AdicionalUI>) =>
    setAdicionales((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const quitarAdic = (id: string) =>
    setAdicionales((prev) => prev.filter((a) => a.id !== id));

  const t = resultado.totales;

  return (
    <div className="min-h-full bg-background text-foreground">
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

      <div className="px-5 py-4">
        <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nombre" value={cliente.nombre} onChange={(v) => setCliente({ ...cliente, nombre: v })} />
          <Campo label="RUT" value={cliente.rut} onChange={(v) => setCliente({ ...cliente, rut: v })} />
          <Campo label="Teléfono" value={cliente.telefono} onChange={(v) => setCliente({ ...cliente, telefono: v })} />
          <Campo label="Mail" value={cliente.mail} onChange={(v) => setCliente({ ...cliente, mail: v })} />
          <Campo label="Dirección" value={cliente.direccion} onChange={(v) => setCliente({ ...cliente, direccion: v })} />
        </section>

        {/* CORTINAS */}
        <section className="overflow-x-auto rounded-lg border border-border bg-card/40">
          <datalist id="codint-options">
            {Object.entries(catalogo).map(([k, p]) => (
              <option key={k} value={k}>
                {p.producto}
              </option>
            ))}
          </datalist>

          <table className="w-full min-w-[1600px] border-collapse text-xs">
            <thead className="bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-border">
                <th colSpan={11} className="px-2 py-1.5 text-center font-semibold">Información del producto</th>
                <th colSpan={2} className="border-l border-border px-2 py-1.5 text-center font-semibold">Medidas</th>
                <th colSpan={4} className="border-l border-border px-2 py-1.5 text-center font-semibold">Precio</th>
                <th></th>
              </tr>
              <tr className="border-b border-border">
                <Th>COD</Th>
                <Th>COD SEC</Th>
                <Th>DIRECC. CAD/CIERRE</Th>
                <Th>SENT. CORT</Th>
                <Th>CANT</Th>
                <Th>PRODUCTO</Th>
                <Th>COD_INT</Th>
                <Th>TIPO</Th>
                <Th>DESCRIPCIÓN</Th>
                <Th>UBIC.</Th>
                <Th>COLOR ACCESORIOS</Th>
                <Th className="border-l border-border">ANCHO</Th>
                <Th>ALTO</Th>
                <Th className="border-l border-border">M²</Th>
                <Th>VAL.UNIT.</Th>
                <Th>DCT %</Th>
                <Th>TOTAL</Th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const prod = f.codInt ? catalogo[f.codInt.trim()] : undefined;
                const ln = lineaDeFila.get(f.id);
                return (
                  <tr key={f.id} className="border-t border-border align-middle">
                    <Td className="text-muted-foreground">{prod?.cod ?? '—'}</Td>
                    <Td><SelectCell value={f.categoria} onChange={(v) => setFila(f.id, { categoria: v })} opciones={CATEGORIAS} /></Td>
                    <Td><SelectCell value={f.direccion} onChange={(v) => setFila(f.id, { direccion: v })} opciones={DIRECCIONES} /></Td>
                    <Td><SelectCell value={f.sentido} onChange={(v) => setFila(f.id, { sentido: v })} opciones={SENTIDOS} /></Td>
                    <Td>
                      <CellInput type="number" min={1} value={f.cantidad || 1}
                        onChange={(e) => setFila(f.id, { cantidad: parseInt(e.target.value) || 1 })}
                        className="w-14 text-right" />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.producto ?? '—'}</Td>
                    <Td>
                      <CellInput list="codint-options" value={f.codInt}
                        onChange={(e) => setFila(f.id, { codInt: e.target.value })}
                        placeholder="ej. SC 68" className="w-24" />
                    </Td>
                    <Td className="text-muted-foreground">{prod?.tipo ?? '—'}</Td>
                    <Td className="text-muted-foreground">{prod?.descripcion ?? '—'}</Td>
                    <Td>
                      <CellInput value={f.ubicacion}
                        onChange={(e) => setFila(f.id, { ubicacion: e.target.value })}
                        placeholder="V1-G1" className="w-20" />
                    </Td>
                    <Td>
                      <CellInput value={f.colorAcc}
                        onChange={(e) => setFila(f.id, { colorAcc: e.target.value })}
                        placeholder="GRIS" className="w-24" />
                    </Td>
                    <Td className="border-l border-border">
                      <CellInput type="number" step="0.001" value={f.ancho || ''}
                        onChange={(e) => setFila(f.id, { ancho: parseFloat(e.target.value) || 0 })}
                        className="w-20 text-right" />
                    </Td>
                    <Td>
                      <CellInput type="number" step="0.001" value={f.alto || ''}
                        onChange={(e) => setFila(f.id, { alto: parseFloat(e.target.value) || 0 })}
                        className="w-20 text-right" />
                    </Td>
                    <Td className="border-l border-border text-right text-muted-foreground">
                      {ln ? ln.m2.toFixed(2) : '—'}
                    </Td>
                    <Td className="text-right">{ln ? formatCLP(ln.valorUnit) : '—'}</Td>
                    <Td>
                      <CellInput type="number" min={0} max={100} step="1" value={f.descuento || ''}
                        onChange={(e) => setFila(f.id, { descuento: parseFloat(e.target.value) || 0 })}
                        className="w-14 text-right" placeholder="0" />
                    </Td>
                    <Td className="text-right font-semibold">{ln ? formatCLP(ln.total) : '—'}</Td>
                    <Td className="text-right print:hidden">
                      <button onClick={() => quitarFila(f.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Quitar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Td>
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

        {/* ADICIONALES */}
        <section className="mt-4 overflow-x-auto rounded-lg border border-border bg-card/40">
          <div className="border-b border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Adicionales (instalaciones extras, cenefas, motores, controles, traslados…)
          </div>
          {adicionales.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground print:hidden">
              Sin adicionales. Usa el botón de abajo para agregar.
            </div>
          ) : (
            <table className="w-full min-w-[800px] border-collapse text-xs">
              <thead className="bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b border-border">
                  <Th>COD_INT</Th>
                  <Th>PRODUCTO</Th>
                  <Th>DESCRIPCIÓN</Th>
                  <Th>CANT</Th>
                  <Th>VAL.UNIT.</Th>
                  <Th>DCT %</Th>
                  <Th>TOTAL</Th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {adicionales.map((a) => {
                  const prod = a.codInt ? catalogo[a.codInt.trim()] : undefined;
                  const r = adicResDeFila.get(a.id);
                  return (
                    <tr key={a.id} className="border-t border-border align-middle">
                      <Td>
                        <CellInput list="codint-options" value={a.codInt}
                          onChange={(e) => setAdic(a.id, { codInt: e.target.value })}
                          placeholder="ej. DOM 38" className="w-28" />
                      </Td>
                      <Td className="text-muted-foreground">{prod?.producto ?? '—'}</Td>
                      <Td className="text-muted-foreground">{prod?.descripcion ?? '—'}</Td>
                      <Td>
                        <CellInput type="number" step="0.01" value={a.cantidad || ''}
                          onChange={(e) => setAdic(a.id, { cantidad: parseFloat(e.target.value) || 0 })}
                          className="w-16 text-right" />
                      </Td>
                      <Td className="text-right">{r ? formatCLP(r.precioUnit) : '—'}</Td>
                      <Td>
                        <CellInput type="number" min={0} max={100} step="1" value={a.descuento || ''}
                          onChange={(e) => setAdic(a.id, { descuento: parseFloat(e.target.value) || 0 })}
                          className="w-14 text-right" placeholder="0" />
                      </Td>
                      <Td className="text-right font-semibold">{r ? formatCLP(r.total) : '—'}</Td>
                      <Td className="text-right print:hidden">
                        <button onClick={() => quitarAdic(a.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Quitar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="border-t border-border p-2 print:hidden">
            <Button size="sm" variant="outline" className="gap-1"
              onClick={() => setAdicionales((p) => [...p, nuevoAdicional()])}>
              <Plus className="h-3.5 w-3.5" /> Agregar adicional
            </Button>
          </div>
        </section>

        <section className="mt-4 ml-auto max-w-sm space-y-1.5 rounded-lg border border-border bg-card/40 p-4 text-sm">
          <FilaTotal label="Subtotal neto" valor={formatCLP(t.subtotalNeto)} />
          <FilaTotal label="IVA 19%" valor={formatCLP(t.ivaTransferencia)} />
          <FilaTotal label="Total transferencia" valor={formatCLP(t.totalTransferencia)} fuerte />
          <div className="my-1 border-t border-border" />
          <FilaTotal label="Total tarjeta crédito" valor={formatCLP(t.totalTarjeta)} />
          <FilaTotal label="Abono 50% (inicio)" valor={formatCLP(t.abono50)} />
        </section>

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

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('whitespace-nowrap px-2 py-1.5 text-left font-medium text-muted-foreground', className)}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('whitespace-nowrap px-2 py-1.5 align-middle', className)}>{children}</td>;
}

function CellInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn(
        'h-7 rounded-md border-border bg-card px-2 py-0 text-xs focus:border-accent',
        props.className,
      )}
    />
  );
}

function SelectCell({
  value,
  onChange,
  opciones,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full max-w-[14rem] rounded-md border border-border bg-card px-1 text-xs focus:border-accent focus:outline-none"
    >
      <option value="">—</option>
      {opciones.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
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

function FilaTotal({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-muted-foreground', fuerte && 'font-semibold text-foreground')}>{label}</span>
      <span className={cn('tabular-nums', fuerte ? 'text-base font-bold text-foreground' : 'text-foreground')}>
        {valor}
      </span>
    </div>
  );
}
