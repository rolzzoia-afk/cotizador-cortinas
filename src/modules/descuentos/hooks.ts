// Hook: catálogo de descuentos de fabricación de la empresa actual.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ModeloDespiece } from './tipos';

export function useDescuentosModelo(): {
  modelos: ModeloDespiece[];
  sistemas: string[];
  loading: boolean;
} {
  const { empresaId } = useAuth();
  const [modelos, setModelos] = useState<ModeloDespiece[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setModelos([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('descuentos_modelo' as never)
          .select(
            'sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm, dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm, dcto_cenefa_del_cm, dcto_cenefa_tra_cm, dcto_perfiles_cm, peso_interno_duo_cm, peso_u_duo_cm, ancho_max_m, activo, notas',
          )
          .eq('empresa_id', empresaId)
          .eq('activo', true)
          .order('sistema')
          .order('tipo_rol')
          .order('mecanismo');
        if (error) throw error;
        const filas = ((data as unknown as Record<string, unknown>[]) ?? []).map((d) => ({
          ...d,
          // numeric de Postgres llega como string — normalizar
          diametro_tubo_mm: Number(d.diametro_tubo_mm),
          dcto_tubo_cm: Number(d.dcto_tubo_cm),
          dcto_tela_cm: Number(d.dcto_tela_cm),
          suma_peso_cm: Number(d.suma_peso_cm),
          dcto_cenefa_cm: Number(d.dcto_cenefa_cm),
          dcto_cenefa_del_cm: Number(d.dcto_cenefa_del_cm),
          dcto_cenefa_tra_cm: Number(d.dcto_cenefa_tra_cm),
          dcto_perfiles_cm: Number(d.dcto_perfiles_cm),
          peso_interno_duo_cm: Number(d.peso_interno_duo_cm),
          peso_u_duo_cm: Number(d.peso_u_duo_cm),
          ancho_max_m: Number(d.ancho_max_m),
        })) as ModeloDespiece[];
        setModelos(filas);
      } catch (e) {
        console.warn('[Descuentos] Error cargando catálogo:', e);
        setModelos([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  return {
    modelos,
    sistemas: [...new Set(modelos.map((m) => m.sistema))],
    loading,
  };
}
