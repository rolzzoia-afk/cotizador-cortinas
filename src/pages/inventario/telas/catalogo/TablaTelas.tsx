// La tabla del catálogo de telas (lámina «Telas»).
//
// El saldo se lleva en METROS. La barra de «Total en metros» contesta la
// pregunta de bodega —¿le falta?— comparando contra el mínimo de la tela: se
// llena cuando el mínimo está cubierto y queda corta cuando no. Una tela sin
// mínimo definido no tiene barra, porque no hay contra qué compararla.

import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal, Pencil, Printer, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ItemMenu, MenuAcciones } from '@/components/inventario/MenuAcciones';
import { cn } from '@/lib/utils';
import { badgeEstadoArticulo } from '@/modules/inventario/badges';
import {
  avanceMinimo,
  descripcionTela,
  estadoTela,
  nombreFamilia,
  saldoTela,
  textoMetros,
  textoRollos,
  tieneAncho,
  type ColumnaTelas,
  type SentidoOrden,
} from '@/modules/inventario/telasCatalogo';
import type { Tela } from '../Telas.types';

const COLUMNAS: ReadonlyArray<{
  id: ColumnaTelas;
  texto: string;
  clase: string;
  derecha?: boolean;
}> = [
  { id: 'codigo', texto: 'Código', clase: 'w-[86px]' },
  { id: 'descripcion', texto: 'Descripción', clase: '' },
  { id: 'familia', texto: 'Familia', clase: 'w-[104px]' },
  { id: 'ancho', texto: 'Ancho', clase: 'w-[74px]', derecha: true },
  { id: 'mp', texto: 'Mat. pr.', clase: 'w-[82px]', derecha: true },
  { id: 'liberado', texto: 'Liberado', clase: 'w-[82px]', derecha: true },
  { id: 'total', texto: 'Total en metros', clase: 'w-[168px]' },
];

/** El color de la barra sigue al estado: el mismo idioma que el badge. */
const COLOR_BARRA: Record<string, string> = {
  con_stock: 'bg-success',
  sin_minimo: 'bg-accent',
  bajo_minimo: 'bg-warning',
  sin_stock: 'bg-destructive',
  negativo: 'bg-destructive',
  descontinuado: 'bg-muted-foreground/40',
};

