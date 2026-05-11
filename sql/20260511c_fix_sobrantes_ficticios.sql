-- ============================================================================
-- Fix sobrantes ficticios: auto-eliminar en motivos que invalidan medida +
-- RPC manual para postventa
-- Fecha: 2026-05-11
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- Contexto (incidente OT 2938 del 11/05):
--   Postventa marcó error de corte "Medida incorrecta en plano" sobre OT 2938,
--   con reemplazo + destino_original=merma para el tubo origen. El flujo de
--   registrar_error_corte funcionó para corte y reemplazo, pero el SOBRANTE
--   asociado al corte original (un tubo ficticio que el plan dijo guardó pero
--   físicamente no existía) quedó intacto en colmena_tubos. Tuvimos que
--   limpiarlo con SQL puntual.
--
--   El gap: si la medida origen del plan era incorrecta, el sobrante
--   calculado también es incorrecto — pero la RPC no lo manejaba.
--
-- Fix en 2 capas:
--
--   CAPA 1 — Auto-eliminar (preventivo):
--   Cuando p_motivo IN ('Medida incorrecta en plano', 'Material defectuoso',
--   'Falla en el tubo') la medida origen del plan es inválida → el sobrante
--   calculado tampoco es real → eliminar el sobrante asociado al corte.
--
--   CAPA 2 — RPC manual marcar_sobrante_inexistente (reactivo):
--   Para casos donde el corte fue OK pero el operario reportó después que
--   no guardó el sobrante (lo desechó, era muy chico, se perdió). UI muestra
--   botón en la fila GUARDAR SOBRANTE.
--
-- Reversibilidad:
--   Cada eliminación se loguea con fuente identificable. Para revertir,
--   borrar el evento 'eliminado' correspondiente y re-INSERT en colmena_tubos.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Fix sobrantes ficticios — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Nueva RPC: marcar_sobrante_inexistente
--    Busca el sobrante asociado a la línea del plan y lo elimina (insert
--    evento 'eliminado' que el trigger trg_auto_remove_consumed_tube consume).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_sobrante_inexistente(
  p_plan_id     uuid,
  p_linea_idx   integer,
  p_responsable text,
  p_comentario  text DEFAULT NULL,
  p_fuente      text DEFAULT 'manual_postventa_sobrante_inexistente'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_empresa_id   uuid;
  v_raiz         uuid;
  v_tubo         record;
BEGIN
  -- Tenant isolation
  SELECT empresa_id INTO v_empresa_id FROM perfiles WHERE id = auth.uid();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin empresa asignada' USING ERRCODE = 'P0001';
  END IF;

  IF p_responsable IS NULL OR btrim(p_responsable) = '' THEN
    RAISE EXCEPTION 'Responsable es obligatorio' USING ERRCODE = '22023';
  END IF;

  -- Buscar el evento 'sobrante' de esa línea del plan
  SELECT tubo_raiz_id INTO v_raiz
  FROM tubos_historial
  WHERE plan_id = p_plan_id
    AND linea_idx = p_linea_idx
    AND evento = 'sobrante'
    AND empresa_id = v_empresa_id::text
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_raiz IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'razon', 'no_sobrante_registrado',
      'mensaje', 'No se encontró evento sobrante para esa línea del plan'
    );
  END IF;

  -- Buscar el sobrante en colmena_tubos por tubo_raiz_id
  SELECT id, tubo_raiz_id, n_colmena, cod, medida_cm
    INTO v_tubo
  FROM colmena_tubos
  WHERE tubo_raiz_id = v_raiz
    AND empresa_id = v_empresa_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'razon', 'sobrante_ya_consumido',
      'mensaje', 'El sobrante ya no está en colmena (consumido o eliminado previamente)',
      'tubo_raiz_id', v_raiz
    );
  END IF;

  PERFORM set_config('app.sync_active', 'true', true);

  -- Insertar evento 'eliminado'. El trigger trg_auto_remove_consumed_tube
  -- borra automáticamente de colmena_tubos.
  INSERT INTO tubos_historial (
    empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm,
    evento, registrado_por, notas, fuente
  ) VALUES (
    v_empresa_id::text, v_tubo.tubo_raiz_id, v_tubo.n_colmena, v_tubo.cod, v_tubo.medida_cm,
    'eliminado', p_responsable,
    COALESCE(NULLIF(btrim(p_comentario), ''),
             'Sobrante validado como inexistente físicamente'),
    p_fuente
  );

  RETURN jsonb_build_object(
    'success', true,
    'tubo_raiz_id', v_tubo.tubo_raiz_id,
    'n_colmena', v_tubo.n_colmena,
    'cod', v_tubo.cod,
    'medida_cm', v_tubo.medida_cm
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_sobrante_inexistente(uuid, integer, text, text, text)
  TO authenticated;

DO $$ BEGIN RAISE NOTICE 'Step 1: marcar_sobrante_inexistente creado'; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Patch a registrar_error_corte: al final, si motivo invalida medida
--    origen, eliminar el sobrante asociado (vía marcar_sobrante_inexistente).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_error_corte(
  p_plan_id uuid, p_plan_fecha timestamp with time zone, p_linea_idx integer,
  p_ot text, p_ubicacion text, p_colmena_original text, p_cod_original text,
  p_medida_cm numeric, p_medida_origen_cm numeric, p_color text, p_serial text,
  p_motivo text, p_comentario text, p_reemplazo_id uuid, p_sobrante_cm numeric,
  p_destino_original text, p_med_recuperar numeric, p_responsable text,
  p_tubo_nuevo_colmena text DEFAULT NULL::text,
  p_tubo_nuevo_cod text DEFAULT NULL::text,
  p_tubo_nuevo_medida_cm numeric DEFAULT NULL::numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_empresa_id      uuid;
  v_error_id        uuid;
  v_reemplazo       record;
  v_sobrante_id     uuid;
  v_sobrante_raiz   uuid;
  v_recup_id        uuid;
  v_recup_raiz      uuid;
  v_colmena_txt     text;
  v_nuevo_modo      boolean := false;
  v_nuevo_sobrante  numeric := 0;
  v_auto_eliminado  jsonb := NULL;
  -- Motivos donde la medida origen del plan es inválida → sobrante también
  v_motivos_invalidan_origen CONSTANT text[] := ARRAY[
    'Medida incorrecta en plano',
    'Material defectuoso',
    'Falla en el tubo'
  ];
BEGIN
  -- ── Tenant isolation ───────────────────────────────────────
  SELECT empresa_id INTO v_empresa_id FROM perfiles WHERE id = auth.uid();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin empresa asignada' USING ERRCODE = 'P0001';
  END IF;

  -- ── Validaciones generales ─────────────────────────────────
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo es obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_responsable IS NULL OR btrim(p_responsable) = '' THEN
    RAISE EXCEPTION 'Responsable es obligatorio' USING ERRCODE = '22023';
  END IF;

  IF p_destino_original NOT IN ('merma', 'recuperar') AND p_destino_original IS NOT NULL THEN
    RAISE EXCEPTION 'destino_original debe ser "merma", "recuperar" o null (recibido: %)',
      p_destino_original USING ERRCODE = '22023';
  END IF;

  IF p_destino_original = 'recuperar' THEN
    IF p_med_recuperar IS NULL OR p_med_recuperar <= 0 THEN
      RAISE EXCEPTION 'Para recuperar el tubo original se requiere una medida mayor a 0'
        USING ERRCODE = '22023';
    END IF;
    IF p_colmena_original IS NULL OR btrim(p_colmena_original) IN ('', 'TUBO NUEVO') THEN
      RAISE EXCEPTION 'No se puede recuperar a colmena: el tubo original no tiene colmena asignada'
        USING ERRCODE = '22023';
    END IF;
    v_colmena_txt := btrim(p_colmena_original);
  END IF;

  -- ── Detectar modo "tubo nuevo" ─────────────────────────────
  IF p_reemplazo_id IS NULL
     AND (p_tubo_nuevo_colmena IS NOT NULL
          OR p_tubo_nuevo_cod IS NOT NULL
          OR p_tubo_nuevo_medida_cm IS NOT NULL)
  THEN
    IF p_tubo_nuevo_colmena IS NULL OR btrim(p_tubo_nuevo_colmena) = '' THEN
      RAISE EXCEPTION 'Modo tubo nuevo: colmena destino del sobrante es obligatoria'
        USING ERRCODE = '22023';
    END IF;
    IF p_tubo_nuevo_cod IS NULL OR btrim(p_tubo_nuevo_cod) = '' THEN
      RAISE EXCEPTION 'Modo tubo nuevo: código del tubo es obligatorio'
        USING ERRCODE = '22023';
    END IF;
    IF p_tubo_nuevo_medida_cm IS NULL OR p_tubo_nuevo_medida_cm <= 0 THEN
      RAISE EXCEPTION 'Modo tubo nuevo: medida total del tubo debe ser mayor a 0'
        USING ERRCODE = '22023';
    END IF;
    IF p_tubo_nuevo_medida_cm < p_medida_cm THEN
      RAISE EXCEPTION 'El tubo nuevo (%cm) es menor que la medida necesaria (%cm)',
        p_tubo_nuevo_medida_cm, p_medida_cm USING ERRCODE = '22023';
    END IF;

    v_nuevo_modo := true;
    v_nuevo_sobrante := p_tubo_nuevo_medida_cm - p_medida_cm;
  END IF;

  PERFORM set_config('app.sync_active', 'true', true);

  -- ── INSERT en errores_corte ──
  BEGIN
    INSERT INTO errores_corte (
      empresa_id, plan_id, plan_fecha, linea_idx, ot, ubicacion,
      colmena_original, cod_original, medida_cm, medida_origen_cm, color,
      serial, motivo, comentario,
      reemplazo_colmena, reemplazo_cod, reemplazo_medida_cm,
      registrado_por
    )
    VALUES (
      v_empresa_id, p_plan_id, p_plan_fecha, p_linea_idx, p_ot, p_ubicacion,
      NULLIF(p_colmena_original, ''),
      p_cod_original, p_medida_cm, p_medida_origen_cm, p_color,
      p_serial, p_motivo, NULLIF(p_comentario, ''),
      CASE
        WHEN p_reemplazo_id IS NOT NULL THEN
          (SELECT n_colmena::text FROM colmena_tubos WHERE id = p_reemplazo_id)
        WHEN v_nuevo_modo THEN btrim(p_tubo_nuevo_colmena)
        ELSE NULL
      END,
      CASE
        WHEN p_reemplazo_id IS NOT NULL THEN
          (SELECT cod FROM colmena_tubos WHERE id = p_reemplazo_id)
        WHEN v_nuevo_modo THEN btrim(p_tubo_nuevo_cod)
        ELSE NULL
      END,
      CASE
        WHEN p_reemplazo_id IS NOT NULL THEN
          (SELECT medida_cm FROM colmena_tubos WHERE id = p_reemplazo_id)
        WHEN v_nuevo_modo THEN p_tubo_nuevo_medida_cm
        ELSE NULL
      END,
      p_responsable
    )
    RETURNING id INTO v_error_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe un error registrado para esta línea del plan'
      USING ERRCODE = '23505';
  END;

  -- ─── Branch A: Reemplazo desde colmena existente ───
  IF p_reemplazo_id IS NOT NULL THEN
    SELECT id, n_colmena, cod, medida_cm, tubo_raiz_id
      INTO v_reemplazo
    FROM colmena_tubos
    WHERE id = p_reemplazo_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tubo de reemplazo no encontrado o ya consumido (id: %)',
        p_reemplazo_id USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM colmena_tubos WHERE id = p_reemplazo_id;

    INSERT INTO tubos_historial (
      empresa_id, tubo_raiz_id, n_colmena, cod,
      medida_cm, medida_resultado_cm, evento, ot, notas, registrado_por
    ) VALUES (
      v_empresa_id, v_reemplazo.tubo_raiz_id, v_reemplazo.n_colmena::text, v_reemplazo.cod,
      v_reemplazo.medida_cm, COALESCE(p_sobrante_cm, 0),
      'error_reemplazo', COALESCE(p_ot, ''),
      'Reemplazo por error: ' || p_motivo || ' — cortado ' ||
      COALESCE(p_medida_cm::text, '?') || 'cm',
      p_responsable
    );

    IF p_sobrante_cm IS NOT NULL AND p_sobrante_cm > 0 THEN
      INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, agregado_por_admin)
      VALUES (v_empresa_id, v_reemplazo.n_colmena, v_reemplazo.cod, p_sobrante_cm, false)
      RETURNING id, tubo_raiz_id INTO v_sobrante_id, v_sobrante_raiz;

      INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod,
        medida_cm, medida_resultado_cm, evento, ot, notas, registrado_por
      ) VALUES (
        v_empresa_id, v_sobrante_raiz, v_reemplazo.n_colmena::text, v_reemplazo.cod,
        p_sobrante_cm, p_sobrante_cm, 'sobrante_error', COALESCE(p_ot, ''),
        'Sobrante de reemplazo OT ' || COALESCE(p_ot, '') || ' — ' || p_sobrante_cm ||
        'cm de vuelta a colmena ' || v_reemplazo.n_colmena,
        p_responsable
      );
    END IF;
  END IF;

  -- ─── Branch B: Tubo nuevo ─────────────────────
  IF v_nuevo_modo THEN
    INSERT INTO tubos_historial (
      empresa_id, n_colmena, cod, medida_cm, medida_resultado_cm,
      evento, ot, notas, registrado_por
    ) VALUES (
      v_empresa_id, btrim(p_tubo_nuevo_colmena), btrim(p_tubo_nuevo_cod),
      p_tubo_nuevo_medida_cm, p_tubo_nuevo_medida_cm,
      'ingreso', COALESCE(p_ot, ''),
      format('Tubo nuevo ingresado como reemplazo por error (OT %s) — %scm',
             COALESCE(p_ot, '-'), p_tubo_nuevo_medida_cm),
      p_responsable
    );

    INSERT INTO tubos_historial (
      empresa_id, n_colmena, cod, medida_cm, medida_resultado_cm,
      evento, ot, notas, registrado_por
    ) VALUES (
      v_empresa_id, btrim(p_tubo_nuevo_colmena), btrim(p_tubo_nuevo_cod),
      p_tubo_nuevo_medida_cm, v_nuevo_sobrante,
      'error_reemplazo', COALESCE(p_ot, ''),
      format('Reemplazo por error con tubo nuevo: %s — cortado %scm de %scm totales',
             p_motivo, p_medida_cm, p_tubo_nuevo_medida_cm),
      p_responsable
    );

    IF v_nuevo_sobrante > 0 THEN
      INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, agregado_por_admin)
      VALUES (v_empresa_id, btrim(p_tubo_nuevo_colmena),
              btrim(p_tubo_nuevo_cod), v_nuevo_sobrante, false)
      RETURNING id, tubo_raiz_id INTO v_sobrante_id, v_sobrante_raiz;

      INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod,
        medida_cm, medida_resultado_cm, evento, ot, notas, registrado_por
      ) VALUES (
        v_empresa_id, v_sobrante_raiz, btrim(p_tubo_nuevo_colmena), btrim(p_tubo_nuevo_cod),
        v_nuevo_sobrante, v_nuevo_sobrante, 'sobrante_error', COALESCE(p_ot, ''),
        format('Sobrante de tubo nuevo (OT %s) — %scm en colmena %s',
               COALESCE(p_ot, '-'), v_nuevo_sobrante, btrim(p_tubo_nuevo_colmena)),
        p_responsable
      );
    END IF;
  END IF;

  -- ─── Destino del tubo original ───
  IF p_destino_original = 'merma' THEN
    DECLARE
      v_raiz_original uuid;
    BEGIN
      SELECT tubo_raiz_id INTO v_raiz_original
      FROM tubos_historial
      WHERE plan_id = p_plan_id
        AND linea_idx = p_linea_idx
        AND evento = 'corte'
        AND empresa_id = v_empresa_id::text
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_raiz_original IS NULL THEN
        v_raiz_original := gen_random_uuid();
      END IF;

      INSERT INTO tubos_historial (
        empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
        evento, ot, notas, registrado_por
      ) VALUES (
        v_empresa_id, v_raiz_original,
        COALESCE(p_colmena_original, ''), p_cod_original,
        p_medida_origen_cm, 0,
        'merma', COALESCE(p_ot, ''),
        'Tubo original descartado como merma — error: ' || p_motivo,
        p_responsable
      );
    END;

  ELSIF p_destino_original = 'recuperar' THEN
    INSERT INTO colmena_tubos (empresa_id, n_colmena, cod, medida_cm, agregado_por_admin)
    VALUES (v_empresa_id, v_colmena_txt, p_cod_original, p_med_recuperar, false)
    RETURNING id, tubo_raiz_id INTO v_recup_id, v_recup_raiz;

    INSERT INTO tubos_historial (
      empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
      evento, ot, notas, registrado_por
    ) VALUES (
      v_empresa_id, v_recup_raiz, v_colmena_txt, p_cod_original,
      p_med_recuperar, p_med_recuperar,
      'ajuste', COALESCE(p_ot, ''),
      'Tubo original recuperado tras error (' || p_motivo || ') — reingresado ' ||
      p_med_recuperar || 'cm en colmena ' || v_colmena_txt,
      p_responsable
    );
  END IF;

  -- ─── NUEVO: Auto-eliminar sobrante asociado cuando el motivo invalida origen ──
  -- Si el plan tenía medida origen incorrecta o material defectuoso, el
  -- sobrante calculado por el optimizador tampoco es real. Se elimina
  -- automáticamente vía marcar_sobrante_inexistente.
  IF p_motivo = ANY (v_motivos_invalidan_origen) THEN
    v_auto_eliminado := public.marcar_sobrante_inexistente(
      p_plan_id    => p_plan_id,
      p_linea_idx  => p_linea_idx,
      p_responsable=> p_responsable,
      p_comentario => format('Auto-eliminado por error de corte (motivo: %s) — sobrante calculado no es real porque medida origen era inválida',
                             p_motivo),
      p_fuente     => 'auto_eliminado_por_motivo_invalida_origen'
    );
  END IF;

  RETURN jsonb_build_object(
    'success',                  true,
    'error_id',                 v_error_id,
    'reemplazo_consumido',      p_reemplazo_id IS NOT NULL OR v_nuevo_modo,
    'reemplazo_tipo',           CASE
                                  WHEN p_reemplazo_id IS NOT NULL THEN 'colmena'
                                  WHEN v_nuevo_modo THEN 'tubo_nuevo'
                                  ELSE NULL
                                END,
    'sobrante_reingresado',     COALESCE(p_sobrante_cm, 0) > 0 OR v_nuevo_sobrante > 0,
    'destino_original',         p_destino_original,
    'sobrante_nuevo_id',        v_sobrante_id,
    'recuperado_nuevo_id',      v_recup_id,
    'sobrante_origen_auto_eliminado', v_auto_eliminado
  );
END;
$function$;

DO $$ BEGIN RAISE NOTICE 'Step 2: registrar_error_corte parchada con auto-eliminar sobrante'; END $$;

DO $$ BEGIN RAISE NOTICE '=== Fix sobrantes ficticios — COMPLETADO ==='; END $$;

COMMIT;

-- ============================================================================
-- Smoke tests post-COMMIT (correr aparte):
--
-- 1) Verificar funciones creadas
--    SELECT proname, pronargs FROM pg_proc
--    WHERE proname IN ('marcar_sobrante_inexistente','registrar_error_corte');
--
-- 2) Probar marcar_sobrante_inexistente con un sobrante de prueba
--    (idealmente desde UI — el botón nuevo en HistorialCorte)
--
-- 3) Probar registrar_error_corte con motivo "Medida incorrecta en plano"
--    y verificar que el sobrante asociado desapareció de colmena_tubos
--    y quedó evento con fuente='auto_eliminado_por_motivo_invalida_origen'
-- ============================================================================
