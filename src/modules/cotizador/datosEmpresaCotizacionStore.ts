// Persistencia de los DATOS DE LA EMPRESA del PDF de cotización.
// Mismo patrón que `terminosStore.ts`: una clave JSON en `configuracion`.
// La lógica pura (defaults, saneo) vive en `datosEmpresaCotizacion.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  DATOS_EMPRESA_DEFAULT,
  normalizarDatosEmpresa,
  type DatosEmpresaCotizacion,
} from './datosEmpresaCotizacion';

export const CLAVE_DATOS_EMPRESA = 'datos_empresa_cotizacion';

export async function cargarDatosEmpresa(empresaId: string): Promise<DatosEmpresaCotizacion> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_DATOS_EMPRESA)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Datos empresa] Error cargando, usando defaults:', error.message);
    return DATOS_EMPRESA_DEFAULT;
  }
  if (!data?.valor) return DATOS_EMPRESA_DEFAULT;
  try {
    return normalizarDatosEmpresa(JSON.parse(data.valor));
  } catch {
    return DATOS_EMPRESA_DEFAULT;
  }
}

export async function guardarDatosEmpresa(
  empresaId: string,
  datos: DatosEmpresaCotizacion,
): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_DATOS_EMPRESA, valor: JSON.stringify(datos) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/**
 * Una imagen propia del admin (el logo, la tira de proyectos) en dataURL, para
 * poder meterla al PDF: jsPDF no acepta una URL remota. Devuelve null si no se
 * puede leer, y el generador cae a la imagen de fábrica.
 */
export async function cargarImagenDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Hook: datos de empresa del PDF para la empresa actual. */
export function useDatosEmpresaCotizacion(): {
  datosEmpresa: DatosEmpresaCotizacion;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [datosEmpresa, setDatosEmpresa] = useState<DatosEmpresaCotizacion>(DATOS_EMPRESA_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setDatosEmpresa(DATOS_EMPRESA_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setDatosEmpresa(await cargarDatosEmpresa(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { datosEmpresa, loading, refresh: cargar };
}
