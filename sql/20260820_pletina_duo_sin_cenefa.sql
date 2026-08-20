-- ─────────────────────────────────────────────────────────────────────
-- PLETINA DÚO (velcro): no lleva cenefa
--
-- La fila `descuentos_modelo` del sistema PLETINA_DUO tenía copiado el
-- `dcto_cenefa_cm = 1,5` del dúo con tubo. Como el despiece emite el corte de
-- la cenefa ovalada CUANDO EL MODELO LO DECLARA (despiece.ts, "if
-- modelo.dcto_cenefa_cm > 0"), toda pletina dúo salía al Excel de órdenes con
-- una «CENEFA OVALADA» de ancho − 1,5 que nadie iba a instalar: el paño va
-- PEGADO con velcro y no lleva cenefa (confirmado por el dueño 2026-08-20).
--
-- Hoy hay UNA sola cortina PLETINA_DUO_V cargada en el sistema, así que el
-- impacto histórico es mínimo; lo que este cambio evita es que se repita.
--
-- ⚠ Re-importar el Excel maestro de descuentos PISA esta corrección (mismo
-- caveat que la fila VERTICAL y el tubo E39): si vuelve el 1,5 en la pletina
-- dúo, volver a correr este script.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS descuentos_modelo_backup_20260820_pletina_duo AS
  SELECT * FROM descuentos_modelo WHERE sistema = 'PLETINA_DUO';

UPDATE descuentos_modelo
   SET dcto_cenefa_cm = 0
 WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
   AND sistema = 'PLETINA_DUO';

DO $$
DECLARE
  con_cenefa int;
  duo_ok     int;
BEGIN
  SELECT count(*) INTO con_cenefa
    FROM descuentos_modelo
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND sistema = 'PLETINA_DUO'
     AND coalesce(dcto_cenefa_cm, 0) <> 0;

  IF con_cenefa > 0 THEN
    RAISE EXCEPTION 'Quedaron % filas PLETINA_DUO con dcto_cenefa_cm', con_cenefa;
  END IF;

  -- El dúo CON TUBO conserva su cenefa: es el sistema CENEFA_OVALADA_DUO y
  -- todas sus filas deben seguir con el 1,5.
  SELECT count(*) INTO duo_ok
    FROM descuentos_modelo
   WHERE empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'::uuid
     AND sistema = 'CENEFA_OVALADA_DUO'
     AND coalesce(dcto_cenefa_cm, 0) = 0;

  IF duo_ok > 0 THEN
    RAISE EXCEPTION 'Se borró la cenefa de % filas del dúo con tubo', duo_ok;
  END IF;

  RAISE NOTICE 'Pletina dúo sin cenefa; el dúo con tubo conserva la suya.';
END $$;

COMMIT;

-- Para revertir: descuentos_modelo_backup_20260820_pletina_duo tiene la fila previa.
