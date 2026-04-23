import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { setSentryUser } from './sentry';

type Perfil = {
  id: string;
  empresa_id: string | null;
  nombre: string | null;
  rol: string | null;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  perfil: Perfil | null;
  empresaId: string | null;
  onboardingCompletado: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const TENANT_KEY = 'rolzzo_tenant_id';

const AuthContext = createContext<AuthState | null>(null);

async function loadProfile(userId: string) {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, empresa_id, nombre, rol')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Perfil | null;
}

async function loadOnboardingFlag(empresaId: string) {
  const { data } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', 'onboarding_completado')
    .maybeSingle<{ valor: string }>();
  return data?.valor === 'true';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(
    () => localStorage.getItem(TENANT_KEY),
  );
  const [onboardingCompletado, setOnboarding] = useState(false);

  const hydrate = async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setPerfil(null);
      setEmpresaId(null);
      setOnboarding(false);
      localStorage.removeItem(TENANT_KEY);
      setSentryUser(null);
      setLoading(false);
      return;
    }
    const p = await loadProfile(s.user.id);
    setPerfil(p);
    if (p?.empresa_id) {
      setEmpresaId(p.empresa_id);
      localStorage.setItem(TENANT_KEY, p.empresa_id);
      const ok = await loadOnboardingFlag(p.empresa_id);
      setOnboarding(ok);
    } else {
      setEmpresaId(null);
      localStorage.removeItem(TENANT_KEY);
      setOnboarding(false);
    }
    setSentryUser({
      id: s.user.id,
      email: s.user.email,
      nombre: p?.nombre ?? null,
      empresaId: p?.empresa_id ?? null,
    });
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      hydrate(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        hydrate(s);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  };

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    perfil,
    empresaId,
    onboardingCompletado,
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
