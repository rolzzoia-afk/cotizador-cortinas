-- ============================================================================
-- COSTOS OT 01 — el «Costo total» de una OT queda guardado en la base
-- Fecha: 2026-09-16
-- ============================================================================
--
-- POR QUÉ:
--   La pantalla Producción → Costo total (solo administradores) calcula en el
--   navegador cuánto costó de verdad una OT: metros de tela del optimizador,
--   aluminio cortado de la colmena, insumos de la hoja de inventario, cada uno
--   con su costo, contra lo cobrado. Ese resultado NO quedaba en ninguna parte:
--   solo se guardaba lo tecleado a mano (`datos_generales.costosOT`). El dueño
--   pidió que quede en la base para que otro sistema (Rolzzo-Finanzas) pueda
--   sacarlo después.
--
--   Se guarda una FOTO y no un cálculo vivo a propósito: los costos de bodega y
--   del catálogo cambian, y el costo de una OT es el del día en que se revisó.
--   El motor que lo calcula es TypeScript y no puede correr en la base.
--
-- QUÉ HACE:
--   1. `ots_costos`: una fila por OT con los totales (telas, aluminio, insumos,
--      mano de obra, auto, TAG, otros, pérdida por fallas, costo, cobrado neto,
--      ganancia y margen), quién la guardó, cuándo y cuántas veces (`version`).
--   2. `ots_costos_lineas`: cada tela, perfil e insumo con cantidad, merma o
--      falla, costo unitario, de dónde salió ese costo y el costo de la línea.
--   3. RPC `ot_costo_guardar`: el botón «Guardar» de la pantalla. En UNA
--      transacción guarda lo tecleado en la OT y reemplaza la foto.
--      - Solo un administrador (`admin` o `superadmin`) de la misma empresa.
--      - LA BASE CALCULA los costos de las líneas y los totales con las mismas
--        fórmulas de `calcularCostoOT`, y lo cobrado lo lee de `ots.total`. Si
--        su resultado no cuadra con el de la pantalla (más de $1 de
--        diferencia), NO guarda: o la OT cambió mientras se calculaba o las dos
--        fórmulas se separaron, y en los dos casos guardar sería guardar un
--        número que nadie vio.
--   4. Solo lectura para administradores de la empresa; nadie escribe las
--      tablas directo (ni `authenticated` ni `anon`), solo por la RPC.
--
-- QUÉ NO HACE:
--   - No manda nada a Rolzzo-Finanzas: eso es un paso aparte.
--   - No crea fotos de las OT viejas: la foto nace cuando un administrador
--     abre la pantalla y guarda.
--   - No cambia `datos_generales.costosOT`: sigue guardando lo mismo que antes,
--     ahora sin releer y reescribir la OT entera desde el navegador.
--
-- ORDEN DE EJECUCIÓN: cualquier momento (solo necesita `ots`, `perfiles`,
--   `has_role` y `get_my_empresa_id`). Al terminar: `npm run types:gen`.
--   El front nuevo va DESPUÉS de este SQL.
-- IDEMPOTENTE: sí.
-- REVERSA: al pie del archivo.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Lo que tiene que estar antes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.ots') IS NULL OR to_regclass('public.perfiles') IS NULL THEN
    RAISE EXCEPTION 'Faltan las tablas ots / perfiles';
  END IF;
  IF to_regprocedure('public.has_role(text[])') IS NULL THEN
    RAISE EXCEPTION 'Falta la función has_role(text[])';
  END IF;
  IF to_regprocedure('public.get_my_empresa_id()') IS NULL THEN
    RAISE EXCEPTION 'Falta la función get_my_empresa_id()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) La foto: una fila por OT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ots_costos (
  ot_id            uuid PRIMARY KEY REFERENCES public.ots(id) ON DELETE CASCADE,
  empresa_id       uuid NOT NULL,
  numero_ot        text NOT NULL,
  -- En qué estado estaba la OT cuando se guardó (produccion, lista, instalada…).
  ot_estado        text NOT NULL,

  -- Lo cobrado: `ots.total` (con IVA), el IVA usado y el neto.
  cobrado_con_iva  numeric(14,2) NOT NULL DEFAULT 0,
  iva              numeric(6,4)  NOT NULL,
  cobrado_neto     numeric(14,2) NOT NULL DEFAULT 0,

  total_telas      numeric(14,2) NOT NULL DEFAULT 0,
  total_aluminio   numeric(14,2) NOT NULL DEFAULT 0,
  total_insumos    numeric(14,2) NOT NULL DEFAULT 0,
  mano_obra        numeric(14,2) NOT NULL DEFAULT 0,
  auto             numeric(14,2) NOT NULL DEFAULT 0,
  tag              numeric(14,2) NOT NULL DEFAULT 0,
  otros            numeric(14,2) NOT NULL DEFAULT 0,

  -- Sin fallas: telas + aluminio + insumos + mano de obra + auto + TAG + otros.
  costo_total      numeric(14,2) NOT NULL DEFAULT 0,
  -- Metros de falla × costo de la tela.
  perdida_fallas   numeric(14,2) NOT NULL DEFAULT 0,
  -- La plata que salió de verdad: costo_total + perdida_fallas.
  costo_con_fallas numeric(14,2) NOT NULL DEFAULT 0,
  -- cobrado_neto − costo_total.
  ganancia         numeric(14,2) NOT NULL DEFAULT 0,
  -- ganancia − perdida_fallas.
  ganancia_real    numeric(14,2) NOT NULL DEFAULT 0,
  -- ganancia_real / cobrado_neto (0,55 = 55 %). NULL si la OT no tiene total.
  margen           numeric(9,4),

  -- Metros de la barra de aluminio con que se pasó de $/barra a $/m.
  largo_barra_m    numeric(6,3)  NOT NULL,
  nota             text,
  -- Códigos sin costo cargado (sumaron $0): {telas: [], aluminio: [], insumos: []}.
  sin_costo        jsonb NOT NULL DEFAULT '{}'::jsonb,

  version          integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  guardado_por     uuid REFERENCES public.perfiles(id) ON DELETE SET NULL,
  guardado_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ots_costos_empresa
  ON public.ots_costos (empresa_id, guardado_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Las líneas de la foto
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ots_costos_lineas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ot_id           uuid NOT NULL REFERENCES public.ots_costos(ot_id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('tela', 'aluminio', 'insumo')),
  orden           smallint NOT NULL CHECK (orden >= 1),
  codigo          text,
  descripcion     text,
  -- tela: metros bajados del rollo · aluminio: metros cortados · insumo: unidades.
  cantidad        numeric(12,3) NOT NULL DEFAULT 0,
  unidad          text NOT NULL CHECK (unidad IN ('m', 'u')),
  -- tela: metros perdidos por falla · aluminio: merma · insumo: 0.
  merma           numeric(12,3) NOT NULL DEFAULT 0,
  -- tela: cuántas fallas se anotaron.
  fallas          integer NOT NULL DEFAULT 0,
  -- tela: paños que salieron de un retazo de colmena (no tocaron el rollo).
  panos_colmena   integer NOT NULL DEFAULT 0,
  -- $/m o $/unidad. NULL = sin costo cargado (la línea suma $0).
  costo_unitario  numeric(14,4),
  -- tela: propio | referencia · aluminio e insumo: bodega | calculo.
  fuente          text CHECK (fuente IS NULL OR fuente IN ('propio', 'referencia', 'bodega', 'calculo')),
  -- tela: el código que prestó su costo · aluminio: la cuenta («$16.065 la barra ÷ 5,8 m»).
  referencia      text,
  -- tela: cantidad × unitario · aluminio: (cantidad + merma) × unitario · insumo: cantidad × unitario.
  costo           numeric(14,2) NOT NULL DEFAULT 0,
  -- tela: merma × unitario (va aparte del costo para no descontarla dos veces).
  perdida         numeric(14,2) NOT NULL DEFAULT 0,
  UNIQUE (ot_id, tipo, orden)
);

