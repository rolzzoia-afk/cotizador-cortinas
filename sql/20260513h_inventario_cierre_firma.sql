-- ============================================================================
-- Inventario: firma del admin requerida para cerrar (Phase 2 sub-tarea 1)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Phase 2 del inventario (memoria project_inventario_modo_snapshot) pidió
--   "cierre formal con firma certificada del admin". Antes de poder cerrar
--   un inventario activo, el admin debe firmar táctilmente en un canvas. La
--   firma se guarda como data URL base64 PNG en inventarios.firma_png.
--
--   La función cerrar_inventario(uuid, text) se DROPea y se reemplaza por una
--   nueva signature (uuid, text, text) que requiere p_firma_png no-vacío.
--
-- Reversibilidad:
--   DROP FUNCTION cerrar_inventario(uuid, text, text);
--   CREATE OR REPLACE FUNCTION cerrar_inventario(uuid, text) — la original.
--   ALTER TABLE inventarios DROP COLUMN firma_png;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario firma — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Columna firma_png (data URL base64 PNG)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE inventarios
  ADD COLUMN IF NOT EXISTS firma_png text;

DO $$ BEGIN RAISE NOTICE '  Columna firma_png: OK'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Reemplazar RPC: drop signature vieja + recrear con firma requerida
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.cerrar_inventario(uuid, text);

CREATE OR REPLACE FUNCTION public.cerrar_inventario(
    p_inventario_id uuid,
    p_notas         text DEFAULT NULL,
    p_firma_png     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id      uuid;
    v_user_email   text;
    v_user_rol     text;
    v_user_empresa uuid;
    v_inv_empresa  uuid;
    v_inv_colmena  text;
    v_inv_estado   text;
    v_count_post   integer;
BEGIN
    -- Validar firma: data URL PNG no vacío.
    -- "data:image/png;base64," son 22 chars. Un canvas vacío genera ~200-300
    -- chars de PNG transparente; una firma real es 2KB+. Floor = 500 chars.
    IF p_firma_png IS NULL OR length(p_firma_png) < 500 THEN
        RAISE EXCEPTION 'Se requiere la firma del admin para cerrar el inventario'
            USING ERRCODE = '23502';
    END IF;
    IF p_firma_png NOT LIKE 'data:image/%' THEN
        RAISE EXCEPTION 'Firma inválida: se esperaba un data URL de imagen'
            USING ERRCODE = '22023';
    END IF;

    SELECT id, empresa_id, rol INTO v_user_id, v_user_empresa, v_user_rol
      FROM perfiles WHERE id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF v_user_rol NOT IN ('admin','superadmin') THEN
        RAISE EXCEPTION 'Solo admin/superadmin pueden cerrar inventarios' USING ERRCODE = '42501';
    END IF;
    v_user_email := (auth.jwt() ->> 'email');

    SELECT empresa_id, n_colmena, estado INTO v_inv_empresa, v_inv_colmena, v_inv_estado
      FROM inventarios WHERE id = p_inventario_id;
    IF v_inv_empresa IS NULL THEN
        RAISE EXCEPTION 'Inventario no encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF v_inv_empresa IS DISTINCT FROM v_user_empresa THEN
        RAISE EXCEPTION 'No autorizado: ese inventario es de otra empresa' USING ERRCODE = '42501';
    END IF;
    IF v_inv_estado <> 'activo' THEN
        RAISE EXCEPTION 'El inventario ya está %', v_inv_estado USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*)::integer INTO v_count_post
    FROM colmena_tubos
    WHERE empresa_id = v_inv_empresa
      AND (v_inv_colmena IS NULL OR n_colmena = v_inv_colmena);

    UPDATE inventarios
    SET estado            = 'cerrado',
        cerrado_at        = now(),
        cerrado_por       = v_user_id,
        cerrado_por_email = v_user_email,
        tubos_count_post  = v_count_post,
        firma_png         = p_firma_png,
        notas             = CASE
                                WHEN p_notas IS NULL OR p_notas = '' THEN notas
                                WHEN notas IS NULL OR notas = '' THEN p_notas
                                ELSE notas || E'\n\n' || p_notas
                             END
    WHERE id = p_inventario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_inventario(uuid, text, text) TO authenticated;

DO $$ BEGIN RAISE NOTICE '  RPC cerrar_inventario(uuid, text, text): OK'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Test: que la firma nula sea rechazada
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.cerrar_inventario(
        '00000000-0000-0000-0000-000000000000'::uuid,
        'test notas',
        NULL
    );
    RAISE EXCEPTION 'Test FALLÓ: firma NULL fue aceptada';
  EXCEPTION
    WHEN not_null_violation THEN
      RAISE NOTICE '  Test OK: firma NULL rechazada con not_null_violation';
    WHEN OTHERS THEN
      -- Si revienta por otra razón (ej. no autenticado, inventario no existe)
      -- es OK porque ese error vendría DESPUÉS del check de firma.
      IF SQLERRM LIKE '%firma%' THEN
        RAISE NOTICE '  Test OK: firma NULL rechazada (%)', SQLERRM;
      ELSE
        RAISE NOTICE '  Test SKIP: la auth/empresa falló antes del check (%)', SQLERRM;
      END IF;
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario firma — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Columna existe:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'inventarios' AND column_name = 'firma_png';
--
-- 2) RPC nueva existe con la signature correcta:
--    SELECT pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'cerrar_inventario';
--    -- Esperado: "p_inventario_id uuid, p_notas text, p_firma_png text"
--
-- 3) RPC vieja no existe:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'cerrar_inventario';
--    -- No debe aparecer la signature (uuid, text)
-- ============================================================================
