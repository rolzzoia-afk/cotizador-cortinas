// La tabla de «Alertas y reposición» (lámina del mismo nombre).
//
// Las dos columnas del medio se editan EN LA FILA: el punto de reposición se
// ajusta mirando la lista, no entrando a la ficha de cada artículo. Hasta
// ahora había que abrir uno por uno, y por eso 858 artículos nunca tuvieron
// mínimo.

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InputDecimal } from '@/components/ui/input-decimal';
import { cn } from '@/lib/utils';
import {
  cantidadSugerida,
  estadoDeAlerta,
  textoCantidad,
  textoCobertura,
  type ArticuloAlerta,
} from '@/modules/inventario/alertas';

/** Una celda editable. El vacío es «sin definir», no cero. */
function CeldaNumero({
  valor,
  tocada,
  onChange,
  deshabilitada,
}: {
  valor: number | null;
  tocada: boolean;
  onChange: (v: number | null) => void;
  deshabilitada: boolean;
}) {
  if (deshabilitada) {
    return <span className="block text-center text-muted-foreground">{valor ?? '—'}</span>;
  }
  return (
    <InputDecimal
      value={valor ?? 0}
      onChange={(v) => onChange(v > 0 ? v : null)}
      placeholder="—"
      aria-label="Cantidad"
      className={cn(
        'h-8 w-[72px] px-2 text-center font-mono text-[0.78rem]',
        tocada && 'border-accent ring-1 ring-accent/40',
        (valor ?? 0) === 0 && 'text-muted-foreground',
      )}
    />
  );
}

export function TablaAlertas({
  filas,
  total,
  marcados,
  onMarcar,
  onMarcarTodos,
  tocado,
  onCambiar,
  onPedir,
  puedeEditar,
}: {
  filas: ArticuloAlerta[];
  /** Cuántas alertas hay en total, para el pie. */
  total: number;
  marcados: Set<string>;
  onMarcar: (id: string) => void;
  onMarcarTodos: () => void;
  /** ¿Este campo de este artículo tiene un cambio sin guardar? */
  tocado: (id: string, campo: 'minimo' | 'maximo') => boolean;
  onCambiar: (id: string, campo: 'minimo' | 'maximo', valor: number | null) => void;
  onPedir: (a: ArticuloAlerta) => void;
  puedeEditar: boolean;
}) {
  const todosMarcados = filas.length > 0 && filas.every((f) => marcados.has(f.id));

  if (filas.length === 0) {
    return (
      <div className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-card">
        <EmptyState
          titulo="Nada que pedir"
          texto="Con este filtro no queda ningún artículo. Prueba con «Todo el catálogo» para revisar los que todavía no tienen mínimo."
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] text-[0.78rem] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-10 w-[34px] px-2 text-left font-medium">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={onMarcarTodos}
                  aria-label="Marcar todos los artículos de la lista"
                  className="h-3.5 w-3.5 cursor-pointer align-middle accent-accent"
                />
              </th>
              <th className="h-10 w-[86px] px-2.5 text-left font-medium">Código</th>
              <th className="h-10 px-2.5 text-left font-medium">Artículo</th>
              <th className="h-10 w-[78px] px-2.5 text-left font-medium">Dominio</th>
              <th className="h-10 w-[86px] px-2.5 text-right font-medium">Ahora</th>
              <th className="h-10 w-[104px] px-2.5 text-center font-medium">Pedir cuando baje de</th>
              <th className="h-10 w-[92px] px-2.5 text-center font-medium">Dejar en</th>
              <th className="h-10 w-[86px] px-2.5 text-right font-medium">Sugerido</th>
              <th className="h-10 w-[104px] px-2.5 text-left font-medium">Cobertura</th>
              <th className="h-10 w-[84px] px-2.5" />
            </tr>
          </thead>
          <tbody>
            {filas.map((a) => {
              const estado = estadoDeAlerta(a);
              const cobertura = textoCobertura(a);
              const sugerido = cantidadSugerida(a);
              const critico = estado === 'negativo' || estado === 'sin_stock';
              return (
                <tr
                  key={a.id}
                  className={cn(
                    'border-b border-border last:border-0 hover:bg-accent/[0.04]',
                    marcados.has(a.id) && 'bg-accent/[0.07]',
                    estado === 'descontinuado' && 'opacity-60',
                  )}
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={marcados.has(a.id)}
                      onChange={() => onMarcar(a.id)}
                      aria-label={`Marcar ${a.codigo}`}
                      className="h-3.5 w-3.5 cursor-pointer align-middle accent-accent"
                    />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono font-medium">{a.codigo}</td>
                  <td className="px-2.5 py-2">{a.nombre}</td>
                  <td className="px-2.5 py-2">
                    <Badge variant="muted">{a.dominio === 'tela' ? 'Tela' : 'Insumo'}</Badge>
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-2.5 py-2 text-right font-mono font-semibold',
                      critico && 'text-destructive',
                    )}
                  >
                    {textoCantidad(a.ahora, a.dominio)}
                    {a.dominio === 'tela' && <span className="ml-1 font-sans text-[0.6875rem] text-muted-foreground">m</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <CeldaNumero
                      valor={a.minimo}
                      tocada={tocado(a.id, 'minimo')}
                      deshabilitada={!puedeEditar}
                      onChange={(v) => onCambiar(a.id, 'minimo', v)}
                    />
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <CeldaNumero
                      valor={a.maximo}
                      tocada={tocado(a.id, 'maximo')}
                      deshabilitada={!puedeEditar}
                      onChange={(v) => onCambiar(a.id, 'maximo', v)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono">
                    {sugerido == null ? (
                      <span className="text-muted-foreground/60">—</span>
                    ) : (
                      textoCantidad(sugerido, a.dominio)
                    )}
                  </td>
                  <td className="px-2.5 py-2">
                    <Badge variant={cobertura.variante}>{cobertura.texto}</Badge>
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    {puedeEditar && (
                      <Button variant="outline" size="sm" onClick={() => onPedir(a)}>
                        {sugerido == null ? 'Definir' : 'Pedir'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>
          {filas.length.toLocaleString('es-CL')} de {total.toLocaleString('es-CL')} artículos
          {marcados.size > 0 ? ` · ${marcados.size} marcados` : ''}
        </span>
        <span className="ml-auto">
          La cantidad sugerida es «dejar en» menos lo que hay hoy.
        </span>
      </div>
    </div>
  );
}

export default TablaAlertas;
