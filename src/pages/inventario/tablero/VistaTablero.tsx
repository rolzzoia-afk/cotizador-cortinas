// El tablero del inventario (lámina «Shell y tablero»): seis números arriba,
// los movimientos del día, el conteo abierto y los atajos del rol.

import { Link } from 'react-router-dom';
import { AlignJustify, Layers, Plus, QrCode, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatBox } from '@/components/ui/stat-box';
import { badgeTipoMovimiento } from '@/modules/inventario/badges';
import { etiquetaAlmacen } from '@/modules/inventario/almacenes';
import { atajosPorRol } from '@/modules/inventario/tablero';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { useTablero } from '@/modules/inventario/tableroStore';
import { useInventario } from '../InventarioLayout';

const ICONOS_ATAJO = { QrCode, Plus, Layers, AlignJustify, ShoppingCart } as const;

function numero(n: number): string {
  return n.toLocaleString('es-CL');
}

export function VistaTablero() {
  const { rol, queryRol, resumen } = useInventario();
  const { kpis, movimientos, loading, error } = useTablero();
  const { flags } = useFlagsInventario();
  const atajos = atajosPorRol(rol, flags.compras);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Inventario"
        hint="Bodega, telas, colmena y tubos en un solo lugar."
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-muted/50" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <StatBox
            rotulo="Alertas de stock"
            valor={error ? '—' : numero(kpis.alertas)}
            tono={!error && kpis.alertas > 0 ? 'destructive' : 'neutro'}
            hint={
              error
                ? 'No se pudo consultar'
                : `${numero(kpis.alertasSinStock)} sin stock · ${numero(kpis.alertasBajoMinimo)} bajo mínimo`
            }
          />
          <StatBox
            rotulo="Movimientos hoy"
            valor={error ? '—' : numero(kpis.movimientosHoy)}
            hint={
              error
                ? 'No se pudo consultar'
                : `${numero(kpis.entradasHoy)} entradas · ${numero(kpis.salidasHoy)} salidas`
            }
          />
          <StatBox
            rotulo="Conteo activo"
            valor={resumen.conteoActivo ? 'Tubos' : 'Ninguno'}
            compacto
            tono={resumen.conteoActivo ? 'accent' : 'neutro'}
            hint={
              resumen.conteoActivo
                ? 'Mientras esté abierto no se puede cortar'
                : 'No hay ningún conteo abierto'
            }
          />
          <StatBox
            rotulo="Telas bajo mínimo"
            valor={error ? '—' : numero(kpis.telasBajoMinimo)}
            tono={!error && kpis.telasBajoMinimo > 0 ? 'warning' : 'neutro'}
            hint={
              error
                ? 'No se pudo consultar'
                : `${numero(kpis.telasTotal)} códigos · ${numero(kpis.telasSinMinimo)} sin mínimo definido`
            }
          />
          <StatBox
            rotulo="Paños sobre 90 días"
            valor={error ? '—' : numero(kpis.panosAlerta)}
            hint={
              error
                ? 'No se pudo consultar'
                : `de ${numero(kpis.panosTotal)} disponibles en la colmena`
            }
          />
          <StatBox
            rotulo="Tubos en colmena"
            valor={error ? '—' : numero(kpis.tubos)}
            hint={error ? 'No se pudo consultar' : 'piezas con medida'}
          />
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <h2 className="font-serif text-base font-medium">Movimientos de hoy</h2>
            <Link
              to={`/inventario/movimientos${queryRol}`}
              className="ml-auto text-xs text-accent hover:underline"
            >
              Ver kardex completo →
            </Link>
          </div>
          {movimientos.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState
                titulo={
                  loading
                    ? 'Cargando…'
                    : error
                      ? 'No se pudieron leer los movimientos'
                      : 'Todavía no se movió nada hoy'
                }
                texto={
                  loading || error
                    ? undefined
                    : 'Acá van a aparecer las entradas y salidas del día.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem] tabular-nums">
                <thead>
                  <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="h-9 px-3 text-left font-medium">Hora</th>
                    <th className="h-9 px-3 text-left font-medium">Artículo</th>
                    <th className="h-9 px-3 text-left font-medium">Tipo</th>
                    <th className="h-9 px-3 text-left font-medium">Almacén</th>
                    <th className="h-9 px-3 text-right font-medium">Cantidad</th>
                    <th className="h-9 px-3 text-left font-medium">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => {
                    const badge = badgeTipoMovimiento(m.tipo);
                    return (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-muted-foreground">{m.hora}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono font-medium">{m.codigo}</span>
                          {m.nombre ? (
                            <span className="text-muted-foreground"> · {m.nombre}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={badge.variante}>{badge.texto}</Badge>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {etiquetaAlmacen(m.almacen)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {m.cantidad.toLocaleString('es-CL')}
                          {m.unidad ? ` ${m.unidad}` : ''}
                        </td>
                        <td className="px-3 py-2 font-mono text-accent">{m.ot || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-serif text-[0.9375rem] font-medium">Atajos</h2>
          {atajos.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Tu rol no tiene atajos configurados.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {atajos.map((a) => {
                const Icono = ICONOS_ATAJO[a.icono];
                return (
                  <Link
                    key={a.id}
                    to={a.ruta.startsWith('/inventario') ? `${a.ruta}${queryRol}` : a.ruta}
                    className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-[0.845rem] font-medium transition-colors hover:border-accent/50"
                  >
                    <Icono className="h-4 w-4 text-accent" aria-hidden />
                    {a.texto}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VistaTablero;
