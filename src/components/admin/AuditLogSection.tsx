// Audit Log — sección de Admin con tabla filtrable.

import { useMemo, useState } from 'react';
import { Eye, History, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
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
import {
  AUDIT_TABLAS,
  resumenCambio,
  useAuditLog,
  type AuditAction,
  type AuditLogRow,
} from '@/modules/admin/auditLog';

function badgeVariant(accion: AuditAction): 'default' | 'secondary' | 'destructive' {
  if (accion === 'INSERT') return 'default';
  if (accion === 'DELETE') return 'destructive';
  return 'secondary';
}

export function AuditLogSection() {
  const [tabla, setTabla] = useState('');
  const [accion, setAccion] = useState<AuditAction | ''>('');
  const [userEmail, setUserEmail] = useState('');
  const [entidadId, setEntidadId] = useState('');
  const [detalle, setDetalle] = useState<AuditLogRow | null>(null);

  const filtros = useMemo(
    () => ({ tabla, accion, userEmail, entidadId, limite: 200 }),
    [tabla, accion, userEmail, entidadId],
  );
  const { rows, loading, error, refrescar } = useAuditLog(filtros);

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <History className="h-4 w-4" />
          Audit log — cambios recientes
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={refrescar}
          disabled={loading}
          className="gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <select
          value={tabla}
          onChange={(e) => setTabla(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas las tablas</option>
          {AUDIT_TABLAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={accion}
          onChange={(e) => setAccion(e.target.value as AuditAction | '')}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas las acciones</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <Input
          placeholder="Filtrar por email…"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="ID de entidad exacto…"
          value={entidadId}
          onChange={(e) => setEntidadId(e.target.value)}
          className="h-9"
        />
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          Error: {error}
        </div>
      )}

      <div className="max-h-[500px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-[140px]">Cuándo</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Cambio</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {loading ? 'Cargando…' : 'Sin eventos para los filtros actuales'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(r.timestamp)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.user_email || (
                      <span className="text-muted-foreground italic">sistema</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.tabla}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(r.accion)}>{r.accion}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-xs">
                    {r.entidad_id || '—'}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-xs">
                    {resumenCambio(r)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDetalle(r)}
                      className="rounded border border-border bg-card p-1 text-foreground hover:bg-card"
                      title="Ver detalle"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Mostrando hasta 200 eventos. Ajustá los filtros si necesitas otros más viejos.
      </p>

      {/* Detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {detalle?.accion} en {detalle?.tabla}
            </DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Cuándo:</span>{' '}
                  {formatDateTime(detalle.timestamp)}
                </div>
                <div>
                  <span className="text-muted-foreground">Usuario:</span>{' '}
                  {detalle.user_email || 'sistema'}
                </div>
                <div>
                  <span className="text-muted-foreground">Entidad:</span>{' '}
                  <span className="font-mono">{detalle.entidad_id || '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">User ID:</span>{' '}
                  <span className="font-mono">{detalle.user_id || '—'}</span>
                </div>
              </div>

              {detalle.accion === 'UPDATE' && detalle.diff && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    Campos que cambiaron
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Campo</TableHead>
                          <TableHead>Antes</TableHead>
                          <TableHead>Después</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(detalle.diff).map((k) => {
                          const before = (detalle.datos_anteriores || {})[k];
                          const after = (detalle.datos_nuevos || {})[k];
                          return (
                            <TableRow key={k}>
                              <TableCell className="font-mono text-xs">{k}</TableCell>
                              <TableCell className="font-mono text-xs text-destructive">
                                {JSON.stringify(before)}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-success">
                                {JSON.stringify(after)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {detalle.accion !== 'UPDATE' && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    {detalle.accion === 'INSERT' ? 'Datos creados' : 'Datos eliminados'}
                  </div>
                  <pre className="max-h-[300px] overflow-auto rounded-md border bg-muted p-3 text-[0.7rem]">
                    {JSON.stringify(
                      detalle.accion === 'INSERT'
                        ? detalle.datos_nuevos
                        : detalle.datos_anteriores,
                      null,
                      2,
                    )}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
