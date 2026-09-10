// Las familias de código: el prefijo, hasta dónde llegó y qué le toca al
// próximo artículo.
//
// Es la tabla que antes no existía y por la que los códigos se elegían a ojo.
// Acá se ve de un vistazo cuál va a ser el próximo número de cada familia y
// cuáles quedaron fuera del alta.

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import type { FamiliaInsumo } from '@/modules/inventario/codigosInsumo';
import { formatearCodigo } from '@/modules/inventario/codigosInsumo';
import { useCodigosInsumo, useFamiliasInsumo } from '@/modules/inventario/familiasStore';
import { maximoPorPrefijo, ordenarFamilias } from '@/modules/inventario/validadores';
import FamiliaDialog from './FamiliaDialog';

export default function FamiliasSection({
  puedeEditar,
  categorias,
  subCategorias,
}: {
  puedeEditar: boolean;
  categorias: string[];
  subCategorias: string[];
}) {
  const { empresaId } = useAuth();
  const { familias, loading, error, recargar } = useFamiliasInsumo();
  const { codigos } = useCodigosInsumo();
  const [filtro, setFiltro] = useState('');
  const [editando, setEditando] = useState<{ familia: FamiliaInsumo | null } | null>(null);

  const maximos = useMemo(() => maximoPorPrefijo(codigos), [codigos]);

  const cuantos = useMemo(() => {
    const n = new Map<string, number>();
    for (const c of codigos) {
      const m = String(c).toUpperCase().match(/^([A-Z]{1,4})[0-9]/);
      if (m) n.set(m[1], (n.get(m[1]) || 0) + 1);
    }
    return n;
  }, [codigos]);

  // Un prefijo que los artículos usan y que no tiene familia: el alta no lo
  // ofrece y el correlativo de esos códigos no lo lleva nadie.
  const sinFamilia = useMemo(() => {
    const conocidos = new Set(familias.map((f) => f.prefijo));
    return [...maximos.keys()].filter((p) => !conocidos.has(p)).sort();
  }, [familias, maximos]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toUpperCase();
    const orden = ordenarFamilias(familias);
    if (!q) return orden;
    return orden.filter(
      (f) => f.prefijo.includes(q) || (f.nombre || '').toUpperCase().includes(q),
    );
  }, [familias, filtro]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <h2 className="font-serif text-[0.9375rem] font-medium">Familias de código</h2>
        <Badge variant="muted">
          {familias.filter((f) => f.activo).length} activas de {familias.length}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar familia…"
            className="h-8 w-40"
          />
          {puedeEditar && (
            <Button size="sm" onClick={() => setEditando({ familia: null })}>
              <Plus className="h-3.5 w-3.5" />
              Familia
            </Button>
          )}
        </div>
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Cada prefijo lleva su propio correlativo. Al dar de alta un artículo, la base toma el
        próximo número libre de su familia y lo asigna en la misma operación que lo crea, así que
        dos personas guardando a la vez nunca se llevan el mismo código.
      </p>

      {error && (
        <div className="mx-4 mb-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/[.09] p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      {sinFamilia.length > 0 && (
        <div className="mx-4 mb-3 flex gap-2 rounded-lg border border-warning/40 bg-warning/[.09] p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <div>
            Hay códigos con un prefijo que no tiene familia:{' '}
            <b className="font-mono">{sinFamilia.join(' · ')}</b>. Nadie lleva su correlativo y no
            se pueden dar de alta desde el formulario.
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-4 pb-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando familias…
        </div>
      ) : familias.length === 0 ? (
        <div className="px-4 pb-4 text-xs text-muted-foreground">
          Todavía no hay familias. Falta correr{' '}
          <span className="font-mono">sql/20260910_insumos_01_familias.sql</span>.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="h-9 px-4 text-left font-medium">Prefijo</th>
                <th className="h-9 px-4 text-left font-medium">Nombre</th>
                <th className="h-9 px-4 text-left font-medium">Clasifica como</th>
                <th className="h-9 px-4 text-right font-medium">Artículos</th>
                <th className="h-9 px-4 text-left font-medium">Próximo código</th>
                <th className="h-9 px-4" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => {
                const max = maximos.get(f.prefijo);
                const proximo = formatearCodigo(
                  f.prefijo,
                  Math.max(f.siguiente, (max ?? 0) + 1),
                  f.digitos === 3 ? 3 : 2,
                );
                const atrasado = max !== undefined && f.siguiente <= max;
                return (
                  <tr
                    key={f.prefijo}
                    className={`border-b border-border last:border-0 ${f.activo ? '' : 'opacity-55'}`}
                  >
                    <td className="px-4 py-2 font-mono font-semibold">{f.prefijo}</td>
                    <td className="px-4 py-2">
                      {f.nombre === f.prefijo ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        f.nombre
                      )}
                      {!f.activo && (
                        <Badge variant="muted" className="ml-2">
                          fuera del alta
                        </Badge>
                      )}
                      {f.descripcion && (
                        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{f.descripcion}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-[0.75rem] text-muted-foreground">
                      {[f.categoria, f.sub_categoria].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                      {cuantos.get(f.prefijo) ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono">{proximo}</span>
                      {f.digitos === 3 && (
                        <span className="ml-1.5 text-[0.7rem] text-muted-foreground">3 dígitos</span>
                      )}
                      {atrasado && (
                        <span className="ml-1.5 text-[0.7rem] text-warning">
                          el correlativo iba en {f.siguiente}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {puedeEditar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditando({ familia: f })}
                          aria-label={`Editar ${f.prefijo}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editando && empresaId && (
        <FamiliaDialog
          abierta
          familia={editando.familia}
          familias={familias}
          maximoUsado={editando.familia ? maximos.get(editando.familia.prefijo) : undefined}
          categorias={categorias}
          subCategorias={subCategorias}
          empresaId={empresaId}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null);
            void recargar();
          }}
        />
      )}
    </div>
  );
}
