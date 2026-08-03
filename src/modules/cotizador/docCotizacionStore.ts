// Persistencia del layout del documento de cotización (Fase 1 / Fase 3).
// Mismo patrón que `parametros.ts` / `terminosStore.ts`: clave JSON en
// `configuracion`. La lógica pura vive en `docCotizacion.ts`.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LAYOUT_DEFAULT, normalizarLayout, type LayoutDoc } from './docCotizacion';

export const CLAVE_DOC_LAYOUT = 'doc_cotizacion_layout';

export async function cargarLayoutDoc(empresaId: string): Promise<LayoutDoc> {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', CLAVE_DOC_LAYOUT)
    .maybeSingle<{ valor: string }>();
  if (error) {
    console.warn('[Documento] Error cargando layout, usando default:', error.message);
    return LAYOUT_DEFAULT;
  }
  if (!data?.valor) return LAYOUT_DEFAULT;
  try {
    return normalizarLayout(JSON.parse(data.valor));
  } catch {
    return LAYOUT_DEFAULT;
  }
}

export async function guardarLayoutDoc(empresaId: string, layout: LayoutDoc): Promise<void> {
  const { error } = await supabase.from('configuracion').upsert(
    { empresa_id: empresaId, clave: CLAVE_DOC_LAYOUT, valor: JSON.stringify(layout) },
    { onConflict: 'empresa_id,clave' },
  );
  if (error) throw error;
}

/** Hook: layout del documento de cotización de la empresa actual. */
export function useLayoutDoc(): {
  layout: LayoutDoc;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { empresaId } = useAuth();
  const [layout, setLayout] = useState<LayoutDoc>(LAYOUT_DEFAULT);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    if (!empresaId) {
      setLayout(LAYOUT_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setLayout(await cargarLayoutDoc(empresaId));
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { layout, loading, refresh: cargar };
}

// ── Imágenes del documento ───────────────────────────────────────────
// Reutiliza el bucket `inv-empresa-assets`, cuya política RLS exige que la
// PRIMERA carpeta del path sea el empresa_id (sql/2026-06-10_hardening_2…).
const BUCKET = 'inv-empresa-assets';

/** Sube una imagen del documento y devuelve su URL pública. */
export async function subirImagenDoc(empresaId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${empresaId}/doc-${Date.now()}.${ext}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = (supabase as any).storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl as string;
}
