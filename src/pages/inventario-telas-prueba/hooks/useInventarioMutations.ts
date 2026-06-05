// ─────────────────────────────────────────────────────────────────────
// Hook de ESCRITURA del inventario.
//
// Agrupa todas las mutations sobre `inv_rollos` e `inv_movimientos`:
//   - ajustarStock        (DESCUENTO / INCREMENTO sobre stock vivo)
//   - editarStockAsignado (admin redefine totales — también resetea metros_originales)
//   - agregarRollo        (alta de un nuevo rollo en el catálogo)
//   - eliminarRollo       (soft delete: activo=false)
//   - reiniciarInventario (vuelve todos los rollos a metros_originales)
//   - borrarMovimiento    (borra una entrada del historial)
//
// Recibe por parámetro `refresh` y `rollosRaw` del hook de lectura, así
// no duplica estado. Cada mutation invoca refresh al final.
// ─────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { InventoryItem } from '../types';
import type { RolloDB } from '../utils/inventario-mappers';

export type UseInventarioMutations = {
  ajustarStock: (
    itemId: string,
    meters: number,
    tipo: 'DESCUENTO' | 'INCREMENTO',
    comentario: string,
    vendedorEmail: string,
  ) => Promise<void>;
  editarStockAsignado: (
    itemId: string,
    nuevoRollos: number,
    nuevoMetrosPorRollo: number,
    nuevoTotalMetros: number,
    comentario: string,
    vendedorEmail: string,
  ) => Promise<void>;
  agregarRollo: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  eliminarRollo: (itemId: string) => Promise<void>;
  reiniciarInventario: (vendedorEmail: string) => Promise<void>;
  borrarMovimiento: (logId: string) => Promise<void>;
};

export function useInventarioMutations(
  empresaId: string | null,
  rollosRaw: RolloDB[],
  refresh: () => Promise<void>,
): UseInventarioMutations {
  const ajustarStock = useCallback<UseInventarioMutations['ajustarStock']>(
    async (itemId, meters, tipo, comentario, vendedorEmail) => {
      const rollo = rollosRaw.find((r) => r.id === itemId);
      if (!rollo) throw new Error('Rollo no encontrado');

      const previo = rollo.total_metros;
      const nuevo = tipo === 'DESCUENTO' ? Math.max(0, previo - meters) : previo + meters;
      const nuevosRollos =
        rollo.metros_x_rollo > 0 ? Math.ceil(nuevo / rollo.metros_x_rollo) : rollo.rollos;

      const { error: upErr } = await (supabase as any).from('inv_rollos')
        .update({
          total_metros: parseFloat(nuevo.toFixed(2)),
          rollos: nuevosRollos,
          comentario: nuevo === 0 ? 'STOCK LIMITADO' : rollo.comentario,
        })
        .eq('id', itemId);
      if (upErr) throw upErr;

      const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
        empresa_id: empresaId,
        rollo_id: itemId,
        tipo,
        cantidad_metros: meters,
        anterior_metros: previo,
        nuevo_metros: parseFloat(nuevo.toFixed(2)),
        anterior_rollos: rollo.rollos,
        nuevo_rollos: nuevosRollos,
        comentario,
        vendedor_email: vendedorEmail,
      });
      if (movErr) throw movErr;
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  const editarStockAsignado = useCallback<UseInventarioMutations['editarStockAsignado']>(
    async (itemId, nuevoRollos, nuevoMetrosPorRollo, nuevoTotalMetros, comentario, vendedorEmail) => {
      const rollo = rollosRaw.find((r) => r.id === itemId);
      if (!rollo) throw new Error('Rollo no encontrado');

      const { error: upErr } = await (supabase as any).from('inv_rollos')
        .update({
          rollos: nuevoRollos,
          metros_x_rollo: nuevoMetrosPorRollo,
          total_metros: nuevoTotalMetros,
          // Al editar el stock asignado, también se "resetea" el 100% de la barra.
          metros_originales: nuevoTotalMetros,
        })
        .eq('id', itemId);
      if (upErr) throw upErr;

      const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
        empresa_id: empresaId,
        rollo_id: itemId,
        tipo: 'EDICION_STOCK',
        anterior_metros: rollo.total_metros,
        nuevo_metros: nuevoTotalMetros,
        anterior_rollos: rollo.rollos,
        nuevo_rollos: nuevoRollos,
        comentario,
        vendedor_email: vendedorEmail,
      });
      if (movErr) throw movErr;
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  const agregarRollo = useCallback<UseInventarioMutations['agregarRollo']>(
    async (item) => {
      const descPct = parseFloat(String(item.descuento).replace('%', '')) / 100 || 0.3;
      const { error } = await (supabase as any).from('inv_rollos').insert({
        empresa_id: empresaId,
        cod: item.cod,
        producto: item.producto,
        cod_int: item.cod_int,
        tipo: item.tipo,
        descripcion: item.descripcion,
        tela_verticales: item.telaVerticales,
        descuento_pct: descPct,
        rollos: item.rollos,
        metros_x_rollo: item.metros,
        total_metros: item.totalMetros,
        // Al crear, el 100% de la barra = stock inicial.
        metros_originales: item.totalMetros,
        comentario: item.comentario,
      });
      if (error) throw error;
      await refresh();
    },
    [empresaId, refresh],
  );

  const eliminarRollo = useCallback<UseInventarioMutations['eliminarRollo']>(
    async (itemId) => {
      const { error } = await (supabase as any).from('inv_rollos').update({ activo: false }).eq('id', itemId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const reiniciarInventario = useCallback<UseInventarioMutations['reiniciarInventario']>(
    async (vendedorEmail) => {
      if (!empresaId) throw new Error('Sin empresa');
      for (const rollo of rollosRaw) {
        const original = (rollo as any).metros_originales ?? rollo.total_metros;
        if (Number(original) === Number(rollo.total_metros)) continue;
        const nuevosRollos =
          rollo.metros_x_rollo > 0 ? Math.ceil(original / rollo.metros_x_rollo) : rollo.rollos;
        const { error: upErr } = await (supabase as any).from('inv_rollos')
          .update({
            total_metros: original,
            rollos: nuevosRollos,
            comentario: original === 0 ? 'STOCK LIMITADO' : null,
          })
          .eq('id', rollo.id);
        if (upErr) throw upErr;
        const { error: movErr } = await (supabase as any).from('inv_movimientos').insert({
          empresa_id: empresaId,
          rollo_id: rollo.id,
          tipo: 'INCREMENTO',
          cantidad_metros: Number(original) - Number(rollo.total_metros),
          anterior_metros: rollo.total_metros,
          nuevo_metros: original,
          anterior_rollos: rollo.rollos,
          nuevo_rollos: nuevosRollos,
          comentario: '[RESET] Reinicio de inventario — volvió al stock original',
          vendedor_email: vendedorEmail,
        });
        if (movErr) throw movErr;
      }
      await refresh();
    },
    [empresaId, rollosRaw, refresh],
  );

  const borrarMovimiento = useCallback<UseInventarioMutations['borrarMovimiento']>(
    async (logId) => {
      const { error } = await (supabase as any).from('inv_movimientos').delete().eq('id', logId);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    ajustarStock,
    editarStockAsignado,
    agregarRollo,
    eliminarRollo,
    reiniciarInventario,
    borrarMovimiento,
  };
}
