// Capa 3 anti-huérfanos: banner de monitoreo en el panel de admin.
// Muestra planes_corte que NO tienen eventos correspondientes en tubos_historial.
// Si la lista está vacía → no muestra nada (cero ruido en el caso normal).
// Si hay >0 → banner amber prominente con CTA para ver detalle.

import { useState } from 'react';
import { AlertTriangle, RefreshCw, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/formatters';
import { usePlanesHuerfanos } from '@/modules/admin/orphan-plans';

export function OrphanPlansBanner() {
  const { planes, loading, error, refrescar } = usePlanesHuerfanos();
  const [verDetalle, setVerDetalle] = useState(false);

  if (error) {
    return (
      <section className="rounded-lg border border-destructive/30 bg-destructive/15 p-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>
            No se pudo verificar planes huérfanos:{' '}
            <span className="font-mono text-xs">{error}</span>
          </span>
          <Button variant="ghost" size="sm" onClick={refrescar} className="ml-auto h-7">
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      </section>
    );
  }

  if (loading || planes.length === 0) return null;

  const total = planes.length;

  return (
    <>
      <section className="rounded-lg border-2 border-warning/30 bg-warning/15 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-semibold text-warning">
              {total} {total === 1 ? 'plan huérfano detectado' : 'planes huérfanos detectados'}
            </div>
            <div className="text-xs text-warning/80">
              Planes guardados sin eventos correspondientes en historial. Posible sync silencioso fallido.
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVerDetalle(true)}
            className="gap-1.5"
          >
            <FileSearch className="h-3.5 w-3.5" />
            Ver detalle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={refrescar}
            className="h-9"
            title="Refrescar"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </section>

      <Dialog open={verDetalle} onOpenChange={setVerDetalle}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Planes huérfanos detectados</DialogTitle>
            <DialogDescription>
              Estos planes existen en <span className="font-mono">planes_corte</span> pero sus OTs no tienen
              eventos de corte/sobrante/merma en <span className="font-mono">tubos_historial</span>. Ventana de 7 días.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[500px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>OTs</TableHead>
                  <TableHead>Cortes</TableHead>
                  <TableHead>Antigüedad</TableHead>
                  <TableHead>Optimizador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planes.map((p) => (
                  <TableRow key={p.plan_id}>
                    <TableCell className="text-xs">{formatDateTime(p.fecha)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.ots.map((ot) => (
                          <Badge key={ot} variant="warning" className="font-mono text-xs">
                            {ot}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{p.n_resultados}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatAge(p.age_hours)}
                    </TableCell>
                    <TableCell className="text-xs">{p.optimizer_email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-md border border-warning/30 bg-warning/15 p-3 text-xs text-warning/90">
            <div className="mb-1 font-semibold">Pasos sugeridos:</div>
            <ol className="ml-4 list-decimal space-y-1">
              <li>Confirmar con el taller si la OT fue cortada físicamente.</li>
              <li>
                Si fue cortada: aplicar recovery (ver{' '}
                <span className="font-mono">sql/20260505_recovery_ot_2939_sync_fallido.sql</span> como referencia).
              </li>
              <li>Si no fue cortada: borrar el plan huérfano de planes_corte.</li>
              <li>El banner se actualiza automáticamente cuando el plan deja de ser huérfano.</li>
            </ol>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setVerDetalle(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatAge(hours: number): string {
  if (hours < 1) return 'hace minutos';
  if (hours < 24) return `hace ${Math.round(hours)} h`;
  const dias = Math.floor(hours / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}
