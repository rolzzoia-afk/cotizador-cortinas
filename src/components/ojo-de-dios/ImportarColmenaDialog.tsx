// Importa la zona ROLZZO desde el Excel del galpón (hoja "COLMENA GALPON
// (ROLZZO) V-1.1"). Muestra una VISTA PREVIA de los paños NUEVOS a agregar
// (los que están en la hoja y no en el sistema) con checkbox por fila; nada se
// escribe sin confirmar. Reconciliación ADITIVA: no da de baja nada.
// Ver reglas en src/modules/telas/importarRolzzo.ts.
//
// La grilla GALPÓN (src/modules/telas/importarMapa.ts) quedó lista pero se
// integrará en una ronda posterior (decisión del usuario 2026-07-13).

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { cargarTodosLosPanos } from '@/modules/admin/colmena';
import {
  parsearRolzzoExcel,
  diffRolzzo,
  planRolzzo,
  type DiffRolzzo,
} from '@/modules/telas/importarRolzzo';
import { ejecutarPlanMapa, type ClienteMapa } from '@/modules/telas/importarMapaEjecutar';

interface Props {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const cm = (v: number | null) => (v == null ? '—' : String(v));

export default function ImportarColmenaDialog({ onClose, onSaved }: Props) {
  const { empresaId } = useAuth();
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [diff, setDiff] = useState<DiffRolzzo | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file || !empresaId) return;
    setParsing(true);
    setNombreArchivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parseo = parsearRolzzoExcel(wb);
      if (parseo.filas.length === 0) {
        toast.error(
          parseo.advertencias[0] ?? 'No se encontró la hoja ROLZZO en el archivo.',
        );
        setDiff(null);
        return;
      }
      const panos = await cargarTodosLosPanos(empresaId);
      const d = diffRolzzo(panos, parseo);
      setDiff(d);
      setSel(new Set(d.nuevos.map((_, i) => i))); // todos los nuevos marcados
    } catch (e) {
      toast.error('No se pudo leer el Excel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  };

  const toggle = (i: number) => {
    const next = new Set(sel);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSel(next);
  };

  const aplicar = async () => {
    if (!empresaId || !diff || sel.size === 0) return;
    setSaving(true);
    try {
      const plan = planRolzzo(diff, sel, { empresaId, ahoraISO: new Date().toISOString() });
      const res = await ejecutarPlanMapa(supabase as unknown as ClienteMapa, plan);
      if (res.errores.length === 0) {
        toast.success(`ROLZZO actualizada: ${res.insertados} paño(s) agregado(s).`);
        await onSaved();
        onClose();
      } else {
        toast.warning(
          `Agregados ${res.insertados}. Fallaron ${res.errores.length}: ${res.errores[0].detalle}`,
        );
        await onSaved();
      }
    } catch (e) {
      toast.error('No se pudo aplicar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const porPrefijo = useMemo(() => {
    if (!diff) return [] as { pref: string; n: number }[];
    const c = new Map<string, number>();
    for (const f of diff.nuevos) {
      const k = (f.ubicacion.match(/^[A-Z]+/) ?? ['?'])[0];
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return Array.from(c.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pref, n]) => ({ pref, n }));
  }, [diff]);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Importar colmena ROLZZO</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1 text-xs">
              Excel del galpón (hoja «COLMENA GALPON (ROLZZO) V-1.1»)
            </Label>
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
              <div className="text-xs text-muted-foreground">
                Hoja «{diff.hoja}» ·{' '}
                <strong className="text-emerald-400">{diff.nuevos.length}</strong> nuevos para agregar ·{' '}
                <strong className="text-foreground">{diff.yaEnSistema}</strong> ya en el sistema ·{' '}
                {diff.soloEnSistema} en el sistema que no están en la hoja (no se tocan).
                {porPrefijo.length > 0 && (
                  <span className="ml-1">
                    Nuevos por sector: {porPrefijo.map((p) => `${p.pref}(${p.n})`).join(' ')}
                  </span>
                )}
              </div>

              {diff.advertencias.length > 0 && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  {diff.advertencias.slice(0, 4).map((a, i) => (
                    <div key={i}>⚠ {a}</div>
                  ))}
                  {diff.advertencias.length > 4 && <div>…y {diff.advertencias.length - 4} más.</div>}
                </div>
              )}

              {diff.nuevos.length > 0 ? (
                <section>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Paños nuevos ({sel.size}/{diff.nuevos.length})
                    </span>
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground underline"
                      onClick={() =>
                        setSel(
                          sel.size === diff.nuevos.length
                            ? new Set()
                            : new Set(diff.nuevos.map((_, i) => i)),
                        )
                      }
                    >
                      {sel.size === diff.nuevos.length ? 'Ninguno' : 'Todos'}
                    </button>
                  </div>
                  <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
                    {diff.nuevos.map((f, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs last:border-0"
                      >
                        <input type="checkbox" checked={sel.has(i)} onChange={() => toggle(i)} />
                        <span className="w-16 shrink-0 text-muted-foreground">{f.ubicacion}</span>
                        <span className="w-16 shrink-0 font-bold">{f.codigo}</span>
                        <span className="text-muted-foreground">
                          {cm(f.ancho)} × {cm(f.alto)} cm
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              ) : (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Todo lo de la hoja ya está en el sistema. Nada que agregar.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={saving || sel.size === 0} className="gap-1">
            <Upload className="h-3.5 w-3.5" />
            {saving ? 'Agregando…' : `Agregar ${sel.size} paño(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
