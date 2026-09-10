// Los eventos de UN tubo, para el panel de la ficha.
//
// Se piden aparte y solo cuando alguien elige una pieza: `tubos_historial`
// tiene más de 12.000 filas y traerlas todas para mostrar cuatro sería
// cargar el galpón entero para mirar un tubo.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EventoTubo } from '@/modules/tubos/fichaTubo';

export function useRecorridoTubo(tuboRaizId: string | null | undefined): {
  eventos: EventoTubo[];
  loading: boolean;
} {
  const [eventos, setEventos] = useState<EventoTubo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tuboRaizId) {
      setEventos([]);
      setLoading(false);
      return;
    }
    let cancelado = false;
    setLoading(true);
    void (async () => {
      // Sin filtro de empresa: `tubos_historial.empresa_id` es TEXT y el RLS
      // de la tabla ya acota lo que se puede leer.
      const { data } = await supabase
        .from('tubos_historial')
        .select(
          'id,evento,cod,n_colmena,medida_cm,medida_resultado_cm,ot,notas,fuente,registrado_por,created_at',
        )
        .eq('tubo_raiz_id', tuboRaizId)
        .order('created_at');
      if (cancelado) return;
      setEventos((data || []) as EventoTubo[]);
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [tuboRaizId]);

  return { eventos, loading };
}
