import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { CatalogoProductos } from './types';

// Hook: carga el catálogo de productos de la empresa actual.
// Fuente: tabla `configuracion`, clave 'catalogo_productos_data', valor JSON string.
// Portado del legacy cargarCatalogoFirebase() líneas 2714-2732.
export function useCatalogoProductos(): {
  catalogo: CatalogoProductos;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [catalogo, setCatalogo] = useState<CatalogoProductos>({});
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    if (!empresaId) {
      setCatalogo({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('empresa_id', empresaId)
        .eq('clave', 'catalogo_productos_data')
        .maybeSingle<{ valor: string }>();
      if (error) throw error;
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor);
          setCatalogo(parsed || {});
        } catch {
          setCatalogo({});
        }
      } else {
        setCatalogo({});
      }
    } catch (e) {
      console.warn('[Catálogo] Error cargando:', e);
      setCatalogo({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  return { catalogo, loading, refresh: cargar };
}

// Hook: carga el mapa de ancho de rollo por producto (COD_INT → metros).
// Fuente: tabla `configuracion`, clave 'ancho_rollo_data' (JSON string).
// Lo usa el motor de precio de Fase 0 para la optimización de telas.
export function useAnchoRollo(): {
  anchoRollo: Record<string, number>;
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [anchoRollo, setAnchoRollo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setAnchoRollo({});
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('configuracion')
          .select('valor')
          .eq('empresa_id', empresaId)
          .eq('clave', 'ancho_rollo_data')
          .maybeSingle<{ valor: string }>();
        if (data?.valor) {
          try {
            setAnchoRollo(JSON.parse(data.valor) || {});
          } catch {
            setAnchoRollo({});
          }
        } else {
          setAnchoRollo({});
        }
      } catch {
        setAnchoRollo({});
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  return { anchoRollo, loading };
}
