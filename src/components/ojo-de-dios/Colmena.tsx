import { useMemo, useState } from 'react';
import {
  Boxes,
  Grid3x3,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Search,
  Trash2,
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
  type ColmenaTubo,
  type ColmenaPano,
} from '@/modules/admin/colmena';

type SubTab = 'tubos' | 'panos';

export function Colmena() {
  const [sub, setSub] = useState<SubTab>('tubos');
  const tubos = useColmenaTubos();
  const panos = useColmenaPanos();

  const refrescar = () => {
    if (sub === 'tubos') tubos.refrescar();
    else panos.refrescar();
  };

  return (
    <div className="space-y-3">
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
