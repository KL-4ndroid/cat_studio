-- CAT LAB V5.1.2 production rules. Apply once after studio_v50.sql.
-- Additive migration; no existing orders, palette, or photos are changed.
begin;
create table public.studio_production_rules (
 revision integer primary key check(revision>0),
 rules jsonb not null check(jsonb_typeof(rules)='object'),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id) on delete set null
);
alter table public.studio_production_rules enable row level security;
revoke all on public.studio_production_rules from public,anon,authenticated,service_role;
grant select,insert on public.studio_production_rules to service_role;
-- The publishing RPC checks membership using the server role only.
grant select(user_id,role,active) on public.studio_members to service_role;
insert into public.studio_production_rules(revision,rules)
values (1,'{"widthMm":10.339,"thinMm":0.35,"smallMm":0.55,"colors":5,"strokes":20,"detailColors":7,"detailStrokes":50,"minCoverage":90,"gradientReview":true,"tabbyReview":true}'::jsonb);
-- Service-role only. API validates the exact rules schema and verifies the caller.
-- Recheck active owner membership and optimistic revision in the transaction.
create function public.studio_publish_rules(p_actor uuid,p_expected integer,p_rules jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_revision integer; row_data public.studio_production_rules%rowtype;
begin
 if not exists(select 1 from public.studio_members where user_id=p_actor and active and role='owner') then raise exception 'forbidden'; end if;
 if p_expected is null or p_rules is null or jsonb_typeof(p_rules)<>'object' then raise exception 'invalid_rules'; end if;
 perform pg_catalog.pg_advisory_xact_lock(731289,512);
 select max(revision) into current_revision from public.studio_production_rules;
 if current_revision is null or p_expected<>current_revision then raise exception 'rules_version_conflict'; end if;
 insert into public.studio_production_rules(revision,rules,created_by)
 values(current_revision+1,p_rules,p_actor) returning * into row_data;
 return jsonb_build_object('configured',true,'revision',row_data.revision,'rules',row_data.rules,'createdAt',row_data.created_at);
end $$;
revoke all on function public.studio_publish_rules(uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.studio_publish_rules(uuid,integer,jsonb) to service_role;
commit;
