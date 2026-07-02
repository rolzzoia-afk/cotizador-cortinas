// ─────────────────────────────────────────────────────────────────────
// Hoja de Inventario — Fase 4.
//
// Réplica visual de la plantilla Excel "ENTREGA Y RECEPCIÓN DE MATERIAL":
// arriba el detalle de cada cortina, al medio el consolidado de
// componentes que el bodeguero junta (con check de entregado, fecha y
// quién recibe), abajo las etiquetas y la fecha de instalación.
// Botón Imprimir genera el PDF con el mismo formato.
// ─────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { CheckCircle2, Circle, Loader2, Printer, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BomItem } from '@/modules/ots/types';
import type { OT } from '@/modules/ots/types';
import {
  claveEtiquetas,
  claveItem,
  construirEtiquetas,
  construirFilasCortinas,
  generarPDFInventario,
  totalItem,
  type EntregaItem,
  type InventarioEstado,
} from '@/modules/cotizador/inventario';

type Props = {
  ot: OT;
  items: BomItem[];
  estado: InventarioEstado;
  onChange: (estado: InventarioEstado) => void;
  readOnly: boolean;
  empresaNombre?: string | null;
  /** Hay cambios sin guardar. */
  dirty?: boolean;
  guardando?: boolean;
  onGuardar?: () => void;
};

const hoy = () => new Date().toISOString().split('T')[0];

