// Inventario: el bodeguero prepara las tres bolsas de la OT.
//
// Es PREPARACIÓN, no despacho: acá no se descuenta stock ni se firma nada.
// Eso sigue siendo el flujo del Bodeguero, con su QR y su firma.

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { InsumoConsolidado } from '@/modules/cotizador/inventarioOT';
import type { OT } from '@/modules/ots/types';
import {
  agruparParaBodega,
  claveCheckBodega,
  claveFin,
  claveInicio,
  claveRack,
  duracionMin,
  type ColumnaBodega as Col,
} from '@/modules/produccion/bodega';
import { useCatalogoBodega, useChecks, useInsumosOT } from '@/modules/produccion/hooks';
import BotonEmergencia from '../components/BotonEmergencia';
import ColumnaBodega from '../components/ColumnaBodega';
import UbicacionDialog from '../components/UbicacionDialog';

export default function VistaInventario({ ot, otCargada }: { ot: string; otCargada: OT | null }) {
  const { insumos, loading } = useInsumosOT(otCargada);
  const { insumosCat, racks, tubos } = useCatalogoBodega();
  const { hechas, notaDe, marcar } = useChecks('bodega', ot);
  const [verMapa, setVerMapa] = useState<InsumoConsolidado | null>(null);

  const columnas = useMemo(() => agruparParaBodega(insumos), [insumos]);
  // El reloj se congela al montar: no hace falta que la pantalla lata cada
  // segundo, y así el número no salta mientras el bodeguero lee.
  const ahora = useMemo(() => Date.now(), [insumos]);

  /**
   * El primer OK de la columna abre el reloj. Se escribe una sola vez: si ya
   * hay marca de inicio, no se pisa (si no, desmarcar y volver a marcar
   * reiniciaría el tiempo y la medición no serviría de nada).
   */
  const alMarcar = async (columna: Col, clave: string, hecho: boolean) => {
    try {
      await marcar(clave, hecho);
      if (hecho && !notaDe.get(claveInicio(columna))) {
        await marcar(claveInicio(columna), true, new Date().toISOString());
      }
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const finalizar = async (columna: Col) => {
    try {
      await marcar(claveFin(columna), true, new Date().toISOString());
      toast.success('Bolsa lista.');
    } catch (e) {
      toast.error('No se pudo cerrar: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const cambiarRack = async (columna: Col, rack: string) => {
    try {
      await marcar(claveRack(columna), !!rack, rack);
    } catch (e) {
      toast.error('No se pudo guardar el rack: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para preparar sus materiales.
      </p>
    );
  }

  const total = columnas.reduce((s, c) => s + c.total, 0);
  const juntados = columnas.reduce(
    (s, c) =>
      s +
      c.secciones
        .flatMap((x) => x.items)
        .filter((i) => hechas.has(claveCheckBodega(c.columna, i))).length,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Los mismos materiales de la hoja de inventario, repartidos por bolsa.{' '}
          <strong className="text-foreground">Esto no descuenta stock</strong>: el despacho con
          firma sigue siendo el de Bodega.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {juntados} de {total}
          </span>
          <BotonEmergencia area="bodega" ot={ot} />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Armando la lista de materiales…</p>}

      {!loading && !otCargada && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no está en el sistema.
        </p>
      )}

      {!loading && otCargada && total === 0 && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no tiene materiales que preparar. Se calculan con las cortinas de la orden.
        </p>
      )}

      {otCargada && total > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {columnas.map((c) => (
            <ColumnaBodega
              key={c.columna}
              col={c}
              ot={ot}
              hechas={hechas}
              rack={notaDe.get(claveRack(c.columna)) ?? ''}
              minutos={duracionMin(
                notaDe.get(claveInicio(c.columna)),
                notaDe.get(claveFin(c.columna)),
                ahora,
              )}
              finalizada={hechas.has(claveFin(c.columna))}
              onMarcar={(clave, hecho) => alMarcar(c.columna, clave, hecho)}
              onVerMapa={setVerMapa}
              onCambiarRack={(rack) => cambiarRack(c.columna, rack)}
              onFinalizar={() => finalizar(c.columna)}
            />
          ))}
        </div>
      )}

      <UbicacionDialog
        insumo={verMapa}
        insumosCat={insumosCat}
        racks={racks}
        tubos={tubos}
        onClose={() => setVerMapa(null)}
      />
    </div>
  );
}
