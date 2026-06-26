-- ============================================================================
-- INVESTIGACIÓN: ¿por qué se vació colmena_tubos? — 2026-06-16
-- Empresa: rolzzo (67c635a5-152c-4780-a066-23f5081175a9)
-- Estas son las consultas EXACTAS que se corrieron (solo lectura) para
-- llegar a la conclusión. Cada bloque incluye lo que devolvió.
-- ============================================================================


-- 1) ¿Está realmente vacía? → SÍ: 0 filas.
select count(*) as total from colmena_tubos;
-- Resultado: 0


-- 2) Buscar tablas relacionadas (¿hay auditoría / respaldo?).
--    → Aparece colmena_tubos_audit con 23.481 filas (registro de borrados).
select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I', table_name), false, true, '')))[1]::text::int as filas
from information_schema.tables
where table_schema = 'public'
  and (table_name ilike '%colmena%' or table_name ilike '%tubo%'
       or table_name ilike '%audit%' or table_name ilike '%log%')
order by table_name;
-- Resultado (relevante):
--   colmena_tubos          0
--   colmena_tubos_audit    23481   ← aquí está el rastro
--   colmena_sync_state     1


-- 3) ¿Qué columnas guarda la auditoría? (quién, cuándo, si había sync activo)
select column_name, data_type
from information_schema.columns
where table_name = 'colmena_tubos_audit'
order by ordinal_position;
-- Resultado: deleted_at, deleted_by_user, deleted_by_role, app_sync_active,
--            empresa_id, tubo_id, n_colmena, cod, medida_cm, payload (jsonb), ...


-- 4) LÍNEA DE TIEMPO de los borrados (el hallazgo clave).
--    Agrupa por minuto: cuántos tubos se borraron, si había sync activo y quién.
select date_trunc('minute', deleted_at) as minuto,
       count(*)                          as tubos_borrados,
       count(distinct n_colmena)         as colmenas,
       bool_or(app_sync_active)          as algun_sync_activo,
       array_agg(distinct deleted_by_role) as roles,
       array_agg(distinct deleted_by_user::text) as usuarios
from colmena_tubos_audit
group by 1
order by 1 desc
limit 20;
-- Resultado (top):
--   2026-06-16 15:58   163 tubos  13 colmenas  sync=true  user=3e15af80(gerencia)  ← el que vació
--   2026-06-16 14:13   161 tubos  11 colmenas  sync=true  user=3e15af80
--   2026-06-15 ...     ~160 tubos  sync=true   user=b50c682e(postventa)
--   ... (patrón normal: cada sync borra ~160 y reinserta ~160)


-- 5) Estado del último sync → coincide al segundo con el borrado de las 15:58.
select * from colmena_sync_state;
-- Resultado: last_sync_at = 2026-06-16 15:58:56  last_sync_by = 3e15af80


-- 6) ¿Quiénes son esos usuarios?
select id, email, last_sign_in_at from auth.users
where id in ('3e15af80-e157-44b5-a320-6775a9652e0c',
             'b50c682e-1dda-4ef9-a503-8c463a6837da');
-- Resultado:
--   3e15af80 → gerencia@cortinasrolzzo.cl   (hizo el sync que vació)
--   b50c682e → postventa@cortinasrolzzo.cl  (syncs normales previos)


-- 7) ¿Es recuperable? El payload guarda la fila completa → SÍ.
select count(*) as tubos, count(distinct n_colmena) as colmenas,
       min(deleted_at) as desde, max(deleted_at) as hasta
from colmena_tubos_audit
where deleted_at >= '2026-06-16 15:58:00+00'
  and deleted_at <  '2026-06-16 16:00:00+00';
-- Resultado: 163 tubos, 13 colmenas (todo en un solo batch a las 15:58:56)

select n_colmena, cod, medida_cm, payload
from colmena_tubos_audit
where deleted_at >= '2026-06-16 15:58:00+00'
order by deleted_at desc
limit 2;
-- Resultado: payload = {id, cod, medida_cm, medida_mm, n_colmena, serial,
--            disponible, empresa_id, tubo_raiz_id, ...}  → datos completos.


-- ============================================================================
-- CONCLUSIÓN
-- ----------------------------------------------------------------------------
-- La tabla la vació el SYNC del optimizador ("Guardar en BD") ejecutado por
-- gerencia@cortinasrolzzo.cl el 16-06 15:58, SIN el Excel de Colmenas cargado.
--
-- La función sync_colmena_tubos SIEMPRE borra todo y luego reinserta lo que
-- venga en p_tubos (ver sql/20260506q_sync_rpc_3_step.sql, líneas 78-95):
--
--     DELETE FROM colmena_tubos WHERE empresa_id = p_empresa_id;       -- borra todo
--     INSERT INTO colmena_tubos (...)
--     SELECT ... FROM jsonb_array_elements(p_tubos) AS t;              -- inserta lo que venga
--
-- Como p_tubos llegó vacío ([]), borró 163 y reinsertó 0. No hay ningún
-- chequeo que aborte el sync cuando p_tubos viene vacío (ese es el hueco).
--
-- NO fue borrado manual ni un bug que borre por su cuenta: fue un sync con
-- lista vacía. Los borrados de postventa en el historial son syncs normales
-- (borraban ~160 y reinsertaban ~160).
-- ============================================================================