CREATE INDEX IF NOT EXISTS idx_ots_costos_lineas_empresa_codigo
  ON public.ots_costos_lineas (empresa_id, tipo, codigo);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Permisos: leen solo los administradores de la empresa; escribe solo la RPC
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.ots_costos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ots_costos_lineas ENABLE ROW LEVEL SECURITY;

-- Supabase le da TODO a anon/authenticated en cada tabla nueva del esquema public.
REVOKE ALL ON public.ots_costos        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ots_costos_lineas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ots_costos        TO authenticated;
GRANT SELECT ON public.ots_costos_lineas TO authenticated;

DROP POLICY IF EXISTS ots_costos_admin_lee ON public.ots_costos;
CREATE POLICY ots_costos_admin_lee ON public.ots_costos
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT public.get_my_empresa_id())
         AND (SELECT public.has_role(ARRAY['admin', 'superadmin'])));

DROP POLICY IF EXISTS ots_costos_lineas_admin_lee ON public.ots_costos_lineas;
CREATE POLICY ots_costos_lineas_admin_lee ON public.ots_costos_lineas
  FOR SELECT TO authenticated
  USING (empresa_id = (SELECT public.get_my_empresa_id())
         AND (SELECT public.has_role(ARRAY['admin', 'superadmin'])));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RPC: el botón «Guardar» de Costo total
