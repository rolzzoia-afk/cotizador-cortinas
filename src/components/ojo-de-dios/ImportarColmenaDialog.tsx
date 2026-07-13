// Importa la colmena desde el Excel del galpón en UNA subida:
//   • GALPÓN   — grilla "COLMENA DE PAÑOS (MAPA)". Reconciliación por posición
//     (SINCRONIZA: agrega, actualiza código/medida y da de baja). Medidas en la
//     NOTA de cada celda. Las bajas van con guard de borrado masivo.
//   • LIBERADO — bloques "LIBERADO RACK #N" de la MISMA hoja. Igual que GALPÓN
//     (sincroniza por posición), pero los códigos TACHADOS = usados no se
//     importan (se leen del XML crudo con fflate). Ver importarLiberado.ts.
//   • ROLZZO   — tabla "COLMENA GALPON (ROLZZO) V-1.1". Reconciliación ADITIVA
//     (solo agrega).
// Vista previa por zona con checkbox; nada se escribe sin confirmar.
// Ver reglas en src/modules/telas/importarMapa.ts, importarLiberado.ts e importarRolzzo.ts.

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { AlertTriangle, Upload } from 'lucide-react';
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
import { cargarTodosLosPanos, type ColmenaPano } from '@/modules/admin/colmena';
import {
  parsearMapaExcel,
  diffMapa,
  planAplicacion,
  guardBajasMasivas,
  claveIdentidad,
  type DiffMapa,
  type ParseoMapa,
  type CeldaMapa,
  type GuardBajaZona,
  type PlanAplicacion,
} from '@/modules/telas/importarMapa';
import {
  parsearLiberadoExcel,
  leerTachados,
} from '@/modules/telas/importarLiberado';
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

const cm = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toFixed(1).replace(/\.0$/, '').replace('.', ',');
const coords = (x: { rack: number; m: number; col: number }) => `R${x.rack}·M${x.m}·col${x.col}`;
const claveCelda = (c: CeldaMapa) => claveIdentidad(c.zona, c.rack, c.m, c.col);
const conToggle = (set: Set<string>, key: string): Set<string> => {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};
const PLAN_VACIO: PlanAplicacion = { inserts: [], updates: [], bajas: [], fuente: '' };

