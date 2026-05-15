-- ============================================================================
-- RPC: verificar_salud_colmena
-- Fecha: 2026-05-15
-- Feature: Vigilancia automática anti-descuadre (Capa 1 del plan operativo)
-- ============================================================================
--
-- Corre 5 chequeos de invariantes sobre la colmena y devuelve un resumen.
-- Pensado para llamarse DESPUÉS de cada acción que mueve la base de datos
-- (guardar plan, corrección, restauración, etc.). Si algún check falla, el
-- frontend muestra una alerta y bloquea la siguiente acción hasta resolver.
--
-- Checks (severidad entre paréntesis):
--   1. duplicados_uuid (error)
--        Mismo tubo_raiz_id apareciendo >1 vez en colmena_tubos.
--        Debería ser imposible (hay unique implícita por triggers) pero verifica.
--
--   2. duplicados_fisicos (warning)
--        Misma combinación (n_colmena, cod, medida_cm, serial) >1 vez.
--        Puede ser legítimo (dos tubos físicamente distintos con mismas medidas)
--        pero conviene saberlo. Solo aviso, no bloquea.
--
--   3. tubos_sin_origen (error)
--        Tubo en colmena_tubos cuyo UUID no tiene NINGÚN evento
--        ingreso/sobrante/restauracion/ajuste/sobrante_error en historial.
--        Significa que apareció de la nada — bug del flujo.
--
--   4. tubos_ultimo_evento_problematico (error)
--        Tubo en inventario cuyo último evento es corte/merma/eliminado.
--        El trigger trg_auto_remove_consumed_tube debería haberlo sacado.
--        Si quedan, algo se rompió.
--
--   5. tombstones_en_inventario (error)
--        Tubo en colmena_tubos con un 'eliminado' sin 'ingreso' posterior.
--        El trigger trg_colmena_tubos_no_zombie debería bloquearlo.
--        Si quedan, hay inconsistencia.
--
-- Estado global:
--   - 'error'   si CUALQUIER check de severidad error > 0
--   - 'warning' si CUALQUIER check de severidad warning > 0 (y ningún error)
--   - 'ok'      si todos en 0
--
-- Seguridad: SECURITY DEFINER. Solo permite consultar la empresa del caller.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verificar_salud_colmena(
    p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa uuid;
    v_total          int;
    v_dup_uuid       int;
    v_dup_fisicos    int;
    v_sin_origen     int;
    v_ult_problem    int;
    v_tomb_inv       int;
    v_estado         text;
BEGIN
    -- Auth
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF p_empresa_id IS NULL THEN p_empresa_id := v_caller_empresa; END IF;
    IF p_empresa_id IS DISTINCT FROM v_caller_empresa THEN
        RAISE EXCEPTION 'No autorizado: empresa no coincide' USING ERRCODE = '42501';
    END IF;

    -- Total de tubos en inventario
    SELECT COUNT(*) INTO v_total
    FROM colmena_tubos WHERE empresa_id = p_empresa_id;

    -- 1. Duplicados de UUID (no debería existir nunca)
    SELECT COUNT(*) INTO v_dup_uuid FROM (
        SELECT tubo_raiz_id FROM colmena_tubos
        WHERE empresa_id = p_empresa_id AND tubo_raiz_id IS NOT NULL
        GROUP BY tubo_raiz_id HAVING COUNT(*) > 1
    ) x;

    -- 2. Duplicados físicos (misma colmena+cod+medida+serial)
    SELECT COUNT(*) INTO v_dup_fisicos FROM (
        SELECT n_colmena, cod, medida_cm, COALESCE(serial, '')
        FROM colmena_tubos
        WHERE empresa_id = p_empresa_id
        GROUP BY n_colmena, cod, medida_cm, COALESCE(serial, '')
        HAVING COUNT(*) > 1
    ) x;

    -- 3. Tubos en inventario sin evento de origen en historial
    SELECT COUNT(*) INTO v_sin_origen FROM colmena_tubos ct
    WHERE ct.empresa_id = p_empresa_id
      AND ct.tubo_raiz_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM tubos_historial th
          WHERE th.empresa_id   = p_empresa_id::text
            AND th.tubo_raiz_id = ct.tubo_raiz_id
            AND th.evento IN ('ingreso','sobrante','restauracion','ajuste','sobrante_error')
      );

    -- 4. Tubos en inventario cuyo último evento es corte/merma/eliminado
    WITH ult AS (
        SELECT DISTINCT ON (th.tubo_raiz_id) th.tubo_raiz_id, th.evento
        FROM tubos_historial th
        WHERE th.empresa_id   = p_empresa_id::text
          AND th.tubo_raiz_id IS NOT NULL
        ORDER BY th.tubo_raiz_id, th.created_at DESC
    )
    SELECT COUNT(*) INTO v_ult_problem
    FROM colmena_tubos ct
    JOIN ult ON ult.tubo_raiz_id = ct.tubo_raiz_id
    WHERE ct.empresa_id = p_empresa_id
      AND ult.evento IN ('corte','merma','eliminado');

    -- 5. Tombstones activos en inventario (eliminado sin ingreso posterior)
    SELECT COUNT(*) INTO v_tomb_inv FROM colmena_tubos ct
    WHERE ct.empresa_id = p_empresa_id
      AND ct.tubo_raiz_id IS NOT NULL
      AND EXISTS (
          SELECT 1 FROM tubos_historial th_elim
          WHERE th_elim.empresa_id   = p_empresa_id::text
            AND th_elim.tubo_raiz_id = ct.tubo_raiz_id
            AND th_elim.evento       = 'eliminado'
            AND NOT EXISTS (
                SELECT 1 FROM tubos_historial th_ing
                WHERE th_ing.empresa_id   = p_empresa_id::text
                  AND th_ing.tubo_raiz_id = th_elim.tubo_raiz_id
                  AND th_ing.evento       = 'ingreso'
                  AND th_ing.created_at   > th_elim.created_at
            )
      );

    -- Determinar estado global
    IF v_dup_uuid > 0 OR v_sin_origen > 0 OR v_ult_problem > 0 OR v_tomb_inv > 0 THEN
        v_estado := 'error';
    ELSIF v_dup_fisicos > 0 THEN
        v_estado := 'warning';
    ELSE
        v_estado := 'ok';
    END IF;

    RETURN jsonb_build_object(
        'estado',       v_estado,
        'total_tubos',  v_total,
        'ts',           NOW(),
        'checks',       jsonb_build_array(
            jsonb_build_object(
                'nombre',     'duplicados_uuid',
                'count',      v_dup_uuid,
                'severity',   'error',
                'descripcion','Mismo UUID de tubo aparece más de una vez en el inventario'),
            jsonb_build_object(
                'nombre',     'duplicados_fisicos',
                'count',      v_dup_fisicos,
                'severity',   'warning',
                'descripcion','Misma colmena+código+medida+serial aparece más de una vez (puede ser legítimo)'),
            jsonb_build_object(
                'nombre',     'tubos_sin_origen',
                'count',      v_sin_origen,
                'severity',   'error',
                'descripcion','Tubo en inventario sin ningún evento de origen en el historial'),
            jsonb_build_object(
                'nombre',     'tubos_ultimo_evento_problematico',
                'count',      v_ult_problem,
                'severity',   'error',
                'descripcion','Tubo en inventario cuyo último evento es corte/merma/eliminado'),
            jsonb_build_object(
                'nombre',     'tombstones_en_inventario',
                'count',      v_tomb_inv,
                'severity',   'error',
                'descripcion','Tubo en inventario con un evento eliminado sin ingreso posterior')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verificar_salud_colmena(uuid) TO authenticated;

-- Smoke test (correr aparte, requiere sesión auth):
-- SELECT verificar_salud_colmena();
-- → debe devolver { "estado": "ok" o "warning", "total_tubos": N, "checks": [...] }