-- ============================================================================
-- RESTAURACIÓN aplicada (16-06): reinsertó los 163 tubos desde la auditoría,
-- conservando sus IDs originales.
-- ============================================================================
-- insert into colmena_tubos (id, empresa_id, n_colmena, medida_mm, medida_cm,
--   cod, serial, disponible, agregado_por_admin, created_at, datos_extra, tubo_raiz_id)
-- select (payload->>'id')::uuid, (payload->>'empresa_id')::uuid,
--   payload->>'n_colmena', nullif(payload->>'medida_mm','')::numeric,
--   nullif(payload->>'medida_cm','')::numeric, payload->>'cod', payload->>'serial',
--   coalesce((payload->>'disponible')::boolean,true),
--   coalesce((payload->>'agregado_por_admin')::boolean,false),
--   coalesce((payload->>'created_at')::timestamptz, now()),
--   case when payload->'datos_extra' is null or payload->>'datos_extra'='null'
--        then null else payload->'datos_extra' end,
--   nullif(payload->>'tubo_raiz_id','')::uuid
-- from colmena_tubos_audit
-- where deleted_at >= '2026-06-16 15:58:00+00' and deleted_at < '2026-06-16 16:00:00+00'
-- on conflict (id) do nothing;


-- ============================================================================
-- ACTUALIZACIÓN — CRONOLOGÍA COMPLETA Y CAUSA RAÍZ (revisión 2)
-- Horas en UTC. La app muestra hora Chile = UTC − 4.
-- ============================================================================
--
-- 8) Cruce con los PLANES de corte (planes_corte) — los 3 correlativos del día:
--
--    select to_char(fecha,'HH24:MI') hora_utc,
--           jsonb_array_length(coalesce(ordenes,'[]'))    as ordenes,
--           jsonb_array_length(coalesce(resultados,'[]')) as resultados,
--           (ordenes->0->>'ot') as ot
--    from planes_corte
--    where empresa_id='67c635a5-152c-4780-a066-23f5081175a9'
--      and fecha >= '2026-06-16 14:00:00+00' and tipo is distinct from 'respaldo'
--    order by fecha;
--
--    Resultado:
--      15:05 UTC (11:05 CL) → CORR 41 · OT 3042 · 8 órdenes · 8 cortes  ✅
--      16:50 UTC (12:50 CL) → CORR 42 · OT 3052 · 8 órdenes · 0 cortes  ❌ (EN BLANCO)
--      17:39 UTC (13:39 CL) → CORR 43 · OT 3052 · 8 órdenes · 8 cortes  ✅ (post-restauración)
--
--    CLAVE: CORR 42 y CORR 43 son la MISMA OT (3052) con las MISMAS órdenes.
--    Una dio 0 cortes y la otra 8 → las órdenes NUNCA fueron el problema.
--    La única diferencia fue la colmena (vacía en 42, presente en 43).
--
-- ----------------------------------------------------------------------------
-- LÍNEA DE TIEMPO (16-06):
--   ayer 18:31  sync de postventa → 161 tubos cargados (estado sano nocturno)
--   11:05 CL    CORR 41 (OT 3042): colmena cargada (163) → 8 cortes  ✅
--   ~11:05–11:58 la colmena del optimizador quedó VACÍA en la sesión de
--               gerencia (al pasar a la OT 3052 / "SIN OPTIMIZAR LUISANNA",
--               la colmena dejó de estar cargada en memoria).
--   11:58 CL    se escribió esa colmena VACÍA a la BD → borró 163, insertó 0.
--   12:50 CL    CORR 42 (OT 3052): se generó con la colmena vacía → 0 cortes ❌
--   ~(restauración manual desde colmena_tubos_audit)
--   12:47 CL    re-sync de la colmena → 161 tubos (recarga)
--   13:39 CL    CORR 43 (OT 3052): mismas órdenes, ya con colmena → 8 cortes ✅
--
-- CAUSA RAÍZ (corrige la revisión 1):
--   El origen NO fue un botón puntual ni las órdenes. Fue que la COLMENA se
--   quedó VACÍA en el optimizador entre CORR 41 y CORR 42 (al cambiar de OT),
--   y ese estado vacío se guardó en la BD (11:58). Todo lo de "Guardar/Cargar
--   desde BD" vino después y fue intento de recuperación.
--
--   Detalle técnico que lo confirma: CORR 42 guardó snapshot_inventario=163
--   pero calculó 0 resultados → el motor de corte trabajó contra la colmena
--   vacía EN MEMORIA, aunque el snapshot capturó un número viejo (163).
--
-- NOTA: la BD solo registra ESCRITURAS (cuándo se guardó), no lo que se veía
--   en el navegador minuto a minuto. El instante exacto en que la colmena se
--   vació en memoria no queda en la BD; se infiere de que el sync de 11:58
--   escribió 0 y de que CORR 42 calculó 0 cortes.
--
-- RECOMENDACIÓN: candado que impida guardar/optimizar con la colmena vacía.
--   Habría cortado el problema en el paso de las 11:58 y evitado el CORR 42 en
--   blanco.
-- ============================================================================
-- Verificado post-restauración: 163 tubos, 13 colmenas.
