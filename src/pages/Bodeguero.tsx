import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Eraser,
  FileSignature,
  KeyRound,
  Loader2,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
  QrCode,
  Scissors,
  User,
  X,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQRScanner } from '@/modules/bodega/useQRScanner';
import {
  type BOMItem,
  type Insumo,
  type OT,
  type Rack,
  type TelaCatalogo,
  type TelaSlot,
  type TuboColmena,
  buscarInsumoMatchBOM,
  construirBOM,
  getColmenaPorCodTubo,
  getRackUbicacionPorSpec,
  getRackUbicacion,
  getUbicacionBOM,
} from '@/modules/bodega/bomUtils';

// ─────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────
type Vista =
  | 'lista'
  | 'despacho'
  | 'scanner'
  | 'firma'
  | 'salida'
  | 'entrada'
  | 'devolucion';

const MOTIVOS_DEVOLUCION = [
  'Error de picking',
  'Material defectuoso',
  'No se usó',
  'Otro',
] as const;
type MotivoDevolucion = (typeof MOTIVOS_DEVOLUCION)[number];
type ScanFase = 'loc' | 'item';
type ScanEstado = 'esperando' | 'ok' | 'error';

type Contador = {
  pickeado: number;
  requerido: number;
  estado: 'pendiente' | 'parcial' | 'completo';
};

const ESTADOS_BODEGUERO = ['produccion', 'lista', 'pendiente_firma'];
const SCAN_COOLDOWN_OK = 1800;
const SCAN_COOLDOWN_ERR = 1400;

const MESES_A = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE',
];

