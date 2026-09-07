-- ============================================================================
-- Reparar los FILTROS DE ANCHO de los dos kits de la categoría B
-- Fecha: 2026-09-07
-- Empresa: rolzzoia-produccion (67c635a5-152c-4780-a066-23f5081175a9)
-- ============================================================================
--
-- El problema:
--   Las recetas de fábrica de roller en categoría B llevan DOS kits, cada uno
--   con su tramo de ancho:
--       MEC 05  →  cortinas de MENOS de 2,10 m
--       MEC 18  →  cortinas de MÁS  de 2,10 m
--   Son extremos ESTRICTOS (los `COUNTIFS("<2,10")` / `(">2,10")` de la copia B
--   de la planilla), y se guardan como `filtroAncho: { menorQue | mayorQue }`.
--
--   El saneador del blob `reglas_precios` conservaba SOLO `min` y `max`: al
--   guardar precios desde Admin, esos dos filtros se perdían y las dos líneas
--   quedaban con `cantidad: { "tipo": "porCortina" }` a secas. Sin filtro, las
--   dos cuentan SIEMPRE → **cada roller de categoría B paga los dos kits**.
--   Las dúo B se salvaron porque su corte usa `min`, que sí sobrevivía.
--
--   El arreglo del saneador va en el mismo PR (`saneaFiltro`, reglasPrecios.ts),
--   pero NO repara lo ya guardado: el blob de esta empresa tiene las 12 líneas
--   sin filtro. Eso es lo que hace este archivo.
--
-- ⚠ CUÁNDO CORRERLO
--   Con el código del PR ya desplegado, o justo antes. Si se corre con el
--   código viejo arriba, el próximo «Guardar precios» desde Admin vuelve a
--   borrar los filtros y hay que correrlo de nuevo.
--
-- Qué hace:
--   · Backup de la fila completa de `reglas_precios`.
--   · En las 6 recetas de roller B —BLACKOUT_D|B, BLACKOUT_P|B, BLACKOUT_S|B,
--     SCREEN_D|B, SCREEN_P|B, SCREEN_S|B— le repone el filtro a la línea de
--     MEC 05 (`menorQue: 2.1`) y a la de MEC 18 (`mayorQue: 2.1`).
--   · Solo toca líneas `porCortina` SIN `filtroAncho`: correrlo dos veces no
--     cambia nada, y un filtro puesto a mano desde Admin se respeta.
--
-- Qué NO toca:
--   · Las recetas de categoría A (su MEC 18 va siempre, sin tramo).
--   · Las dúo (A y B): su MEC 18 usa `min: 2.2` y está intacto.
--   · Cualquier otra clave del blob (insumos, sistemas, arquetipos…).
--
-- Efecto en los precios: BAJA. Un roller B deja de pagar un kit que no lleva.
--
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run. Si algo no cuadra,
--   la verificación final lanza EXCEPTION y la transacción se revierte entera.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Reparar filtros de los kits B — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Backup de la configuración de precios, tal como está
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS configuracion_backup_20260907_kit_b;

CREATE TABLE configuracion_backup_20260907_kit_b AS
SELECT * FROM configuracion WHERE clave = 'reglas_precios';

DO $$
DECLARE v_bk integer;
BEGIN
  SELECT COUNT(*) INTO v_bk FROM configuracion_backup_20260907_kit_b;
  RAISE NOTICE 'Paso 1: backup con % fila(s) de reglas_precios', v_bk;
  IF v_bk = 0 THEN
    RAISE EXCEPTION 'ABORTADO: no hay ninguna fila `reglas_precios` que reparar';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Pre-flight: cuántas líneas están sin filtro
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.empresa_id, k.key AS receta, e.l->>'insumo' AS insumo,
           e.l->'cantidad'->'filtroAncho' AS filtro
      FROM configuracion c
      CROSS JOIN LATERAL jsonb_each((c.valor::jsonb)->'recetas') AS k(key, val)
      CROSS JOIN LATERAL jsonb_array_elements(k.val) WITH ORDINALITY AS e(l, ord)
     WHERE c.clave = 'reglas_precios'
       AND k.key IN ('BLACKOUT_D|B','BLACKOUT_P|B','BLACKOUT_S|B',
                     'SCREEN_D|B','SCREEN_P|B','SCREEN_S|B')
       AND e.l->>'insumo' IN ('MEC 05','MEC 18')
     ORDER BY c.empresa_id, k.key, ord
  LOOP
    RAISE NOTICE '  ANTES: % · % · % → filtro %',
      r.empresa_id, r.receta, r.insumo, COALESCE(r.filtro::text, '(ninguno)');
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Reponer el filtro de cada kit
-- ─────────────────────────────────────────────────────────────────────────────
-- Se reconstruye el array de cada receta respetando el ORDEN original
-- (`jsonb_agg … ORDER BY ord`) y se vuelven a mezclar las 6 recetas dentro del
-- blob con `||`, así ninguna otra clave se toca.
WITH objetivo AS (
  SELECT id, valor::jsonb AS j
    FROM configuracion
   WHERE clave = 'reglas_precios'
),
lineas AS (
  SELECT o.id,
         k.key AS receta,
         e.ord,
         CASE
           WHEN e.l->>'insumo' = 'MEC 05'
            AND e.l->'cantidad'->>'tipo' = 'porCortina'
            AND e.l->'cantidad'->'filtroAncho' IS NULL
             THEN jsonb_set(e.l, '{cantidad,filtroAncho}', '{"menorQue": 2.1}'::jsonb, true)
           WHEN e.l->>'insumo' = 'MEC 18'
            AND e.l->'cantidad'->>'tipo' = 'porCortina'
            AND e.l->'cantidad'->'filtroAncho' IS NULL
             THEN jsonb_set(e.l, '{cantidad,filtroAncho}', '{"mayorQue": 2.1}'::jsonb, true)
           ELSE e.l
         END AS linea
    FROM objetivo o
    CROSS JOIN LATERAL jsonb_each(o.j->'recetas') AS k(key, val)
    CROSS JOIN LATERAL jsonb_array_elements(k.val) WITH ORDINALITY AS e(l, ord)
   WHERE k.key IN ('BLACKOUT_D|B','BLACKOUT_P|B','BLACKOUT_S|B',
                   'SCREEN_D|B','SCREEN_P|B','SCREEN_S|B')
),
recetas AS (
  SELECT id, receta, jsonb_agg(linea ORDER BY ord) AS arr
    FROM lineas
   GROUP BY id, receta
),
mezcla AS (
  SELECT id, jsonb_object_agg(receta, arr) AS nuevas
    FROM recetas
   GROUP BY id
)
UPDATE configuracion c
   SET valor = jsonb_set(c.valor::jsonb, '{recetas}',
                         (c.valor::jsonb->'recetas') || m.nuevas)::text
  FROM mezcla m
 WHERE c.id = m.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Verificación: si algo no cuadra, se revierte TODO
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_empresas integer;
  v_ok integer;
  v_malas integer;
  r record;
