-- ============================================================================
-- CLIENTES 01 — cada cotización es una fila, con su estado y su historial
-- Fecha: 2026-09-16
-- ============================================================================
--
-- POR QUÉ:
--   El seguimiento comercial se lleva en un Excel con una fila por cotización
--   (fecha, cliente, canal, quién llamó, quién cotizó, monto, N° de cotización,
--   estado de envío y los seguimientos 1-2-3 con su medio y respuesta). El
--   módulo Leads ya tenía el motor de seguimientos, pero nacía vacío: solo 5 de
--   190 OT estaban unidas a un lead, y cada cliente había que tipearlo dos
--   veces. Además, el historial no decía QUIÉN hizo cada cambio y las ediciones
--   de la ficha no dejaban rastro.
--
-- QUÉ HACE:
--   1. Versiona lo que hasta hoy vivía solo en la base: las columnas del motor
--      de seguimientos, su trigger, `archivar_seguimientos_vencidos` y
--      `metas_vendedora`. Desde ahora el repo es la fuente de verdad.
--   2. Columnas nuevas en `leads` para las columnas del Excel (Instagram,
--      región, anuncio, mensaje, quién llamó / cotizó / visitó, N° de
--      cotización) y el ESTADO DE LA COTIZACIÓN (sin enviar · enviada · por
--      actualizar · actualizada) con su contador de envíos.
--   3. `leads_seguimientos`: cada seguimiento con su número, medio (llamada,
--      WhatsApp, mail, Instagram) y respuesta. Sin tope de 3.
--   4. Triggers en `ots`: cada OT con cliente crea o enlaza su fila en `leads`;
--      el monto, el N° y el estado se mantienen solos. Una fila de la planilla
--      NUNCA impide guardar una OT (todo va con EXCEPTION → WARNING).
--   5. RPCs con historial firmado (`registrado_por = auth.uid()`):
--      `lead_cotizacion_estado` (el botón), `lead_editar` (diff campo a campo),
--      `lead_asignar`, `registrar_seguimiento` con medio, `lead_vincular_ot`
--      sin duplicados, y `nombres_perfiles_empresa` para poner nombre al autor.
--   6. `leads` y `leads_seguimientos` entran a la publicación de tiempo real
--      (`leads` NO estaba: la suscripción de la pantalla no recibía nada).
--   7. Relleno: una fila por cada OT existente con cliente, y los seguimientos
--      viejos (columnas seg1..3) pasan a la tabla nueva.
--   8. Agrega «Lourdes» (terreno) y «María Fernanda» (vendedoras) a las listas
--      del engranaje de /ventas si no están.
--
-- QUÉ NO HACE:
--   - No toca `Panel.tsx` ni el flujo de las OT: solo las escucha.
--   - No borra ningún lead. Los 52 que ya existen quedan igual.
--   - El índice único de teléfono pasa a valer SOLO para los leads del bot
--     (los que traen `whatsapp_wa_id`): un cliente que cotiza dos veces
--     rompía la segunda OT. Ninguna función del repo ni de las desplegadas
--     hace upsert por teléfono.
--
-- ORDEN DE EJECUCIÓN:
--   Después de `20260512_crm_fase1_leads.sql`.
--   Al terminar: `npm run types:gen`. El front nuevo va DESPUÉS de este SQL
--   (manda `p_medio`); el front viejo sigue funcionando (el parámetro tiene
--   DEFAULT).
--
-- IDEMPOTENTE: se puede correr dos veces (el relleno solo toma OT sin fila).
-- REVERSA: al pie del archivo.
-- ============================================================================

BEGIN;

DO $$ BEGIN RAISE NOTICE '=== Clientes 01 · planilla y seguimiento — INICIADO ==='; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0) Lo que tiene que estar antes
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.leads') IS NULL OR to_regclass('public.leads_actividad') IS NULL THEN
    RAISE EXCEPTION 'Falta correr antes sql/20260512_crm_fase1_leads.sql';
  END IF;
  IF to_regclass('public.ots') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla ots';
  END IF;
  IF to_regprocedure('public.get_my_empresa_id()') IS NULL THEN
    RAISE EXCEPTION 'Falta get_my_empresa_id()';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Versionar el motor de seguimientos (existía solo en la base)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS prioridad          text        NOT NULL DEFAULT 'media';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS detalle_personal   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_cotizacion   timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS etapa_seguimiento  smallint    NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg1_fecha         timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg1_resultado     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg2_fecha         timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg2_resultado     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg3_fecha         timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seg3_resultado     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archivado          boolean     NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_archivado    timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS monto              numeric;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_cierre       timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_prioridad_chk') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_prioridad_chk
      CHECK (prioridad = ANY (ARRAY['alta','media','baja']));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_seguimiento
  ON leads (empresa_id, estado, archivado, etapa_seguimiento);

