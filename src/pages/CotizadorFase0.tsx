import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Printer, Search } from 'lucide-react';
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
import type { Producto } from '@/modules/cotizador/types';

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
  descuento: number;
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
  descuento: number;
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
const CATEGORIAS_MECANISMO = [
  'ROL', 'ROL_DUAL', 'ROL_MANUAL_CENEFA_OVALADA_38mm', 'ROL_MANUAL_CENEFA_OVALADA_45mm',
  'ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO', 'ROL_CENEFA_OVALADA_MOTOR_GRANDE', 'PLETINA_ROLLER_V',
  'DUO_MANUAL_38mm', 'DUO_MANUAL_45mm', 'DUO_MOTOR_PEQUEÑO_38mm', 'DUO_MOTOR_GRANDE_45mm',
  'PLETINA_DUO_V', 'VERTICAL', 'SOFT_LIGHT_38mm', 'SOFT_LIGHT_45mm', 'DARK_38mm', 'DARK_45mm',
  'OSCURANTI_63mm',
];

// ── Filtros del catálogo (chips de colores, estilo Excel) ─────────────
const N = (s?: string) => (s || '').toUpperCase();
type Filtro = {
  id: string;
  label: string;
  cls: string; // tailwind para el chip
  match: (p: Producto, codInt: string) => boolean;
};
const FILTROS_CATALOGO: Filtro[] = [
  { id: 'BK', label: 'BK', cls: 'bg-amber-100 text-amber-900 border-amber-400',
    match: (p) => ['BLACKOUT_P', 'BLACKOUT_D', 'BLACKOUT_S'].includes(N(p.cod)) },
  { id: 'BK_V', label: 'BK VERT', cls: 'bg-orange-200 text-orange-900 border-orange-400',
    match: (p) => N(p.cod).startsWith('BLACKOUT_V') },
  { id: 'SCR', label: 'SCR', cls: 'bg-green-200 text-green-900 border-green-500',
    match: (p) => ['SCREEN_P', 'SCREEN_D', 'SCREEN_S'].includes(N(p.cod)) },
  { id: 'SC_V', label: 'SC VERT', cls: 'bg-emerald-300 text-emerald-900 border-emerald-600',
    match: (p) => N(p.cod).startsWith('SCREEN_V') },
  { id: 'DUO_BK', label: 'DUO BK', cls: 'bg-sky-200 text-sky-900 border-sky-400',
    match: (p) => N(p.cod).startsWith('DUOBK') },
  { id: 'DUO_POLI', label: 'DUO POLI', cls: 'bg-blue-200 text-blue-900 border-blue-500',
    match: (p) => N(p.cod).startsWith('DUOPOLI') },
  { id: 'SOFT', label: 'SOFT', cls: 'bg-lime-400 text-lime-950 border-lime-600',
    match: (p, ci) => N(p.producto).includes('SOFT') || N(ci).startsWith('SOFT') },
  { id: 'OSCURA', label: 'OSCURA', cls: 'bg-teal-400 text-teal-950 border-teal-600',
    match: (p) => N(p.producto).includes('OSCURANTI') || N(p.producto).includes('DARK') },
  { id: 'MOT_VERT', label: 'MOT VERT', cls: 'bg-purple-300 text-purple-950 border-purple-600',
    match: (p) => N(p.producto).includes('MOTOR') && N(p.producto).includes('VERTICAL') },
  { id: 'MOT', label: 'MOT', cls: 'bg-amber-700 text-white border-amber-800',
    match: (p, ci) => {
      const t = N(p.producto), c = N(ci);
      return (t.includes('MOTOR') && !t.includes('VERTICAL') && !t.includes('GRANDE') && !c.includes('MG'))
        || c.startsWith('MOT ');
    } },
  { id: 'MOTOR_GRANDE', label: 'MOTOR GRANDE', cls: 'bg-fuchsia-500 text-white border-fuchsia-700',
    match: (p) => N(p.producto).includes('MOTOR') && N(p.producto).includes('GRANDE') },
  { id: 'MOTOR_MG', label: 'MOTOR MG', cls: 'bg-gray-400 text-gray-950 border-gray-600',
    match: (p, ci) => N(p.producto).includes('MOTOR') && (N(ci).includes('MG') || N(p.producto).includes(' MG')) },
];

const esCortinaTipo = (tipo: string): boolean =>
  ['PREMIUM', 'DELUX', 'STANDARD', 'BASIC'].includes((tipo || '').toUpperCase().trim());

