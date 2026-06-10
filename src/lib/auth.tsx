import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** Nombre de la empresa (tenant) del usuario, cargado desde `tenants.nombre`. */
  empresaNombre: string | null;
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

async function loadEmpresaNombre(empresaId: string): Promise<string | null> {
  // RLS (tenant_isolation) garantiza que solo se puede leer el propio tenant.
  const { data, error } = await supabase
    .from('tenants')
    .select('nombre')
    .eq('id', empresaId)
    .maybeSingle<{ nombre: string | null }>();
  if (error) {
    console.warn('[auth] loadEmpresaNombre falló:', error.message);
    return null;
  }
  return data?.nombre ?? null;
}

async function loadOnboardingFlag(empresaId: string) {
  const { data, error } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('empresa_id', empresaId)
    .eq('clave', 'onboarding_completado')
    .maybeSingle<{ valor: string }>();

  // Si la query falla por red u otra causa, NO mandar a Setup —
  // asumimos onboarding completo para usuarios existentes.
  if (error) {
    console.warn('[auth] loadOnboardingFlag falló, asumiendo true:', error.message);
    return true;
  }

  if (data?.valor === 'true') return true;

  // Auto-heal: si el flag no existe pero la empresa ya tiene OTs,
  // claramente no es una empresa nueva. Marcamos el flag y devolvemos true.
  const { count } = await supabase
    .from('ots')
    .select('id', { head: true, count: 'exact' })
    .eq('empresa_id', empresaId)
    .limit(1);
  if ((count ?? 0) > 0) {
    await supabase
      .from('configuracion')
      .upsert(
        { empresa_id: empresaId, clave: 'onboarding_completado', valor: 'true' },
        { onConflict: 'empresa_id,clave' },
      );
    return true;
  }

  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(
    () => localStorage.getItem(TENANT_KEY),
  );
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);
  const [onboardingCompletado, setOnboarding] = useState(false);

  // Guarda el último user.id que hidratamos completo (perfil + onboarding).
  // Evita que eventos repetidos de onAuthStateChange para el mismo usuario
  // disparen setLoading(true), lo que desmonta el árbol protegido (y con
  // él el iframe del Optimizador). Cuando el iframe se re-monta crea un
  // nuevo cliente Supabase, que a su vez dispara otro INITIAL_SESSION por
  // cross-tab sync → loop infinito de remounts del iframe.
  const hydratedUserIdRef = useRef<string | null>(null);

  const hydrate = async (s: Session | null) => {
    const newUserId = s?.user?.id ?? null;

    // Fast path: mismo usuario ya hidratado → solo actualizar la Session
    // (los tokens pueden haber rotado) sin volver a cargar perfil/onboarding.
    if (newUserId && hydratedUserIdRef.current === newUserId) {
      setSession(s);
      return;
    }

    // Marcar loading en true para que ProtectedRoute/Login esperen el
    // hydrate completo antes de decidir redirects. Sin esto, cambios de
    // sesión disparan navigate con onboardingCompletado=false (default de
    // useState) aunque la DB tenga la flag en true — mandando al usuario
    // a /setup por error.
    setLoading(true);
    setSession(s);
    if (!s) {
      hydratedUserIdRef.current = null;
      setPerfil(null);
      setEmpresaId(null);
      setEmpresaNombre(null);
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
      const [ok, nombre] = await Promise.all([
        loadOnboardingFlag(p.empresa_id),
        loadEmpresaNombre(p.empresa_id),
      ]);
      setOnboarding(ok);
      setEmpresaNombre(nombre);
    } else {
      setEmpresaId(null);
      setEmpresaNombre(null);
      localStorage.removeItem(TENANT_KEY);
      setOnboarding(false);
    }
    setSentryUser({
      id: s.user.id,
      email: s.user.email,
      nombre: p?.nombre ?? null,
      empresaId: p?.empresa_id ?? null,
    });
    hydratedUserIdRef.current = s.user.id;
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
    // Invalidar el cache de "último user hidratado" para forzar recarga
    // completa de perfil + onboarding. refresh() lo llama Registro/Setup
    // justo después de crear la empresa: si dejáramos el fast-path activo
    // nos quedaríamos con el perfil viejo y onboarding=false.
    hydratedUserIdRef.current = null;
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  };

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    perfil,
    empresaId,
    empresaNombre,
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
