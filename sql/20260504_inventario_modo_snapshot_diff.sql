-- ============================================================================
-- Migración: modo inventario con snapshot, lock y diff/reconciliación
-- Fecha: 2026-05-04
-- ============================================================================
--
-- Contexto:
--   El equipo está empezando un inventario físico de la colmena. Riesgo:
--   tubos inventados, medidas duplicadas, fantasmas, mediciones erradas.
--   Esta migración agrega un "modo inventario" con red de seguridad mínima:
--
--     1. SNAPSHOT al iniciar — copia de colmena_tubos en
--        tubos_inventario_snapshot. Punto de rollback si algo sale mal.
--
--     2. LOCK durante inventario — sync_colmena_tubos rechaza con error claro
--        si hay un inventario activo (impide que el optimizador o un operario
--        con cache stale aplane los cambios mientras se cuenta).
--
--     3. DIFF al cerrar — RPC inventario_diff() devuelve 4 listas:
--        mantenidos / eliminados / nuevos / modificados. Admin revisa antes
--        de cerrar formalmente.
--
--     4. REVERT — RPC revertir_inventario() restaura colmena_tubos desde el
--        snapshot. Útil si se descubre un error grande al cerrar.
--
-- Alcance Phase 1:
--   - Inventario es "global" por empresa (todas las colmenas a la vez). El
--     campo n_colmena queda en la tabla por extensibilidad futura pero
--     siempre se llena con NULL en esta fase. Razón: sync_colmena_tubos
--     trabaja a nivel empresa (DELETE FROM colmena_tubos WHERE empresa_id),
--     no se puede scopear a una colmena sola sin reescribir esa RPC.
--
--   - Los admins siguen pudiendo editar `colmena_tubos` directamente vía la
--     UI de admin (hook colmena.ts). El diff captura cualquier cambio.
--     Los operarios (que pasan por sync_colmena_tubos vía optimizador) sí
--     quedan bloqueados durante el inventario.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) TABLAS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventarios (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id            uuid        NOT NULL,
    n_colmena             text,                                          -- null = todas las colmenas
    iniciado_por          uuid,                                          -- perfiles.id
    iniciado_por_email    text,
    iniciado_at           timestamptz NOT NULL DEFAULT now(),
    cerrado_at            timestamptz,
    cerrado_por           uuid,
    cerrado_por_email     text,
    estado                text        NOT NULL DEFAULT 'activo'
                                      CHECK (estado IN ('activo','cerrado','cancelado')),
    tubos_count_pre       integer     NOT NULL DEFAULT 0,
    tubos_count_post      integer,
    notas                 text
);

-- Solo puede haber UN inventario activo por (empresa, n_colmena). NULL en
-- n_colmena cuenta como un valor distinto a cualquier otro NULL en este
-- contexto (por eso usamos COALESCE para indexar).
CREATE UNIQUE INDEX IF NOT EXISTS inventarios_uniq_activo
    ON public.inventarios (empresa_id, COALESCE(n_colmena, '__all__'))
    WHERE estado = 'activo';

CREATE INDEX IF NOT EXISTS inventarios_empresa_estado
    ON public.inventarios (empresa_id, estado, iniciado_at DESC);


