-- ─────────────────────────────────────────────────────────────────────
-- BUCKET `visitas` — video, audio y firma de la visita a terreno
--
-- Fase 2 gana un informe de visita: el vendedor sube el video de la casa, se
-- transcribe el audio, Claude redacta el borrador del INFORME CLIENTE y el
-- cliente firma en pantalla. Esos tres archivos viven acá.
--
-- El bucket es PRIVADO a propósito: son grabaciones dentro de la casa de un
-- cliente y su firma. Nada de `getPublicUrl` — la app pide URL firmadas de una
-- hora (`urlFirmadaVisita` en src/modules/visita/visitaStore.ts).
--
-- La política es la misma que ya usa `inv-empresa-assets`: la PRIMERA carpeta
-- del path tiene que ser el empresa_id del usuario. Los paths que escribe la
-- app son `{empresa_id}/{ot_id}/video-…`, `audio-…` y `firma-…`.
--
-- Límite de 300 MB por archivo: un video de teléfono de ~10 minutos entra
-- holgado, y el audio que se transcribe pesa unos 2 MB por minuto.
--
-- Correr en el SQL Editor de Supabase.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('visitas', 'visitas', false, 314572800)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = GREATEST(
        COALESCE(storage.buckets.file_size_limit, 0), 314572800
      );

DROP POLICY IF EXISTS visitas_rw ON storage.objects;

CREATE POLICY visitas_rw ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'visitas'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  )
  WITH CHECK (
    bucket_id = 'visitas'
    AND (storage.foldername(name))[1] = get_user_empresa_id()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'visitas' AND public = false
  ) THEN
    RAISE EXCEPTION 'El bucket visitas quedó público: revisar antes de subir nada.';
  END IF;
  RAISE NOTICE 'Bucket visitas listo (privado, 300 MB, política por empresa).';
END $$;
