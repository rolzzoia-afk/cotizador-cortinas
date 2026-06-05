// ─────────────────────────────────────────────────────────────────────
// Hook de subida de imágenes (logo / banner de empresa) al bucket
// `inv-empresa-assets` de Supabase Storage.
//
// Devuelve la URL pública del archivo subido. El componente que llama
// es responsable de persistir esa URL en `inv_empresa_perfil` (via
// usePerfilEmpresa.guardarPerfil).
// ─────────────────────────────────────────────────────────────────────

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type UseImagenStorage = {
  subirImagen: (file: File, tipo: 'logo' | 'banner') => Promise<string>;
};

export function useImagenStorage(empresaId: string | null): UseImagenStorage {
  const subirImagen = useCallback<UseImagenStorage['subirImagen']>(
    async (file, tipo) => {
      if (!empresaId) throw new Error('Sin empresa');
      const ext = file.name.split('.').pop() || 'png';
      const path = `${empresaId}/${tipo}-${Date.now()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from('inv-empresa-assets')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (error) throw error;
      const { data } = (supabase as any).storage.from('inv-empresa-assets').getPublicUrl(path);
      return data.publicUrl as string;
    },
    [empresaId],
  );

  return { subirImagen };
}