// ─────────────────────────────────────────────────────────────
// Vista principal: router de vistas
// ─────────────────────────────────────────────────────────────
export function Bodeguero() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista>('lista');
  const [ots, setOts] = useState<OT[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [telasCat, setTelasCat] = useState<TelaCatalogo[]>([]);
  const [telasSlots, setTelasSlots] = useState<TelaSlot[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [tubos, setTubos] = useState<TuboColmena[]>([]);
  const [otActual, setOtActual] = useState<OT | null>(null);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [contadores, setContadores] = useState<Record<number, Contador>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scanner state
  const [scanItemIdx, setScanItemIdx] = useState<number>(-1);
  const [scanFase, setScanFase] = useState<ScanFase>('loc');

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);

    try {
      const [rOts, rIns, rTelCat, rTelSlots, rRacks, rTubos] = await Promise.all([
        supabase
          .from('ots')
          .select('id, numero_ot, estado, datos_generales, items, fecha_creacion, fecha_entrega')
          .eq('empresa_id', empresaId)
          .in('estado', ESTADOS_BODEGUERO)
          .order('fecha_creacion', { ascending: false }),
        supabase
          .from('insumos')
          .select('cod,nemotecnico,descriptor_proveedor,categoria,color,ubicacion,stock_mp,stock_liberado')
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_catalogo')
          .select('codigo,nemotecnico,tipo,almacen,posicion')
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_slots')
          .select('posicion,codigo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('ubicaciones_rack')
          .select('rack,fila,columna,codigo_insumo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('colmena_tubos')
          .select('cod,n_colmena,medida_cm')
          .eq('empresa_id', empresaId),
      ]);

      if (rOts.error) {
        const esRLS =
          rOts.error.message?.includes('policy') ||
          rOts.error.message?.includes('permission') ||
          rOts.error.code === '42501';
        setError(
          esRLS
            ? 'Sin permisos para cargar órdenes. Revisa las políticas RLS de la tabla `ots`.'
            : rOts.error.message,
        );
        return;
      }

      setOts((rOts.data as OT[]) || []);
      setInsumos((rIns.data as Insumo[]) || []);
      setTelasCat((rTelCat.data as TelaCatalogo[]) || []);
      setTelasSlots((rTelSlots.data as TelaSlot[]) || []);
      setRacks((rRacks.data as Rack[]) || []);
      setTubos((rTubos.data as TuboColmena[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const abrirOT = async (ot: OT) => {
    if (!empresaId) return;
    setOtActual(ot);

    const { data: bomDB } = await supabase
      .from('orden_materiales')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ot_id', ot.id)
      .order('orden');

    const bom = construirBOM(
      ot,
      (bomDB as Parameters<typeof construirBOM>[1]) || [],
      insumos,
      racks,
      telasSlots,
      telasCat,
    );
    setBomItems(bom);

    const cnt: Record<number, Contador> = {};
    bom.forEach((item, idx) => {
      cnt[idx] = {
        pickeado: item.cantidad_despachada || 0,
        requerido: item.cantidad_req || 1,
        estado: item.estado === 'completado' ? 'completo' : 'pendiente',
      };
    });
    setContadores(cnt);
    setVista('despacho');
  };

  const volverLista = () => {
    setVista('lista');
    setOtActual(null);
    setBomItems([]);
    setContadores({});
    cargar();
  };

  const iniciarScanItem = (idx: number) => {
    setScanItemIdx(idx);
    const item = bomItems[idx];
    // Si no hay ubicación conocida → ir directo a escanear item
    let tieneUbicacion = false;
    if (item._es_tela) {
      tieneUbicacion = !!item._ubicacion_rack;
    } else {
      tieneUbicacion = !!getUbicacionBOM(item, insumos, racks);
    }
    setScanFase(tieneUbicacion ? 'loc' : 'item');
    setVista('scanner');
  };

  const onConfirmItem = (idx: number, cantidad: number) => {
    setContadores((prev) => {
      const cnt = prev[idx];
      const nuevoPick = cnt.pickeado + cantidad;
      const completo = nuevoPick >= cnt.requerido;
      const next = {
        ...prev,
        [idx]: {
          ...cnt,
          pickeado: nuevoPick,
          estado: (completo ? 'completo' : 'parcial') as Contador['estado'],
        },
      };
      return next;
    });
    const item = bomItems[idx];
    const cnt = contadores[idx];
    const nuevoPick = cnt.pickeado + cantidad;
    if (nuevoPick >= cnt.requerido) {
      toast.success(`${item.descripcion} — ${cnt.requerido} ${item.unidad} completado`);
    } else {
      const faltan = cnt.requerido - nuevoPick;
      toast(`${item.descripcion}: faltan ${faltan} ${item.unidad}`);
    }
    setVista('despacho');
  };

  const todosCompletos = useMemo(
    () =>
      Object.values(contadores).length > 0 &&
      Object.values(contadores).every((c) => c.estado === 'completo'),
    [contadores],
  );

  // ── Render
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/15 p-5 text-red-200">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" /> No se pudo cargar
          </div>
          <div className="text-sm">{error}</div>
          <Button onClick={cargar} className="mt-4">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      {vista === 'lista' && (
        <ListaOTs
          ots={ots}
          onBack={() => navigate('/landing')}
          onSelect={abrirOT}
          onSalida={() => setVista('salida')}
          onEntrada={() => setVista('entrada')}
          onDevolucion={() => setVista('devolucion')}
        />
      )}
      {vista === 'salida' && (
        <AdHocView
          modo="salida"
          empresaId={empresaId || ''}
          onCerrar={() => setVista('lista')}
        />
      )}
      {vista === 'entrada' && (
        <AdHocView
          modo="entrada"
          empresaId={empresaId || ''}
          onCerrar={() => setVista('lista')}
        />
      )}
      {vista === 'devolucion' && (
        <AdHocView
          modo="devolucion"
          empresaId={empresaId || ''}
          onCerrar={() => setVista('lista')}
        />
      )}
      {vista === 'despacho' && otActual && (
        <DespachoView
          ot={otActual}
          bomItems={bomItems}
          contadores={contadores}
          insumos={insumos}
          racks={racks}
          tubos={tubos}
          todosCompletos={todosCompletos}
          onBack={volverLista}
          onIniciarScan={iniciarScanItem}
          onIrAFirma={() => setVista('firma')}
        />
      )}
      {vista === 'scanner' && otActual && scanItemIdx >= 0 && (
        <ScannerView
          item={bomItems[scanItemIdx]}
          contador={contadores[scanItemIdx]}
          insumos={insumos}
          racks={racks}
          initialFase={scanFase}
          onCerrar={() => setVista('despacho')}
          onConfirm={(cant) => onConfirmItem(scanItemIdx, cant)}
        />
      )}
      {vista === 'firma' && otActual && (
        <FirmaView
          ot={otActual}
          bomItems={bomItems}
          contadores={contadores}
          insumos={insumos}
          empresaId={empresaId || ''}
          onBack={() => setVista('despacho')}
          onDone={volverLista}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Lista de OTs
// ─────────────────────────────────────────────────────────────
function ListaOTs({
  ots,
  onBack,
  onSelect,
  onSalida,
  onEntrada,
  onDevolucion,
}: {
  ots: OT[];
  onBack: () => void;
  onSelect: (ot: OT) => void;
  onSalida: () => void;
  onEntrada: () => void;
  onDevolucion: () => void;
}) {
  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Bodeguero</h1>
      </div>

      <div className="mx-auto max-w-3xl p-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          <Button
            onClick={onSalida}
            className="h-auto flex-col gap-1 border border-destructive/30 bg-destructive/15 py-3 text-destructive hover:bg-destructive/15"
            variant="outline"
          >
            <ArrowUpCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Salida rápida</span>
            <span className="text-[10px] opacity-80">Sin OT</span>
          </Button>
          <Button
            onClick={onEntrada}
            className="h-auto flex-col gap-1 border border-success/30 bg-success/15 py-3 text-success hover:bg-success/15"
            variant="outline"
          >
            <ArrowDownCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Entrada rápida</span>
            <span className="text-[10px] opacity-80">Stock nuevo</span>
          </Button>
          <Button
            onClick={onDevolucion}
            className="h-auto flex-col gap-1 border border-warning/30 bg-warning/15 py-3 text-warning hover:bg-warning/15"
            variant="outline"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-semibold">Devolución</span>
            <span className="text-[10px] opacity-80">Devolver de OT</span>
          </Button>
        </div>

        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Despacho por OT
        </div>

        {ots.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay órdenes en producción
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ots.map((ot) => {
              const dg = (ot.datos_generales || {}) as Record<string, unknown>;
              const cliente = (dg.cliente as string) || '—';
              const bomCount = Array.isArray(dg.bom)
                ? (dg.bom as unknown[]).length
                : '?';
              const telaCount = (ot.items || []).reduce(
                (s: number, v: Record<string, unknown>) =>
                  s + (Array.isArray(v.panos) ? (v.panos as unknown[]).length : 1),
                0,
              );
              const badge =
                ot.estado === 'pendiente_firma'
                  ? { cls: 'bg-warning/15 text-warning border-warning/30', txt: 'Pendiente firma' }
                  : ot.estado === 'lista'
                    ? { cls: 'bg-success/15 text-success border-success/30', txt: 'Lista p/ entrega' }
                    : { cls: 'bg-accent/15 text-accent border-blue-500/30', txt: 'En producción' };

              return (
                <button
                  key={ot.id}
                  onClick={() => onSelect(ot)}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-accent/40 hover:bg-card/80"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-base font-bold">
                      OT {ot.numero_ot || ot.id.slice(-6)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                        badge.cls,
                      )}
                    >
                      {badge.txt}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">{cliente}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" /> {bomCount} insumos
                    </span>
                    {telaCount > 0 && (
                      <span className="flex items-center gap-1 text-warning">
                        <Scissors className="h-3 w-3" /> {telaCount} paño(s)
                      </span>
                    )}
                    {ot.fecha_entrega && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {ot.fecha_entrega.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Despacho por OT (lista de BOM)
// ─────────────────────────────────────────────────────────────
function DespachoView({
  ot,
  bomItems,
  contadores,
  insumos,
  racks,
  tubos,
  todosCompletos,
  onBack,
  onIniciarScan,
  onIrAFirma,
}: {
  ot: OT;
  bomItems: BOMItem[];
  contadores: Record<number, Contador>;
  insumos: Insumo[];
  racks: Rack[];
  tubos: TuboColmena[];
  todosCompletos: boolean;
  onBack: () => void;
  onIniciarScan: (idx: number) => void;
  onIrAFirma: () => void;
}) {
  const dg = (ot.datos_generales || {}) as Record<string, unknown>;
  const cliente = (dg.cliente as string) || '—';
  const fechaEntrega = dg.fechaEntrega as string | undefined;
  const badge =
    ot.estado === 'pendiente_firma'
      ? 'Pendiente firma'
      : ot.estado === 'lista'
        ? 'Lista p/ entrega'
        : 'En producción';

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> OTs
          </button>
          <h1 className="flex-1 text-base font-bold">
            OT {ot.numero_ot || ot.id.slice(-6)}
          </h1>
          <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {badge}
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Cliente
              </div>
              <div className="font-semibold">{cliente}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">OT</div>
              <div className="font-semibold">{ot.numero_ot || '—'}</div>
            </div>
            {fechaEntrega && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Entrega
                </div>
                <div className="font-semibold">{fechaEntrega}</div>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          BOM — Tocá un ítem para escanear
        </div>

        {bomItems.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No hay BOM para esta OT.
            <br />
            <span className="text-[11px] text-muted-foreground">
              Generá Fase 4 en el cotizador primero.
            </span>
          </div>
        ) : (
          bomItems.map((item, idx) => {
            const cnt = contadores[idx];
            const completo = cnt?.estado === 'completo';
            const enProceso = cnt?.pickeado > 0 && !completo;
            const esTela = !!item._es_tela;

            let locText = '';
            let stockInfo = '';
            if (esTela) {
              locText = item._ubicacion_rack
                ? `📍 Rack: ${item._ubicacion_rack}`
                : '⚠ Sin posición registrada';
            } else if ((item.categoria || '').toUpperCase().includes('TUBER')) {
              const cod = (item.especificacion || '').split('·')[0].trim().toUpperCase();
              const col = getColmenaPorCodTubo(cod, tubos);
              locText = col ? `🗄 Colmena: ${col}` : '⚠ Sin colmena asignada';
            } else {
              const ubic = getUbicacionBOM(item, insumos, racks);
              locText = ubic ? ubic.display : racks.length ? '⚠ Sin rack asignado' : '';
              const insMatch = buscarInsumoMatchBOM(item, insumos);
              stockInfo = insMatch
                ? ` · Stock: ${(insMatch.stock_mp || 0) + (insMatch.stock_liberado || 0)}`
                : '';
            }

            return (
              <button
                key={idx}
                disabled={completo}
                onClick={() => !completo && onIniciarScan(idx)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left transition',
                  completo
                    ? 'border-success/30 bg-success/15 opacity-70'
                    : enProceso
                      ? 'border-warning/30 bg-warning/15 hover:border-warning/30'
                      : 'border-border hover:border-accent/40',
                  esTela && !completo && 'border-warning/30',
                )}
              >
                <div className="flex-shrink-0 text-2xl">
                  {esTela ? '🧵' : completo ? '✅' : enProceso ? '🔄' : '⬜'}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      esTela ? 'text-warning' : 'text-muted-foreground',
                    )}
                  >
                    {item.categoria}
                  </div>
                  <div className="truncate text-sm font-semibold">{item.descripcion}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[item.especificacion, item.color].filter(Boolean).join(' · ')}
                    {stockInfo}
                  </div>
                  {locText && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{locText}</div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div
                    className={cn(
                      'text-xl font-bold',
                      completo
                        ? 'text-success'
                        : esTela
                          ? 'text-warning'
                          : 'text-foreground',
                    )}
                  >
                    {cnt?.pickeado || 0}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    /{cnt?.requerido} {item.unidad}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {todosCompletos && (
          <Button
            onClick={onIrAFirma}
            className="mt-2 h-12 gap-2 bg-success text-base hover:bg-success/90"
          >
            <FileSignature className="h-5 w-5" /> Firmar y confirmar entrega
          </Button>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Scanner (state machine: loc → item → confirm)
// ─────────────────────────────────────────────────────────────
function ScannerView({
  item,
  contador,
  insumos,
  racks,
  initialFase,
  onCerrar,
  onConfirm,
}: {
  item: BOMItem;
  contador: Contador;
  insumos: Insumo[];
  racks: Rack[];
  initialFase: ScanFase;
  onCerrar: () => void;
  onConfirm: (cantidad: number) => void;
}) {
  const [fase, setFase] = useState<ScanFase>(initialFase);
  const [estado, setEstado] = useState<ScanEstado>('esperando');
  const [mensaje, setMensaje] = useState('');
  const [submensaje, setSubmensaje] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [needItemScanTap, setNeedItemScanTap] = useState(false);
  const [qty, setQty] = useState<number>(0);
  const [maxQty, setMaxQty] = useState<number>(1);

  // Ubicación esperada
  const ubicacionInfo = useMemo(() => {
    if (item._es_tela && item._ubicacion_rack) {
      const ascii = (s: string) => s.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, '');
      return {
        display: item._ubicacion_rack,
        qr: `LOC:${ascii(item._ubicacion_rack)}`,
      };
    }
    const spec = (item.especificacion || '').trim();
    if (spec) {
      const r = getRackUbicacionPorSpec(spec, racks);
      if (r) return r;
    }
    const ins = buscarInsumoMatchBOM(item, insumos);
    if (ins) {
      const r = getRackUbicacion(ins.cod, racks);
      if (r) return r;
    }
    return null;
  }, [item, racks, insumos]);

  const locDisplay = ubicacionInfo
    ? `📍 ${ubicacionInfo.display}`
    : '⚠ Sin rack asignado — escanea directo el insumo';

  const insumoEsperado = useMemo(() => buscarInsumoMatchBOM(item, insumos), [item, insumos]);

  // Inicializar mensajes según fase
  useEffect(() => {
    if (fase === 'loc') {
      setEstado('esperando');
      setMensaje('Escanea el QR de la ubicación');
      setSubmensaje('El QR está pegado en el estante');
    } else {
      setEstado('esperando');
      setMensaje('Escanea el QR del contenedor');
      setSubmensaje('El QR está en la caja/bolsa del insumo');
    }
  }, [fase]);

  const scanner = useQRScanner({
    onScan: (decoded) => handleScan(decoded),
  });

  const handleScan = async (decoded: string) => {
    if (fase === 'loc') {
      const norm = (s: string) => s.trim().toUpperCase();
      const ok = ubicacionInfo && norm(decoded) === norm(ubicacionInfo.qr);
      if (ubicacionInfo && !ok) {
        setEstado('error');
        setMensaje('❌ Ubicación incorrecta');
        setSubmensaje(
          `Busca: ${ubicacionInfo.display}  |  Escaneaste: ${decoded.replace('LOC:', '').replace(/\|/g, ' · ')}`,
        );
        scanner.startCooldown(SCAN_COOLDOWN_ERR);
        setTimeout(() => {
          setEstado('esperando');
          setMensaje('Escanea el QR de la ubicación');
          setSubmensaje('El QR está pegado en el estante');
        }, SCAN_COOLDOWN_ERR);
        return;
      }
      // OK
      setEstado('ok');
      setMensaje('✅ Ubicación confirmada');
      setSubmensaje(
        ubicacionInfo
          ? `${ubicacionInfo.display} — Ahora toma el insumo`
          : 'Sin rack — toma el insumo',
      );
      scanner.startCooldown(SCAN_COOLDOWN_OK);
      await scanner.stop();
      setFase('item');
      setNeedItemScanTap(true);
      return;
    }

    // fase === 'item'
    if (decoded.startsWith('LOC:')) {
      setEstado('error');
      setMensaje('❌ Eso es una ubicación');
      setSubmensaje('Ya pasamos la ubicación — escanea la caja/insumo');
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }
    if (!decoded.startsWith('INS:')) {
      setEstado('error');
      setMensaje('❌ QR no reconocido');
      setSubmensaje(`Esperaba INS:... · Escaneaste: "${decoded.substring(0, 20)}"`);
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }

    const codEscaneado = decoded.replace('INS:', '').trim();
    const normCod = (s: string) => (s || '').trim().toUpperCase().replace(/\s+/g, '');
    if (insumoEsperado && normCod(insumoEsperado.cod || '') !== normCod(codEscaneado)) {
      setEstado('error');
      setMensaje('❌ Insumo incorrecto');
      setSubmensaje(`Escaneaste: ${codEscaneado}  |  Necesitás: ${insumoEsperado.cod}`);
      scanner.startCooldown(SCAN_COOLDOWN_ERR);
      setTimeout(() => {
        setEstado('esperando');
        setMensaje('Escanea el QR del contenedor');
        setSubmensaje('El QR está en la caja/bolsa del insumo');
      }, SCAN_COOLDOWN_ERR);
      return;
    }

    // Insumo correcto → panel confirmar
    await scanner.stop();
    const restante = contador.requerido - contador.pickeado;
    setMaxQty(restante);
    setQty(restante);
    setShowConfirm(true);
  };

  // Iniciar cámara cuando la vista se muestra y no estamos en "needItemScanTap"
  useEffect(() => {
    if (!needItemScanTap && !showConfirm) {
      scanner.start('reader-bodega');
    }
    return () => {
      scanner.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, showConfirm]);

  const saltarUbicacion = async () => {
    await scanner.stop();
    setFase('item');
    setNeedItemScanTap(true);
    setEstado('ok');
    setMensaje('↩ Rack salteado');
    setSubmensaje('Toma el insumo y presiona el botón');
  };

  const activarFaseItem = () => {
    setNeedItemScanTap(false);
    setEstado('esperando');
    setMensaje('Escanea el QR del contenedor');
    setSubmensaje('El QR está en la caja/bolsa del insumo');
    scanner.start('reader-bodega');
  };

  const volverAEscanearItem = () => {
    setShowConfirm(false);
    setEstado('esperando');
    setMensaje('Escanea el QR del contenedor');
    setSubmensaje('El QR está en la caja/bolsa del insumo');
    scanner.start('reader-bodega');
  };

  const paso = showConfirm ? 3 : fase === 'item' ? 2 : 1;

  return (
    <div className="min-h-full bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={async () => {
            await scanner.stop();
            onCerrar();
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Cerrar
        </button>
        <h1 className="flex-1 truncate text-base font-bold">{item.descripcion}</h1>
      </div>

      <div className="mx-auto max-w-md p-4">
        {/* Pasos */}
        <div className="mb-4 flex items-center justify-between gap-2">
          {(['Ubicación', 'Insumo', 'Confirmar'] as const).map((label, i) => {
            const n = i + 1;
            const completo = n < paso;
            const activo = n === paso;
            return (
              <div key={label} className="flex-1 text-center">
                <div
                  className={cn(
                    'mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                    completo
                      ? 'border-emerald-500 bg-success/15 text-success'
                      : activo
                        ? 'border-accent bg-accent/20 text-accent'
                        : 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {completo ? '✓' : n}
                </div>
                <div
                  className={cn(
                    'text-[10px] uppercase',
                    activo ? 'text-accent' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info del ítem */}
        {!showConfirm && (
          <div className="mb-3 rounded-xl border border-border bg-card p-3 text-sm">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {item.categoria}
            </div>
            <div className="font-semibold">{item.descripcion}</div>
            <div className="text-[11px] text-muted-foreground">
              {[item.especificacion, item.color].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-2 text-[12px] text-foreground">{locDisplay}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Progreso: {contador.pickeado} / {contador.requerido} {item.unidad}
            </div>
          </div>
        )}

        {/* Estado scanner */}
        {!showConfirm && (
          <div
            className={cn(
              'mb-3 rounded-xl border p-3 text-center text-sm',
              estado === 'error'
                ? 'border-destructive/30 bg-destructive/15 text-destructive'
                : estado === 'ok'
                  ? 'border-success/30 bg-success/15 text-success'
                  : 'border-accent/30 bg-accent/10 text-accent',
            )}
          >
            <div className="text-base font-semibold">{mensaje}</div>
            <div className="mt-0.5 text-[11px] opacity-80">{submensaje}</div>
          </div>
        )}

        {/* Reader */}
        {!showConfirm && !needItemScanTap && (
          <div
            id="reader-bodega"
            className="mx-auto mb-3 aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-black"
          />
        )}

        {scanner.error && !showConfirm && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/15 p-3 text-center text-sm text-destructive">
            <Camera className="mx-auto mb-1 h-6 w-6" />
            <div className="font-semibold">Sin acceso a cámara</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{scanner.error}</div>
            <Button
              onClick={() => scanner.start('reader-bodega')}
              size="sm"
              className="mt-2 gap-1.5"
            >
              <Camera className="h-3.5 w-3.5" /> Reintentar
            </Button>
          </div>
        )}

        {/* Botones según fase */}
        {!showConfirm && fase === 'loc' && estado === 'esperando' && (
          <Button onClick={saltarUbicacion} variant="outline" className="w-full">
            No encuentro el QR de ubicación
          </Button>
        )}
        {!showConfirm && needItemScanTap && (
          <Button onClick={activarFaseItem} className="w-full gap-2">
            <Camera className="h-4 w-4" /> Escanear QR del insumo
          </Button>
        )}

        {/* Panel confirmar */}
        {showConfirm && (
          <div className="rounded-2xl border border-success/30 bg-success/15 p-5">
            <div className="mb-1 text-xs uppercase tracking-wider text-success">
              Confirmar cantidad
            </div>
            <div className="mb-0.5 text-base font-semibold">{item.descripcion}</div>
            <div className="mb-4 text-xs text-muted-foreground">
              El sistema requiere {maxQty} {item.unidad} para esta OT
            </div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <Button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setQty(Math.max(1, Math.min(maxQty, n)));
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 w-24 text-center text-3xl font-bold"
              />
              <Button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <Button
              onClick={() => onConfirm(qty)}
              className="mb-2 h-12 w-full gap-2 bg-success text-base hover:bg-success/90"
            >
              <Check className="h-5 w-5" /> Confirmar {qty} {item.unidad}
            </Button>
            <Button onClick={volverAEscanearItem} variant="outline" className="w-full">
              Volver a escanear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Vista firma + confirmación
// ─────────────────────────────────────────────────────────────
function FirmaView({
  ot,
  bomItems,
  contadores,
  insumos,
  empresaId,
  onBack,
  onDone,
}: {
  ot: OT;
  bomItems: BOMItem[];
  contadores: Record<number, Contador>;
  insumos: Insumo[];
  empresaId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);

  const limpiar = () => {
    sigRef.current?.clear();
  };

  const confirmar = async () => {
    if (!nombre.trim()) {
      toast.warning('Ingresa el nombre del receptor');
      return;
    }
    if (sigRef.current?.isEmpty()) {
      toast.warning('La firma está vacía');
      return;
    }
    setSaving(true);
    const firmaB64 = sigRef.current!.toDataURL('image/png');

    try {
      // 1. Actualizar OT con firma + estado entregado
      const dg = (ot.datos_generales || {}) as Record<string, unknown>;
      const bomDespachado = bomItems.map((it, i) => ({
        ...it,
        cantidad_despachada: contadores[i]?.pickeado || 0,
      }));
      const { error: otErr } = await supabase
        .from('ots')
        .update({
          estado: 'entregado',
          datos_generales: {
            ...dg,
            firma: firmaB64,
            firma_nombre: nombre.trim(),
            firma_fecha: new Date().toISOString(),
            bom_despachado: bomDespachado,
          },
        })
        .eq('id', ot.id);
      if (otErr) throw otErr;

      // 2. Descontar stock + registrar movimientos
      for (let idx = 0; idx < bomItems.length; idx++) {
        const item = bomItems[idx];
        const cnt = contadores[idx];
        if (!cnt || cnt.pickeado <= 0) continue;
        const ins = buscarInsumoMatchBOM(item, insumos);
        if (!ins) continue;

        const { data: insActual } = await supabase
          .from('insumos')
          .select('stock_mp,stock_liberado')
          .eq('empresa_id', empresaId)
          .eq('cod', ins.cod!)
          .single();
        if (!insActual) continue;

        const libActual = Number(insActual.stock_liberado) || 0;
        const mpActual = Number(insActual.stock_mp) || 0;
        let resta = cnt.pickeado;
        const descLib = Math.min(resta, libActual);
        resta -= descLib;
        const descMp = Math.min(resta, mpActual);

        await supabase
          .from('insumos')
          .update({
            stock_mp: mpActual - descMp,
            stock_liberado: libActual - descLib,
          })
          .eq('empresa_id', empresaId)
          .eq('cod', ins.cod!);

        await supabase.from('movimientos_insumos').insert({
          empresa_id: empresaId,
          fecha: new Date().toISOString(),
          mes: MESES_A[new Date().getMonth()],
          tipo: 'SALIDA PRODUCCION',
          codigo: ins.cod!,
          producto: ins.nemotecnico || ins.descriptor_proveedor || '',
          almacen: 'MP',
          cantidad: cnt.pickeado,
          ot: ot.numero_ot || ot.id.slice(-6),
          responsable_entrega: nombre.trim(),
          bitacora: `Despacho OT ${ot.numero_ot || ot.id.slice(-6)}`,
        });
      }

      // 3. Actualizar orden_materiales (filas con id UUID)
      for (let idx = 0; idx < bomItems.length; idx++) {
        const item = bomItems[idx];
        const cnt = contadores[idx];
        if (typeof item.id === 'string' && item.id.length > 10) {
          await supabase
            .from('orden_materiales')
            .update({
              cantidad_despachada: cnt.pickeado,
              estado: cnt.estado === 'completo' ? 'completado' : 'parcial',
            })
            .eq('id', item.id);
        }
      }

      toast.success('Despacho confirmado y stock actualizado');
      setTimeout(() => onDone(), 1200);
    } catch (e) {
      const err = e as Error;
      toast.error('Error: ' + err.message);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="flex-1 text-base font-bold">Firma de conformidad</h1>
      </div>

      <div className="mx-auto max-w-md p-4">
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" /> Resumen del despacho
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {bomItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-border py-1 last:border-0"
              >
                <span>{item.descripcion}</span>
                <span className="font-semibold text-success">
                  {contadores[i]?.pickeado || 0} {item.unidad}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Label className="text-xs">Nombre del receptor *</Label>
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Juan Pérez"
          className="mb-4 border-border bg-card"
        />

        <Label className="text-xs">Firma</Label>
        <div className="mb-2 overflow-hidden rounded-xl bg-white">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: 'w-full',
              width: 400,
              height: 200,
              style: { width: '100%', height: 200, display: 'block' },
            }}
          />
        </div>
        <Button onClick={limpiar} variant="outline" size="sm" className="mb-4 gap-1.5">
          <Eraser className="h-3.5 w-3.5" /> Limpiar firma
        </Button>

        <Button
          onClick={confirmar}
          disabled={saving}
          className="h-12 w-full gap-2 bg-success text-base hover:bg-success/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> Confirmar entrega y descontar stock
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AdHoc: salida y entrada rápida
// ─────────────────────────────────────────────────────────────
const NOMBRE_KEY = 'rolzzo_bodeguero_nombre';

type AdHocFase = 'scan' | 'confirm' | 'ok';

type InsumoAdHoc = {
  cod: string;
  nemotecnico: string | null;
  descriptor_proveedor: string | null;
  stock_mp: number | null;
  stock_liberado: number | null;
  proveedor?: string | null;
};

function AdHocView({
  modo,
  empresaId,
  onCerrar,
}: {
  modo: 'salida' | 'entrada' | 'devolucion';
  empresaId: string;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState<string>(
    () => localStorage.getItem(NOMBRE_KEY) || '',
  );
  const [modalNombre, setModalNombre] = useState(false);
  const [nombreInput, setNombreInput] = useState(nombre);
  const [fase, setFase] = useState<AdHocFase>('scan');
  const [scanMsg, setScanMsg] = useState('Esperando escaneo…');
  const [codManual, setCodManual] = useState('');
  const [insumo, setInsumo] = useState<InsumoAdHoc | null>(null);
  const [qty, setQty] = useState(1);
  const [otRef, setOtRef] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [docRef, setDocRef] = useState('');
  const [motivo, setMotivo] = useState<MotivoDevolucion>('Error de picking');
  const [saving, setSaving] = useState(false);
  const [resumen, setResumen] = useState<{ msg: string; sub: string } | null>(null);
  // Anti-reentrada: el scanner dispara onScan cada ~100ms mientras el QR
  // está en cámara. Sin este guard, cada frame resetea qty a 1 y pisa lo
  // que el usuario haya tocado.
  const procesandoRef = useRef(false);
  // Anti-loop: si el scanner detecta un código que acabamos de marcar como
  // "no encontrado", lo ignoramos por unos segundos. Sin esto, el QR queda
  // en cámara, se redetecta inmediatamente y entra en bucle infinito de
  // toasts "Insumo X no encontrado". La búsqueda manual (Buscar/Enter) NO
  // se bloquea — solo el auto-scan del onScan callback.
  const lastFailedCodRef = useRef<{ cod: string; at: number } | null>(null);
  const FAILED_COD_TTL_MS = 5000;

  const titulo =
    modo === 'salida'
      ? 'Salida rápida'
      : modo === 'entrada'
        ? 'Entrada rápida'
        : 'Devolución desde OT';
  const colorAccent =
    modo === 'salida' ? '#ef4444' : modo === 'entrada' ? '#22c55e' : '#f59e0b';
  const labelNombre =
    modo === 'salida' ? 'Quién retira' : modo === 'entrada' ? 'Quién ingresa' : 'Quién devuelve';

  const cargarInsumo = async (cod: string) => {
    const norm = cod.trim().toUpperCase();
    if (!norm) {
      toast.warning('Ingresa un código');
      procesandoRef.current = false;
      return;
    }
    // La búsqueda manual (click en "Buscar") también debería bloquear
    // el auto-scan concurrente.
    procesandoRef.current = true;
    await scanner.stop();
    const { data } = await supabase
      .from('insumos')
      .select(
        'cod,nemotecnico,descriptor_proveedor,stock_mp,stock_liberado,proveedor',
      )
      .eq('empresa_id', empresaId)
      .eq('cod', norm)
      .maybeSingle();
    if (!data) {
      toast.error(`Insumo "${norm}" no encontrado`);
      // Marcar el código como recientemente fallido para que el scanner lo
      // ignore si sigue en cámara. Esto rompe el bucle infinito de toasts.
      lastFailedCodRef.current = { cod: norm, at: Date.now() };
      procesandoRef.current = false;
      // Cooldown de 1500ms da gracia adicional al usuario para mover la cámara
      // hacia otro QR antes del próximo intento de decodificación.
      scanner.start('adhoc-reader', 1500);
      return;
    }
    setInsumo(data as InsumoAdHoc);
    setQty(1);
    if (modo === 'entrada' && data.proveedor) setProveedor(data.proveedor);
    setCodManual('');
    setFase('confirm');
  };

  const scanner = useQRScanner({
    onScan: async (decoded) => {
      if (procesandoRef.current) return;
      const cod = decoded.startsWith('INS:')
        ? decoded.slice(4)
        : decoded.trim().toUpperCase();
      // Anti-loop: si este código falló hace menos de FAILED_COD_TTL_MS,
      // ignorar silenciosamente. Permite al operario mover la cámara a otro
      // QR sin spam de toasts.
      const lastFailed = lastFailedCodRef.current;
      if (
        lastFailed &&
        lastFailed.cod === cod &&
        Date.now() - lastFailed.at < FAILED_COD_TTL_MS
      ) {
        return;
      }
      procesandoRef.current = true;
      setScanMsg(`Código detectado: ${cod}`);
      await cargarInsumo(cod);
    },
  });

  // Al montar, si no hay nombre → abrir modal, sino iniciar cámara
  useEffect(() => {
    if (!nombre) {
      setModalNombre(true);
      return;
    }
    // pequeño delay para que el div tenga dimensiones
    const t = setTimeout(() => scanner.start('adhoc-reader'), 200);
    return () => {
      clearTimeout(t);
      scanner.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre]);

  // Relanzar cámara al volver a fase scan
  // Cooldown de 1200ms previene que el QR del producto anterior (que
  // sigue en cámara porque el trabajador acaba de tocar "Otra salida"
  // sin mover el teléfono) sea re-detectado instantáneamente. Ese era
  // el bug por el que "lo mandaba al mismo producto".
  useEffect(() => {
    if (fase !== 'scan' || !nombre) return;
    setScanMsg('Esperando escaneo…');
    const t = setTimeout(() => scanner.start('adhoc-reader', 1200), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const guardarNombre = () => {
    const n = nombreInput.trim();
    if (!n) {
      toast.warning('Ingresa tu nombre');
      return;
    }
    localStorage.setItem(NOMBRE_KEY, n);
    setNombre(n);
    setModalNombre(false);
    toast.success(`Guardado como "${n}"`);
  };

  const stockActual = insumo
    ? (insumo.stock_mp || 0) + (insumo.stock_liberado || 0)
    : 0;

  const confirmar = async () => {
    if (!insumo) return;
    if (!nombre) {
      setModalNombre(true);
      return;
    }
    setSaving(true);
    try {
      const { data: insActual } = await supabase
        .from('insumos')
        .select('stock_mp,stock_liberado')
        .eq('empresa_id', empresaId)
        .eq('cod', insumo.cod)
        .single();

      if (modo === 'salida') {
        if (insActual) {
          const lib = Number(insActual.stock_liberado) || 0;
          const mp = Number(insActual.stock_mp) || 0;
          let resta = qty;
          const descLib = Math.min(resta, lib);
          resta -= descLib;
          const descMp = Math.min(resta, mp);
          const { error } = await supabase
            .from('insumos')
            .update({
              stock_mp: mp - descMp,
              stock_liberado: lib - descLib,
            })
            .eq('empresa_id', empresaId)
            .eq('cod', insumo.cod);
          if (error) throw error;
        }

        const { error: errMov } = await supabase
          .from('movimientos_insumos')
          .insert({
            empresa_id: empresaId,
            fecha: new Date().toISOString(),
            mes: MESES_A[new Date().getMonth()],
            tipo: 'SALIDA PRODUCCION',
            codigo: insumo.cod,
            producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
            almacen: 'MP',
            cantidad: qty,
            ot: otRef.trim(),
            responsable_entrega: nombre,
            bitacora: `Salida rápida — ${nombre}${otRef.trim() ? ' · OT ' + otRef.trim() : ''}`,
          });
        if (errMov) throw errMov;

        const stockRestante = Math.max(0, stockActual - qty);
        setResumen({
          msg: `${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Registrado a nombre de ${nombre}${otRef.trim() ? ' · OT ' + otRef.trim() : ''} · Stock restante: ${stockRestante}`,
        });
      } else if (modo === 'entrada') {
        const mpActual = insActual ? Number(insActual.stock_mp) || 0 : 0;
        const libActual = insActual ? Number(insActual.stock_liberado) || 0 : 0;
        const { error } = await supabase
          .from('insumos')
          .update({ stock_mp: mpActual + qty })
          .eq('empresa_id', empresaId)
          .eq('cod', insumo.cod);
        if (error) throw error;

        const { error: errMov } = await supabase
          .from('movimientos_insumos')
          .insert({
            empresa_id: empresaId,
            fecha: new Date().toISOString(),
            mes: MESES_A[new Date().getMonth()],
            tipo: 'NUEVO INGRESO',
            codigo: insumo.cod,
            producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
            almacen: 'MP',
            cantidad: qty,
            responsable_entrega: nombre,
            recepcion: nombre,
            bitacora: `Ingreso rápido — ${nombre}${proveedor.trim() ? ' · Proveedor: ' + proveedor.trim() : ''}${docRef.trim() ? ' · Doc: ' + docRef.trim() : ''}`,
          });
        if (errMov) throw errMov;

        const stockNuevo = mpActual + libActual + qty;
        setResumen({
          msg: `+${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Registrado por ${nombre}${proveedor.trim() ? ' · ' + proveedor.trim() : ''}${docRef.trim() ? ' · ' + docRef.trim() : ''} · Stock nuevo: ${stockNuevo}`,
        });
      } else {
        // devolucion: vuelve el stock a MP y registra trazabilidad con OT + motivo
        if (!otRef.trim()) {
          toast.warning('Ingresá la OT de origen');
          setSaving(false);
          return;
        }
        const mpActual = insActual ? Number(insActual.stock_mp) || 0 : 0;
        const libActual = insActual ? Number(insActual.stock_liberado) || 0 : 0;
        const { error } = await supabase
          .from('insumos')
          .update({ stock_mp: mpActual + qty })
          .eq('empresa_id', empresaId)
          .eq('cod', insumo.cod);
        if (error) throw error;

        const { error: errMov } = await supabase
          .from('movimientos_insumos')
          .insert({
            empresa_id: empresaId,
            fecha: new Date().toISOString(),
            mes: MESES_A[new Date().getMonth()],
            tipo: 'DEVOLUCION',
            codigo: insumo.cod,
            producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
            almacen: 'MP',
            cantidad: qty,
            ot: otRef.trim(),
            responsable_entrega: nombre,
            bitacora: `Devolución — Motivo: ${motivo} · Devolvió: ${nombre}`,
          });
        if (errMov) throw errMov;

        const stockNuevo = mpActual + libActual + qty;
        setResumen({
          msg: `+${qty}× ${insumo.nemotecnico || insumo.cod}`,
          sub: `Devuelto a stock por ${nombre} · OT ${otRef.trim()} · ${motivo} · Stock nuevo: ${stockNuevo}`,
        });
      }
      setFase('ok');
    } catch (e) {
      const err = e as Error;
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const nuevoItem = () => {
    setInsumo(null);
    setQty(1);
    setOtRef('');
    setProveedor('');
    setDocRef('');
    setMotivo('Error de picking');
    setResumen(null);
    setFase('scan');
    procesandoRef.current = false;
  };

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={async () => {
            await scanner.stop();
            onCerrar();
          }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <h1 className="flex-1 text-base font-bold" style={{ color: colorAccent }}>
          {titulo}
        </h1>
        <button
          onClick={() => {
            setNombreInput(nombre);
            setModalNombre(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:bg-card"
        >
          <User className="h-3.5 w-3.5" />
          {nombre || labelNombre}
          <Pencil className="h-3 w-3 opacity-60" />
        </button>
      </div>

      <div className="mx-auto max-w-md p-4">
        {fase === 'scan' && (
          <>
            <div
              id="adhoc-reader"
              className="mx-auto mb-3 aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-black"
            />
            <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-center text-sm text-accent">
              <QrCode className="mx-auto mb-1 h-5 w-5" />
              {scanMsg}
            </div>
            {scanner.error && (
              <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/15 p-3 text-center text-sm text-destructive">
                <Camera className="mx-auto mb-1 h-5 w-5" />
                <div className="font-semibold">Cámara no disponible</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{scanner.error}</div>
                <Button
                  onClick={() => scanner.start('adhoc-reader')}
                  size="sm"
                  className="mt-2"
                >
                  Reintentar
                </Button>
              </div>
            )}
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O escribí el código manualmente
            </div>
            <div className="flex gap-2">
              <Input
                value={codManual}
                onChange={(e) => setCodManual(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && cargarInsumo(codManual)}
                placeholder="Ej: MEC14"
                className="border-border bg-card"
              />
              <Button onClick={() => cargarInsumo(codManual)} className="gap-1.5">
                <KeyRound className="h-4 w-4" /> Buscar
              </Button>
            </div>
          </>
        )}

        {fase === 'confirm' && insumo && (
          <>
            <div className="mb-4 rounded-2xl border border-border bg-card p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Código: {insumo.cod}
              </div>
              <div className="text-base font-semibold">
                {insumo.nemotecnico || insumo.descriptor_proveedor || insumo.cod}
              </div>
              <div className="mt-2 text-xs">
                {modo === 'salida' ? (
                  stockActual <= 0 ? (
                    <span className="text-destructive">
                      <AlertTriangle className="mr-1 inline h-3 w-3" /> Sin stock disponible
                    </span>
                  ) : stockActual <= 5 ? (
                    <span className="text-warning">
                      <AlertTriangle className="mr-1 inline h-3 w-3" /> Stock bajo:{' '}
                      {stockActual} unidades
                    </span>
                  ) : (
                    <span className="text-success">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" /> Stock disponible:{' '}
                      {stockActual} unidades
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">
                    Stock actual: {stockActual} unidades
                  </span>
                )}
              </div>
            </div>

            <Label className="mb-1 text-xs">Cantidad</Label>
            <div className="mb-4 flex items-center justify-center gap-3 rounded-xl border border-border bg-card p-3">
              <Button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={qty}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) setQty(Math.max(1, n));
                }}
                onFocus={(e) => e.currentTarget.select()}
                className="h-11 w-24 text-center text-3xl font-bold"
              />
              <Button
                onClick={() => setQty((q) => q + 1)}
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>

            {modo === 'salida' && (
              <>
                <Label className="mb-1 text-xs">OT (opcional)</Label>
                <Input
                  value={otRef}
                  onChange={(e) => setOtRef(e.target.value)}
                  placeholder="Ej: 12345"
                  className="mb-4 border-border bg-card"
                />
              </>
            )}

            {modo === 'entrada' && (
              <>
                <Label className="mb-1 text-xs">Proveedor (opcional)</Label>
                <Input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Ej: Meriggi"
                  className="mb-3 border-border bg-card"
                />
                <Label className="mb-1 text-xs">N° de documento (opcional)</Label>
                <Input
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="Ej: Factura 1234"
                  className="mb-4 border-border bg-card"
                />
              </>
            )}

            {modo === 'devolucion' && (
              <>
                <Label className="mb-1 text-xs">OT de origen</Label>
                <Input
                  value={otRef}
                  onChange={(e) => setOtRef(e.target.value)}
                  placeholder="Ej: 12345"
                  className="mb-3 border-border bg-card"
                />
                <Label className="mb-1 text-xs">Motivo</Label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value as MotivoDevolucion)}
                  className="mb-4 w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
                >
                  {MOTIVOS_DEVOLUCION.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            )}

            <Button
              onClick={confirmar}
              disabled={
                saving ||
                (modo === 'salida' && stockActual <= 0) ||
                (modo === 'devolucion' && !otRef.trim())
              }
              className={cn(
                'mb-2 h-12 w-full gap-2 text-base',
                modo === 'salida'
                  ? 'bg-destructive hover:bg-destructive/90'
                  : modo === 'entrada'
                    ? 'bg-success hover:bg-success/90'
                    : 'bg-warning hover:bg-warning/90',
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {modo === 'salida'
                    ? 'Confirmar salida'
                    : modo === 'entrada'
                      ? 'Confirmar ingreso'
                      : 'Confirmar devolución'}
                </>
              )}
            </Button>
            <Button onClick={nuevoItem} variant="outline" className="w-full">
              Volver a escanear
            </Button>
          </>
        )}

        {fase === 'ok' && resumen && (
          <div className="rounded-2xl border border-success/30 bg-success/15 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-success" />
            <div className="mb-1 text-lg font-bold text-foreground">{resumen.msg}</div>
            <div className="mb-4 text-xs text-muted-foreground">{resumen.sub}</div>
            <Button onClick={nuevoItem} className="w-full gap-1.5">
              <QrCode className="h-4 w-4" />{' '}
              {modo === 'salida'
                ? 'Otra salida'
                : modo === 'entrada'
                  ? 'Otra entrada'
                  : 'Otra devolución'}
            </Button>
          </div>
        )}
      </div>

      {/* Modal nombre */}
      {modalNombre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
              <User className="h-5 w-5 text-accent" /> ¿Quién{' '}
              {modo === 'salida'
                ? 'retira'
                : modo === 'entrada'
                  ? 'ingresa'
                  : 'devuelve'}
              ?
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Este nombre se usa para todos los movimientos que registres desde este
              dispositivo. Queda guardado en el celular.
            </p>
            <Input
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardarNombre()}
              placeholder="Tu nombre"
              autoFocus
              className="mb-3 border-border bg-secondary"
            />
            <div className="flex justify-end gap-2">
              {nombre && (
                <Button variant="outline" onClick={() => setModalNombre(false)}>
                  Cancelar
                </Button>
              )}
              <Button onClick={guardarNombre}>Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Silencia warning de imports no usados
export type __Unused =
  | typeof FileSignature
  | typeof MapPin
  | typeof X
  | typeof ArrowDownCircle
  | typeof ArrowUpCircle;
