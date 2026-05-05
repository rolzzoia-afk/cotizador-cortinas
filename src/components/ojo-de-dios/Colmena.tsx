import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  ClipboardCheck,
  Grid3x3,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Search,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useColmenaTubos,
  useColmenaPanos,
  useInventario,
  type ColmenaTubo,
  type ColmenaPano,
  type InventarioDiffRow,
} from '@/modules/admin/colmena';

type SubTab = 'tubos' | 'panos';

export function Colmena() {
  const [sub, setSub] = useState<SubTab>('tubos');
  const tubos = useColmenaTubos();
  const panos = useColmenaPanos();
  const inventario = useInventario();

  const refrescar = () => {
    if (sub === 'tubos') tubos.refrescar();
    else panos.refrescar();
    inventario.refrescar();
  };

  return (
    <div className="space-y-3">
      <InventarioPanel ctx={inventario} tubosActuales={tubos.tubos.length} onCambio={tubos.refrescar} />

      <div className="rounded-lg border border-emerald-500/30 bg-zinc-900/40 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSub('tubos')}
            className={cn(
              'flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition',
              sub === 'tubos'
                ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400/60 hover:bg-emerald-500/10',
            )}
          >
            <Ruler className="h-3.5 w-3.5" />
            Tubos
          </button>
          <button
            onClick={() => setSub('panos')}
            className={cn(
              'flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition',
              sub === 'panos'
                ? 'border-indigo-500/40 bg-indigo-500/20 text-indigo-300'
                : 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400/60 hover:bg-indigo-500/10',
            )}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Paños de Tela
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={refrescar}
            className="ml-auto h-8 gap-1 border-emerald-500/30 text-emerald-300"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>

        {sub === 'tubos' && <TubosPanel ctx={tubos} />}
        {sub === 'panos' && <PanosPanel ctx={panos} />}
      </div>
    </div>
  );
}