-- ─────────────────────────────────────────────────────────────────────────────
-- p_manual    lo tecleado (`CostoManualOT`), se guarda tal cual en datos_generales.costosOT
-- p_lineas    [{tipo, codigo, descripcion, cantidad, unidad, merma, fallas,
--               panos_colmena, costo_unitario, fuente, referencia}] en orden
-- p_sin_costo {telas: [], aluminio: [], insumos: []}
-- p_iva       el IVA con que calculó la pantalla (0,19)
-- p_esperado  {costoConFallas, gananciaReal} de la pantalla, para comparar
CREATE OR REPLACE FUNCTION public.ot_costo_guardar(
  p_ot_id     uuid,
  p_manual    jsonb,
  p_lineas    jsonb,
  p_sin_costo jsonb,
  p_iva       numeric,
  p_esperado  jsonb
)
RETURNS public.ots_costos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_empresa   uuid := public.get_my_empresa_id();
  v_ot        public.ots;
  v_manual    jsonb := COALESCE(p_manual, '{}'::jsonb);
  v_barra     numeric;
  v_mano      numeric;
  v_auto      numeric;
  v_tag       numeric;
  v_otros     numeric;
  v_telas     numeric;
  v_aluminio  numeric;
  v_insumos   numeric;
  v_perdida   numeric;
  v_costo     numeric;
  v_neto      numeric;
  v_ganancia  numeric;
  v_real      numeric;
  v_esp_costo numeric;
  v_esp_real  numeric;
  v_malas     int;
  v_fila      public.ots_costos;
