import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Boxes,
  Camera,
  ClipboardPlus,
  Grid3x3,
  Image as ImageIcon,
  Loader2,
  Package,
  Pencil,
  PencilRuler,
  Plus,
  Printer,
  QrCode,
  Search,
  Tags,
  X,
  XCircle,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  calcularAlertas,
  esEntrada,
  filtrarCatalogo,
  formatCLP,
  formatFecha,
  getStockTotal,
  mesActual,
  type Alerta,
  type EstadoFiltro,
  type Insumo,
  type Movimiento,
  type UbicacionRack,
  type Validador,
} from '@/modules/inventario/helpers';
import { getRacks, type AlmacenRack } from '@/modules/inventario/rackConfig';

// ─────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────
type Tab = 'catalogo' | 'movimientos' | 'alertas' | 'rack';
type SortCol = keyof Insumo;
type SortDir = 'asc' | 'desc';
type ValidadoresMap = Record<string, string[]>;
type MovTipo = 'NUEVO INGRESO' | 'SALIDA PRODUCCION' | 'AJUSTE' | 'DEVOLUCION';

const EMPTY_INSUMO_FORM = {
  cod: '',
  nemotecnico: '',
  categoria: '',
  sub_categoria: '',
  producto: '',
  proveedor: '',
  compra: '',
  color: '',
  minimo: '0',
  can_x_paquete: '1',
  costo: '0',
  ubicacion: '',
  cod_proveedor: '',
  estado_inventario: 'ACTIVO',
  descriptor_proveedor: '',
  comentarios: '',
  foto_url: '',
  stock_inicial: '0',
};

type InsumoForm = typeof EMPTY_INSUMO_FORM;

const EMPTY_MOV_FORM = {
  tipo: 'NUEVO INGRESO' as MovTipo,
  codigo: '',
  cantidad: '1',
  almacen: 'MP' as 'MP' | 'LIBERADO',
  ot: '',
  responsable_entrega: '',
  recepcion: '',
  bitacora: '',
};

type MovForm = typeof EMPTY_MOV_FORM;

