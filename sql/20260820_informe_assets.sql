-- ─────────────────────────────────────────────────────────────────────
-- BUCKET `informe-assets` — las fotos referenciales del INFORME CLIENTE
--
-- El correo de COTIZACIÓN FINAL que la empresa manda a mano intercala fotos
-- con el texto: la duo blackout a contraluz después de «te dejo una foto
-- referencial», y la ficha de la tela en cada habitación. Ahora esas fotos se
-- cargan en Admin (pasos de luz, bloques del final y ficha por código de tela)
-- y viajan pegadas al informe.
--
-- PÚBLICO a propósito, al revés que `visitas`:
--   · Terminan como `<img src>` DENTRO de un correo que abre el cliente en su
--     casa. Una URL firmada se vence a la hora y deja el correo con la foto
--     rota — justo cuando el cliente lo va a leer.
--   · No son datos de nadie: son fotos de producto, las mismas que hoy se
--     adjuntan a mano desde el catálogo de la empresa.
-- Lo que SÍ es privado (video, firma, fotos de la casa del cliente) sigue en el
-- bucket `visitas`, que es privado y se lee con URL firmada.
--
-- ESCRIBIR sí está restringido: la primera carpeta del path tiene que ser el
-- empresa_id del usuario, igual que `inv-empresa-assets`, `fotos-telas` y
-- `visitas`. Los paths que escribe la app son
-- `{empresa_id}/{grupo}/{timestamp}-{aleatorio}.{ext}` — ver
-- src/modules/visita/informeAssetsStore.ts.
--
-- 5 MB por archivo: la app las comprime a 1920 px / JPEG 0,85 antes de subir,
-- así que una foto de teléfono queda muy por debajo. Mismo límite que los otros
-- buckets de imágenes.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'informe-assets', 'informe-assets', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = GREATEST(COALESCE(storage.buckets.file_size_limit, 0), 5242880),
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS informe_assets_rw ON storage.objects;

-- Solo escritura: la LECTURA la resuelve el bucket público, sin pasar por RLS.
CREATE POLICY informe_assets_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'informe-assets'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'informe-assets'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'informe-assets' AND public = true
  ) THEN
    RAISE EXCEPTION 'El bucket informe-assets quedó privado: las fotos del correo saldrían rotas.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass AND polname = 'informe_assets_rw'
  ) THEN
    RAISE EXCEPTION 'Falta la política informe_assets_rw: cualquiera podría escribir en el bucket.';
  END IF;
  RAISE NOTICE 'Bucket informe-assets listo (público para leer, escritura por empresa, 5 MB).';
END $$;
