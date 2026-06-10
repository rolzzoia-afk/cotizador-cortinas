-- ════════════════════════════════════════════════════════════════════
-- HARDENING DE SEGURIDAD · 2026-06-10
-- (YA APLICADO EN PRODUCCIÓN vía migración "hardening_seguridad_funciones_rpc")
--
-- Qué corrige:
-- 1) ~30 funciones RPC eran ejecutables por cualquiera SIN iniciar sesión
--    (rol anon), varias aceptando p_empresa_id arbitrario → riesgo de
--    manipular inventario/planes de otra empresa. Ahora solo usuarios
--    logueados (authenticated) y el backend (service_role) pueden llamarlas.
-- 2) Las funciones trigger ya no son llamables vía la API REST.
-- 3) Las funciones nuevas que se creen en el futuro nacen cerradas
--    (sin EXECUTE para PUBLIC/anon) gracias a ALTER DEFAULT PRIVILEGES.
-- 4) Todas las funciones quedan con search_path fijo (public, pg_temp).
-- 5) v_merma_mensual pasa a security_invoker: respeta el RLS del usuario
--    que consulta (antes mostraba datos de TODAS las empresas).
--
-- Excepción deliberada: registrar_tenant sigue abierta a anon porque el
-- registro de empresa ocurre antes del login (Registro.tsx). PENDIENTE:
-- endurecer esa función (validar que p_user_id corresponda a un usuario
-- recién creado sin empresa, y rate-limiting).
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           p.proname,
           (p.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype) AS es_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    IF r.es_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
      IF r.proname <> 'registrar_tenant' THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
      ELSE
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.sig);
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d
                      WHERE d.objid = p.oid AND d.deptype = 'e')
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c
                          WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;

ALTER VIEW public.v_merma_mensual SET (security_invoker = on);

NOTIFY pgrst, 'reload schema';
