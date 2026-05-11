import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpCircle,
  Boxes,
  Camera,
  Image as ImageIcon,
  Loader2,
  Pencil,
  PencilRuler,
  Plus,
  QrCode,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  B1_RACK_MAP,
  B2_RACK_MAP,
  RACK_MAP,
  type RackMap,
  telaToQRContent,
} from '@/modules/telas/rackMaps';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type Tela = {
  id: string;
  codigo: string;
  tipo: string | null;
  grupo: string | null;
  nemotecnico: string | null;
  proveedor: string | null;
  cod_ext: string | null;
  descriptor: string | null;
  ancho: number | null;
  calidad: string | null;
  status_stock: string | null;
  stock_minimo: number | null;
  stock_total: number | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  posicion: string | null;
  almacen: string | null;
  estado: string | null;
  proveedor_codigo: string | null;
  responsable: string | null;
  observaciones: string | null;
  foto_url: string | null;
};

type Slot = { posicion: string; codigo: string; almacen: string | null };

type Movimiento = {
  id: string;
  codigo: string;
  tipo: string;
  metros: number | null;
  almacen: string | null;
  ot: string | null;
  responsable: string | null;
  operario: string | null;
  notas: string | null;
  fecha: string;
};

type Falla = {
  id: string;
  codigo: string | null;
  tipo: string | null;
  grupo: string | null;
  proveedor: string | null;
  nemotecnico: string | null;
  ancho: number | null;
  alto: number | null;
  tipo_falla: string | null;
  metraje: number | null;
  fecha_reporte: string | null;
  responsable: string | null;
  informado: string | null;
  observaciones: string | null;
  solucion: string | null;
  fecha_resolucion: string | null;
  resuelto: string | null;
};

type Validador = { campo: string; valor: string; orden: number | null };
type ValidadoresMap = Record<string, string[]>;

type ColmenaEntry = {
  codigo: string;
  tipo: string | null;
  nemotecnico: string | null;
  almacen: string | null;
  id: string | null;
};
type Colmena = Record<string, ColmenaEntry>;

type Tab = 'catalogo' | 'rack' | 'movimientos' | 'fallas';
type SortDir = 'asc' | 'desc';
type MovTipo = 'INGRESO' | 'SALIDA' | 'TRASLADO' | 'AJUSTE';

