-- ============================================================================
-- RPC: aplicar_correccion_retroactiva
-- Fecha: 2026-05-15
-- Feature: B2 v1 — corrección retroactiva sobre planes antiguos
-- ============================================================================
--
-- Permite marcar una línea de un plan_corte ANTIGUO (no necesariamente el
-- último) como defectuosa, sin rebobinar el inventario ni crear un plan nuevo.
--
-- A diferencia del flujo de correcciones existente (que genera un nuevo
-- planes_corte clonando el último con las correcciones aplicadas), este RPC:
--   - NO crea un plan nuevo.
--   - NO toca colmena_tubos.
--   - NO modifica el plan original (es inmutable, audit-trail intacto).
--
-- Lo único que hace:
--   1. Inserta una fila en `correcciones` apuntando al plan_id original
--      (audit del error sobre la línea afectada).
--   2. Inserta un evento `error_reemplazo` en `tubos_historial` para el tubo
--      afectado (rastreabilidad de que ese tubo en ese plan falló).
--
-- Después de aplicar, el encargado va al optimizador como siempre y arma un
-- nuevo plan para re-cortar la línea con otro tubo del mismo código.
--
-- Tipos válidos (matchean los de src/modules/admin/correcciones.ts):
--   - medida_erronea
--   - tubo_equivocado
--   - tubo_inexistente
--   - tubo_danado
--
-- Seguridad: SECURITY DEFINER + verificación de que el caller pertenece a la
-- misma empresa que el plan.
--
-- Triggers en juego:
--   - `error_reemplazo` NO está en la lista de eventos que dispara
--     `trg_auto_remove_consumed_tube` (que solo reacciona a corte/merma/eliminado).
--     → no remueve nada de colmena_tubos.
--   - `bloquear_corte_sin_origen` solo aplica a eventos `corte`. → no aplica.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.aplicar_correccion_retroactiva(
    p_plan_id    uuid,
    p_linea_idx  integer,
    p_tipo       text,
    p_nota       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa  uuid;
    v_caller_email    text;
    v_plan_empresa    uuid;
    v_plan_resultados jsonb;
    v_linea           jsonb;
    v_resultado       jsonb;
    v_orden           jsonb;
    v_tubo_raiz_id    uuid;
    v_n_colmena       text;
    v_cod             text;
    v_medida_cm       numeric;
    v_ot              text;
    v_correccion_id   uuid;
    v_evento_id       uuid;
    v_n_lineas        integer;
BEGIN
    -- ─── 1. Auth ────────────────────────────────────────────────────────
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;

    BEGIN
        SELECT email INTO v_caller_email FROM auth.users WHERE id = auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_caller_email := NULL;
    END;

    -- ─── 2. Validar tipo de error ──────────────────────────────────────
    IF p_tipo IS NULL
       OR p_tipo NOT IN ('medida_erronea','tubo_equivocado','tubo_inexistente','tubo_danado') THEN
        RAISE EXCEPTION 'Tipo de error inválido: % (esperado: medida_erronea, tubo_equivocado, tubo_inexistente, tubo_danado)', p_tipo
            USING ERRCODE = '22023';
    END IF;

    -- ─── 3. Cargar plan + verificar empresa ───────────────────────────
    SELECT empresa_id, COALESCE(resultados, '[]'::jsonb)
      INTO v_plan_empresa, v_plan_resultados
    FROM planes_corte
    WHERE id = p_plan_id;

    IF v_plan_empresa IS NULL THEN
        RAISE EXCEPTION 'Plan no encontrado: %', p_plan_id USING ERRCODE = '42704';
    END IF;
    IF v_plan_empresa IS DISTINCT FROM v_caller_empresa THEN
        RAISE EXCEPTION 'No autorizado: el plan pertenece a otra empresa' USING ERRCODE = '42501';
    END IF;

    -- ─── 4. Validar índice de línea ────────────────────────────────────
    v_n_lineas := jsonb_array_length(v_plan_resultados);
    IF p_linea_idx < 0 OR p_linea_idx >= v_n_lineas THEN
        RAISE EXCEPTION 'Línea inválida: idx=% (plan tiene % líneas)', p_linea_idx, v_n_lineas
            USING ERRCODE = '22023';
    END IF;
    v_linea := v_plan_resultados -> p_linea_idx;

    -- ─── 5. Extraer datos de la línea (defensivo) ──────────────────────
    -- Las líneas viejas pueden tener distintos shapes — `resultado` anidado
    -- o campos directos. Probamos ambos.
    v_resultado := COALESCE(v_linea -> 'resultado', v_linea);
    v_orden     := COALESCE(v_linea -> 'orden',     '{}'::jsonb);

    BEGIN
        v_tubo_raiz_id := NULLIF(v_resultado ->> 'tubo_raiz_id', '')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        v_tubo_raiz_id := NULL;
    END;

    v_n_colmena := COALESCE(
        NULLIF(v_resultado ->> 'colmena', ''),
        NULLIF(v_resultado ->> 'n_colmena', '')
    );
    v_cod := UPPER(TRIM(COALESCE(
        NULLIF(v_resultado ->> 'codigo', ''),
        NULLIF(v_resultado ->> 'cod', ''),
        NULLIF(v_resultado ->> 'codigo_original', '')
    )));
    BEGIN
        v_medida_cm := NULLIF(v_resultado ->> 'medida_cm', '')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
        v_medida_cm := NULL;
    END;
    v_ot := NULLIF(v_orden ->> 'ot', '');

    -- ─── 6. Insertar en correcciones ───────────────────────────────────
    INSERT INTO correcciones (
        empresa_id, plan_id, usuario_id, tipo, linea_idx, nota, "timestamp"
    )
    VALUES (
        v_caller_empresa, p_plan_id, auth.uid(), p_tipo, p_linea_idx, p_nota, NOW()
    )
    RETURNING id INTO v_correccion_id;

    -- ─── 7. Insertar evento error_reemplazo (audit) ────────────────────
    -- Aunque v_tubo_raiz_id sea NULL (línea sin trazabilidad), dejamos el
    -- evento como rastro de que esa línea/plan tuvo un error.
    INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
        evento, plan_id, ot, linea_idx, registrado_por, notas, fuente
    )
    VALUES (
        v_caller_empresa::text, v_tubo_raiz_id, v_n_colmena, v_cod, v_medida_cm,
        'error_reemplazo', p_plan_id, v_ot, p_linea_idx,
        COALESCE(v_caller_email, auth.uid()::text, 'sistema'),
        format('Corrección retroactiva — tipo=%s — %s', p_tipo, COALESCE(p_nota,'(sin nota)')),
        'correccion_retroactiva'
    )
    RETURNING id INTO v_evento_id;

    -- ─── 8. Devolver IDs y datos útiles para la UI ─────────────────────
    RETURN jsonb_build_object(
        'correccion_id', v_correccion_id,
        'evento_id',     v_evento_id,
        'tubo_raiz_id',  v_tubo_raiz_id,
        'n_colmena',     v_n_colmena,
        'cod',           v_cod,
        'medida_cm',     v_medida_cm,
        'ot',            v_ot
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.aplicar_correccion_retroactiva(uuid, integer, text, text) TO authenticated;

-- ============================================================================
-- Smoke tests (correr aparte, requiere sesión con auth.uid()):
--
-- 1) Test feliz: corregir una línea de un plan existente
--    SELECT aplicar_correccion_retroactiva(
--      '<plan_id>'::uuid, 0, 'tubo_danado', 'Test de corrección retroactiva'
--    );
--    → debe devolver { correccion_id, evento_id, ... }
--
-- 2) Verificar audit:
--    SELECT * FROM correcciones WHERE plan_id = '<plan_id>'::uuid ORDER BY timestamp DESC LIMIT 1;
--    SELECT * FROM tubos_historial WHERE plan_id = '<plan_id>'::uuid AND evento = 'error_reemplazo' ORDER BY created_at DESC LIMIT 1;
--
-- 3) Tipo inválido (debe fallar):
--    SELECT aplicar_correccion_retroactiva('<plan_id>'::uuid, 0, 'no_existe', 'x');
--
-- 4) Línea fuera de rango (debe fallar):
--    SELECT aplicar_correccion_retroactiva('<plan_id>'::uuid, 999, 'tubo_danado', 'x');
--
-- 5) Plan inexistente (debe fallar):
--    SELECT aplicar_correccion_retroactiva('00000000-0000-0000-0000-000000000000'::uuid, 0, 'tubo_danado', 'x');
-- ============================================================================
