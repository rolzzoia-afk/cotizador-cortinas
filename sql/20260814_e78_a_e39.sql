-- ─────────────────────────────────────────────────────────────────────
-- FUSIÓN E78 → E39: el tubo de 45 mm pasa a llamarse E39 en todos lados
--
-- Contexto: el mismo fierro (Ø45, esp 1,2, barra virgen 579 cm) tenía DOS
-- códigos: E39 (el de la gama B, dado de alta el 07-04) y E78 (el que se creó
-- el 14-07 para la banda 2,2–3,0 m de la línea A). Desde 2026-08-14 se usa uno
-- solo: E39. Este script mueve los datos y deja el E78 sin uso vivo.
--
-- Estado ANTES (medido 2026-08-17 contra la base):
--   insumos          E78: status OK, costo 0, sin proveedor ni foto
--                    E39: AGOTADO/DESCONTINUADO pero con la FICHA BUENA
--                         (TAMITEX, $6.960, foto, ubicación 2DA AV.)
--   colmena_tubos    E78: 12 barras                     · E39: 0
--   tubos_historial  E78: 113 eventos                   · E39: 0
--   errores_corte    E78: 0 filas
--   descuentos_modelo: 25 filas con 'E04; E05; E39; E46; E78'
--   configuracion:   catalogo_reemplazos_data · reglas_seleccion (18) ·
--                    reglas_seleccion_respaldos (18) ·
--                    opt_inventario_gerencia@… (32) · opt_colmena_final_gerencia@… (12)
--                    (los de postventa@ ya están limpios)
--
-- NO se tocan `planes_corte` (98 filas) ni `ots` (18): son historia congelada.
-- Por eso el código deja el E78 como tubo OCULTO en el catálogo, y esas OTs
-- conservan su rótulo.
--
-- ── OJO con el límite de palabra ────────────────────────────────────
-- En Postgres `\b` es el carácter BACKSPACE, no un límite de palabra: el
-- límite es `\y`. Todo este script usa `\yE78\y`, que además resuelve solo el
-- problema más delicado de acá: distingue los CÓDIGOS ("E78", 'tubo E78') de
-- los NOMBRES DE CAMPO persistidos —`usarTuboE78`, `requiereTuboE78`,
-- `bandaOscuridadE78`—, que NO se pueden renombrar porque viven en las OTs
-- guardadas y el código los sigue leyendo con ese nombre. En `usarTuboE78` no
-- hay límite entre la 'o' y la 'E', así que `\yE78\y` no lo toca. Tampoco toca
-- 'VE78' ni 'E789'.
--
-- Correr COMPLETO en el SQL Editor de Supabase (una sola transacción).
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- Para que el trigger anti-borrado-masivo de la colmena no bloquee el UPDATE.
SELECT set_config('app.sync_active', 'true', true);

-- ── 0. Respaldos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insumos_backup_20260814_e78 AS
  SELECT * FROM insumos WHERE cod IN ('E78', 'E39');
CREATE TABLE IF NOT EXISTS colmena_tubos_backup_20260814_e78 AS
  SELECT * FROM colmena_tubos WHERE cod = 'E78';
CREATE TABLE IF NOT EXISTS tubos_historial_backup_20260814_e78 AS
  SELECT * FROM tubos_historial WHERE cod = 'E78';
-- Respaldo AMPLIO de configuracion: además de los catálogos, las cachés de
-- trabajo del optimizador (opt_*), que también nombran el tubo.
CREATE TABLE IF NOT EXISTS configuracion_backup_20260814_e78 AS
  SELECT * FROM configuracion
   WHERE clave IN ('catalogo_reemplazos_data', 'reglas_seleccion',
                   'reglas_seleccion_respaldos', 'opt_version_minima')
      OR clave LIKE 'opt\_%';