BEGIN
  IF v_uid IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'Sin sesión: vuelve a entrar.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_role(ARRAY['admin', 'superadmin']) THEN
    RAISE EXCEPTION 'Solo un administrador guarda el costo de una OT.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ot FROM public.ots
   WHERE id = p_ot_id AND empresa_id = v_empresa
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La OT ya no está en el sistema.' USING ERRCODE = 'P0002';
  END IF;

  IF jsonb_typeof(v_manual) <> 'object' THEN
    RAISE EXCEPTION 'Lo tecleado llegó mal armado.' USING ERRCODE = '22023';
  END IF;
  IF p_lineas IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas) > 2000 THEN
    RAISE EXCEPTION 'Las líneas del costo llegaron mal armadas.' USING ERRCODE = '22023';
  END IF;
  IF p_iva IS NULL OR p_iva < 0 OR p_iva >= 1 THEN
    RAISE EXCEPTION 'IVA fuera de rango: %', p_iva USING ERRCODE = '22023';
  END IF;

  -- Cada línea: tipo y unidad válidos, cantidades y costo no negativos.
  SELECT count(*) INTO v_malas
  FROM jsonb_array_elements(p_lineas) l
  WHERE jsonb_typeof(l) <> 'object'
     OR COALESCE(l->>'tipo', '') NOT IN ('tela', 'aluminio', 'insumo')
     OR COALESCE(l->>'unidad', '') NOT IN ('m', 'u')
     OR COALESCE((l->>'cantidad')::numeric, 0) < 0
     OR COALESCE((l->>'merma')::numeric, 0) < 0
     OR COALESCE((l->>'costo_unitario')::numeric, 0) < 0;
  IF v_malas > 0 THEN
    RAISE EXCEPTION '% línea(s) del costo vienen con datos inválidos.', v_malas USING ERRCODE = '22023';
  END IF;

  -- Lo tecleado, como lo lee `calcularCostoOT`.
  v_barra := COALESCE(NULLIF((v_manual->>'largoBarraM')::numeric, 0), 5.8);
  IF v_barra <= 0 THEN v_barra := 5.8; END IF;
  v_mano  := COALESCE((v_manual->>'manoObra')::numeric, 0);
  v_auto  := COALESCE((v_manual->>'auto')::numeric, 0);
  v_tag   := COALESCE((v_manual->>'tag')::numeric, 0);
  v_otros := COALESCE((v_manual->>'otros')::numeric, 0);

  -- Las cuentas las hace la base (mismas fórmulas que `calcularCostoOT`).
  WITH l AS (
    SELECT e->>'tipo' AS tipo,
           COALESCE((e->>'cantidad')::numeric, 0) AS cantidad,
           COALESCE((e->>'merma')::numeric, 0) AS merma,
           (e->>'costo_unitario')::numeric AS unitario
    FROM jsonb_array_elements(p_lineas) e
  )
  SELECT
    COALESCE(sum(cantidad * unitario) FILTER (WHERE tipo = 'tela'), 0),
    COALESCE(sum((cantidad + merma) * unitario) FILTER (WHERE tipo = 'aluminio'), 0),
    COALESCE(sum(cantidad * unitario) FILTER (WHERE tipo = 'insumo'), 0),
    COALESCE(sum(merma * unitario) FILTER (WHERE tipo = 'tela'), 0)
  INTO v_telas, v_aluminio, v_insumos, v_perdida
  FROM l;

  v_costo    := v_telas + v_aluminio + v_insumos + v_mano + v_auto + v_tag + v_otros;
  v_neto     := COALESCE(v_ot.total, 0) / (1 + p_iva);
  v_ganancia := v_neto - v_costo;
  v_real     := v_ganancia - v_perdida;

  -- Tiene que ser el número que vio el administrador.
  v_esp_costo := (p_esperado->>'costoConFallas')::numeric;
  v_esp_real  := (p_esperado->>'gananciaReal')::numeric;
  IF v_esp_costo IS NULL OR v_esp_real IS NULL
     OR abs(v_esp_costo - (v_costo + v_perdida)) > 1
     OR abs(v_esp_real - v_real) > 1 THEN
    RAISE EXCEPTION 'El costo no cuadra con la base (pantalla % / base %; ganancia % / %). Vuelve a abrir la OT: puede haber cambiado mientras se calculaba.',
      round(COALESCE(v_esp_costo, 0)), round(v_costo + v_perdida), round(COALESCE(v_esp_real, 0)), round(v_real)
      USING ERRCODE = '40001';
  END IF;

  -- Lo tecleado queda en la OT, como siempre (sin reescribir la OT entera).
  UPDATE public.ots
     SET datos_generales = jsonb_set(COALESCE(datos_generales, '{}'::jsonb), '{costosOT}', v_manual, true),
         fecha_modificacion = now()
   WHERE id = v_ot.id;

  INSERT INTO public.ots_costos AS c (
    ot_id, empresa_id, numero_ot, ot_estado,
    cobrado_con_iva, iva, cobrado_neto,
    total_telas, total_aluminio, total_insumos, mano_obra, auto, tag, otros,
    costo_total, perdida_fallas, costo_con_fallas, ganancia, ganancia_real, margen,
    largo_barra_m, nota, sin_costo, version, guardado_por, guardado_at
  ) VALUES (
    v_ot.id, v_empresa, v_ot.numero_ot, v_ot.estado,
    COALESCE(v_ot.total, 0), p_iva, v_neto,
    v_telas, v_aluminio, v_insumos, v_mano, v_auto, v_tag, v_otros,
    v_costo, v_perdida, v_costo + v_perdida, v_ganancia, v_real,
    CASE WHEN v_neto > 0 THEN v_real / v_neto END,
    v_barra, NULLIF(btrim(v_manual->>'nota'), ''),
    COALESCE(p_sin_costo, '{}'::jsonb), 1, v_uid, now()
  )
  ON CONFLICT (ot_id) DO UPDATE SET
    numero_ot        = EXCLUDED.numero_ot,
    ot_estado        = EXCLUDED.ot_estado,
    cobrado_con_iva  = EXCLUDED.cobrado_con_iva,
    iva              = EXCLUDED.iva,
    cobrado_neto     = EXCLUDED.cobrado_neto,
    total_telas      = EXCLUDED.total_telas,
    total_aluminio   = EXCLUDED.total_aluminio,
    total_insumos    = EXCLUDED.total_insumos,
    mano_obra        = EXCLUDED.mano_obra,
    auto             = EXCLUDED.auto,
    tag              = EXCLUDED.tag,
    otros            = EXCLUDED.otros,
    costo_total      = EXCLUDED.costo_total,
    perdida_fallas   = EXCLUDED.perdida_fallas,
    costo_con_fallas = EXCLUDED.costo_con_fallas,
    ganancia         = EXCLUDED.ganancia,
    ganancia_real    = EXCLUDED.ganancia_real,
    margen           = EXCLUDED.margen,
    largo_barra_m    = EXCLUDED.largo_barra_m,
    nota             = EXCLUDED.nota,
    sin_costo        = EXCLUDED.sin_costo,
    version          = c.version + 1,
    guardado_por     = EXCLUDED.guardado_por,
    guardado_at      = EXCLUDED.guardado_at
  RETURNING * INTO v_fila;

  DELETE FROM public.ots_costos_lineas WHERE ot_id = v_ot.id;

  INSERT INTO public.ots_costos_lineas (
    ot_id, empresa_id, tipo, orden, codigo, descripcion, cantidad, unidad, merma,
    fallas, panos_colmena, costo_unitario, fuente, referencia, costo, perdida
  )
  SELECT v_ot.id, v_empresa, e->>'tipo',
         row_number() OVER (PARTITION BY e->>'tipo' ORDER BY n),
         NULLIF(btrim(e->>'codigo'), ''),
         NULLIF(btrim(e->>'descripcion'), ''),
         COALESCE((e->>'cantidad')::numeric, 0),
         e->>'unidad',
         COALESCE((e->>'merma')::numeric, 0),
         COALESCE((e->>'fallas')::numeric, 0)::int,
         COALESCE((e->>'panos_colmena')::numeric, 0)::int,
         (e->>'costo_unitario')::numeric,
         NULLIF(e->>'fuente', ''),
         NULLIF(btrim(e->>'referencia'), ''),
         CASE e->>'tipo'
           WHEN 'aluminio' THEN (COALESCE((e->>'cantidad')::numeric, 0) + COALESCE((e->>'merma')::numeric, 0))
                                 * COALESCE((e->>'costo_unitario')::numeric, 0)
           ELSE COALESCE((e->>'cantidad')::numeric, 0) * COALESCE((e->>'costo_unitario')::numeric, 0)
         END,
         CASE WHEN e->>'tipo' = 'tela'
           THEN COALESCE((e->>'merma')::numeric, 0) * COALESCE((e->>'costo_unitario')::numeric, 0)
           ELSE 0
         END
  FROM jsonb_array_elements(p_lineas) WITH ORDINALITY AS x(e, n);

  RETURN v_fila;