// ─────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────
function StockBadge({ insumo }: { insumo: Insumo }) {
  const st = getStockTotal(insumo);
  const sin = st <= 0;
  const bajo = (insumo.minimo || 0) > 0 && st < (insumo.minimo || 0);
  if (sin) {
    return (
      <span className="rounded-full border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-[0.62rem] font-semibold text-destructive">
        SIN STOCK
      </span>
    );
  }
  if (bajo) {
    return (
      <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[0.62rem] font-semibold text-warning">
        BAJO MIN
      </span>
    );
  }
  return (
    <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[0.62rem] font-semibold text-success">
      OK
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'info';
  icon?: React.ReactNode;
}) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-destructive'
        : tone === 'warning'
          ? 'text-warning'
          : tone === 'info'
            ? 'text-sky-300'
            : 'text-foreground';
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn('mt-1 text-2xl font-semibold', color)}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export function Inventario() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('catalogo');
  const [loading, setLoading] = useState(true);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionRack[]>([]);
  const [validadores, setValidadores] = useState<ValidadoresMap>({});
  const [qrInsumo, setQrInsumo] = useState<Insumo | null>(null);
  const [detalleMov, setDetalleMov] = useState<Movimiento | null>(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSubCategoria, setFiltroSubCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>('');
  const [sortCol, setSortCol] = useState<SortCol>('cod');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [busquedaMov, setBusquedaMov] = useState('');

  const [filtroAlmacenRack, setFiltroAlmacenRack] = useState<AlmacenRack>('LIBERADO');
  const [busquedaRack, setBusquedaRack] = useState('');
  const [cellModal, setCellModal] = useState<{ rack: string; fila: number; col: string } | null>(
    null,
  );

  const [insumoDialog, setInsumoDialog] = useState<{
    open: boolean;
    editId: string | null;
    form: InsumoForm;
  }>({ open: false, editId: null, form: { ...EMPTY_INSUMO_FORM } });
  const [fotoEstado, setFotoEstado] = useState<{ msg: string; tone: string }>({
    msg: '',
    tone: '',
  });
  const [savingInsumo, setSavingInsumo] = useState(false);

  const [movDialog, setMovDialog] = useState<{ open: boolean; form: MovForm }>({
    open: false,
    form: { ...EMPTY_MOV_FORM },
  });
  const [savingMov, setSavingMov] = useState(false);

  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  // ─── Carga inicial ────────────────────────────────────────────
  const cargarTodo = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [rVal, rIns, rMov, rUbi] = await Promise.all([
        supabase
          .from('validadores_insumos')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('orden'),
        supabase.from('insumos').select('*').eq('empresa_id', empresaId).order('cod'),
        supabase
          .from('movimientos_insumos')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase.from('ubicaciones_rack').select('*').eq('empresa_id', empresaId),
      ]);

      const vmap: ValidadoresMap = {};
      for (const v of (rVal.data as Validador[] | null) || []) {
        if (!vmap[v.campo]) vmap[v.campo] = [];
        vmap[v.campo].push(v.valor);
      }
      setValidadores(vmap);
      setInsumos(((rIns.data as Insumo[] | null) || []) as Insumo[]);
      setMovimientos(((rMov.data as Movimiento[] | null) || []) as Movimiento[]);
      setUbicaciones(((rUbi.data as UbicacionRack[] | null) || []) as UbicacionRack[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error cargando inventario: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  // ─── Realtime: refrescar en cambios de insumos ────────────────
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel('insumos-inv-react')
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'insumos',
          filter: `empresa_id=eq.${empresaId}`,
        },
        (payload: { eventType: string; new?: Insumo; old?: Insumo }) => {
          setInsumos((prev) => {
            if (payload.eventType === 'DELETE' && payload.old?.id) {
              return prev.filter((i) => i.id !== payload.old!.id);
            }
            if (payload.new?.id) {
              const idx = prev.findIndex((i) => i.id === payload.new!.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...payload.new };
                return next;
              }
              return [...prev, payload.new];
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId]);

  // ─── Derivados ────────────────────────────────────────────────
  const alertas: Alerta[] = useMemo(() => calcularAlertas(insumos), [insumos]);

  const categorias = useMemo(
    () =>
      Array.from(new Set(insumos.map((i) => i.categoria).filter(Boolean) as string[])).sort(),
    [insumos],
  );
  const subCategorias = useMemo(
    () =>
      Array.from(
        new Set(insumos.map((i) => i.sub_categoria).filter(Boolean) as string[]),
      ).sort(),
    [insumos],
  );

  const statsCatalogo = useMemo(() => {
    const total = insumos.length;
    const conStock = insumos.filter((i) => getStockTotal(i) > 0).length;
    const sinStock = insumos.filter((i) => getStockTotal(i) <= 0).length;
    const bajoMin = insumos.filter(
      (i) => (i.minimo || 0) > 0 && getStockTotal(i) < (i.minimo || 0),
    ).length;
    return { total, conStock, sinStock, bajoMin, categorias: categorias.length };
  }, [insumos, categorias.length]);

  const insumosFiltrados = useMemo(() => {
    const filtrados = filtrarCatalogo(insumos, {
      busqueda,
      categoria: filtroCategoria,
      subCategoria: filtroSubCategoria,
      estado: filtroEstado,
    });
    const arr = [...filtrados];
    arr.sort((a, b) => {
      const va = (a[sortCol] ?? '') as string | number;
      const vb = (b[sortCol] ?? '') as string | number;
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return arr;
  }, [insumos, busqueda, filtroCategoria, filtroSubCategoria, filtroEstado, sortCol, sortDir]);

  const movimientosFiltrados = useMemo(() => {
    const q = busquedaMov.trim().toUpperCase();
    return movimientos
      .filter((m) => !filtroTipoMov || m.tipo === filtroTipoMov)
      .filter((m) => {
        if (!q) return true;
        return (
          (m.codigo || '').toUpperCase().includes(q) ||
          (m.producto || '').toUpperCase().includes(q) ||
          (m.ot || '').toUpperCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [movimientos, filtroTipoMov, busquedaMov]);

  const alertasOrdenadas = useMemo(() => {
    const arr = [...alertas];
    arr.sort((a, b) => {
      if (a.severity === 'danger' && b.severity !== 'danger') return -1;
      if (b.severity === 'danger' && a.severity !== 'danger') return 1;
      return a.codigo.localeCompare(b.codigo);
    });
    return arr;
  }, [alertas]);

  // ─── Sort ─────────────────────────────────────────────────────
  const ordenar = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // ─── Insumo modal: abrir ──────────────────────────────────────
  const abrirNuevoInsumo = () => {
    setInsumoDialog({ open: true, editId: null, form: { ...EMPTY_INSUMO_FORM } });
    setFotoEstado({ msg: '', tone: '' });
  };

  const abrirEditarInsumo = (ins: Insumo) => {
    setInsumoDialog({
      open: true,
      editId: ins.id,
      form: {
        cod: ins.cod || '',
        nemotecnico: ins.nemotecnico || '',
        categoria: ins.categoria || '',
        sub_categoria: ins.sub_categoria || '',
        producto: ins.producto || '',
        proveedor: ins.proveedor || '',
        compra: ins.compra || '',
        color: ins.color || '',
        minimo: String(ins.minimo || 0),
        can_x_paquete: String(ins.can_x_paquete || 1),
        costo: String(ins.costo || 0),
        ubicacion: ins.ubicacion || '',
        cod_proveedor: ins.cod_proveedor || '',
        estado_inventario: ins.estado_inventario || 'ACTIVO',
        descriptor_proveedor: ins.descriptor_proveedor || '',
        comentarios: ins.comentarios || '',
        foto_url: ins.foto_url || '',
        stock_inicial: '0',
      },
    });
    setFotoEstado(
      ins.foto_url ? { msg: 'Foto guardada', tone: 'text-success' } : { msg: '', tone: '' },
    );
  };

  const cerrarInsumoDialog = () => {
    setInsumoDialog((s) => ({ ...s, open: false }));
    setFotoEstado({ msg: '', tone: '' });
  };

  const actualizarFormInsumo = (patch: Partial<InsumoForm>) =>
    setInsumoDialog((s) => ({ ...s, form: { ...s.form, ...patch } }));

  // ─── Foto upload ──────────────────────────────────────────────
  const onFotoArchivo = async (file: File | null) => {
    if (!file || !empresaId) return;
    setFotoEstado({ msg: 'Subiendo foto…', tone: 'text-warning' });
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const codVal = (insumoDialog.form.cod || 'insumo').trim().toUpperCase() || 'insumo';
      const path = `${empresaId}/${codVal}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('fotos-insumos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('fotos-insumos').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('No se pudo obtener la URL pública');
      actualizarFormInsumo({ foto_url: publicUrl });
      setFotoEstado({ msg: 'Foto guardada', tone: 'text-success' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setFotoEstado({ msg: 'No se pudo subir: ' + msg, tone: 'text-destructive' });
    } finally {
      if (camRef.current) camRef.current.value = '';
      if (galRef.current) galRef.current.value = '';
    }
  };

  const quitarFoto = () => {
    actualizarFormInsumo({ foto_url: '' });
    setFotoEstado({ msg: '', tone: '' });
  };

  // ─── Guardar insumo ───────────────────────────────────────────
  const guardarInsumo = async () => {
    if (!empresaId) return;
    const f = insumoDialog.form;
    const cod = (f.cod || '').trim().toUpperCase();
    if (!cod) {
      toast.error('El código es obligatorio');
      return;
    }
    const costoNum = parseFloat(f.costo) || 0;
    const payload: Partial<Insumo> & { empresa_id: string; cod: string } = {
      empresa_id: empresaId,
      cod,
      nemotecnico: f.nemotecnico.trim() || null,
      categoria: f.categoria || null,
      sub_categoria: f.sub_categoria || null,
      producto: f.producto || null,
      proveedor: f.proveedor || null,
      compra: f.compra || null,
      color: f.color || null,
      minimo: parseInt(f.minimo, 10) || 0,
      can_x_paquete: parseInt(f.can_x_paquete, 10) || 1,
      costo: costoNum,
      costo_iva: Math.round(costoNum * 1.19 * 100) / 100,
      ubicacion: f.ubicacion || null,
      cod_proveedor: f.cod_proveedor.trim() || null,
      estado_inventario: f.estado_inventario || 'ACTIVO',
      descriptor_proveedor: f.descriptor_proveedor.trim() || null,
      comentarios: f.comentarios.trim() || null,
      foto_url: f.foto_url.trim() || null,
    };
    setSavingInsumo(true);
    try {
      if (insumoDialog.editId) {
        const { error } = await supabase
          .from('insumos')
          .update(payload)
          .eq('id', insumoDialog.editId);
        if (error) throw error;
        setInsumos((prev) =>
          prev.map((i) =>
            i.id === insumoDialog.editId ? ({ ...i, ...payload } as Insumo) : i,
          ),
        );
        toast.success('Insumo actualizado');
      } else {
        const { data, error } = await supabase
          .from('insumos')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        let nuevo = data as Insumo;

        // Stock inicial → movimiento MP
        const stockInicial = parseInt(f.stock_inicial, 10) || 0;
        if (stockInicial > 0) {
          const mov = {
            empresa_id: empresaId,
            fecha: new Date().toISOString(),
            mes: mesActual(),
            tipo: 'NUEVO INGRESO',
            codigo: cod,
            producto: payload.nemotecnico || payload.descriptor_proveedor || '',
            almacen: 'MP',
            cantidad: stockInicial,
            ot: '',
            responsable_entrega: '',
            recepcion: '',
            bitacora: 'Stock inicial al crear insumo',
          };
          const { data: movData } = await supabase
            .from('movimientos_insumos')
            .insert(mov)
            .select()
            .single();
          if (movData) setMovimientos((m) => [movData as Movimiento, ...m]);
          const { error: upErr } = await supabase
            .from('insumos')
            .update({ stock_mp: stockInicial })
            .eq('id', nuevo.id);
          if (!upErr) {
            nuevo = { ...nuevo, stock_mp: stockInicial };
          }
        }
        setInsumos((prev) => [...prev, nuevo]);
        toast.success('Insumo creado');
      }
      cerrarInsumoDialog();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error guardando: ' + msg);
    } finally {
      setSavingInsumo(false);
    }
  };

  // ─── Movimiento modal ─────────────────────────────────────────
  const abrirNuevoMov = (tipo: MovTipo, codigo = '') => {
    const almacen: 'MP' | 'LIBERADO' =
      tipo === 'SALIDA PRODUCCION' ? 'LIBERADO' : 'MP';
    setMovDialog({
      open: true,
      form: { ...EMPTY_MOV_FORM, tipo, codigo, almacen },
    });
  };

  const cerrarMovDialog = () => setMovDialog((s) => ({ ...s, open: false }));

  const actualizarFormMov = (patch: Partial<MovForm>) =>
    setMovDialog((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const guardarMovimiento = async () => {
    if (!empresaId) return;
    const f = movDialog.form;
    if (!f.codigo) {
      toast.error('Seleccioná un insumo');
      return;
    }
    const cantidad = parseInt(f.cantidad, 10) || 0;
    if (cantidad <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    const insumo = insumos.find((i) => i.cod === f.codigo);
    const mov = {
      empresa_id: empresaId,
      fecha: new Date().toISOString(),
      mes: mesActual(),
      tipo: f.tipo,
      codigo: f.codigo,
      producto: insumo ? insumo.nemotecnico || insumo.descriptor_proveedor || '' : '',
      almacen: f.almacen,
      cantidad,
      ot: f.ot.trim() || null,
      responsable_entrega: f.responsable_entrega || null,
      recepcion: f.recepcion || null,
      bitacora: f.bitacora.trim() || null,
    };
    setSavingMov(true);
    try {
      const { data, error } = await supabase
        .from('movimientos_insumos')
        .insert(mov)
        .select()
        .single();
      if (error) throw error;
      setMovimientos((prev) => [data as Movimiento, ...prev]);

      // Actualizar stock
      if (insumo) {
        const campoStock = f.almacen === 'MP' ? 'stock_mp' : 'stock_liberado';
        const prev = (insumo[campoStock] || 0) as number;
        const nuevoStock = prev + (esEntrada(f.tipo) ? cantidad : -cantidad);
        const clamped = Math.max(0, nuevoStock);
        const { error: errUp } = await supabase
          .from('insumos')
          .update(
            campoStock === 'stock_mp'
              ? { stock_mp: clamped }
              : { stock_liberado: clamped },
          )
          .eq('id', insumo.id);
        if (errUp) throw errUp;
        setInsumos((arr) =>
          arr.map((i) => (i.id === insumo.id ? { ...i, [campoStock]: clamped } : i)),
        );
      }
      toast.success('Movimiento registrado');
      cerrarMovDialog();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error registrando: ' + msg);
    } finally {
      setSavingMov(false);
    }
  };

  // ─── Reposición (pedido) ──────────────────────────────────────
  const registrarReposicion = async (codigo: string, faltaSugerida: number) => {
    if (!empresaId) return;
    const ins = insumos.find((i) => i.cod === codigo);
    if (!ins) return;
    const nemo = ins.nemotecnico || ins.descriptor_proveedor || codigo;
    const input = window.prompt(
      `Registrar pedido de reposición\n\n${nemo}\n\nCantidad a pedir:`,
      String(faltaSugerida || 1),
    );
    if (input === null) return;
    const cant = parseInt(input, 10);
    if (!cant || cant <= 0) {
      toast.error('Cantidad inválida');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('movimientos_insumos')
        .insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: mesActual(),
          tipo: 'PEDIDO REPOSICION',
          codigo,
          producto: nemo,
          almacen: 'MP',
          cantidad: cant,
          responsable_entrega: 'Inventario',
          bitacora: `Pedido de reposición: ${nemo}`,
        })
        .select()
        .single();
      if (error) throw error;
      setMovimientos((prev) => [data as Movimiento, ...prev]);
      toast.success(`Pedido registrado: ${cant} de ${nemo}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al registrar pedido: ' + msg);
    }
  };

  // ─── Mapa de ubicaciones indexado para rack ──────────────────
  const mapaUbicaciones = useMemo(() => {
    const map = new Map<string, UbicacionRack>();
    ubicaciones
      .filter((u) => u.almacen === filtroAlmacenRack)
      .forEach((u) => {
        map.set(`${u.rack}|${u.fila}|${u.columna}`, u);
      });
    return map;
  }, [ubicaciones, filtroAlmacenRack]);

  const codigoPorSlot = (rack: string, fila: number, col: string): string | null => {
    const u = mapaUbicaciones.get(`${rack}|${fila}|${col}`);
    return u?.codigo_insumo || null;
  };

  const insumoByCod = useMemo(() => {
    const m = new Map<string, Insumo>();
    for (const i of insumos) if (i.cod) m.set(i.cod, i);
    return m;
  }, [insumos]);

  const verEnCatalogo = (codigo: string) => {
    setTab('catalogo');
    setBusqueda(codigo);
    setFiltroEstado('');
  };

  // ─── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando inventario…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            title="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Inventario</h2>
            <p className="text-xs text-muted-foreground">
              {statsCatalogo.total} insumos · {alertas.length} alerta
              {alertas.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          <TabBtn active={tab === 'catalogo'} onClick={() => setTab('catalogo')}>
            <Package className="h-3.5 w-3.5" /> Catálogo
          </TabBtn>
          <TabBtn active={tab === 'rack'} onClick={() => setTab('rack')}>
            <Grid3x3 className="h-3.5 w-3.5" /> Mapa Rack
          </TabBtn>
          <TabBtn active={tab === 'movimientos'} onClick={() => setTab('movimientos')}>
            <PencilRuler className="h-3.5 w-3.5" /> Movimientos
          </TabBtn>
          <TabBtn active={tab === 'alertas'} onClick={() => setTab('alertas')}>
            <AlertTriangle className="h-3.5 w-3.5" /> Alertas
            {alertas.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-1.5 text-[0.6rem] font-semibold text-foreground">
                {alertas.length}
              </span>
            )}
          </TabBtn>
        </nav>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        {tab === 'catalogo' && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <StatCard
                label="Total"
                value={statsCatalogo.total}
                icon={<Boxes className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Con stock"
                value={statsCatalogo.conStock}
                tone="success"
                icon={<Package className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Sin stock"
                value={statsCatalogo.sinStock}
                tone="danger"
                icon={<XCircle className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Bajo mínimo"
                value={statsCatalogo.bajoMin}
                tone="warning"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
              <StatCard
                label="Categorías"
                value={statsCatalogo.categorias}
                tone="info"
                icon={<Tags className="h-3.5 w-3.5" />}
              />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por código, nemotécnico, color…"
                  className="pl-8"
                />
              </div>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filtroSubCategoria}
                onChange={(e) => setFiltroSubCategoria(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Todas las sub-categorías</option>
                {subCategorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoFiltro)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="con_stock">Con stock</option>
                <option value="sin_stock">Sin stock</option>
                <option value="bajo_minimo">Bajo mínimo</option>
                <option value="sin_minimo">Sin mínimo definido</option>
                <option value="sin_ubicacion">Sin ubicación</option>
              </select>
              <Button onClick={abrirNuevoInsumo} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Nuevo
              </Button>
              <Button
                onClick={() => abrirNuevoMov('NUEVO INGRESO')}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <ArrowDownCircle className="h-4 w-4" /> Entrada
              </Button>
              <Button
                onClick={() => abrirNuevoMov('SALIDA PRODUCCION')}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <ArrowUpCircle className="h-4 w-4" /> Salida
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card/40">
              <table className="w-full text-xs">
                <thead className="bg-card text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2"></th>
                    <SortTh col="cod" current={sortCol} dir={sortDir} onSort={ordenar}>
                      Código
                    </SortTh>
                    <SortTh
                      col="nemotecnico"
                      current={sortCol}
                      dir={sortDir}
                      onSort={ordenar}
                    >
                      Nemotécnico
                    </SortTh>
                    <SortTh
                      col="categoria"
                      current={sortCol}
                      dir={sortDir}
                      onSort={ordenar}
                    >
                      Categoría
                    </SortTh>
                    <th className="p-2 text-left">Sub-cat</th>
                    <th className="p-2 text-left">Proveedor</th>
                    <SortTh
                      col="ubicacion"
                      current={sortCol}
                      dir={sortDir}
                      onSort={ordenar}
                    >
                      Ubicación
                    </SortTh>
                    <SortTh
                      col="stock_total"
                      current={sortCol}
                      dir={sortDir}
                      onSort={ordenar}
                      align="center"
                    >
                      Stock
                    </SortTh>
                    <th className="p-2 text-center">MP</th>
                    <th className="p-2 text-center">Lib</th>
                    <SortTh
                      col="minimo"
                      current={sortCol}
                      dir={sortDir}
                      onSort={ordenar}
                      align="center"
                    >
                      Mín
                    </SortTh>
                    <th className="p-2 text-right">Costo</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={14} className="p-6 text-center text-muted-foreground">
                        No hay insumos que coincidan con el filtro.
                      </td>
                    </tr>
                  )}
                  {insumosFiltrados.map((i) => {
                    const st = getStockTotal(i);
                    return (
                      <tr
                        key={i.id}
                        className="border-t border-border hover:bg-card"
                      >
                        <td className="p-1 text-center">
                          {i.foto_url ? (
                            <img
                              src={i.foto_url}
                              alt=""
                              className="mx-auto h-8 w-8 rounded object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-secondary text-muted-foreground">
                              <ImageIcon className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </td>
                        <td className="p-2 font-mono font-semibold text-foreground">
                          {i.cod}
                        </td>
                        <td className="p-2 max-w-[220px] truncate">
                          {i.nemotecnico || i.descriptor_proveedor || '—'}
                        </td>
                        <td className="p-2 text-foreground">{i.categoria || '—'}</td>
                        <td className="p-2 text-muted-foreground">{i.sub_categoria || '—'}</td>
                        <td className="p-2 text-muted-foreground">{i.proveedor || '—'}</td>
                        <td className="p-2 text-muted-foreground">{i.ubicacion || '—'}</td>
                        <td
                          className={cn(
                            'p-2 text-center font-semibold',
                            st <= 0
                              ? 'text-destructive'
                              : (i.minimo || 0) > 0 && st < (i.minimo || 0)
                                ? 'text-warning'
                                : 'text-foreground',
                          )}
                        >
                          {st}
                        </td>
                        <td className="p-2 text-center text-muted-foreground">
                          {i.stock_mp || 0}
                        </td>
                        <td className="p-2 text-center text-muted-foreground">
                          {i.stock_liberado || 0}
                        </td>
                        <td className="p-2 text-center text-muted-foreground">
                          {i.minimo || 0}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">
                          ${formatCLP(i.costo)}
                        </td>
                        <td className="p-2 text-center">
                          <StockBadge insumo={i} />
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => abrirEditarInsumo(i)}
                              className="rounded border border-border bg-card p-1 text-foreground hover:bg-card"
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setQrInsumo(i)}
                              className="rounded border border-accent/30 bg-accent/10 p-1 text-accent hover:bg-accent/20"
                              title="Ver / imprimir QR"
                            >
                              <QrCode className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() =>
                                abrirNuevoMov('NUEVO INGRESO', i.cod || '')
                              }
                              className="rounded border border-success/30 bg-success/15 p-1 text-success hover:bg-success/15"
                              title="Registrar entrada"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'movimientos' && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busquedaMov}
                  onChange={(e) => setBusquedaMov(e.target.value)}
                  placeholder="Buscar por código, producto, OT…"
                  className="pl-8"
                />
              </div>
              <select
                value={filtroTipoMov}
                onChange={(e) => setFiltroTipoMov(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Todos los tipos</option>
                <option value="NUEVO INGRESO">Entrada</option>
                <option value="SALIDA PRODUCCION">Salida</option>
                <option value="DEVOLUCION">Devolución</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="PEDIDO REPOSICION">Pedido reposición</option>
              </select>
              <Button
                onClick={() => abrirNuevoMov('NUEVO INGRESO')}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <ArrowDownCircle className="h-4 w-4" /> Entrada
              </Button>
              <Button
                onClick={() => abrirNuevoMov('SALIDA PRODUCCION')}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <ArrowUpCircle className="h-4 w-4" /> Salida
              </Button>
              <Button
                onClick={() => abrirNuevoMov('AJUSTE')}
                size="sm"
                variant="outline"
                className="gap-1"
              >
                <Pencil className="h-4 w-4" /> Ajuste
              </Button>
            </div>
            <div className="space-y-2">
              {movimientosFiltrados.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay movimientos que coincidan.
                </p>
              )}
              {movimientosFiltrados.map((m) => {
                const entrada = esEntrada(m.tipo);
                const ajuste = m.tipo === 'AJUSTE';
                const signo = entrada ? '+' : m.tipo === 'PEDIDO REPOSICION' ? '' : '-';
                const color = ajuste
                  ? 'text-sky-300'
                  : entrada
                    ? 'text-success'
                    : m.tipo === 'PEDIDO REPOSICION'
                      ? 'text-accent'
                      : 'text-destructive';
                const bg = ajuste
                  ? 'bg-sky-500/10 border-sky-500/30'
                  : entrada
                    ? 'bg-success/15 border-success/30'
                    : m.tipo === 'PEDIDO REPOSICION'
                      ? 'bg-accent/10 border-violet-500/30'
                      : 'bg-destructive/15 border-destructive/30';
                const Icon = ajuste
                  ? Pencil
                  : entrada
                    ? ArrowDownCircle
                    : m.tipo === 'PEDIDO REPOSICION'
                      ? ClipboardPlus
                      : ArrowUpCircle;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDetalleMov(m)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/50 p-3 text-left transition-colors hover:border-border hover:bg-card/80"
                  >
                    <div
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded border',
                        bg,
                        color,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="truncate">
                          {m.tipo}: {m.codigo} — {m.producto || ''}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <strong className={color}>
                          {signo}
                          {m.cantidad}
                        </strong>{' '}
                        unidades
                        {m.almacen ? ` → ${m.almacen}` : ''}
                        {m.ot ? ` · OT: ${m.ot}` : ''}
                        {m.responsable_entrega ? ` · ${m.responsable_entrega}` : ''}
                      </div>
                      <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                        {formatFecha(m.fecha)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'alertas' && (
          <>
            {alertasOrdenadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <AlertTriangle className="mb-3 h-10 w-10 text-success/50" />
                <p>No hay alertas de stock.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertasOrdenadas.map((a) => {
                  const ins = insumoByCod.get(a.codigo);
                  const st = ins ? getStockTotal(ins) : 0;
                  const min = ins?.minimo || 0;
                  const falta = min > 0 ? Math.max(0, min - st) : 0;
                  const ubic = ins?.ubicacion || '—';
                  const color = a.severity === 'danger' ? 'red' : 'amber';
                  return (
                    <div
                      key={a.codigo + a.tipo}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3',
                        color === 'red'
                          ? 'border-destructive/30 bg-destructive/15'
                          : 'border-warning/30 bg-warning/15',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded',
                          color === 'red'
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-warning/15 text-warning',
                        )}
                      >
                        {color === 'red' ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              color === 'red' ? 'text-destructive' : 'text-warning',
                            )}
                          >
                            {a.tipo === 'SIN_STOCK' ? 'Sin stock' : 'Stock bajo'}
                          </span>
                          <span className="font-mono text-[0.7rem] text-muted-foreground">
                            {a.codigo}
                          </span>
                        </div>
                        <div className="text-sm text-foreground">{a.nombre || '—'}</div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground">
                          <span>📍 {ubic}</span>
                          <span>
                            Stock:{' '}
                            <strong
                              className={
                                color === 'red' ? 'text-destructive' : 'text-warning'
                              }
                            >
                              {st}
                            </strong>
                          </span>
                          {min > 0 && <span>Mínimo: {min}</span>}
                          {falta > 0 && (
                            <span
                              className={cn(
                                'font-semibold',
                                color === 'red' ? 'text-destructive' : 'text-warning',
                              )}
                            >
                              Reponer: {falta}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => verEnCatalogo(a.codigo)}
                            className="rounded border border-border bg-card px-2.5 py-1 text-[0.72rem] text-foreground hover:bg-card"
                          >
                            Ver ítem
                          </button>
                          <button
                            onClick={() =>
                              registrarReposicion(a.codigo, falta || 1)
                            }
                            className={cn(
                              'rounded border px-2.5 py-1 text-[0.72rem]',
                              color === 'red'
                                ? 'border-destructive/30 bg-destructive/15 text-red-200 hover:bg-destructive/15'
                                : 'border-warning/30 bg-warning/15 text-warning hover:bg-warning/15',
                            )}
                          >
                            Registrar pedido
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'rack' && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                value={filtroAlmacenRack}
                onChange={(e) => setFiltroAlmacenRack(e.target.value as AlmacenRack)}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="LIBERADO">Bodega LIBERADO</option>
                <option value="MATERIAS_PRIMAS">MATERIAS PRIMAS</option>
              </select>
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busquedaRack}
                  onChange={(e) => setBusquedaRack(e.target.value)}
                  placeholder="Resaltar código en rack…"
                  className="pl-8"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {mapaUbicaciones.size} posiciones registradas
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {getRacks(filtroAlmacenRack).map((rack) => (
                <div
                  key={rack.nombre}
                  className="rounded-lg border border-border bg-card/40 p-3"
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                    {rack.nombre}
                  </div>
                  <div
                    className="grid gap-0.5"
                    style={{
                      gridTemplateColumns: `28px repeat(${rack.columnas.length}, minmax(0,1fr))`,
                    }}
                  >
                    <div className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground">
                      #
                    </div>
                    {rack.columnas.map((col) => (
                      <div
                        key={col}
                        className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground"
                      >
                        {col}
                      </div>
                    ))}
                    {Array.from({ length: rack.filas }, (_, i) => i + 1).map((fila) => (
                      <RackRow
                        key={fila}
                        fila={fila}
                        columnas={rack.columnas}
                        rackNombre={rack.nombre}
                        busqueda={busquedaRack}
                        codigoSlot={codigoPorSlot}
                        insumoByCod={insumoByCod}
                        onCellClick={(col) =>
                          setCellModal({ rack: rack.nombre, fila, col })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: insumo ───────────────────────────────────────── */}
      <Dialog
        open={insumoDialog.open}
        onOpenChange={(v) => (v ? null : cerrarInsumoDialog())}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {insumoDialog.editId ? `Editar insumo: ${insumoDialog.form.cod}` : 'Nuevo insumo'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto py-1 sm:grid-cols-2">
            <div className="sm:col-span-2 flex gap-3">
              <div className="flex-1">
                <Label>Código *</Label>
                <Input
                  value={insumoDialog.form.cod}
                  onChange={(e) => actualizarFormInsumo({ cod: e.target.value.toUpperCase() })}
                  disabled={!!insumoDialog.editId}
                  placeholder="Ej: INS-1234"
                />
              </div>
              <div className="flex-1">
                <Label>Nemotécnico</Label>
                <Input
                  value={insumoDialog.form.nemotecnico}
                  onChange={(e) => actualizarFormInsumo({ nemotecnico: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Categoría</Label>
              <SelectValidador
                value={insumoDialog.form.categoria}
                onChange={(v) => actualizarFormInsumo({ categoria: v })}
                opciones={validadores['CATEGORIA'] || []}
              />
            </div>
            <div>
              <Label>Sub-categoría</Label>
              <SelectValidador
                value={insumoDialog.form.sub_categoria}
                onChange={(v) => actualizarFormInsumo({ sub_categoria: v })}
                opciones={validadores['SUB_CATEGORIA'] || []}
              />
            </div>
            <div>
              <Label>Producto</Label>
              <SelectValidador
                value={insumoDialog.form.producto}
                onChange={(v) => actualizarFormInsumo({ producto: v })}
                opciones={validadores['PRODUCTO'] || []}
              />
            </div>
            <div>
              <Label>Proveedor</Label>
              <SelectValidador
                value={insumoDialog.form.proveedor}
                onChange={(v) => actualizarFormInsumo({ proveedor: v })}
                opciones={validadores['PROVEEDOR'] || []}
              />
            </div>
            <div>
              <Label>Compra</Label>
              <SelectValidador
                value={insumoDialog.form.compra}
                onChange={(v) => actualizarFormInsumo({ compra: v })}
                opciones={validadores['COMPRA'] || []}
              />
            </div>
            <div>
              <Label>Color</Label>
              <SelectValidador
                value={insumoDialog.form.color}
                onChange={(v) => actualizarFormInsumo({ color: v })}
                opciones={validadores['COLOR'] || []}
              />
            </div>
            <div>
              <Label>Mínimo</Label>
              <Input
                type="number"
                value={insumoDialog.form.minimo}
                onChange={(e) => actualizarFormInsumo({ minimo: e.target.value })}
              />
            </div>
            <div>
              <Label>Cantidad por paquete</Label>
              <Input
                type="number"
                value={insumoDialog.form.can_x_paquete}
                onChange={(e) => actualizarFormInsumo({ can_x_paquete: e.target.value })}
              />
            </div>
            <div>
              <Label>Costo (sin IVA)</Label>
              <Input
                type="number"
                value={insumoDialog.form.costo}
                onChange={(e) => actualizarFormInsumo({ costo: e.target.value })}
              />
            </div>
            <div>
              <Label>Ubicación</Label>
              <SelectValidador
                value={insumoDialog.form.ubicacion}
                onChange={(v) => actualizarFormInsumo({ ubicacion: v })}
                opciones={validadores['UBICACION'] || []}
              />
            </div>
            <div>
              <Label>Código proveedor</Label>
              <Input
                value={insumoDialog.form.cod_proveedor}
                onChange={(e) => actualizarFormInsumo({ cod_proveedor: e.target.value })}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <select
                value={insumoDialog.form.estado_inventario}
                onChange={(e) =>
                  actualizarFormInsumo({ estado_inventario: e.target.value })
                }
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="ACTIVO">Activo</option>
                <option value="DISCONTINUADO">Discontinuado</option>
                <option value="SIN_STOCK_LARGO">Sin stock largo</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Descriptor proveedor</Label>
              <Input
                value={insumoDialog.form.descriptor_proveedor}
                onChange={(e) =>
                  actualizarFormInsumo({ descriptor_proveedor: e.target.value })
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Comentarios</Label>
              <Input
                value={insumoDialog.form.comentarios}
                onChange={(e) => actualizarFormInsumo({ comentarios: e.target.value })}
              />
            </div>
            {!insumoDialog.editId && (
              <div className="sm:col-span-2">
                <Label>Stock inicial (MP)</Label>
                <Input
                  type="number"
                  value={insumoDialog.form.stock_inicial}
                  onChange={(e) => actualizarFormInsumo({ stock_inicial: e.target.value })}
                />
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  Si ingresás una cantidad, se crea un movimiento de NUEVO INGRESO en MP.
                </p>
              </div>
            )}

            {/* Foto */}
            <div className="sm:col-span-2 rounded-lg border border-border bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Label className="mb-0">Foto</Label>
                {fotoEstado.msg && (
                  <span className={cn('text-[0.72rem]', fotoEstado.tone)}>
                    {fotoEstado.msg}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={camRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onFotoArchivo(e.target.files?.[0] || null)}
                />
                <input
                  ref={galRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onFotoArchivo(e.target.files?.[0] || null)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => camRef.current?.click()}
                  type="button"
                >
                  <Camera className="h-4 w-4" /> Tomar foto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => galRef.current?.click()}
                  type="button"
                >
                  <ImageIcon className="h-4 w-4" /> Subir foto
                </Button>
                {insumoDialog.form.foto_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={quitarFoto}
                    type="button"
                    className="gap-1 text-destructive hover:bg-destructive/15"
                  >
                    <X className="h-4 w-4" /> Quitar
                  </Button>
                )}
              </div>
              {insumoDialog.form.foto_url && (
                <div className="mt-2">
                  <img
                    src={insumoDialog.form.foto_url}
                    alt="Preview"
                    className="max-h-44 rounded border border-border object-contain"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarInsumoDialog} disabled={savingInsumo}>
              Cancelar
            </Button>
            <Button onClick={guardarInsumo} disabled={savingInsumo}>
              {savingInsumo && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: movimiento ───────────────────────────────────── */}
      <Dialog
        open={movDialog.open}
        onOpenChange={(v) => (v ? null : cerrarMovDialog())}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {movDialog.form.tipo === 'NUEVO INGRESO'
                ? 'Registrar entrada'
                : movDialog.form.tipo === 'SALIDA PRODUCCION'
                  ? 'Registrar salida'
                  : movDialog.form.tipo === 'DEVOLUCION'
                    ? 'Registrar devolución'
                    : 'Ajuste de inventario'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Tipo</Label>
              <select
                value={movDialog.form.tipo}
                onChange={(e) =>
                  actualizarFormMov({ tipo: e.target.value as MovTipo })
                }
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="NUEVO INGRESO">Entrada</option>
                <option value="SALIDA PRODUCCION">Salida</option>
                <option value="DEVOLUCION">Devolución</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Insumo</Label>
              <select
                value={movDialog.form.codigo}
                onChange={(e) => actualizarFormMov({ codigo: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">Seleccionar insumo…</option>
                {insumos.map((i) => (
                  <option key={i.id} value={i.cod || ''}>
                    {i.cod} — {i.nemotecnico || i.descriptor_proveedor || ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={movDialog.form.cantidad}
                onChange={(e) => actualizarFormMov({ cantidad: e.target.value })}
              />
            </div>
            <div>
              <Label>Almacén</Label>
              <select
                value={movDialog.form.almacen}
                onChange={(e) =>
                  actualizarFormMov({ almacen: e.target.value as 'MP' | 'LIBERADO' })
                }
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="MP">Materias primas (MP)</option>
                <option value="LIBERADO">Liberado</option>
              </select>
            </div>
            <div>
              <Label>OT</Label>
              <Input
                value={movDialog.form.ot}
                onChange={(e) => actualizarFormMov({ ot: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Responsable</Label>
              <SelectValidador
                value={movDialog.form.responsable_entrega}
                onChange={(v) => actualizarFormMov({ responsable_entrega: v })}
                opciones={validadores['RESPONSABLE'] || []}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Recepción</Label>
              <SelectValidador
                value={movDialog.form.recepcion}
                onChange={(v) => actualizarFormMov({ recepcion: v })}
                opciones={validadores['RESPONSABLE'] || []}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Bitácora</Label>
              <Input
                value={movDialog.form.bitacora}
                onChange={(e) => actualizarFormMov({ bitacora: e.target.value })}
                placeholder="Observaciones del movimiento…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cerrarMovDialog} disabled={savingMov}>
              Cancelar
            </Button>
            <Button onClick={guardarMovimiento} disabled={savingMov}>
              {savingMov && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: celda rack ───────────────────────────────────── */}
      <Dialog open={!!cellModal} onOpenChange={(v) => (v ? null : setCellModal(null))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {cellModal ? `${cellModal.col}${cellModal.fila} — ${cellModal.rack}` : ''}
            </DialogTitle>
          </DialogHeader>
          {cellModal &&
            (() => {
              const codigo = codigoPorSlot(cellModal.rack, cellModal.fila, cellModal.col);
              const ins = codigo ? insumoByCod.get(codigo) : undefined;
              if (!codigo) {
                return (
                  <div className="py-6 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-60" />
                    Posición vacía
                  </div>
                );
              }
              return (
                <div className="py-1">
                  {ins?.foto_url && (
                    <img
                      src={ins.foto_url}
                      alt=""
                      className="mx-auto mb-3 max-h-48 rounded border border-border object-contain"
                    />
                  )}
                  <div className="rounded-lg bg-card p-3">
                    <div className="font-mono text-lg font-semibold text-accent">
                      {codigo}
                    </div>
                    <div className="text-sm text-foreground">
                      {ins ? ins.nemotecnico || ins.descriptor_proveedor || '—' : 'Sin datos'}
                    </div>
                  </div>
                  {ins && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <InfoCell label="Stock">{getStockTotal(ins)}</InfoCell>
                      <InfoCell label="Mínimo">{ins.minimo || 0}</InfoCell>
                      <InfoCell label="Color">{ins.color || '—'}</InfoCell>
                      <InfoCell label="Categoría">{ins.categoria || '—'}</InfoCell>
                    </div>
                  )}
                  {ins && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCellModal(null);
                          verEnCatalogo(codigo);
                        }}
                      >
                        Ver en catálogo
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setCellModal(null);
                          abrirNuevoMov('NUEVO INGRESO', codigo);
                        }}
                      >
                        Registrar entrada
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Detalle de movimiento */}
      <Dialog open={!!detalleMov} onOpenChange={(o) => !o && setDetalleMov(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del movimiento</DialogTitle>
          </DialogHeader>
          {detalleMov && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Tipo
                </div>
                <div className="font-semibold text-foreground">{detalleMov.tipo}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-card/60 p-3">
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Código
                  </div>
                  <div className="text-foreground">{detalleMov.codigo || '—'}</div>
                </div>
                <div className="rounded-md border border-border bg-card/60 p-3">
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Cantidad
                  </div>
                  <div className="text-foreground">
                    {detalleMov.cantidad ?? 0} {detalleMov.almacen ? `→ ${detalleMov.almacen}` : ''}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Producto
                </div>
                <div className="text-foreground">{detalleMov.producto || '—'}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border bg-card/60 p-3">
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    OT
                  </div>
                  <div className="text-foreground">{detalleMov.ot || '—'}</div>
                </div>
                <div className="rounded-md border border-border bg-card/60 p-3">
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Responsable
                  </div>
                  <div className="text-foreground">
                    {detalleMov.responsable_entrega || '—'}
                  </div>
                </div>
              </div>

              {detalleMov.recepcion && (
                <div className="rounded-md border border-border bg-card/60 p-3">
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Recepción
                  </div>
                  <div className="text-foreground">{detalleMov.recepcion}</div>
                </div>
              )}

              <div className="rounded-md border border-warning/30 bg-warning/15 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-warning/80">
                  Motivo / Observaciones
                </div>
                <div className="text-foreground whitespace-pre-wrap break-words">
                  {detalleMov.bitacora || 'Sin observaciones registradas'}
                </div>
              </div>

              <div className="rounded-md border border-border bg-card/60 p-3">
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                  Fecha
                </div>
                <div className="text-foreground">{formatFecha(detalleMov.fecha)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetalleMov(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR insumo dialog */}
      <QRInsumoDialog
        insumo={qrInsumo}
        ubicaciones={ubicaciones}
        onClose={() => setQrInsumo(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.78rem] font-medium transition-colors',
        active
          ? 'bg-accent text-foreground shadow'
          : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function SortTh({
  col,
  current,
  dir,
  onSort,
  align,
  children,
}: {
  col: SortCol;
  current: SortCol;
  dir: SortDir;
  onSort: (c: SortCol) => void;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}) {
  const isActive = col === current;
  const textAlign = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  return (
    <th
      onClick={() => onSort(col)}
      className={cn(
        'cursor-pointer select-none p-2 hover:text-foreground',
        textAlign,
        isActive && 'text-accent',
      )}
    >
      {children}
      {isActive && <span className="ml-1">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

function SelectValidador({
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

function RackRow({
  fila,
  columnas,
  rackNombre,
  busqueda,
  codigoSlot,
  insumoByCod,
  onCellClick,
}: {
  fila: number;
  columnas: string[];
  rackNombre: string;
  busqueda: string;
  codigoSlot: (rack: string, fila: number, col: string) => string | null;
  insumoByCod: Map<string, Insumo>;
  onCellClick: (col: string) => void;
}) {
  const q = busqueda.trim().toUpperCase();
  return (
    <>
      <div className="rounded bg-secondary/60 p-1 text-center text-[0.6rem] text-muted-foreground">
        {fila}
      </div>
      {columnas.map((col) => {
        const codigo = codigoSlot(rackNombre, fila, col);
        const insumo = codigo ? insumoByCod.get(codigo) : undefined;
        const bajo =
          insumo && (insumo.minimo || 0) > 0 && getStockTotal(insumo) < (insumo.minimo || 0);
        const vacio = !codigo;
        const match = q && codigo && codigo.toUpperCase().includes(q);
        const dim = q && codigo && !match;
        return (
          <button
            key={col}
            onClick={() => onCellClick(col)}
            title={codigo || `${col}${fila} vacío`}
            className={cn(
              'aspect-square rounded border text-center text-[0.56rem] font-semibold transition-all',
              vacio
                ? 'border-border bg-secondary/30 text-muted-foreground'
                : bajo
                  ? 'border-warning/30 bg-warning/15 text-warning'
                  : 'border-accent/30 bg-accent/15 text-accent',
              match && 'scale-110 ring-2 ring-yellow-400 z-10',
              dim && 'opacity-20',
            )}
          >
            {codigo ? codigo.slice(-4) : ''}
          </button>
        );
      })}
    </>
  );
}

function InfoCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-card/40 p-2">
      <div className="text-[0.65rem] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

// ── QR del insumo (INS:cod + LOC:rack|fila|col) ─────────────────
// Formato idéntico a legacy (public/legacy/inventario.html) para que los QRs
// físicos ya pegados en el taller sigan funcionando sin re-imprimir.

const asciiPuro = (s: string | number | null | undefined): string =>
  String(s ?? '')
    .trim()
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, '');

function rackToQRContent(rack: string, fila: string | number, col: string): string {
  return `LOC:${asciiPuro(rack)}|${asciiPuro(fila)}|${asciiPuro(col)}`;
}

function rackToDisplayLabel(rack: string, fila: string | number, col: string): string {
  return `${String(rack ?? '').trim()} · ${String(fila ?? '').trim()}-${String(col ?? '').trim()}`;
}

function QRInsumoDialog({
  insumo,
  ubicaciones,
  onClose,
}: {
  insumo: Insumo | null;
  ubicaciones: UbicacionRack[];
  onClose: () => void;
}) {
  if (!insumo) return null;

  const rackEntry = ubicaciones.find(
    (u) => (u.codigo_insumo || '').toUpperCase() === (insumo.cod || '').toUpperCase(),
  );

  let ubicacionDisplay = '';
  let ubicacionQR = '';
  if (rackEntry) {
    ubicacionDisplay = rackToDisplayLabel(rackEntry.rack, rackEntry.fila, rackEntry.columna);
    ubicacionQR = rackToQRContent(rackEntry.rack, rackEntry.fila, rackEntry.columna);
  } else if (insumo.ubicacion) {
    ubicacionDisplay = insumo.ubicacion;
    ubicacionQR = `LOC:${asciiPuro(insumo.ubicacion)}`;
  }

  const codQR = asciiPuro(insumo.cod);
  const nombre = insumo.nemotecnico || insumo.descriptor_proveedor || insumo.cod || '';

  const imprimir = () => {
    const canvasItem = document.getElementById('qr-canvas-item') as HTMLCanvasElement | null;
    const canvasLoc = document.getElementById('qr-canvas-loc') as HTMLCanvasElement | null;
    const imgItem = canvasItem?.toDataURL() || '';
    const imgLoc = canvasLoc?.toDataURL() || '';
    const w = window.open('', '_blank', 'width=640,height=480');
    if (!w) {
      toast.error('El navegador bloqueó la ventana de impresión. Habilitá popups.');
      return;
    }
    const html = `<!doctype html><html><head><title>QR ${insumo.cod}</title>
<style>
body { font-family: sans-serif; margin: 0; padding: 20px; }
.etiqueta { display: inline-block; border: 2px solid #000; border-radius: 8px; padding: 12px 16px;
            margin: 8px; text-align: center; width: 180px; vertical-align: top; }
.etiqueta img { width: 150px; height: 150px; display: block; margin: 0 auto 6px; }
.etiqueta .titulo { font-size: 11px; font-weight: bold; margin-bottom: 2px; }
.etiqueta .sub { font-size: 9px; color: #555; }
.etiqueta .tipo { font-size: 9px; background: #f0f0f0; border-radius: 3px; padding: 1px 5px; margin-bottom: 4px; display: inline-block; }
@media print { body { padding: 0; } }
</style></head>
<body>
${imgItem ? `<div class="etiqueta">
  <div class="tipo">CAJA / CONTENEDOR</div>
  <img src="${imgItem}" alt="QR Item">
  <div class="titulo">${nombre}</div>
  <div class="sub">Código: ${insumo.cod}</div>
  <div class="sub">INS:${insumo.cod}</div>
</div>` : ''}
${imgLoc && ubicacionDisplay ? `<div class="etiqueta">
  <div class="tipo">UBICACIÓN</div>
  <img src="${imgLoc}" alt="QR Loc">
  <div class="titulo">${ubicacionDisplay}</div>
  <div class="sub">Insumo: ${insumo.cod}</div>
  <div class="sub">${ubicacionQR}</div>
</div>` : ''}
<script>window.onload = () => setTimeout(() => { window.print(); window.close(); }, 250);</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Dialog open={!!insumo} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
          <p className="text-xs text-muted-foreground">Código: {insumo.cod}</p>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
            <div className="text-[0.68rem] font-semibold uppercase text-accent">
              QR del contenedor
            </div>
            <div className="rounded bg-white p-2">
              <QRCodeCanvas
                id="qr-canvas-item"
                value={`INS:${codQR}`}
                size={150}
                level="M"
              />
            </div>
            <div className="font-mono text-[0.68rem] text-muted-foreground">INS:{codQR}</div>
          </div>
          {ubicacionQR && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card/40 p-3">
              <div className="text-[0.68rem] font-semibold uppercase text-warning">
                QR de ubicación
              </div>
              <div className="rounded bg-white p-2">
                <QRCodeCanvas
                  id="qr-canvas-loc"
                  value={ubicacionQR}
                  size={150}
                  level="M"
                />
              </div>
              <div className="text-center text-[0.68rem] text-muted-foreground">
                {ubicacionDisplay}
                {rackEntry?.almacen && (
                  <div className="opacity-70">({rackEntry.almacen})</div>
                )}
              </div>
            </div>
          )}
          {!ubicacionQR && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/40 p-3 text-center text-[0.7rem] text-muted-foreground">
              Sin ubicación asignada — solo se imprime el QR de contenedor.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={imprimir} className="gap-1.5 bg-accent hover:bg-accent">
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
