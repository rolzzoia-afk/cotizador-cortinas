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
  filasParaPlantilla,
  filasEjemplo,
  INSTRUCCIONES_IMPORTACION,
  type DiffCatalogo,
  type FilaCatalogo,
} from '@/modules/cotizador/importarCatalogo';

interface ImportarCatalogoDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

const clp = (n: number) => Math.round(n).toLocaleString('es-CL');
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/** Chip pequeño de categoría de tela (A verde / B ámbar). */
function ChipCategoria({ cat }: { cat: string | null | undefined }) {
  if (!cat) return null;
  const tono =
    cat === 'B'
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400';
  return (
    <span className={`rounded border px-1 text-[10px] font-bold leading-4 ${tono}`}>{cat}</span>
  );
}

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
        toast.error('No se encontró una hoja ("Productos" o "DEPURADA") con columna COD_INT.');
        setDiff(null);
        return;
      }
      const d = diffCatalogo(catalogo, parsed);
      setDiff(d);
      setHayPorcentajes(parsed.some((f) => f.descuentoEraPorcentaje));
      setOkNuevos(new Set(d.nuevos.map((n) => n.codInt)));
      setOkCambios(new Set(d.cambios.map((c) => c.codInt)));
    } catch (e) {
      toast.error('No se pudo leer el Excel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  };

  /**
   * Baja el catálogo actual en Excel para editarlo y volver a subirlo. Es el
   * camino para cambiarle el % a muchas telas de una vez sin teclear los
   * códigos a mano ni arriesgarse a escribirlos mal.
   */
  const descargarPlantilla = () => {
    const ws = XLSX.utils.json_to_sheet(filasParaPlantilla(catalogo, anchoRollo));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'catalogo-cortinas-rolzzo.xlsx');
    toast.success('Plantilla descargada. Edita la columna DESCUENTO % y vuelve a subirla.');
  };

  /**
   * El archivo de ejemplo: pocas filas y una hoja que explica las reglas. Es
   * para aprender el formato y para probar — subirlo sin editarlo no cambia
   * nada, porque los valores son los que el catálogo ya tiene.
   */
  const descargarEjemplo = () => {
    const wb = XLSX.utils.book_new();
    const instr = XLSX.utils.aoa_to_sheet(INSTRUCCIONES_IMPORTACION);
    instr['!cols'] = [{ wch: 20 }, { wch: 82 }, { wch: 30 }];
    // Va primera para que el archivo abra en las instrucciones; el importador
    // igual busca «Productos» por NOMBRE, así que el orden no lo confunde.
    XLSX.utils.book_append_sheet(wb, instr, 'Instrucciones');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(filasEjemplo(catalogo, anchoRollo)),
      'Productos',
    );
    XLSX.writeFile(wb, 'ejemplo-importar-catalogo.xlsx');
    toast.success('Ejemplo descargado. Súbelo tal cual: no cambia nada hasta que edites un valor.');
  };

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const total = okNuevos.size + okCambios.size;
  const [hayPorcentajes, setHayPorcentajes] = useState(false);

  const aceptados = useMemo<FilaCatalogo[]>(() => {
    if (!diff) return [];
    const de = [
      ...diff.nuevos.filter((n) => okNuevos.has(n.codInt)),
      ...diff.cambios.filter((c) => okCambios.has(c.codInt)).map((c) => ({
        codInt: c.codInt,
        producto: c.producto,
        anchoRollo: c.anchoRollo,
        // `campos` tiene que viajar: es lo que impide que una planilla de solo
        // descuentos borre el producto y la descripción de cada código.
        campos: c.campos,
      })),
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
      await guardarCatalogoProductos(empresaId, nuevoCat, 'antes de importar el Excel del catálogo');
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
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">¿Es la primera vez?</strong> Baja el ejemplo:
                  son pocas filas y trae una hoja que explica el formato. Súbelo tal cual para
                  probar —no cambia nada— y después edita un valor para ver cómo se ve el cambio.
                </p>
                <Button variant="outline" size="sm" onClick={descargarEjemplo}>
                  Descargar ejemplo
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  ¿Vas a cambiarle el <strong className="text-foreground">descuento</strong> a
                  varias telas? Baja el catálogo completo, edita la columna{' '}
                  <strong>DESCUENTO %</strong> y vuelve a subir el archivo.
                </p>
                <Button variant="outline" size="sm" onClick={descargarPlantilla}>
                  Descargar plantilla
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-1 text-xs">Archivo Excel (hoja «Productos» o «DEPURADA»)</Label>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
            />
            {nombreArchivo && (
              <p className="mt-1 text-[11px] text-muted-foreground">{nombreArchivo}</p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              Basta con <strong>COD_INT</strong> y las columnas que quieras cambiar: lo que el
              archivo no traiga se deja como está. El descuento se acepta como 30 o como 0,3.
            </p>
          </div>

          {parsing && <p className="py-4 text-center text-sm text-muted-foreground">Leyendo…</p>}

          {diff && (
            <>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{diff.nuevos.length}</strong> nuevo(s) ·{' '}
                <strong className="text-foreground">{diff.cambios.length}</strong> con cambios ·{' '}
                {diff.sinCambio} sin cambios. Desmarca lo que no quieras aplicar.
              </p>

              {/* Un «30» en la planilla se lee como 30 %, no como 3.000 %. Se
                  avisa porque es una interpretación, no un dato. */}
              {hayPorcentajes && (
                <p className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-[11px] text-muted-foreground">
                  Los descuentos venían en porcentaje (30, 25…) y se leyeron como 30 %, 25 %.
                  Revísalos abajo antes de aplicar.
                </p>
              )}

              {/* Códigos que la planilla nombra pero no se pueden crear. */}
              {diff.ignorados.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-[11px]">
                  <p className="font-semibold">
                    {diff.ignorados.length} código(s) del archivo quedaron fuera:
                  </p>
                  <ul className="ml-4 list-disc">
                    {diff.ignorados.slice(0, 6).map((x) => (
                      <li key={x.codInt}>
                        <strong>{x.codInt}</strong>: {x.motivo}
                      </li>
                    ))}
                    {diff.ignorados.length > 6 && <li>…y {diff.ignorados.length - 6} más.</li>}
                  </ul>
                </div>
              )}

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
                          <ChipCategoria cat={n.producto.categoria} />
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
                          <span className="flex w-16 shrink-0 items-center gap-1">
                            {c.cambiaCategoria ? (
                              <>
                                {c.categoriaVieja ? (
                                  <ChipCategoria cat={c.categoriaVieja} />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                                <span className="text-[10px] text-muted-foreground">→</span>
                                <ChipCategoria cat={c.categoriaNueva} />
                              </>
                            ) : (
                              <ChipCategoria cat={c.categoriaVieja} />
                            )}
                          </span>
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
                          {/* El costo casi nunca cambia, pero si no se muestra
                              la fila aparece sin ningún motivo a la vista. */}
                          <span
                            className={
                              'w-40 text-right ' +
                              (c.cambiaCosto ? 'text-amber-300' : 'text-muted-foreground')
                            }
                            title="Costo por metro"
                          >
                            {c.cambiaCosto
                              ? `${clp(c.costoViejo)} → ${clp(c.costoNuevo)}`
                              : c.costoViejo
                                ? clp(c.costoViejo)
                                : '—'}
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
