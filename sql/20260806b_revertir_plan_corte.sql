-- ============================================================================
-- RPC revertir_plan_corte + reversa del CORR 50 (OT #DARK-OSCURANTI)
-- Fecha: 2026-08-06
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- QUÉ HACE
--   Deshace por completo un plan de corte de tubos: borra el plan del historial
--   y deja `colmena_tubos` exactamente como estaba justo antes de esa
--   optimización. Es la versión automatizada del procedimiento que veníamos
--   haciendo a mano (5 reversas entre julio y agosto de 2026), con los guards
--   que cada una de esas reversas nos enseñó.
--
-- POR QUÉ NO ALCANZA LO QUE YA EXISTÍA
--   `restaurar_plan_de_corte` viaja al estado anterior a un plan PASADO, pero
--   no borra el plan, no elimina los sobrantes que creó, y la UI lo deshabilita
--   justo para el plan vigente — que es el que uno quiere deshacer. El botón
--   "Error / No existe" del historial trabaja línea por línea.
--
-- CÓMO DECIDE QUÉ TOCAR (todo por `tubo_raiz_id`, nunca por fecha: al guardar
-- un plan la RPC reescribe la colmena entera y todas las filas quedan con
-- `created_at` nuevo)
--   · sobrantes del plan que siguen vivos  → se BORRAN
--   · tubos del snapshot que el plan consumió → se REINSERTAN
--   · tubos del snapshot que desaparecieron sin que nadie los cortara
--     (los borra el rewrite de `guardar_plan_atomico` cuando el snapshot viene
--     del caché stale del optimizador — pasó el 23-07) → se REINSERTAN y se
--     reportan aparte
--   · tubos del snapshot consumidos ANTES de este plan (snapshot stale) → NO
--     se reinsertan, se reportan
--   · tubos vivos que no son del snapshot ni sobrantes del plan (ingresos
--     manuales hechos después de la foto) → se PRESERVAN intactos
--
-- QUÉ NO HACE
--   No revierte los seriales que el optimizador marcó como ocupados
--   (`configuracion.opt_seriales_*`): eso vive fuera de la transacción de la
--   colmena. El snapshot los conserva en `snapshot_seriales` por si hiciera
--   falta a mano.
--
-- SEGURIDAD
--   Solo admin. Se niega si después del plan hubo cortes, mermas, sobrantes o
--   cualquier otro plan: en ese caso la reversa arrastraría trabajo ajeno y hay
--   que resolverlo a mano. Un ingreso manual posterior NO bloquea: se preserva.
--   Todo corre en la transacción de la función y termina con una aserción: si
--   la colmena final no es exactamente snapshot ∪ preservados, aborta y no
--   queda nada aplicado.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Bitácora de reversas: guarda el paquete completo de lo que se deshizo,
--    para poder auditar (o rehacer a mano) sin depender de tablas de backup
--    creadas al vuelo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reversas_planes_corte (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  uuid NOT NULL,
    plan_id     uuid NOT NULL,
    plan_fecha  timestamptz,
    ots         text,
    actor       text,
    nota        text,
    resumen     jsonb NOT NULL,
    paquete     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reversas_planes_empresa
    ON public.reversas_planes_corte (empresa_id, created_at DESC);

ALTER TABLE public.reversas_planes_corte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reversas_planes_select_empresa ON public.reversas_planes_corte;
CREATE POLICY reversas_planes_select_empresa ON public.reversas_planes_corte
    FOR SELECT TO authenticated
    USING (empresa_id::text = get_user_empresa_id());

COMMENT ON TABLE public.reversas_planes_corte IS
'Bitácora de reversas de planes de corte (revertir_plan_corte). `paquete` guarda
el plan, sus eventos y las filas de colmena borradas/reinsertadas.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) La RPC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revertir_plan_corte(
    p_plan_id uuid,
    p_nota    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_empresa      uuid;
    v_fecha        timestamptz;
    v_tipo         text;
    v_ots          text[];
    v_ts           timestamptz;
    v_n_ts         integer;
    v_respaldo_id  uuid;
    v_snapshot     jsonb;
    v_colmena_pre  integer;
    v_colmena_post integer;
    v_borrados     integer := 0;
    v_reinsertados integer := 0;
    v_silenciosos  integer := 0;
    v_fantasmas    integer := 0;
    v_preservados  integer := 0;
    v_eventos      integer := 0;
    v_sobran       integer;
    v_faltan       integer;
    v_dup          integer;
    v_paquete      jsonb;
    v_resumen      jsonb;
    v_actor        text;
BEGIN
    -- GUARD_ADMIN_2026: solo administradores
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden revertir un plan de corte.'
            USING ERRCODE = 'P0009';
    END IF;

    v_actor := COALESCE(auth.uid()::text, 'rpc');

    -- ─── A) El plan ─────────────────────────────────────────────────────────
    SELECT empresa_id, fecha, tipo, snapshot_inventario
      INTO v_empresa, v_fecha, v_tipo, v_snapshot
    FROM planes_corte
    WHERE id = p_plan_id;

    IF v_empresa IS NULL THEN
        RAISE EXCEPTION 'El plan % no existe.', p_plan_id USING ERRCODE = 'P0002';
    END IF;

    IF v_tipo IS NOT NULL THEN
        RAISE EXCEPTION 'El plan % es una fila "%": hay que revertir el plan principal, no su respaldo.',
            p_plan_id, v_tipo USING ERRCODE = 'P0007';
    END IF;

    IF v_snapshot IS NULL OR jsonb_array_length(v_snapshot) = 0 THEN
        RAISE EXCEPTION 'El plan % no tiene snapshot de inventario: no se puede reconstruir el estado anterior.',
            p_plan_id USING ERRCODE = 'P0007';
    END IF;

    -- OTs del plan (viven dentro del jsonb `ordenes`, a veces número y a veces texto).
    SELECT ARRAY(
        SELECT DISTINCT o->>'ot'
        FROM planes_corte p, jsonb_array_elements(p.ordenes) AS o
        WHERE p.id = p_plan_id AND COALESCE(o->>'ot', '') <> ''
    ) INTO v_ots;

    IF v_ots IS NULL OR array_length(v_ots, 1) IS NULL THEN
        RAISE EXCEPTION 'El plan % no declara ninguna OT en sus órdenes.', p_plan_id
            USING ERRCODE = 'P0007';
    END IF;

    -- ─── B) El instante de los eventos ──────────────────────────────────────
    -- Los eventos del optimizador no llevan plan_id: el nexo es que TODOS
    -- comparten el now() de la transacción que guardó el plan. Se exige que sea
    -- uno solo para no barrer historia de otro plan de la misma OT.
    SELECT COUNT(DISTINCT created_at), MIN(created_at)
      INTO v_n_ts, v_ts
    FROM tubos_historial
    WHERE empresa_id = v_empresa::text
      AND (plan_id = p_plan_id OR ot = ANY(v_ots))
      AND created_at BETWEEN v_fecha AND v_fecha + interval '10 minutes';

    IF v_n_ts = 0 THEN
        RAISE EXCEPTION 'No se encontraron eventos de inventario para el plan % (OTs %). ¿Ya se revirtió?',
            p_plan_id, array_to_string(v_ots, ', ') USING ERRCODE = 'P0002';
    END IF;

    IF v_n_ts > 1 THEN
        RAISE EXCEPTION 'Los eventos de las OTs % cerca de este plan tienen % instantes distintos: hay que revisarlo a mano.',
            array_to_string(v_ots, ', '), v_n_ts USING ERRCODE = 'P0007';
    END IF;

    -- ─── C) Guards de vigencia ──────────────────────────────────────────────
    IF EXISTS (
        SELECT 1 FROM planes_corte
        WHERE empresa_id = v_empresa AND fecha > v_fecha + interval '10 seconds'
    ) THEN
        RAISE EXCEPTION 'Hay planes de corte posteriores a este: revertí primero el más reciente.'
            USING ERRCODE = 'P0007';
    END IF;

    -- Un ingreso posterior es inofensivo (queda preservado); cualquier consumo o
    -- sobrante posterior significa que la colmena siguió trabajando.
    IF EXISTS (
        SELECT 1 FROM tubos_historial
        WHERE empresa_id = v_empresa::text
          AND created_at > v_ts
          AND evento <> 'ingreso'
    ) THEN
        RAISE EXCEPTION 'Después de este plan hubo movimientos de inventario (cortes, mermas o sobrantes): la reversa arrastraría ese trabajo. Hay que hacerla a mano.'
            USING ERRCODE = 'P0007';
    END IF;

    SELECT COUNT(*) INTO v_colmena_pre FROM colmena_tubos WHERE empresa_id = v_empresa;

    -- ─── D) Clasificación (todo por tubo_raiz_id) ───────────────────────────
    -- Un snapshot puede traer la misma raíz repetida (planes viejos): se toma
    -- una sola fila por raíz, siempre la misma (orden estable).
    DROP TABLE IF EXISTS _snap;
    CREATE TEMP TABLE _snap ON COMMIT DROP AS
    SELECT DISTINCT ON (raiz) *
    FROM (
        SELECT (t->>'tubo_raiz_id')::uuid                     AS raiz,
               COALESCE(t->>'n_colmena', '-')                 AS n_colmena,
               COALESCE(UPPER(TRIM(t->>'cod')), '')           AS cod,
               COALESCE((t->>'medida_cm')::numeric, 0)        AS medida_cm,
               COALESCE((t->>'medida_mm')::numeric,
                        ROUND(COALESCE((t->>'medida_cm')::numeric, 0) * 10)) AS medida_mm,
               NULLIF(t->>'serial', '')                       AS serial
        FROM jsonb_array_elements(v_snapshot) AS t
        WHERE (t->>'tubo_raiz_id') IS NOT NULL
    ) s
    ORDER BY raiz, cod, medida_cm, n_colmena;

    -- Eventos del plan (el instante exacto).
    DROP TABLE IF EXISTS _ev;
    CREATE TEMP TABLE _ev ON COMMIT DROP AS
    SELECT * FROM tubos_historial
    WHERE empresa_id = v_empresa::text
      AND created_at = v_ts
      AND (plan_id = p_plan_id OR ot = ANY(v_ots));

    SELECT COUNT(*) INTO v_eventos FROM _ev;

    -- Filas vivas hoy.
    DROP TABLE IF EXISTS _viva;
    CREATE TEMP TABLE _viva ON COMMIT DROP AS
    SELECT tubo_raiz_id AS raiz FROM colmena_tubos WHERE empresa_id = v_empresa;

    -- (1) Sobrantes creados por el plan que siguen vivos → borrar.
    DROP TABLE IF EXISTS _borrar;
    CREATE TEMP TABLE _borrar ON COMMIT DROP AS
    SELECT DISTINCT e.tubo_raiz_id AS raiz
    FROM _ev e
    WHERE e.evento IN ('sobrante', 'sobrante_error')
      AND e.tubo_raiz_id IN (SELECT raiz FROM _viva);

    -- (2) Tubos del snapshot que ya no están vivos.
    --     · consumidos por ESTE plan            → reinsertar
    --     · desaparecidos sin consumo (silencioso) → reinsertar y reportar
    --     · consumidos ANTES (snapshot stale)   → NO reinsertar, reportar
    DROP TABLE IF EXISTS _ausentes;
    CREATE TEMP TABLE _ausentes ON COMMIT DROP AS
    SELECT s.*,
           EXISTS (SELECT 1 FROM _ev e
                    WHERE e.tubo_raiz_id = s.raiz
                      AND e.evento IN ('corte', 'merma', 'eliminado'))        AS consumido_aqui,
           EXISTS (SELECT 1 FROM tubos_historial h
                    WHERE h.empresa_id = v_empresa::text
                      AND h.tubo_raiz_id = s.raiz
                      AND h.created_at < v_ts
                      AND h.evento IN ('corte', 'merma', 'eliminado'))        AS consumido_antes
    FROM _snap s
    WHERE s.raiz NOT IN (SELECT raiz FROM _viva);

    SELECT COUNT(*) FILTER (WHERE consumido_aqui),
           COUNT(*) FILTER (WHERE NOT consumido_aqui AND NOT consumido_antes),
           COUNT(*) FILTER (WHERE NOT consumido_aqui AND consumido_antes)
      INTO v_reinsertados, v_silenciosos, v_fantasmas
    FROM _ausentes;

    -- (3) Vivos ajenos al plan y al snapshot: ingresos manuales posteriores.
    DROP TABLE IF EXISTS _preservar;
    CREATE TEMP TABLE _preservar ON COMMIT DROP AS
    SELECT raiz FROM _viva
    WHERE raiz NOT IN (SELECT raiz FROM _snap)
      AND raiz NOT IN (SELECT raiz FROM _borrar);

    SELECT COUNT(*) INTO v_preservados FROM _preservar;

    -- ─── E) Paquete de auditoría (ANTES de tocar nada) ──────────────────────
    SELECT jsonb_build_object(
        'planes',   (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
                       FROM planes_corte p
                      WHERE p.id = p_plan_id
                         OR (p.empresa_id = v_empresa AND p.tipo = 'respaldo'
                             AND p.fecha BETWEEN v_fecha - interval '5 minutes' AND v_fecha)),
        'eventos',  (SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb) FROM _ev e),
        'borradas', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                       FROM colmena_tubos c
                      WHERE c.empresa_id = v_empresa
                        AND c.tubo_raiz_id IN (SELECT raiz FROM _borrar)),
        'reinsertadas', (SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb) FROM _ausentes a),
        'preservadas',  (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                       FROM colmena_tubos c
                      WHERE c.empresa_id = v_empresa
                        AND c.tubo_raiz_id IN (SELECT raiz FROM _preservar))
    ) INTO v_paquete;

    -- El respaldo gemelo que escribe el optimizador junto al plan.
    SELECT id INTO v_respaldo_id
    FROM planes_corte
    WHERE empresa_id = v_empresa
      AND tipo = 'respaldo'
      AND fecha BETWEEN v_fecha - interval '5 minutes' AND v_fecha
    ORDER BY fecha DESC
    LIMIT 1;

    -- ─── F) Aplicar, en el ORDEN que exigen los triggers ────────────────────
    -- Sin esto, el DELETE de la colmena dejaría eventos 'eliminado' y el INSERT
    -- de los consumidos chocaría con el trigger anti-reingreso.
    PERFORM set_config('app.sync_active', 'true', true);

    -- F.1 Historial del plan primero: mientras exista el 'corte', el trigger
    --     bloquear_insert_tubo_consumido rechaza devolver el tubo a la colmena.
    DELETE FROM tubos_historial
    WHERE empresa_id = v_empresa::text
      AND created_at = v_ts
      AND (plan_id = p_plan_id OR ot = ANY(v_ots));

    -- F.2 Los sobrantes que creó el plan.
    DELETE FROM colmena_tubos
    WHERE empresa_id = v_empresa
      AND tubo_raiz_id IN (SELECT raiz FROM _borrar);
    GET DIAGNOSTICS v_borrados = ROW_COUNT;

    -- F.3 Devolver los tubos que consumió (y los que se esfumaron en silencio).
    INSERT INTO colmena_tubos (
        empresa_id, n_colmena, cod, medida_cm, medida_mm, serial, tubo_raiz_id
    )
    SELECT v_empresa, a.n_colmena, a.cod, a.medida_cm, a.medida_mm, a.serial, a.raiz
    FROM _ausentes a
    WHERE a.consumido_aqui OR NOT a.consumido_antes;

    -- F.4 Soltar las referencias al plan y borrarlo (plan + respaldo gemelo).
    UPDATE tubos_historial SET plan_id = NULL WHERE plan_id IN (p_plan_id, v_respaldo_id);
    UPDATE errores_corte   SET plan_id = NULL WHERE plan_id IN (p_plan_id, v_respaldo_id);
    UPDATE correcciones    SET plan_id = NULL WHERE plan_id IN (p_plan_id, v_respaldo_id);

    DELETE FROM planes_corte WHERE id IN (p_plan_id, v_respaldo_id);

    -- F.5 Invalidar el caché del optimizador.
    UPDATE colmena_sync_state
       SET last_sync_at = NOW(), last_sync_by = v_actor
     WHERE empresa_id = v_empresa;

    -- ─── G) Aserción: la colmena tiene que ser snapshot ∪ preservados ───────
    SELECT COUNT(*) INTO v_colmena_post FROM colmena_tubos WHERE empresa_id = v_empresa;

    SELECT COUNT(*) INTO v_faltan
    FROM _snap s
    WHERE s.raiz NOT IN (SELECT tubo_raiz_id FROM colmena_tubos WHERE empresa_id = v_empresa)
      AND s.raiz NOT IN (SELECT raiz FROM _ausentes WHERE consumido_antes AND NOT consumido_aqui);

    SELECT COUNT(*) INTO v_sobran
    FROM colmena_tubos c
    WHERE c.empresa_id = v_empresa
      AND c.tubo_raiz_id NOT IN (SELECT raiz FROM _snap)
      AND c.tubo_raiz_id NOT IN (SELECT raiz FROM _preservar);

    SELECT COUNT(*) INTO v_dup
    FROM (SELECT tubo_raiz_id FROM colmena_tubos WHERE empresa_id = v_empresa
          GROUP BY tubo_raiz_id HAVING COUNT(*) > 1) d;

    IF v_faltan <> 0 OR v_sobran <> 0 OR v_dup <> 0 THEN
        RAISE EXCEPTION 'Reversa abortada: la colmena no quedó igual al estado previo (faltan=%, sobran=%, duplicados=%). No se aplicó ningún cambio.',
            v_faltan, v_sobran, v_dup USING ERRCODE = 'P0007';
    END IF;

    -- ─── H) Bitácora + resumen ──────────────────────────────────────────────
    v_resumen := jsonb_build_object(
        'plan_id',            p_plan_id,
        'respaldo_id',        v_respaldo_id,
        'ots',                array_to_string(v_ots, ', '),
        'plan_fecha',         v_fecha,
        'eventos_borrados',   v_eventos,
        'sobrantes_borrados', v_borrados,
        'tubos_reingresados', v_reinsertados,
        'reingresos_silenciosos', v_silenciosos,
        'fantasmas_omitidos', v_fantasmas,
        'preservados',        v_preservados,
        'colmena_antes',      v_colmena_pre,
        'colmena_despues',    v_colmena_post
    );

    INSERT INTO reversas_planes_corte (
        empresa_id, plan_id, plan_fecha, ots, actor, nota, resumen, paquete
    ) VALUES (
        v_empresa, p_plan_id, v_fecha, array_to_string(v_ots, ', '),
        v_actor, p_nota, v_resumen, v_paquete
    );

    RETURN v_resumen;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revertir_plan_corte(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.revertir_plan_corte(uuid, text) IS
'Deshace un plan de corte de tubos: borra el plan (y su respaldo gemelo), elimina
los sobrantes que creó y devuelve a la colmena los tubos que consumió, dejándola
igual que antes de la optimización. Preserva los ingresos manuales posteriores.
Se niega si hubo planes o consumos posteriores. Solo admin.';

-- ============================================================================
-- 3) RESPALDOS antes de deshacer el CORR 50 (OT #DARK-OSCURANTI, 06-08 19:01)
-- ============================================================================
--
-- La reversa en sí se hace desde la APP: Historial de Corte → el plan más
-- reciente → botón deshacer (↶). Eso ejercita el mismo camino que va a usar el
-- taller de ahora en adelante. Estas tres tablas son la red de seguridad
-- adicional (la RPC igual guarda su propio paquete en `reversas_planes_corte`).
--
-- Estado verificado antes de correr esto:
--   · plan b06e6720-4226-4b72-9716-bc3d394638c6 (+ respaldo 6fb036f6-…), snapshot 326
--   · 69 eventos, todos en 2026-08-06 19:01:32.763588+00 (25 corte · 19 ingreso
--     · 3 merma · 22 sobrante)
--   · colmena hoy 342 · viven 18 sobrantes del plan · consumió 4 tubos del snapshot
--   · 2 ingresos manuales previos (E62 479,4 L03 · E62 96,3 B3) → se preservan
--   · 0 eventos y 0 planes posteriores
--   ⇒ esperado: 342 − 18 + 4 = 328  (326 del snapshot + 2 manuales)
-- ============================================================================

DROP TABLE IF EXISTS colmena_tubos_backup_20260806_reversa_corr50;
CREATE TABLE colmena_tubos_backup_20260806_reversa_corr50 AS
SELECT * FROM colmena_tubos
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;

DROP TABLE IF EXISTS tubos_historial_backup_20260806_reversa_corr50;
CREATE TABLE tubos_historial_backup_20260806_reversa_corr50 AS
SELECT * FROM tubos_historial
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND created_at = '2026-08-06 19:01:32.763588+00'::timestamptz;

DROP TABLE IF EXISTS planes_corte_backup_20260806_reversa_corr50;
CREATE TABLE planes_corte_backup_20260806_reversa_corr50 AS
SELECT * FROM planes_corte
WHERE id IN ('b06e6720-4226-4b72-9716-bc3d394638c6',
             '6fb036f6-5d35-477f-aa29-c51b3723e72d');

-- ── Ahora andá a la app y apretá el botón ↶ del CORR 50. ────────────────────
--
-- Si en algún momento hiciera falta correrla desde acá (por ejemplo si el botón
-- se niega y hay que forzar tras revisar), es esta línea:
--
-- SELECT public.revertir_plan_corte(
--     'b06e6720-4226-4b72-9716-bc3d394638c6'::uuid,
--     'CORR 50 OT #DARK-OSCURANTI: plan mal calculado'
-- ) AS resumen;

-- ============================================================================
-- VERIFICACIÓN (opcional: también se verifica desde la app)
-- ============================================================================
-- SELECT COUNT(*) AS colmena FROM colmena_tubos
--   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid;          -- 328
-- SELECT COUNT(*) AS eventos FROM tubos_historial WHERE ot = '#DARK-OSCURANTI'; -- 0
-- SELECT COUNT(*) AS planes FROM planes_corte
--   WHERE id IN ('b06e6720-4226-4b72-9716-bc3d394638c6',
--                '6fb036f6-5d35-477f-aa29-c51b3723e72d');                     -- 0
-- SELECT resumen FROM reversas_planes_corte ORDER BY created_at DESC LIMIT 1;
-- SELECT * FROM verificar_salud_colmena('67c635a5-152c-4780-a066-23f5081175a9'::uuid);
--
-- Si hubiera que rehacer algo a mano, el paquete completo está en
--   SELECT paquete FROM reversas_planes_corte ORDER BY created_at DESC LIMIT 1;
-- y en las tres tablas *_backup_20260806_reversa_corr50.
-- ============================================================================
