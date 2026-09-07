// ─────────────────────────────────────────────────────────────────────
// Admin → Términos → «Importar desde planilla».
//
// Sube el .xlsm de una cotización y carga sus términos de una: son ~27
// párrafos largos y pegarlos de a uno es media tarde. Muestra TODO lo que
// encontró con un check por término (a veces sobra alguno) y deja elegir a qué
// grupo van y si reemplazan lo que había o se agregan al final.
//
// No guarda nada por su cuenta: escribe en el borrador de `TerminosSection`,
// que se aplica con «Guardar términos». Así se puede revisar antes.
// ─────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { parsearTerminosExcel } from '@/modules/cotizador/importarTerminosExcel';
import { claveTermino, type GrupoTerminos } from '@/modules/cotizador/terminos';

type Props = {
  grupos: GrupoTerminos[];
  onClose: () => void;
  /** Aplica los términos elegidos al grupo indicado ('' = grupo nuevo). */
  onImportar: (destino: string, terminos: string[], modo: 'reemplazar' | 'agregar') => void;
};

const GRUPO_NUEVO = '';

export default function ImportarTerminosDialog({ grupos, onClose, onImportar }: Props) {
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [hoja, setHoja] = useState('');
  const [leidos, setLeidos] = useState<string[]>([]);
  const [excluidos, setExcluidos] = useState<Set<number>>(new Set());
  const [destino, setDestino] = useState<string>(GRUPO_NUEVO);
  const [modo, setModo] = useState<'reemplazar' | 'agregar'>('reemplazar');
  const [leyendo, setLeyendo] = useState(false);

  const elegidos = useMemo(
    () => leidos.filter((_, i) => !excluidos.has(i)),
    [leidos, excluidos],
  );

  /** Los que ya están en el grupo destino: se marcan para no repetirlos. */
  const yaEstan = useMemo(() => {
    const g = grupos.find((x) => x.id === destino);
    return new Set((g?.terminos ?? []).map(claveTermino));
  }, [grupos, destino]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLeyendo(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false });
      const r = parsearTerminosExcel(wb);
      if (!r) {
        toast.error(
          'No se encontró el bloque «TÉRMINOS Y CONDICIONES» en esa planilla. ' +
            '¿Es el archivo de cotización?',
        );
        return;
      }
      setNombreArchivo(file.name);
      setHoja(r.hoja);
      setLeidos(r.terminos);
      setExcluidos(new Set());
      toast.success(`${r.terminos.length} términos leídos de «${r.hoja}».`);
    } catch (e) {
      toast.error('No se pudo leer el archivo: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLeyendo(false);
    }
  };

  const aplicar = () => {
    if (!elegidos.length) return;
    onImportar(destino, elegidos, modo);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar términos desde una planilla</DialogTitle>
          <DialogDescription>
            Sube el .xlsm de cualquier cotización: se leen los términos del bloque «TÉRMINOS Y
            CONDICIONES» tal como están escritos ahí. Nada se guarda hasta que presiones «Guardar
            términos» en la pantalla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-xs">
            <span className="mb-1 block text-muted-foreground">Planilla de cotización</span>
            <input
              type="file"
              accept=".xlsm,.xlsx,.xls"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-xs file:mr-2 file:rounded file:border file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
            {nombreArchivo && (
              <span className="mt-1 block text-[0.7rem] text-muted-foreground">
                {nombreArchivo} · hoja «{hoja}» · {leidos.length} términos
              </span>
            )}
            {leyendo && <span className="mt-1 block text-[0.7rem]">Leyendo…</span>}
          </label>

          {leidos.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <label>
                  <span className="mb-1 block text-muted-foreground">Van al grupo</span>
                  <select
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className="h-8 w-56 rounded-md border border-input bg-background px-1 text-xs"
                  >
                    <option value={GRUPO_NUEVO}>— Grupo nuevo («Importados») —</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre} ({g.terminos.length})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-muted-foreground">Qué hacer con los que ya hay</span>
                  <select
                    value={modo}
                    onChange={(e) => setModo(e.target.value as 'reemplazar' | 'agregar')}
                    disabled={destino === GRUPO_NUEVO}
                    className="h-8 w-64 rounded-md border border-input bg-background px-1 text-xs disabled:opacity-50"
                  >
                    <option value="reemplazar">Reemplazarlos por estos</option>
                    <option value="agregar">Agregar al final, sin repetir</option>
                  </select>
                </label>
                <div className="ml-auto flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setExcluidos(new Set())}>
                    Marcar todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExcluidos(new Set(leidos.map((_, i) => i)))}
                  >
                    Ninguno
                  </Button>
                </div>
              </div>

              <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border p-2">
                {leidos.map((t, i) => {
                  const repetido = yaEstan.has(claveTermino(t));
                  return (
                    <label key={i} className="flex items-start gap-2 text-xs leading-snug">
                      <input
                        type="checkbox"
                        checked={!excluidos.has(i)}
                        onChange={(e) =>
                          setExcluidos((s) => {
                            const n = new Set(s);
                            if (e.target.checked) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        {t}
                        {repetido && (
                          <span className="ml-1 rounded bg-muted px-1 text-[0.65rem] text-muted-foreground">
                            ya está en ese grupo
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={!elegidos.length}>
            Cargar {elegidos.length || ''} término{elegidos.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
