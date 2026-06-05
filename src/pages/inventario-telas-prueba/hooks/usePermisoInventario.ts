// ─────────────────────────────────────────────────────────────────────
// Hook de gate de acceso al módulo Inventario de Telas.
//
// Lee el email del usuario logueado (Supabase Auth) y lo cruza contra
// la tabla `inv_permisos` para devolver:
//   - tieneAcceso: boolean
//   - rol: 'admin' | 'editor' | 'lectura' | null
//   - email + empresaId
//
// La página `Pagina.tsx` usa esto para decidir si renderizar el módulo
// o la pantalla "Acceso restringido".
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type PermisoInfo = {
  loading: boolean;
  tieneAcceso: boolean;
  rol: 'editor' | 'lectura' | 'admin' | null;
  email: string | null;
  empresaId: string | null;
};

export function usePermisoInventario(): PermisoInfo {
  const { perfil } = useAuth();
  const [state, setState] = useState<PermisoInfo>({
    loading: true,
    tieneAcceso: false,
    rol: null,
    email: null,
    empresaId: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.toLowerCase().trim() || null;
      const empresaId = perfil?.empresa_id || null;

      if (!email || !empresaId) {
        if (!cancelled) setState({ loading: false, tieneAcceso: false, rol: null, email, empresaId });
        return;
      }

      const { data, error } = await (supabase as any).from('inv_permisos')
        .select('rol, activo')
        .eq('empresa_id', empresaId)
        .ilike('email', email)
        .eq('activo', true)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setState({ loading: false, tieneAcceso: false, rol: null, email, empresaId });
      } else {
        setState({ loading: false, tieneAcceso: true, rol: data.rol as PermisoInfo['rol'], email, empresaId });
      }
    }
    check();
    return () => { cancelled = true; };
  }, [perfil?.empresa_id]);

  return state;
}
