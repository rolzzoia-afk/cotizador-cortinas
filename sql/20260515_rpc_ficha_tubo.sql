-- ============================================================================
-- RPCs: ficha_tubo + buscar_tubos
-- Fecha: 2026-05-15
-- Feature: Trazabilidad operativa de tubos (rediseño de Historial Tubos)
-- ============================================================================
--
-- ficha_tubo(p_tubo_raiz_id):
--   Devuelve TODA la historia de un tubo en un solo JSON listo para renderear:
--     - info actual (en colmena o último estado)
--     - origen (primer evento + fuente)
--     - padre (si nació de un corte: el tubo que se cortó para generarlo)
--     - hijos (si fue cortado: los sobrantes/mermas que generó)
--     - consumido_en (si fue cortado: a qué OT/línea fue)
--     - eventos (timeline completa en orden cronológico)
--
--   La relación padre-hijo se INFIERE por mismo `created_at` + misma `ot`
--   en `tubos_historial` (los eventos de un mismo corte se insertan en la
--   misma transacción del RPC, por lo que comparten timestamp y OT).
--
-- buscar_tubos(p_cod, p_colmena, p_medida, p_ot):
--   Devuelve un array de tubos que matchean. Sirve para el buscador.
--   Si se pasa OT → tubos involucrados en esa OT (cortes/sobrantes/mermas).
--   Si se pasan atributos → tubos en inventario o consumidos que matchean.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ficha_tubo(p_tubo_raiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa uuid;
    v_existe boolean;
    v_n_colmena text;
    v_cod text;
    v_medida numeric;
    v_en_inv boolean;
    v_estado text;
    v_origen jsonb;
    v_padre jsonb;
    v_hijos jsonb;
    v_consumido_en jsonb;
    v_eventos jsonb;
    v_origen_row record;
    v_padre_row record;
BEGIN
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;

    -- Verificar que el tubo pertenece a esta empresa
    v_existe := FALSE;
    PERFORM 1 FROM tubos_historial
    WHERE empresa_id = v_caller_empresa::text AND tubo_raiz_id = p_tubo_raiz_id LIMIT 1;
    IF FOUND THEN v_existe := TRUE; END IF;
    IF NOT v_existe THEN
        PERFORM 1 FROM colmena_tubos
        WHERE empresa_id = v_caller_empresa AND tubo_raiz_id = p_tubo_raiz_id LIMIT 1;
        IF FOUND THEN v_existe := TRUE; END IF;
    END IF;
    IF NOT v_existe THEN
        RAISE EXCEPTION 'Tubo no encontrado: %', p_tubo_raiz_id USING ERRCODE = '42704';
    END IF;

    -- ¿Está en inventario?
    SELECT TRUE, n_colmena, cod, medida_cm
      INTO v_en_inv, v_n_colmena, v_cod, v_medida
    FROM colmena_tubos
    WHERE empresa_id = v_caller_empresa AND tubo_raiz_id = p_tubo_raiz_id;
    IF v_en_inv IS NULL THEN v_en_inv := FALSE; END IF;

    -- Estado descripción
    IF v_en_inv THEN
        v_estado := 'En colmena ' || v_n_colmena;
    ELSE
        -- Mirar último evento
        SELECT
            CASE
                WHEN evento = 'corte'       THEN 'Cortado para OT ' || COALESCE(ot, '?')
                WHEN evento = 'merma'       THEN 'Merma descartada'
                WHEN evento = 'eliminado'   THEN 'Eliminado por admin'
                ELSE 'Último evento: ' || evento
            END,
            n_colmena, cod, medida_cm
          INTO v_estado, v_n_colmena, v_cod, v_medida
        FROM tubos_historial
        WHERE empresa_id = v_caller_empresa::text AND tubo_raiz_id = p_tubo_raiz_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Primer evento (origen)
    SELECT * INTO v_origen_row
    FROM tubos_historial
    WHERE empresa_id = v_caller_empresa::text AND tubo_raiz_id = p_tubo_raiz_id
    ORDER BY created_at ASC LIMIT 1;

    IF v_origen_row.id IS NOT NULL THEN
        v_origen := jsonb_build_object(
            'evento',  v_origen_row.evento,
            'fuente',  v_origen_row.fuente,
            'fecha',   v_origen_row.created_at,
            'ot',      v_origen_row.ot,
            'n_colmena', v_origen_row.n_colmena,
            'medida_cm', v_origen_row.medida_cm,
            'notas',   v_origen_row.notas
        );

        -- Si el origen es un sobrante/merma con OT, hay un corte padre del mismo timestamp
        IF v_origen_row.evento IN ('sobrante','sobrante_error','merma')
           AND v_origen_row.ot IS NOT NULL THEN
            SELECT * INTO v_padre_row
            FROM tubos_historial
            WHERE empresa_id = v_caller_empresa::text
              AND evento = 'corte'
              AND ot = v_origen_row.ot
              AND created_at = v_origen_row.created_at
              AND tubo_raiz_id <> p_tubo_raiz_id
            LIMIT 1;
            IF v_padre_row.tubo_raiz_id IS NOT NULL THEN
                v_padre := jsonb_build_object(
                    'tubo_raiz_id',        v_padre_row.tubo_raiz_id,
                    'cod',                 v_padre_row.cod,
                    'n_colmena',           v_padre_row.n_colmena,
                    'medida_cm',           v_padre_row.medida_cm,
                    'evento_corte_fecha',  v_padre_row.created_at,
                    'evento_corte_ot',     v_padre_row.ot,
                    'evento_corte_linea',  v_padre_row.linea_idx
                );
            END IF;
        END IF;
    END IF;

    -- Si fue cortado: hijos y dato de consumo
    IF EXISTS (
        SELECT 1 FROM tubos_historial
        WHERE empresa_id = v_caller_empresa::text
          AND tubo_raiz_id = p_tubo_raiz_id
          AND evento = 'corte'
    ) THEN
        -- Hijos: sobrantes/mermas del mismo timestamp + misma OT
        SELECT jsonb_agg(jsonb_build_object(
            'tubo_raiz_id',  th.tubo_raiz_id,
            'evento',        th.evento,
            'n_colmena',     th.n_colmena,
            'cod',           th.cod,
            'medida_cm',     th.medida_cm,
            'fecha',         th.created_at,
            'ot',            th.ot,
            'en_inventario', EXISTS (
                SELECT 1 FROM colmena_tubos ct
                WHERE ct.empresa_id = v_caller_empresa
                  AND ct.tubo_raiz_id = th.tubo_raiz_id
            )
        ) ORDER BY th.created_at) INTO v_hijos
        FROM tubos_historial th
        WHERE th.empresa_id = v_caller_empresa::text
          AND th.evento IN ('sobrante','sobrante_error','merma')
          AND th.tubo_raiz_id <> p_tubo_raiz_id
          AND EXISTS (
              SELECT 1 FROM tubos_historial th_c
              WHERE th_c.empresa_id = v_caller_empresa::text
                AND th_c.tubo_raiz_id = p_tubo_raiz_id
                AND th_c.evento = 'corte'
                AND th_c.created_at = th.created_at
                AND COALESCE(th_c.ot, '') = COALESCE(th.ot, '')
          );

        -- Consumido en (último corte del tubo)
        SELECT jsonb_build_object(
            'ot',             ot,
            'linea_idx',      linea_idx,
            'medida_cortada', medida_resultado_cm,
            'fecha',          created_at
        ) INTO v_consumido_en
        FROM tubos_historial
        WHERE empresa_id = v_caller_empresa::text
          AND tubo_raiz_id = p_tubo_raiz_id
          AND evento = 'corte'
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Todos los eventos en orden
    SELECT jsonb_agg(jsonb_build_object(
        'id',                  id,
        'evento',              evento,
        'fuente',              fuente,
        'n_colmena',           n_colmena,
        'cod',                 cod,
        'medida_cm',           medida_cm,
        'medida_resultado_cm', medida_resultado_cm,
        'ot',                  ot,
        'linea_idx',           linea_idx,
        'notas',               notas,
        'registrado_por',      registrado_por,
        'created_at',          created_at
    ) ORDER BY created_at) INTO v_eventos
    FROM tubos_historial
    WHERE empresa_id = v_caller_empresa::text
      AND tubo_raiz_id = p_tubo_raiz_id;

    RETURN jsonb_build_object(
        'tubo', jsonb_build_object(
            'tubo_raiz_id',       p_tubo_raiz_id,
            'cod',                v_cod,
            'n_colmena',          v_n_colmena,
            'medida_cm',          v_medida,
            'en_inventario',      v_en_inv,
            'estado_descripcion', COALESCE(v_estado, 'Sin eventos')
        ),
        'origen',       v_origen,
        'padre',        v_padre,
        'eventos',      COALESCE(v_eventos, '[]'::jsonb),
        'hijos',        COALESCE(v_hijos, '[]'::jsonb),
        'consumido_en', v_consumido_en
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ficha_tubo(uuid) TO authenticated;


-- ─── buscar_tubos ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buscar_tubos(
    p_cod      text    DEFAULT NULL,
    p_colmena  text    DEFAULT NULL,
    p_medida   numeric DEFAULT NULL,
    p_ot       text    DEFAULT NULL,
    p_limit    int     DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa uuid;
    v_result jsonb;
    v_cod text;
    v_colmena text;
    v_ot text;
BEGIN
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;

    v_cod     := NULLIF(TRIM(COALESCE(p_cod, '')), '');
    v_colmena := NULLIF(TRIM(COALESCE(p_colmena, '')), '');
    v_ot      := NULLIF(TRIM(COALESCE(p_ot, '')), '');

    IF v_ot IS NOT NULL THEN
        -- Por OT: tubos involucrados (cortes, sobrantes, mermas, ingresos de esa OT)
        SELECT jsonb_agg(t ORDER BY t.fecha_primera) INTO v_result FROM (
            SELECT DISTINCT ON (th.tubo_raiz_id)
                th.tubo_raiz_id,
                th.cod,
                th.n_colmena,
                th.medida_cm,
                th.evento     AS evento_en_ot,
                th.created_at AS fecha_primera,
                EXISTS (
                    SELECT 1 FROM colmena_tubos ct
                    WHERE ct.empresa_id = v_caller_empresa
                      AND ct.tubo_raiz_id = th.tubo_raiz_id
                ) AS en_inventario
            FROM tubos_historial th
            WHERE th.empresa_id = v_caller_empresa::text
              AND th.tubo_raiz_id IS NOT NULL
              AND th.ot ILIKE '%' || v_ot || '%'
            ORDER BY th.tubo_raiz_id, th.created_at ASC
            LIMIT p_limit
        ) t;
    ELSE
        -- Por atributos: en colmena_tubos primero, después en historial reciente
        SELECT jsonb_agg(t ORDER BY t.n_colmena, t.cod, t.medida_cm) INTO v_result FROM (
            SELECT
                ct.tubo_raiz_id,
                ct.cod,
                ct.n_colmena,
                ct.medida_cm,
                'ingreso'::text AS evento_en_ot,
                NULL::timestamptz AS fecha_primera,
                TRUE AS en_inventario
            FROM colmena_tubos ct
            WHERE ct.empresa_id = v_caller_empresa
              AND (v_cod     IS NULL OR ct.cod       ILIKE '%' || v_cod || '%')
              AND (v_colmena IS NULL OR ct.n_colmena ILIKE '%' || v_colmena || '%')
              AND (p_medida  IS NULL OR ABS(ct.medida_cm - p_medida) <= 0.5)
            LIMIT p_limit
        ) t;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_tubos(text, text, numeric, text, int) TO authenticated;