// ─── TUBOS ─────────────────────────────────────────────────────────
function TubosPanel({ ctx }: { ctx: ReturnType<typeof useColmenaTubos> }) {
  const { tubos, loading, guardar, eliminar } = ctx;
  const [filtro, setFiltro] = useState('');
  const [editando, setEditando] = useState<ColmenaTubo | null>(null);
  const [creando, setCreando] = useState(false);

  const filtrados = useMemo(() => {
    const q = filtro.toLowerCase();
    if (!q) return tubos;
    return tubos.filter(
      (t) =>
        (t.n_colmena || '').toLowerCase().includes(q) ||
        (t.cod || '').toLowerCase().includes(q) ||
        (t.serial || '').toLowerCase().includes(q),
    );
  }, [tubos, filtro]);

  const abrirNuevo = () => {
    setEditando(null);
    setCreando(true);
  };

  const abrirEditar = (t: ColmenaTubo) => {
    setEditando(t);
    setCreando(true);
  };

  const cerrarForm = () => {
    setEditando(null);
    setCreando(false);
  };

  const onEliminar = async (t: ColmenaTubo) => {
    if (!confirm(`¿Eliminar tubo "${t.cod}" de colmena ${t.n_colmena}?\n\nNo se puede deshacer.`))
      return;
    try {
      await eliminar(t.id);
      toast.success('Tubo eliminado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">Inventario de Tubos (colmena_tubos)</strong>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Colmena, código..."
              className="h-8 w-44 pl-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={abrirNuevo}
            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      </div>
      <div className="mb-2 text-xs text-zinc-500">{tubos.length} tubo(s) en inventario</div>

      {creando && (
        <TuboForm
          tubo={editando}
          onCancel={cerrarForm}
          onSave={async (input) => {
            try {
              await guardar(input, editando?.id);
              toast.success(editando ? 'Tubo actualizado' : 'Tubo agregado al inventario');
              cerrarForm();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              toast.error('Error: ' + msg);
            }
          }}
        />
      )}

      <div className="max-h-[420px] overflow-y-auto rounded border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-[0.65rem] uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="p-2 text-left">Colmena</th>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Medida</th>
              <th className="p-2 text-left">Serial</th>
              <th className="p-2 text-left">Origen</th>
              <th className="p-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  Cargando tubos...
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  Sin tubos para mostrar.
                </td>
              </tr>
            )}
            {filtrados.map((t) => (
              <tr key={t.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-2 font-semibold text-emerald-300">{t.n_colmena || '—'}</td>
                <td className="p-2 font-mono text-zinc-200">{t.cod || '—'}</td>
                <td className="p-2 text-zinc-200">
                  {t.medida_cm ? Number(t.medida_cm).toFixed(1) + ' cm' : '—'}
                </td>
                <td className="p-2 font-mono text-zinc-400">{t.serial || '—'}</td>
                <td className="p-2 text-[0.68rem]">
                  {t.agregado_por_admin ? (
                    <span className="text-amber-300">✔ Admin</span>
                  ) : (
                    <span className="text-zinc-500">Auto</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => abrirEditar(t)}
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 w-6 border-red-500/30 p-0 text-red-400 hover:bg-red-500/10"
                      onClick={() => onEliminar(t)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TuboForm({
  tubo,
  onCancel,
  onSave,
}: {
  tubo: ColmenaTubo | null;
  onCancel: () => void;
  onSave: (input: {
    n_colmena: string;
    cod: string;
    medida_cm: number;
    serial: string | null;
    procedencia: string | null;
  }) => Promise<void>;
}) {
  const [colmena, setColmena] = useState(tubo?.n_colmena || '');
  const [cod, setCod] = useState(tubo?.cod || '');
  const [medida, setMedida] = useState(tubo?.medida_cm ? String(tubo.medida_cm) : '');
  const [serial, setSerial] = useState(tubo?.serial || '');
  const [procedencia, setProcedencia] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const colT = colmena.trim();
    const codT = cod.trim();
    const medN = parseFloat(medida);
    if (!colT) return toast.error('El número de colmena es obligatorio');
    if (!codT) return toast.error('El código del tubo es obligatorio');
    if (!medN) return toast.error('La medida es obligatoria');
    setSaving(true);
    await onSave({
      n_colmena: colT,
      cod: codT,
      medida_cm: medN,
      serial: serial.trim() || null,
      procedencia: procedencia.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="mb-3 rounded-lg border border-emerald-500/35 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-emerald-300">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          {tubo ? 'Editar tubo' : 'Nuevo tubo'}
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">N° Colmena *</Label>
          <Input
            value={colmena}
            onChange={(e) => setColmena(e.target.value)}
            placeholder="A1, B2, 7..."
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Código *</Label>
          <Input
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            placeholder="38mm, 50mm..."
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Medida (cm) *</Label>
          <Input
            type="number"
            value={medida}
            onChange={(e) => setMedida(e.target.value)}
            placeholder="145.5"
            step="0.1"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Serial</Label>
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="T-001-A"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-12">
          <Label className="text-[0.65rem]">
            Procedencia <span className="text-zinc-500">(de dónde viene)</span>
          </Label>
          <Input
            value={procedencia}
            onChange={(e) => setProcedencia(e.target.value)}
            placeholder="Proveedor X, devuelto de obra, sobrante..."
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={submit}
          disabled={saving}
          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500"
        >
          <Save className="h-3.5 w-3.5" />
          Guardar tubo
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── PAÑOS ──────────────────────────────────────────────────────────
function PanosPanel({ ctx }: { ctx: ReturnType<typeof useColmenaPanos> }) {
  const { panos, loading, guardar } = ctx;
  const [filtro, setFiltro] = useState('');
  const [filtroDisp, setFiltroDisp] = useState<'' | 'true' | 'false'>('');
  const [editando, setEditando] = useState<ColmenaPano | null>(null);

  const filtrados = useMemo(() => {
    const q = filtro.toLowerCase();
    let lista = panos;
    if (q) {
      lista = lista.filter(
        (p) =>
          (p.codigo || '').toLowerCase().includes(q) ||
          (p.ot_asignada || '').toLowerCase().includes(q),
      );
    }
    if (filtroDisp !== '') {
      lista = lista.filter((p) => String(p.disponible) === filtroDisp);
    }
    return lista;
  }, [panos, filtro, filtroDisp]);

  const disponibles = panos.filter((p) => p.disponible).length;
  const usados = panos.length - disponibles;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">Paños de Tela (colmena_panos)</strong>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Código, OT..."
              className="h-8 w-44 pl-7 text-xs"
            />
          </div>
          <select
            value={filtroDisp}
            onChange={(e) => setFiltroDisp(e.target.value as '' | 'true' | 'false')}
            className="h-8 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="">Todos</option>
            <option value="true">Disponibles</option>
            <option value="false">Usados</option>
          </select>
        </div>
      </div>
      <div className="mb-2 text-xs text-zinc-500">
        {panos.length} paños — {disponibles} disponibles, {usados} usados
      </div>

      {editando && (
        <PanoForm
          pano={editando}
          onCancel={() => setEditando(null)}
          onSave={async (input) => {
            try {
              await guardar(editando.id, input);
              toast.success('Paño actualizado');
              setEditando(null);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              toast.error('Error: ' + msg);
            }
          }}
        />
      )}

      <div className="max-h-[420px] overflow-y-auto rounded border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-[0.65rem] uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Ancho</th>
              <th className="p-2 text-left">Alto</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">OT</th>
              <th className="p-2 text-left">Fecha uso</th>
              <th className="p-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-500">
                  Cargando paños...
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-zinc-500">
                  Sin paños para mostrar.
                </td>
              </tr>
            )}
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                <td className="p-2 font-mono text-zinc-200">{p.codigo || '—'}</td>
                <td className="p-2 text-zinc-200">
                  {p.medida_ancho != null ? Number(p.medida_ancho).toFixed(2) + ' m' : '—'}
                </td>
                <td className="p-2 text-zinc-200">
                  {p.medida_alto != null ? Number(p.medida_alto).toFixed(2) + ' m' : '—'}
                </td>
                <td className="p-2">
                  {p.disponible ? (
                    <span className="text-emerald-400">● Disponible</span>
                  ) : (
                    <span className="text-amber-400">● Usado</span>
                  )}
                </td>
                <td className="p-2 text-zinc-400">{p.ot_asignada || '—'}</td>
                <td className="p-2 text-[0.68rem] text-zinc-500">
                  {p.fecha_uso ? p.fecha_uso.slice(0, 10) : '—'}
                </td>
                <td className="p-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 border-indigo-500/30 p-0 text-indigo-400 hover:bg-indigo-500/10"
                    onClick={() => setEditando(p)}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanoForm({
  pano,
  onCancel,
  onSave,
}: {
  pano: ColmenaPano;
  onCancel: () => void;
  onSave: (input: {
    codigo: string | null;
    medida_ancho: number | null;
    medida_alto: number | null;
    disponible: boolean;
    ot_asignada: string | null;
  }) => Promise<void>;
}) {
  const [codigo, setCodigo] = useState(pano.codigo || '');
  const [ancho, setAncho] = useState(pano.medida_ancho != null ? String(pano.medida_ancho) : '');
  const [alto, setAlto] = useState(pano.medida_alto != null ? String(pano.medida_alto) : '');
  const [disponible, setDisponible] = useState(pano.disponible);
  const [ot, setOt] = useState(pano.ot_asignada || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onSave({
      codigo: codigo.trim() || null,
      medida_ancho: parseFloat(ancho) || null,
      medida_alto: parseFloat(alto) || null,
      disponible,
      ot_asignada: ot.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="mb-3 rounded-lg border border-indigo-500/35 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-indigo-300">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Editar paño
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Código</Label>
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Ancho (m)</Label>
          <Input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            step="0.001"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Alto (m)</Label>
          <Input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            step="0.001"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Estado</Label>
          <select
            value={disponible ? 'true' : 'false'}
            onChange={(e) => setDisponible(e.target.value === 'true')}
            className="h-8 w-full rounded border border-white/10 bg-zinc-900 px-2 text-xs text-zinc-100"
          >
            <option value="true">Disponible</option>
            <option value="false">Usado</option>
          </select>
        </div>
        <div className="md:col-span-12">
          <Label className="text-[0.65rem]">OT asignada</Label>
          <Input
            value={ot}
            onChange={(e) => setOt(e.target.value)}
            placeholder="Número de OT"
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={submit}
          disabled={saving}
          className="h-8 gap-1 bg-indigo-600 hover:bg-indigo-500"
        >
          <Save className="h-3.5 w-3.5" />
          Guardar paño
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// avoid unused-import warning
void Boxes;

// ─── INVENTARIO PANEL ──────────────────────────────────────────────
function InventarioPanel({
  ctx,
  tubosActuales,
  onCambio,
}: {
  ctx: ReturnType<typeof useInventario>;
  tubosActuales: number;
  onCambio: () => void;
}) {
  const { activo, historicos, loading, iniciar, cerrar, revertir, diff } = ctx;
  const [iniciando, setIniciando] = useState(false);
  const [notasInicio, setNotasInicio] = useState('');
  const [accion, setAccion] = useState<'cerrar' | 'revertir' | 'diff' | null>(null);
  const [textoAccion, setTextoAccion] = useState('');
  const [diffData, setDiffData] = useState<InventarioDiffRow[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  const stats = useMemo(() => {
    if (!diffData) return null;
    return {
      mantenidos: diffData.filter((r) => r.tipo === 'mantenido').length,
      eliminados: diffData.filter((r) => r.tipo === 'eliminado').length,
      nuevos: diffData.filter((r) => r.tipo === 'nuevo').length,
      modificados: diffData.filter((r) => r.tipo === 'modificado').length,
    };
  }, [diffData]);

  // Auto-cargar diff cuando hay inventario activo
  useEffect(() => {
    if (!activo) {
      setDiffData(null);
      return;
    }
    let cancel = false;
    diff(activo.id).then((rows) => {
      if (!cancel) setDiffData(rows);
    }).catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [activo, diff, tubosActuales]);

  const handleIniciar = async () => {
    setEnviando(true);
    try {
      await iniciar(notasInicio.trim() || null);
      toast.success('Inventario iniciado. Snapshot guardado.');
      setIniciando(false);
      setNotasInicio('');
      onCambio();
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  const handleAccion = async () => {
    if (!activo) return;
    setEnviando(true);
    try {
      if (accion === 'cerrar') {
        await cerrar(activo.id, textoAccion.trim() || null);
        toast.success('Inventario cerrado');
      } else if (accion === 'revertir') {
        await revertir(activo.id, textoAccion.trim());
        toast.success('Inventario revertido. Tubos restaurados al snapshot.');
        onCambio();
      }
      setAccion(null);
      setTextoAccion('');
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/30 p-3 text-xs text-zinc-500">
        Cargando estado de inventario…
      </div>
    );
  }

  // ── Sin inventario activo: panel mínimo con botón iniciar
  if (!activo) {
    return (
      <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/30 p-3">
        {!iniciando ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <ClipboardCheck className="h-4 w-4 text-zinc-500" />
              <span>
                Sin inventario activo. {historicos.length > 0 && (
                  <span className="text-zinc-500">
                    Último: {new Date(historicos[0].iniciado_at).toLocaleDateString('es-CL')} (
                    {historicos[0].estado})
                  </span>
                )}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIniciando(true)}
              className="h-8 gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              Iniciar inventario
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <ClipboardCheck className="h-4 w-4" />
              Iniciar nuevo inventario
            </div>
            <p className="text-xs text-zinc-400">
              Se hará un snapshot de los <strong>{tubosActuales}</strong> tubos actuales y se
              bloqueará el optimizador (operarios no podrán cortar) hasta que cierres o reviertas.
            </p>
            <textarea
              value={notasInicio}
              onChange={(e) => setNotasInicio(e.target.value)}
              rows={2}
              placeholder="Notas opcionales (responsable, motivo, alcance…)"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIniciando(false);
                  setNotasInicio('');
                }}
                disabled={enviando}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleIniciar}
                disabled={enviando}
                className="h-8 gap-1 bg-amber-600 hover:bg-amber-500"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                {enviando ? 'Iniciando…' : 'Confirmar e iniciar'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inventario activo: panel prominente
  const tieneAnomaliasAlPasar = stats && (stats.eliminados > 0 || stats.nuevos > 0 || stats.modificados > 0);

  return (
    <div className="rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              Inventario activo
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-amber-200">
                Optimizador bloqueado
              </span>
            </div>
            <div className="mt-0.5 text-[0.7rem] text-amber-200/70">
              Iniciado por{' '}
              <strong>{activo.iniciado_por_email || '—'}</strong> el{' '}
              {new Date(activo.iniciado_at).toLocaleString('es-CL')}
              {' '}· Snapshot de {activo.tubos_count_pre} tubos
            </div>
            {activo.notas && (
              <div className="mt-1 max-w-xl whitespace-pre-wrap text-[0.7rem] text-amber-100/80">
                {activo.notas}
              </div>
            )}
          </div>
        </div>
      </div>

      {stats && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox label="Mantenidos" valor={stats.mantenidos} color="zinc" />
          <StatBox label="Modificados" valor={stats.modificados} color="indigo" />
          <StatBox label="Nuevos" valor={stats.nuevos} color="emerald" />
          <StatBox label="Eliminados" valor={stats.eliminados} color="red" />
        </div>
      )}

      {tieneAnomaliasAlPasar && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[0.7rem] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            Hay cambios pendientes contra el snapshot. Revisa el diff completo antes de cerrar para
            confirmar que todos los cambios son correctos.
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAccion('diff')}
          disabled={!stats}
          className="h-8 gap-1 border-zinc-600 text-zinc-200"
        >
          <Search className="h-3.5 w-3.5" />
          Ver diff completo
        </Button>
        <Button
          size="sm"
          onClick={() => setAccion('cerrar')}
          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-500"
        >
          <Archive className="h-3.5 w-3.5" />
          Cerrar inventario
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAccion('revertir')}
          className="h-8 gap-1 border-red-500/40 text-red-300 hover:bg-red-500/10"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Revertir al snapshot
        </Button>
      </div>

      {/* Modal de acción */}
      {accion === 'cerrar' && (
        <ModalAccion
          titulo="Cerrar inventario"
          descripcion="El inventario quedará archivado con el conteo final actual. Después podrás revisarlo en el historial pero no editarlo."
          textareaLabel="Notas de cierre (opcional)"
          textareaValor={textoAccion}
          setTextareaValor={setTextoAccion}
          onConfirmar={handleAccion}
          onCancelar={() => {
            setAccion(null);
            setTextoAccion('');
          }}
          confirmando={enviando}
          confirmarTexto="Confirmar cierre"
          confirmarColor="emerald"
        />
      )}
      {accion === 'revertir' && (
        <ModalAccion
          titulo="Revertir inventario"
          descripcion="Se restaurarán los tubos al estado del snapshot inicial. Cualquier cambio hecho durante el inventario se perderá. El motivo queda registrado."
          textareaLabel="Motivo del rollback (mínimo 5 caracteres) *"
          textareaValor={textoAccion}
          setTextareaValor={setTextoAccion}
          onConfirmar={handleAccion}
          onCancelar={() => {
            setAccion(null);
            setTextoAccion('');
          }}
          confirmando={enviando}
          confirmarTexto="Sí, revertir"
          confirmarColor="red"
          confirmarDisabled={textoAccion.trim().length < 5}
        />
      )}
      {accion === 'diff' && diffData && (
        <DiffModal
          rows={diffData}
          onClose={() => setAccion(null)}
        />
      )}
    </div>
  );
}

function StatBox({
  label,
  valor,
  color,
}: {
  label: string;
  valor: number;
  color: 'zinc' | 'indigo' | 'emerald' | 'red';
}) {
  const palette = {
    zinc: 'border-zinc-700 bg-zinc-800/40 text-zinc-300',
    indigo: 'border-indigo-600/40 bg-indigo-500/10 text-indigo-300',
    emerald: 'border-emerald-600/40 bg-emerald-500/10 text-emerald-300',
    red: 'border-red-600/40 bg-red-500/10 text-red-300',
  }[color];
  return (
    <div className={cn('rounded border px-2 py-1.5 text-center', palette)}>
      <div className="text-lg font-bold tabular-nums">{valor}</div>
      <div className="text-[0.6rem] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function ModalAccion({
  titulo,
  descripcion,
  textareaLabel,
  textareaValor,
  setTextareaValor,
  onConfirmar,
  onCancelar,
  confirmando,
  confirmarTexto,
  confirmarColor,
  confirmarDisabled,
}: {
  titulo: string;
  descripcion: string;
  textareaLabel: string;
  textareaValor: string;
  setTextareaValor: (v: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
  confirmando: boolean;
  confirmarTexto: string;
  confirmarColor: 'emerald' | 'red';
  confirmarDisabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-sm font-semibold">{titulo}</div>
        <p className="mb-3 text-xs text-zinc-400">{descripcion}</p>
        <Label className="text-xs text-zinc-300">{textareaLabel}</Label>
        <textarea
          value={textareaValor}
          onChange={(e) => setTextareaValor(e.target.value)}
          rows={3}
          autoFocus
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs"
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancelar} disabled={confirmando} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={onConfirmar}
            disabled={confirmando || !!confirmarDisabled}
            className={cn(
              'h-8 gap-1',
              confirmarColor === 'emerald' && 'bg-emerald-600 hover:bg-emerald-500',
              confirmarColor === 'red' && 'bg-red-600 hover:bg-red-500',
            )}
          >
            {confirmando ? 'Procesando…' : confirmarTexto}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DiffModal({ rows, onClose }: { rows: InventarioDiffRow[]; onClose: () => void }) {
  const [filtro, setFiltro] = useState<InventarioDiffRow['tipo'] | 'todos'>('todos');

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return rows;
    return rows.filter((r) => r.tipo === filtro);
  }, [rows, filtro]);

  const conteo = useMemo(() => ({
    todos: rows.length,
    mantenido: rows.filter((r) => r.tipo === 'mantenido').length,
    modificado: rows.filter((r) => r.tipo === 'modificado').length,
    nuevo: rows.filter((r) => r.tipo === 'nuevo').length,
    eliminado: rows.filter((r) => r.tipo === 'eliminado').length,
  }), [rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-lg border border-zinc-700 bg-zinc-900 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Diff completo del inventario</div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          {(['todos', 'modificado', 'nuevo', 'eliminado', 'mantenido'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={cn(
                'rounded border px-2 py-1 capitalize',
                filtro === t
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800',
              )}
            >
              {t} ({conteo[t]})
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded border border-zinc-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-800 text-[0.65rem] uppercase tracking-wide">
              <tr>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Colmena</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-right">Medida (cm)</th>
                <th className="p-2 text-left">Serial</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
                    No hay filas en este filtro.
                  </td>
                </tr>
              )}
              {filtradas.map((r, i) => (
                <DiffRow key={r.tubo_raiz_id + ':' + i} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiffRow({ row }: { row: InventarioDiffRow }) {
  const tipoColor = {
    mantenido: 'text-zinc-400',
    modificado: 'text-indigo-300',
    nuevo: 'text-emerald-300',
    eliminado: 'text-red-300',
  }[row.tipo];

  if (row.tipo === 'eliminado') {
    return (
      <tr className="border-t border-zinc-800">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)}>{row.tipo}</td>
        <td className="p-2 line-through text-zinc-500">{row.n_colmena_pre}</td>
        <td className="p-2 line-through text-zinc-500">{row.cod_pre}</td>
        <td className="p-2 text-right line-through text-zinc-500 tabular-nums">{row.medida_cm_pre}</td>
        <td className="p-2 line-through text-zinc-500">{row.serial_pre || '—'}</td>
      </tr>
    );
  }
  if (row.tipo === 'nuevo') {
    return (
      <tr className="border-t border-zinc-800">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)}>{row.tipo}</td>
        <td className="p-2">{row.n_colmena_post}</td>
        <td className="p-2">{row.cod_post}</td>
        <td className="p-2 text-right tabular-nums">{row.medida_cm_post}</td>
        <td className="p-2">{row.serial_post || '—'}</td>
      </tr>
    );
  }
  if (row.tipo === 'modificado') {
    const camposCambiados: string[] = [];
    if (row.n_colmena_pre !== row.n_colmena_post) camposCambiados.push('colmena');
    if (row.cod_pre !== row.cod_post) camposCambiados.push('código');
    if (row.medida_cm_pre !== row.medida_cm_post) camposCambiados.push('medida');
    if (row.serial_pre !== row.serial_post) camposCambiados.push('serial');
    return (
      <tr className="border-t border-zinc-800">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)} title={camposCambiados.join(', ')}>
          {row.tipo}
        </td>
        <td className="p-2">
          {row.n_colmena_pre !== row.n_colmena_post ? (
            <span><span className="text-zinc-500 line-through">{row.n_colmena_pre}</span> → <span className="text-indigo-300">{row.n_colmena_post}</span></span>
          ) : (
            row.n_colmena_post
          )}
        </td>
        <td className="p-2">
          {row.cod_pre !== row.cod_post ? (
            <span><span className="text-zinc-500 line-through">{row.cod_pre}</span> → <span className="text-indigo-300">{row.cod_post}</span></span>
          ) : (
            row.cod_post
          )}
        </td>
        <td className="p-2 text-right tabular-nums">
          {row.medida_cm_pre !== row.medida_cm_post ? (
            <span><span className="text-zinc-500 line-through">{row.medida_cm_pre}</span> → <span className="text-indigo-300">{row.medida_cm_post}</span></span>
          ) : (
            row.medida_cm_post
          )}
        </td>
        <td className="p-2">
          {row.serial_pre !== row.serial_post ? (
            <span><span className="text-zinc-500 line-through">{row.serial_pre || '—'}</span> → <span className="text-indigo-300">{row.serial_post || '—'}</span></span>
          ) : (
            row.serial_post || '—'
          )}
        </td>
      </tr>
    );
  }
  // mantenido
  return (
    <tr className="border-t border-zinc-800">
      <td className={cn('p-2 capitalize', tipoColor)}>{row.tipo}</td>
      <td className="p-2 text-zinc-400">{row.n_colmena_post}</td>
      <td className="p-2 text-zinc-400">{row.cod_post}</td>
      <td className="p-2 text-right text-zinc-400 tabular-nums">{row.medida_cm_post}</td>
      <td className="p-2 text-zinc-400">{row.serial_post || '—'}</td>
    </tr>
  );
}
