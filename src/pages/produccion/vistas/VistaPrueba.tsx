// Prueba: el control final, cortina por cortina, antes de mandarla a instalar.
//
// Cada cortina se prueba y queda OK o con un PROBLEMA. Un problema no es una
// nota suelta: además de dejar la cortina sin aprobar, manda un aviso al
// encargado de producción — es la última pantalla antes de que la cortina
// salga del galpón, y ahí ya no hay quien la revise de nuevo.

import { useMemo, useState } from 'react';
import { Check, CircleCheckBig, PackageCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OT } from '@/modules/ots/types';
import { useCrearAviso } from '@/modules/produccion/avisos';
import { calcularAvance } from '@/modules/produccion/avance';
import { cortinasDeOT, type CortinaPrueba } from '@/modules/produccion/cortinas';
import { useChecks, useMarcarOTLista } from '@/modules/produccion/hooks';
import BotonEmergencia from '../components/BotonEmergencia';

const med = (n: number) => (n > 0 ? n.toFixed(2).replace('.', ',') : '—');

export default function VistaPrueba({
  ot,
  otCargada,
  onAreaCerrada,
}: {
  ot: string;
  otCargada: OT | null;
  onAreaCerrada: () => Promise<void>;
}) {
  const cortinas = useMemo(() => cortinasDeOT(otCargada), [otCargada]);
  const { hechas, quien, notaDe, areaLista, marcar, marcarAreaLista } = useChecks('prueba', ot);
  const { crear } = useCrearAviso();
  const { marcarLista } = useMarcarOTLista(ot);
  const [problema, setProblema] = useState<CortinaPrueba | null>(null);
  const [detalle, setDetalle] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const avance = calcularAvance(cortinas.map((c) => c.piezaId), hechas);

  const aprobar = async (c: CortinaPrueba, ok: boolean) => {
    try {
      await marcar(c.piezaId, ok);
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const guardarProblema = async () => {
    if (!problema) return;
    setGuardando(true);
    try {
      // La cortina queda SIN aprobar y con el detalle pegado a ella; el aviso
      // es para que alguien lo vea hoy, no cuando se abra la pestaña.
      await marcar(problema.piezaId, false, detalle.trim());
      await crear(
        `${problema.ubicacion}${problema.rotulo ? ` (${problema.rotulo})` : ''}: ${detalle.trim()}`,
        'prueba',
        ot,
      );
      toast.success('Problema registrado y avisado a producción.');
      setProblema(null);
      setDetalle('');
    } catch (e) {
      toast.error('No se pudo registrar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const cerrarArea = async () => {
    const conProblema = cortinas.filter((c) => !hechas.has(c.piezaId) && notaDe.get(c.piezaId));
    if (conProblema.length > 0) {
      const sigue = await confirmar({
        titulo: 'Hay cortinas con problema',
        mensaje: `${conProblema.length} cortina(s) quedaron con un problema anotado. ¿Igual cierras la prueba?`,
        confirmLabel: 'Sí, cerrar',
        destructivo: true,
      });
      if (!sigue) return;
    } else if (avance.pct < 100) {
      const sigue = await confirmar({
        titulo: 'Faltan cortinas por probar',
        mensaje: `Quedan ${avance.total - avance.hechas} cortinas sin probar. ¿Igual cierras la prueba?`,
        confirmLabel: 'Sí, cerrar',
      });
      if (!sigue) return;
    }
    setCerrando(true);
    try {
      await marcarAreaLista(true);
      await onAreaCerrada();
      toast.success('Prueba cerrada.');
    } catch (e) {
      toast.error('No se pudo cerrar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCerrando(false);
    }
  };

  const entregar = async () => {
    const sigue = await confirmar({
      titulo: 'Marcar como lista para entrega',
      mensaje:
        'La OT sale de producción y queda lista para entrega. Es el mismo paso que hace la oficina desde Fase 4.',
      confirmLabel: 'Marcar lista',
    });
    if (!sigue) return;
    setCerrando(true);
    try {
      const ok = await marcarLista();
      if (!ok) {
        toast.error('No se encontró la OT para cerrarla.');
        return;
      }
      await onAreaCerrada();
      toast.success('OT lista para entrega.');
    } catch (e) {
      toast.error('No se pudo cerrar la OT: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCerrando(false);
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para probar sus cortinas.
      </p>
    );
  }

  if (cortinas.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <BotonEmergencia area="prueba" ot={ot} />
        </div>
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {otCargada
            ? `La OT ${ot} no tiene cortinas cargadas.`
            : `La OT ${ot} no está en el sistema.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">
            {avance.hechas} de {avance.total} aprobadas
          </span>
          <div className="h-2 min-w-[6rem] flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${avance.pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BotonEmergencia area="prueba" ot={ot} />
          <Button size="sm" variant="outline" onClick={cerrarArea} disabled={cerrando}>
            <CircleCheckBig className="mr-1.5 h-4 w-4" />
            {areaLista ? 'Prueba cerrada ✓' : 'Cerrar prueba'}
          </Button>
          <Button size="sm" onClick={entregar} disabled={cerrando}>
            <PackageCheck className="mr-1.5 h-4 w-4" />
            OT lista para entrega
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {cortinas.map((c) => {
          const ok = hechas.has(c.piezaId);
          const nota = notaDe.get(c.piezaId);
          const conProblema = !ok && !!nota;
          return (
            <li
              key={c.piezaId}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                ok && 'border-emerald-500/40 bg-emerald-500/5',
                conProblema && 'border-red-500/40 bg-red-500/5',
              )}
            >
              <div className="min-w-[10rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{c.ubicacion}</strong>
                  {c.rotulo && (
                    <span className="rounded bg-secondary px-1.5 text-[11px] font-semibold">
                      {c.rotulo}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[c.producto, c.codInt, c.color].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {med(c.ancho)} × {med(c.alto)} m
                </p>
                {conProblema && <p className="mt-1 text-xs text-red-300">⚠ {nota}</p>}
                {ok && quien.get(c.piezaId) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Aprobada por {quien.get(c.piezaId)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={ok ? 'default' : 'outline'}
                  onClick={() => aprobar(c, !ok)}
                  className={ok ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  {ok ? 'Aprobada' : 'OK'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setProblema(c);
                    setDetalle(nota ?? '');
                  }}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <TriangleAlert className="mr-1.5 h-4 w-4" />
                  Problema
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!problema} onOpenChange={(v) => !v && setProblema(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Problema en la cortina</DialogTitle>
            <DialogDescription>
              {problema?.ubicacion}
              {problema?.rotulo ? ` (${problema.rotulo})` : ''} · OT {ot}. La cortina queda sin
              aprobar y el encargado de producción recibe el aviso.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            rows={4}
            autoFocus
            placeholder="La cadena se traba al subir…"
            className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProblema(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarProblema} disabled={guardando || !detalle.trim()}>
              {guardando ? 'Guardando…' : 'Registrar problema'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
