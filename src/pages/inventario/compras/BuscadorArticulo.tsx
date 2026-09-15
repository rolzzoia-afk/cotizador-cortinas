// Buscar un artículo del catálogo (insumos y telas juntos) por código o por
// nombre. Es para lo que la orden no trae: una factura sin orden, algo que
// llegó sin estar pedido, o una línea del papel que nada reconoció.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { DominioCompra } from '@/modules/inventario/compras';
import { candidatosCatalogo, type ArticuloCatalogo } from '@/modules/inventario/recepcionCatalogo';

export function BuscadorArticulo({
  catalogo,
  inicial = '',
  dominioPreferido,
  onElegir,
  onCancelar,
}: {
  catalogo: ArticuloCatalogo[];
  inicial?: string;
  dominioPreferido?: DominioCompra | null;
  onElegir: (a: ArticuloCatalogo) => void;
  onCancelar?: () => void;
}) {
  const [q, setQ] = useState(inicial);
  const lista = useMemo(
    () => candidatosCatalogo(q, catalogo, 8, dominioPreferido),
    [q, catalogo, dominioPreferido],
  );

  return (
    <div className="flex min-w-[15rem] flex-col gap-1.5 rounded-lg border border-accent/40 bg-secondary/30 p-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código o nombre del artículo"
          className="h-8 pl-7 text-[0.78rem]"
        />
      </div>
      {catalogo.length === 0 ? (
        <p className="px-1 text-[0.72rem] text-muted-foreground">Cargando el catálogo…</p>
      ) : lista.length === 0 ? (
        <p className="px-1 text-[0.72rem] text-muted-foreground">
          {q.trim() ? 'Nada parecido en el catálogo. Si es nuevo, hay que darlo de alta primero.' : 'Escribe para buscar.'}
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {lista.map(({ articulo: a }) => (
            <li key={`${a.dominio}:${a.cod}`}>
              <button
                type="button"
                onClick={() => onElegir(a)}
                className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[0.74rem] hover:bg-secondary"
              >
                <span className="font-mono font-medium">{a.cod}</span>
                {a.dominio === 'tela' && <Badge variant="muted">tela</Badge>}
                <span className="truncate text-muted-foreground">{a.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="self-start rounded-md border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground hover:bg-secondary"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}

export default BuscadorArticulo;
