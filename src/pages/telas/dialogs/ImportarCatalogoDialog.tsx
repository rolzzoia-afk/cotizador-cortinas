// Importación masiva del catálogo del cotizador desde el Excel maestro (hoja
// "Productos"). Muestra un PREVIEW (códigos nuevos + cambios de precio/dcto) con
// checkbox por fila; nada se escribe sin confirmar. Al aceptar, fusiona sobre el
// catálogo actual (configuracion → catalogo_productos_data + ancho_rollo_data).

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';
import {
  useCatalogoProductos,
  useAnchoRollo,
  guardarCatalogoProductos,
  guardarAnchoRollo,
} from '@/modules/cotizador/catalogo';
import {
  parsearCatalogoExcel,
  diffCatalogo,
  aplicarCatalogo,
  type DiffCatalogo,
  type FilaCatalogo,
} from '@/modules/cotizador/importarCatalogo';

interface ImportarCatalogoDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

const clp = (n: number) => Math.round(n).toLocaleString('es-CL');
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function ImportarCatalogoDialog({ onClose, onSaved }: ImportarCatalogoDialogProps) {
  const { empresaId } = useAuth();
  const { catalogo, refresh } = useCatalogoProductos();
  const { anchoRollo } = useAnchoRollo();

  const [nombreArchivo, setNombreArchivo] = useState('');
  const [diff, setDiff] = useState<DiffCatalogo | null>(null);
  const [okNuevos, setOkNuevos] = useState<Set<string>>(new Set());
  const [okCambios, setOkCambios] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setNombreArchivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parsed = parsearCatalogoExcel(wb);
      if (parsed.length === 0) {
        toast.error('No se encontró la hoja "Productos" con columnas COD_INT / Precio de Venta.');
        setDiff(null);
        return;
      }
      const d = diffCatalogo(catalogo, parsed);
      setDiff(d);
      setOkNuevos(new Set(d.nuevos.map((n) => n.codInt)));
      setOkCambios(new Set(d.cambios.map((c) => c.codInt)));
    } catch (e) {
      toast.error('No se pudo leer el Excel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const total = okNuevos.size + okCambios.size;

  const aceptados = useMemo<FilaCatalogo[]>(() => {
    if (!diff) return [];
    const de = [
      ...diff.nuevos.filter((n) => okNuevos.has(n.codInt)),
      ...diff.cambios
        .filter((c) => okCambios.has(c.codInt))
        .map((c) => ({ codInt: c.codInt, producto: c.producto, anchoRollo: c.anchoRollo })),
    ];
    return de;
  }, [diff, okNuevos, okCambios]);

  const guardar = async () => {
    if (!empresaId || aceptados.length === 0) return;
    setSaving(true);
    try {
      const { catalogo: nuevoCat, anchoRollo: nuevoAncho } = aplicarCatalogo(
        catalogo,
        anchoRollo,
        aceptados,
      );
      await guardarCatalogoProductos(empresaId, nuevoCat);
      await guardarAnchoRollo(empresaId, nuevoAncho);
      await refresh();
      toast.success(`Catálogo actualizado: ${aceptados.length} código(s).`);
      onSaved();
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Importar catálogo desde Excel</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1 text-xs">Archivo Excel (hoja «Productos»)</Label>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
            />
            {nombreArchivo && (
              <p className="mt-1 text-[11px] text-muted-foreground">{nombreArchivo}</p>
            )}
          </div>

          {parsing && <p className="py-4 text-center text-sm text-muted-foreground">Leyendo…</p>}

          {diff && (
            <>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{diff.nuevos.length}</strong> nuevo(s) ·{' '}
                <strong className="text-foreground">{diff.cambios.length}</strong> con cambios ·{' '}
                {diff.sinCambio} sin cambios. Desmarca lo que no quieras aplicar.
              </p>

              <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto">
                {/* Nuevos */}
                {diff.nuevos.length > 0 && (
                  <section>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Códigos nuevos ({okNuevos.size}/{diff.nuevos.length})
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline"
                        onClick={() =>
                          setOkNuevos(
                            okNuevos.size === diff.nuevos.length
                              ? new Set()
                              : new Set(diff.nuevos.map((n) => n.codInt)),
                          )
                        }
                      >
                        {okNuevos.size === diff.nuevos.length ? 'Ninguno' : 'Todos'}
                      </button>
                    </div>
                    <div className="rounded-lg border border-border">
                      {diff.nuevos.map((n) => (
                        <label
                          key={n.codInt}
                          className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={okNuevos.has(n.codInt)}
                            onChange={() => toggle(okNuevos, n.codInt, setOkNuevos)}
                          />
                          <span className="w-20 shrink-0 font-bold">{n.codInt}</span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {n.producto.producto} · {n.producto.tipo}
                          </span>
                          <span className="w-20 text-right">{clp(n.producto.precio)}</span>
                          <span className="w-12 text-right text-muted-foreground">
                            {pct(n.producto.descuento || 0)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                {/* Cambios */}
                {diff.cambios.length > 0 && (
                  <section>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Cambios en existentes ({okCambios.size}/{diff.cambios.length})
                      </span>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline"
                        onClick={() =>
                          setOkCambios(
                            okCambios.size === diff.cambios.length
                              ? new Set()
                              : new Set(diff.cambios.map((c) => c.codInt)),
                          )
                        }
                      >
                        {okCambios.size === diff.cambios.length ? 'Ninguno' : 'Todos'}
                      </button>
                    </div>
                    <div className="rounded-lg border border-border">
                      {diff.cambios.map((c) => (
                        <label
                          key={c.codInt}
                          className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={okCambios.has(c.codInt)}
                            onChange={() => toggle(okCambios, c.codInt, setOkCambios)}
                          />
                          <span className="w-20 shrink-0 font-bold">{c.codInt}</span>
                          <span
                            className={
                              'w-40 text-right ' +
                              (c.cambiaPrecio ? 'text-amber-300' : 'text-muted-foreground')
                            }
                          >
                            {c.cambiaPrecio
                              ? `${clp(c.precioViejo)} → ${clp(c.precioNuevo)}`
                              : clp(c.precioViejo)}
                          </span>
                          <span
                            className={
                              'w-24 text-right ' +
                              (c.cambiaDescuento ? 'text-amber-300' : 'text-muted-foreground')
                            }
                          >
                            {c.cambiaDescuento
                              ? `${pct(c.descuentoViejo)} → ${pct(c.descuentoNuevo)}`
                              : pct(c.descuentoViejo)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={saving || total === 0}>
            {saving ? 'Guardando…' : `Aplicar ${total} cambio(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
