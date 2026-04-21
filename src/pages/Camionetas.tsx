import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  BoxIcon,
  Car,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Minus,
  Package,
  Plus,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Camioneta = {
  id: string;
  nombre: string;
  patente: string | null;
  instalador: string | null;
  activa: boolean;
};

type Insumo = {
  id: string;
  nemotecnico: string | null;
  cod: string | null;
  stock_total: number | null;
};

type StockItem = {
  id: string;
  camioneta_id: string;
  insumo_id: string;
  cantidad: number;
  insumos?: { nemotecnico: string | null; cod: string | null } | null;
};

type Movimiento = {
  id: string;
  tipo:
    | 'carga'
    | 'uso'
    | 'swap_salida'
    | 'swap_entrada'
    | 'devolucion'
    | 'defectuoso';
  cantidad: number;
  motivo: string | null;
  registrado_por: string | null;
  created_at: string;
  insumo_id: string;
  insumos?: { nemotecnico: string | null; cod: string | null } | null;
};

type Vista = 'main' | 'detalle' | 'carga' | 'swap' | 'devolucion' | 'historial';

const TIPO_LABEL: Record<Movimiento['tipo'], string> = {
  carga: 'Carga',
  uso: 'Uso en obra',
  swap_salida: 'Swap — salida',
  swap_entrada: 'Swap — entrada',
  devolucion: 'Devolución',
  defectuoso: 'Defectuoso',
};

const TIPO_BADGE: Record<Movimiento['tipo'], 'info' | 'success' | 'warning' | 'secondary' | 'destructive'> =
  {
    carga: 'info',
    uso: 'success',
    swap_salida: 'warning',
    swap_entrada: 'warning',
    devolucion: 'secondary',
    defectuoso: 'destructive',
  };

