// Admin → Sistema: versión mínima del optimizador del taller, historial de
// planes de corte (con restauración) y carga del inventario base.
// Estaba todo inline en AdminPanel.tsx; se extrajo al modularizar la página.

import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database';
import { formatDateTime } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { confirmar } from '@/components/ui/confirm';
import { InventoryBaselineSection } from '@/components/admin/InventoryBaselineSection';

type PlanCorte = {
  id: string;
  fecha: string;
  optimizer_email: string | null;
  fecha_correccion: string | null;
  resultados: unknown;
  ordenes: unknown;
};

type PlanResultado = {
  colmena?: string;
  colmena_sobrante?: string;
  codigo?: string;
  codigo_original?: string;
  color?: string;
  medida_cm?: number;
  medida_origen?: number;
  sobrante_cm?: number;
  fuente?: string;
  nombreMaterialNuevo?: string;
  es_intermedio?: boolean;
  es_desecho?: boolean;
};

function parsearResultados(raw: unknown): PlanResultado[] {
  if (!raw) return [];
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    if (Array.isArray(raw)) return raw as PlanResultado[];
    return [];
  } catch {
    return [];
  }
}

interface VistaSistemaProps {
  empresaId: string | null | undefined;
}

export default function VistaSistema({ empresaId }: VistaSistemaProps) {
  const [version, setVersion] = useState<string | null>(null);
  const [optimizadores, setOptimizadores] = useState<string[]>([]);
  const [optimizerSel, setOptimizerSel] = useState('');
  const [planes, setPlanes] = useState<PlanCorte[]>([]);
  const [planDetalle, setPlanDetalle] = useState<PlanCorte | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [actualizandoVersion, setActualizandoVersion] = useState(false);

  // Versión mínima + realtime (otro admin puede cambiarla).
  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'opt_version_minima')
        .maybeSingle<{ valor: string }>();
      setVersion(data?.valor ?? null);
    };
    run();
    const ch = supabase
      .channel(`admin-version-${crypto.randomUUID()}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: 'configuracion', filter: `empresa_id=eq.${empresaId}` },
        run,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [empresaId]);

  // Emails de optimizadores con planes guardados.
  useEffect(() => {
    if (!empresaId) return;
    const run = async () => {
      const { data } = await supabase
        .from('planes_corte')
        .select('optimizer_email')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      const emails = [
        ...new Set(
          ((data as { optimizer_email: string | null }[]) ?? [])
            .map((d) => d.optimizer_email)
            .filter((e): e is string => !!e),
        ),
      ];
      setOptimizadores(emails);
      if (emails.length === 1) setOptimizerSel(emails[0]);
    };
    run();
  }, [empresaId]);

  const cargarPlanes = async (email: string) => {
    if (!empresaId || !email) {
      setPlanes([]);
      return;
    }
    const { data } = await supabase
      .from('planes_corte')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('optimizer_email', email)
      .order('fecha', { ascending: false })
      .limit(30);
    setPlanes((data as PlanCorte[]) ?? []);
  };

  useEffect(() => {
    cargarPlanes(optimizerSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, optimizerSel]);

  const forzarActualizacion = async () => {
    if (!empresaId) return;
    // Se lee la versión REAL del optimizador desplegado (VERSION_ACTUAL en el
    // HTML, servido con no-store). Así la mínima nunca queda por encima de lo
    // desplegado — antes se sumaba 0.1 a ciegas y, con comparación de strings,
    // podía dejar el banner de actualización pegado para siempre.
    let nueva: string;
    try {
      const res = await fetch(`/legacy/optimizador.html?v=${Date.now()}`, { cache: 'no-store' });
      const html = await res.text();
      const m = html.match(/VERSION_ACTUAL\s*=\s*"([^"]+)"/);
      if (!m) throw new Error('No se encontró VERSION_ACTUAL en el optimizador desplegado.');
      nueva = m[1].trim();
    } catch (e) {
      toast.error(
        'No se pudo leer la versión desplegada del optimizador: ' +
          (e instanceof Error ? e.message : String(e)),
      );
      return;
    }

    if (nueva === (version ?? '').trim()) {
      toast.info(
        `La versión mínima ya es la desplegada (v${nueva}). ` +
          'Si acabas de hacer deploy, espera a que Vercel termine y reintenta.',
      );
      return;
    }

    const ok = await confirmar(
      `Versión desplegada del optimizador: v${nueva} (mínima actual: v${version ?? 'N/A'}).\n\n` +
        `¿Fijarla como mínima? Los navegadores del taller con versiones anteriores ` +
        `verán el banner "Actualizar ahora".`,
    );
    if (!ok) return;

    setActualizandoVersion(true);
    const { error } = await supabase
      .from('configuracion')
      .upsert(
        { empresa_id: empresaId, clave: 'opt_version_minima', valor: nueva },
        { onConflict: 'empresa_id,clave' },
      );
    setActualizandoVersion(false);
    if (error) {
      toast.error('Error al actualizar la versión: ' + error.message);
      return;
    }
    toast.success(`Versión actualizada a v${nueva}. Los dispositivos del taller se recargarán.`);
  };

  const restaurarPlan = async () => {
    if (!planDetalle || !empresaId) return;
    const fecha = formatDateTime(planDetalle.fecha);
    const ok = await confirmar(
      `¿Restaurar el plan del ${fecha} como plan activo?\n\n` +
        `Se creará una copia como el más reciente del optimizador "${planDetalle.optimizer_email}".`,
    );
    if (!ok) return;

    setRestaurando(true);
    const { error } = await supabase.from('planes_corte').insert({
      empresa_id: empresaId,
      optimizer_email: planDetalle.optimizer_email,
      resultados: planDetalle.resultados as Json,
      ordenes: planDetalle.ordenes as Json,
      fecha: new Date().toISOString(),
      fecha_correccion: null,
    });
    setRestaurando(false);
    if (error) {
      toast.error('Error durante la restauración: ' + error.message);
      return;
    }
    toast.success(`Plan restaurado. Se creó una copia del plan del ${fecha}.`);
    const email = planDetalle.optimizer_email ?? '';
    setPlanDetalle(null);
    await cargarPlanes(email);
  };

  const detalleResultados = useMemo(
    () => (planDetalle ? parsearResultados(planDetalle.resultados) : []),
    [planDetalle],
  );

  return (
    <div className="space-y-6">
      {/* Versión del optimizador */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Versión del optimizador en el taller
        </h2>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">
              Versión mínima requerida en Supabase
            </div>
            <div className="inline-block rounded-md border-2 border-cyan-500 bg-cyan-500/10 px-5 py-3 font-mono text-2xl font-bold text-cyan-500">
              {version ? `v${version}` : 'Sin configurar'}
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={forzarActualizacion}
            disabled={actualizandoVersion}
            className="font-semibold"
          >
            {actualizandoVersion
              ? 'Actualizando…'
              : 'Forzar actualización en taller (subir versión)'}
          </Button>
        </div>
      </section>

      {/* Historial de planes */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          Historial de planes de corte
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Planes generados por el optimizador, guardados automáticamente en Supabase.
        </p>

        <div className="mb-3 flex items-center gap-3">
          <label htmlFor="optsel" className="text-sm text-muted-foreground">
            Email del optimizador:
          </label>
          <select
            id="optsel"
            value={optimizerSel}
            onChange={(e) => setOptimizerSel(e.target.value)}
            className="flex h-9 min-w-[250px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">-- Seleccionar optimizador --</option>
            {optimizadores.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[400px] overflow-y-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Fecha / Hora</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cortes</TableHead>
                <TableHead>Corregido</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {optimizerSel
                      ? 'Sin planes registrados'
                      : 'Selecciona un optimizador para ver su historial'}
                  </TableCell>
                </TableRow>
              ) : (
                planes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateTime(p.fecha)}</TableCell>
                    <TableCell>{p.optimizer_email ?? '—'}</TableCell>
                    <TableCell>{parsearResultados(p.resultados).length}</TableCell>
                    <TableCell>
                      {p.fecha_correccion ? <Badge variant="success">Corregido</Badge> : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPlanDetalle(p)}
                        className="h-7 gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <InventoryBaselineSection />

      {/* Modal detalle del plan */}
      <Dialog open={!!planDetalle} onOpenChange={(o) => !o && setPlanDetalle(null)}>
        <DialogContent>
          {planDetalle && (
            <>
              <DialogHeader>
                <DialogTitle>Plan de corte — {formatDateTime(planDetalle.fecha)}</DialogTitle>
                <DialogDescription>
                  Email: {planDetalle.optimizer_email ?? '—'} · Cortes: {detalleResultados.length} ·
                  ID: {planDetalle.id}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Colmena</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Medida</TableHead>
                      <TableHead>Sobrante</TableHead>
                      <TableHead>Destino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalleResultados.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.colmena ?? '—'}</TableCell>
                        <TableCell className="font-mono">{r.codigo ?? '—'}</TableCell>
                        <TableCell>{r.medida_cm ?? '—'}</TableCell>
                        <TableCell>{r.sobrante_cm ?? '—'}</TableCell>
                        <TableCell>{r.colmena_sobrante ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setPlanDetalle(null)}>
                  Cerrar
                </Button>
                <Button onClick={restaurarPlan} disabled={restaurando}>
                  {restaurando ? 'Restaurando…' : 'Restaurar este plan'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
