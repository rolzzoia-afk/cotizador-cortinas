// ─────────────────────────────────────────────────────────────────────
// Hook del perfil de empresa (datos corporativos, logo y banner).
//
// Carga `inv_empresa_perfil` al montar y expone:
//   - profile: CompanyProfile | null
//   - guardarPerfil(newProfile): upsert + actualiza estado local
//
// Está separado del hook de inventario porque su ciclo de vida es
// distinto (1 sola fila por empresa, cambia mucho menos seguido).
// ─────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CompanyProfile } from '../types';
import { type PerfilDB, perfilDBToProfile } from '../utils/inventario-mappers';

export type UsePerfilEmpresa = {
  profile: CompanyProfile | null;
  loading: boolean;
  guardarPerfil: (newProfile: CompanyProfile) => Promise<void>;
};

export function usePerfilEmpresa(empresaId: string | null): UsePerfilEmpresa {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!empresaId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('inv_empresa_perfil')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();
      if (cancelled) return;
      if (data) setProfile(perfilDBToProfile(data as PerfilDB));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [empresaId]);

  const guardarPerfil = useCallback<UsePerfilEmpresa['guardarPerfil']>(
    async (newProfile) => {
      if (!empresaId) return;
      const { error } = await (supabase as any).from('inv_empresa_perfil')
        .upsert({
          empresa_id: empresaId,
          razon_social: newProfile.razonSocial,
          rut: newProfile.rut,
          instagram: newProfile.instagram,
          pagina_web: newProfile.paginaWeb,
          direccion: newProfile.direccion,
          logo_url: newProfile.logoUrl,
          banner_url: newProfile.bannerUrl,
        });
      if (error) throw error;
      setProfile(newProfile);
    },
    [empresaId],
  );

  return { profile, loading, guardarPerfil };
}