const EMPTY_TELA: Omit<Tela, 'id'> = {
  codigo: '',
  tipo: 'BK',
  grupo: null,
  nemotecnico: null,
  proveedor: null,
  cod_ext: null,
  descriptor: null,
  ancho: null,
  calidad: null,
  status_stock: null,
  stock_minimo: null,
  stock_total: null,
  stock_mp: null,
  stock_liberado: null,
  posicion: null,
  almacen: 'LIBERADO',
  estado: 'ACTIVO',
  proveedor_codigo: null,
  responsable: null,
  observaciones: null,
  foto_url: null,
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fmtFechaHora(f: string | null): string {
  if (!f) return '—';
  return new Date(f).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tipoBadgeCls(tipo: string | null): string {
  switch (tipo) {
    case 'BK':
      return 'bg-accent/20 text-accent border-accent/30';
    case 'DU':
      return 'bg-accent/20 text-accent border-purple-500/30';
    case 'SC':
      return 'bg-accent/20 text-blue-300 border-blue-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────
export function Telas() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('catalogo');
  const [loading, setLoading] = useState(true);

  const [telas, setTelas] = useState<Tela[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [fallas, setFallas] = useState<Falla[]>([]);
  const [validadores, setValidadores] = useState<ValidadoresMap>({});
  const [colmena, setColmena] = useState<Colmena>({});

  const cargarTodo = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [rTelas, rSlots, rMov, rFallas, rVal] = await Promise.all([
        supabase
          .from('telas_catalogo')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('codigo'),
        supabase
          .from('telas_slots')
          .select('posicion,codigo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase
          .from('telas_fallas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha_reporte', { ascending: false }),
        supabase
          .from('validadores_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('orden'),
      ]);

      const telasData = (rTelas.data as Tela[]) || [];
      setTelas(telasData);
      setMovimientos((rMov.data as Movimiento[]) || []);
      setFallas((rFallas.data as Falla[]) || []);

      // Validadores agrupados por campo
      const vmap: ValidadoresMap = {};
      ((rVal.data as Validador[]) || []).forEach((v) => {
        if (!vmap[v.campo]) vmap[v.campo] = [];
        vmap[v.campo].push(v.valor);
      });
      setValidadores(vmap);

      // Colmena: empezar desde telas.posicion, después sobreescribir con telas_slots
      const catMap: Record<string, Tela> = {};
      telasData.forEach((t) => {
        catMap[t.codigo] = t;
      });

      let col: Colmena = {};
      telasData.forEach((t) => {
        if (t.posicion) {
          col[t.posicion.toUpperCase()] = {
            codigo: t.codigo,
            tipo: t.tipo,
            nemotecnico: t.nemotecnico,
            almacen: t.almacen,
            id: t.id,
          };
        }
      });
      const slotsData = (rSlots.data as Slot[]) || [];
      if (slotsData.length) {
        col = {};
        slotsData.forEach((s) => {
          if (!s.posicion || !s.codigo) return;
          const cat = catMap[s.codigo];
          col[s.posicion.toUpperCase()] = {
            codigo: s.codigo,
            tipo: cat?.tipo ?? null,
            nemotecnico: cat?.nemotecnico ?? null,
            almacen: s.almacen || cat?.almacen || null,
            id: cat?.id ?? null,
          };
        });
      }
      setColmena(col);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const fallasPendientes = useMemo(
    () => fallas.filter((f) => f.resuelto === 'NO').length,
    [fallas],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Inventario de Telas</h1>
      </div>

      <div className="border-b border-border bg-background px-5">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { k: 'catalogo', l: 'Catálogo', i: <Boxes className="h-4 w-4" /> },
              { k: 'rack', l: 'Colmena', i: <PencilRuler className="h-4 w-4" /> },
              { k: 'movimientos', l: 'Movimientos', i: <ArrowLeftRight className="h-4 w-4" /> },
              { k: 'fallas', l: 'Fallas', i: <AlertTriangle className="h-4 w-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                'relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition',
                tab === t.k
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.i}
              {t.l}
              {t.k === 'fallas' && fallasPendientes > 0 && (
                <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                  {fallasPendientes}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'catalogo' && (
        <CatalogoTab
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
          colmena={colmena}
        />
      )}
      {tab === 'rack' && (
        <RackTab telas={telas} fallas={fallas} colmena={colmena} />
      )}
      {tab === 'movimientos' && (
        <MovimientosTab
          movimientos={movimientos}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
        />
      )}
      {tab === 'fallas' && (
        <FallasTab
          fallas={fallas}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: Catálogo
// ─────────────────────────────────────────────────────────────
function CatalogoTab({
  telas,
  validadores,
  empresaId,
  onReload,
  colmena,
}: {
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
  colmena: Colmena;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [sortCol, setSortCol] = useState<keyof Tela>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalTela, setModalTela] = useState<Tela | null | undefined>(undefined); // null = nueva, Tela = editar, undefined = cerrado
  const [modalQR, setModalQR] = useState<Tela | null>(null);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filt = telas.filter((t) => {
      const matchQ =
        !q ||
        [
          t.codigo,
          t.nemotecnico,
          t.proveedor,
          t.grupo,
          t.posicion,
          t.proveedor_codigo,
          t.cod_ext,
          t.descriptor,
        ].some((v) => (v || '').toString().toLowerCase().includes(q));
      const matchTipo = !filtroTipo || t.tipo === filtroTipo;
      const matchGrupo = !filtroGrupo || t.grupo === filtroGrupo;
      const matchEst =
        !filtroEstado || t.estado === filtroEstado || t.almacen === filtroEstado;
      return matchQ && matchTipo && matchGrupo && matchEst;
    });
    filt.sort((a, b) => {
      const va = String(a[sortCol] ?? '').toLowerCase();
      const vb = String(b[sortCol] ?? '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return filt;
  }, [telas, busqueda, filtroTipo, filtroGrupo, filtroEstado, sortCol, sortDir]);

  const stats = useMemo(
    () => ({
      total: telas.length,
      bk: telas.filter((t) => t.tipo === 'BK').length,
      du: telas.filter((t) => t.tipo === 'DU').length,
      sc: telas.filter((t) => t.tipo === 'SC').length,
      liberado: telas.filter((t) => t.almacen === 'LIBERADO').length,
      mp: telas.filter((t) => t.almacen === 'MATERIAS PRIMAS').length,
    }),
    [telas],
  );

  const sort = (col: keyof Tela) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <StatCard label="Total Telas" value={stats.total} />
        <StatCard label="Blackout" value={stats.bk} color="#6366f1" />
        <StatCard label="Duo" value={stats.du} color="#a855f7" />
        <StatCard label="Screen" value={stats.sc} color="#3b82f6" />
        <StatCard label="Liberado" value={stats.liberado} color="#22c55e" />
        <StatCard label="MP" value={stats.mp} color="#f59e0b" />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, nemotécnico, proveedor…"
            className="border-border bg-card pl-8"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="BK">Blackout</option>
          <option value="DU">Duo</option>
          <option value="SC">Screen</option>
        </select>
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los grupos</option>
          {(validadores.GRUPO || []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="DESCONTINUADO">Descontinuado</option>
          <option value="LIBERADO">Liberado</option>
          <option value="MATERIAS PRIMAS">Mat. Primas</option>
        </select>
        <Button onClick={() => setModalTela(null)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva Tela
        </Button>
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 1400 }}>
          <thead>
            <tr className="border-b border-border bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
              {[
                ['codigo', 'Código'],
                ['tipo', 'Tipo'],
                ['grupo', 'Grupo'],
                ['nemotecnico', 'Nemotécnico'],
                ['proveedor', 'Proveedor'],
                ['cod_ext', 'Cód. Ext'],
                ['descriptor', 'Descriptor'],
                ['ancho', 'Ancho'],
                ['stock_total', 'Total'],
                ['stock_mp', 'MP'],
                ['stock_liberado', 'Liberado'],
                ['posicion', 'Posición'],
                ['almacen', 'Almacén'],
                ['estado', 'Estado'],
              ].map(([k, l]) => (
                <th
                  key={k}
                  onClick={() => sort(k as keyof Tela)}
                  className="cursor-pointer whitespace-nowrap px-2.5 py-2 text-left font-bold hover:text-foreground"
                >
                  {l}
                </th>
              ))}
              <th className="px-2.5 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin resultados
                </td>
              </tr>
            ) : (
              lista.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border hover:bg-secondary/40"
                >
                  <td className="whitespace-nowrap px-2.5 py-2 font-bold">
                    {t.codigo || '—'}
                  </td>
                  <td className="px-2.5 py-2">
                    {t.tipo ? (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          tipoBadgeCls(t.tipo),
                        )}
                      >
                        {t.tipo}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-muted-foreground">{t.grupo || '—'}</td>
                  <td className="px-2.5 py-2">{t.nemotecnico || '—'}</td>
                  <td className="px-2.5 py-2 text-muted-foreground">{t.proveedor || '—'}</td>
                  <td className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    {t.cod_ext || '—'}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-2.5 py-2 text-muted-foreground"
                    title={t.descriptor || ''}
                  >
                    {t.descriptor || '—'}
                  </td>
                  <td className="px-2.5 py-2 text-center">{t.ancho ?? '—'}</td>
                  <td className="px-2.5 py-2 text-center font-semibold">
                    {t.stock_total ?? '—'}
                  </td>
                  <td className="px-2.5 py-2 text-center text-muted-foreground">
                    {t.stock_mp ?? '—'}
                  </td>
                  <td className="px-2.5 py-2 text-center text-muted-foreground">
                    {t.stock_liberado ?? '—'}
                  </td>
                  <td className="px-2.5 py-2">
                    <code className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">
                      {t.posicion || '—'}
                    </code>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground">
                      {t.almacen === 'LIBERADO' ? 'Liberado' : t.almacen === 'MATERIAS PRIMAS' ? 'MP' : '—'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-center text-[11px] text-muted-foreground">
                    {t.estado || '—'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-center">
                    <button
                      onClick={() => setModalTela(t)}
                      className="mr-1 rounded-md border border-border bg-secondary p-1.5 hover:border-accent/40 hover:bg-accent/10"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setModalQR(t)}
                      className="rounded-md border border-purple-500/30 bg-accent/10 p-1.5 text-accent hover:bg-accent/20"
                      title="QR"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Mostrando {lista.length} de {telas.length} telas
      </div>

      {/* Modal tela */}
      {modalTela !== undefined && (
        <TelaDialog
          tela={modalTela}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalTela(undefined)}
          onSaved={() => {
            setModalTela(undefined);
            onReload();
          }}
        />
      )}

      {/* Modal QR */}
      {modalQR && (
        <QRTelaDialog tela={modalQR} colmena={colmena} onClose={() => setModalQR(null)} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      style={{ borderColor: color ? `${color}40` : undefined }}
    >
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal CRUD tela
// ─────────────────────────────────────────────────────────────
function TelaDialog({
  tela,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: {
  tela: Tela | null;
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Omit<Tela, 'id'>>(
    tela
      ? {
          codigo: tela.codigo,
          tipo: tela.tipo,
          grupo: tela.grupo,
          nemotecnico: tela.nemotecnico,
          proveedor: tela.proveedor,
          cod_ext: tela.cod_ext,
          descriptor: tela.descriptor,
          ancho: tela.ancho,
          calidad: tela.calidad,
          status_stock: tela.status_stock,
          stock_minimo: tela.stock_minimo,
          stock_total: tela.stock_total,
          stock_mp: tela.stock_mp,
          stock_liberado: tela.stock_liberado,
          posicion: tela.posicion,
          almacen: tela.almacen,
          estado: tela.estado,
          proveedor_codigo: tela.proveedor_codigo,
          responsable: tela.responsable,
          observaciones: tela.observaciones,
          foto_url: tela.foto_url,
        }
      : { ...EMPTY_TELA },
  );
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(tela?.foto_url ? '✓ Foto guardada' : null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onFoto = async (file: File) => {
    setUploading(true);
    setUploadMsg('Subiendo foto…');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const cod = (form.codigo || 'tela').trim().toUpperCase().replace(/\s+/g, '_');
      const path = `${empresaId}/${cod}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('fotos-telas')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: url } = supabase.storage.from('fotos-telas').getPublicUrl(path);
      if (!url?.publicUrl) throw new Error('No se pudo obtener URL pública');
      set('foto_url', url.publicUrl);
      setUploadMsg('✓ Foto guardada');
    } catch (e) {
      const err = e as Error;
      setUploadMsg('⚠ ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const guardar = async () => {
    if (!form.codigo || !form.codigo.trim()) {
      toast.warning('El código es obligatorio');
      return;
    }
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      ...form,
      codigo: form.codigo.trim(),
      posicion: form.posicion?.toString().trim().toUpperCase() || null,
    };
    const { error } = tela
      ? await supabase.from('telas_catalogo').update(payload).eq('id', tela.id)
      : await supabase.from('telas_catalogo').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(tela ? 'Tela actualizada' : 'Tela creada');
    onSaved();
  };

  const eliminar = async () => {
    if (!tela) return;
    setSaving(true);
    const { error } = await supabase.from('telas_catalogo').delete().eq('id', tela.id);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success('Tela eliminada');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{tela ? `Editar — ${tela.codigo}` : 'Nueva Tela'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FieldText label="Código *" value={form.codigo} onChange={(v) => set('codigo', v)} placeholder="BK 32" />
          <FieldSelect
            label="Tipo *"
            value={form.tipo || 'BK'}
            onChange={(v) => set('tipo', v)}
            options={[
              { v: 'BK', l: 'Blackout (BK)' },
              { v: 'DU', l: 'Duo (DU)' },
              { v: 'SC', l: 'Screen (SC)' },
            ]}
          />
          <FieldSelectValidador
            label="Grupo"
            value={form.grupo || ''}
            onChange={(v) => set('grupo', v || null)}
            opts={validadores.GRUPO || []}
          />
          <FieldText
            label="Nemotécnico"
            value={form.nemotecnico || ''}
            onChange={(v) => set('nemotecnico', v || null)}
            placeholder="BK Blanco Perla"
          />
          <FieldSelectValidador
            label="Proveedor"
            value={form.proveedor || ''}
            onChange={(v) => set('proveedor', v || null)}
            opts={validadores.PROVEEDOR || []}
          />
          <FieldText
            label="Cód. Externo"
            value={form.cod_ext || ''}
            onChange={(v) => set('cod_ext', v || null)}
            placeholder="ROB 085"
          />
          <FieldText
            label="Descriptor"
            value={form.descriptor || ''}
            onChange={(v) => set('descriptor', v || null)}
            placeholder="BLANCO ESTANDAR"
          />
          <FieldNumber
            label="Ancho (m)"
            value={form.ancho}
            onChange={(v) => set('ancho', v)}
            step={0.01}
          />
          <FieldText
            label="Calidad"
            value={form.calidad || ''}
            onChange={(v) => set('calidad', v || null)}
            placeholder="PREMIUM"
          />
          <FieldSelect
            label="Status Stock"
            value={form.status_stock || ''}
            onChange={(v) => set('status_stock', v || null)}
            options={[
              { v: '', l: '—' },
              { v: 'OK', l: 'OK' },
              { v: 'CRITICO', l: 'Crítico' },
              { v: 'AGOTADO', l: 'Agotado' },
            ]}
          />
          <FieldNumber
            label="Stock Mínimo"
            value={form.stock_minimo}
            onChange={(v) => set('stock_minimo', v)}
            step={0.1}
          />
          <FieldNumber
            label="Stock Total"
            value={form.stock_total}
            onChange={(v) => set('stock_total', v)}
            step={0.01}
          />
          <FieldNumber
            label="Stock MP"
            value={form.stock_mp}
            onChange={(v) => set('stock_mp', v)}
            step={0.01}
          />
          <FieldNumber
            label="Stock Liberado"
            value={form.stock_liberado}
            onChange={(v) => set('stock_liberado', v)}
            step={0.01}
          />
          <FieldText
            label="Posición Rack"
            value={form.posicion || ''}
            onChange={(v) => set('posicion', v ? v.toUpperCase() : null)}
            placeholder="A01"
          />
          <FieldSelect
            label="Almacén"
            value={form.almacen || 'LIBERADO'}
            onChange={(v) => set('almacen', v)}
            options={[
              { v: 'LIBERADO', l: 'Liberado' },
              { v: 'MATERIAS PRIMAS', l: 'Materias Primas' },
            ]}
          />
          <FieldSelect
            label="Estado"
            value={form.estado || 'ACTIVO'}
            onChange={(v) => set('estado', v)}
            options={[
              { v: 'ACTIVO', l: 'Activo' },
              { v: 'DESCONTINUADO', l: 'Descontinuado' },
              { v: 'X CARGAR', l: 'Por cargar' },
              { v: 'INACTIVO', l: 'Inactivo' },
            ]}
          />
          <FieldText
            label="Código Proveedor"
            value={form.proveedor_codigo || ''}
            onChange={(v) => set('proveedor_codigo', v || null)}
            placeholder="COD-PROV"
          />
          <FieldSelectValidador
            label="Responsable Carga"
            value={form.responsable || ''}
            onChange={(v) => set('responsable', v || null)}
            opts={validadores.RESPONSABLE || []}
          />
        </div>

        <div>
          <Label className="mb-1 text-xs">Observaciones</Label>
          <textarea
            value={form.observaciones || ''}
            onChange={(e) => set('observaciones', e.target.value || null)}
            rows={2}
            placeholder="Notas sobre esta tela…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label className="mb-1 flex items-center gap-1.5 text-xs">
            <Camera className="h-3.5 w-3.5" /> Foto de la Tela
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFoto(f);
              }}
            />
            <input
              id="telaFotoGaleria"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFoto(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputFotoRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" /> Tomar Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('telaFotoGaleria')?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Desde Galería
            </Button>
            {uploadMsg && <span className="text-[11px] text-muted-foreground">{uploadMsg}</span>}
          </div>
          {form.foto_url && (
            <div className="relative mt-2">
              <img
                src={form.foto_url}
                alt="preview"
                className="max-h-48 rounded-lg border border-border object-contain"
              />
              <button
                onClick={() => {
                  set('foto_url', null);
                  setUploadMsg(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-destructive hover:bg-destructive/15"
                title="Quitar foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <div>
            {tela && !confirmDel && (
              <Button
                variant="outline"
                onClick={() => setConfirmDel(true)}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/15"
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </Button>
            )}
            {tela && confirmDel && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-destructive">¿Confirmar borrado?</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDel(false)}
                >
                  No
                </Button>
                <Button
                  size="sm"
                  onClick={eliminar}
                  disabled={saving}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Sí, eliminar
                </Button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// Fields helpers
// ─────────────────────────────────────────────────────────────
function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-border bg-secondary"
      />
    </div>
  );
}
function FieldNumber({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
}) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        step={step}
        min={0}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : Number(v));
        }}
        className="border-border bg-secondary"
      />
    </div>
  );
}
function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}
function FieldSelectValidador({
  label,
  value,
  onChange,
  opts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: string[];
}) {
  const todas = value && !opts.includes(value) ? [value, ...opts] : opts;
  return (
    <div>
      <Label className="mb-1 text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
      >
        <option value="">— Seleccionar —</option>
        {todas.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QR Tela dialog
// ─────────────────────────────────────────────────────────────
function QRTelaDialog({
  tela,
  colmena,
  onClose,
}: {
  tela: Tela;
  colmena: Colmena;
  onClose: () => void;
}) {
  // Buscar posición física real en colmena
  const entrada = Object.entries(colmena).find(
    ([, data]) => data.codigo === tela.codigo,
  );
  const posicion = entrada ? entrada[0] : null;
  const almacen = entrada ? entrada[1].almacen : null;

  const codSafe = (tela.codigo || '').replace(/[^\x20-\x7E]/g, '').trim();

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-accent" />
            {tela.nemotecnico || tela.codigo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Código: {tela.codigo}
            {tela.tipo ? ` · Tipo: ${tela.tipo}` : ''}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-black">
            <QRCodeSVG value={`TEL:${codSafe}`} size={160} level="M" />
            <div className="text-center text-[11px] font-semibold">
              TEL:{codSafe}
            </div>
          </div>
          {posicion && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 text-black">
              <QRCodeSVG value={telaToQRContent(posicion, almacen)} size={160} level="M" />
              <div className="text-center text-[11px] font-semibold">
                Pos. {posicion}
                {almacen ? ` · ${almacen}` : ''}
              </div>
            </div>
          )}
        </div>

        {!posicion && (
          <p className="text-center text-xs text-muted-foreground">
            Sin posición física asignada aún. El QR de ubicación aparece cuando la tela
            está cargada en un slot del rack.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: Rack (mapa visual)
// ─────────────────────────────────────────────────────────────
function RackTab({
  telas,
  fallas,
  colmena,
}: {
  telas: Tela[];
  fallas: Falla[];
  colmena: Colmena;
}) {
  const [filtroAlm, setFiltroAlm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<{ slot: string; entrada: ColmenaEntry } | null>(null);

  const bodegas = useMemo(() => {
    if (filtroAlm === 'MATERIAS PRIMAS') {
      return [
        { label: 'BODEGA 1', map: B1_RACK_MAP },
        { label: 'BODEGA 2', map: B2_RACK_MAP },
      ];
    }
    return [{ label: null as string | null, map: RACK_MAP }];
  }, [filtroAlm]);

  const q = busqueda.trim().toLowerCase();
  const fallaCodes = useMemo(
    () =>
      new Set(
        fallas.filter((f) => f.resuelto === 'NO').map((f) => (f.codigo || '').toUpperCase()),
      ),
    [fallas],
  );

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filtroAlm}
          onChange={(e) => setFiltroAlm(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los almacenes</option>
          <option value="LIBERADO">Liberado</option>
          <option value="MATERIAS PRIMAS">Materias Primas</option>
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="BK">Blackout</option>
          <option value="DU">Duo</option>
          <option value="SC">Screen</option>
        </select>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código en rack…"
            className="border-border bg-card pl-8"
          />
        </div>
        <div className="ml-auto flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <LegendDot color="#6366f1" label="Blackout" />
          <LegendDot color="#a855f7" label="Duo" />
          <LegendDot color="#3b82f6" label="Screen" />
          <LegendDot color="#ef4444" label="Con falla" />
          <LegendDot color="#374151" label="Vacío" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {bodegas.map(({ label, map }) => (
          <div key={label ?? 'main'}>
            {label && (
              <div className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(map).map(([nombre, cfg]) => (
                <RackSection
                  key={nombre}
                  nombre={nombre}
                  config={cfg}
                  colmena={colmena}
                  fallaCodes={fallaCodes}
                  filtroAlm={filtroAlm}
                  filtroTipo={filtroTipo}
                  busqueda={q}
                  onClickSlot={(slot, entrada) => entrada && setDetalle({ slot, entrada })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {detalle && (
        <DetalleSlotDialog
          slot={detalle.slot}
          entrada={detalle.entrada}
          tela={telas.find((t) => t.codigo === detalle.entrada.codigo) || null}
          fallas={fallas.filter(
            (f) => f.codigo === detalle.entrada.codigo && f.resuelto === 'NO',
          )}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function RackSection({
  nombre,
  config,
  colmena,
  fallaCodes,
  filtroAlm,
  filtroTipo,
  busqueda,
  onClickSlot,
}: {
  nombre: string;
  config: RackMap[string];
  colmena: Colmena;
  fallaCodes: Set<string>;
  filtroAlm: string;
  filtroTipo: string;
  busqueda: string;
  onClickSlot: (slot: string, entrada: ColmenaEntry | null) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {nombre}
      </div>
      <table className="w-full border-separate border-spacing-[3px] text-[10px]">
        <thead>
          <tr>
            <th className="w-6 text-center text-muted-foreground">#</th>
            {config.cols.map((col) => (
              <th key={col} className="text-center text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row) => (
            <tr key={row.num}>
              <td className="text-center text-[10px] text-muted-foreground">{row.num}</td>
              {row.slots.map((slot, i) => {
                if (!slot) {
                  return (
                    <td key={i} className="p-0">
                      <div className="h-10 rounded-sm bg-card/50" />
                    </td>
                  );
                }
                const info = colmena[slot];
                let show = true;
                if (filtroAlm && info && info.almacen !== filtroAlm) show = false;
                if (filtroTipo && info && info.tipo !== filtroTipo) show = false;
                if (!info && (filtroAlm || filtroTipo)) show = false;

                const hasFalla =
                  info && fallaCodes.has((info.codigo || '').toUpperCase());
                const matches =
                  busqueda &&
                  ((info?.codigo || '').toLowerCase().includes(busqueda) ||
                    slot.toLowerCase().includes(busqueda));

                let bg = 'rgb(39, 39, 42)';
                let color = 'rgb(161, 161, 170)';
                let borderColor = 'rgba(255,255,255,0.05)';
                if (!show) {
                  bg = 'rgba(39, 39, 42, 0.3)';
                } else if (info) {
                  if (hasFalla) {
                    bg = 'rgba(239,68,68,0.2)';
                    borderColor = 'rgba(239,68,68,0.4)';
                    color = '#fca5a5';
                  } else if (info.tipo === 'BK') {
                    bg = 'rgba(99,102,241,0.2)';
                    borderColor = 'rgba(99,102,241,0.4)';
                    color = '#a5b4fc';
                  } else if (info.tipo === 'DU') {
                    bg = 'rgba(168,85,247,0.2)';
                    borderColor = 'rgba(168,85,247,0.4)';
                    color = '#d8b4fe';
                  } else if (info.tipo === 'SC') {
                    bg = 'rgba(59,130,246,0.2)';
                    borderColor = 'rgba(59,130,246,0.4)';
                    color = '#93c5fd';
                  }
                }
                if (matches) {
                  borderColor = '#fbbf24';
                }
                return (
                  <td key={i} className="p-0">
                    <button
                      disabled={!info && !(filtroAlm || filtroTipo)}
                      onClick={() => onClickSlot(slot, info || null)}
                      className={cn(
                        'flex h-10 w-full flex-col items-center justify-center overflow-hidden rounded-sm border px-0.5 text-[9px] leading-tight transition',
                        info && 'cursor-pointer hover:scale-105',
                      )}
                      style={{ background: bg, color, borderColor }}
                      title={info ? `${info.codigo} · ${slot}` : slot}
                    >
                      {info ? (
                        <>
                          <span className="truncate font-bold">{info.codigo}</span>
                          <span className="truncate text-[8px] opacity-60">{slot}</span>
                        </>
                      ) : (
                        <span className="text-[9px] opacity-50">{slot}</span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetalleSlotDialog({
  slot,
  entrada,
  tela,
  fallas,
  onClose,
}: {
  slot: string;
  entrada: ColmenaEntry;
  tela: Tela | null;
  fallas: Falla[];
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Posición {slot}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {entrada.tipo && (
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  tipoBadgeCls(entrada.tipo),
                )}
              >
                {entrada.tipo}
              </span>
            )}
            <strong>{entrada.codigo}</strong>
          </div>
          {tela?.nemotecnico && <div className="text-sm text-muted-foreground">{tela.nemotecnico}</div>}
          {tela?.ancho != null && (
            <div className="text-xs">
              <span className="text-muted-foreground">Ancho:</span> {tela.ancho} m
            </div>
          )}
          {tela?.descriptor && (
            <div className="text-xs text-muted-foreground">{tela.descriptor}</div>
          )}
          {entrada.almacen && (
            <div className="text-xs">
              <span className="text-muted-foreground">Almacén:</span> {entrada.almacen}
            </div>
          )}
          {fallas.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {fallas.length} falla(s) pendiente(s)
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: Movimientos
// ─────────────────────────────────────────────────────────────
function MovimientosTab({
  movimientos,
  telas,
  validadores,
  empresaId,
  onReload,
}: {
  movimientos: Movimiento[];
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
}) {
  const [modalMov, setModalMov] = useState<MovTipo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return movimientos.filter((m) => {
      const matchQ =
        !q ||
        [m.codigo, m.tipo, m.responsable, m.ot, m.notas].some((v) =>
          (v || '').toLowerCase().includes(q),
        );
      const matchT = !filtroTipo || m.tipo === filtroTipo;
      return matchQ && matchT;
    });
  }, [movimientos, busqueda, filtroTipo]);

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          onClick={() => setModalMov('INGRESO')}
          className="gap-1.5 bg-success hover:bg-success/90"
        >
          <ArrowDownCircle className="h-4 w-4" /> Nueva Entrada
        </Button>
        <Button
          onClick={() => setModalMov('SALIDA')}
          className="gap-1.5 bg-destructive hover:bg-destructive/90"
        >
          <ArrowUpCircle className="h-4 w-4" /> Nueva Salida
        </Button>
        <Button
          onClick={() => setModalMov('TRASLADO')}
          className="gap-1.5 bg-warning hover:bg-warning/90"
        >
          <ArrowLeftRight className="h-4 w-4" /> Traslado
        </Button>
        <Button
          variant="outline"
          onClick={() => setModalMov('AJUSTE')}
          className="gap-1.5"
        >
          <Pencil className="h-4 w-4" /> Ajuste
        </Button>
        <div className="ml-auto flex gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="INGRESO">Entradas</option>
            <option value="SALIDA">Salidas</option>
            <option value="TRASLADO">Traslados</option>
            <option value="AJUSTE">Ajustes</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="w-56 border-border bg-card pl-8"
            />
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
          <ArrowLeftRight className="h-8 w-8 opacity-60" />
          No hay movimientos registrados aún
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((m) => {
            const tela = telas.find((t) => t.codigo === m.codigo);
            const tipoCls =
              m.tipo === 'INGRESO'
                ? 'bg-success/15 text-success'
                : m.tipo === 'SALIDA'
                  ? 'bg-destructive/15 text-destructive'
                  : m.tipo === 'TRASLADO'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-muted/30 text-muted-foreground';
            const tipoIcon =
              m.tipo === 'INGRESO'
                ? '↓'
                : m.tipo === 'SALIDA'
                  ? '↑'
                  : m.tipo === 'TRASLADO'
                    ? '↔'
                    : '✎';
            return (
              <div
                key={m.id}
                className="grid grid-cols-[40px_1fr_auto] items-start gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-base font-bold',
                    tipoCls,
                  )}
                >
                  {tipoIcon}
                </div>
                <div>
                  <div className="text-[13px] font-semibold">
                    {m.tipo} — <strong>{m.codigo}</strong>
                    {tela && (
                      <span className="ml-1 text-muted-foreground">({tela.nemotecnico || ''})</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.metros}m · {m.almacen || '—'}
                    {m.ot && ` · OT: ${m.ot}`}
                    {m.responsable && ` · ${m.responsable}`}
                  </div>
                  {m.notas && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{m.notas}</div>
                  )}
                </div>
                <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                  {fmtFechaHora(m.fecha)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalMov && (
        <MovimientoDialog
          tipo={modalMov}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalMov(null)}
          onSaved={() => {
            setModalMov(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function MovimientoDialog({
  tipo,
  telas,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: {
  tipo: MovTipo;
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [metros, setMetros] = useState('1');
  const [almacen, setAlmacen] = useState('LIBERADO');
  const [ot, setOt] = useState('');
  const [responsable, setResponsable] = useState('');
  const [operario, setOperario] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const titulos = {
    INGRESO: 'Nueva Entrada de Tela',
    SALIDA: 'Salida de Tela a Producción',
    TRASLADO: 'Traslado MP ↔ Liberado',
    AJUSTE: 'Ajuste de Inventario',
  };

  const guardar = async () => {
    if (!codigo) {
      toast.warning('Selecciona la tela');
      return;
    }
    const m = Number(metros);
    if (!Number.isFinite(m) || m <= 0) {
      toast.warning('Metros inválidos');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('movimientos_telas').insert({
      empresa_id: empresaId,
      codigo,
      tipo,
      metros: m,
      almacen,
      ot: ot.trim() || null,
      responsable: responsable || null,
      operario: operario || null,
      notas: notas.trim() || null,
      fecha: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success('Movimiento registrado');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{titulos[tipo]}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 text-xs">Código Tela *</Label>
            <select
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="">— Seleccionar tela —</option>
              {telas.map((t) => (
                <option key={t.id} value={t.codigo}>
                  {t.codigo} — {t.nemotecnico || ''}
                </option>
              ))}
            </select>
          </div>
          <FieldText label="Metros *" value={metros} onChange={setMetros} placeholder="1" />
          <FieldSelect
            label="Almacén"
            value={almacen}
            onChange={setAlmacen}
            options={[
              { v: 'LIBERADO', l: 'Liberado' },
              { v: 'MATERIAS PRIMAS', l: 'Materias Primas' },
            ]}
          />
          <FieldText label="OT (opcional)" value={ot} onChange={setOt} placeholder="#OT-001" />
          <FieldSelectValidador
            label="Responsable"
            value={responsable}
            onChange={setResponsable}
            opts={validadores.RESPONSABLE || []}
          />
          <FieldSelectValidador
            label="Operario"
            value={operario}
            onChange={setOperario}
            opts={validadores.OPERARIO || []}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Notas</Label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Detalle del movimiento…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB: Fallas
// ─────────────────────────────────────────────────────────────
function FallasTab({
  fallas,
  telas,
  validadores,
  empresaId,
  onReload,
}: {
  fallas: Falla[];
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRes, setFiltroRes] = useState('');
  const [filtroTF, setFiltroTF] = useState('');
  const [modalFalla, setModalFalla] = useState<Falla | null | undefined>(undefined);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return fallas.filter((f) => {
      const matchQ =
        !q ||
        [f.codigo, f.nemotecnico, f.tipo_falla, f.proveedor, f.observaciones].some((v) =>
          (v || '').toLowerCase().includes(q),
        );
      const matchR = !filtroRes || f.resuelto === filtroRes;
      const matchTF = !filtroTF || f.tipo_falla === filtroTF;
      return matchQ && matchR && matchTF;
    });
  }, [fallas, busqueda, filtroRes, filtroTF]);

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <Button
          onClick={() => setModalFalla(null)}
          className="gap-1.5 bg-destructive hover:bg-destructive/90"
        >
          <Plus className="h-4 w-4" /> Reportar Falla
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={filtroRes}
            onChange={(e) => setFiltroRes(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="NO">Pendientes</option>
            <option value="EN PROCESO">En proceso</option>
            <option value="SI">Resueltas</option>
          </select>
          <select
            value={filtroTF}
            onChange={(e) => setFiltroTF(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-2 text-sm"
          >
            <option value="">Todos los tipos</option>
            {(validadores.TIPO_FALLA || []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar…"
              className="w-56 border-border bg-card pl-8"
            />
          </div>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 1400 }}>
          <thead>
            <tr className="border-b border-border bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
              {[
                'Código',
                'Tipo',
                'Grupo',
                'Proveedor',
                'Nemotécnico',
                'Ancho',
                'Alto',
                'Obs',
                'Tipo falla',
                'Metraje',
                'Reporte',
                'Responsable',
                'Solución',
                'Estado',
                'Acciones',
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td
                  colSpan={15}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Sin fallas — todo en orden ✓
                </td>
              </tr>
            ) : (
              lista.map((f) => {
                const badgeCls =
                  f.resuelto === 'SI'
                    ? 'bg-success/15 text-success border-success/30'
                    : f.resuelto === 'EN PROCESO'
                      ? 'bg-warning/15 text-warning border-warning/30'
                      : 'bg-destructive/15 text-destructive border-destructive/30';
                const badgeTxt =
                  f.resuelto === 'SI'
                    ? 'Resuelto'
                    : f.resuelto === 'EN PROCESO'
                      ? 'En proceso'
                      : 'Pendiente';
                return (
                  <tr
                    key={f.id}
                    className="border-b border-border hover:bg-secondary/40"
                  >
                    <td className="whitespace-nowrap px-2.5 py-2 font-bold">
                      {f.codigo || '—'}
                    </td>
                    <td className="px-2.5 py-2">
                      {f.tipo ? (
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            tipoBadgeCls(f.tipo),
                          )}
                        >
                          {f.tipo}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-muted-foreground">{f.grupo || '—'}</td>
                    <td className="px-2.5 py-2 text-muted-foreground">{f.proveedor || '—'}</td>
                    <td className="px-2.5 py-2">{f.nemotecnico || '—'}</td>
                    <td className="px-2.5 py-2 text-center">{f.ancho ?? '—'}</td>
                    <td className="px-2.5 py-2 text-center">{f.alto ?? '—'}</td>
                    <td
                      className="max-w-[140px] truncate px-2.5 py-2 text-[11px] text-muted-foreground"
                      title={f.observaciones || ''}
                    >
                      {f.observaciones || '—'}
                    </td>
                    <td className="px-2.5 py-2">
                      {f.tipo_falla && (
                        <span className="rounded-full border border-warning/30 bg-warning/15 px-2 py-0.5 text-[10px] text-warning">
                          {f.tipo_falla}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      {f.metraje != null ? `${f.metraje}m` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-[11px]">
                      {f.fecha_reporte || '—'}
                    </td>
                    <td className="px-2.5 py-2 text-[11px]">
                      {f.responsable || '—'}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-2.5 py-2 text-[11px] text-muted-foreground"
                      title={f.solucion || ''}
                    >
                      {f.solucion || '—'}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                          badgeCls,
                        )}
                      >
                        {badgeTxt}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <button
                        onClick={() => setModalFalla(f)}
                        className="rounded-md border border-border bg-secondary p-1.5 hover:border-accent/40 hover:bg-accent/10"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalFalla !== undefined && (
        <FallaDialog
          falla={modalFalla}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalFalla(undefined)}
          onSaved={() => {
            setModalFalla(undefined);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function FallaDialog({
  falla,
  telas,
  validadores,
  empresaId,
  onClose,
  onSaved,
}: {
  falla: Falla | null;
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState(falla?.codigo || '');
  const [tipoFalla, setTipoFalla] = useState(falla?.tipo_falla || '');
  const [ancho, setAncho] = useState<number | null>(falla?.ancho ?? null);
  const [alto, setAlto] = useState<number | null>(falla?.alto ?? null);
  const [metraje, setMetraje] = useState<number | null>(falla?.metraje ?? null);
  const [fechaReporte, setFechaReporte] = useState(
    falla?.fecha_reporte || new Date().toISOString().slice(0, 10),
  );
  const [responsable, setResponsable] = useState(falla?.responsable || '');
  const [informado, setInformado] = useState(falla?.informado || '');
  const [observaciones, setObservaciones] = useState(falla?.observaciones || '');
  const [solucion, setSolucion] = useState(falla?.solucion || '');
  const [fechaRes, setFechaRes] = useState(falla?.fecha_resolucion || '');
  const [resuelto, setResuelto] = useState(falla?.resuelto || 'NO');
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    if (!codigo) {
      toast.warning('El código de tela es obligatorio');
      return;
    }
    setSaving(true);
    const tela = telas.find((t) => t.codigo === codigo);
    const payload = {
      empresa_id: empresaId,
      codigo,
      tipo: tela?.tipo || null,
      grupo: tela?.grupo || null,
      proveedor: tela?.proveedor || null,
      nemotecnico: tela?.nemotecnico || null,
      ancho: ancho ?? tela?.ancho ?? null,
      alto,
      tipo_falla: tipoFalla || null,
      metraje,
      fecha_reporte: fechaReporte || null,
      responsable: responsable || null,
      informado: informado.trim() || null,
      observaciones: observaciones.trim() || null,
      solucion: solucion.trim() || null,
      fecha_resolucion: fechaRes || null,
      resuelto,
    };
    const { error } = falla
      ? await supabase.from('telas_fallas').update(payload).eq('id', falla.id)
      : await supabase.from('telas_fallas').insert(payload);
    setSaving(false);
    if (error) {
      toast.error('Error: ' + error.message);
      return;
    }
    toast.success(falla ? 'Falla actualizada' : 'Falla registrada');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>{falla ? 'Editar Falla' : 'Reportar Falla'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 text-xs">Código Tela *</Label>
            <select
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            >
              <option value="">— Seleccionar tela —</option>
              {telas.map((t) => (
                <option key={t.id} value={t.codigo}>
                  {t.codigo} — {t.nemotecnico || ''}
                </option>
              ))}
            </select>
          </div>
          <FieldSelectValidador
            label="Tipo de Falla *"
            value={tipoFalla}
            onChange={setTipoFalla}
            opts={validadores.TIPO_FALLA || []}
          />
          <FieldNumber label="Ancho (m)" value={ancho} onChange={setAncho} step={0.01} />
          <FieldNumber label="Alto / Metraje (m)" value={alto} onChange={setAlto} step={0.01} />
          <FieldNumber
            label="Metraje afectado (m)"
            value={metraje}
            onChange={setMetraje}
            step={0.01}
          />
          <div>
            <Label className="mb-1 text-xs">Fecha Reporte</Label>
            <Input
              type="date"
              value={fechaReporte}
              onChange={(e) => setFechaReporte(e.target.value)}
              className="border-border bg-secondary"
            />
          </div>
          <FieldSelectValidador
            label="Responsable Reporte"
            value={responsable}
            onChange={setResponsable}
            opts={validadores.RESPONSABLE || []}
          />
          <FieldText
            label="Informado a"
            value={informado}
            onChange={setInformado}
            placeholder="Nombre o cargo"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Observaciones</Label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Detalle de la falla…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <div>
          <Label className="mb-1 text-xs">Solución</Label>
          <textarea
            value={solucion}
            onChange={(e) => setSolucion(e.target.value)}
            rows={2}
            placeholder="Qué se hizo para resolver…"
            className="w-full resize-none rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 text-xs">Fecha Resolución</Label>
            <Input
              type="date"
              value={fechaRes}
              onChange={(e) => setFechaRes(e.target.value)}
              className="border-border bg-secondary"
            />
          </div>
          <FieldSelect
            label="¿Resuelto?"
            value={resuelto}
            onChange={setResuelto}
            options={[
              { v: 'NO', l: 'No' },
              { v: 'EN PROCESO', l: 'En proceso' },
              { v: 'SI', l: 'Sí' },
            ]}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
