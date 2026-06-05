// Tab "Catálogo": stats arriba + filtros + tabla ordenable de insumos.

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  QrCode,
  Search,
  Tags,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type EstadoFiltro,
  type Insumo,
  formatCLP,
  getStockTotal,
} from '@/modules/inventario/helpers';
import StatCard from '../components/StatCard';
import SortTh from '../components/SortTh';
import StockBadge from '../components/StockBadge';
import type { MovTipo, SortCol, SortDir } from '../Inventario.types';

interface CatalogoTabProps {
  insumosFiltrados: Insumo[];
  statsCatalogo: {
    total: number;
    conStock: number;
    sinStock: number;
    bajoMin: number;
    categorias: number;
  };
  categorias: string[];
  subCategorias: string[];
  busqueda: string;
  setBusqueda: (v: string) => void;
  filtroCategoria: string;
  setFiltroCategoria: (v: string) => void;
  filtroSubCategoria: string;
  setFiltroSubCategoria: (v: string) => void;
  filtroEstado: EstadoFiltro;
  setFiltroEstado: (v: EstadoFiltro) => void;
  sortCol: SortCol;
  sortDir: SortDir;
  onSort: (c: SortCol) => void;
  onNuevoInsumo: () => void;
  onEditarInsumo: (ins: Insumo) => void;
  onQR: (ins: Insumo) => void;
  onNuevoMov: (tipo: MovTipo, codigo?: string) => void;
  onLightbox: (foto: { url: string; cod: string }) => void;
}

export default function CatalogoTab({
  insumosFiltrados,
  statsCatalogo,
  categorias,
  subCategorias,
  busqueda,
  setBusqueda,
  filtroCategoria,
  setFiltroCategoria,
  filtroSubCategoria,
  setFiltroSubCategoria,
  filtroEstado,
  setFiltroEstado,
  sortCol,
  sortDir,
  onSort,
  onNuevoInsumo,
  onEditarInsumo,
  onQR,
  onNuevoMov,
  onLightbox,
}: CatalogoTabProps) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="Total" value={statsCatalogo.total} icon={<Boxes className="h-3.5 w-3.5" />} />
        <StatCard
          label="Con stock"
          value={statsCatalogo.conStock}
          tone="success"
          icon={<Package className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Sin stock"
          value={statsCatalogo.sinStock}
          tone="danger"
          icon={<XCircle className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Bajo mínimo"
          value={statsCatalogo.bajoMin}
          tone="warning"
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Categorías"
          value={statsCatalogo.categorias}
          tone="info"
          icon={<Tags className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nemotécnico, color…"
            className="pl-8"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtroSubCategoria}
          onChange={(e) => setFiltroSubCategoria(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Todas las sub-categorías</option>
          {subCategorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as EstadoFiltro)}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="con_stock">Con stock</option>
          <option value="sin_stock">Sin stock</option>
          <option value="bajo_minimo">Bajo mínimo</option>
          <option value="sin_minimo">Sin mínimo definido</option>
          <option value="sin_ubicacion">Sin ubicación</option>
        </select>
        <Button onClick={onNuevoInsumo} size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
        <Button onClick={() => onNuevoMov('NUEVO INGRESO')} size="sm" variant="outline" className="gap-1">
          <ArrowDownCircle className="h-4 w-4" /> Entrada
        </Button>
        <Button onClick={() => onNuevoMov('SALIDA PRODUCCION')} size="sm" variant="outline" className="gap-1">
          <ArrowUpCircle className="h-4 w-4" /> Salida
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card/40">
        <table className="w-full text-xs">
          <thead className="bg-card text-[0.68rem] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2"></th>
              <SortTh col="cod" current={sortCol} dir={sortDir} onSort={onSort}>
                Código
              </SortTh>
              <SortTh col="nemotecnico" current={sortCol} dir={sortDir} onSort={onSort}>
                Nemotécnico
              </SortTh>
              <SortTh col="categoria" current={sortCol} dir={sortDir} onSort={onSort}>
                Categoría
              </SortTh>
              <th className="p-2 text-left">Sub-cat</th>
              <th className="p-2 text-left">Proveedor</th>
              <SortTh col="ubicacion" current={sortCol} dir={sortDir} onSort={onSort}>
                Ubicación
              </SortTh>
              <SortTh col="stock_total" current={sortCol} dir={sortDir} onSort={onSort} align="center">
                Stock
              </SortTh>
              <th className="p-2 text-center">MP</th>
              <th className="p-2 text-center">Lib</th>
              <SortTh col="minimo" current={sortCol} dir={sortDir} onSort={onSort} align="center">
                Mín
              </SortTh>
              <th className="p-2 text-right">Costo</th>
              <th className="p-2 text-center">Estado</th>
              <th className="p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {insumosFiltrados.length === 0 && (
              <tr>
                <td colSpan={14} className="p-6 text-center text-muted-foreground">
                  No hay insumos que coincidan con el filtro.
                </td>
              </tr>
            )}
            {insumosFiltrados.map((i) => {
              const st = getStockTotal(i);
              return (
                <tr key={i.id} className="border-t border-border hover:bg-card">
                  <td className="p-1 text-center">
                    {i.foto_url ? (
                      <button
                        type="button"
                        onClick={() => onLightbox({ url: i.foto_url!, cod: i.cod || '' })}
                        className="mx-auto block rounded transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Ver imagen ampliada"
                      >
                        <img
                          src={i.foto_url}
                          alt=""
                          className="h-8 w-8 cursor-zoom-in rounded object-cover"
                          loading="lazy"
                        />
                      </button>
                    ) : (
                      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded bg-secondary text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </td>
                  <td className="p-2 font-mono font-semibold text-foreground">{i.cod}</td>
                  <td className="p-2 max-w-[220px] truncate">
                    {i.nemotecnico || i.descriptor_proveedor || '—'}
                  </td>
                  <td className="p-2 text-foreground">{i.categoria || '—'}</td>
                  <td className="p-2 text-muted-foreground">{i.sub_categoria || '—'}</td>
                  <td className="p-2 text-muted-foreground">{i.proveedor || '—'}</td>
                  <td className="p-2 text-muted-foreground">{i.ubicacion || '—'}</td>
                  <td
                    className={cn(
                      'p-2 text-center font-semibold',
                      st <= 0
                        ? 'text-destructive'
                        : (i.minimo || 0) > 0 && st < (i.minimo || 0)
                          ? 'text-warning'
                          : 'text-foreground',
                    )}
                  >
                    {st}
                  </td>
                  <td className="p-2 text-center text-muted-foreground">{i.stock_mp || 0}</td>
                  <td className="p-2 text-center text-muted-foreground">{i.stock_liberado || 0}</td>
                  <td className="p-2 text-center text-muted-foreground">{i.minimo || 0}</td>
                  <td className="p-2 text-right text-muted-foreground">${formatCLP(i.costo)}</td>
                  <td className="p-2 text-center">
                    <StockBadge insumo={i} />
                  </td>
                  <td className="p-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => onEditarInsumo(i)}
                        className="rounded border border-border bg-card p-1 text-foreground hover:bg-card"
                        title="Editar"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onQR(i)}
                        className="rounded border border-accent/30 bg-accent/10 p-1 text-accent hover:bg-accent/20"
                        title="Ver / imprimir QR"
                      >
                        <QrCode className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onNuevoMov('NUEVO INGRESO', i.cod || '')}
                        className="rounded border border-success/30 bg-success/15 p-1 text-success hover:bg-success/15"
                        title="Registrar entrada"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
