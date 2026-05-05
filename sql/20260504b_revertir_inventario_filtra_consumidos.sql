-- ============================================================================
-- Patch: revertir_inventario filtra tubos consumidos del snapshot
-- Fecha: 2026-05-04 (parche del mismo día sobre la migración inicial)
-- ============================================================================
--
-- Contexto:
--   Al hacer el primer test de revertir_inventario sobre un inventario sin
--   cambios, el INSERT desde el snapshot fue bloqueado por el trigger
--   pre-existente `tubo_consumido_no_puede_reentrar_a_colmena`. La causa:
--   el snapshot capturó un tubo zombie (estaba en colmena_tubos pese a
--   tener evento 'corte' previo en historial sin 'ingreso' posterior).
--
--   Cuando revertir_inventario hace DELETE + INSERT desde el snapshot, el
--   trigger correctamente bloquea reinsertar el zombie. Pero eso aborta
--   toda la transacción.
--
-- Fix:
--   Replicar la misma lógica que sync_colmena_tubos usa para filtrar
--   'eliminado' — extendida a 'corte' y 'merma' (también consumen el tubo).
--   Si el snapshot tenía zombies, el revert los descarta silenciosamente.
--   Eso es correcto: revertir no debe restaurar zombies.
--
-- Trazabilidad:
--   Se añade RAISE NOTICE con el conteo de tubos descartados, visible en
--   los logs de la función. También se agrega ese conteo a la columna
--   `notas` del inventario para que el admin lo vea después.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.revertir_inventario(
    p_inventario_id uuid,
    p_motivo        text
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
    v_total_snap   integer;
    v_restaurados  integer;
    v_descartados  integer;
    v_nota_extra   text;
BEGIN
    SELECT id, empresa_id, rol INTO v_user_id, v_user_empresa, v_user_rol
      FROM perfiles WHERE id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF v_user_rol NOT IN ('admin','superadmin') THEN
        RAISE EXCEPTION 'Solo admin/superadmin pueden revertir inventarios' USING ERRCODE = '42501';
    END IF;
    IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
        RAISE EXCEPTION 'Motivo requerido (mínimo 5 caracteres) para revertir un inventario' USING ERRCODE = 'P0001';
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
        RAISE EXCEPTION 'Solo se puede revertir un inventario activo (estado actual: %)', v_inv_estado USING ERRCODE = 'P0001';
    END IF;

    -- Bypass del lock para que esta operación pueda escribir
    PERFORM set_config('app.sync_active', 'true', true);

    -- Borrar estado actual del scope del inventario
    DELETE FROM colmena_tubos
    WHERE empresa_id = v_inv_empresa
      AND (v_inv_colmena IS NULL OR n_colmena = v_inv_colmena);

    -- Restaurar desde snapshot, FILTRANDO zombies que el trigger
    -- tubo_consumido_no_puede_reentrar_a_colmena bloquearía:
    --   - Tubos con 'corte' sin 'ingreso' posterior
    --   - Tubos con 'eliminado' sin 'ingreso' posterior
    --   - Tubos con 'merma' sin 'ingreso' posterior
    SELECT COUNT(*) INTO v_total_snap
    FROM tubos_inventario_snapshot
    WHERE inventario_id = p_inventario_id;

    INSERT INTO colmena_tubos (
        id, empresa_id, n_colmena, cod, medida_cm, medida_mm,
        serial, tubo_raiz_id, agregado_por_admin, datos_extra, disponible, created_at
    )
    SELECT
        s.tubo_id_original, s.empresa_id, s.n_colmena, s.cod, s.medida_cm, s.medida_mm,
        s.serial, s.tubo_raiz_id, s.agregado_por_admin, s.datos_extra, s.disponible, s.created_at_original
    FROM tubos_inventario_snapshot s
    WHERE s.inventario_id = p_inventario_id
      AND (
          s.tubo_raiz_id IS NULL
          OR NOT EXISTS (
              SELECT 1
              FROM tubos_historial th_consumido
              WHERE th_consumido.empresa_id   = s.empresa_id::text
                AND th_consumido.tubo_raiz_id = s.tubo_raiz_id
                AND th_consumido.evento       IN ('corte','merma','eliminado')
                AND NOT EXISTS (
                    SELECT 1 FROM tubos_historial th_ing
                    WHERE th_ing.empresa_id   = s.empresa_id::text
                      AND th_ing.tubo_raiz_id = th_consumido.tubo_raiz_id
                      AND th_ing.evento       = 'ingreso'
                      AND th_ing.created_at   > th_consumido.created_at
                )
          )
      );

    GET DIAGNOSTICS v_restaurados = ROW_COUNT;
    v_descartados := v_total_snap - v_restaurados;

    IF v_descartados > 0 THEN
        RAISE NOTICE 'revertir_inventario: % de % tubos del snapshot descartados (zombies con corte/merma/eliminado en historial sin ingreso posterior)',
            v_descartados, v_total_snap;
    END IF;

    -- Cerrar como cancelado con motivo + nota sobre zombies si los hubo
    v_nota_extra := 'REVERTIDO: ' || p_motivo
                  || E'\n  → restaurados ' || v_restaurados || ' de ' || v_total_snap || ' tubos del snapshot'
                  || CASE WHEN v_descartados > 0
                          THEN E'\n  → ' || v_descartados || ' descartados por estar consumidos en el historial (zombies)'
                          ELSE ''
                     END;

    UPDATE inventarios
    SET estado            = 'cancelado',
        cerrado_at        = now(),
        cerrado_por       = v_user_id,
        cerrado_por_email = v_user_email,
        notas             = CASE
                                WHEN notas IS NULL OR notas = '' THEN v_nota_extra
                                ELSE notas || E'\n\n' || v_nota_extra
                             END
    WHERE id = p_inventario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_inventario(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.revertir_inventario(uuid, text) IS
'Restaura colmena_tubos desde el snapshot del inventario, filtrando tubos zombies '
'(con corte/merma/eliminado en historial sin ingreso posterior) que el trigger '
'tubo_consumido_no_puede_reentrar_a_colmena bloquearía. El conteo de descartes '
'queda registrado en inventarios.notas.';
