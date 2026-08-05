// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo de descuentos de fabricación
//
// Sube el Excel "DESCUENTOS ROLLER CATALOGO" (el mismo que mantiene la
// jefa), lo valida, muestra un resumen y reemplaza el catálogo de la empresa
// vía RPC atómica.
//
// Desde 2026-08-04 el import RESPETA las filas editadas en Admin → Catálogo
// técnico (`origen = 'manual'`): antes borraba la tabla entera y se perdían
// el tubo E78, la vertical y la pletina en cada carga. Si la RPC v2 todavía
// no está en la base, cae a la v1 (que sí reemplaza todo) y lo avisa.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Ruler, Upload } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  parsearCatalogoDescuentos,
  type ResultadoParseo,
} from '@/modules/descuentos/importar-excel';

export function DescuentosCatalogoSection() {
  const { empresaId } = useAuth();
  const [enBd, setEnBd] = useState<{
    total: number;
    activos: number;
    /** null = la base todavía no tiene la columna `origen`. */
    manuales: number | null;
  } | null>(null);
  const [parseo, setParseo] = useState<ResultadoParseo | null>(null);
  const [importando, setImportando] = useState(false);

  const cargarEstado = async () => {
    if (!empresaId) return;
    // `origen` es de 2026-08-04: si el SQL todavía no se corrió, la query falla
    // y se cae al conteo simple.
    const conOrigen = await supabase
      .from('descuentos_modelo' as never)
      .select('activo, origen')
      .eq('empresa_id', empresaId);
    if (!conOrigen.error) {
      const filas = (conOrigen.data as unknown as { activo: boolean; origen: string }[]) ?? [];
      setEnBd({
        total: filas.length,
        activos: filas.filter((f) => f.activo).length,
        manuales: filas.filter((f) => f.origen === 'manual').length,
      });
      return;
    }
    const { data } = await supabase
      .from('descuentos_modelo' as never)
      .select('activo')
      .eq('empresa_id', empresaId);
    const filas = (data as unknown as { activo: boolean }[]) ?? [];
    setEnBd({ total: filas.length, activos: filas.filter((f) => f.activo).length, manuales: null });
  };

  useEffect(() => {
    cargarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const onArchivo = async (file: File | null) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const res = parsearCatalogoDescuentos(wb);
      if (res.filas.length === 0) {
        toast.error(res.errores[0] || 'No se encontraron modelos en el archivo.');
        return;
      }
      setParseo(res);
    } catch (e) {
      toast.error('No se pudo leer el archivo: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const confirmarImport = async () => {
    if (!parseo) return;
    setImportando(true);
    try {
      const v2 = await supabase.rpc('importar_descuentos_modelo_v2' as never, {
        p_filas: parseo.filas,
      } as never);

      if (!v2.error) {
        const r = v2.data as unknown as {
          antes: number;
          importadas: number;
          protegidas: number;
          omitidas: number;
        };
        const protegidas = r.protegidas
          ? ` Se respetaron ${r.protegidas} modelos editados en la app${
              r.omitidas ? ` (${r.omitidas} filas del Excel quedaron fuera por eso)` : ''
            }.`
          : '';
        toast.success(
          `Catálogo actualizado: ${r.importadas} modelos (antes había ${r.antes}).${protegidas}`,
        );
      } else {
        // La RPC v2 todavía no está en la base: se usa la vieja, que reemplaza todo.
        const { data, error } = await supabase.rpc('importar_descuentos_modelo' as never, {
          p_filas: parseo.filas,
        } as never);
        if (error) throw error;
        const r = data as unknown as { antes: number; importadas: number };
        toast.warning(
          `Catálogo REEMPLAZADO por completo: ${r.importadas} modelos (antes había ${r.antes}). ` +
            'Falta correr sql/20260804_catalogo_origen_import_v2.sql para que el import respete lo editado en la app.',
        );
      }
      setParseo(null);
      cargarEstado();
    } catch (e) {
      toast.error('Error al importar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImportando(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Ruler className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Catálogo de descuentos de fabricación
        </h2>
      </header>

      <p className="mb-3 text-xs text-muted-foreground">
        Carga masiva del catálogo desde el Excel «DESCUENTOS ROLLER CATALOGO». Reemplaza los modelos
        que vinieron de una carga anterior y <strong>respeta los que edites arriba</strong>, en
        Modelos de despiece.
        {enBd && (
          <>
            {' '}
            Hoy en el sistema: <strong>{enBd.total}</strong> modelos ({enBd.activos} activos
            {enBd.manuales !== null && `, ${enBd.manuales} editados en la app`}).
          </>
        )}
      </p>

      {enBd?.manuales === null && (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          Falta correr <code>sql/20260804_catalogo_origen_import_v2.sql</code>. Hasta entonces subir
          el Excel reemplaza el catálogo COMPLETO y se pierde lo editado en la app.
        </p>
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted">
        <Upload className="h-3.5 w-3.5" />
        Subir Excel del catálogo
        <input
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => {
            onArchivo(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
      </label>

      <Dialog open={!!parseo} onOpenChange={(o) => !o && setParseo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar importación del catálogo</DialogTitle>
            <DialogDescription>
              Se reemplazan los modelos que vinieron del Excel. Los que hayas editado en «Modelos de
              despiece» quedan como están.
            </DialogDescription>
          </DialogHeader>

          {parseo && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>{parseo.filas.length}</strong> modelos leídos ·{' '}
                <strong>{parseo.filas.filter((f) => f.activo).length}</strong> activos ·{' '}
                <strong>{parseo.sistemas.length}</strong> sistemas
              </p>
              <p className="text-xs text-muted-foreground">{parseo.sistemas.join(' · ')}</p>
              {parseo.errores.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
                  <p className="mb-1 font-semibold text-warning">
                    {parseo.errores.length} advertencia(s) — revisa antes de confirmar:
                  </p>
                  {parseo.errores.slice(0, 20).map((e, i) => (
                    <p key={i}>· {e}</p>
                  ))}
                  {parseo.errores.length > 20 && <p>… y {parseo.errores.length - 20} más.</p>}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setParseo(null)} disabled={importando}>
              Cancelar
            </Button>
            <Button onClick={confirmarImport} disabled={importando}>
              {importando ? 'Importando…' : 'Reemplazar catálogo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