export function InventarioSheet({ ot, items, estado, onChange, readOnly, empresaNombre, dirty, guardando, onGuardar }: Props) {
  const filas = useMemo(() => construirFilasCortinas(ot.storeVentanas || []), [ot.storeVentanas]);
  // Etiquetas por color de accesorios (blancos → INS 95-1; resto → INS 95).
  const etiquetas = useMemo(() => construirEtiquetas(ot.storeVentanas || []), [ot.storeVentanas]);
  const empresa = (empresaNombre || 'Rolzzo').toUpperCase();

  const setEntrega = (clave: string, patch: Partial<EntregaItem>) => {
    const prev = estado.entregas[clave] || { entregado: false };
    onChange({
      ...estado,
      entregas: { ...estado.entregas, [clave]: { ...prev, ...patch } },
    });
  };

  const toggleEntregado = (clave: string) => {
    const prev = estado.entregas[clave];
    const entregado = !prev?.entregado;
    setEntrega(clave, { entregado, fecha: entregado ? prev?.fecha || hoy() : prev?.fecha });
  };

  const onImprimir = () => {
    generarPDFInventario(
      filas,
      items,
      etiquetas,
      {
        ot: ot.datosGenerales.ot || '—',
        cliente: ot.datosGenerales.cliente || '—',
        empresa: empresaNombre || undefined,
        fechaInstalacion: ot.datosGenerales.fechaEntrega || undefined,
      },
      estado,
    );
  };

  const thCls = 'border border-border bg-foreground/10 px-1.5 py-1 text-left text-[0.62rem] font-bold uppercase tracking-wide';
  const tdCls = 'border border-border px-1.5 py-1 text-[0.7rem]';

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card/40">
      {/* Encabezado estilo plantilla */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div>
          <h3 className="text-base font-bold tracking-wide text-foreground">INVENTARIO</h3>
          <p className="text-[0.65rem] uppercase text-muted-foreground">
            Entrega y recepción de material
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold leading-tight">OT {ot.datosGenerales.ot || '—'}</div>
            <div className="text-[0.68rem] text-muted-foreground">
              {ot.datosGenerales.cliente || '(sin cliente)'}
            </div>
          </div>
          {onGuardar && (
            <Button
              size="sm"
              onClick={onGuardar}
              disabled={readOnly || guardando || !dirty}
              className="gap-1.5 bg-success hover:bg-success/90"
            >
              {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {dirty ? 'Guardar' : 'Guardado'}
            </Button>
          )}
          <Button size="sm" onClick={onImprimir} className="gap-1.5 bg-accent hover:bg-accent">
            <Printer className="h-3.5 w-3.5" />
            Imprimir hoja
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* 1. Cortinas */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['ID', 'Producto', 'Tipo', 'Cod mecanismo', 'Tubería', 'Adicional', 'Accionamiento', 'Peso cadena', 'Manillas', 'Ubic.', 'Ancho m', 'Alto m'].map((h) => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={12} className={`${tdCls} py-4 text-center text-muted-foreground`}>
                    No hay paños. Completa las ventanas en Fase 2.
                  </td>
                </tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.id} className="hover:bg-card">
                    <td className={`${tdCls} text-muted-foreground`}>{f.id}</td>
                    <td className={`${tdCls} font-medium`}>{f.producto}</td>
                    <td className={tdCls}>{f.tipo}</td>
                    <td className={tdCls}>{f.mecanismo}</td>
                    <td className={tdCls}>{f.tuberia}</td>
                    <td className={tdCls}>{f.adicional}</td>
                    <td className={tdCls}>{f.accionamiento}</td>
                    <td className={tdCls}>{f.pesoCadena}</td>
                    <td className={tdCls}>{f.manillas}</td>
                    <td className={tdCls}>{f.ubicacion}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{f.anchoM.toFixed(3)}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{f.altoM.toFixed(3)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Componentes consolidados */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-t bg-blue-600/80 px-3 py-2">
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              Componentes
            </span>
            <label className="flex items-center gap-2 text-[0.7rem] text-white/90">
              Entregado por:
              <Input
                value={estado.entregadoPor || ''}
                onChange={(e) => onChange({ ...estado, entregadoPor: e.target.value })}
                disabled={readOnly}
                placeholder="nombre…"
                className="h-6 w-40 bg-white/10 text-xs text-white placeholder:text-white/50"
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Descripción', 'Cant.', 'Adicional', 'Total', 'Entregado', 'Fecha', 'Recibe'].map((h) => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${tdCls} py-4 text-center text-muted-foreground`}>
                      Sin componentes calculados todavía.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => {
                    const clave = claveItem(it);
                    const ent = estado.entregas[clave];
                    const desc = [it.descripcion, it.especificacion, it.color]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <FilaEntrega
                        key={clave}
                        descripcion={desc}
                        cantidad={it.cantidad}
                        total={totalItem(it, estado)}
                        ent={ent}
                        readOnly={readOnly}
                        conAdicional
                        onToggle={() => toggleEntregado(clave)}
                        onPatch={(p) => setEntrega(clave, p)}
                        tdCls={tdCls}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Etiquetas */}
        <div>
          <div className="rounded-t bg-green-700/80 px-3 py-2">
            <span className="text-sm font-bold uppercase tracking-wide text-white">
              Etiquetas {empresa}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Cod', 'Descripción', 'Cant.', '', 'Entregado', 'Fecha', 'Recibe'].map((h, i) => (
                    <th key={i} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etiquetas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`${tdCls} py-3 text-center text-muted-foreground`}>
                      Sin cortinas todavía.
                    </td>
                  </tr>
                ) : (
                  etiquetas.map((e) => (
                    <FilaEntrega
                      key={e.cod}
                      cod={e.cod}
                      descripcion={`Etiquetas de cortinas ${e.color === 'BLANCA' ? 'blancas' : 'negras'} (${empresa})`}
                      cantidad={e.cantidad}
                      total={e.cantidad}
                      ent={estado.entregas[claveEtiquetas(e.cod)]}
                      readOnly={readOnly}
                      onToggle={() => toggleEntregado(claveEtiquetas(e.cod))}
                      onPatch={(p) => setEntrega(claveEtiquetas(e.cod), p)}
                      tdCls={tdCls}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Fecha de instalación */}
        <div className="flex justify-center">
          <div className="rounded border-2 border-foreground/60 px-6 py-2 text-center">
            <span className="text-sm font-bold uppercase">Fecha de instalación: </span>
            <span className="text-sm font-bold tabular-nums">
              {ot.datosGenerales.fechaEntrega || 'sin definir'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fila con check de entregado + fecha + recibe (+ adicional opcional).
function FilaEntrega({
  cod,
  descripcion,
  cantidad,
  total,
  ent,
  readOnly,
  conAdicional,
  onToggle,
  onPatch,
  tdCls,
}: {
  cod?: string;
  descripcion: string;
  cantidad: number;
  total: number;
  ent: EntregaItem | undefined;
  readOnly: boolean;
  conAdicional?: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<EntregaItem>) => void;
  tdCls: string;
}) {
  return (
    <tr className={ent?.entregado ? 'bg-success/10' : 'hover:bg-card'}>
      {cod !== undefined && <td className={`${tdCls} font-mono`}>{cod}</td>}
      <td className={`${tdCls} font-medium`}>{descripcion}</td>
      <td className={`${tdCls} text-center tabular-nums`}>{cantidad}</td>
      {conAdicional && (
        <td className={`${tdCls} w-20`}>
          <Input
            type="number"
            min={0}
            value={ent?.adicional ?? ''}
            onChange={(e) => onPatch({ adicional: parseInt(e.target.value) || 0 })}
            disabled={readOnly}
            placeholder="0"
            className="h-6 w-16 text-center text-xs"
          />
        </td>
      )}
      <td className={`${tdCls} w-12 text-center font-bold tabular-nums text-success`}>{total}</td>
      <td className={`${tdCls} w-28`}>
        <button
          onClick={onToggle}
          disabled={readOnly}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.68rem] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            ent?.entregado
              ? 'bg-success text-success-foreground shadow'
              : 'border border-border text-muted-foreground hover:border-success/50 hover:text-success'
          }`}
        >
          {ent?.entregado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {ent?.entregado ? 'Entregado' : 'Pendiente'}
        </button>
      </td>
      <td className={`${tdCls} w-32`}>
        <Input
          type="date"
          value={ent?.fecha || ''}
          onChange={(e) => onPatch({ fecha: e.target.value })}
          disabled={readOnly}
          className="h-6 text-xs"
        />
      </td>
      <td className={`${tdCls} w-36`}>
        <Input
          value={ent?.recibe || ''}
          onChange={(e) => onPatch({ recibe: e.target.value })}
          disabled={readOnly}
          placeholder="quién recibe…"
          className="h-6 text-xs"
        />
      </td>
    </tr>
  );
}
