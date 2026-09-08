// El libro único: insumos y telas en la misma lista, con el saldo que quedó
// después de cada movimiento y de dónde salió a dónde fue.
//
// Es lo que los dos registros viejos no podían dar: ahí cada fila dice una
// cantidad, pero no en cuánto quedó el artículo, así que la historia de un
// código no se puede reconstruir.

import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { badgeTipoMovimiento } from '@/modules/inventario/badges';
import { formatFecha } from '@/modules/inventario/helpers';
import { useKardex, type FilaKardex } from '@/modules/inventario/kardexStore';

const TIPOS = ['INGRESO', 'SALIDA', 'TRASLADO', 'DEVOLUCION', 'AJUSTE', 'MERMA', 'CONTEO'];

export function TablaKardex() {
  const [dominio, setDominio] = useState<'' | 'insumo' | 'tela'>('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const { movimientos, almacenes, loading, error } = useKardex({
    dominio: dominio || undefined,
    tipo: (tipo || undefined) as never,
    limite: 300,
  });

  // El movimiento guarda el id de la bodega; en pantalla va su código.
  const codigoDe = useMemo(() => {
    const m = new Map(almacenes.map((a) => [a.id, a.codigo]));
    return (id: string | null) => (id ? m.get(id) || '—' : '—');
  }, [almacenes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    if (!q) return movimientos;
    return movimientos.filter(
      (m) =>
        m.item_cod.toUpperCase().includes(q) ||
        (m.item_nombre || '').toUpperCase().includes(q) ||
        (m.ot || '').toUpperCase().includes(q),
    );
  }, [movimientos, busqueda]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Código, nombre u OT…"
            className="pl-8"
          />
        </div>
        <select
          value={dominio}
          onChange={(e) => setDominio(e.target.value as '' | 'insumo' | 'tela')}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          <option value="">Insumos y telas</option>
          <option value="insumo">Solo insumos</option>
          <option value="tela">Solo telas</option>
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          titulo="No hay movimientos"
          texto={
            busqueda || tipo || dominio
              ? 'Ningún movimiento calza con lo que buscas.'
              : 'Todavía no se ha registrado ningún movimiento en el libro.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[860px] text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="h-9 px-3 text-left font-medium">Fecha</th>
                <th className="h-9 px-3 text-left font-medium">Artículo</th>
                <th className="h-9 px-3 text-left font-medium">Tipo</th>
                <th className="h-9 px-3 text-left font-medium">De → a</th>
                <th className="h-9 px-3 text-right font-medium">Cantidad</th>
                <th className="h-9 px-3 text-right font-medium">Saldo después</th>
                <th className="h-9 px-3 text-left font-medium">OT / motivo</th>
                <th className="h-9 px-3 text-left font-medium">Quién</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <Fila key={m.id} m={m} codigoDe={codigoDe} />
              ))}
            </tbody>
          </table>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Mostrando {filtrados.length.toLocaleString('es-CL')} de{' '}
            {movimientos.length.toLocaleString('es-CL')} · se traen los 300 más recientes
          </div>
        </div>
      )}
    </div>
  );
}

function Fila({ m, codigoDe }: { m: FilaKardex; codigoDe: (id: string | null) => string }) {
  const badge = badgeTipoMovimiento(m.tipo);
  // El saldo que importa es el del lado que se movió: si algo entró, en cuánto
  // quedó el destino; si salió, en cuánto quedó el origen.
  const saldo = m.saldo_destino_post ?? m.saldo_origen_post;
  return (
    <tr className="border-b border-border last:border-0">
      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatFecha(m.fecha)}</td>
      <td className="px-3 py-2">
        <div className="font-mono font-medium">{m.item_cod}</div>
        {m.item_nombre && (
          <div className="text-xs text-muted-foreground">{m.item_nombre}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge variant={badge.variante}>{badge.texto}</Badge>
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
        {codigoDe(m.almacen_origen_id)} → {codigoDe(m.almacen_destino_id)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
        {Number(m.cantidad).toLocaleString('es-CL')}
        {m.unidad === 'm' ? ' m' : ''}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right font-mono">
        {saldo === null ? '—' : Number(saldo).toLocaleString('es-CL')}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {m.ot ? <span className="font-mono">OT {m.ot}</span> : m.motivo || '—'}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {m.responsable || m.usuario_email || '—'}
      </td>
    </tr>
  );
}

export default TablaKardex;