-- ── 1. insumos: el E39 se queda con los datos VIVOS del E78 ─────────
-- El E39 tiene la ficha buena pero está AGOTADO/DESCONTINUADO porque nadie lo
-- compraba con ese nombre. Se reactiva y se le saca el sufijo "(GAMA B)": el
-- tubo ya no es exclusivo de la gama B, ahora lo usan las dos líneas.
UPDATE insumos
   SET status             = 'OK',
       estado_inventario  = NULL,
       nemotecnico        = 'TUBO .43 - ESP 1.2 (TUBO .45)',
       can_x_paquete      = GREATEST(COALESCE(can_x_paquete, 0), 1),
       comentarios        = COALESCE(NULLIF(comentarios, '') || ' · ', '') ||
                            'Unificado con E78 el 2026-08-14 (mismo tubo Ø45 esp 1,2).',
       updated_at         = now()
 WHERE cod = 'E39';

UPDATE insumos
   SET status            = 'AGOTADO',
       estado_inventario = 'DESCONTINUADO',
       comentarios       = COALESCE(NULLIF(comentarios, '') || ' · ', '') ||
                           'Renombrado a E39 el 2026-08-14: no usar.',
       updated_at        = now()
 WHERE cod = 'E78';

-- ── 2. colmena_tubos: las 12 barras físicas pasan a E39 ─────────────
-- Es el MISMO fierro en bodega, solo cambia la etiqueta del código.
UPDATE colmena_tubos SET cod = 'E39' WHERE cod = 'E78';

-- ── 3. tubos_historial: los 113 eventos siguen a sus barras ─────────
UPDATE tubos_historial SET cod = 'E39' WHERE cod = 'E78';

-- ── 4. errores_corte: códigos original / reemplazo ──────────────────
-- Hoy son 0 filas; queda por si se corre el script más adelante.
UPDATE errores_corte SET cod_original  = 'E39' WHERE cod_original  = 'E78';
UPDATE errores_corte SET reemplazo_cod = 'E39' WHERE reemplazo_cod = 'E78';

-- ── 5. descuentos_modelo: E78 → E39 en la lista, sin duplicar ───────
-- Las 25 filas traen 'E04; E05; E39; E46; E78' y el E39 ya está: se renombra
-- el token y se deduplica conservando el ORDEN original.
UPDATE descuentos_modelo d
   SET codigos_tubo = (
     SELECT string_agg(cod, '; ' ORDER BY orden)
       FROM (
         SELECT DISTINCT ON (cod) cod, orden
           FROM (
             SELECT btrim(regexp_replace(t, '\yE78\y', 'E39', 'g')) AS cod, o AS orden
               FROM unnest(string_to_array(d.codigos_tubo, ';')) WITH ORDINALITY AS u(t, o)
           ) tokens
          WHERE cod <> ''
          ORDER BY cod, orden
       ) unicos
   )
 WHERE d.codigos_tubo ~ '\yE78\y';

