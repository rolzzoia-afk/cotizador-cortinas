-- ─────────────────────────────────────────────────────────────────────
-- Realtime para la COLMENA DE TUBERÍA (2026-08-03)
--
-- La vista /historial-tubos → Colmena muestra en vivo qué hay en cada
-- ubicación: cuando el optimizador consume un tubo o deja un sobrante, el
-- estante se actualiza solo. Eso necesita que las tablas estén en la
-- publicación `supabase_realtime`.
--
-- HALLAZGO: hoy la publicación solo tiene `ots`, `telas` y `colmena_panos`.
-- `colmena_tubos` NUNCA estuvo, así que el canal `admin-tubos` del Panel de
-- Administrador (que existe desde hace meses) jamás recibió un evento: su
-- tabla parecía "en vivo" pero solo se refrescaba al entrar a la página.
--
-- Correr en el SQL Editor de Supabase. Es idempotente: si la tabla ya está
-- publicada, el bloque no hace nada.
-- ─────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'colmena_tubos'
  ) then
    alter publication supabase_realtime add table public.colmena_tubos;
  end if;
end $$;

-- Panel de "movimientos recientes" de la misma vista: los eventos de corte,
-- sobrante, merma e ingreso. Sin esto el panel igual se refresca (lo arrastra
-- el canal de colmena_tubos), pero los eventos que NO tocan el stock —una
-- merma ya descontada, por ejemplo— tardarían hasta el próximo refresco.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tubos_historial'
  ) then
    alter publication supabase_realtime add table public.tubos_historial;
  end if;
end $$;

-- Verificación:
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' order by tablename;
-- Debe listar: colmena_panos · colmena_tubos · ots · telas · tubos_historial
