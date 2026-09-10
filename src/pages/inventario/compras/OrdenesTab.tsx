// Las órdenes de compra que aprobó Gerencia, y que la bodega espera.
//
// El buscador es uno solo y busca por lo que el bodeguero tiene en la mano:
// el número de guía del papel, el número de orden, el RUT o el proveedor.

import { useMemo, useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ChipBusqueda, ChipFiltro, SeparadorChips } from '@/components/inventario/ChipsFiltro';
import { StatBox } from '@/components/ui/stat-box';
import {
  FILTROS_ORDENES,
  filtrarOrdenes,
  ordenarOrdenes,
  resumenOrdenes,
  type FiltroOrdenes,
  type OrdenCompra,
} from '@/modules/inventario/compras';
import { mensajeSincronizacion, textoDesdeSync } from '@/modules/inventario/comprasMensajes';
import { sincronizarOrdenes } from '@/modules/inventario/comprasStore';
import TablaOrdenes from './TablaOrdenes';

export function OrdenesTab({
  ordenes,
  ultimaSync,
  errorSync,
  puedeSincronizar,
  queryRol,
  onCambio,
}: {
  ordenes: OrdenCompra[];
  ultimaSync: string | null;
  errorSync: string | null;
  /** Hablar con Finanzas es de admin: es la puerta a otro sistema. */
  puedeSincronizar: boolean;
  queryRol: string;
  onCambio: () => Promise<void>;
}) {
  const [filtro, setFiltro] = useState<FiltroOrdenes>('abiertas');
  const [busqueda, setBusqueda] = useState('');
  const [sincronizando, setSincronizando] = useState(false);

  const resumen = useMemo(() => resumenOrdenes(ordenes), [ordenes]);
  const lista = useMemo(() => {
    const filtradas = filtrarOrdenes(ordenes, filtro, busqueda);
    // Con búsqueda manda el puntaje (la guía primero); sin ella, el estado.
    return busqueda.trim() ? filtradas : ordenarOrdenes(filtradas);
  }, [ordenes, filtro, busqueda]);

  const sincronizar = async (modo?: 'probar') => {
    setSincronizando(true);
    try {
      const r = await sincronizarOrdenes(modo);
      if (modo === 'probar') {
        toast.success(
          `Finanzas contesta: ${r.ordenes ?? 0} órdenes y ${r.lineas} líneas. No se guardó nada.`,
        );
      } else {
        toast.success(mensajeSincronizacion(r));
        await onCambio();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      await onCambio();
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatBox rotulo="En espera" valor={resumen.enEspera} tono="accent" />
        <StatBox rotulo="Llegaron en parte" valor={resumen.parciales} tono="warning" />
        <StatBox
          rotulo="Líneas por llegar"
          valor={resumen.lineasPendientes}
          hint="de las órdenes abiertas"
        />
        <StatBox
          rotulo="Sin artículo"
          valor={resumen.sinVincular}
          tono={resumen.sinVincular > 0 ? 'warning' : 'neutro'}
          hint="hay que decir qué son"
        />
      </div>

      {errorSync && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.08] px-4 py-2.5 text-xs leading-relaxed">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <b className="font-semibold">La última vez no se pudo hablar con Finanzas.</b>{' '}
            {errorSync} Lo que se ve abajo es la última copia que llegó bien.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ChipBusqueda
          valor={busqueda}
          onChange={setBusqueda}
          etiqueta="Buscar una orden"
          // El proveedor va primero a propósito: Finanzas casi nunca registra
          // la guía al emitir la orden (1 de 7 el 2026-09-10), así que el
          // camino real es el nombre del proveedor del papel que llegó. La
          // guía sigue ganando cuando está, pero no se puede prometer.
          placeholder="Proveedor, número de orden, RUT o guía…"
          ancho="w-[19rem]"
        />
        <SeparadorChips />
        {FILTROS_ORDENES.map((f) => (
          <ChipFiltro key={f.id} activo={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.texto}
          </ChipFiltro>
        ))}
        {puedeSincronizar && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[0.72rem] text-muted-foreground">
              Finanzas: {textoDesdeSync(ultimaSync)}
            </span>
            <button
              onClick={() => void sincronizar()}
              disabled={sincronizando}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[0.8125rem] font-medium transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={sincronizando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Actualizar desde Finanzas
            </button>
          </div>
        )}
      </div>

      <TablaOrdenes
        ordenes={lista}
        total={ordenes.length}
        rutaFicha={(id) => `/inventario/compras/${id}${queryRol}`}
      />

      {puedeSincronizar && ordenes.length === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          ¿Primera vez? «
          <button
            onClick={() => void sincronizar('probar')}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Probar sin guardar
          </button>
          » pregunta a Finanzas qué contestaría, sin escribir nada acá. Sirve para confirmar que el
          contrato está bien puesto antes de traer datos.
        </p>
      )}
    </div>
  );
}

export default OrdenesTab;
