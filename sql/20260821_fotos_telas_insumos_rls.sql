-- ─────────────────────────────────────────────────────────────────────
-- BUCKETS `fotos-telas` y `fotos-insumos` — la foto de la tela (y del insumo)
-- nunca se pudo subir: «new row violates row-level security policy»
--
-- Los dos buckets existen desde abril y tienen CERO objetos: cada intento de
-- subir una foto desde Telas → Catálogo → «Foto de la tela» (o Inventario →
-- foto del insumo) fallaba con ese mensaje, aunque el path que escribe la app
-- (`{empresa_id}/{codigo}_{timestamp}.{ext}`) cumple lo que piden las políticas.
--
-- Causa (reproducida el 2026-08-21 simulando al usuario en una transacción
-- revertida): la app sube con `upsert: true`, y Storage lo traduce a
-- `INSERT … ON CONFLICT DO UPDATE`. Con ese INSERT, Postgres exige que la fila
-- también pase una política de SELECT —y estos dos buckets no tienen ninguna
-- desde el hardening del 2026-06-10, que borró `public_read_fotos*` para que
-- nadie pudiera LISTAR los buckets completos—. El INSERT a secas pasa; el
-- INSERT … ON CONFLICT falla. Los buckets que sí funcionan (`visitas`,
-- `informe-assets`, `inv-empresa-assets`) tienen UNA política `FOR ALL`
-- acotada a la carpeta de la empresa, que incluye el SELECT.
--
-- Arreglo: la misma política única por bucket, acotada a la carpeta de la
-- empresa del usuario. Sigue sin poder listarse el bucket entero (el SELECT
-- solo ve la carpeta propia); la lectura pública por URL no pasa por RLS.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

-- fotos-telas ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS empresa_upload_fotos_telas ON storage.objects;
DROP POLICY IF EXISTS empresa_update_fotos_telas ON storage.objects;
DROP POLICY IF EXISTS empresa_delete_fotos_telas ON storage.objects;
DROP POLICY IF EXISTS fotos_telas_rw ON storage.objects;

CREATE POLICY fotos_telas_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'fotos-telas'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'fotos-telas'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

-- fotos-insumos ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS empresa_upload_fotos ON storage.objects;
DROP POLICY IF EXISTS empresa_update_fotos ON storage.objects;
DROP POLICY IF EXISTS empresa_delete_fotos ON storage.objects;
DROP POLICY IF EXISTS fotos_insumos_rw ON storage.objects;

CREATE POLICY fotos_insumos_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'fotos-insumos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'fotos-insumos'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

-- Verificación ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_faltan text[];
BEGIN
  SELECT array_agg(p) INTO v_faltan
  FROM unnest(ARRAY['fotos_telas_rw', 'fotos_insumos_rw']) AS p
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass AND polname = p
  );
  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan políticas: %', v_faltan;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname IN ('empresa_upload_fotos_telas', 'empresa_update_fotos_telas',
                      'empresa_delete_fotos_telas', 'empresa_upload_fotos',
                      'empresa_update_fotos', 'empresa_delete_fotos')
  ) THEN
    RAISE EXCEPTION 'Quedaron políticas viejas partidas: revisar.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'fotos-telas' AND public = true)
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'fotos-insumos' AND public = true) THEN
    RAISE EXCEPTION 'Los buckets de fotos tienen que seguir públicos para que las URL de las fotos abran.';
  END IF;
  RAISE NOTICE 'fotos-telas y fotos-insumos: una política por bucket, acotada a la carpeta de la empresa. Subir fotos ya funciona.';
END $$;