export default function ImportarColmenaDialog({ onClose, onSaved }: Props) {
  const { empresaId } = useAuth();
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [panos, setPanos] = useState<ColmenaPano[]>([]);

  // GALPÓN (sync por posición)
  const [parseoG, setParseoG] = useState<ParseoMapa | null>(null);
  const [diffG, setDiffG] = useState<DiffMapa | null>(null);
  const [okNuevosG, setOkNuevosG] = useState<Set<string>>(new Set());
  const [okModG, setOkModG] = useState<Set<string>>(new Set());
  const [okBajasG, setOkBajasG] = useState<Set<string>>(new Set());
  const [confirmG, setConfirmG] = useState(false);

  // LIBERADO (sync por posición; tachado = usado)
  const [parseoL, setParseoL] = useState<ParseoMapa | null>(null);
  const [diffL, setDiffL] = useState<DiffMapa | null>(null);
  const [okNuevosL, setOkNuevosL] = useState<Set<string>>(new Set());
  const [okModL, setOkModL] = useState<Set<string>>(new Set());
  const [okBajasL, setOkBajasL] = useState<Set<string>>(new Set());
  const [confirmL, setConfirmL] = useState(false);

  // ROLZZO (aditivo)
  const [diffR, setDiffR] = useState<DiffRolzzo | null>(null);
  const [selR, setSelR] = useState<Set<number>>(new Set());

  const onFile = async (file: File | undefined) => {
    if (!file || !empresaId) return;
    setParsing(true);
    setNombreArchivo(file.name);
    setConfirmG(false);
    setConfirmL(false);
    try {
      const bytes = await file.arrayBuffer();
      const wb = XLSX.read(bytes, { type: 'array' });
      const panosBD = await cargarTodosLosPanos(empresaId);
      setPanos(panosBD);

      // GALPÓN
      const pG = parsearMapaExcel(wb);
      const dG = diffMapa(panosBD, pG);
      setParseoG(pG);
      setDiffG(dG);
      setOkNuevosG(new Set(dG.nuevos.map(claveCelda)));
      setOkModG(new Set(dG.modificados.map((m) => m.pano.id)));
      setOkBajasG(new Set()); // bajas desmarcadas por defecto

      // LIBERADO (tachado leído del xlsx crudo)
      const tachados = leerTachados(bytes, pG.hoja);
      const pL = parsearLiberadoExcel(wb, { tachados });
      const dL = pL.celdas.length ? diffMapa(panosBD, pL) : null;
      setParseoL(pL.celdas.length ? pL : null);
      setDiffL(dL);
      setOkNuevosL(new Set(dL ? dL.nuevos.map(claveCelda) : []));
      setOkModL(new Set(dL ? dL.modificados.map((m) => m.pano.id) : []));
      setOkBajasL(new Set());

      // ROLZZO
      const pR = parsearRolzzoExcel(wb);
      const dR = pR.filas.length ? diffRolzzo(panosBD, pR) : null;
      setDiffR(dR);
      setSelR(new Set(dR ? dR.nuevos.map((_, i) => i) : []));

      if (pG.celdas.length === 0 && !dL && !dR) {
        toast.error('No se reconoció ninguna zona (GALPÓN, LIBERADO ni ROLZZO) en el archivo.');
      }
    } catch (e) {
      toast.error('No se pudo leer el Excel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  };

  const toggleR = (i: number) => {
    const next = new Set(selR);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelR(next);
  };

  const guardG = useMemo(() => (diffG ? guardBajasMasivas(diffG, panos) : []), [diffG, panos]);
  const guardL = useMemo(() => (diffL ? guardBajasMasivas(diffL, panos) : []), [diffL, panos]);
  const reqConfirmG = guardG.some((g) => g.excede) && okBajasG.size > 0;
  const reqConfirmL = guardL.some((g) => g.excede) && okBajasL.size > 0;

  const totalG = okNuevosG.size + okModG.size + okBajasG.size;
  const totalL = okNuevosL.size + okModL.size + okBajasL.size;
  const totalR = selR.size;
  const total = totalG + totalL + totalR;
  const bloqueado =
    saving || total === 0 || (reqConfirmG && !confirmG) || (reqConfirmL && !confirmL);

  const aplicar = async () => {
    if (!empresaId || bloqueado) return;
    setSaving(true);
    try {
      const ctx = { empresaId, ahoraISO: new Date().toISOString() };
      const planG = diffG
        ? planAplicacion(diffG, { nuevos: okNuevosG, modificados: okModG, bajas: okBajasG }, ctx)
        : PLAN_VACIO;
      const planL = diffL
        ? planAplicacion(diffL, { nuevos: okNuevosL, modificados: okModL, bajas: okBajasL }, ctx)
        : PLAN_VACIO;
      const planR = diffR ? planRolzzo(diffR, selR, ctx) : PLAN_VACIO;
      const plan = {
        inserts: [...planG.inserts, ...planL.inserts, ...planR.inserts],
        updates: [...planG.updates, ...planL.updates],
        bajas: [...planG.bajas, ...planL.bajas],
        fuente: planG.fuente || planL.fuente || planR.fuente,
      };
      const res = await ejecutarPlanMapa(supabase as unknown as ClienteMapa, plan);
      const resumen = `${res.insertados} agregados · ${res.actualizados} actualizados · ${res.dadosDeBaja} bajas`;
      if (res.errores.length === 0) {
        toast.success(`Colmena actualizada: ${resumen}.`);
        await onSaved();
        onClose();
      } else {
        toast.warning(`Aplicado parcial: ${resumen}. Fallaron ${res.errores.length}: ${res.errores[0].detalle}`);
        await onSaved();
      }
    } catch (e) {
      toast.error('No se pudo aplicar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Importar colmena (GALPÓN + LIBERADO + ROLZZO)</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div>
            <Label className="mb-1 text-xs">Excel del galpón (BUSCADOR COLMENA PAÑOS)</Label>
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
            />
            {nombreArchivo && <p className="mt-1 text-[11px] text-muted-foreground">{nombreArchivo}</p>}
          </div>

          {parsing && <p className="py-4 text-center text-sm text-muted-foreground">Leyendo…</p>}

          <div className="flex max-h-[52vh] flex-col gap-4 overflow-y-auto">
            {diffG && parseoG && (
              <SeccionSync
                titulo="GALPÓN"
                bajasNota="ya no están en el MAPA"
                parseo={parseoG}
                diff={diffG}
                guard={guardG}
                requiereConfirm={reqConfirmG}
                confirm={confirmG}
                setConfirm={setConfirmG}
                okNuevos={okNuevosG}
                setOkNuevos={setOkNuevosG}
                okMod={okModG}
                setOkMod={setOkModG}
                okBajas={okBajasG}
                setOkBajas={setOkBajasG}
              />
            )}

            {diffL && parseoL && (
              <SeccionSync
                titulo="LIBERADO"
                bajasNota="tachados/usados en la hoja"
                parseo={parseoL}
                diff={diffL}
                guard={guardL}
                requiereConfirm={reqConfirmL}
                confirm={confirmL}
                setConfirm={setConfirmL}
                okNuevos={okNuevosL}
                setOkNuevos={setOkNuevosL}
                okMod={okModL}
                setOkMod={setOkModL}
                okBajas={okBajasL}
                setOkBajas={setOkBajasL}
              />
            )}

            {/* ── ROLZZO ── */}
            {diffR && (
              <div className="rounded-lg border border-accent/30 p-2">
                <div className="mb-2 text-xs text-muted-foreground">
                  <strong className="text-accent">ROLZZO</strong> · hoja «{diffR.hoja}» ·{' '}
                  <strong className="text-emerald-400">{diffR.nuevos.length}</strong> nuevos ·{' '}
                  <strong className="text-foreground">{diffR.yaEnSistema}</strong> ya en el sistema ·{' '}
                  {diffR.soloEnSistema} solo en el sistema (no se tocan).
                </div>
                {diffR.nuevos.length > 0 ? (
                  <Grupo
                    titulo="Nuevos" color="text-emerald-400" sel={selR.size} tot={diffR.nuevos.length}
                    onTodos={() => setSelR(selR.size === diffR.nuevos.length ? new Set() : new Set(diffR.nuevos.map((_, i) => i)))}
                  >
                    {diffR.nuevos.map((f, i) => (
                      <Fila key={i} checked={selR.has(i)} onToggle={() => toggleR(i)}>
                        <span className="w-16 shrink-0 text-muted-foreground">{f.ubicacion}</span>
                        <span className="w-16 shrink-0 font-bold">{f.codigo}</span>
                        <span className="text-muted-foreground">{cm(f.ancho)} × {cm(f.alto)}</span>
                      </Fila>
                    ))}
                  </Grupo>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Nada nuevo que agregar en ROLZZO.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={aplicar} disabled={bloqueado} className="gap-1">
            <Upload className="h-3.5 w-3.5" />
            {saving
              ? 'Aplicando…'
              : `Aplicar (${totalG} GALPÓN · ${totalL} LIBERADO · ${totalR} ROLZZO)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Sección de una zona que SINCRONIZA (GALPÓN / LIBERADO) ───────────
function SeccionSync({
  titulo, bajasNota, parseo, diff, guard, requiereConfirm, confirm, setConfirm,
  okNuevos, setOkNuevos, okMod, setOkMod, okBajas, setOkBajas,
}: {
  titulo: string;
  bajasNota: string;
  parseo: ParseoMapa;
  diff: DiffMapa;
  guard: GuardBajaZona[];
  requiereConfirm: boolean;
  confirm: boolean;
  setConfirm: (v: boolean) => void;
  okNuevos: Set<string>;
  setOkNuevos: (s: Set<string>) => void;
  okMod: Set<string>;
  setOkMod: (s: Set<string>) => void;
  okBajas: Set<string>;
  setOkBajas: (s: Set<string>) => void;
}) {
  return (
    <div className="rounded-lg border border-accent/30 p-2">
      <div className="mb-2 text-xs text-muted-foreground">
        <strong className="text-accent">{titulo}</strong> · hoja «{parseo.hoja}» ·{' '}
        <strong className="text-emerald-400">{diff.nuevos.length}</strong> nuevos ·{' '}
        <strong className="text-amber-400">{diff.modificados.length}</strong> modificados ·{' '}
        <strong className="text-destructive">{diff.bajas.length}</strong> bajas ·{' '}
        {diff.conflictos.length} conflictos · {diff.sinCambio.length} sin cambios.
      </div>
      {parseo.advertencias.length > 0 && (
        <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 p-1.5 text-[11px] text-amber-300">
          {parseo.advertencias.slice(0, 3).map((a, i) => (
            <div key={i}>⚠ {a}</div>
          ))}
        </div>
      )}

      {diff.nuevos.length > 0 && (
        <Grupo
          titulo="Nuevos" color="text-emerald-400" sel={okNuevos.size} tot={diff.nuevos.length}
          onTodos={() => setOkNuevos(okNuevos.size === diff.nuevos.length ? new Set() : new Set(diff.nuevos.map(claveCelda)))}
        >
          {diff.nuevos.map((c) => {
            const k = claveCelda(c);
            return (
              <Fila key={k} checked={okNuevos.has(k)} onToggle={() => setOkNuevos(conToggle(okNuevos, k))}>
                <span className="w-24 shrink-0 text-muted-foreground">{coords(c)}</span>
                <span className="w-16 shrink-0 font-bold">{c.codigo}</span>
                <span className="text-muted-foreground">{cm(c.ancho)} × {cm(c.alto)}</span>
              </Fila>
            );
          })}
        </Grupo>
      )}

      {diff.modificados.length > 0 && (
        <Grupo
          titulo="Modificados" color="text-amber-400" sel={okMod.size} tot={diff.modificados.length}
          onTodos={() => setOkMod(okMod.size === diff.modificados.length ? new Set() : new Set(diff.modificados.map((m) => m.pano.id)))}
        >
          {diff.modificados.map((m) => (
            <Fila key={m.pano.id} checked={okMod.has(m.pano.id)} onToggle={() => setOkMod(conToggle(okMod, m.pano.id))}>
              <span className="w-24 shrink-0 text-muted-foreground">{coords(m.celda)}</span>
              <span className="w-28 shrink-0">
                {m.cambiaCodigo ? <span className="text-amber-300">{m.pano.codigo} → {m.celda.codigo}</span> : <span className="font-bold">{m.celda.codigo}</span>}
              </span>
              <span className="text-muted-foreground">
                {m.cambiaMedidas ? <span className="text-amber-300">{cm(m.pano.medida_ancho)}×{cm(m.pano.medida_alto)} → {cm(m.celda.ancho)}×{cm(m.celda.alto)}</span> : `${cm(m.celda.ancho)}×${cm(m.celda.alto)}`}
              </span>
            </Fila>
          ))}
        </Grupo>
      )}

      {diff.bajas.length > 0 && (
        <Grupo
          titulo={`Bajas (${bajasNota})`} color="text-destructive" sel={okBajas.size} tot={diff.bajas.length}
          onTodos={() => setOkBajas(okBajas.size === diff.bajas.length ? new Set() : new Set(diff.bajas.map((p) => p.id)))}
        >
          {diff.bajas.map((p) => (
            <Fila key={p.id} checked={okBajas.has(p.id)} onToggle={() => setOkBajas(conToggle(okBajas, p.id))}>
              <span className="w-24 shrink-0 text-muted-foreground">
                {p.datos_extra ? coords({ rack: Number(p.datos_extra.rack), m: Number(p.datos_extra.m), col: Number(p.datos_extra.col) }) : '—'}
              </span>
              <span className="w-16 shrink-0 font-bold">{p.codigo || '—'}</span>
              <span className="text-muted-foreground">{cm(p.medida_ancho)} × {cm(p.medida_alto)}</span>
            </Fila>
          ))}
        </Grupo>
      )}

      {diff.conflictos.length > 0 && (
        <details className="mt-1 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-bold uppercase tracking-wider">
            Conflictos ({diff.conflictos.length}) — revisión manual
          </summary>
          <div className="mt-1 rounded border border-border">
            {diff.conflictos.map((c, i) => (
              <div key={i} className="border-b border-border px-2 py-1 last:border-0">
                <b>{c.pano?.codigo || c.celda?.codigo || '—'}</b> — {c.motivo}
              </div>
            ))}
          </div>
        </details>
      )}

      {requiereConfirm && (
        <label className="mt-2 flex items-start gap-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-[11px] text-destructive">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Entiendo que se darán de baja {guard.filter((g) => g.excede).map((g) => `${g.bajas}/${g.disponibles} de ${g.zona}`).join(', ')}.
          </span>
        </label>
      )}
    </div>
  );
}

function Grupo({
  titulo, color, sel, tot, onTodos, children,
}: {
  titulo: string; color: string; sel: number; tot: number; onTodos: () => void; children: React.ReactNode;
}) {
  return (
    <section className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{titulo} ({sel}/{tot})</span>
        <button type="button" className="text-[11px] text-muted-foreground underline" onClick={onTodos}>
          {sel === tot ? 'Ninguno' : 'Todos'}
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border">{children}</div>
    </section>
  );
}

function Fila({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 border-b border-border px-2 py-1 text-xs last:border-0">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {children}
    </label>
  );
}
