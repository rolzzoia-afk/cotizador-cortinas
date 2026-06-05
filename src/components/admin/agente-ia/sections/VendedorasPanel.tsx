// Panel para activar/desactivar vendedoras que reciben leads automáticos.
// Solo las marcadas como activas reciben asignaciones del agente.

import { useState } from 'react';
import { CheckCircle2, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useVendedoras } from '@/modules/admin/agente-hooks';

export default function VendedorasPanel() {
  const { vendedoras, loading, error, setActiva } = useVendedoras();
  const [actualizando, setActualizando] = useState<string | null>(null);

  const handleToggle = async (perfil_id: string, activa: boolean) => {
    setActualizando(perfil_id);
    try {
      await setActiva(perfil_id, !activa);
      toast.success(activa ? 'Vendedora desactivada' : 'Vendedora activada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo actualizar: ' + msg);
    } finally {
      setActualizando(null);
    }
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vendedoras activas
        </h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo las marcadas como activas reciben leads automáticos del agente. Marcar como inactiva
        cuando una vendedora esté de vacaciones o licencia.
      </p>

      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading && vendedoras.length === 0 ? (
        <div className="text-xs text-muted-foreground">Cargando…</div>
      ) : vendedoras.length === 0 ? (
        <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
          No hay perfiles con rol "ventas" en esta empresa.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedora</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Leads asignados</TableHead>
              <TableHead>Última asignación</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendedoras.map((v) => (
              <TableRow key={v.perfil_id}>
                <TableCell>
                  <div className="font-medium">{v.nombre || '—'}</div>
                </TableCell>
                <TableCell>
                  {v.activa ? (
                    <Badge className="gap-1 bg-success/15 text-emerald-700 hover:bg-success/15 dark:text-success">
                      <CheckCircle2 className="h-3 w-3" /> Activa
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <XCircle className="h-3 w-3" /> Inactiva
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.leads_asignados_acumulado}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {v.ultima_asignacion
                    ? new Date(v.ultima_asignacion).toLocaleString('es-CL')
                    : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(v.perfil_id, v.activa)}
                    disabled={actualizando === v.perfil_id}
                  >
                    {actualizando === v.perfil_id
                      ? '…'
                      : v.activa
                        ? 'Desactivar'
                        : 'Activar'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