export function Camionetas() {
  const { empresaId } = useAuth();
  const [vista, setVista] = useState<Vista>('main');
  const [camionetaActual, setCamionetaActual] = useState<Camioneta | null>(null);
  const [stockCamioneta, setStockCamioneta] = useState<StockItem[]>([]);
  const [abrirNueva, setAbrirNueva] = useState(false);

  const volverMain = () => {
    setCamionetaActual(null);
    setStockCamioneta([]);
    setVista('main');
  };

  const refrescarStock = async () => {
    if (!camionetaActual) return;
    const { data } = await supabase
      .from('inventario_camioneta')
      .select('*, insumos(nemotecnico, cod)')
      .eq('camioneta_id', camionetaActual.id)
      .gt('cantidad', 0)
      .order('cantidad', { ascending: false });
    setStockCamioneta((data as StockItem[]) ?? []);
  };

  const abrirCamioneta = async (c: Camioneta) => {
    setCamionetaActual(c);
    setVista('detalle');
  };

  useEffect(() => {
    if (vista === 'detalle') refrescarStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camionetaActual, vista]);

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-4 flex items-center gap-2">
        {vista !== 'main' && (
          <Button size="sm" variant="ghost" onClick={volverMain}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Truck className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <h1 className="text-lg font-bold">
            {vista === 'main'
              ? 'Camionetas'
              : camionetaActual
              ? `🚐 ${camionetaActual.nombre}`
              : 'Camionetas'}
          </h1>
          {vista !== 'main' && camionetaActual?.patente && (
            <p className="text-xs text-muted-foreground">{camionetaActual.patente}</p>
          )}
        </div>
        {vista === 'main' && (
          <Button onClick={() => setAbrirNueva(true)} size="sm">
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        )}
      </header>

      {vista === 'main' && (
        <VistaMain empresaId={empresaId} onAbrir={abrirCamioneta} abrirNueva={abrirNueva} setAbrirNueva={setAbrirNueva} />
      )}
      {vista === 'detalle' && camionetaActual && (
        <VistaDetalle
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onVista={setVista}
          onRefresh={refrescarStock}
          onEliminada={volverMain}
        />
      )}
      {vista === 'carga' && camionetaActual && empresaId && (
        <VistaCarga
          camioneta={camionetaActual}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'swap' && camionetaActual && empresaId && (
        <VistaSwap
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'devolucion' && camionetaActual && empresaId && (
        <VistaDevolucion
          camioneta={camionetaActual}
          stock={stockCamioneta}
          empresaId={empresaId}
          onDone={async () => {
            await refrescarStock();
            setVista('detalle');
          }}
        />
      )}
      {vista === 'historial' && camionetaActual && (
        <VistaHistorial camioneta={camionetaActual} />
      )}
    </div>
  );
}

// ── Vista Main: lista de camionetas ────────────────────────────────
function VistaMain({
  empresaId,
  onAbrir,
  abrirNueva,
  setAbrirNueva,
}: {
  empresaId: string | null;
  onAbrir: (c: Camioneta) => void;
  abrirNueva: boolean;
  setAbrirNueva: (v: boolean) => void;
}) {
  const [cams, setCams] = useState<Camioneta[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, StockItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data: camsData } = await supabase
      .from('camionetas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('activa', true)
      .order('nombre');
    const list = (camsData as Camioneta[]) ?? [];
    setCams(list);

    if (list.length > 0) {
      const { data: stockData } = await supabase
        .from('inventario_camioneta')
        .select('id, camioneta_id, insumo_id, cantidad')
        .in('camioneta_id', list.map((c) => c.id));
      const map = new Map<string, StockItem[]>();
      for (const s of (stockData as StockItem[]) ?? []) {
        if (!map.has(s.camioneta_id)) map.set(s.camioneta_id, []);
        map.get(s.camioneta_id)!.push(s);
      }
      setStockMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  if (loading) return <EmptyState>Cargando camionetas…</EmptyState>;

  if (cams.length === 0) {
    return (
      <>
        <EmptyState>
          <Truck className="mx-auto mb-3 h-10 w-10 opacity-40" />
          No hay camionetas registradas.
          <p className="mt-2 text-xs">Toca + para agregar la primera.</p>
        </EmptyState>
        <NuevaCamionetaDialog
          open={abrirNueva}
          onOpenChange={setAbrirNueva}
          empresaId={empresaId}
          onCreada={cargar}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {cams.map((cam) => {
          const stock = stockMap.get(cam.id) ?? [];
          const totalItems = stock.reduce((s, x) => s + x.cantidad, 0);
          const tipos = stock.filter((s) => s.cantidad > 0).length;
          return (
            <button
              key={cam.id}
              onClick={() => onAbrir(cam)}
              className="w-full cursor-pointer rounded-2xl border bg-card p-4 text-left transition-all hover:border-primary/40 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">🚐</div>
                <div className="flex-1">
                  <div className="text-base font-bold">{cam.nombre}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {cam.patente && (
                      <>
                        <Car className="mr-1 inline h-3 w-3" />
                        {cam.patente}
                      </>
                    )}
                    {cam.instalador && (
                      <>
                        {' · '}
                        <User className="mr-1 inline h-3 w-3" />
                        {cam.instalador}
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tipos === 0 ? (
                  <Badge variant="secondary" className="gap-1">
                    <Package className="h-3 w-3" />
                    Vacía
                  </Badge>
                ) : (
                  <>
                    <Badge variant="success" className="gap-1">
                      <BoxIcon className="h-3 w-3" />
                      {tipos} tipo{tipos > 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="success" className="gap-1">
                      {totalItems} unidades
                    </Badge>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <NuevaCamionetaDialog
        open={abrirNueva}
        onOpenChange={setAbrirNueva}
        empresaId={empresaId}
        onCreada={cargar}
      />
    </>
  );
}

// ── Vista Detalle: stock actual + acciones ─────────────────────────
function VistaDetalle({
  camioneta,
  stock,
  empresaId,
  onVista,
  onRefresh: _onRefresh,
  onEliminada,
}: {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string | null;
  onVista: (v: Vista) => void;
  onRefresh: () => Promise<void>;
  onEliminada: () => void;
}) {
  const eliminar = async () => {
    if (!empresaId) return;
    const { data: stockActivo } = await supabase
      .from('inventario_camioneta')
      .select('id')
      .eq('camioneta_id', camioneta.id)
      .gt('cantidad', 0)
      .limit(1);
    if (stockActivo && stockActivo.length > 0) {
      toast.warning('La camioneta tiene stock. Devuelve todo a bodega antes de eliminarla.');
      return;
    }
    const ok = window.confirm(
      `¿Eliminar la camioneta "${camioneta.nombre}"?\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;

    await supabase.from('inventario_camioneta').delete().eq('camioneta_id', camioneta.id);
    const { error } = await supabase.from('camionetas').delete().eq('id', camioneta.id);
    if (error) {
      toast.error('Error al eliminar la camioneta');
      return;
    }
    toast.success(`Camioneta "${camioneta.nombre}" eliminada`);
    onEliminada();
  };

  return (
    <>
      <SectionTitle>Stock actual</SectionTitle>
      {stock.length === 0 ? (
        <EmptyState>
          <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
          La camioneta está vacía.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {stock.map((s) => {
            const nombre = s.insumos?.nemotecnico ?? s.insumos?.cod ?? 'Insumo';
            const cls =
              s.cantidad === 0
                ? 'text-destructive'
                : s.cantidad <= 2
                ? 'text-yellow-500'
                : 'text-green-500';
            return (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold">{nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.insumos?.cod ?? ''}
                  </div>
                </div>
                <div className={cn('text-lg font-extrabold', cls)}>{s.cantidad}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 space-y-2">
        <Button className="w-full" onClick={() => onVista('carga')}>
          <Package className="h-4 w-4" />
          Cargar camioneta
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onVista('swap')}>
          <ArrowLeftRight className="h-4 w-4" />
          Registrar cambio / swap en obra
        </Button>
        <Button variant="outline" className="w-full" onClick={() => onVista('devolucion')}>
          <ClipboardCheck className="h-4 w-4" />
          Registrar devolución a bodega
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => onVista('historial')}>
          <Clock className="h-4 w-4" />
          Ver historial de movimientos
        </Button>
        <Button
          variant="ghost"
          className="mt-3 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={eliminar}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar camioneta
        </Button>
      </div>
    </>
  );
}

// ── Vista Carga ────────────────────────────────────────────────────
function VistaCarga({
  camioneta,
  empresaId,
  onDone,
}: {
  camioneta: Camioneta;
  empresaId: string;
  onDone: () => void;
}) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('insumos')
        .select('id, nemotecnico, cod, stock_total')
        .eq('empresa_id', empresaId)
        .order('nemotecnico');
      setInsumos((data as Insumo[]) ?? []);
    };
    run();
  }, [empresaId]);

  const ajustar = (id: string, delta: number, max: number) => {
    setCantidades((prev) => {
      const actual = prev[id] ?? 0;
      const nuevo = Math.max(0, Math.min(max, actual + delta));
      return { ...prev, [id]: nuevo };
    });
  };

  const confirmar = async () => {
    const items = Object.entries(cantidades).filter(([, q]) => q > 0);
    if (items.length === 0) {
      toast.error('Selecciona al menos un insumo');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre de quien carga');
      return;
    }
    setSaving(true);

    const movs = items.map(([insumo_id, cantidad]) => ({
      empresa_id: empresaId,
      camioneta_id: camioneta.id,
      insumo_id,
      cantidad,
      tipo: 'carga' as const,
      registrado_por: responsable.trim(),
    }));

    const { error } = await supabase.from('movimientos_camioneta').insert(movs);
    if (error) {
      toast.error('Error al registrar movimientos');
      setSaving(false);
      return;
    }

    for (const [insumo_id, cantidad] of items) {
      const { data: existing } = await supabase
        .from('inventario_camioneta')
        .select('id, cantidad')
        .eq('camioneta_id', camioneta.id)
        .eq('insumo_id', insumo_id)
        .maybeSingle<{ id: string; cantidad: number }>();

      if (existing) {
        await supabase
          .from('inventario_camioneta')
          .update({ cantidad: existing.cantidad + cantidad })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('inventario_camioneta')
          .insert({ camioneta_id: camioneta.id, insumo_id, cantidad });
      }
      const ins = insumos.find((i) => i.id === insumo_id);
      if (ins) {
        await supabase
          .from('insumos')
          .update({ stock_total: Math.max(0, (ins.stock_total ?? 0) - cantidad) })
          .eq('id', insumo_id);
      }
    }
    toast.success(`${items.length} insumo${items.length > 1 ? 's' : ''} cargado${items.length > 1 ? 's' : ''}`);
    onDone();
  };

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        Selecciona los insumos y la cantidad que cargas en la camioneta. El stock se
        descontará de bodega.
      </p>
      <Label htmlFor="resp">¿Quién carga?</Label>
      <Input
        id="resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del instalador o bodeguero"
        className="mb-4"
      />
      <SectionTitle>Insumos disponibles en bodega</SectionTitle>
      <div className="mb-4 max-h-[50vh] space-y-2 overflow-y-auto pr-1">
        {insumos.map((ins) => {
          const qty = cantidades[ins.id] ?? 0;
          const max = ins.stock_total ?? 999;
          return (
            <div
              key={ins.id}
              className={cn(
                'flex items-center justify-between rounded-xl border bg-card px-4 py-3 transition-colors',
                qty > 0 && 'border-primary bg-primary/5',
              )}
            >
              <div>
                <div className="text-sm font-semibold">
                  {ins.nemotecnico ?? ins.cod ?? 'Insumo'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {ins.cod ?? ''} · Stock: {ins.stock_total ?? 0}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => ajustar(ins.id, -1, max)}
                  disabled={qty === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[24px] text-center text-base font-extrabold">
                  {qty}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => ajustar(ins.id, 1, max)}
                  disabled={qty >= max}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={confirmar} className="w-full" disabled={saving}>
        {saving ? 'Guardando…' : 'Confirmar carga'}
      </Button>
    </>
  );
}

// ── Vista Swap ─────────────────────────────────────────────────────
function VistaSwap({
  camioneta,
  stock,
  empresaId,
  onDone,
}: {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string;
  onDone: () => void;
}) {
  const [todos, setTodos] = useState<Insumo[]>([]);
  const [salida, setSalida] = useState('');
  const [entrada, setEntrada] = useState('');
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('insumos')
        .select('id, nemotecnico, cod, stock_total')
        .eq('empresa_id', empresaId)
        .order('nemotecnico');
      const lista = (data as Insumo[]) ?? [];
      setTodos(lista);

      const stockIds = stock.filter((s) => s.cantidad > 0).map((s) => s.insumo_id);
      if (stockIds.length) setSalida(stockIds[0]);
      else if (lista[0]) setSalida(lista[0].id);
      if (lista[0]) setEntrada(lista[0].id);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const opcionesSalida = stock.filter((s) => s.cantidad > 0).length
    ? stock.filter((s) => s.cantidad > 0).map((s) => ({
        id: s.insumo_id,
        label: s.insumos?.nemotecnico ?? s.insumos?.cod ?? s.insumo_id,
      }))
    : todos.map((i) => ({ id: i.id, label: i.nemotecnico ?? i.cod ?? i.id }));

  const confirmar = async () => {
    if (!salida || !entrada) {
      toast.error('Selecciona ambos insumos');
      return;
    }
    if (salida === entrada) {
      toast.warning('Los insumos deben ser diferentes');
      return;
    }
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre del instalador');
      return;
    }
    setSaving(true);
    const base = {
      empresa_id: empresaId,
      camioneta_id: camioneta.id,
      registrado_por: responsable.trim(),
      motivo: motivo.trim() || null,
    };
    const { error } = await supabase.from('movimientos_camioneta').insert([
      { ...base, insumo_id: salida, tipo: 'swap_salida', insumo_reemplazo_id: entrada, cantidad: 1 },
      { ...base, insumo_id: entrada, tipo: 'swap_entrada', insumo_reemplazo_id: salida, cantidad: 1 },
    ]);
    if (error) {
      toast.error('Error al registrar swap');
      setSaving(false);
      return;
    }

    const stockSalida = stock.find((s) => s.insumo_id === salida);
    if (stockSalida && stockSalida.cantidad > 0) {
      await supabase
        .from('inventario_camioneta')
        .update({ cantidad: Math.max(0, stockSalida.cantidad - 1) })
        .eq('id', stockSalida.id);
    }

    const stockEntrada = stock.find((s) => s.insumo_id === entrada);
    if (stockEntrada) {
      await supabase
        .from('inventario_camioneta')
        .update({ cantidad: stockEntrada.cantidad + 1 })
        .eq('id', stockEntrada.id);
    } else {
      await supabase
        .from('inventario_camioneta')
        .insert({ camioneta_id: camioneta.id, insumo_id: entrada, cantidad: 1 });
    }

    const ins = todos.find((i) => i.id === entrada);
    if (ins) {
      await supabase
        .from('insumos')
        .update({ stock_total: Math.max(0, (ins.stock_total ?? 0) - 1) })
        .eq('id', entrada);
    }

    toast.success('Cambio registrado');
    onDone();
  };

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Registra cuando un insumo fue reemplazado por otro en obra (ej: mec 14 malo → se
        usó mec 13).
      </p>
      <Label>¿Qué insumo se sacó?</Label>
      <Select value={salida} onChange={setSalida} options={opcionesSalida} className="mb-3" />
      <div className="my-2 text-center text-2xl text-yellow-500">↓</div>
      <Label>¿Qué insumo se puso en su lugar?</Label>
      <Select
        value={entrada}
        onChange={setEntrada}
        options={todos.map((i) => ({ id: i.id, label: i.nemotecnico ?? i.cod ?? i.id }))}
        className="mb-3"
      />
      <Label htmlFor="motivo">Motivo</Label>
      <Input
        id="motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej: mecanismo defectuoso, cliente cambió de tipo, etc."
        className="mb-3"
      />
      <Label htmlFor="swap-resp">Registrado por</Label>
      <Input
        id="swap-resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del instalador"
        className="mb-4"
      />
      <Button onClick={confirmar} className="w-full" disabled={saving}>
        {saving ? 'Guardando…' : 'Registrar cambio'}
      </Button>
    </>
  );
}

// ── Vista Devolución ──────────────────────────────────────────────
type EstadoDev = 'ok' | 'defectuoso' | 'queda';

function VistaDevolucion({
  camioneta,
  stock,
  empresaId,
  onDone,
}: {
  camioneta: Camioneta;
  stock: StockItem[];
  empresaId: string;
  onDone: () => void;
}) {
  const [estados, setEstados] = useState<Record<string, EstadoDev>>(() => {
    const e: Record<string, EstadoDev> = {};
    for (const s of stock.filter((x) => x.cantidad > 0)) e[s.insumo_id] = 'ok';
    return e;
  });
  const [responsable, setResponsable] = useState('');
  const [saving, setSaving] = useState(false);

  const stockConQty = stock.filter((s) => s.cantidad > 0);

  const confirmar = async () => {
    if (!responsable.trim()) {
      toast.warning('Ingresa el nombre del bodeguero');
      return;
    }
    if (stockConQty.length === 0) {
      toast.warning('No hay insumos para devolver');
      return;
    }
    setSaving(true);

    const movs = stockConQty
      .filter((s) => (estados[s.insumo_id] ?? 'ok') !== 'queda')
      .map((s) => ({
        empresa_id: empresaId,
        camioneta_id: camioneta.id,
        insumo_id: s.insumo_id,
        cantidad: s.cantidad,
        tipo: estados[s.insumo_id] === 'defectuoso' ? ('defectuoso' as const) : ('devolucion' as const),
        registrado_por: responsable.trim(),
      }));

    if (movs.length > 0) {
      const { error } = await supabase.from('movimientos_camioneta').insert(movs);
      if (error) {
        toast.error('Error al registrar devolución');
        setSaving(false);
        return;
      }
    }

    for (const s of stockConQty) {
      const estado = estados[s.insumo_id] ?? 'ok';
      if (estado === 'queda') continue;
      await supabase.from('inventario_camioneta').update({ cantidad: 0 }).eq('id', s.id);
      if (estado === 'ok') {
        const { data: ins } = await supabase
          .from('insumos')
          .select('stock_total')
          .eq('id', s.insumo_id)
          .single<{ stock_total: number | null }>();
        if (ins) {
          await supabase
            .from('insumos')
            .update({ stock_total: (ins.stock_total ?? 0) + s.cantidad })
            .eq('id', s.insumo_id);
        }
      }
    }

    toast.success('Devolución registrada');
    onDone();
  };

  return (
    <>
      <p className="mb-4 text-xs text-muted-foreground">
        Al volver a la industria, indica qué pasó con cada insumo que tenía la camioneta.
      </p>
      <Label htmlFor="dev-resp">Registrado por</Label>
      <Input
        id="dev-resp"
        value={responsable}
        onChange={(e) => setResponsable(e.target.value)}
        placeholder="Nombre del bodeguero"
        className="mb-4"
      />
      <SectionTitle>Estado de cada insumo</SectionTitle>
      {stockConQty.length === 0 ? (
        <EmptyState>
          <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
          La camioneta no tiene insumos registrados.
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {stockConQty.map((s) => {
            const nombre = s.insumos?.nemotecnico ?? s.insumos?.cod ?? s.insumo_id;
            const est = estados[s.insumo_id] ?? 'ok';
            return (
              <div key={s.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 text-sm font-semibold">
                  {nombre}{' '}
                  <span className="text-xs text-muted-foreground">({s.cantidad} u.)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['ok', 'defectuoso', 'queda'] as const).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() =>
                        setEstados((prev) => ({ ...prev, [s.insumo_id]: e }))
                      }
                      className={cn(
                        'flex-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all',
                        est === e
                          ? 'scale-[1.03] opacity-100'
                          : 'opacity-50',
                        e === 'ok' &&
                          'border-green-500/30 bg-green-500/15 text-green-500',
                        e === 'defectuoso' &&
                          'border-red-500/30 bg-red-500/15 text-red-500',
                        e === 'queda' &&
                          'border-yellow-500/30 bg-yellow-500/15 text-yellow-500',
                      )}
                    >
                      {e === 'ok' && '✅ Vuelve OK'}
                      {e === 'defectuoso' && '❌ Defectuoso'}
                      {e === 'queda' && '🚐 Se queda'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Button onClick={confirmar} className="mt-5 w-full" disabled={saving || stockConQty.length === 0}>
        {saving ? 'Guardando…' : 'Confirmar devolución'}
      </Button>
    </>
  );
}

// ── Vista Historial ───────────────────────────────────────────────
function VistaHistorial({ camioneta }: { camioneta: Camioneta }) {
  const [movs, setMovs] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('movimientos_camioneta')
        .select('*, insumos(nemotecnico, cod)')
        .eq('camioneta_id', camioneta.id)
        .order('created_at', { ascending: false })
        .limit(80);
      setMovs((data as Movimiento[]) ?? []);
      setLoading(false);
    };
    run();
  }, [camioneta.id]);

  if (loading) return <EmptyState>Cargando historial…</EmptyState>;
  if (movs.length === 0)
    return (
      <EmptyState>
        <Clock className="mx-auto mb-3 h-10 w-10 opacity-40" />
        Sin movimientos aún.
      </EmptyState>
    );

  return (
    <div className="space-y-2">
      {movs.map((m) => {
        const nombre = m.insumos?.nemotecnico ?? m.insumos?.cod ?? m.insumo_id;
        const fecha = new Date(m.created_at).toLocaleString('es-CL', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <div
            key={m.id}
            className="rounded-lg border-l-4 bg-card px-4 py-2.5"
            style={{
              borderLeftColor: {
                carga: '#3b82f6',
                uso: '#22c55e',
                swap_salida: '#f97316',
                swap_entrada: '#f59e0b',
                devolucion: '#a78bfa',
                defectuoso: '#ef4444',
              }[m.tipo],
            }}
          >
            <div className="flex items-center gap-2">
              <Badge variant={TIPO_BADGE[m.tipo]}>{TIPO_LABEL[m.tipo]}</Badge>
              <span className="text-xs text-muted-foreground">×{m.cantidad}</span>
            </div>
            <div className="mt-1 text-sm font-semibold">{nombre}</div>
            {m.motivo && (
              <div className="text-xs italic text-muted-foreground">"{m.motivo}"</div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {fecha}
              {m.registrado_por ? ` · ${m.registrado_por}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal Nueva camioneta ─────────────────────────────────────────
function NuevaCamionetaDialog({
  open,
  onOpenChange,
  empresaId,
  onCreada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string | null;
  onCreada: () => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [patente, setPatente] = useState('');
  const [instalador, setInstalador] = useState('');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!empresaId) return;
    if (!nombre.trim()) {
      toast.warning('Ingresa un nombre para la camioneta');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('camionetas').insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      patente: patente.trim() || null,
      instalador: instalador.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Error al crear camioneta');
      return;
    }
    toast.success(`Camioneta "${nombre.trim()}" creada`);
    setNombre('');
    setPatente('');
    setInstalador('');
    onOpenChange(false);
    await onCreada();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Truck className="mr-2 inline h-5 w-5 text-primary" />
            Nueva camioneta
          </DialogTitle>
          <DialogDescription>
            Registra una nueva camioneta de la flota para gestionar su stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="n-nombre">Nombre / alias</Label>
            <Input
              id="n-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Camioneta 1, Van Norte"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-patente">Patente (opcional)</Label>
            <Input
              id="n-patente"
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              placeholder="Ej: ABCD-12"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="n-inst">Instalador responsable (opcional)</Label>
            <Input
              id="n-inst"
              value={instalador}
              onChange={(e) => setInstalador(e.target.value)}
              placeholder="Nombre"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            {saving ? 'Creando…' : 'Crear camioneta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers de UI ────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
