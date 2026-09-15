// La grilla del asistente «Nueva categoría»: una planilla, con las mismas
// columnas del Excel maestro, donde se pegan o se escriben los productos.
import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Copy, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TIPOS_CORTINA } from '@/modules/cotizador/flujoCatalogo';
import {
  codFamilia,
  filaDeReferencia,
  filaNueva,
  recalcularFila,
  type BorradorCategoria,
  type ContextoCategoria,
  type FilaProductoNueva,
} from '@/modules/cotizador/nuevaCategoria';
import { parsearFilasPegadas } from '@/modules/cotizador/nuevaCategoriaPegado';
import type { ErroresFila } from '@/modules/cotizador/nuevaCategoriaValidar';
import { CeldaCheck, CeldaDecimal, CeldaFecha, CeldaSelect, CeldaTexto } from './celdas';

type Props = {
  borrador: BorradorCategoria;
  ctx: ContextoCategoria;
  porFila: Record<string, ErroresFila>;
  onFilas: (filas: FilaProductoNueva[]) => void;
};

const COLUMNAS = [
  'COD', 'Producto', 'COD_INT', 'Tipo', 'Descripción', 'Fecha alta', 'Proveedor',
  'Dcto %', 'Costo', 'Ganancia %', 'IVA %', 'Precio venta', 'Ancho paños', 'Gama', 'Ref.',
];

/** Una fila vacía recién creada, que el pegado puede reemplazar sin preguntar. */
const estaEnBlanco = (f: FilaProductoNueva) =>
  !f.codInt.trim() && !f.descripcion.trim() && !f.costo && !f.precio;