-- ── 6. catalogo_reemplazos_data (lo que lee el optimizador) ─────────
-- Es un RENOMBRE, no una baja:
--   · colores/medidas: se asegura la entrada E39 (ya existe: Aluminio / 579) y
--     se borra la del E78.
--   · accesorios: la llave es el nemotécnico del Excel maestro. NO se borra —
--     se REAPUNTA a E39, así los Excel viejos que traen
--     'TUBO 43MM(ESP1.2)(5.8)' siguen resolviendo, ahora al código que queda.
--   · reemplazos: E04 y E05 listaban 'E78' como sustituto VÁLIDO. Borrarlo
--     perdería esa sustitución, así que se renombra a E39; se fusionan llaves
--     que colisionen, se deduplica y se quita la auto-referencia que deja el
--     propio E78 (que ya listaba a E39).
WITH origen AS (
  SELECT id, valor::jsonb AS d
    FROM configuracion
   WHERE clave = 'catalogo_reemplazos_data' AND valor ~ '\yE78\y'
),
pares AS (
  SELECT o.id,
         regexp_replace(k,          '\yE78\y', 'E39', 'g') AS cod,
         regexp_replace(v #>> '{}', '\yE78\y', 'E39', 'g') AS lista
    FROM origen o, LATERAL jsonb_each(o.d->'catalogoReemplazos') AS e(k, v)
),
fusion AS (  -- si el renombre choca con una llave E39 preexistente, se unen
  SELECT id, cod, string_agg(lista, '; ') AS lista FROM pares GROUP BY id, cod
),
limpio AS (  -- dedup por token, sin auto-referencia, conservando el orden
  SELECT f.id, f.cod,
         (SELECT string_agg(x, '; ' ORDER BY o)
            FROM (SELECT DISTINCT ON (btrim(t)) btrim(t) AS x, o
                    FROM unnest(string_to_array(f.lista, ';')) WITH ORDINALITY AS u(t, o)
                   WHERE btrim(t) <> '' AND btrim(t) <> f.cod
                   ORDER BY btrim(t), o) s) AS lista
    FROM fusion f
),
reemplazos AS (
  SELECT id, jsonb_object_agg(cod, lista) AS j FROM limpio WHERE lista IS NOT NULL GROUP BY id
),
accesorios AS (
  SELECT o.id, jsonb_object_agg(k, to_jsonb(regexp_replace(v #>> '{}', '\yE78\y', 'E39', 'g'))) AS j
    FROM origen o, LATERAL jsonb_each(o.d->'catalogoAccesorios') AS e(k, v)
   GROUP BY o.id
),
nuevo AS (
  SELECT o.id,
         (o.d || jsonb_build_object(
            'catalogoColores',
              ((o.d->'catalogoColores') || jsonb_build_object('E39',
                 COALESCE(o.d->'catalogoColores'->'E39', o.d->'catalogoColores'->'E78'))) - 'E78',
            'catalogoMedidas',
              ((o.d->'catalogoMedidas') || jsonb_build_object('E39',
                 COALESCE(o.d->'catalogoMedidas'->'E39', o.d->'catalogoMedidas'->'E78'))) - 'E78',
            'catalogoAccesorios', COALESCE(a.j, o.d->'catalogoAccesorios'),
            'catalogoReemplazos', COALESCE(r.j, '{}'::jsonb)
          ))::text AS valor
    FROM origen o
    LEFT JOIN accesorios a ON a.id = o.id
    LEFT JOIN reemplazos r ON r.id = o.id
)
UPDATE configuracion c SET valor = n.valor FROM nuevo n WHERE c.id = n.id;

-- ── 7. reglas_seleccion (+ sus respaldos): override guardado ────────
-- El catálogo guardado REEMPLAZA al de fábrica, así que si acá queda el E78
-- activo el tubo nuevo no se ve. `\yE78\y` cambia los códigos ("tubo":"E78",
-- tubos45mm, codigoPorDiametro, {"codigo":"E78"}) y los textos visibles
-- ("tubo E78", "Tubo E78 activado"), y DEJA INTACTOS los nombres de campo
-- usarTuboE78 / requiereTuboE78 / bandaOscuridadE78.
-- Los respaldos se migran también: si el usuario restaura uno, no debe
-- resucitar el código viejo.
-- La entrada de fábrica del E78 (estado 'oculto') se repone sola al leer, por
-- la regla de "reponer lo que el catálogo de fábrica nombra como oculto".
UPDATE configuracion
   SET valor = replace(
                 regexp_replace(valor, '\yE78\y', 'E39', 'g'),
                 'E39 - TUBO 43MM(ESP1.2)(5.8)',
                 'E39 - TUBO .43 - ESP 1.2 (TUBO .45)'
               )
 WHERE clave IN ('reglas_seleccion', 'reglas_seleccion_respaldos')
   AND valor ~ '\yE78\y';

-- ── 8. Cachés de trabajo del optimizador ────────────────────────────
-- `opt_colmena_final_<usuario>` es el punto de restauración de la colmena y
-- `opt_inventario_<usuario>` es el SistemaInventario serializado (inventario +
-- catálogos + log). Si la tabla queda en E39 y estas cachés en E78, el
-- optimizador restaura una foto que ya no calza con la bodega — que es
-- exactamente el patrón del incidente de caché stale. Se migran en el mismo
-- movimiento. (Hoy solo gerencia@ las tiene con E78; postventa@ ya está
-- limpio. El filtro es genérico para cubrir usuarios nuevos.)
UPDATE configuracion
   SET valor = regexp_replace(valor, '\yE78\y', 'E39', 'g')
 WHERE clave LIKE 'opt\_%'
   AND valor ~ '\yE78\y';

-- ── 9. Versión mínima del optimizador (estaba en 5.12) ──────────────
-- v5.22: perforación en el plan de corte + órdenes directas desde la app +
-- el tubo de 45 mm como E39.
UPDATE configuracion SET valor = '5.22' WHERE clave = 'opt_version_minima';

-- ── 10. Verificación (aborta si algo quedó a medias) ────────────────
DO $$
DECLARE
  n_colmena   int;
  n_hist      int;
  n_errores   int;
  n_modelos   int;
  n_config    int;
  n_e39_ok    int;
  claves_mal  text;
BEGIN
  SELECT count(*) INTO n_colmena FROM colmena_tubos   WHERE cod = 'E78';
  SELECT count(*) INTO n_hist    FROM tubos_historial WHERE cod = 'E78';
  SELECT count(*) INTO n_errores FROM errores_corte
   WHERE cod_original = 'E78' OR reemplazo_cod = 'E78';
  SELECT count(*) INTO n_modelos FROM descuentos_modelo WHERE codigos_tubo ~ '\yE78\y';

  -- En configuracion se admite el E78 SOLO dentro de los nombres de campo
  -- (usarTuboE78 y compañía): por eso el chequeo va con \y, no con LIKE.
  SELECT count(*), string_agg(clave, ', ') INTO n_config, claves_mal
    FROM configuracion WHERE valor ~ '\yE78\y';

  SELECT count(*) INTO n_e39_ok FROM insumos WHERE cod = 'E39' AND status = 'OK';

  IF n_colmena > 0 OR n_hist > 0 OR n_errores > 0 OR n_modelos > 0 OR n_config > 0 THEN
    RAISE EXCEPTION 'Quedó E78 vivo — colmena:% historial:% errores:% modelos:% config:% (%)',
      n_colmena, n_hist, n_errores, n_modelos, n_config, COALESCE(claves_mal, '-');
  END IF;
  IF n_e39_ok <> 1 THEN
    RAISE EXCEPTION 'El insumo E39 no quedó activo (filas OK: %)', n_e39_ok;
  END IF;

  RAISE NOTICE 'E78 → E39 OK: colmena, historial, modelos, catálogos y cachés migrados.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Comprobación a ojo (después del COMMIT):
--   SELECT cod, count(*) FROM colmena_tubos WHERE cod IN ('E39','E78') GROUP BY 1;
--   SELECT cod, status, nemotecnico FROM insumos WHERE cod IN ('E39','E78');
--
-- OJO: re-importar el Excel maestro de insumos puede volver a crear la fila
-- E78 (ya pasó cuando se dio de alta). Si reaparece, basta con volver a
-- correr el paso 1 — las barras físicas ya viven como E39.
--
-- `planes_corte` (98 filas) y `ots` (18) siguen nombrando el E78 a propósito:
-- son historia, y el catálogo conserva el E78 como entrada oculta para que
-- esas OTs mantengan su rótulo.
--
-- Para revertir: las tablas *_backup_20260814_e78 tienen el estado previo.
-- ─────────────────────────────────────────────────────────────────────