END;
$$;

REVOKE ALL ON FUNCTION public.ot_costo_guardar(uuid, jsonb, jsonb, jsonb, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ot_costo_guardar(uuid, jsonb, jsonb, jsonb, numeric, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Verificación (aborta si algo no quedó)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.ot_costo_guardar(uuid, jsonb, jsonb, jsonb, numeric, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'No quedó la RPC ot_costo_guardar';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ots_costos'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ots_costos_lineas'::regclass) THEN
    RAISE EXCEPTION 'RLS apagada en las tablas de costos';
  END IF;
  IF has_table_privilege('anon', 'public.ots_costos', 'SELECT')
     OR has_table_privilege('anon', 'public.ots_costos_lineas', 'SELECT') THEN
    RAISE EXCEPTION 'anon puede leer los costos';
  END IF;
  IF has_table_privilege('authenticated', 'public.ots_costos', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ots_costos', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ots_costos_lineas', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ots_costos_lineas', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated puede escribir los costos sin pasar por la RPC';
  END IF;
  IF has_function_privilege('anon', 'public.ot_costo_guardar(uuid, jsonb, jsonb, jsonb, numeric, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon puede ejecutar ot_costo_guardar';
  END IF;
  RAISE NOTICE '=== Costos OT 01 · foto del costo — OK ===';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- REVERSA (a mano, solo si hace falta)
-- ============================================================================
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.ot_costo_guardar(uuid, jsonb, jsonb, jsonb, numeric, jsonb);
-- DROP TABLE IF EXISTS public.ots_costos_lineas;
-- DROP TABLE IF EXISTS public.ots_costos;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- (Lo tecleado sigue en ots.datos_generales.costosOT: no se pierde nada. El
--  front viejo guardaba directo en la OT, así que hay que volver a él.)
