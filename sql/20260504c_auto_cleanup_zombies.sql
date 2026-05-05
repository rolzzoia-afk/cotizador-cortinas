-- ============================================================================
-- Auto-cleanup de tubos zombie en colmena_tubos
-- Fecha: 2026-05-04 (segundo parche del día)
-- ============================================================================
--
-- Contexto:
--   El trigger pre-existente `tubo_consumido_no_puede_reentrar_a_colmena`
--   bloquea INSERTs a colmena_tubos si ya hay un evento de consumo en
--   tubos_historial. Eso protege contra reinserciones.
--
--   Pero el caso inverso NO está protegido: cuando se INSERTA un evento
--   'corte', 'merma' o 'eliminado' en tubos_historial, nada elimina
--   automáticamente el tubo de colmena_tubos. El sistema dependía de que
--   cada path que loguea un evento de consumo recordara hacer también el
--   DELETE manual en colmena_tubos. Cualquier path que se olvide produce
--   un zombie.
--
--   Evidencia: tubo 6ecbd9bf-75c1-4566-ae97-f898450fe9f7 tenía un evento
--   'corte' del 2026-04-30 17:23:48 pero seguía en colmena_tubos al
--   2026-05-04. Solo se descubrió cuando el modo inventario quiso
--   restaurarlo desde un snapshot.
--
-- Solución: trigger AFTER INSERT en tubos_historial que ejecuta DELETE
-- en colmena_tubos cuando el evento es 'corte', 'merma' o 'eliminado'.
-- Defense in depth: aunque algún code path falle, la BD queda consistente.
--
-- Compatibilidad con sync_colmena_tubos:
--   La RPC ya hace DELETE FROM colmena_tubos WHERE empresa_id = X antes
--   de insertar los eventos al historial. Cuando el trigger nuevo se
--   dispara para el evento 'corte', el tubo ya no está en colmena_tubos —
--   el DELETE no encuentra nada y termina en 0ms. Sin impacto.
--
-- Edge cases descartados explícitamente:
--   - 'sobrante': NO dispara el trigger. El sobrante es un tubo nuevo
--     que conserva el tubo_raiz_id original pero está en colmena_tubos
--     con medida reducida (es válido).
--   - 'ingreso': NO dispara. Es la creación.
--   - 'ajuste': NO dispara. Es edición de medida.
--   - 'restauracion': NO dispara. Es restore explícito.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) FUNCIÓN del trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_auto_remove_consumed_tube()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted integer;
BEGIN
    IF NEW.evento IN ('corte','merma','eliminado')
       AND NEW.tubo_raiz_id IS NOT NULL
       AND NEW.empresa_id IS NOT NULL THEN

        DELETE FROM colmena_tubos
         WHERE empresa_id   = NEW.empresa_id::uuid
           AND tubo_raiz_id = NEW.tubo_raiz_id;

        GET DIAGNOSTICS v_deleted = ROW_COUNT;

        IF v_deleted > 0 THEN
            RAISE NOTICE '[auto-cleanup] tubo % removido de colmena_tubos por evento % (empresa %)',
                NEW.tubo_raiz_id, NEW.evento, NEW.empresa_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) TRIGGER en tubos_historial
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_auto_remove_consumed_tube ON public.tubos_historial;

CREATE TRIGGER trg_auto_remove_consumed_tube
AFTER INSERT ON public.tubos_historial
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_remove_consumed_tube();

