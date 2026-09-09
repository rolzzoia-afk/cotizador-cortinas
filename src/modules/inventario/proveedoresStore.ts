// Los proveedores que ya existen, sacados de los artículos.
//
// No hay tabla de proveedores: el nombre es un texto suelto en cada insumo y
// en cada tela. Esto los junta y los cuenta, que es lo único que se puede
// afirmar hoy sobre ellos.
//
// Se normaliza para agrupar («CHANTILLY» y «Chantilly» son el mismo), pero se
// muestra la grafía más usada: renombrar al proveedor de alguien en pantalla
// hace dudar de si es el mismo.

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type Proveedor = { nombre: string; insumos: number; telas: number };

function clave(nombre: string): string {
  return nombre.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function useProveedores(): {
  proveedores: Proveedor[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rIns, rTel] = await Promise.all([
        supabase.from('insumos').select('proveedor').eq('empresa_id', empresaId),
        supabase.from('telas_catalogo').select('proveedor').eq('empresa_id', empresaId),
      ]);
      if (rIns.error) throw rIns.error;

      // Por cada nombre normalizado se cuenta cuántas veces aparece cada
      // grafía, para poder mostrar la que más se usa.
      const acumulado = new Map<
        string,
        { insumos: number; telas: number; grafias: Map<string, number> }
      >();
      const sumar = (crudo: string | null, campo: 'insumos' | 'telas') => {
        const nombre = String(crudo ?? '').trim();
        if (!nombre) return;
        const k = clave(nombre);
        const actual = acumulado.get(k) ?? { insumos: 0, telas: 0, grafias: new Map() };
        actual[campo]++;
        actual.grafias.set(nombre, (actual.grafias.get(nombre) ?? 0) + 1);
        acumulado.set(k, actual);
      };
      for (const i of rIns.data || []) sumar(i.proveedor, 'insumos');
      for (const t of rTel.data || []) sumar(t.proveedor, 'telas');

      const lista: Proveedor[] = [...acumulado.values()].map((v) => {
        let nombre = '';
        let max = -1;
        for (const [g, n] of v.grafias) {
          if (n > max) {
            max = n;
            nombre = g;
          }
        }
        return { nombre, insumos: v.insumos, telas: v.telas };
      });
      lista.sort((a, b) => b.insumos + b.telas - (a.insumos + a.telas));

      setProveedores(lista);
      setLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`No se pudieron leer los proveedores: ${msg}`);
      setProveedores([]);
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { proveedores, loading, error, recargar: cargar };
}
