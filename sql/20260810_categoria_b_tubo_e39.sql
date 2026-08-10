-- ═══════════════════════════════════════════════════════════════════════
-- CATEGORÍA B — banda de ancho: sobre 2,5 m el tubo pasa a E39
--
-- Correr COMPLETO en el SQL Editor de Supabase. Es idempotente: se puede
-- repetir sin duplicar nada.
--
-- La categoría B nació con UN solo tubo en todo ancho (E01, Ø38 0,8 mm). El
-- E01 no aguanta los anchos grandes, así que desde ahora:
--     hasta 2,5 m → E01 (Ø38 0,8)   ·   más de 2,5 m → E39 (Ø45 0,44)
-- El KIT no cambia con el ancho (sigue el de la categoría B por color) y los
-- descuentos de corte tampoco: es la misma fila de despiece.
--
-- Qué hace:
--   1. Le da al MEC 06 su PROPIA fila de categoría B (hoy comparte la de la
--      categoría A, que tiene tope 2,2 m y no se puede tocar).
--   2. Sube el ancho máximo de las filas B a 3,0 m y les agrega el E39 a la
--      lista de tubos.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Fila propia del MEC 06 para la categoría B ──────────────────────
-- El roller simple blanco B usa por defecto el MEC 06, cuya fila es la MISMA
-- que la de la categoría A ('ANCHO MÁX 2.2m / ALTO MÁX 2.0m'). Subirle el tope
-- a 3,0 m le cambiaría el límite a la categoría A, así que la B se lleva su
-- propia fila, con los mismos números de corte (−3,8) y su tope nuevo.
INSERT INTO descuentos_modelo (
  empresa_id, sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm,
  dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm,
  peso_interno_duo_cm, peso_u_duo_cm, ancho_max_m, activo, notas, origen
)
SELECT '67c635a5-152c-4780-a066-23f5081175a9', 'ROLLER_SIMPLE', 'ROL_SIMPLE',
       'MEC_06_LZ50_B_BLANCO', 'E01; E39', 38,
       3.8, 0.5, 0.1, 0, 0, 0, 3.0, true,
       'LINEA B — roller simple blanco (por defecto): kit MEC06, tubo E01 hasta 2,5 m / E39 sobre 2,5 m, peso E40',
       'manual'
WHERE NOT EXISTS (
  SELECT 1 FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND mecanismo = 'MEC_06_LZ50_B_BLANCO'
);

-- Y la fila COMPARTIDA vuelve a ser solo de la categoría A: se le saca la marca
-- que le puso sql/20260807_linea_b.sql. Su tope de 2,2 m queda intacto.
UPDATE descuentos_modelo
SET notas = TRIM(BOTH ' |' FROM REPLACE(
      notas,
      ' | LINEA B — roller simple blanco (por defecto): kit MEC06, tubo E01, peso E40',
      ''))
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND sistema = 'ROLLER_SIMPLE'
  AND tipo_rol = 'ROL_SIMPLE'
  AND mecanismo = 'MEC_06_LZ50_BLANCO'
  AND notas LIKE '%LINEA B%';

-- ── 2. Las filas de la categoría B llegan a 3,0 m y conocen el E39 ─────
-- El ancho máximo lo usa el aviso «no es fabricable» de Fase 1/2. Con el tubo
-- de 45 mm la categoría B llega a 3,0 m, igual que la banda de 45 de la A.
UPDATE descuentos_modelo
SET ancho_max_m = 3.0,
    codigos_tubo = CASE
      WHEN codigos_tubo LIKE '%E39%' THEN codigos_tubo
      ELSE codigos_tubo || '; E39'
    END
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND notas LIKE '%LINEA B%'
  AND (ancho_max_m < 3.0 OR codigos_tubo NOT LIKE '%E39%');

COMMIT;

-- ── Verificación ───────────────────────────────────────────────────────
-- 1) Las 7 filas de la categoría B, todas con tope 3,0 y con E39:
--    SELECT sistema, tipo_rol, mecanismo, codigos_tubo, ancho_max_m, dcto_tubo_cm
--    FROM descuentos_modelo
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND notas LIKE '%LINEA B%' ORDER BY sistema, mecanismo;
--
-- 2) La fila compartida del MEC 06 quedó SOLO en la categoría A, con su 2,2 m:
--    SELECT mecanismo, ancho_max_m, notas FROM descuentos_modelo
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--      AND mecanismo IN ('MEC_06_LZ50_BLANCO', 'MEC_06_LZ50_B_BLANCO');
--
-- 3) El E39 existe en bodega y no está agotado:
--    SELECT cod, nemotecnico, color, status FROM insumos
--    WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9' AND cod = 'E39';

-- ── Pendientes operativos (NO son SQL) ─────────────────────────────────
-- · La colmena tiene que tener barras E39: sin stock, el plan de corte del tubo
--   de una cortina B de más de 2,5 m sale vacío (lo mismo que ya pasa con E01).
-- · Las OTs de categoría B ya guardadas conservan su chip de tubo: hay que
--   re-guardarlas desde Fase 1 para que las de más de 2,5 m tomen el E39.
