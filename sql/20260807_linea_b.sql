-- ═══════════════════════════════════════════════════════════════════════
-- LÍNEA B (gama económica de rollers) — datos de fábrica
--
-- Correr COMPLETO en el SQL Editor de Supabase. Es idempotente: se puede
-- repetir sin duplicar nada.
--
-- Qué hace:
--   1. Da de alta las 6 filas nuevas del catálogo de despiece (los descuentos
--      de la pizarra 2026-08-07) y marca la fila del MEC 06 que ya existía.
--   2. Completa el color de dos insumos B que estaban en blanco y da de alta
--      el peso interno del dúo blanco, que no existía.
--   3. Enseña al optimizador de estructura de qué barra cortar cada pieza B.
--
-- La marca de línea vive en `notas` ("LINEA B"): el motor la lee con
-- `esFilaLineaB` (src/modules/descuentos/tipos.ts). Las filas quedan con
-- origen='manual', así que re-importar el Excel maestro ya NO las pisa
-- (ver sql/20260804_catalogo_origen_import_v2.sql).
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Catálogo de despiece ────────────────────────────────────────────
-- Encadenado de la pizarra:
--   roller: tubo −0,5 = tela · tela +0,1 = peso  (lo produce suma_peso 0,1
--           junto con el pesoVsTubo 0,4 del motor: peso = tubo−0,4)
--   dúo:    tubo −0,5 = tela = peso interno · peso interno +0,4 = peso dúo
--           (dcto_tela 0,5 + peso_u_duo 0,1 ⇒ peso U = tubo−0,1)
-- Los anchos máximos y los códigos de tubo se copian de la fila equivalente
-- de la línea A; el tubo real de la línea B (E01) lo fija la regla del motor.

INSERT INTO descuentos_modelo (
  empresa_id, sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm,
  dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm,
  peso_interno_duo_cm, peso_u_duo_cm, ancho_max_m, activo, notas, origen
)
VALUES
  -- ROLLER SIMPLE ------------------------------------------------------
  -- Blanco, alternativa manual: kit MEC44-B (ancho real − 3,4 = tubo).
  ('67c635a5-152c-4780-a066-23f5081175a9', 'ROLLER_SIMPLE', 'ROL_SIMPLE',
   'MEC_44_ROLLER_B_BLANCO', 'E01', 38,
   3.4, 0.5, 0.1, 0, 0, 0, 2.6, true,
   'LINEA B — roller simple blanco (alternativa): kit MEC44-B, tubo E01, peso E40', 'manual'),
  -- Negro: kit MEC15 LZ50 pequeño (ancho real − 3,3 = tubo).
  ('67c635a5-152c-4780-a066-23f5081175a9', 'ROLLER_SIMPLE', 'ROL_SIMPLE',
   'MEC_15_LZ50_B_NEGRO', 'E01', 38,
   3.3, 0.5, 0.1, 0, 0, 0, 2.6, true,
   'LINEA B — roller simple negro: kit MEC15, tubo E01, peso E69-B', 'manual'),

  -- ROLLER CENEFA OVALADA 38 -------------------------------------------
  -- ancho real − 1,5 = cenefa · cenefa − 1,5 = tubo (la línea A usa 1,8).
  ('67c635a5-152c-4780-a066-23f5081175a9', 'CENEFA_OVALADA', 'ROL_CENEFA_OV_MANUAL_38mm',
   'MEC_37_OVALADA_B_BLANCO', 'E01', 38,
   1.5, 0.5, 0.1, 1.5, 0, 0, 2.5, true,
   'LINEA B — ovalada blanca: kit MEC37, tubo E01, peso E40, cenefa E60', 'manual'),
  ('67c635a5-152c-4780-a066-23f5081175a9', 'CENEFA_OVALADA', 'ROL_CENEFA_OV_MANUAL_38mm',
   'MEC_45_OVALADA_B_NEGRO', 'E01', 38,
   1.5, 0.5, 0.1, 1.5, 0, 0, 2.5, true,
   'LINEA B — ovalada negra: kit MEC45-B, tubo E01, peso E69-B, cenefa E72-B', 'manual'),

  -- DÚO CENEFA OVALADA 38 ----------------------------------------------
  -- peso_u_duo 0,1 ⇒ peso dúo = tubo − 0,1 (= peso interno + 0,4).
  -- peso_interno_duo solo marca que la fila LLEVA peso interno; la medida la
  -- da dcto_tela (peso interno = tela), igual que en la línea A.
  ('67c635a5-152c-4780-a066-23f5081175a9', 'CENEFA_OVALADA_DUO', 'DUO_CENEFA_OV_MANUAL_38mm',
   'MEC_37_DUO_B_BLANCO', 'E01', 38,
   1.5, 0.5, 0, 1.5, 0.2, 0.1, 2.5, true,
   'LINEA B — dúo ovalada blanca: kit MEC37, tubo E01, peso U E25, cenefa E60, peso interno E79-B', 'manual'),
  ('67c635a5-152c-4780-a066-23f5081175a9', 'CENEFA_OVALADA_DUO', 'DUO_CENEFA_OV_MANUAL_38mm',
   'MEC_45_DUO_B_NEGRO', 'E01', 38,
   1.5, 0.5, 0, 1.5, 0.2, 0.1, 2.5, true,
   'LINEA B — dúo ovalada negra: kit MEC45-B, tubo E01, peso U E70-B, cenefa E72-B, peso interno E71-B', 'manual')