CREATE TABLE IF NOT EXISTS public.tubos_inventario_snapshot (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    inventario_id         uuid        NOT NULL REFERENCES public.inventarios(id) ON DELETE CASCADE,
    -- copia exacta de columnas relevantes de colmena_tubos:
    tubo_id_original      uuid        NOT NULL,
    empresa_id            uuid        NOT NULL,
    n_colmena             text,
    cod                   text,
    medida_cm             numeric,
    medida_mm             integer,
    serial                text,
    tubo_raiz_id          uuid,
    agregado_por_admin    boolean,
    datos_extra           jsonb,
    disponible            boolean,
    created_at_original   timestamptz,
    snapshot_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS snap_inventario_id
    ON public.tubos_inventario_snapshot (inventario_id);

CREATE INDEX IF NOT EXISTS snap_inventario_raiz
    ON public.tubos_inventario_snapshot (inventario_id, tubo_raiz_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS — admin de cada empresa solo ve sus propios inventarios
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tubos_inventario_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventarios_select_empresa ON public.inventarios;
CREATE POLICY inventarios_select_empresa ON public.inventarios
    FOR SELECT TO authenticated
    USING (empresa_id = (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS snap_select_empresa ON public.tubos_inventario_snapshot;
CREATE POLICY snap_select_empresa ON public.tubos_inventario_snapshot
    FOR SELECT TO authenticated
    USING (empresa_id = (SELECT empresa_id FROM perfiles WHERE id = auth.uid()));

-- Las escrituras solo se hacen via las RPCs (SECURITY DEFINER) — no policies
-- de INSERT/UPDATE/DELETE para usuarios authenticated.


-- ─────────────────────────────────────────────────────────────────────────────
-- 3) RPC: iniciar_inventario
--    Crea sesión + snapshot atómico. Solo admin/superadmin de la empresa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.iniciar_inventario(
    p_n_colmena text DEFAULT NULL,
    p_notas     text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id        uuid;
    v_user_email     text;
    v_user_rol       text;
    v_empresa_id     uuid;
    v_inventario_id  uuid;
    v_count          integer;
BEGIN
    -- Resolver usuario y empresa
    SELECT id, empresa_id, rol
      INTO v_user_id, v_empresa_id, v_user_rol
      FROM perfiles WHERE id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF v_user_rol NOT IN ('admin','superadmin') THEN
        RAISE EXCEPTION 'Solo admin/superadmin pueden iniciar inventarios' USING ERRCODE = '42501';
    END IF;

    v_user_email := (auth.jwt() ->> 'email');

    -- Crear inventario (UNIQUE INDEX evita duplicados activos)
    BEGIN
        INSERT INTO inventarios (
            empresa_id, n_colmena, iniciado_por, iniciado_por_email, notas
        ) VALUES (
            v_empresa_id, p_n_colmena, v_user_id, v_user_email, p_notas
        ) RETURNING id INTO v_inventario_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'Ya hay un inventario activo para esta empresa/colmena. Ciérralo o cancélalo antes de iniciar otro.'
            USING ERRCODE = 'P0001';
    END;

    -- Snapshot de colmena_tubos
    INSERT INTO tubos_inventario_snapshot (
        inventario_id, tubo_id_original, empresa_id, n_colmena, cod,
        medida_cm, medida_mm, serial, tubo_raiz_id, agregado_por_admin,
        datos_extra, disponible, created_at_original
    )
    SELECT
        v_inventario_id, ct.id, ct.empresa_id, ct.n_colmena, ct.cod,
        ct.medida_cm, ct.medida_mm, ct.serial, ct.tubo_raiz_id, ct.agregado_por_admin,
        ct.datos_extra, ct.disponible, ct.created_at
    FROM colmena_tubos ct
    WHERE ct.empresa_id = v_empresa_id
      AND (p_n_colmena IS NULL OR ct.n_colmena = p_n_colmena);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE inventarios SET tubos_count_pre = v_count WHERE id = v_inventario_id;

    RETURN v_inventario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.iniciar_inventario(text, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RPC: inventario_diff
--    Compara snapshot vs estado actual, devuelve diff por tubo_raiz_id.
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.inventario_diff(uuid);

CREATE OR REPLACE FUNCTION public.inventario_diff(p_inventario_id uuid)
RETURNS TABLE (
    tipo            text,           -- 'mantenido' | 'eliminado' | 'nuevo' | 'modificado'
    tubo_raiz_id    uuid,
    n_colmena_pre   text,
    n_colmena_post  text,
    cod_pre         text,
    cod_post        text,
    medida_cm_pre   numeric,
    medida_cm_post  numeric,
    serial_pre      text,
    serial_post     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_empresa  uuid;
    v_inv_empresa   uuid;
    v_inv_colmena   text;
BEGIN
    SELECT empresa_id INTO v_user_empresa FROM perfiles WHERE id = auth.uid();
    IF v_user_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;

    SELECT empresa_id, n_colmena INTO v_inv_empresa, v_inv_colmena
      FROM inventarios WHERE id = p_inventario_id;
    IF v_inv_empresa IS NULL THEN
        RAISE EXCEPTION 'Inventario no encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF v_inv_empresa IS DISTINCT FROM v_user_empresa THEN
        RAISE EXCEPTION 'No autorizado: ese inventario es de otra empresa' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH
        snap AS (
            SELECT s.tubo_raiz_id, s.n_colmena, s.cod, s.medida_cm, s.serial
            FROM tubos_inventario_snapshot s
            WHERE s.inventario_id = p_inventario_id
              AND s.tubo_raiz_id IS NOT NULL
        ),
        actual AS (
            SELECT t.tubo_raiz_id, t.n_colmena, t.cod, t.medida_cm, t.serial
            FROM colmena_tubos t
            WHERE t.empresa_id = v_inv_empresa
              AND (v_inv_colmena IS NULL OR t.n_colmena = v_inv_colmena)
              AND t.tubo_raiz_id IS NOT NULL
        )
    SELECT
        CASE
            WHEN s.tubo_raiz_id IS NULL THEN 'nuevo'
            WHEN a.tubo_raiz_id IS NULL THEN 'eliminado'
            WHEN s.n_colmena IS DISTINCT FROM a.n_colmena
              OR s.cod       IS DISTINCT FROM a.cod
              OR s.medida_cm IS DISTINCT FROM a.medida_cm
              OR s.serial    IS DISTINCT FROM a.serial THEN 'modificado'
            ELSE 'mantenido'
        END                                              AS tipo,
        COALESCE(s.tubo_raiz_id, a.tubo_raiz_id)         AS tubo_raiz_id,
        s.n_colmena, a.n_colmena,
        s.cod,       a.cod,
        s.medida_cm, a.medida_cm,
        s.serial,    a.serial
    FROM snap s
    FULL OUTER JOIN actual a ON s.tubo_raiz_id = a.tubo_raiz_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inventario_diff(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5) RPC: cerrar_inventario
--    Marca inventario como cerrado. Registra count post.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cerrar_inventario(
    p_inventario_id uuid,
    p_notas         text DEFAULT NULL
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
        notas             = CASE
                                WHEN p_notas IS NULL OR p_notas = '' THEN notas
                                WHEN notas IS NULL OR notas = '' THEN p_notas
                                ELSE notas || E'\n\n' || p_notas
                             END
    WHERE id = p_inventario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cerrar_inventario(uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6) RPC: revertir_inventario
--    Restaura colmena_tubos desde el snapshot. Marca inventario como cancelado.
-- ─────────────────────────────────────────────────────────────────────────────

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

    -- Restaurar desde snapshot (preservando ids originales para no romper FKs si las hubiera)
    INSERT INTO colmena_tubos (
        id, empresa_id, n_colmena, cod, medida_cm, medida_mm,
        serial, tubo_raiz_id, agregado_por_admin, datos_extra, disponible, created_at
    )
    SELECT
        tubo_id_original, empresa_id, n_colmena, cod, medida_cm, medida_mm,
        serial, tubo_raiz_id, agregado_por_admin, datos_extra, disponible, created_at_original
    FROM tubos_inventario_snapshot
    WHERE inventario_id = p_inventario_id;

    -- Cerrar como cancelado con motivo
    UPDATE inventarios
    SET estado            = 'cancelado',
        cerrado_at        = now(),
        cerrado_por       = v_user_id,
        cerrado_por_email = v_user_email,
        notas             = CASE
                                WHEN notas IS NULL OR notas = '' THEN 'REVERTIDO: ' || p_motivo
                                ELSE notas || E'\n\nREVERTIDO: ' || p_motivo
                             END
    WHERE id = p_inventario_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_inventario(uuid, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Modificación: sync_colmena_tubos chequea inventario activo y rechaza
--    Mantiene firma. Solo agrega un check al inicio.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_colmena_tubos(
    p_empresa_id       uuid,
    p_tubos            jsonb,
    p_expected_sync_at timestamptz DEFAULT NULL,
    p_eventos          jsonb       DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_empresa  uuid;
    v_current_sync_at timestamptz;
    v_total_actual    integer;
    v_a_eliminar      integer;
    v_inv_id          uuid;
BEGIN
    -- Validar autenticación y multi-tenancy
    SELECT empresa_id INTO v_caller_empresa FROM perfiles WHERE id = auth.uid();
    IF v_caller_empresa IS NULL THEN
        RAISE EXCEPTION 'No hay sesión activa' USING ERRCODE = '42501';
    END IF;
    IF p_empresa_id IS DISTINCT FROM v_caller_empresa THEN
        RAISE EXCEPTION 'No autorizado: no puedes sincronizar la colmena de otro tenant (caller=%, pedido=%)',
            v_caller_empresa, p_empresa_id USING ERRCODE = '42501';
    END IF;

    -- ★ NUEVO: Bloqueo durante inventario activo
    SELECT id INTO v_inv_id FROM inventarios
     WHERE empresa_id = p_empresa_id AND estado = 'activo'
     LIMIT 1;
    IF v_inv_id IS NOT NULL THEN
        RAISE EXCEPTION 'Hay un inventario activo (id=%). Cierra o cancela el inventario antes de sincronizar la colmena.', v_inv_id
            USING ERRCODE = 'P0001';
    END IF;

    -- Lock optimista
    IF p_expected_sync_at IS NOT NULL THEN
        SELECT last_sync_at INTO v_current_sync_at
        FROM colmena_sync_state
        WHERE empresa_id = p_empresa_id
        FOR UPDATE;

        IF v_current_sync_at IS NULL THEN
            INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
            VALUES (p_empresa_id, NOW(), COALESCE(auth.uid()::text, 'rpc'));
        ELSIF v_current_sync_at IS DISTINCT FROM p_expected_sync_at THEN
            RAISE EXCEPTION 'colmena_sync_conflict: la colmena fue modificada por otra sesión (BD=%, esperado=%)',
                v_current_sync_at, p_expected_sync_at USING ERRCODE = '40001';
        END IF;
    END IF;

    -- Guard de borrado masivo (PR #23)
    IF p_expected_sync_at IS NULL THEN
        SELECT COUNT(*)::integer INTO v_total_actual
          FROM colmena_tubos WHERE empresa_id = p_empresa_id;

        v_a_eliminar := v_total_actual - COALESCE(jsonb_array_length(p_tubos), 0);

        IF v_a_eliminar > 10
           AND v_total_actual > 0
           AND (v_a_eliminar::numeric / v_total_actual) > 0.10 THEN
            RAISE EXCEPTION 'Borrado masivo bloqueado: la sincronización iba a eliminar % tubos de % (>10%% del inventario). Recarga la página y vuelve a intentar.',
                v_a_eliminar, v_total_actual USING ERRCODE = '40001';
        END IF;
    END IF;

    PERFORM set_config('app.sync_active', 'true', true);

    DELETE FROM colmena_tubos WHERE empresa_id = p_empresa_id;

    INSERT INTO colmena_tubos (
        empresa_id, n_colmena, cod, medida_cm, medida_mm,
        serial, tubo_raiz_id, agregado_por_admin
    )
    SELECT
        p_empresa_id,
        COALESCE(t->>'n_colmena', '-'),
        COALESCE(UPPER(TRIM(t->>'cod')), ''),
        COALESCE((t->>'medida_cm')::numeric, 0),
        COALESCE((t->>'medida_mm')::integer, 0),
        NULLIF(t->>'serial', ''),
        COALESCE((t->>'tubo_raiz_id')::uuid, gen_random_uuid()),
        COALESCE((t->>'agregado_por_admin')::boolean, false)
    FROM jsonb_array_elements(p_tubos) AS t
    WHERE (t->>'tubo_raiz_id') IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM tubos_historial th_elim
           WHERE th_elim.empresa_id   = p_empresa_id::text
             AND th_elim.tubo_raiz_id = (t->>'tubo_raiz_id')::uuid
             AND th_elim.evento       = 'eliminado'
             AND NOT EXISTS (
                 SELECT 1 FROM tubos_historial th_ing
                 WHERE th_ing.empresa_id   = p_empresa_id::text
                   AND th_ing.tubo_raiz_id = th_elim.tubo_raiz_id
                   AND th_ing.evento       = 'ingreso'
                   AND th_ing.created_at   > th_elim.created_at
             )
       );

    IF p_eventos IS NOT NULL AND jsonb_array_length(p_eventos) > 0 THEN
        INSERT INTO tubos_historial (
            empresa_id, tubo_raiz_id, n_colmena, cod, medida_cm, medida_resultado_cm,
            evento, plan_id, ot, linea_idx, registrado_por, notas, fuente
        )
        SELECT
            p_empresa_id::text,
            NULLIF(e->>'tubo_raiz_id', '')::uuid,
            e->>'n_colmena',
            UPPER(TRIM(e->>'cod')),
            NULLIF(e->>'medida_cm', '')::numeric,
            NULLIF(e->>'medida_resultado_cm', '')::numeric,
            e->>'evento',
            NULLIF(e->>'plan_id', '')::uuid,
            e->>'ot',
            NULLIF(e->>'linea_idx', '')::integer,
            COALESCE(e->>'registrado_por', auth.uid()::text),
            e->>'notas',
            COALESCE(e->>'fuente', 'optimizador')
        FROM jsonb_array_elements(p_eventos) AS e
        WHERE e->>'evento' IN ('ingreso', 'corte', 'sobrante', 'merma', 'eliminado');
    END IF;

    UPDATE colmena_sync_state
    SET last_sync_at = NOW(),
        last_sync_by = COALESCE(auth.uid()::text, 'rpc')
    WHERE empresa_id = p_empresa_id;

    IF NOT FOUND THEN
        INSERT INTO colmena_sync_state (empresa_id, last_sync_at, last_sync_by)
        VALUES (p_empresa_id, NOW(), COALESCE(auth.uid()::text, 'rpc'))
        ON CONFLICT (empresa_id) DO UPDATE SET
            last_sync_at = NOW(),
            last_sync_by = COALESCE(auth.uid()::text, 'rpc');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) TO authenticated;

COMMENT ON FUNCTION public.sync_colmena_tubos(uuid, jsonb, timestamptz, jsonb) IS
'Sincroniza colmena_tubos con el estado final del optimizador (PR #14, #23) y, '
'desde 2026-05-04, rechaza con error si hay un inventario activo para la empresa.';

COMMIT;

-- ============================================================================
-- Smoke tests rápidos (correr post-deploy en SQL editor)
-- ============================================================================
-- 1. Iniciar inventario:
--    SELECT iniciar_inventario(NULL, 'inventario manual mayo 2026');
-- 2. Listar inventarios activos:
--    SELECT id, iniciado_por_email, iniciado_at, tubos_count_pre
--      FROM inventarios WHERE estado = 'activo';
-- 3. Probar bloqueo: ejecutar sync_colmena_tubos con cualquier args
--    desde el optimizador → debe fallar con "Hay un inventario activo".
-- 4. Ver diff:
--    SELECT * FROM inventario_diff('<id>');
-- 5. Cerrar:
--    SELECT cerrar_inventario('<id>', 'cierre OK');
-- 6. (Si necesitas revertir antes de cerrar):
--    SELECT revertir_inventario('<id>', 'motivo del rollback');