function Fila({
  t,
  marcada,
  onMarcar,
  ruta,
  onEditar,
  onQr,
  onEtiqueta,
}: {
  t: Tela;
  marcada: boolean;
  onMarcar: () => void;
  ruta: string;
  onEditar: () => void;
  onQr: () => void;
  onEtiqueta: () => void;
}) {
  const total = saldoTela(t);
  const estado = estadoTela(t);
  const badge = badgeEstadoArticulo({
    total,
    minimo: t.stock_minimo,
    status: String(t.estado ?? '').toUpperCase() === 'DESCONTINUADO' ? 'DESCONTINUADO' : t.status_stock,
  });
  const avance = avanceMinimo(total, t.stock_minimo);
  const navegar = useNavigate();

  return (
    <tr
      // La fila entera abre la ficha, como siempre; la casilla y el «···»
      // cortan el clic para no llevarse a nadie de paso.
      onClick={() => navegar(ruta)}
      className={cn(
        'cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-accent/[0.05]',
        marcada && 'bg-accent/[0.09]',
        estado === 'descontinuado' && 'opacity-70',
      )}
    >
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={marcada}
          onChange={onMarcar}
          aria-label={`Marcar ${t.codigo} para etiquetas`}
          className="h-3.5 w-3.5 cursor-pointer align-middle accent-accent"
        />
      </td>
      <td className="whitespace-nowrap px-2.5 py-2">
        <Link to={ruta} className="font-mono font-medium hover:text-accent hover:underline">
          {t.codigo}
        </Link>
      </td>
      <td className="px-2.5 py-2">
        <Link to={ruta} className="hover:text-accent">
          {descripcionTela(t)}
        </Link>
        {t.posicion ? (
          <span className="ml-2 font-mono text-[0.6875rem] text-accent">{t.posicion}</span>
        ) : null}
      </td>
      <td className="px-2.5 py-2 text-muted-foreground">{nombreFamilia(t.tipo)}</td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono">
        {tieneAncho(t) ? (
          textoMetros(t.ancho)
        ) : (
          // El ancho que falta se dice: el corte asume 2,98 en silencio.
          <span className="text-destructive" title="Sin ancho de rollo registrado">
            sin dato
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono text-muted-foreground">
        {textoMetros(t.stock_mp ?? 0)}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono text-muted-foreground">
        {textoMetros(t.stock_liberado ?? 0)}
      </td>
      <td className="px-2.5 py-2">
        <div className="flex items-center gap-2">
          <b className="w-[58px] shrink-0 text-right font-mono font-semibold">
            {textoMetros(total)}
          </b>
          <div
            className="h-1.5 min-w-[52px] flex-1 overflow-hidden rounded-full bg-secondary"
            title={
              avance == null
                ? 'Esta tela no tiene mínimo definido'
                : `${avance} % del mínimo de ${textoMetros(t.stock_minimo)} m`
            }
          >
            {avance != null && (
              <div
                className={cn('h-full rounded-full', COLOR_BARRA[estado] ?? 'bg-accent')}
                style={{ width: `${avance}%` }}
              />
            )}
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-2.5 py-2 text-right font-mono text-muted-foreground">
        {textoRollos(total, t.metros_rollo)}
      </td>
      <td className="px-2.5 py-2">
        <Badge variant={badge.variante}>{badge.texto}</Badge>
      </td>
      <td className="px-1 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <MenuAcciones
          etiqueta={`Acciones de ${t.codigo}`}
          disparador={<MoreHorizontal className="h-4 w-4" />}
          className="rounded-md p-1.5 align-middle text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ItemMenu onClick={onEditar}>
            <Pencil className="h-3.5 w-3.5" /> Editar la ficha
          </ItemMenu>
          <ItemMenu onClick={onQr} hint="Para pegarlo en el rack y escanearlo al despachar">
            <QrCode className="h-3.5 w-3.5" /> Ver el QR
          </ItemMenu>
          <ItemMenu onClick={onEtiqueta} hint="La del catálogo de muestras, en la Brother">
            <Printer className="h-3.5 w-3.5" /> Imprimir la etiqueta
          </ItemMenu>
        </MenuAcciones>
      </td>
    </tr>
  );
}

export function TablaTelas({
  filas,
  total,
  orden,
  sentido,
  onOrden,
  seleccion,
  onMarcar,
  onMarcarTodas,
  rutaFicha,
  onEditar,
  onQr,
  onEtiqueta,
  sinAncho,
}: {
  filas: Tela[];
  /** Cuántos códigos tiene el catálogo entero, para el pie. */
  total: number;
  orden: ColumnaTelas;
  sentido: SentidoOrden;
  onOrden: (col: ColumnaTelas) => void;
  seleccion: Set<string>;
  onMarcar: (codigo: string) => void;
  onMarcarTodas: () => void;
  rutaFicha: (codigo: string) => string;
  onEditar: (t: Tela) => void;
  onQr: (t: Tela) => void;
  onEtiqueta: (t: Tela) => void;
  /** Cuántas de las filas visibles no declaran el ancho de su rollo. */
  sinAncho: number;
}) {
  const todasMarcadas = filas.length > 0 && filas.every((t) => seleccion.has(t.codigo));

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1020px] text-[0.78rem] tabular-nums">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="h-10 w-[34px] px-2 text-left font-medium">
                <input
                  type="checkbox"
                  checked={todasMarcadas}
                  onChange={onMarcarTodas}
                  aria-label="Marcar todas las telas de la lista"
                  title={todasMarcadas ? 'Desmarcar todas' : 'Marcar todas las de la lista'}
                  className="h-3.5 w-3.5 cursor-pointer align-middle accent-accent"
                />
              </th>
              {COLUMNAS.map((c) => (
                <th
                  key={c.id}
                  className={cn('h-10 px-2.5 font-medium', c.clase, c.derecha && 'text-right')}
                >
                  <button
                    type="button"
                    onClick={() => onOrden(c.id)}
                    className={cn(
                      'inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-foreground',
                      orden === c.id && 'text-accent',
                    )}
                  >
                    {c.texto}
                    {orden === c.id && <span aria-hidden>{sentido === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
              ))}
              <th className="h-10 w-[76px] px-2.5 text-right font-medium">Rollos</th>
              <th className="h-10 w-[112px] px-2.5 text-left font-medium">
                <button
                  type="button"
                  onClick={() => onOrden('estado')}
                  className={cn(
                    'inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-foreground',
                    orden === 'estado' && 'text-accent',
                  )}
                >
                  Estado
                  {orden === 'estado' && <span aria-hidden>{sentido === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
              <th className="h-10 w-[40px] px-1" />
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <Fila
                key={t.id}
                t={t}
                marcada={seleccion.has(t.codigo)}
                onMarcar={() => onMarcar(t.codigo)}
                ruta={rutaFicha(t.codigo)}
                onEditar={() => onEditar(t)}
                onQr={() => onQr(t)}
                onEtiqueta={() => onEtiqueta(t)}
              />
            ))}
          </tbody>
        </table>
        {filas.length === 0 && (
          <EmptyState
            titulo="Ninguna tela calza"
            texto="Con estos filtros no queda nada. Prueba soltando la familia o el proveedor, o busca por el código."
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-xs text-muted-foreground">
        <span>
          {filas.length.toLocaleString('es-CL')} de {total.toLocaleString('es-CL')} códigos
        </span>
        {seleccion.size > 0 && (
          <Badge variant="accent">{seleccion.size} marcadas para etiquetas</Badge>
        )}
        {sinAncho > 0 && (
          <Badge variant="destructive" className="ml-auto">
            {sinAncho} sin ancho de rollo registrado: el corte asume 2,98 en silencio
          </Badge>
        )}
      </div>
    </div>
  );
}

export default TablaTelas;
