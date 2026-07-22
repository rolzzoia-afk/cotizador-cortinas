-- ─────────────────────────────────────────────────────────────────────
-- Alta de la cortina VERTICAL (lamas de 8,9 cm) en el catálogo de
-- descuentos de fabricación. 2026-07-21.
--
-- Hasta ahora VERTICAL solo cotizaba PRECIO en Fase 0 (motorFase0, códigos
-- VER xx): no tenía fila en `descuentos_modelo`, así que nunca obtenía modelo
-- y no generaba despiece, ni columnas en el Excel de órdenes, ni PDFs.
--
-- Fórmulas de taller (validadas con el dueño 2026-07-21):
--   perfil cabezal = ancho real − dcto_tubo_cm      (1,8)
--   varilla        = perfil cabezal − dcto_perfiles_cm (1,7, ENCADENADO al perfil)
--   carritos       = floor(varilla / 8)              ← hacia abajo
--   lamas          = carritos ; total lamas = lamas + 2 de repuesto
--   alto de corte  = alto real + extraVerticalCm      (5, parámetro de corte)
--   alto final     = alto de corte − dctoAltoFinalVerticalCm (13, parámetro)
--   tela: UN corte INVERTIDO — (alto+5) a lo ancho del rollo × ancho real a lo
--         largo; las lamas se sacan después en dimensionado.
--
-- Elección de campos: la varilla usa `dcto_perfiles_cm` (es un perfil de
-- aluminio) y NO `dcto_tela_cm` — la tela vertical no descuenta del ancho.
-- Los cm de la tela (5 y 13) NO viven acá: son parámetros de corte editables
-- desde el Optimizador de Tela → Parámetros de corte.
--
-- ⚠ Re-importar el Excel maestro "DESCUENTOS ROLLER CATALOGO" desde
--   Admin → DescuentosCatalogoSection REEMPLAZA TODA la tabla y PISA esta fila
--   (mismo caveat que el tubo E78 y la pletina). Si eso pasa, volver a correr
--   este script.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO descuentos_modelo (
  empresa_id, sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm,
  dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm, dcto_cenefa_del_cm,
  dcto_cenefa_tra_cm, dcto_perfiles_cm, peso_interno_duo_cm, peso_u_duo_cm,
  ancho_max_m, activo, notas
)
SELECT
  '67c635a5-152c-4780-a066-23f5081175a9', 'VERTICAL', 'VERTICAL_LAMAS_89', '',
  '', 0,
  1.8, 0, 0, 0, 0,
  0, 1.7, 0, 0,
  6, true,
  'Cortina vertical de lamas 8,9 cm. dcto_tubo = perfil cabezal (ancho − 1,8); '
  || 'dcto_perfiles = varilla (perfil − 1,7). Carritos = floor(varilla/8); '
  || 'total lamas = carritos + 2 de repuesto. Tela: un corte invertido '
  || '(alto+5 a lo ancho del rollo × ancho real); alto final de la lama = corte − 13. '
  || 'Los cm de tela son parámetros de corte, no de esta fila. '
  || 'NO re-importar el Excel maestro sin volver a aplicar esta fila.'
WHERE NOT EXISTS (
  SELECT 1 FROM descuentos_modelo
  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
    AND sistema = 'VERTICAL'
);

-- Verificación
SELECT sistema, tipo_rol, diametro_tubo_mm, dcto_tubo_cm, dcto_perfiles_cm, ancho_max_m, activo
FROM descuentos_modelo
WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
  AND sistema = 'VERTICAL';

-- Reversa:
-- DELETE FROM descuentos_modelo
--  WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
--    AND sistema = 'VERTICAL';
