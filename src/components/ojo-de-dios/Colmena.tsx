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
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmar } from '@/components/ui/confirm';
import {
  useColmenaTubos,
  useColmenaPanos,
  useInventario,
  validarMedidaCm,
  type ColmenaTubo,
  type ColmenaPano,
} from '@/modules/admin/colmena';
import ImportarColmenaDialog from '@/components/ojo-de-dios/ImportarColmenaDialog';
import { InventarioPanel } from '@/pages/inventario/conteo/ConteoTubosAdmin';

type SubTab = 'tubos' | 'panos';

/** Formatea una medida en cm sin ceros sobrantes (178.0 → "178 cm", 119.6 → "119,6 cm"). */
function fmtCm(v: number): string {
  return Number(v).toFixed(1).replace(/\.0$/, '').replace('.', ',') + ' cm';
}

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

      <div className="rounded-lg border border-success/30 bg-card/40 p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSub('tubos')}
            className={cn(
              'flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium transition',
              sub === 'tubos'
                ? 'border-success/30 bg-success/15 text-success'
                : 'border-success/30 bg-success/15 text-success/60 hover:bg-success/15',
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
                ? 'border-accent/40 bg-accent/20 text-accent'
                : 'border-accent/20 bg-accent/5 text-accent/60 hover:bg-accent/10',
            )}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Paños de Tela
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={refrescar}
            className="ml-auto h-8 gap-1 border-success/30 text-success"
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
    if (!await confirmar(`¿Eliminar tubo "${t.cod}" de colmena ${t.n_colmena}?\n\nNo se puede deshacer.`))
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
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
            className="h-8 gap-1 bg-success hover:bg-success/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{tubos.length} tubo(s) en inventario</div>

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

      <div className="max-h-[420px] overflow-y-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
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
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Cargando tubos...
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Sin tubos para mostrar.
                </td>
              </tr>
            )}
            {filtrados.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-card">
                <td className="p-2 font-semibold text-success">{t.n_colmena || '—'}</td>
                <td className="p-2 font-mono text-foreground">{t.cod || '—'}</td>
                <td className="p-2 text-foreground">
                  {t.medida_cm ? Number(t.medida_cm).toFixed(1) + ' cm' : '—'}
                </td>
                <td className="p-2 font-mono text-muted-foreground">{t.serial || '—'}</td>
                <td className="p-2 text-[0.68rem]">
                  {t.agregado_por_admin ? (
                    <span className="text-warning">✔ Admin</span>
                  ) : (
                    <span className="text-muted-foreground">Auto</span>
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
                      className="h-6 w-6 border-destructive/30 p-0 text-destructive hover:bg-destructive/15"
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
    const errMedida = validarMedidaCm(medN);
    if (errMedida) return toast.error(errMedida);
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
    <div className="mb-3 rounded-lg border border-success/30 bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-success">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          {tubo ? 'Editar tubo' : 'Nuevo tubo'}
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
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
            Procedencia <span className="text-muted-foreground">(de dónde viene)</span>
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
          className="h-8 gap-1 bg-success hover:bg-success/90"
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
  const [importando, setImportando] = useState(false);

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
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
            className="h-8 rounded border border-border bg-card px-2 text-xs text-foreground"
          >
            <option value="">Todos</option>
            <option value="true">Disponibles</option>
            <option value="false">Usados</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportando(true)}
            className="h-8 gap-1 border-accent/40 text-accent hover:bg-accent/10"
            title="Importar la colmena (GALPÓN + LIBERADO + ROLZZO) desde el Excel del galpón"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar colmena
          </Button>
        </div>
      </div>

      {importando && (
        <ImportarColmenaDialog onClose={() => setImportando(false)} onSaved={ctx.refrescar} />
      )}
      <div className="mb-2 text-xs text-muted-foreground">
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

      <div className="max-h-[420px] overflow-y-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Código</th>
              <th className="p-2 text-left">Ancho (cm)</th>
              <th className="p-2 text-left">Alto (cm)</th>
              <th className="p-2 text-left">Estado</th>
              <th className="p-2 text-left">OT</th>
              <th className="p-2 text-left">Fecha uso</th>
              <th className="p-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Cargando paños...
                </td>
              </tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  Sin paños para mostrar.
                </td>
              </tr>
            )}
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-card">
                <td className="p-2 font-mono text-foreground">{p.codigo || '—'}</td>
                <td className="p-2 text-foreground">
                  {p.medida_ancho != null ? fmtCm(p.medida_ancho) : '—'}
                </td>
                <td className="p-2 text-foreground">
                  {p.medida_alto != null ? fmtCm(p.medida_alto) : '—'}
                </td>
                <td className="p-2">
                  {p.disponible ? (
                    <span className="text-success">● Disponible</span>
                  ) : (
                    <span className="text-warning">● Usado</span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">{p.ot_asignada || '—'}</td>
                <td className="p-2 text-[0.68rem] text-muted-foreground">
                  {p.fecha_uso ? p.fecha_uso.slice(0, 10) : '—'}
                </td>
                <td className="p-2 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 border-accent/30 p-0 text-accent hover:bg-accent/10"
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
    <div className="mb-3 rounded-lg border border-accent/35 bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-accent">
          <Pencil className="mr-1 inline h-3.5 w-3.5" />
          Editar paño
        </strong>
        <button
          onClick={onCancel}
          className="rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
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
          <Label className="text-[0.65rem]">Ancho (cm)</Label>
          <Input
            type="number"
            value={ancho}
            onChange={(e) => setAncho(e.target.value)}
            step="0.1"
            placeholder="178"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Alto (cm)</Label>
          <Input
            type="number"
            value={alto}
            onChange={(e) => setAlto(e.target.value)}
            step="0.1"
            placeholder="200"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <Label className="text-[0.65rem]">Estado</Label>
          <select
            value={disponible ? 'true' : 'false'}
            onChange={(e) => setDisponible(e.target.value === 'true')}
            className="h-8 w-full rounded border border-border bg-card px-2 text-xs text-foreground"
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
          className="h-8 gap-1 bg-accent hover:bg-accent"
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
