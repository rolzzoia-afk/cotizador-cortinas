import { useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, RotateCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Tubo = {
  cod: string;
  medida_cm: number;
  n_colmena: string;
  medida_mm: number;
};

type ResultadoBaseline = {
  baseline_id: string;
  tubos_actuales_cerrados: number;
  tubos_perdidos_cerrados: number;
  tubos_insertados: number;
  generado_en: string;
};

// Parser que recorre toda la hoja Excel buscando tripletas (CODIGO, MEDIDA, COLMENA).
// Tolerante al formato real del operario: múltiples bloques repartidos por la hoja,
// algunos con header CODIGO/MEDIDA/COLMENA y otros sin header. Funciona con coma
// o punto como separador decimal. Deduplica filas idénticas. Saltea filas-encabezado.
const PALABRAS_HEADER = new Set([
  'CODIGO', 'CÓDIGO', 'COD', 'MEDIDA', 'COLMENA', 'CM', 'MM', 'POSICION', 'POSICIÓN',
]);

const pareceCodigo = (s: string): boolean => {
  const t = s.trim().toUpperCase();
  if (!t || t.length > 20) return false;
  if (PALABRAS_HEADER.has(t)) return false;
  if (/\s/.test(t)) return false;
  return /[A-Z]/.test(t) && /[0-9]/.test(t);
};

const pareceMedida = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 2000) return null;
  return n;
};

const pareceColmena = (s: string): boolean => {
  const t = s.trim().toUpperCase();
  if (!t || t.length > 10) return false;
  if (PALABRAS_HEADER.has(t)) return false;
  if (/\s/.test(t)) return false;
  return /[A-Z]/.test(t) && /[0-9]/.test(t);
};

function parsearExcel(file: File): Promise<Tubo[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Archivo vacío');
        const wb = XLSX.read(data, { type: 'array' });
        if (wb.SheetNames.length === 0) {
          throw new Error('No se encontró hoja en el Excel');
        }

        const tubos: Tubo[] = [];
        const visto = new Set<string>();

        // Recorrer TODAS las hojas del workbook (el Excel del operario suele tener
        // los códigos repartidos en varias pestañas, no en una sola).
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            raw: false,
            defval: '',
          });

          for (let r = 0; r < grid.length; r++) {
            const row = grid[r] || [];
            for (let c = 0; c < row.length - 2; c++) {
              const a = String(row[c] ?? '').trim();
              const b = String(row[c + 1] ?? '').trim();
              const d = String(row[c + 2] ?? '').trim();

              const medida = pareceMedida(b);
              if (medida === null) continue;
              if (!pareceCodigo(a)) continue;
              if (!pareceColmena(d)) continue;

              const cod = a.toUpperCase();
              const colmena = d.toUpperCase();
              const key = `${cod}|${colmena}|${medida}`;
              if (visto.has(key)) continue;
              visto.add(key);
              tubos.push({
                cod,
                medida_cm: medida,
                n_colmena: colmena,
                medida_mm: Math.round(medida * 10),
              });
            }
          }
        }
        resolve(tubos);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

