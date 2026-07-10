import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogoProductos } from '@/modules/cotizador/types';

// Solo productos de tipo CORTINA (no accesorios): así el código elegido siempre
// es cotizable como cortina en la cotización (Fase 1 / Fase 3).
const TIPOS_CORTINA = ['PREMIUM', 'DELUX', 'STANDARD', 'BASIC'];
const esCortina = (tipo?: string) => TIPOS_CORTINA.includes((tipo || '').toUpperCase().trim());

export type ProductoSeleccion = {
  codInt: string;
  producto: string;
  tipo: string;
  descripcion: string;
};

/**
 * Selector de producto del catálogo para Fase 2. Reemplaza el texto libre:
 * garantiza que el `codInt` de la cortina exista y sea cotizable. Si la ventana
 * trae un codInt viejo fuera del catálogo, lo muestra igual (compatibilidad).
 */
export function ProductoSelectorFase2({
  value,
  catalogo,
  onSelect,
}: {
  value: string;
  catalogo: CatalogoProductos;
  onSelect: (sel: ProductoSeleccion) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [abierto]);

  const actual = value ? catalogo[value.trim()] : undefined;

  const resultados = useMemo(() => {
    const s = q.trim().toUpperCase();
    return Object.entries(catalogo)
      .filter(([ci, p]) => {
        if (!esCortina(p.tipo)) return false;
        if (!s) return true;
        return `${ci} ${p.producto || ''} ${p.cod || ''}`.toUpperCase().includes(s);
      })
      .sort((a, b) => (a[1].producto || '').localeCompare(b[1].producto || ''))
      .slice(0, 200);
  }, [catalogo, q]);

  const elegir = (ci: string) => {
    const p = catalogo[ci];
    if (!p) return;
    onSelect({
      codInt: ci,
      producto: p.producto || '',
      tipo: p.tipo || '',
      descripcion: p.descripcion || '',
    });
    setAbierto(false);
    setQ('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2 text-left text-sm hover:border-accent/50"
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>
          {value ? `${value}${actual ? ` — ${actual.producto}` : ''}` : 'Elegir producto…'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {abierto && (
        <div className="absolute z-30 mt-1 w-full min-w-[18rem] rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto o código…"
              className="w-full bg-transparent text-xs text-foreground outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {resultados.length === 0 && (
              <li className="px-3 py-2 text-center text-xs text-muted-foreground">Sin resultados.</li>
            )}
            {resultados.map(([ci, p]) => (
              <li key={ci}>
                <button
                  type="button"
                  onClick={() => elegir(ci)}
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-accent/10',
                    ci === value.trim() && 'bg-accent/15',
                  )}
                >
                  <span className="text-xs font-semibold">
                    {ci} <span className="font-normal text-muted-foreground">· {p.tipo}</span>
                  </span>
                  <span className="text-[0.7rem] text-muted-foreground">{p.producto}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ProductoSelectorFase2;
