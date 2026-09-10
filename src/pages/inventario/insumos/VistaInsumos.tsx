// Orquestador de la pantalla Inventario.
//
// 4 tabs: catálogo / mapa rack / movimientos / alertas. Maneja el state
// global, las queries Supabase (incluyendo realtime de insumos), las 2
// mutaciones grandes (guardar insumo, guardar movimiento, registrar
// reposición) y compone los 4 tabs + 6 diálogos. Cada tab y cada diálogo
// vive en su archivo bajo ./inventario/.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  AlertTriangle,
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
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { compararCodigos } from '@/modules/inventario/codigosInsumo';
import { useFamiliasInsumo, useUnidades } from '@/modules/inventario/familiasStore';
import { mapaDeValidadores } from '@/modules/inventario/validadores';
import { puedeVerMontos } from '@/modules/inventario/navegacion';
import {
  comoMovimientoViejo,
  lineaDeMovimientoManual,
  resumenDeMovimientos,
  saldosFinales,
} from '@/modules/inventario/kardex';
import { registrarMovimientos } from '@/modules/inventario/kardexStore';
import {
  actualizarInsumoDesdeForm,
  crearInsumoDesdeForm,
  subirFotoInsumo,
} from './insumoMutations';

import type {
  InsumoForm,
  MovForm,
  MovTipo,
  SortCol,
  SortDir,
  Tab,
  ValidadoresMap,
} from './Insumos.types';
import { EMPTY_INSUMO_FORM, EMPTY_MOV_FORM } from './Insumos.config';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import CatalogoTab from './tabs/CatalogoTab';
import MovimientosTab from './tabs/MovimientosTab';
import AlertasTab from './tabs/AlertasTab';
import RackTab from './tabs/RackTab';
import InsumoDialog from './dialogs/InsumoDialog';
import MovDialog from './dialogs/MovDialog';
import CellRackDialog from './dialogs/CellRackDialog';
import DetalleMovDialog from './dialogs/DetalleMovDialog';
import LightboxFotoDialog from './dialogs/LightboxFotoDialog';
import QRInsumoDialog from './dialogs/QRInsumoDialog';
import { DialogoReposicion } from '@/components/inventario/DialogoReposicion';
import { useInventario } from '../InventarioLayout';

