// La ventana que muestra, tubo por tubo, en qué se diferencia lo que hay ahora
// de la foto que se sacó al empezar el conteo. Salió del archivo de la Colmena.

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { InventarioDiffRow } from '@/modules/admin/colmena';

export default function DiffModal({ rows, onClose }: { rows: InventarioDiffRow[]; onClose: () => void }) {
  const [filtro, setFiltro] = useState<InventarioDiffRow['tipo'] | 'todos'>('todos');

  const filtradas = useMemo(() => {
    if (filtro === 'todos') return rows;
    return rows.filter((r) => r.tipo === filtro);
  }, [rows, filtro]);

  const conteo = useMemo(() => ({
    todos: rows.length,
    mantenido: rows.filter((r) => r.tipo === 'mantenido').length,
    modificado: rows.filter((r) => r.tipo === 'modificado').length,
    nuevo: rows.filter((r) => r.tipo === 'nuevo').length,
    eliminado: rows.filter((r) => r.tipo === 'eliminado').length,
  }), [rows]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl rounded-lg border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Diff completo del inventario</div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          {(['todos', 'modificado', 'nuevo', 'eliminado', 'mantenido'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className={cn(
                'rounded border px-2 py-1 capitalize',
                filtro === t
                  ? 'border-accent bg-accent/20 text-accent'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {t} ({conteo[t]})
            </button>
          ))}
        </div>
        <div className="max-h-[60vh] overflow-y-auto rounded border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary text-[0.65rem] uppercase tracking-wide">
              <tr>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-left">Colmena</th>
                <th className="p-2 text-left">Código</th>
                <th className="p-2 text-right">Medida (cm)</th>
                <th className="p-2 text-left">Serial</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No hay filas en este filtro.
                  </td>
                </tr>
              )}
              {filtradas.map((r, i) => (
                <DiffRow key={r.tubo_raiz_id + ':' + i} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiffRow({ row }: { row: InventarioDiffRow }) {
  const tipoColor = {
    mantenido: 'text-muted-foreground',
    modificado: 'text-accent',
    nuevo: 'text-success',
    eliminado: 'text-destructive',
  }[row.tipo];

  if (row.tipo === 'eliminado') {
    return (
      <tr className="border-t border-border">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)}>{row.tipo}</td>
        <td className="p-2 line-through text-muted-foreground">{row.n_colmena_pre}</td>
        <td className="p-2 line-through text-muted-foreground">{row.cod_pre}</td>
        <td className="p-2 text-right line-through text-muted-foreground tabular-nums">{row.medida_cm_pre}</td>
        <td className="p-2 line-through text-muted-foreground">{row.serial_pre || '—'}</td>
      </tr>
    );
  }
  if (row.tipo === 'nuevo') {
    return (
      <tr className="border-t border-border">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)}>{row.tipo}</td>
        <td className="p-2">{row.n_colmena_post}</td>
        <td className="p-2">{row.cod_post}</td>
        <td className="p-2 text-right tabular-nums">{row.medida_cm_post}</td>
        <td className="p-2">{row.serial_post || '—'}</td>
      </tr>
    );
  }
  if (row.tipo === 'modificado') {
    const camposCambiados: string[] = [];
    if (row.n_colmena_pre !== row.n_colmena_post) camposCambiados.push('colmena');
    if (row.cod_pre !== row.cod_post) camposCambiados.push('código');
    if (row.medida_cm_pre !== row.medida_cm_post) camposCambiados.push('medida');
    if (row.serial_pre !== row.serial_post) camposCambiados.push('serial');
    return (
      <tr className="border-t border-border">
        <td className={cn('p-2 font-semibold capitalize', tipoColor)} title={camposCambiados.join(', ')}>
          {row.tipo}
        </td>
        <td className="p-2">
          {row.n_colmena_pre !== row.n_colmena_post ? (
            <span><span className="text-muted-foreground line-through">{row.n_colmena_pre}</span> → <span className="text-accent">{row.n_colmena_post}</span></span>
          ) : (
            row.n_colmena_post
          )}
        </td>
        <td className="p-2">
          {row.cod_pre !== row.cod_post ? (
            <span><span className="text-muted-foreground line-through">{row.cod_pre}</span> → <span className="text-accent">{row.cod_post}</span></span>
          ) : (
            row.cod_post
          )}
        </td>
        <td className="p-2 text-right tabular-nums">
          {row.medida_cm_pre !== row.medida_cm_post ? (
            <span><span className="text-muted-foreground line-through">{row.medida_cm_pre}</span> → <span className="text-accent">{row.medida_cm_post}</span></span>
          ) : (
            row.medida_cm_post
          )}
        </td>
        <td className="p-2">
          {row.serial_pre !== row.serial_post ? (
            <span><span className="text-muted-foreground line-through">{row.serial_pre || '—'}</span> → <span className="text-accent">{row.serial_post || '—'}</span></span>
          ) : (
            row.serial_post || '—'
          )}
        </td>
      </tr>
    );
  }
  // mantenido
  return (
    <tr className="border-t border-border">
      <td className={cn('p-2 capitalize', tipoColor)}>{row.tipo}</td>
      <td className="p-2 text-muted-foreground">{row.n_colmena_post}</td>
      <td className="p-2 text-muted-foreground">{row.cod_post}</td>
      <td className="p-2 text-right text-muted-foreground tabular-nums">{row.medida_cm_post}</td>
      <td className="p-2 text-muted-foreground">{row.serial_post || '—'}</td>
    </tr>
  );
}
