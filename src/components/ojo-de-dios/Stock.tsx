import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTelas } from '@/modules/admin/hooks';

export function Stock() {
  const { telas, loading, guardar, eliminar } = useTelas();
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    ancho_m: '',
    metros_disponibles: '',
    alerta_minimo: '10',
  });
  const [guardando, setGuardando] = useState(false);

  const onGuardar = async () => {
    const codigo = form.codigo.trim().toUpperCase();
    const nombre = form.nombre.trim();
    if (!codigo || !nombre) {
      toast.error('Completá el código y nombre de la tela');
      return;
    }
    setGuardando(true);
    try {
      await guardar({
        codigo,
        nombre,
        ancho_m: parseFloat(form.ancho_m) || 0,
        metros_disponibles: parseFloat(form.metros_disponibles) || 0,
        alerta_minimo: parseFloat(form.alerta_minimo) || 10,
      });
      toast.success(`Tela "${codigo}" guardada`);
      setForm({ codigo: '', nombre: '', ancho_m: '', metros_disponibles: '', alerta_minimo: '10' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar: ' + msg);
    } finally {
      setGuardando(false);
    }
  };

  const editar = (tela: (typeof telas)[number]) => {
    setForm({
      codigo: tela.codigo,
      nombre: tela.nombre,
      ancho_m: String(tela.ancho_m ?? ''),
      metros_disponibles: String(tela.metros_disponibles),
      alerta_minimo: String(tela.alerta_minimo),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Editando "${tela.codigo}" — modifica los valores y guarda`);
  };

  const onEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la tela "${nombre}" del inventario?`)) return;
    try {
      await eliminar(id);
      toast.success(`Tela "${nombre}" eliminada`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    }
  };

  const bajoStock = telas.filter(
    (t) => (t.metros_disponibles || 0) <= (t.alerta_minimo || 10),
  ).length;

  return (
    <div className="space-y-4">
      {/* Formulario */}
      <div className="rounded-lg border border-teal-500/30 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Plus className="h-4 w-4 text-teal-400" />
          <strong className="text-sm">Agregar / Actualizar Tela</strong>
        </div>
        <div className="grid gap-2 md:grid-cols-12">
          <div className="md:col-span-2">
            <Label className="text-[0.65rem]">Código</Label>
            <Input
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              placeholder="BL001"
              className="h-8 text-xs"
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-[0.65rem]">Nombre Tela</Label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Blackout Blanco 2.80m"
              className="h-8 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[0.65rem]">Ancho rollo (m)</Label>
            <Input
              type="number"
              value={form.ancho_m}
              onChange={(e) => setForm({ ...form, ancho_m: e.target.value })}
              placeholder="2.80"
              step="0.01"
              min={0}
              className="h-8 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[0.65rem]">Metros disponibles</Label>
            <Input
              type="number"
              value={form.metros_disponibles}
              onChange={(e) => setForm({ ...form, metros_disponibles: e.target.value })}
              placeholder="50.0"
              step="0.5"
              min={0}
              className="h-8 text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[0.65rem]">Alerta mínimo (m)</Label>
            <Input
              type="number"
              value={form.alerta_minimo}
              onChange={(e) => setForm({ ...form, alerta_minimo: e.target.value })}
              placeholder="10"
              step={1}
              min={0}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-end md:col-span-1">
            <Button
              onClick={onGuardar}
              disabled={guardando}
              className="h-8 w-full gap-1 bg-teal-600 hover:bg-teal-500"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Inventario */}
      <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-teal-400" />
            <strong className="text-sm">Inventario de Telas</strong>
          </div>
          <span className="text-xs text-zinc-400">
            {telas.length} telas ·{' '}
            {bajoStock > 0 ? (
              <span className="text-red-400">⚠️ {bajoStock} con stock bajo</span>
            ) : (
              <span className="text-emerald-400">Stock OK</span>
            )}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-900 text-[0.65rem] uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-left">Nombre</th>
                <th className="p-2 text-left">Ancho rollo</th>
                <th className="p-2 text-left">M disponibles</th>
                <th className="p-2 text-left">Estado stock</th>
                <th className="p-2 text-left">Actualizado</th>
                <th className="p-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    Cargando inventario...
                  </td>
                </tr>
              )}
              {!loading && telas.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    No hay telas en el inventario. Agregá la primera arriba.
                  </td>
                </tr>
              )}
              {telas.map((t) => {
                const m = Number(t.metros_disponibles || 0);
                const alerta = Number(t.alerta_minimo || 10);
                const bajo = m <= alerta;
                const fecha = t.fechaActualizacion ? t.fechaActualizacion.slice(0, 10) : '—';
                return (
                  <tr key={t.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="p-2">
                      <strong className="text-teal-400">{t.codigo}</strong>
                    </td>
                    <td className="p-2">{t.nombre}</td>
                    <td className="p-2 text-zinc-400">
                      {t.ancho_m ? `${t.ancho_m} m` : '—'}
                    </td>
                    <td className="p-2">
                      <strong>{m.toFixed(1)} m</strong>
                    </td>
                    <td className="p-2">
                      {bajo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[0.63rem] font-bold text-red-300">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Bajo stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.63rem] font-bold text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          OK
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-zinc-400">{fecha}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => editar(t)}
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 w-6 border-red-500/30 p-0 text-red-400 hover:bg-red-500/10"
                          onClick={() => onEliminar(t.id, t.nombre || t.codigo)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