export function InventoryBaselineSection() {
  const [tubos, setTubos] = useState<Tubo[]>([]);
  const [parseando, setParseando] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoBaseline | null>(null);
  const [errorParse, setErrorParse] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseando(true);
    setErrorParse(null);
    setResultado(null);
    try {
      const parsed = await parsearExcel(file);
      if (parsed.length === 0) {
        setErrorParse(
          'No se encontró ningún tubo. El parser busca tripletas (código, medida, colmena) donde el código y la colmena tengan letras+números (ej: E62, A28) y la medida sea un número entre 0 y 2000. Revisa que las columnas estén contiguas.',
        );
      }
      setTubos(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error parseando archivo';
      setErrorParse(msg);
      setTubos([]);
    } finally {
      setParseando(false);
      // Reset input para permitir re-upload del mismo archivo después
      e.target.value = '';
    }
  };

  const resumenPorCod = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tubos) m[t.cod] = (m[t.cod] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [tubos]);

  const ejecutarBaseline = async () => {
    setEjecutando(true);
    try {
      const { data, error } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'cargar_inventario_baseline' as any,
        { p_tubos: tubos },
      );
      if (error) {
        const parts = [error.message, error.code, error.details].filter(Boolean).join(' · ');
        throw new Error(parts || JSON.stringify(error));
      }
      setResultado(data as ResultadoBaseline);
      setTubos([]);
      setConfirmOpen(false);
      toast.success('Baseline cargado correctamente');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[baseline] error:', err);
      toast.error('No se pudo cargar baseline: ' + msg);
    } finally {
      setEjecutando(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Cargar inventario base desde Excel
        </h2>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Reseteo completo del inventario de tubos a partir de un Excel del conteo físico. Cierra
        formalmente todos los tubos actuales (incluidos perdidos pre-existentes) y los reemplaza
        por los del archivo, generando un evento INGRESO para cada uno. Esto deja la base de
        reconciliación en cero.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
          <Upload className="h-3.5 w-3.5" />
          {parseando ? 'Parseando...' : 'Seleccionar Excel'}
          <input
            type="file"
            accept=".xlsx,.xls,.xlsm"
            onChange={handleFile}
            disabled={parseando || ejecutando}
            className="hidden"
          />
        </label>
        {tubos.length > 0 && (
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={ejecutando}
            variant="default"
            size="sm"
            className="gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Cargar baseline ({tubos.length} tubos)
          </Button>
        )}
      </div>

      {errorParse && (
        <div className="mt-3 flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div>{errorParse}</div>
        </div>
      )}

      {tubos.length > 0 && (
        <div className="mt-4 rounded-md border bg-background p-3">
          <div className="mb-2 text-xs font-semibold">
            Preview: {tubos.length} tubos detectados ({resumenPorCod.length} códigos distintos)
          </div>
          <div className="grid grid-cols-2 gap-1 text-[0.7rem] md:grid-cols-4">
            {resumenPorCod.map(([cod, n]) => (
              <div key={cod} className="flex justify-between rounded bg-muted/50 px-2 py-1">
                <span className="font-mono font-semibold">{cod}</span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resultado && (
        <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
          <div className="mb-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
            Baseline aplicado
          </div>
          <div className="space-y-0.5 text-emerald-700 dark:text-emerald-300/90">
            <div>Baseline ID: <span className="font-mono">{resultado.baseline_id}</span></div>
            <div>Tubos actuales cerrados: {resultado.tubos_actuales_cerrados}</div>
            <div>Tubos perdidos cerrados: {resultado.tubos_perdidos_cerrados}</div>
            <div>Tubos insertados: {resultado.tubos_insertados}</div>
          </div>
          <div className="mt-2 text-emerald-700/80 dark:text-emerald-300/70">
            Refresca el dashboard de Reconciliación: fantasmas y perdidos deben volver a 0.
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(o) => !ejecutando && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar reseteo de inventario
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <span className="block">
                Vas a reemplazar TODO el inventario actual de tubos por el contenido del Excel.
              </span>
              <span className="block">
                <strong>{tubos.length}</strong> tubos del archivo serán insertados con UUIDs frescos
                y un evento INGRESO cada uno.
              </span>
              <span className="block">
                Todos los tubos actuales (incluyendo perdidos pre-existentes) se cerrarán con un
                evento eliminado etiquetado como baseline. La trazabilidad histórica se preserva.
              </span>
              <span className="block font-semibold text-destructive">
                Esta operación no se puede deshacer fácilmente. Solo ejecutar fuera de horario
                productivo, sin cortes en curso.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={ejecutando}
            >
              Cancelar
            </Button>
            <Button onClick={ejecutarBaseline} disabled={ejecutando}>
              {ejecutando ? 'Aplicando baseline...' : `Confirmar y resetear (${tubos.length} tubos)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