COMMENT ON TRIGGER trg_auto_remove_consumed_tube ON public.tubos_historial IS
'Auto-cleanup defensivo: cuando se inserta un evento corte/merma/eliminado en '
'tubos_historial, elimina el tubo correspondiente de colmena_tubos. Garantiza '
'consistencia entre las dos tablas aunque algún code path falle al hacer el DELETE.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RPC: limpiar_zombies_colmena
--    Detecta y elimina zombies existentes (admin-only). Soporta dry-run.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.limpiar_zombies_colmena(p_dry_run boolean DEFAULT true)
RETURNS TABLE (
    accion        text,           -- 'detectado' (dry_run) o 'eliminado' (real)
    n_zombies     integer,
    detalle       jsonb           -- ejemplos para verificar antes de borrar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_empresa uuid;
    v_user_rol     text;
    v_count        integer;
    v_sample       jsonb;
BEGIN
    SELECT empresa_id, rol INTO v_user_empresa, v_user_rol
      FROM perfiles WHERE id = auth.uid();

    IF v_user_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF v_user_rol NOT IN ('admin','superadmin') THEN
        RAISE EXCEPTION 'Solo admin/superadmin pueden ejecutar limpieza de zombies' USING ERRCODE = '42501';
    END IF;

    -- CTE para identificar zombies de la empresa
    CREATE TEMP TABLE IF NOT EXISTS _zombies_temp (
        id            uuid,
        tubo_raiz_id  uuid,
        n_colmena     text,
        cod           text,
        medida_cm     numeric,
        ultimo_evento text,
        ultimo_at     timestamptz
    ) ON COMMIT DROP;

    DELETE FROM _zombies_temp;

    INSERT INTO _zombies_temp
    SELECT
        ct.id,
        ct.tubo_raiz_id,
        ct.n_colmena,
        ct.cod,
        ct.medida_cm,
        evento_consumo.evento  AS ultimo_evento,
        evento_consumo.creado  AS ultimo_at
    FROM colmena_tubos ct
    CROSS JOIN LATERAL (
        SELECT th.evento, th.created_at AS creado
        FROM tubos_historial th
        WHERE th.empresa_id   = ct.empresa_id::text
          AND th.tubo_raiz_id = ct.tubo_raiz_id
          AND th.evento IN ('corte','merma','eliminado')
          AND NOT EXISTS (
              SELECT 1 FROM tubos_historial th_ing
              WHERE th_ing.empresa_id   = th.empresa_id
                AND th_ing.tubo_raiz_id = th.tubo_raiz_id
                AND th_ing.evento       = 'ingreso'
                AND th_ing.created_at   > th.created_at
          )
        ORDER BY th.created_at DESC
        LIMIT 1
    ) evento_consumo
    WHERE ct.empresa_id   = v_user_empresa
      AND ct.tubo_raiz_id IS NOT NULL;

    SELECT COUNT(*) INTO v_count FROM _zombies_temp;

    -- Sample de hasta 10 ejemplos para verificación visual
    SELECT jsonb_agg(jsonb_build_object(
        'tubo_raiz_id', tubo_raiz_id,
        'n_colmena',    n_colmena,
        'cod',          cod,
        'medida_cm',    medida_cm,
        'ultimo_evento',ultimo_evento,
        'ultimo_at',    ultimo_at
    ))
    INTO v_sample
    FROM (SELECT * FROM _zombies_temp ORDER BY ultimo_at DESC LIMIT 10) sub;

    IF p_dry_run THEN
        RETURN QUERY
        SELECT 'detectado'::text, v_count, COALESCE(v_sample, '[]'::jsonb);
    ELSE
        DELETE FROM colmena_tubos
         WHERE id IN (SELECT id FROM _zombies_temp);

        RETURN QUERY
        SELECT 'eliminado'::text, v_count, COALESCE(v_sample, '[]'::jsonb);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.limpiar_zombies_colmena(boolean) TO authenticated;

COMMENT ON FUNCTION public.limpiar_zombies_colmena(boolean) IS
'Detecta y elimina tubos zombies (en colmena_tubos pero con corte/merma/eliminado en historial sin ingreso posterior). '
'Por defecto en dry-run para revisar antes de borrar. Llamar con p_dry_run=false para borrar.';

COMMIT;

-- ============================================================================
-- Smoke tests (correr post-deploy en SQL Editor con admin autenticado)
-- ============================================================================
-- 1. Detectar cuántos zombies hay sin borrar:
--    SELECT * FROM limpiar_zombies_colmena(true);
--
-- 2. Si la cantidad y el sample tienen sentido, borrar:
--    SELECT * FROM limpiar_zombies_colmena(false);
--
-- 3. Verificar que el trigger nuevo está activo:
--    SELECT tgname FROM pg_trigger WHERE tgrelid = 'tubos_historial'::regclass;
--    -- Debe incluir: trg_auto_remove_consumed_tube
--
-- 4. Probar el trigger end-to-end (impacta colmena_tubos real, hacer en
--    horario tranquilo o en un ambiente de prueba):
--    a) Tomar un tubo_raiz_id existente en colmena_tubos
--    b) INSERT INTO tubos_historial (empresa_id, tubo_raiz_id, evento, registrado_por)
--       VALUES ('<emp>', '<raiz_id>', 'eliminado', 'test');
--    c) Verificar que ese tubo_raiz_id ya no está en colmena_tubos
-- ============================================================================