BEGIN
  SELECT COUNT(*) INTO v_empresas FROM configuracion WHERE clave = 'reglas_precios';

  -- Cada empresa tiene que quedar con sus 12 líneas filtradas (6 recetas × 2).
  SELECT COUNT(*) INTO v_ok
    FROM configuracion c
    CROSS JOIN LATERAL jsonb_each((c.valor::jsonb)->'recetas') AS k(key, val)
    CROSS JOIN LATERAL jsonb_array_elements(k.val) AS e(l)
   WHERE c.clave = 'reglas_precios'
     AND k.key IN ('BLACKOUT_D|B','BLACKOUT_P|B','BLACKOUT_S|B',
                   'SCREEN_D|B','SCREEN_P|B','SCREEN_S|B')
     AND ((e.l->>'insumo' = 'MEC 05' AND e.l->'cantidad'->'filtroAncho'->>'menorQue' = '2.1')
       OR (e.l->>'insumo' = 'MEC 18' AND e.l->'cantidad'->'filtroAncho'->>'mayorQue' = '2.1'));

  SELECT COUNT(*) INTO v_malas
    FROM configuracion c
    CROSS JOIN LATERAL jsonb_each((c.valor::jsonb)->'recetas') AS k(key, val)
    CROSS JOIN LATERAL jsonb_array_elements(k.val) AS e(l)
   WHERE c.clave = 'reglas_precios'
     AND k.key IN ('BLACKOUT_D|B','BLACKOUT_P|B','BLACKOUT_S|B',
                   'SCREEN_D|B','SCREEN_P|B','SCREEN_S|B')
     AND e.l->>'insumo' IN ('MEC 05','MEC 18')
     AND e.l->'cantidad'->'filtroAncho' IS NULL;

  FOR r IN
    SELECT k.key AS receta, e.l->>'insumo' AS insumo,
           e.l->'cantidad'->'filtroAncho' AS filtro
      FROM configuracion c
      CROSS JOIN LATERAL jsonb_each((c.valor::jsonb)->'recetas') AS k(key, val)
      CROSS JOIN LATERAL jsonb_array_elements(k.val) WITH ORDINALITY AS e(l, ord)
     WHERE c.clave = 'reglas_precios'
       AND k.key IN ('BLACKOUT_D|B','BLACKOUT_P|B','BLACKOUT_S|B',
                     'SCREEN_D|B','SCREEN_P|B','SCREEN_S|B')
       AND e.l->>'insumo' IN ('MEC 05','MEC 18')
     ORDER BY k.key, ord
  LOOP
    RAISE NOTICE '  DESPUÉS: % · % → filtro %',
      r.receta, r.insumo, COALESCE(r.filtro::text, '(ninguno)');
  END LOOP;

  RAISE NOTICE 'Paso 4: % empresa(s), % líneas con filtro, % sin filtro',
    v_empresas, v_ok, v_malas;

  IF v_malas > 0 THEN
    RAISE EXCEPTION 'ABORTADO: quedaron % líneas de kit B sin filtro de ancho', v_malas;
  END IF;
  IF v_ok <> v_empresas * 12 THEN
    RAISE EXCEPTION 'ABORTADO: se esperaban % líneas filtradas (12 por empresa) y hay %',
      v_empresas * 12, v_ok;
  END IF;

  RAISE NOTICE '=== Reparar filtros de los kits B — OK ===';
END $$;

COMMIT;

-- ============================================================================
-- SMOKE TEST (en la app, después de correrlo):
--   Fase 1 → una cortina BLACKOUT PREMIUM de 1,50 × 2,00 con el botón
--   CATEGORÍA B encendido → «Ver cómo se armó el precio» tiene que listar
--   UN solo kit (MEC 05). Con 2,50 m de ancho, un solo kit (MEC 18).
--   Antes salían los dos en las dos medidas.
--
-- REVERSO (dejar las recetas como estaban). Copiar, descomentar y correr:
--
-- BEGIN;
-- UPDATE configuracion c
--    SET valor = b.valor
--   FROM configuracion_backup_20260907_kit_b b
--  WHERE c.id = b.id;
-- COMMIT;
-- ============================================================================
