-- V5.4 curated presets, immutable releases. No customer photo storage.
begin;
create table public.studio_preset_versions (
 revision integer primary key check(revision>0),
 presets jsonb not null check(jsonb_typeof(presets)='array' and jsonb_array_length(presets)<=40),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null
);
alter table public.studio_preset_versions enable row level security;
revoke all on public.studio_preset_versions from public,anon,authenticated,service_role;
grant select,insert on public.studio_preset_versions to service_role;
grant select(user_id,role,active) on public.studio_members to service_role;
insert into public.studio_preset_versions(revision,presets) values(1,'[]'::jsonb);
create function public.studio_publish_presets(p_actor uuid,p_expected integer,p_presets jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v integer; row_data public.studio_preset_versions%rowtype;
begin
 if not exists(select 1 from public.studio_members where user_id=p_actor and active and role='owner') then raise exception 'forbidden'; end if;
 if p_expected is null or p_presets is null or jsonb_typeof(p_presets)<>'array' then raise exception 'preset_invalid'; end if;
 if jsonb_array_length(p_presets)>40 then raise exception 'preset_invalid'; end if;
 perform pg_catalog.pg_advisory_xact_lock(731289,540);
 select max(revision) into v from public.studio_preset_versions;
 if v is null or v<>p_expected then raise exception 'preset_version_conflict'; end if;
 insert into public.studio_preset_versions(revision,presets,created_by) values(v+1,p_presets,p_actor) returning * into row_data;
 return jsonb_build_object('configured',true,'revision',row_data.revision,'presets',row_data.presets,'createdAt',row_data.created_at);
end $$;
revoke all on function public.studio_publish_presets(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.studio_publish_presets(uuid,integer,jsonb) to service_role;
commit;