export function CotizadorFase0() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { empresaId } = useAuth();
  const { catalogo } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();

  const [cliente, setCliente] = useState<Cliente>(EMPTY_CLIENTE);
  const [filas, setFilas] = useState<FilaUI[]>([nuevaFila()]);
  const [adicionales, setAdicionales] = useState<AdicionalUI[]>([]);

  // Filtros del panel de catálogo
  const [filtroActivo, setFiltroActivo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

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

  // Lista de productos filtrados según chip activo + búsqueda libre.
  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const filtro = filtroActivo ? FILTROS_CATALOGO.find((f) => f.id === filtroActivo) : null;
    return Object.entries(catalogo)
      .filter(([ci, p]) => {
        if (filtro && !filtro.match(p, ci)) return false;
        if (q) {
          const hay = `${ci} ${p.producto || ''} ${p.cod || ''}`.toUpperCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a[1].producto || '').localeCompare(b[1].producto || ''));
  }, [catalogo, filtroActivo, busqueda]);

  const agregarProducto = (codInt: string) => {
    const prod = catalogo[codInt];
    if (!prod) return;
    if (esCortinaTipo(prod.tipo)) {
      setFilas((prev) => {
        const last = prev[prev.length - 1];
        if (last && !last.codInt && last.ancho === 0 && last.alto === 0) {
          return prev.map((f, i) => (i === prev.length - 1 ? { ...f, codInt } : f));
        }
        return [...prev, { ...nuevaFila(), codInt }];
      });
    } else {
      setAdicionales((prev) => [...prev, { ...nuevoAdicional(), codInt }]);
    }
  };

  const setFila = (id: string, patch: Partial<FilaUI>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const quitarFila = (id: string) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));

  const setAdic = (id: string, patch: Partial<AdicionalUI>) =>
    setAdicionales((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const quitarAdic = (id: string) =>
    setAdicionales((prev) => prev.filter((a) => a.id !== id));

  const t = resultado.totales;
  const hayFiltro = filtroActivo !== null || busqueda.trim().length > 0;

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
        {/* DATOS DEL CLIENTE */}
        <section className="mb-4 grid gap-3 rounded-lg border border-border bg-card/40 p-4 md:grid-cols-2 lg:grid-cols-3">
          <Campo label="Nombre" value={cliente.nombre} onChange={(v) => setCliente({ ...cliente, nombre: v })} />
          <Campo label="RUT" value={cliente.rut} onChange={(v) => setCliente({ ...cliente, rut: v })} />
          <Campo label="Teléfono" value={cliente.telefono} onChange={(v) => setCliente({ ...cliente, telefono: v })} />
          <Campo label="Mail" value={cliente.mail} onChange={(v) => setCliente({ ...cliente, mail: v })} />
          <Campo label="Dirección" value={cliente.direccion} onChange={(v) => setCliente({ ...cliente, direccion: v })} />
        </section>

        {/* CATÁLOGO con chips de colores (estilo Excel) */}
        <section className="mb-4 rounded-lg border border-border bg-card/40 p-3 print:hidden">
          <div className="mb-2 flex items-baseline gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Catálogo · elige una categoría y agrega con un clic
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFiltroActivo(null)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filtroActivo === null
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card text-muted-foreground hover:bg-secondary',
              )}
            >
              Todos
            </button>
            {FILTROS_CATALOGO.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroActivo(filtroActivo === f.id ? null : f.id)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-[11px] font-bold transition-all',
                  f.cls,
                  filtroActivo === f.id ? 'ring-2 ring-foreground ring-offset-1' : 'opacity-90 hover:opacity-100',
                )}
              >
                {f.label}
              </button>
            ))}
            <div className="relative ml-auto w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, código…"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {hayFiltro ? (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <Th>COD_INT</Th>
                    <Th>PRODUCTO</Th>
                    <Th>TIPO</Th>
                    <Th className="text-right">PRECIO</Th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                        Sin productos para esta categoría/búsqueda.
                      </td>
                    </tr>
                  )}
                  {productosFiltrados.slice(0, 200).map(([ci, p]) => (
                    <tr key={ci} className="border-t border-border hover:bg-secondary/40">
                      <Td className="font-semibold">{ci}</Td>
                      <Td className="text-muted-foreground">{p.producto}</Td>
                      <Td className="text-[10px] text-muted-foreground">{p.tipo}</Td>
                      <Td className="text-right tabular-nums">
                        {p.precio ? formatCLP(Number(p.precio)) : '—'}
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => agregarProducto(ci)}
                          className="rounded bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground hover:bg-accent/90"
                          title={
                            esCortinaTipo(p.tipo)
                              ? 'Agregar como cortina'
                              : 'Agregar como adicional'
                          }
                        >
                          + Agregar
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {productosFiltrados.length > 200 && (
                <div className="border-t border-border bg-card/60 px-3 py-1 text-[10px] text-muted-foreground">
                  Mostrando 200 de {productosFiltrados.length} — refina la búsqueda para ver el resto.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
              Selecciona una categoría o escribe en el buscador para ver productos. También puedes
              seguir escribiendo el COD_INT directamente en la grilla de abajo.
            </div>
          )}
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
                    <Td><SelectCell value={f.categoria} onChange={(v) => setFila(f.id, { categoria: v })} opciones={CATEGORIAS_MECANISMO} /></Td>
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
              Sin adicionales. Filtra el catálogo arriba y agrega, o usa el botón de abajo.
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
