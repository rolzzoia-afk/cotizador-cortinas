// Orquestador de la pantalla Inventario.
//
// 4 tabs: catálogo / mapa rack / movimientos / alertas. Maneja el state
// global, las queries Supabase (incluyendo realtime de insumos), las 2
// mutaciones grandes (guardar insumo, guardar movimiento, registrar
// reposición) y compone los 4 tabs + 6 diálogos. Cada tab y cada diálogo
// vive en su archivo bajo ./inventario/.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Grid3x3,
  Loader2,
  Package,
  PencilRuler,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  calcularAlertas,
  esEntrada,
  filtrarCatalogo,
  getStockTotal,
  mesActual,
  type Alerta,
  type EstadoFiltro,
  type Insumo,
  type Movimiento,
  type UbicacionRack,
  type Validador,
} from '@/modules/inventario/helpers';
import type { AlmacenRack } from '@/modules/inventario/rackConfig';

import type {
  InsumoForm,
  MovForm,
  MovTipo,
  SortCol,
  SortDir,
  Tab,
  ValidadoresMap,
} from './inventario/Inventario.types';
import { EMPTY_INSUMO_FORM, EMPTY_MOV_FORM } from './inventario/Inventario.config';
import TabBtn from './inventario/components/TabBtn';
import CatalogoTab from './inventario/tabs/CatalogoTab';
import MovimientosTab from './inventario/tabs/MovimientosTab';
import AlertasTab from './inventario/tabs/AlertasTab';
import RackTab from './inventario/tabs/RackTab';
import InsumoDialog from './inventario/dialogs/InsumoDialog';
import MovDialog from './inventario/dialogs/MovDialog';
import CellRackDialog from './inventario/dialogs/CellRackDialog';
import DetalleMovDialog from './inventario/dialogs/DetalleMovDialog';
import LightboxFotoDialog from './inventario/dialogs/LightboxFotoDialog';
import QRInsumoDialog from './inventario/dialogs/QRInsumoDialog';

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
  const [lightboxFoto, setLightboxFoto] = useState<{ url: string; cod: string } | null>(null);

  const [movDialog, setMovDialog] = useState<{ open: boolean; form: MovForm }>({
    open: false,
    form: { ...EMPTY_MOV_FORM },
  });
  const [savingMov, setSavingMov] = useState(false);

  // Refs efímeras para uploads de foto en el insumo dialog. Mantener acá
  // (no en el dialog) permite resetearlas tras subir sin re-renderizar.
  const cargandoFotoRef = useRef(false);

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

  // Realtime: refrescar en cambios de insumos
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

  // Derivados
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

  // Sort
  const ordenar = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Insumo modal: abrir / cerrar / patch
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

  // Foto upload
  const onFotoArchivo = async (file: File | null) => {
    if (!file || !empresaId || cargandoFotoRef.current) return;
    cargandoFotoRef.current = true;
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
      cargandoFotoRef.current = false;
    }
  };

  const quitarFoto = () => {
    actualizarFormInsumo({ foto_url: '' });
    setFotoEstado({ msg: '', tone: '' });
  };

  // Guardar insumo
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

  // Movimiento modal
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
      toast.error('Selecciona un insumo');
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
            campoStock === 'stock_mp' ? { stock_mp: clamped } : { stock_liberado: clamped },
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

  // Reposición (pedido)
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

  // Mapa de ubicaciones indexado para rack
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
          <CatalogoTab
            insumosFiltrados={insumosFiltrados}
            statsCatalogo={statsCatalogo}
            categorias={categorias}
            subCategorias={subCategorias}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            filtroCategoria={filtroCategoria}
            setFiltroCategoria={setFiltroCategoria}
            filtroSubCategoria={filtroSubCategoria}
            setFiltroSubCategoria={setFiltroSubCategoria}
            filtroEstado={filtroEstado}
            setFiltroEstado={setFiltroEstado}
            sortCol={sortCol}
            sortDir={sortDir}
            onSort={ordenar}
            onNuevoInsumo={abrirNuevoInsumo}
            onEditarInsumo={abrirEditarInsumo}
            onQR={setQrInsumo}
            onNuevoMov={abrirNuevoMov}
            onLightbox={setLightboxFoto}
          />
        )}
        {tab === 'movimientos' && (
          <MovimientosTab
            movimientosFiltrados={movimientosFiltrados}
            busquedaMov={busquedaMov}
            setBusquedaMov={setBusquedaMov}
            filtroTipoMov={filtroTipoMov}
            setFiltroTipoMov={setFiltroTipoMov}
            onNuevoMov={abrirNuevoMov}
            onSeleccionar={setDetalleMov}
          />
        )}
        {tab === 'alertas' && (
          <AlertasTab
            alertasOrdenadas={alertasOrdenadas}
            insumoByCod={insumoByCod}
            onVerEnCatalogo={verEnCatalogo}
            onRegistrarReposicion={registrarReposicion}
          />
        )}
        {tab === 'rack' && (
          <RackTab
            filtroAlmacenRack={filtroAlmacenRack}
            setFiltroAlmacenRack={setFiltroAlmacenRack}
            busquedaRack={busquedaRack}
            setBusquedaRack={setBusquedaRack}
            mapaUbicacionesSize={mapaUbicaciones.size}
            codigoPorSlot={codigoPorSlot}
            insumoByCod={insumoByCod}
            onCellClick={(rack, fila, col) => setCellModal({ rack, fila, col })}
          />
        )}
      </div>

      <InsumoDialog
        open={insumoDialog.open}
        editId={insumoDialog.editId}
        form={insumoDialog.form}
        validadores={validadores}
        fotoEstado={fotoEstado}
        saving={savingInsumo}
        onClose={cerrarInsumoDialog}
        onChange={actualizarFormInsumo}
        onSave={guardarInsumo}
        onFotoArchivo={onFotoArchivo}
        onQuitarFoto={quitarFoto}
      />

      <MovDialog
        open={movDialog.open}
        form={movDialog.form}
        insumos={insumos}
        validadores={validadores}
        saving={savingMov}
        onClose={cerrarMovDialog}
        onChange={actualizarFormMov}
        onSave={guardarMovimiento}
      />

      <CellRackDialog
        cellModal={cellModal}
        onClose={() => setCellModal(null)}
        codigoPorSlot={codigoPorSlot}
        insumoByCod={insumoByCod}
        onVerEnCatalogo={verEnCatalogo}
        onRegistrarEntrada={(codigo) => abrirNuevoMov('NUEVO INGRESO', codigo)}
      />

      <DetalleMovDialog mov={detalleMov} onClose={() => setDetalleMov(null)} />
      <LightboxFotoDialog foto={lightboxFoto} onClose={() => setLightboxFoto(null)} />
      <QRInsumoDialog insumo={qrInsumo} ubicaciones={ubicaciones} onClose={() => setQrInsumo(null)} />
    </div>
  );
}