export function Inventario() {
  const { empresaId } = useAuth();
  const { flags } = useFlagsInventario();
  const { queryRol, rol } = useInventario();
  // Los montos de dinero salen de la misma tabla que el menú y el gate.
  const verMontos = puedeVerMontos(rol);
  const { familias } = useFamiliasInsumo();
  const { unidades } = useUnidades();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [pedido, setPedido] = useState<{ insumo: Insumo; sugerida: number } | null>(null);
  const [guardandoPedido, setGuardandoPedido] = useState(false);

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

      setValidadores(mapaDeValidadores(rVal.data as Validador[] | null));
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

  // Realtime: refrescar en cambios de insumos.
  // El canal lleva un nombre distinto en cada montaje: con uno fijo, el doble
  // efecto del modo estricto de React rompe con «cannot add postgres_changes
  // callbacks after subscribe()» y la pantalla deja de actualizarse sola.
  useEffect(() => {
    if (!empresaId) return;
    const channel = supabase
      .channel(`insumos-inv-${crypto.randomUUID()}`)
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
      // El código se ordena natural: como texto, INS100 se cuela antes de
      // INS99 y la tabla queda ilegible justo en las familias más grandes.
      if (sortCol === 'cod') {
        const c = compararCodigos(a.cod, b.cod);
        return sortDir === 'asc' ? c : -c;
      }
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
      return compararCodigos(a.codigo, b.codigo);
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
        familia: '',
        codManual: false,
        cod: ins.cod || '',
        unidad: ins.unidad || 'un',
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
    const r = await subirFotoInsumo(empresaId, insumoDialog.form.cod, file);
    if (r.ok) {
      actualizarFormInsumo({ foto_url: r.url });
      setFotoEstado({ msg: 'Foto guardada', tone: 'text-success' });
    } else {
      setFotoEstado({ msg: 'No se pudo subir: ' + r.motivo, tone: 'text-destructive' });
    }
    cargandoFotoRef.current = false;
  };

  const quitarFoto = () => {
    actualizarFormInsumo({ foto_url: '' });
    setFotoEstado({ msg: '', tone: '' });
  };

  // Guardar insumo. El código de un artículo NUEVO lo asigna la base (ver
  // insumoMutations); acá solo se refleja lo que quedó guardado.
  const guardarInsumo = async () => {
    if (!empresaId) return;
    const f = insumoDialog.form;
    setSavingInsumo(true);
    try {
      if (insumoDialog.editId) {
        const r = await actualizarInsumoDesdeForm(insumoDialog.editId, f, verMontos);
        if (!r.ok) {
          toast.error('Error guardando: ' + r.motivo);
          return;
        }
        setInsumos((prev) =>
          prev.map((i) => (i.id === insumoDialog.editId ? ({ ...i, ...r.patch } as Insumo) : i)),
        );
        toast.success('Insumo actualizado');
      } else {
        if (!f.codManual && !f.familia) {
          toast.error('Elige la familia del artículo: de ahí sale su código.');
          return;
        }
        const r = await crearInsumoDesdeForm({
          empresaId,
          form: f,
          kardexRpc: flags.kardexRpc,
        });
        if (!r.ok) {
          toast.error(r.motivo);
          return;
        }
        setInsumos((prev) => [...prev, r.insumo]);
        if (r.movimiento) setMovimientos((m) => [r.movimiento as Movimiento, ...m]);
        if (r.aviso) toast.warning(r.aviso);
        // El código puede no ser el que se previsualizó: si alguien dio de alta
        // en la misma familia mientras se llenaba el formulario, este es el
        // siguiente. Decirlo evita buscar un artículo que no existe.
        toast.success(
          r.insumo.cod && r.insumo.cod !== f.cod
            ? `Artículo creado como ${r.insumo.cod}`
            : `Artículo ${r.insumo.cod} creado`,
        );
      }
      cerrarInsumoDialog();
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

    // ── Con el kardex encendido, lo hace la base en una sola operación ─────
    //
    // La diferencia que se nota: una salida sin bodega elegida sale de
    // Liberado primero y sigue por Materias primas, en vez de recortarse a
    // cero en silencio cuando no alcanza.
    if (flags.kardexRpc) {
      const linea = lineaDeMovimientoManual(f);
      if ('error' in linea) {
        toast.error(linea.error);
        return;
      }
      setSavingMov(true);
      try {
        const r = await registrarMovimientos([linea]);
        if (!r.ok) {
          toast.error(r.motivo);
          return;
        }
        const saldos = saldosFinales(r.respuesta).get(linea.item_cod.toUpperCase());
        if (insumo && saldos) {
          setInsumos((arr) => arr.map((i) => (i.id === insumo.id ? { ...i, ...saldos } : i)));
        }
        setMovimientos((prev) => [
          {
            ...comoMovimientoViejo(r.respuesta.movimientos[r.respuesta.movimientos.length - 1], {
              producto: insumo?.nemotecnico || insumo?.descriptor_proveedor || null,
              ot: f.ot.trim() || null,
              responsable: f.responsable_entrega || null,
              notas: f.bitacora.trim() || null,
            }),
            empresa_id: empresaId,
          } as Movimiento,
          ...prev,
        ]);
        toast.success(resumenDeMovimientos(r.respuesta));
        cerrarMovDialog();
      } finally {
        setSavingMov(false);
      }
      return;
    }

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

  // Reposición (pedido). El `window.prompt` de antes no dejaba escribir con
  // coma, no mostraba cuánto había ni cuánto faltaba, y en el celular tapaba
  // la pantalla entera: ahora es el mismo diálogo que usa el submódulo de
  // Alertas.
  const abrirReposicion = (codigo: string, faltaSugerida: number) => {
    const ins = insumos.find((i) => i.cod === codigo);
    if (!ins) return;
    setPedido({ insumo: ins, sugerida: Math.max(1, Math.ceil(faltaSugerida || 1)) });
  };

  const confirmarReposicion = async (cantidadCruda: number) => {
    if (!empresaId || !pedido) return;
    const ins = pedido.insumo;
    const codigo = ins.cod || '';
    const nemo = ins.nemotecnico || ins.descriptor_proveedor || codigo;
    // La columna es entera: un pedido de 2,5 cajas no se puede guardar.
    const cant = Math.round(cantidadCruda);
    if (!cant || cant <= 0) {
      toast.error('Cantidad inválida');
      return;
    }
    setGuardandoPedido(true);
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
      setPedido(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al registrar pedido: ' + msg);
    } finally {
      setGuardandoPedido(false);
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

  // La ficha de un artículo. El código lleva espacios («MEC 18»), así que va
  // codificado; el `?rol=` se conserva para no sacar al admin del «ver como».
  const rutaFicha = (codigo: string) =>
    `/inventario/insumos/${encodeURIComponent(codigo)}${queryRol}`;

  // La ficha manda acá con `?editar=<cod>` para abrir el formulario completo,
  // que vive en esta pantalla junto con la subida de fotos.
  useEffect(() => {
    const pedido = searchParams.get('editar');
    if (!pedido || loading || insumoDialog.open) return;
    const ins = insumos.find(
      (i) => (i.cod || '').trim().toUpperCase() === pedido.trim().toUpperCase(),
    );
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('editar');
        return next;
      },
      { replace: true },
    );
    if (ins) abrirEditarInsumo(ins);
    else toast.error(`No se encontró el artículo ${pedido}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading, insumos]);

  const insumoByCod = useMemo(() => {
    const m = new Map<string, Insumo>();
    for (const i of insumos) if (i.cod) m.set(i.cod, i);
    return m;
  }, [insumos]);

  // «Ver ítem» abre la ficha del artículo, que es donde está todo junto. Antes
  // solo filtraba el catálogo por el código.
  const abrirFicha = (codigo: string) => navigate(rutaFicha(codigo));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando inventario…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Insumos"
        hint={`${statsCatalogo.total.toLocaleString('es-CL')} artículos · ${alertas.length} con alerta`}
      />

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={tab === 'catalogo'}
          onClick={() => setTab('catalogo')}
        >
          <Package className="h-3.5 w-3.5" /> Catálogo
        </TabButton>
        <TabButton variante="subrayado" active={tab === 'rack'} onClick={() => setTab('rack')}>
          <Grid3x3 className="h-3.5 w-3.5" /> Ubicaciones en rack
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'movimientos'}
          onClick={() => setTab('movimientos')}
        >
          <PencilRuler className="h-3.5 w-3.5" /> Movimientos
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'alertas'}
          onClick={() => setTab('alertas')}
          badge={
            alertas.length > 0 ? <Badge variant="destructive">{alertas.length}</Badge> : undefined
          }
        >
          <AlertTriangle className="h-3.5 w-3.5" /> Alertas
        </TabButton>
      </div>

      <div>
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
            rutaFicha={rutaFicha}
            verMontos={verMontos}
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
            onVerEnCatalogo={abrirFicha}
            onRegistrarReposicion={abrirReposicion}
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
        familias={familias}
        unidades={unidades}
        puedeCodigoManual={rol === 'admin' || rol === 'superadmin'}
        verMontos={verMontos}
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
        onVerEnCatalogo={abrirFicha}
        onRegistrarEntrada={(codigo) => abrirNuevoMov('NUEVO INGRESO', codigo)}
      />

      <DetalleMovDialog mov={detalleMov} onClose={() => setDetalleMov(null)} />
      <LightboxFotoDialog foto={lightboxFoto} onClose={() => setLightboxFoto(null)} />
      <QRInsumoDialog insumo={qrInsumo} ubicaciones={ubicaciones} onClose={() => setQrInsumo(null)} />

      {pedido ? (
        <DialogoReposicion
          abierto
          codigo={pedido.insumo.cod || ''}
          nombre={
            pedido.insumo.nemotecnico || pedido.insumo.descriptor_proveedor || pedido.insumo.cod || ''
          }
          stockActual={getStockTotal(pedido.insumo)}
          minimo={Number(pedido.insumo.minimo || 0)}
          sugerida={pedido.sugerida}
          guardando={guardandoPedido}
          onCerrar={() => setPedido(null)}
          onConfirmar={({ cantidad }) => void confirmarReposicion(cantidad)}
        />
      ) : null}
    </div>
  );
}
