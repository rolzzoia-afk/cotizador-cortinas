-- ─────────────────────────────────────────────────────────────────────
-- Catálogo técnico editable: la APP manda sobre el Excel maestro.
-- 2026-08-04
--
-- PROBLEMA: `importar_descuentos_modelo` borra TODA la tabla de la empresa
-- y reinserta lo que trae el Excel. Cada vez que alguien re-importa se
-- pierden las filas que se mantienen a mano — ya pasó con el tubo E78
-- (sql/20260714_alta_tubo_e78.sql), con la VERTICAL
-- (sql/20260721_alta_vertical_descuentos.sql) y con la pletina. Los propios
-- scripts avisan "si re-importás, volvé a correr esto".
--
-- SOLUCIÓN: una columna `origen` con dos valores.
--   'excel'  → la fila vino del Excel maestro; el import la reemplaza.
--   'manual' → la fila se creó o se editó desde Admin → Catálogo técnico;
--              el import NO la toca nunca más.
-- Si el Excel trae una fila con la misma clave (sistema|tipo_rol|mecanismo)
-- que una manual, gana la manual y la del Excel se descarta: eso es lo que
-- significa "la app manda".
--
-- Correr en el SQL Editor de Supabase. Es idempotente.
-- ─────────────────────────────────────────────────────────────────────

-- ── 1. La columna ──
alter table public.descuentos_modelo
  add column if not exists origen text not null default 'excel';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'descuentos_modelo_origen_chk'
  ) then
    alter table public.descuentos_modelo
      add constraint descuentos_modelo_origen_chk check (origen in ('excel', 'manual'));
  end if;
end $$;

comment on column public.descuentos_modelo.origen is
  'excel = la reemplaza el import del Excel maestro; manual = editada en Admin, el import la respeta.';

-- ── 2. Proteger lo que hoy se mantiene a mano ──
-- Son las filas que los scripts anteriores pedían volver a aplicar después
-- de cada import. Al marcarlas 'manual' dejan de perderse.
--
-- (a) La VERTICAL: no existe en el Excel maestro, se dio de alta por SQL.
update public.descuentos_modelo set origen = 'manual'
where sistema = 'VERTICAL' and origen = 'excel';

-- (b) Las 45 mm que llevan el tubo E78 en codigos_tubo (alta 2026-07-14).
--     El Excel maestro todavía trae la lista vieja sin E78.
update public.descuentos_modelo set origen = 'manual'
where codigos_tubo ilike '%E78%' and origen = 'excel';

-- (c) Pletina roller y dúo: sus descuentos se ajustaron a mano (PR #200).
update public.descuentos_modelo set origen = 'manual'
where sistema in ('PLETINA_ROLLER', 'PLETINA_DUO') and origen = 'excel';

-- ── 3. La RPC nueva ──
-- Igual que la v1 salvo que respeta las filas manuales, y devuelve cuántas
-- protegió y cuántas filas del Excel se descartaron por colisión.
create or replace function public.importar_descuentos_modelo_v2(p_filas jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_empresa uuid;
  v_antes int;
  v_protegidas int;
  v_insertadas int;
  v_entrantes int;
begin
  if not is_admin() then
    raise exception 'Solo administradores pueden importar el catálogo de descuentos.'
      using errcode = 'P0009';
  end if;
  v_empresa := get_my_empresa_id();
  if v_empresa is null then
    raise exception 'Sin empresa.' using errcode = 'P0002';
  end if;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'No hay filas para importar.' using errcode = 'P0001';
  end if;

  select count(*) into v_antes from descuentos_modelo where empresa_id = v_empresa;
  select count(*) into v_protegidas
    from descuentos_modelo where empresa_id = v_empresa and origen = 'manual';

  -- Solo lo que vino del Excel se reemplaza.
  delete from descuentos_modelo where empresa_id = v_empresa and origen = 'excel';

  insert into descuentos_modelo (
    empresa_id, sistema, tipo_rol, mecanismo, codigos_tubo, diametro_tubo_mm,
    dcto_tubo_cm, dcto_tela_cm, suma_peso_cm, dcto_cenefa_cm, dcto_cenefa_del_cm,
    dcto_cenefa_tra_cm, dcto_perfiles_cm, peso_interno_duo_cm, peso_u_duo_cm,
    ancho_max_m, activo, notas, origen)
  select v_empresa,
         f->>'sistema', f->>'tipo_rol', coalesce(f->>'mecanismo',''),
         coalesce(f->>'codigos_tubo',''),
         coalesce((f->>'diametro_tubo_mm')::numeric, 0),
         coalesce((f->>'dcto_tubo_cm')::numeric, 0),
         coalesce((f->>'dcto_tela_cm')::numeric, 0),
         coalesce((f->>'suma_peso_cm')::numeric, 0),
         coalesce((f->>'dcto_cenefa_cm')::numeric, 0),
         coalesce((f->>'dcto_cenefa_del_cm')::numeric, 0),
         coalesce((f->>'dcto_cenefa_tra_cm')::numeric, 0),
         coalesce((f->>'dcto_perfiles_cm')::numeric, 0),
         coalesce((f->>'peso_interno_duo_cm')::numeric, 0),
         coalesce((f->>'peso_u_duo_cm')::numeric, 0),
         coalesce((f->>'ancho_max_m')::numeric, 0),
         coalesce((f->>'activo')::boolean, true),
         coalesce(f->>'notas',''),
         'excel'
  from jsonb_array_elements(p_filas) f
  where coalesce(f->>'sistema','') <> ''
    and coalesce(f->>'tipo_rol','') <> ''
    -- La fila manual gana: si ya existe esa clave editada en la app, la del
    -- Excel se descarta.
    and not exists (
      select 1 from descuentos_modelo d
      where d.empresa_id = v_empresa
        and d.origen = 'manual'
        and d.sistema = f->>'sistema'
        and d.tipo_rol = f->>'tipo_rol'
        and d.mecanismo = coalesce(f->>'mecanismo','')
    );

  get diagnostics v_insertadas = row_count;
  select count(*) into v_entrantes
    from jsonb_array_elements(p_filas) f
    where coalesce(f->>'sistema','') <> '' and coalesce(f->>'tipo_rol','') <> '';

  return jsonb_build_object(
    'antes', v_antes,
    'importadas', v_insertadas,
    'protegidas', v_protegidas,
    'omitidas', v_entrantes - v_insertadas
  );
end;
$function$;

grant execute on function public.importar_descuentos_modelo_v2(jsonb) to authenticated;

-- ── Verificación ──
select origen, count(*) as filas
from public.descuentos_modelo
where empresa_id = '67c635a5-152c-4780-a066-23f5081175a9'
group by origen order by origen;
-- Esperado hoy: manual ≈ 28 (1 vertical + 25 con E78 + 2 pletina) · excel ≈ 39.

-- ── Reversa ──
-- drop function if exists public.importar_descuentos_modelo_v2(jsonb);
-- alter table public.descuentos_modelo drop constraint if exists descuentos_modelo_origen_chk;
-- alter table public.descuentos_modelo drop column if exists origen;
