-- ════════════════════════════════════════════════════════════════════
-- RBAC · 2026-06-10 (YA APLICADO EN PRODUCCIÓN)
-- Migraciones: rbac_perfiles_y_guards_admin, drop_perfiles_insert_own
--
-- A) Trigger trg_proteger_campos_perfil: un no-admin NO puede cambiar
--    rol ni empresa_id de ningún perfil (cerraba escalación: cualquier
--    usuario podía hacerse admin actualizando su propia fila vía API).
-- B) Política perfiles_update_admin_empresa: los admins pueden editar
--    perfiles de su empresa (para Admin → Usuarios y roles).
-- C) GUARD_ADMIN_2026 insertado al inicio de aplicar_correccion_retroactiva
--    y restaurar_plan_de_corte (las demás RPCs destructivas ya validaban
--    rol). RAISE EXCEPTION P0009 si NOT is_admin().
-- D) DROP perfiles_insert_own: permitía a un usuario sin perfil
--    insertarse uno con rol/empresa arbitrarios. El único flujo legítimo
--    es la RPC registrar_tenant (SECURITY DEFINER).
--
-- Frontend (mismo día): src/lib/roles.ts es la única fuente de permisos;
-- ProtectedRoute bloquea rutas por rol, TopBar/Landing usan la misma
-- matriz, "?rol=" (ver-como) solo funciona para admins, y se agregó la
-- sección Admin → Usuarios y roles para asignar roles desde la app.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.proteger_campos_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF (NEW.rol IS DISTINCT FROM OLD.rol
      OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id)
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar rol o empresa de un perfil.'
      USING ERRCODE = 'P0009';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.proteger_campos_perfil() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_proteger_campos_perfil ON public.perfiles;
CREATE TRIGGER trg_proteger_campos_perfil
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_perfil();

DROP POLICY IF EXISTS perfiles_update_admin_empresa ON public.perfiles;
CREATE POLICY perfiles_update_admin_empresa ON public.perfiles
  FOR UPDATE TO authenticated
  USING ((empresa_id)::text = get_user_empresa_id() AND is_admin())
  WITH CHECK ((empresa_id)::text = get_user_empresa_id());

DO $$
DECLARE
  fn  regprocedure;
  def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.aplicar_correccion_retroactiva(uuid,integer,text,text)'::regprocedure,
    'public.restaurar_plan_de_corte(uuid,text)'::regprocedure
  ] LOOP
    def := pg_get_functiondef(fn);
    IF def NOT LIKE '%GUARD_ADMIN_2026%' THEN
      def := regexp_replace(
        def,
        '\nBEGIN\r?\n',
        E'\nBEGIN\n    -- GUARD_ADMIN_2026: solo administradores\n    IF NOT is_admin() THEN\n        RAISE EXCEPTION ''Solo administradores pueden ejecutar esta acción.'' USING ERRCODE = ''P0009'';\n    END IF;\n'
      );
      EXECUTE def;
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS perfiles_insert_own ON public.perfiles;

NOTIFY pgrst, 'reload schema';
