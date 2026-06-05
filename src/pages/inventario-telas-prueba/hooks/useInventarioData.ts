// ─────────────────────────────────────────────────────────────────────
// Hook de SOLO LECTURA del inventario.
//
// Carga rollos activos (inv_rollos) y los últimos 500 movimientos
// (inv_movimientos) de la empresa. Expone los datos ya mapeados al
// formato que usa la UI + el array RolloDB crudo (necesario para que
// las mutations puedan leer el estado previo).
//
// Si en algún momento necesitamos suscripciones realtime, este es el
// lugar correcto para agregarlas (en el useEffect inicial).
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DiscountHistoryEntry, InventoryItem } from '../types';
import {
  type MovimientoDB,
  type RolloDB,
  movDBToEntry,
  rolloDBToItem,
} from '../utils/inventario-mappers';

export type UseInventarioData = {
  items: InventoryItem[];
  historyLogs: DiscountHistoryEntry[];
  loading: boolean;
  /** RolloDB crudo. Las mutations lo necesitan para leer el estado previo del rollo. */
  rollosRaw: RolloDB[];
  /** Re-fetch desde Supabase. Las mutations lo invocan después de escribir. */
  refresh: () => Promise<void>;
};

export function useInventarioData(empresaId: string | null): UseInventarioData {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [historyLogs, setHistoryLogs] = useState<DiscountHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollosRaw, setRollosRaw] = useState<RolloDB[]>([]);

  const refresh = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    const [rollosRes, movsRes] = await Promise.all([
      (supabase as any).from('inv_rollos').select('*').eq('empresa_id', empresaId).eq('activo', true).order('cod_int'),
      (supabase as any).from('inv_movimientos').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false }).limit(500),
    ]);

    const rollos = (rollosRes.data as RolloDB[]) || [];
    setRollosRaw(rollos);
    setItems(rollos.map(rolloDBToItem));

    const rolloMap = new Map(rollos.map((r) => [r.id, r]));
    setHistoryLogs(((movsRes.data as MovimientoDB[]) || []).map((m) => movDBToEntry(m, rolloMap)));
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, historyLogs, loading, rollosRaw, refresh };
}
