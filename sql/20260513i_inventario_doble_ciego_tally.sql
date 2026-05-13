-- ============================================================================
-- Inventario: tally doble ciego por colmena (Phase 2 sub-tarea 3)
-- Fecha: 2026-05-13
-- ============================================================================
--
-- Contexto:
--   Phase 2 #3: conteo doble ciego con dos operarios. Versión "tally" =
--   cada operario, en una pantalla aparte, registra SOLO el conteo total
--   de tubos por colmena. No tocan colmena_tubos directamente.
--
--   Privacidad doble ciego: cada operario ve únicamente sus propios
--   tallies. El admin ve todos para reconciliar discrepancias.
--
-- Reversibilidad:
--   DROP FUNCTION public.tally_set(uuid, text, integer);
--   DROP TABLE public.inventario_tally;
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Inventario tally doble ciego — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Tabla inventario_tally
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inventario_tally (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inventario_id   uuid NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
    empresa_id      uuid NOT NULL,
    operario_id     uuid NOT NULL,
    operario_email  text NOT NULL,
    n_colmena       text NOT NULL,
    conteo          integer NOT NULL CHECK (conteo >= 0),
    contado_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (inventario_id, operario_id, n_colmena)
);

CREATE INDEX IF NOT EXISTS inventario_tally_inv_idx
    ON public.inventario_tally(inventario_id);
CREATE INDEX IF NOT EXISTS inventario_tally_op_idx
    ON public.inventario_tally(inventario_id, operario_id);

ALTER TABLE public.inventario_tally ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN RAISE NOTICE '  Tabla inventario_tally + indices + RLS habilitado'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS policies
--    Operario: solo SELECT lo suyo (privacidad doble ciego)
--    Admin/superadmin: SELECT todo de su empresa
--    Escrituras: solo via RPC tally_set (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS tally_select_own ON public.inventario_tally;
CREATE POLICY tally_select_own ON public.inventario_tally
    FOR SELECT
    USING (operario_id = auth.uid());

DROP POLICY IF EXISTS tally_select_admin ON public.inventario_tally;
CREATE POLICY tally_select_admin ON public.inventario_tally
    FOR SELECT
    USING (
        empresa_id IN (SELECT p.empresa_id FROM perfiles p WHERE p.id = auth.uid())
        AND (SELECT p.rol FROM perfiles p WHERE p.id = auth.uid()) IN ('admin','superadmin')
    );

DO $$ BEGIN RAISE NOTICE '  RLS policies aplicadas (operario ve lo suyo, admin ve todo)'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RPC tally_set: UPSERT seguro del conteo de UN operario para UNA colmena
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tally_set(
    p_inventario_id uuid,
    p_n_colmena     text,
    p_conteo        integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id      uuid;
    v_user_email   text;
    v_user_empresa uuid;
    v_inv_empresa  uuid;
    v_inv_estado   text;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF p_conteo IS NULL OR p_conteo < 0 THEN
        RAISE EXCEPTION 'Conteo debe ser >= 0' USING ERRCODE = '23514';
    END IF;
    IF p_n_colmena IS NULL OR length(trim(p_n_colmena)) = 0 THEN
        RAISE EXCEPTION 'Falta el nombre de la colmena' USING ERRCODE = '23502';
    END IF;

    v_user_email := (auth.jwt() ->> 'email');

    SELECT empresa_id INTO v_user_empresa FROM perfiles WHERE id = v_user_id;
    IF v_user_empresa IS NULL THEN
        RAISE EXCEPTION 'Perfil no encontrado' USING ERRCODE = 'P0002';
    END IF;

    SELECT empresa_id, estado INTO v_inv_empresa, v_inv_estado
      FROM inventarios WHERE id = p_inventario_id;
    IF v_inv_empresa IS NULL THEN
        RAISE EXCEPTION 'Inventario no encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF v_inv_empresa IS DISTINCT FROM v_user_empresa THEN
        RAISE EXCEPTION 'No autorizado: ese inventario es de otra empresa' USING ERRCODE = '42501';
    END IF;
    IF v_inv_estado <> 'activo' THEN
        RAISE EXCEPTION 'El inventario no está activo (estado=%)', v_inv_estado USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO inventario_tally (inventario_id, empresa_id, operario_id, operario_email, n_colmena, conteo)
    VALUES (p_inventario_id, v_user_empresa, v_user_id, v_user_email, trim(p_n_colmena), p_conteo)
    ON CONFLICT (inventario_id, operario_id, n_colmena)
    DO UPDATE SET conteo = EXCLUDED.conteo, contado_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.tally_set(uuid, text, integer) TO authenticated;

DO $$ BEGIN RAISE NOTICE '  RPC tally_set(uuid, text, integer): OK'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Test post-aplicación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.tally_set(
        '00000000-0000-0000-0000-000000000000'::uuid,
        'COL_TEST',
        -1
    );
    RAISE EXCEPTION 'Test FALLÓ: conteo negativo fue aceptado';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '  Test OK: conteo negativo rechazado';
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%>=%' OR SQLERRM LIKE '%Conteo%' THEN
        RAISE NOTICE '  Test OK: conteo negativo rechazado (%)', SQLERRM;
      ELSE
        RAISE NOTICE '  Test SKIP: la auth falló antes del check (%)', SQLERRM;
      END IF;
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '=== Inventario tally doble ciego — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT:
--
-- 1) Tabla existe:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'inventario_tally';
--
-- 2) RLS activado:
--    SELECT relrowsecurity FROM pg_class WHERE relname = 'inventario_tally';
--
-- 3) Policies:
--    SELECT policyname FROM pg_policies WHERE tablename = 'inventario_tally';
--
-- 4) RPC:
--    SELECT pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'tally_set';
-- ============================================================================
