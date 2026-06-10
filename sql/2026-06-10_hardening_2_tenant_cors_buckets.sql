-- ════════════════════════════════════════════════════════════════════
-- HARDENING 2 · 2026-06-10  (YA APLICADO EN PRODUCCIÓN)
-- Migraciones: hardening_registrar_tenant_y_buckets,
--              scope_inv_empresa_assets_por_empresa
-- También se redesplegó la edge function agente-playground (v10) con
-- CORS restringido a rolzzo.com / www.rolzzo.com / localhost dev
-- (configurable vía variable de entorno ALLOWED_ORIGINS).
--
-- A) registrar_tenant: nuevas validaciones (la única RPC abierta a anon)
--    - El user_id debe existir en auth.users y el email coincidir
--      (antes se podían crear tenants/perfiles con UUIDs inventados).
--    - Con sesión: solo puedes registrar TU propia empresa.
--    - Sin sesión: solo cuentas creadas hace menos de 1 hora.
--    - Largos máximos en nombre de empresa y de usuario.
-- B) Storage: se eliminaron las políticas que permitían LISTAR los
--    buckets públicos (public_read_fotos, public_read_fotos_telas,
--    inv_empresa_assets_read) — getPublicUrl sigue funcionando — y
--    inv_empresa_assets_write se reemplazó por inv_empresa_assets_rw,
--    acotada a la carpeta de la empresa del usuario.
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.registrar_tenant(
  p_nombre_empresa text,
  p_user_id uuid,
  p_user_nombre text,
  p_user_email text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_tenant_id uuid;
    v_slug      text;
    v_existing_perfil_empresa uuid;
    v_email_real text;
    v_user_creado timestamptz;
BEGIN
    IF p_nombre_empresa IS NULL OR length(trim(p_nombre_empresa)) < 2
       OR length(p_nombre_empresa) > 120 THEN
      RAISE EXCEPTION 'Nombre de empresa inválido.' USING ERRCODE = 'P0001';
    END IF;
    IF p_user_nombre IS NULL OR length(trim(p_user_nombre)) < 1
       OR length(p_user_nombre) > 120 THEN
      RAISE EXCEPTION 'Nombre de usuario inválido.' USING ERRCODE = 'P0001';
    END IF;

    SELECT u.email, u.created_at
      INTO v_email_real, v_user_creado
    FROM auth.users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Usuario inexistente.' USING ERRCODE = 'P0002';
    END IF;
    IF lower(v_email_real) IS DISTINCT FROM lower(p_user_email) THEN
      RAISE EXCEPTION 'El email no corresponde al usuario.' USING ERRCODE = 'P0002';
    END IF;

    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'No puedes registrar una empresa para otro usuario.'
        USING ERRCODE = 'P0003';
    END IF;

    IF auth.uid() IS NULL AND v_user_creado < now() - interval '1 hour' THEN
      RAISE EXCEPTION 'La cuenta ya no puede registrar empresa por esta vía. Inicia sesión.'
        USING ERRCODE = 'P0003';
    END IF;

    SELECT empresa_id INTO v_existing_perfil_empresa
    FROM perfiles
    WHERE id = p_user_id;

    IF FOUND THEN
      RAISE EXCEPTION
        'El usuario % ya tiene un perfil en el sistema (empresa_id: %). Usá login en vez de registrarte nuevamente.',
        p_user_id, v_existing_perfil_empresa
        USING ERRCODE = 'P0004';
    END IF;

    v_slug := lower(regexp_replace(
        translate(p_nombre_empresa, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN'),
        '[^a-z0-9]+', '-', 'g'
    ));
    v_slug := trim(both '-' from v_slug);
    IF EXISTS (SELECT 1 FROM tenants WHERE slug = v_slug) THEN
        v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 6);
    END IF;

    INSERT INTO tenants (nombre, slug, plan, estado)
    VALUES (p_nombre_empresa, v_slug, 'trial', 'trial')
    RETURNING id INTO v_tenant_id;

    INSERT INTO perfiles (id, empresa_id, nombre, rol)
    VALUES (p_user_id, v_tenant_id, p_user_nombre, 'admin');

    RETURN v_tenant_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_tenant(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_tenant(text, uuid, text, text)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS public_read_fotos ON storage.objects;
DROP POLICY IF EXISTS public_read_fotos_telas ON storage.objects;
DROP POLICY IF EXISTS inv_empresa_assets_read ON storage.objects;
DROP POLICY IF EXISTS inv_empresa_assets_write ON storage.objects;

CREATE POLICY inv_empresa_assets_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'inv-empresa-assets'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'inv-empresa-assets'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

NOTIFY pgrst, 'reload schema';
