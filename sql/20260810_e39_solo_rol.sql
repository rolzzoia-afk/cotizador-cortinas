-- ═══════════════════════════════════════════════════════════════════════
-- CATEGORÍA B — el tubo E39 solo se usa en ROLLER SIMPLE
--
-- Correr COMPLETO en el SQL Editor de Supabase, DESPUÉS de
-- sql/20260810_categoria_b_tubo_e39.sql. Es idempotente.
--
-- Corrección: el E39 (Ø45) solo se fabrica en la categoría ROL. La cenefa
-- ovalada B y el dúo B no tienen tubo para más de 2,5 m, así que:
--   · se quedan con el E01 en todo su rango, y
--   · su ancho máximo vuelve a 2,5 m (sobre eso la app avisa «no es fabricable»).
-- El roller simple B conserva su banda: E01 hasta 2,5 m · E39 por encima,
-- con tope 3,0 m.
--
-- El script anterior les había subido el tope a 3,0 y agregado el E39 a las
-- SIETE filas de categoría B; esto lo revierte en las cuatro que no van.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE descuentos_modelo
SET ancho_max_m = 2.5,
    codigos_tubo = 'E01'
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND notas LIKE '%LINEA B%'
  AND sistema IN ('CENEFA_OVALADA', 'CENEFA_OVALADA_DUO')
  AND (ancho_max_m <> 2.5 OR codigos_tubo <> 'E01');

COMMIT;

-- ── Verificación ───────────────────────────────────────────────────────
-- Las 7 filas de categoría B: las 3 de ROL_SIMPLE con 3,0 m y 'E01; E39';
-- las 4 de ovalada/dúo con 2,5 m y solo 'E01'.
--
--    SELECT sistema, tipo_rol, mecanismo, codigos_tubo, ancho_max_m
--    FROM descuentos_modelo
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND notas LIKE '%LINEA B%'
--    ORDER BY sistema, mecanismo;

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · El E39 figura AGOTADO en `insumos` y la colmena no tiene barras suyas
--   (tampoco de E01): hasta cargar stock, el plan de corte del tubo de una
--   cortina de categoría B sale vacío.
-- · Las OTs de categoría B ya guardadas conservan su chip de tubo: para que un
--   roller B de más de 2,5 m tome el E39 hay que re-guardarlas desde Fase 1.