ON CONFLICT DO NOTHING;

-- El roller simple blanco B por DEFECTO usa el MEC 06, cuya fila ya existe con
-- los números correctos (−3,8). Solo se le agrega la marca de línea, sin tocar
-- sus descuentos ni su ancho máximo (2,2 m) ni su origen.
UPDATE descuentos_modelo
SET notas = CASE WHEN notas = '' THEN 'LINEA B — roller simple blanco (por defecto): kit MEC06, tubo E01, peso E40'
                 ELSE notas || ' | LINEA B — roller simple blanco (por defecto): kit MEC06, tubo E01, peso E40' END
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND sistema = 'ROLLER_SIMPLE'
  AND tipo_rol = 'ROL_SIMPLE'
  AND mecanismo = 'MEC_06_LZ50_BLANCO'
  AND notas NOT LIKE '%LINEA B%';

-- ── 2. Insumos ─────────────────────────────────────────────────────────
-- E60 y MEC37 estaban sin color: el optimizador indexa por COMPONENTE|COLOR,
-- así que sin esto no los encontraría.
UPDATE insumos SET color = 'BLANCO'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND cod IN ('E60', 'MEC37')
  AND COALESCE(NULLIF(TRIM(color), ''), '') = '';

-- El peso interno del dúo B blanco no existe en bodega (su par negro, E71-B, sí).
INSERT INTO insumos (empresa_id, cod, nemotecnico, color, status)
SELECT '67c635a5-152c-4780-a066-23f5081175a9', 'E79-B',
       'PESO INFERIOR DUO REDONDO "O" CATEGORIA. B (BLANCO)', 'BLANCO', 'OK'
WHERE NOT EXISTS (
  SELECT 1 FROM insumos
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'E79-B'
);

-- ── 3. Catálogo de accesorios del optimizador ──────────────────────────
-- El optimizador resuelve cada pieza con la llave "<COMPONENTE>|<COLOR>".
-- La línea B usa la misma pieza y el mismo color pero OTRA barra, así que se
-- agregan llaves con sufijo |B (optimizador v5.21 las prueba primero).
-- El valor de la clave es un JSON guardado como TEXTO: se parsea, se mezcla y
-- se vuelve a guardar como texto.
UPDATE configuracion c
SET valor = (
  jsonb_set(
    c.valor::jsonb,
    '{catalogoAccesorios}',
    COALESCE(c.valor::jsonb -> 'catalogoAccesorios', '{}'::jsonb) || jsonb_build_object(
      -- Los nombres son los que el optimizador usa internamente
      -- (MAPA_NOMBRES_CATALOGO: PESO → PESO INFERIOR ROLLER ·
      --  PESO U → PESO INFERIOR DE DÚO LÁGRIMA · el resto va tal cual).
      'PESO INFERIOR ROLLER|BLANCO|B',          'E40',
      'PESO INFERIOR ROLLER|NEGRO|B',           'E69-B',
      'CENEFA OVALADA|BLANCO|B',                'E60',
      'CENEFA OVALADA|NEGRO|B',                 'E72-B',
      'PESO INFERIOR DE DÚO LÁGRIMA|BLANCO|B',  'E25',
      'PESO INFERIOR DE DÚO LÁGRIMA|NEGRO|B',   'E70-B',
      'PESO INTERNO|BLANCO|B',                  'E79-B',
      'PESO INTERNO|NEGRO|B',                   'E71-B'
    )
  )
)::text
WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND c.clave = 'catalogo_reemplazos_data';

COMMIT;

-- ── Verificación ───────────────────────────────────────────────────────
-- 1) Las 7 filas de la línea B (6 nuevas + el MEC 06 marcado):
--    SELECT sistema, tipo_rol, mecanismo, dcto_tubo_cm, dcto_cenefa_cm,
--           peso_u_duo_cm, ancho_max_m, origen
--    FROM descuentos_modelo
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND notas LIKE '%LINEA B%' ORDER BY sistema, mecanismo;
--
-- 2) Los 10 insumos de la línea B, todos con color:
--    SELECT cod, nemotecnico, color, status FROM insumos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND cod IN ('E01','E40','E60','E69-B','E70-B','E71-B','E72-B','E79-B',
--                  'E25','MEC06','MEC15','MEC37','MEC44-B','MEC45-B')
--    ORDER BY cod;
--
-- 3) Las 8 llaves nuevas del optimizador:
--    SELECT k, v FROM configuracion c,
--      jsonb_each_text(c.valor::jsonb -> 'catalogoAccesorios') AS t(k, v)
--    WHERE c.empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND c.clave = 'catalogo_reemplazos_data' AND k LIKE '%|B';

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · La colmena no tiene barras E01: hasta cargar stock, el plan de corte del
--   tubo de una cortina B sale vacío.
-- · E69-B (peso roller negro CAT. B) figura AGOTADO en insumos.