export default function GrillaProductos({ borrador, ctx, porFila, onFilas }: Props) {
  const [codLibre, setCodLibre] = useState(false);
  const filas = borrador.filas;

  const setFila = (id: string, patch: Partial<FilaProductoNueva>) =>
    onFilas(
      filas.map((f) => (f.id === id ? recalcularFila({ ...f, ...patch }, borrador, ctx) : f)),
    );

  const agregar = (f = filaNueva(borrador, ctx)) => onFilas([...filas, f]);

  const duplicar = (id: string) => {
    const f = filas.find((x) => x.id === id);
    if (!f) return;
    const copia = { ...filaNueva(borrador, ctx), ...f, id: filaNueva(borrador, ctx).id };
    onFilas([...filas, { ...copia, codInt: '', referencia: false }]);
  };

  const eliminar = (id: string) => onFilas(filas.filter((f) => f.id !== id));

  /** La tela de referencia es UNA por familia: marcar una desmarca a su hermana. */
  const marcarReferencia = (id: string, valor: boolean) => {
    const fam = codFamilia(borrador, filas.find((f) => f.id === id)!);
    onFilas(
      filas.map((f) =>
        f.id === id
          ? { ...f, referencia: valor }
          : valor && codFamilia(borrador, f) === fam
            ? { ...f, referencia: false }
            : f,
      ),
    );
  };

  const pegar = (e: ClipboardEvent<HTMLDivElement>) => {
    const texto = e.clipboardData.getData('text/plain');
    if (!texto || !texto.includes('\t')) return; // un valor suelto se pega normal
    const r = parsearFilasPegadas(texto, borrador, ctx);
    if (!r.filas.length) return;
    e.preventDefault();
    const quedan = filas.filter((f) => !estaEnBlanco(f));
    onFilas([...quedan, ...r.filas]);
    toast.success(
      `${r.filas.length} fila(s) pegadas${r.conCabecera ? ' (con cabecera)' : ''}.`,
      r.avisos.length ? { description: r.avisos.join(' · ') } : undefined,
    );
  };

  /** Enter y las flechas se mueven por la misma columna, como en una planilla. */
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const el = e.target as HTMLElement;
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;
    const destino = e.key === 'ArrowUp' ? r - 1 : r + 1;
    e.preventDefault();
    if (destino >= filas.length && e.key !== 'ArrowUp') {
      agregar();
      // La fila nueva se monta después: el foco se pone cuando ya existe.
      setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-r="${destino}"][data-c="${c}"]`)?.focus();
      }, 0);
      return;
    }
    document.querySelector<HTMLElement>(`[data-r="${destino}"][data-c="${c}"]`)?.focus();
  };

  const marcas = (id: string) => porFila[id] ?? { errores: {}, avisos: {} };

  return (
    <div className="space-y-2" onPaste={pegar} onKeyDown={teclas}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => agregar()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Fila
        </Button>
        {borrador.tipo !== 'accesorio' && !borrador.familiaExistente && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) agregar(filaDeReferencia(borrador, ctx, e.target.value));
            }}
            className="h-8 rounded-md border bg-secondary px-2 text-xs"
            title="La tela «COLOR POR DEFINIR» que le fija el precio a toda la familia"
          >
            <option value="">+ Tela de referencia…</option>
            {TIPOS_CORTINA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={codLibre}
            onChange={(e) => setCodLibre(e.target.checked)}
            className="h-3 w-3 accent-accent"
          />
          Editar el COD a mano
        </label>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Copia el rango en el Excel y pégalo acá (Ctrl+V). La columna IVA se ignora: es el{' '}
          {Math.round(ctx.parametros.iva * 100)} % de la empresa.
        </span>
      </div>

      <div className="max-h-[46vh] overflow-auto rounded-md border">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="sticky top-0 z-10 bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-1 py-1.5 text-left">#</th>
              {COLUMNAS.map((c) => (
                <th key={c} className="px-1 py-1.5 text-left font-medium">
                  {c}
                </th>
              ))}
              <th className="w-16 px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const m = marcas(f.id);
              const cod = codFamilia(borrador, f);
              const celda = (campo: keyof ErroresFila['errores']) => ({
                invalido: m.errores[campo],
                aviso: m.avisos[campo],
              });
              return (
                <tr key={f.id} className={f.referencia ? 'bg-accent/10' : undefined}>
                  <td className="px-1 py-0.5 text-[11px] text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-0.5">
                    {codLibre ? (
                      <CeldaTexto
                        valor={f.codManual ?? cod}
                        onChange={(v) => setFila(f.id, { codManual: v })}
                        mono
                        mayusculas
                        className="w-32"
                      />
                    ) : (
                      <span className="block w-32 truncate font-mono text-[11px] text-muted-foreground">
                        {cod}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaTexto
                      valor={f.producto}
                      onChange={(v) => setFila(f.id, { producto: v, productoAuto: false })}
                      className="w-52"
                      fila={i}
                      columna={1}
                      {...celda('producto')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaTexto
                      valor={f.codInt}
                      onChange={(v) => setFila(f.id, { codInt: v })}
                      placeholder="LN 01"
                      mono
                      mayusculas
                      className="w-24"
                      fila={i}
                      columna={2}
                      {...celda('codInt')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaSelect
                      valor={f.tipo}
                      onChange={(v) => setFila(f.id, { tipo: v })}
                      opciones={[...TIPOS_CORTINA, 'ACCESORIO']}
                      className="w-28"
                      fila={i}
                      columna={3}
                      {...celda('tipo')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaTexto
                      valor={f.descripcion}
                      onChange={(v) => setFila(f.id, { descripcion: v })}
                      placeholder="Color o diseño"
                      className="w-44"
                      fila={i}
                      columna={4}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaFecha
                      valor={f.fechaAlta}
                      onChange={(v) => setFila(f.id, { fechaAlta: v })}
                      className="w-32"
                      fila={i}
                      columna={5}
                      {...celda('fechaAlta')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaTexto
                      valor={f.proveedor}
                      onChange={(v) => setFila(f.id, { proveedor: v })}
                      className="w-28"
                      fila={i}
                      columna={6}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaDecimal
                      valor={f.descuentoPct}
                      onChange={(v) => setFila(f.id, { descuentoPct: v })}
                      className="w-16"
                      fila={i}
                      columna={7}
                      {...celda('descuentoPct')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaDecimal
                      valor={f.costo}
                      onChange={(v) => setFila(f.id, { costo: v })}
                      className="w-24"
                      fila={i}
                      columna={8}
                      {...celda('costo')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaDecimal
                      valor={f.gananciaPct}
                      onChange={(v) => setFila(f.id, { gananciaPct: v })}
                      className="w-16"
                      fila={i}
                      columna={9}
                      {...celda('gananciaPct')}
                    />
                  </td>
                  <td className="px-1 py-0.5 text-right text-[11px] text-muted-foreground">
                    {Math.round(ctx.parametros.iva * 1000) / 10}
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center gap-1">
                      <CeldaDecimal
                        valor={f.precio}
                        onChange={(v) => setFila(f.id, { precio: v, precioManual: true })}
                        className={f.precioManual ? 'w-24' : 'w-24 italic text-muted-foreground'}
                        fila={i}
                        columna={10}
                        {...celda('precio')}
                      />
                      {f.precioManual && (
                        <button
                          type="button"
                          onClick={() => setFila(f.id, { precioManual: false })}
                          title="Volver al precio automático (costo ÷ ganancia × IVA)"
                          className="text-[11px] text-muted-foreground hover:text-accent"
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaDecimal
                      valor={f.anchoRolloM}
                      onChange={(v) => setFila(f.id, { anchoRolloM: v })}
                      className="w-16"
                      fila={i}
                      columna={11}
                      {...celda('anchoRolloM')}
                    />
                  </td>
                  <td className="px-1 py-0.5">
                    <CeldaSelect
                      valor={f.gama}
                      onChange={(v) => setFila(f.id, { gama: v as '' | 'A' | 'B' })}
                      opciones={['A', 'B']}
                      vacio="—"
                      className="w-14"
                      fila={i}
                      columna={12}
                    />
                  </td>
                  <td className="px-1 py-0.5 text-center">
                    <CeldaCheck
                      valor={f.referencia}
                      onChange={(v) => marcarReferencia(f.id, v)}
                      etiqueta="Tela de referencia de la familia"
                      {...celda('referencia')}
                    />
                  </td>
                  <td className="whitespace-nowrap px-1 py-0.5 text-right">
                    <button
                      type="button"
                      onClick={() => duplicar(f.id)}
                      title="Duplicar la fila"
                      className="rounded p-1 text-muted-foreground hover:text-accent"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminar(f.id)}
                      title="Quitar la fila"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filas.length && (
              <tr>
                <td colSpan={COLUMNAS.length + 2} className="p-6 text-center text-muted-foreground">
                  Pega acá las filas del Excel, o agrégalas una a una.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {borrador.tipo !== 'accesorio' && !borrador.familiaExistente && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Star className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
          La fila marcada <strong className="font-medium">Ref.</strong> es la tela que le fija el
          precio por metro a toda su familia (el «COLOR POR DEFINIR» de la planilla). Sin ella se
          cobra la más cara que se venda.
        </p>
      )}
    </div>
  );
}
