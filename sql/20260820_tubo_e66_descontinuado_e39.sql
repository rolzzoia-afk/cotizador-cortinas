-- ─────────────────────────────────────────────────────────────────────
-- TUBO E66 DESCONTINUADO (por el momento) → la banda de 38 mm usa E39
--
-- Fase 2 le ponía E66 a todo roller de 38 mm sobre 2,2 m porque así lo dice
-- la regla guardada en `configuracion.reglas_seleccion` (la que PISA a la de
-- fábrica): «hasta 2,2 m → E02 · sobre 2,2 m → E66». El dueño descontinuó el
-- E66 y lo reemplaza con el E39 (2026-08-20).
--
-- Qué hace este script sobre el JSON guardado:
--   1. reglaE02E66.codigoDesde: E66 → E39 (y actualiza su descripción).
--   2. El tubo E66 pasa a estado «oculto»: deja de ofrecerse en Fase 2, pero
--      las OTs que ya lo tienen guardado lo siguen resolviendo y mostrando.
--
-- Efectos en la app (verificados en código, sin cambios de código):
--   · El paso Tubo de una cortina 38 mm ofrece E02 + E39 (el chip E66 sale).
--   · Una OT vieja con E66 guardado conserva su chip como escape.
--   · Si esa OT vieja se EDITA y re-sincroniza, el ajuste fino por ancho la
--     migra a E39 (comportamiento estándar de la banda).
--
-- Esto MISMO se puede hacer (y revertir) sin SQL desde
-- Admin → Catálogo técnico → Tuberías:
--   regla «Tubo de 38 mm» → selector «sobre ese ancho» → E39, y en la tabla
--   E66 → estado «Oculto (solo OTs viejas)» → Guardar.
-- Guardar desde Admin re-serializa la sección completa y CONSERVA este cambio.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS configuracion_backup_20260820_e66 AS
  SELECT * FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND clave = 'reglas_seleccion';

UPDATE configuracion c
   SET valor = jsonb_set(
     jsonb_set(
       jsonb_set(
         c.valor::jsonb,
         '{tuberia,reglaE02E66,codigoDesde}', '"E39"'
       ),
       '{tuberia,reglaE02E66,descripcion}',
       '"Tubo 38 mm: hasta 2,2 m → E02; más de 2,2 m → E39 (E66 descontinuado por el momento)"'
     ),
     '{tuberia,tubos}',
     (SELECT jsonb_agg(
        CASE WHEN t->>'codigo' = 'E66' THEN jsonb_set(t, '{estado}', '"oculto"') ELSE t END
      )
      FROM jsonb_array_elements(c.valor::jsonb->'tuberia'->'tubos') AS t)
   )::text
 WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
   AND clave = 'reglas_seleccion';

DO $$
DECLARE
  cfg jsonb;
  desde text;
  estado_e66 text;
  estado_e39 text;
  n_tubos int;
BEGIN
  SELECT valor::jsonb INTO cfg
    FROM configuracion
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND clave = 'reglas_seleccion';

  desde := cfg->'tuberia'->'reglaE02E66'->>'codigoDesde';
  IF desde IS DISTINCT FROM 'E39' THEN
    RAISE EXCEPTION 'La regla de 38 mm quedó apuntando a «%», no a E39', desde;
  END IF;

  SELECT t->>'estado' INTO estado_e66
    FROM jsonb_array_elements(cfg->'tuberia'->'tubos') AS t
   WHERE t->>'codigo' = 'E66';
  IF estado_e66 IS DISTINCT FROM 'oculto' THEN
    RAISE EXCEPTION 'El E66 quedó en estado «%», no oculto', estado_e66;
  END IF;

  -- El E39 tiene que seguir ACTIVO en el catálogo: es el que ahora se ofrece.
  SELECT t->>'estado' INTO estado_e39
    FROM jsonb_array_elements(cfg->'tuberia'->'tubos') AS t
   WHERE t->>'codigo' = 'E39';
  IF estado_e39 IS DISTINCT FROM 'activo' THEN
    RAISE EXCEPTION 'El E39 está en estado «%»: la banda apuntaría a un tubo que no se ofrece', estado_e39;
  END IF;

  -- El catálogo no puede haber perdido filas al reconstruir el array.
  SELECT jsonb_array_length(cfg->'tuberia'->'tubos') INTO n_tubos;
  IF n_tubos < 6 THEN
    RAISE EXCEPTION 'El catálogo de tubos quedó con % filas (se esperaban 6)', n_tubos;
  END IF;

  RAISE NOTICE 'Banda 38 mm sobre 2,2 m → E39; E66 oculto (OTs viejas siguen resolviendo).';
END $$;

COMMIT;

-- Para revertir: configuracion_backup_20260820_e66 tiene la fila previa
-- (o desde Admin → Catálogo técnico → Tuberías, que edita esto mismo).