-- `metas_vendedora` (metas de venta por vendedora y período) — igual a la viva.
CREATE TABLE IF NOT EXISTS metas_vendedora (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid        NOT NULL,
  vendedora_id  uuid        NOT NULL,
  periodo       text        NOT NULL,
  monto_meta    numeric     NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, vendedora_id, periodo)
);
ALTER TABLE metas_vendedora ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS metas_select ON metas_vendedora;
CREATE POLICY metas_select ON metas_vendedora FOR SELECT
  USING (empresa_id IN (SELECT perfiles.empresa_id FROM perfiles WHERE perfiles.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS metas_admin_write ON metas_vendedora;
CREATE POLICY metas_admin_write ON metas_vendedora FOR ALL
  USING (empresa_id IN (SELECT perfiles.empresa_id FROM perfiles
                        WHERE perfiles.id = (SELECT auth.uid()) AND lower(perfiles.rol) = 'admin'))
  WITH CHECK (empresa_id IN (SELECT perfiles.empresa_id FROM perfiles
                             WHERE perfiles.id = (SELECT auth.uid()) AND lower(perfiles.rol) = 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Columnas del Excel y estado de la cotización
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram             text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS region                text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS anuncio               text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mensaje               text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS llamada_por           text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cotizado_por          text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS visita_por            text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS numero_cotizacion     text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado_cotizacion     text     NOT NULL DEFAULT 'sin_enviar';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cotizacion_version    smallint NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS origen_ot             boolean  NOT NULL DEFAULT false;
-- Quién hizo lo último y qué fue: lo mantiene el trigger de `leads_actividad`,
-- así la planilla lo muestra sin una consulta más y llega por tiempo real.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_actividad_por  uuid;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_actividad_tipo text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_estado_cotizacion_chk') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_estado_cotizacion_chk
      CHECK (estado_cotizacion = ANY (ARRAY['sin_enviar','enviada','por_actualizar','actualizada']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_cotizacion_version_chk') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_cotizacion_version_chk CHECK (cotizacion_version >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_ultima_actividad_por_fkey') THEN
    ALTER TABLE leads ADD CONSTRAINT leads_ultima_actividad_por_fkey
      FOREIGN KEY (ultima_actividad_por) REFERENCES perfiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_empresa_creado ON leads (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_numero_cot ON leads (empresa_id, numero_cotizacion)
  WHERE numero_cotizacion IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_ot ON leads (ot_id) WHERE ot_id IS NOT NULL;

-- El tipo `cotizacion` = cambio de estado de la cotización.
ALTER TABLE leads_actividad DROP CONSTRAINT IF EXISTS leads_actividad_tipo_check;
ALTER TABLE leads_actividad ADD CONSTRAINT leads_actividad_tipo_check
  CHECK (tipo = ANY (ARRAY['creado','cambio_estado','comentario','asignacion','conversion_ot',
                           'edicion','agente_ingreso','seguimiento','cotizacion']));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Teléfono único solo para el bot
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_empresa_id_whatsapp_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS leads_bot_telefono_unico
  ON leads (empresa_id, whatsapp_phone) WHERE whatsapp_wa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_bot_wa_id_unico
  ON leads (empresa_id, whatsapp_wa_id) WHERE whatsapp_wa_id IS NOT NULL;

-- Los teléfonos de las OT vienen como se tipearon (« 56 9 7495 0296», «9 3242
-- 0128\t\t»). Para comparar y guardar se llevan a +569XXXXXXXX.
CREATE OR REPLACE FUNCTION telefono_normalizado(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  WITH d AS (SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') AS x)
  SELECT CASE
    WHEN x = '' THEN NULL
    WHEN length(x) = 11 AND x LIKE '569%' THEN '+' || x
    WHEN length(x) = 9  AND x LIKE '9%'   THEN '+56' || x
    WHEN length(x) = 8                    THEN '+569' || x
    ELSE '+' || x
  END
  FROM d;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Tablas nuevas
-- ─────────────────────────────────────────────────────────────────────────────
-- Cada seguimiento: `n` es el correlativo del cliente (1, 2, 3, 4…); `etapa` es
-- la etapa de la cadencia a la que respondía (1-3) o NULL si fue uno extra.
CREATE TABLE IF NOT EXISTS leads_seguimientos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  empresa_id      uuid        NOT NULL,
  n               smallint    NOT NULL CHECK (n >= 1),
  etapa           smallint    CHECK (etapa BETWEEN 1 AND 3),
  fecha           timestamptz NOT NULL DEFAULT now(),
  medio           text        CHECK (medio = ANY (ARRAY['llamada','whatsapp','mail','instagram','otro'])),
  resultado       text        NOT NULL
                  CHECK (resultado = ANY (ARRAY['no_respondio','respondio','agendo_visita','cerro','no_interesado'])),
  nota            text,
  registrado_por  uuid        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, n)
);
CREATE INDEX IF NOT EXISTS idx_leads_seg_empresa_fecha ON leads_seguimientos (empresa_id, fecha DESC);

ALTER TABLE leads_seguimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_isolation ON leads_seguimientos;
CREATE POLICY empresa_isolation ON leads_seguimientos FOR ALL TO authenticated
  USING (empresa_id = (SELECT get_my_empresa_id()))
  WITH CHECK (empresa_id = (SELECT get_my_empresa_id()));
GRANT SELECT, INSERT, UPDATE, DELETE ON leads_seguimientos TO authenticated;

-- OT cuya fila se borró a propósito (una OT de prueba, un duplicado): no se
-- vuelve a crear la próxima vez que alguien guarde esa OT.
CREATE TABLE IF NOT EXISTS leads_ot_omitidas (
  ot_id        uuid        PRIMARY KEY REFERENCES ots(id) ON DELETE CASCADE,
  empresa_id   uuid        NOT NULL,
  omitida_por  uuid        REFERENCES perfiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE leads_ot_omitidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_isolation ON leads_ot_omitidas;
CREATE POLICY empresa_isolation ON leads_ot_omitidas FOR SELECT TO authenticated
  USING (empresa_id = (SELECT get_my_empresa_id()));
GRANT SELECT ON leads_ot_omitidas TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Tiempo real
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads_seguimientos') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads_seguimientos;
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Estados: del lead y desde la OT
-- ─────────────────────────────────────────────────────────────────────────────
-- Cuánto avanzó un lead. Sirve para que la OT solo EMPUJE hacia adelante: un
-- lead en «Negociación» no vuelve a «Cotizando» porque alguien guardó la OT.
CREATE OR REPLACE FUNCTION lead_estado_rango(p_estado text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_estado
    WHEN 'nuevo'               THEN 0
    WHEN 'contactado'          THEN 1
    WHEN 'visita_agendada'     THEN 2
    WHEN 'visita_realizada'    THEN 3
    WHEN 'cotizando'           THEN 4
    WHEN 'cotizado'            THEN 5
    WHEN 'negociacion'         THEN 6
    WHEN 'en_espera'           THEN 6
    WHEN 'perdido_precio'      THEN 8
    WHEN 'perdido_competencia' THEN 8
    WHEN 'perdido_otro'        THEN 8
    WHEN 'ganado'              THEN 9
    ELSE 0
  END;
$fn$;

-- El estado de la OT en el Panel → estado del lead.
--   cotizacion → cotizando · esperando → cotizado · terreno → visita agendada ·
--   aprobada / produccion / lista / instalada / entregado → ganado.
-- `p_actual` NULL = lead nuevo. Nunca retrocede; «ganado» gana siempre (el
-- cliente que se había perdido y volvió); un perdido no se pisa con otro estado.
CREATE OR REPLACE FUNCTION lead_estado_desde_ot(p_estado_ot text, p_actual text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_obj text;
BEGIN
  v_obj := CASE p_estado_ot
    WHEN 'cotizacion' THEN 'cotizando'
    WHEN 'esperando'  THEN 'cotizado'
    WHEN 'terreno'    THEN 'visita_agendada'
    WHEN 'aprobada'   THEN 'ganado'
    WHEN 'produccion' THEN 'ganado'
    WHEN 'lista'      THEN 'ganado'
    WHEN 'instalada'  THEN 'ganado'
    WHEN 'entregado'  THEN 'ganado'
    ELSE NULL
  END;
  IF p_actual IS NULL THEN
    RETURN coalesce(v_obj, 'cotizando');
  END IF;
  IF v_obj IS NULL THEN
    RETURN p_actual;
  END IF;
  IF v_obj = 'ganado' THEN
    RETURN 'ganado';
  END IF;
  IF p_actual = 'ganado' OR p_actual LIKE 'perdido%' THEN
    RETURN p_actual;
  END IF;
  IF lead_estado_rango(v_obj) > lead_estado_rango(p_actual) THEN
    RETURN v_obj;
  END IF;
  RETURN p_actual;
END $fn$;

-- El trigger del motor de seguimientos, igual al vivo + una regla: entrar a
-- «Cotizado» a mano (Kanban, ficha) también marca la cotización como enviada.
CREATE OR REPLACE FUNCTION trg_leads_seguimiento_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Entró a 'cotizado' (cotización enviada) → arranca el ciclo de seguimientos
  IF NEW.estado = 'cotizado' AND COALESCE(OLD.estado,'') <> 'cotizado' THEN
    NEW.fecha_cotizacion := now();
    NEW.etapa_seguimiento := 1;
    NEW.seg1_fecha := NULL; NEW.seg1_resultado := NULL;
    NEW.seg2_fecha := NULL; NEW.seg2_resultado := NULL;
    NEW.seg3_fecha := NULL; NEW.seg3_resultado := NULL;
    NEW.archivado := false;
    NEW.fecha_archivado := NULL;
    IF COALESCE(NEW.cotizacion_version, 0) < 1 THEN
      NEW.cotizacion_version := 1;
    END IF;
    IF NEW.estado_cotizacion = 'sin_enviar' THEN
      NEW.estado_cotizacion := 'enviada';
    END IF;
  END IF;
  -- Entró a 'ganado' → registrar fecha de cierre (para acumulado del mes y cierres de ayer)
  IF NEW.estado = 'ganado' AND COALESCE(OLD.estado,'') <> 'ganado' THEN
    NEW.fecha_cierre := now();
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_leads_seguimiento ON leads;
CREATE TRIGGER trg_leads_seguimiento BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_leads_seguimiento_fn();

CREATE OR REPLACE FUNCTION leads_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_set_updated_at();

-- Igual a la viva.
CREATE OR REPLACE FUNCTION archivar_seguimientos_vencidos(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE v_count integer;
BEGIN
  WITH upd AS (
    UPDATE public.leads
       SET archivado = true, fecha_archivado = now(),
           etapa_seguimiento = 4, ultima_actividad_at = now()
     WHERE empresa_id = p_empresa_id
       AND estado = 'cotizado'
       AND archivado = false
       AND etapa_seguimiento BETWEEN 1 AND 3
       AND fecha_cotizacion IS NOT NULL
       AND fecha_cotizacion + interval '8 days' < now()
    RETURNING id, empresa_id
  )
  INSERT INTO public.leads_actividad (lead_id, empresa_id, tipo, detalle)
  SELECT id, empresa_id, 'seguimiento', jsonb_build_object('accion','archivado_auto')
  FROM upd;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Historial: la última actividad queda en el lead, y quién la hizo
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_leads_actividad_ultima_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE leads
     SET ultima_actividad_at   = greatest(ultima_actividad_at, NEW.created_at),
         ultima_actividad_por  = CASE WHEN NEW.created_at >= ultima_actividad_at
                                      THEN NEW.registrado_por ELSE ultima_actividad_por END,
         ultima_actividad_tipo = CASE WHEN NEW.created_at >= ultima_actividad_at
                                      THEN NEW.tipo ELSE ultima_actividad_tipo END
   WHERE id = NEW.lead_id;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'leads_actividad → leads: %', SQLERRM;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS trg_leads_actividad_ultima ON leads_actividad;
CREATE TRIGGER trg_leads_actividad_ultima AFTER INSERT ON leads_actividad
  FOR EACH ROW EXECUTE FUNCTION trg_leads_actividad_ultima_fn();

-- Nombres de las personas de la empresa, para firmar el historial. Los
-- vendedores no pueden leer `perfiles` de otros (RLS), y no hace falta:
-- solo se exponen id y nombre.
CREATE OR REPLACE FUNCTION nombres_perfiles_empresa()
RETURNS TABLE (id uuid, nombre text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT p.id, coalesce(nullif(btrim(p.nombre), ''), 'Sin nombre')
  FROM perfiles p
  WHERE p.empresa_id = (SELECT get_my_empresa_id());
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Estado de la cotización (el botón)
-- ─────────────────────────────────────────────────────────────────────────────
-- Interna: la usan la RPC y el trigger de `ots`. `p_origen` = 'manual' | 'ot'.
--   enviada / actualizada → cuenta un envío más y arranca la cadencia 1-2-3.
--   por_actualizar        → solo el estado: la fila queda como tarea.
--   sin_enviar            → solo el estado.
CREATE OR REPLACE FUNCTION lead_cotizacion_aplicar(
  p_lead_id uuid, p_estado text, p_nota text, p_origen text
)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_antes leads;
  v       leads;
BEGIN
  SELECT * INTO v_antes FROM leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF p_estado IN ('enviada', 'actualizada') THEN
    UPDATE leads SET
      estado_cotizacion  = p_estado,
      cotizacion_version = v_antes.cotizacion_version + 1,
      estado = CASE
        WHEN v_antes.estado = 'ganado' OR v_antes.estado LIKE 'perdido%' THEN v_antes.estado
        WHEN lead_estado_rango(v_antes.estado) < lead_estado_rango('cotizado') THEN 'cotizado'
        ELSE v_antes.estado
      END,
      fecha_cotizacion  = now(),
      etapa_seguimiento = 1,
      seg1_fecha = NULL, seg1_resultado = NULL,
      seg2_fecha = NULL, seg2_resultado = NULL,
      seg3_fecha = NULL, seg3_resultado = NULL,
      archivado = false, fecha_archivado = NULL,
      ultima_actividad_at = now()
    WHERE id = p_lead_id
    RETURNING * INTO v;
  ELSE
    UPDATE leads SET estado_cotizacion = p_estado, ultima_actividad_at = now()
    WHERE id = p_lead_id
    RETURNING * INTO v;
  END IF;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (
    p_lead_id, v.empresa_id, 'cotizacion',
    jsonb_build_object(
      'de', v_antes.estado_cotizacion,
      'a', p_estado,
      'version', v.cotizacion_version,
      'nota', nullif(btrim(coalesce(p_nota, '')), ''),
      'origen', p_origen,
      'numero_cotizacion', v.numero_cotizacion,
      'monto', v.monto,
      'estado_de', CASE WHEN v.estado <> v_antes.estado THEN v_antes.estado END,
      'estado_a',  CASE WHEN v.estado <> v_antes.estado THEN v.estado END
    ),
    auth.uid()
  );
  RETURN v;
END $fn$;

-- Pública: el botón «Estado de la cotización». Si se marca Enviada/Actualizada
-- y la OT sigue en «Cotización», la OT pasa a «Esperando confirmación» para
-- que el Panel diga lo mismo que la planilla.
CREATE OR REPLACE FUNCTION lead_cotizacion_estado(p_lead_id uuid, p_estado text, p_nota text DEFAULT NULL)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_empresa uuid := get_my_empresa_id();
  v_lead    leads;
  v_ot      ots;
BEGIN
  IF p_estado IS NULL OR p_estado NOT IN ('sin_enviar','enviada','por_actualizar','actualizada') THEN
    RAISE EXCEPTION 'Estado de cotización no válido: %', p_estado USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND empresa_id = v_empresa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  v_lead := lead_cotizacion_aplicar(p_lead_id, p_estado, p_nota, 'manual');

  IF p_estado IN ('enviada','actualizada') AND v_lead.ot_id IS NOT NULL THEN
    SELECT * INTO v_ot FROM ots WHERE id = v_lead.ot_id AND empresa_id = v_empresa;
    IF FOUND AND v_ot.estado = 'cotizacion' THEN
      -- El trigger de `ots` volvería a contar el envío: se lo salta.
      PERFORM set_config('app.lead_sync', 'skip', true);
      UPDATE ots SET
        estado = 'esperando',
        fecha_modificacion = now(),
        datos_generales = jsonb_set(
          coalesce(datos_generales, '{}'::jsonb),
          '{historialEstados}',
          coalesce(datos_generales->'historialEstados', '[]'::jsonb) ||
            jsonb_build_array(jsonb_build_object(
              'de', 'cotizacion', 'a', 'esperando',
              'fecha', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ))
        )
      WHERE id = v_ot.id;
      PERFORM set_config('app.lead_sync', '', true);
    END IF;
  END IF;

  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  RETURN v_lead;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Editar y asignar con rastro
-- ─────────────────────────────────────────────────────────────────────────────
-- «Editar datos» de la ficha. Solo aplica las claves permitidas; el texto
-- vacío se guarda como NULL; deja UNA actividad `edicion` con «de → a» por
-- campo. Si nada cambió, no escribe.
CREATE OR REPLACE FUNCTION lead_editar(p_lead_id uuid, p_patch jsonb)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_permitidas text[] := ARRAY[
    'nombre','whatsapp_phone','email','rut','comuna','region','instagram','fuente',
    'anuncio','mensaje','comentarios','llamada_por','cotizado_por','visita_por',
    'presupuesto_rango','prioridad','detalle_personal','monto'
  ];
  v_empresa uuid := get_my_empresa_id();
  v_antes   leads;
  v         leads;
  v_viejo   jsonb;
  v_nuevo   jsonb;
  v_diff    jsonb;
  k         text;
  val       jsonb;
BEGIN
  SELECT * INTO v_antes FROM leads WHERE id = p_lead_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  v_viejo := to_jsonb(v_antes);
  v_nuevo := v_viejo;
  FOR k, val IN SELECT key, value FROM jsonb_each(coalesce(p_patch, '{}'::jsonb)) LOOP
    CONTINUE WHEN NOT (k = ANY (v_permitidas));
    -- El monto de una fila con OT lo manda la OT.
    CONTINUE WHEN k = 'monto' AND v_antes.ot_id IS NOT NULL;
    IF jsonb_typeof(val) = 'string' THEN
      val := CASE WHEN btrim(val #>> '{}') = '' THEN 'null'::jsonb
                  ELSE to_jsonb(btrim(val #>> '{}')) END;
    END IF;
    -- Estos no pueden quedar vacíos.
    CONTINUE WHEN k IN ('prioridad','fuente') AND val = 'null'::jsonb;
    v_nuevo := jsonb_set(v_nuevo, ARRAY[k], val);
  END LOOP;

  SELECT jsonb_object_agg(n.key, jsonb_build_object('de', v_viejo -> n.key, 'a', n.value))
    INTO v_diff
  FROM jsonb_each(v_nuevo) n
  WHERE n.key = ANY (v_permitidas)
    AND n.value IS DISTINCT FROM (v_viejo -> n.key);

  IF v_diff IS NULL THEN
    RETURN v_antes;
  END IF;

  UPDATE leads l SET
    nombre            = r.nombre,
    whatsapp_phone    = r.whatsapp_phone,
    email             = r.email,
    rut               = r.rut,
    comuna            = r.comuna,
    region            = r.region,
    instagram         = r.instagram,
    fuente            = r.fuente,
    anuncio           = r.anuncio,
    mensaje           = r.mensaje,
    comentarios       = r.comentarios,
    llamada_por       = r.llamada_por,
    cotizado_por      = r.cotizado_por,
    visita_por        = r.visita_por,
    presupuesto_rango = r.presupuesto_rango,
    prioridad         = r.prioridad,
    detalle_personal  = r.detalle_personal,
    monto             = r.monto,
    ultima_actividad_at = now()
  FROM jsonb_populate_record(NULL::leads, v_nuevo) r
  WHERE l.id = p_lead_id
  RETURNING l.* INTO v;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (p_lead_id, v.empresa_id, 'edicion', jsonb_build_object('campos', v_diff), auth.uid());

  RETURN v;
END $fn$;

CREATE OR REPLACE FUNCTION lead_asignar(p_lead_id uuid, p_perfil_id uuid)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_empresa uuid := get_my_empresa_id();
  v_antes   leads;
  v         leads;
BEGIN
  SELECT * INTO v_antes FROM leads WHERE id = p_lead_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;
  IF p_perfil_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM perfiles WHERE id = p_perfil_id AND empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Esa persona no es de tu empresa' USING ERRCODE = '22023';
  END IF;
  IF v_antes.asignado_a IS NOT DISTINCT FROM p_perfil_id THEN
    RETURN v_antes;
  END IF;

  UPDATE leads SET
    asignado_a  = p_perfil_id,
    asignado_at = CASE WHEN p_perfil_id IS NULL THEN NULL ELSE now() END,
    ultima_actividad_at = now()
  WHERE id = p_lead_id
  RETURNING * INTO v;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (p_lead_id, v.empresa_id, 'asignacion',
          jsonb_build_object('de', v_antes.asignado_a, 'a', p_perfil_id), auth.uid());
  RETURN v;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10) Seguimientos con medio
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ La firma cambia (agrega p_medio). Con CREATE OR REPLACE quedarían DOS
-- funciones y PostgREST no sabría a cuál llamar (PGRST203): se borra la vieja.
DROP FUNCTION IF EXISTS registrar_seguimiento(uuid, text, text);

CREATE OR REPLACE FUNCTION registrar_seguimiento(
  p_lead_id uuid, p_resultado text, p_nota text DEFAULT NULL, p_medio text DEFAULT NULL
)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_empresa  uuid := get_my_empresa_id();
  v_lead     leads;
  v_etapa    smallint;
  v_positivo boolean;
  v_n        smallint;
  v_medio    text := nullif(btrim(coalesce(p_medio, '')), '');
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;
  IF p_resultado IS NULL OR p_resultado NOT IN ('no_respondio','respondio','agendo_visita','cerro','no_interesado') THEN
    RAISE EXCEPTION 'Resultado no válido: %', p_resultado USING ERRCODE = '22023';
  END IF;
  IF v_medio IS NOT NULL AND v_medio NOT IN ('llamada','whatsapp','mail','instagram','otro') THEN
    RAISE EXCEPTION 'Medio no válido: %', v_medio USING ERRCODE = '22023';
  END IF;

  v_etapa := COALESCE(v_lead.etapa_seguimiento, 0);
  v_positivo := p_resultado IN ('respondio','agendo_visita','cerro');
  SELECT coalesce(max(n), 0) + 1 INTO v_n FROM leads_seguimientos WHERE lead_id = p_lead_id;

  IF v_etapa BETWEEN 1 AND 3 THEN
    -- Marca la fecha y resultado de la etapa correspondiente
    IF v_etapa = 1 THEN
      UPDATE leads SET seg1_fecha = now(), seg1_resultado = p_resultado WHERE id = p_lead_id;
    ELSIF v_etapa = 2 THEN
      UPDATE leads SET seg2_fecha = now(), seg2_resultado = p_resultado WHERE id = p_lead_id;
    ELSE
      UPDATE leads SET seg3_fecha = now(), seg3_resultado = p_resultado WHERE id = p_lead_id;
    END IF;

    -- Avanza el ciclo
    IF v_positivo THEN
      UPDATE leads SET etapa_seguimiento = 4, ultima_actividad_at = now() WHERE id = p_lead_id;
    ELSIF v_etapa < 3 THEN
      UPDATE leads SET etapa_seguimiento = v_etapa + 1, ultima_actividad_at = now() WHERE id = p_lead_id;
    ELSE
      UPDATE leads
         SET etapa_seguimiento = 4, archivado = true, fecha_archivado = now(), ultima_actividad_at = now()
       WHERE id = p_lead_id;
    END IF;
  ELSE
    -- Fuera de la cadencia (nunca se envió, o el ciclo ya cerró): se anota
    -- igual, sin tocar la cadencia.
    UPDATE leads SET ultima_actividad_at = now() WHERE id = p_lead_id;
  END IF;

  INSERT INTO leads_seguimientos (lead_id, empresa_id, n, etapa, fecha, medio, resultado, nota, registrado_por)
  VALUES (p_lead_id, v_lead.empresa_id, v_n,
          CASE WHEN v_etapa BETWEEN 1 AND 3 THEN v_etapa END,
          now(), v_medio, p_resultado, nullif(btrim(coalesce(p_nota, '')), ''), auth.uid());

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
  VALUES (
    p_lead_id, v_lead.empresa_id, 'seguimiento',
    jsonb_build_object('etapa', CASE WHEN v_etapa BETWEEN 1 AND 3 THEN v_etapa END,
                       'n', v_n, 'resultado', p_resultado, 'nota', p_nota, 'medio', v_medio),
    auth.uid()
  );

  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  RETURN v_lead;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11) OT → lead
-- ─────────────────────────────────────────────────────────────────────────────
-- Crea o enlaza la fila de una OT. Orden:
--   1. `datos_generales.leadId` (la OT se creó desde un lead) → enlaza ese lead.
--   2. Un lead sin OT, no cerrado, con el mismo teléfono → enlaza (consultó y
--      después cotizó).
--   3. Si no, crea una fila nueva (`origen_ot = true`).
-- Sin cliente ni teléfono no hace nada: la OT «solo con número» del Panel crea
-- su fila cuando Fase 1 le pone el cliente.
-- `p_relleno = true` solo para la carga inicial: fechas de la OT y estado
-- deducido (una OT en cotización CON total se toma como enviada).
CREATE OR REPLACE FUNCTION lead_desde_ot(p_ot ots, p_relleno boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_dg        jsonb := coalesce(p_ot.datos_generales, '{}'::jsonb);
  v_cliente   text  := nullif(btrim(v_dg->>'cliente'), '');
  v_tel       text  := telefono_normalizado(v_dg->>'telefono');
  v_num       text  := coalesce(nullif(btrim(v_dg->>'otDetallada'), ''),
                                nullif(nullif(btrim(p_ot.numero_ot), ''), 'OT'));
  v_region    text  := nullif(btrim(v_dg->>'regionNombre'), '');
  v_canal     text  := nullif(btrim(v_dg->>'canal'), '');
  v_monto     numeric := CASE WHEN coalesce(p_ot.total, 0) > 0 THEN p_ot.total END;
  v_existente uuid;
  v_enlazar   uuid;
  v_via       text;
  v_estado    text;
  v_est_cot   text := 'sin_enviar';
  v_version   smallint := 0;
  v_f_cot     timestamptz;
  v_etapa     smallint := 0;
  v_archivado boolean := false;
  v_f_arch    timestamptz;
  v_f_cierre  timestamptz;
  v_creado    timestamptz := CASE WHEN p_relleno THEN p_ot.fecha_creacion ELSE now() END;
  v_nuevo_id  uuid;
BEGIN
  IF v_cliente IS NULL AND v_tel IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_existente FROM leads WHERE ot_id = p_ot.id LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RETURN v_existente;
  END IF;
  IF EXISTS (SELECT 1 FROM leads_ot_omitidas WHERE ot_id = p_ot.id) THEN
    RETURN NULL;
  END IF;

  -- 1. El marcador que deja la app cuando la OT sale de un lead.
  BEGIN
    SELECT l.id INTO v_enlazar
    FROM leads l
    WHERE l.id = nullif(v_dg->>'leadId', '')::uuid
      AND l.empresa_id = p_ot.empresa_id
      AND l.ot_id IS NULL;
    IF v_enlazar IS NOT NULL THEN v_via := 'marcador'; END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_enlazar := NULL;
  END;

  -- 2. Mismo teléfono.
  IF v_enlazar IS NULL AND v_tel IS NOT NULL THEN
    SELECT l.id INTO v_enlazar
    FROM leads l
    WHERE l.empresa_id = p_ot.empresa_id
      AND l.ot_id IS NULL
      AND l.estado NOT IN ('ganado','perdido_precio','perdido_competencia','perdido_otro')
      AND telefono_normalizado(l.whatsapp_phone) = v_tel
    ORDER BY l.created_at DESC
    LIMIT 1;
    IF v_enlazar IS NOT NULL THEN v_via := 'telefono'; END IF;
  END IF;

  IF v_enlazar IS NOT NULL THEN
    UPDATE leads SET
      ot_id = p_ot.id,
      estado = CASE
        WHEN estado = 'ganado' OR estado LIKE 'perdido%' THEN estado
        WHEN lead_estado_rango(lead_estado_desde_ot(p_ot.estado, estado)) < lead_estado_rango('cotizando')
          THEN 'cotizando'
        ELSE lead_estado_desde_ot(p_ot.estado, estado)
      END,
      monto = coalesce(v_monto, monto),
      numero_cotizacion = coalesce(v_num, numero_cotizacion),
      region = coalesce(region, v_region),
      email = coalesce(nullif(btrim(email), ''), nullif(btrim(v_dg->>'mail'), '')),
      rut = coalesce(nullif(btrim(rut), ''), nullif(btrim(v_dg->>'rut'), '')),
      comuna = coalesce(nullif(btrim(comuna), ''), nullif(btrim(v_dg->>'comuna'), ''))
    WHERE id = v_enlazar;

    INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por, created_at)
    VALUES (v_enlazar, p_ot.empresa_id, 'conversion_ot',
            jsonb_build_object('ot_id', p_ot.id, 'numero_ot', p_ot.numero_ot,
                               'origen', 'ot', 'via', v_via, 'relleno', p_relleno),
            CASE WHEN p_relleno THEN NULL ELSE auth.uid() END,
            CASE WHEN p_relleno THEN p_ot.fecha_creacion ELSE now() END);
    RETURN v_enlazar;
  END IF;

  -- 3. Fila nueva.
  v_estado := lead_estado_desde_ot(p_ot.estado, NULL);

  IF p_relleno THEN
    IF v_estado = 'ganado' THEN
      v_est_cot := 'enviada';
      v_version := 1;
      v_etapa := 4;
      SELECT min((h->>'fecha')::timestamptz) INTO v_f_cierre
      FROM jsonb_array_elements(coalesce(v_dg->'historialEstados', '[]'::jsonb)) h
      WHERE h->>'a' = 'aprobada';
      v_f_cierre := coalesce(v_f_cierre, p_ot.fecha_modificacion, p_ot.fecha_creacion);
      v_f_cot := p_ot.fecha_creacion;
    ELSIF p_ot.estado = 'esperando' OR (p_ot.estado = 'cotizacion' AND v_monto IS NOT NULL) THEN
      v_estado := 'cotizado';
      v_est_cot := 'enviada';
      v_version := 1;
      SELECT min((h->>'fecha')::timestamptz) INTO v_f_cot
      FROM jsonb_array_elements(coalesce(v_dg->'historialEstados', '[]'::jsonb)) h
      WHERE h->>'a' = 'esperando';
      v_f_cot := coalesce(v_f_cot, p_ot.fecha_creacion);
      IF v_f_cot + interval '8 days' < now() THEN
        -- Ya pasó el día +8: queda archivada, igual que haría la bandeja.
        v_etapa := 4;
        v_archivado := true;
        v_f_arch := v_f_cot + interval '8 days';
      ELSE
        v_etapa := 1;
      END IF;
    END IF;
  ELSE
    IF v_estado = 'cotizado' THEN
      v_est_cot := 'enviada';
      v_version := 1;
      v_f_cot := now();
      v_etapa := 1;
    ELSIF v_estado = 'ganado' THEN
      v_f_cierre := now();
    END IF;
  END IF;

  INSERT INTO leads (
    empresa_id, nombre, whatsapp_phone, email, rut, comuna, region, fuente, estado,
    ot_id, origen_ot, monto, numero_cotizacion,
    estado_cotizacion, cotizacion_version, fecha_cotizacion, etapa_seguimiento,
    archivado, fecha_archivado, fecha_cierre,
    created_at, updated_at, ultima_actividad_at
  )
  VALUES (
    p_ot.empresa_id, v_cliente, v_tel,
    nullif(btrim(v_dg->>'mail'), ''), nullif(btrim(v_dg->>'rut'), ''),
    nullif(btrim(v_dg->>'comuna'), ''), v_region,
    CASE WHEN v_canal IS NULL OR upper(v_canal) IN ('COTIZADOR','MANUAL') THEN 'manual' ELSE v_canal END,
    v_estado, p_ot.id, true, v_monto, v_num,
    v_est_cot, v_version, v_f_cot, v_etapa,
    v_archivado, v_f_arch, v_f_cierre,
    v_creado, now(), CASE WHEN p_relleno THEN coalesce(p_ot.fecha_modificacion, v_creado) ELSE now() END
  )
  RETURNING id INTO v_nuevo_id;

  INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por, created_at)
  VALUES (v_nuevo_id, p_ot.empresa_id, 'creado',
          jsonb_build_object('origen', 'ot', 'ot_id', p_ot.id, 'numero_ot', p_ot.numero_ot,
                             'relleno', p_relleno, 'fuente', v_canal),
          CASE WHEN p_relleno THEN NULL ELSE auth.uid() END,
          v_creado);
  RETURN v_nuevo_id;
END $fn$;

-- La OT cambió: monto, N°, contacto vacío y estado.
CREATE OR REPLACE FUNCTION leads_sync_desde_ot(p_ot ots, p_estado_antes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_dg      jsonb := coalesce(p_ot.datos_generales, '{}'::jsonb);
  v_num     text  := coalesce(nullif(btrim(v_dg->>'otDetallada'), ''),
                              nullif(nullif(btrim(p_ot.numero_ot), ''), 'OT'));
  v_monto   numeric := CASE WHEN coalesce(p_ot.total, 0) > 0 THEN p_ot.total END;
  l         leads;
  v_nombre  text; v_tel text; v_mail text; v_rut text; v_comuna text; v_region text;
  v_estado  text;
BEGIN
  FOR l IN SELECT * FROM leads WHERE ot_id = p_ot.id LOOP
    v_nombre := coalesce(nullif(btrim(l.nombre), ''), nullif(btrim(v_dg->>'cliente'), ''));
    v_tel    := coalesce(nullif(btrim(l.whatsapp_phone), ''), telefono_normalizado(v_dg->>'telefono'));
    v_mail   := coalesce(nullif(btrim(l.email), ''), nullif(btrim(v_dg->>'mail'), ''));
    v_rut    := coalesce(nullif(btrim(l.rut), ''), nullif(btrim(v_dg->>'rut'), ''));
    v_comuna := coalesce(nullif(btrim(l.comuna), ''), nullif(btrim(v_dg->>'comuna'), ''));
    v_region := coalesce(nullif(btrim(l.region), ''), nullif(btrim(v_dg->>'regionNombre'), ''));

    -- Solo si algo cambió: cada guardado del cotizador no debe generar un
    -- evento de tiempo real ni mover `updated_at`.
    IF coalesce(v_monto, l.monto) IS DISTINCT FROM l.monto
       OR coalesce(v_num, l.numero_cotizacion) IS DISTINCT FROM l.numero_cotizacion
       OR v_nombre IS DISTINCT FROM l.nombre
       OR v_tel    IS DISTINCT FROM l.whatsapp_phone
       OR v_mail   IS DISTINCT FROM l.email
       OR v_rut    IS DISTINCT FROM l.rut
       OR v_comuna IS DISTINCT FROM l.comuna
       OR v_region IS DISTINCT FROM l.region THEN
      UPDATE leads SET
        monto = coalesce(v_monto, monto),
        numero_cotizacion = coalesce(v_num, numero_cotizacion),
        nombre = v_nombre, whatsapp_phone = v_tel, email = v_mail,
        rut = v_rut, comuna = v_comuna, region = v_region
      WHERE id = l.id;
    END IF;

    IF p_estado_antes IS DISTINCT FROM p_ot.estado THEN
      IF p_ot.estado = 'esperando' THEN
        -- Pasó a «Esperando confirmación» = la cotización se envió (otra vez).
        PERFORM lead_cotizacion_aplicar(
          l.id,
          CASE WHEN l.cotizacion_version > 0 THEN 'actualizada' ELSE 'enviada' END,
          NULL, 'ot'
        );
      ELSE
        v_estado := lead_estado_desde_ot(p_ot.estado, l.estado);
        IF v_estado IS DISTINCT FROM l.estado THEN
          UPDATE leads SET estado = v_estado, ultima_actividad_at = now() WHERE id = l.id;
          INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
          VALUES (l.id, l.empresa_id, 'cambio_estado',
                  jsonb_build_object('de', l.estado, 'a', v_estado, 'origen', 'ot',
                                     'estado_ot', p_ot.estado, 'numero_ot', p_ot.numero_ot),
                  auth.uid());
        END IF;
      END IF;
    END IF;
  END LOOP;
END $fn$;

-- Trigger de alta y cambios. NUNCA bloquea la OT.
CREATE OR REPLACE FUNCTION trg_ots_lead_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(current_setting('app.lead_sync', true), '') = 'skip' THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM lead_desde_ot(NEW, false);
    ELSIF EXISTS (SELECT 1 FROM leads WHERE ot_id = NEW.id) THEN
      PERFORM leads_sync_desde_ot(NEW, OLD.estado);
    ELSE
      PERFORM lead_desde_ot(NEW, false);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ots → leads (OT %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $fn$;

DROP TRIGGER IF EXISTS trg_ots_lead_insert ON ots;
CREATE TRIGGER trg_ots_lead_insert AFTER INSERT ON ots
  FOR EACH ROW EXECUTE FUNCTION trg_ots_lead_fn();

DROP TRIGGER IF EXISTS trg_ots_lead_update ON ots;
CREATE TRIGGER trg_ots_lead_update AFTER UPDATE OF estado, total, numero_ot, datos_generales ON ots
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado
        OR OLD.total IS DISTINCT FROM NEW.total
        OR OLD.numero_ot IS DISTINCT FROM NEW.numero_ot
        OR OLD.datos_generales IS DISTINCT FROM NEW.datos_generales)
  EXECUTE FUNCTION trg_ots_lead_fn();

-- Se borra la OT: su fila se va con ella si nadie le hizo seguimiento. Corre
-- ANTES del borrado, cuando el lead todavía apunta a la OT.
CREATE OR REPLACE FUNCTION trg_ots_lead_borrar_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  BEGIN
    PERFORM set_config('app.lead_sync', 'skip', true);
    DELETE FROM leads l
     WHERE l.ot_id = OLD.id
       AND l.origen_ot
       AND NOT EXISTS (SELECT 1 FROM leads_seguimientos s WHERE s.lead_id = l.id);
    PERFORM set_config('app.lead_sync', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.lead_sync', '', true);
    RAISE WARNING 'ots → leads al borrar (OT %): %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END $fn$;

DROP TRIGGER IF EXISTS trg_ots_lead_delete ON ots;
CREATE TRIGGER trg_ots_lead_delete BEFORE DELETE ON ots
  FOR EACH ROW EXECUTE FUNCTION trg_ots_lead_borrar_fn();

-- Alguien borró la fila de una OT desde Clientes: esa OT queda omitida.
CREATE OR REPLACE FUNCTION trg_leads_omitir_ot_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.ot_id IS NOT NULL AND coalesce(current_setting('app.lead_sync', true), '') <> 'skip' THEN
    INSERT INTO leads_ot_omitidas (ot_id, empresa_id, omitida_por)
    VALUES (OLD.ot_id, OLD.empresa_id, auth.uid())
    ON CONFLICT (ot_id) DO NOTHING;
  END IF;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'leads → omitidas: %', SQLERRM;
  RETURN OLD;
END $fn$;

DROP TRIGGER IF EXISTS trg_leads_omitir_ot ON leads;
CREATE TRIGGER trg_leads_omitir_ot BEFORE DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_leads_omitir_ot_fn();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12) Enlazar un lead con su OT, sin duplicar
-- ─────────────────────────────────────────────────────────────────────────────
-- «Crear cotización» desde la ficha inserta la OT (el trigger ya puede haber
-- creado una fila) y recién después llama esto. Si quedó una fila automática
-- de esa OT, se funde en el lead real: su historial y seguimientos se mueven.
CREATE OR REPLACE FUNCTION lead_vincular_ot(p_lead_id uuid, p_ot_id uuid)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_empresa uuid := get_my_empresa_id();
  v_lead    leads;
  v_ot      ots;
  d         record;
  v_base    int;
BEGIN
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no encontrado', p_lead_id USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO v_ot FROM ots WHERE id = p_ot_id AND empresa_id = v_empresa;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OT % no encontrada', p_ot_id USING ERRCODE = 'P0002';
  END IF;

  FOR d IN SELECT id FROM leads WHERE ot_id = p_ot_id AND id <> p_lead_id AND origen_ot LOOP
    SELECT coalesce(max(n), 0) INTO v_base FROM leads_seguimientos WHERE lead_id = p_lead_id;
    UPDATE leads_seguimientos s SET lead_id = p_lead_id, n = v_base + x.rn
      FROM (SELECT id, row_number() OVER (ORDER BY n) AS rn
              FROM leads_seguimientos WHERE lead_id = d.id) x
     WHERE s.id = x.id;
    UPDATE leads_actividad SET lead_id = p_lead_id WHERE lead_id = d.id;
    PERFORM set_config('app.lead_sync', 'skip', true);
    DELETE FROM leads WHERE id = d.id;
    PERFORM set_config('app.lead_sync', '', true);
  END LOOP;

  IF v_lead.ot_id IS DISTINCT FROM p_ot_id THEN
    UPDATE leads SET
      ot_id = p_ot_id,
      estado = CASE
        WHEN estado = 'ganado' OR estado LIKE 'perdido%' THEN estado
        WHEN lead_estado_rango(estado) < lead_estado_rango('cotizando') THEN 'cotizando'
        ELSE estado
      END,
      ultima_actividad_at = now()
    WHERE id = p_lead_id;

    INSERT INTO leads_actividad (lead_id, empresa_id, tipo, detalle, registrado_por)
    VALUES (p_lead_id, v_lead.empresa_id, 'conversion_ot',
            jsonb_build_object('ot_id', p_ot_id, 'numero_ot', v_ot.numero_ot), auth.uid());
  END IF;

  PERFORM leads_sync_desde_ot(v_ot, v_ot.estado);

  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  RETURN v_lead;
END $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13) Permisos
-- ─────────────────────────────────────────────────────────────────────────────
-- Internas: nadie las llama desde la app.
REVOKE ALL ON FUNCTION lead_cotizacion_aplicar(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION lead_desde_ot(ots, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION leads_sync_desde_ot(ots, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_ots_lead_fn() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_ots_lead_borrar_fn() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_leads_omitir_ot_fn() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION trg_leads_actividad_ultima_fn() FROM PUBLIC, anon, authenticated;

-- Públicas: solo con sesión.
REVOKE ALL ON FUNCTION lead_cotizacion_estado(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lead_editar(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lead_asignar(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION registrar_seguimiento(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION lead_vincular_ot(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION nombres_perfiles_empresa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lead_cotizacion_estado(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION lead_editar(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION lead_asignar(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_seguimiento(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION lead_vincular_ot(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION nombres_perfiles_empresa() TO authenticated;
GRANT EXECUTE ON FUNCTION archivar_seguimientos_vencidos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION telefono_normalizado(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14) Relleno
-- ─────────────────────────────────────────────────────────────────────────────
-- A) Los seguimientos que ya estaban en las columnas seg1..3 → tabla, en orden.
INSERT INTO leads_seguimientos (lead_id, empresa_id, n, etapa, fecha, medio, resultado, nota, registrado_por, created_at)
SELECT s.lead_id, s.empresa_id,
       (row_number() OVER (PARTITION BY s.lead_id ORDER BY s.fecha))::smallint,
       s.etapa, s.fecha, NULL, s.resultado, NULL, NULL, s.fecha
FROM (
  SELECT id AS lead_id, empresa_id, 1::smallint AS etapa, seg1_fecha AS fecha, seg1_resultado AS resultado
    FROM leads WHERE seg1_fecha IS NOT NULL AND seg1_resultado IS NOT NULL
  UNION ALL
  SELECT id, empresa_id, 2::smallint, seg2_fecha, seg2_resultado
    FROM leads WHERE seg2_fecha IS NOT NULL AND seg2_resultado IS NOT NULL
  UNION ALL
  SELECT id, empresa_id, 3::smallint, seg3_fecha, seg3_resultado
    FROM leads WHERE seg3_fecha IS NOT NULL AND seg3_resultado IS NOT NULL
) s
WHERE s.resultado IN ('no_respondio','respondio','agendo_visita','cerro','no_interesado')
  AND NOT EXISTS (SELECT 1 FROM leads_seguimientos x WHERE x.lead_id = s.lead_id);

-- B) Una fila por cada OT con cliente que todavía no la tiene.
DO $$
DECLARE
  o     ots;
  v_ant int;
  v_des int;
BEGIN
  SELECT count(*) INTO v_ant FROM leads;
  PERFORM set_config('app.lead_sync', 'skip', true);  -- el relleno no dispara triggers de ots
  FOR o IN
    SELECT * FROM ots t
    WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.ot_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM leads_ot_omitidas x WHERE x.ot_id = t.id)
      AND (nullif(btrim(t.datos_generales->>'cliente'), '') IS NOT NULL
           OR telefono_normalizado(t.datos_generales->>'telefono') IS NOT NULL)
    ORDER BY t.fecha_creacion
  LOOP
    PERFORM lead_desde_ot(o, true);
  END LOOP;
  PERFORM set_config('app.lead_sync', '', true);
  SELECT count(*) INTO v_des FROM leads;
  RAISE NOTICE '14.B) filas nuevas desde OT: %', v_des - v_ant;
END $$;

-- C) La última actividad de cada lead (quién y qué) para la planilla.
UPDATE leads l SET
  ultima_actividad_por  = a.registrado_por,
  ultima_actividad_tipo = a.tipo
FROM (
  SELECT DISTINCT ON (lead_id) lead_id, registrado_por, tipo
  FROM leads_actividad
  ORDER BY lead_id, created_at DESC
) a
WHERE a.lead_id = l.id
  AND l.ultima_actividad_tipo IS NULL;

-- D) Los leads que ya habían llegado a «Cotizado» antes de esta columna: su
--    cotización se envió.
UPDATE leads SET
  estado_cotizacion  = 'enviada',
  cotizacion_version = greatest(cotizacion_version, 1)
WHERE estado_cotizacion = 'sin_enviar'
  AND fecha_cotizacion IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15) Nombres del Excel en las listas del engranaje de /ventas
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE kpi_config SET terreno = coalesce(terreno, '[]'::jsonb) || '["Lourdes"]'::jsonb
 WHERE NOT (coalesce(terreno, '[]'::jsonb) ? 'Lourdes');
UPDATE kpi_config SET vendedoras = coalesce(vendedoras, '[]'::jsonb) || '["María Fernanda"]'::jsonb
 WHERE NOT (coalesce(vendedoras, '[]'::jsonb) ? 'María Fernanda');

-- ─────────────────────────────────────────────────────────────────────────────
-- 16) Verificación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text[];
  v_dup    int;
  v_sin    int;
  v_resumen text;
BEGIN
  SELECT array_agg(f) INTO v_faltan
  FROM unnest(ARRAY[
    'public.telefono_normalizado(text)',
    'public.lead_estado_rango(text)',
    'public.lead_estado_desde_ot(text,text)',
    'public.lead_cotizacion_aplicar(uuid,text,text,text)',
    'public.lead_cotizacion_estado(uuid,text,text)',
    'public.lead_editar(uuid,jsonb)',
    'public.lead_asignar(uuid,uuid)',
    'public.registrar_seguimiento(uuid,text,text,text)',
    'public.lead_desde_ot(ots,boolean)',
    'public.leads_sync_desde_ot(ots,text)',
    'public.lead_vincular_ot(uuid,uuid)',
    'public.nombres_perfiles_empresa()',
    'public.archivar_seguimientos_vencidos(uuid)'
  ]) AS f
  WHERE to_regprocedure(f) IS NULL;
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan funciones: %', v_faltan;
  END IF;

  IF to_regprocedure('public.registrar_seguimiento(uuid,text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'Quedó la firma vieja de registrar_seguimiento: PostgREST no sabría cuál llamar';
  END IF;

  SELECT array_agg(t) INTO v_faltan
  FROM unnest(ARRAY['trg_ots_lead_insert','trg_ots_lead_update','trg_ots_lead_delete',
                    'trg_leads_seguimiento','trg_leads_omitir_ot','trg_leads_actividad_ultima']) AS t
  WHERE NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t AND NOT tgisinternal);
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan triggers: %', v_faltan;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_empresa_id_whatsapp_phone_key') THEN
    RAISE EXCEPTION 'Sigue el único de teléfono para todos los leads';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND tablename = 'leads') THEN
    RAISE EXCEPTION 'leads no quedó en la publicación de tiempo real';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.leads_seguimientos'::regclass) THEN
    RAISE EXCEPTION 'leads_seguimientos sin RLS';
  END IF;

  SELECT count(*) INTO v_dup FROM (
    SELECT ot_id FROM leads WHERE ot_id IS NOT NULL GROUP BY ot_id HAVING count(*) > 1
  ) x;
  IF v_dup > 0 THEN
    RAISE EXCEPTION '% OT quedaron con más de una fila', v_dup;
  END IF;

  SELECT count(*) INTO v_sin FROM ots t
  WHERE (nullif(btrim(t.datos_generales->>'cliente'), '') IS NOT NULL
         OR telefono_normalizado(t.datos_generales->>'telefono') IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.ot_id = t.id)
    AND NOT EXISTS (SELECT 1 FROM leads_ot_omitidas x WHERE x.ot_id = t.id);
  IF v_sin > 0 THEN
    RAISE EXCEPTION '% OT con cliente quedaron sin fila', v_sin;
  END IF;

  SELECT string_agg(estado || '=' || c, ', ' ORDER BY estado) INTO v_resumen
  FROM (SELECT estado, count(*) c FROM leads GROUP BY estado) x;
  RAISE NOTICE '=== Clientes 01 · LISTO. Leads por estado: % ===', v_resumen;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICACIÓN A MANO (después de correr)
-- ============================================================================
-- 1) Filas por origen y estado de la cotización:
--    SELECT origen_ot, estado_cotizacion, count(*) FROM leads GROUP BY 1,2 ORDER BY 1,2;
--
-- 2) Ninguna OT con dos filas (tiene que dar 0 filas):
--    SELECT ot_id, count(*) FROM leads WHERE ot_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--
-- 3) Teléfonos:
--    SELECT telefono_normalizado(' 9 3242 0128\t\t');   -- +56932420128
--
-- 4) El sync usa el índice (tiene que decir «idx_leads_ot»):
--    EXPLAIN SELECT * FROM leads WHERE ot_id = (SELECT id FROM ots LIMIT 1);
--
-- ============================================================================
-- REVERSA (copiar y correr entero; las columnas nuevas quedan)
-- ============================================================================
-- BEGIN;
--   DROP TRIGGER IF EXISTS trg_ots_lead_insert ON ots;
--   DROP TRIGGER IF EXISTS trg_ots_lead_update ON ots;
--   DROP TRIGGER IF EXISTS trg_ots_lead_delete ON ots;
--   DROP TRIGGER IF EXISTS trg_leads_omitir_ot ON leads;
--   DROP TRIGGER IF EXISTS trg_leads_actividad_ultima ON leads_actividad;
--   DROP FUNCTION IF EXISTS trg_ots_lead_fn();
--   DROP FUNCTION IF EXISTS trg_ots_lead_borrar_fn();
--   DROP FUNCTION IF EXISTS trg_leads_omitir_ot_fn();
--   DROP FUNCTION IF EXISTS trg_leads_actividad_ultima_fn();
--   DROP FUNCTION IF EXISTS lead_desde_ot(ots, boolean);
--   DROP FUNCTION IF EXISTS leads_sync_desde_ot(ots, text);
--   DROP FUNCTION IF EXISTS lead_cotizacion_estado(uuid, text, text);
--   DROP FUNCTION IF EXISTS lead_cotizacion_aplicar(uuid, text, text, text);
--   DROP FUNCTION IF EXISTS lead_editar(uuid, jsonb);
--   DROP FUNCTION IF EXISTS lead_asignar(uuid, uuid);
--   DROP FUNCTION IF EXISTS nombres_perfiles_empresa();
--   DROP FUNCTION IF EXISTS registrar_seguimiento(uuid, text, text, text);
--   -- recrear registrar_seguimiento(uuid, text, text) con el cuerpo de la
--   -- versión anterior (pg_get_functiondef antes de correr este archivo)
--   DELETE FROM leads WHERE origen_ot;
--   DROP TABLE IF EXISTS leads_seguimientos;
--   DROP TABLE IF EXISTS leads_ot_omitidas;
--   ALTER PUBLICATION supabase_realtime DROP TABLE leads;
--   -- el único de teléfono solo vuelve si no hay teléfonos repetidos:
--   -- ALTER TABLE leads ADD CONSTRAINT leads_empresa_id_whatsapp_phone_key UNIQUE (empresa_id, whatsapp_phone);
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
