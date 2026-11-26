-- CAT LAB V5.0 cloud foundation. Apply once in a new Supabase project.
-- No demo users, no public order reads, and no real pigments in this file.
begin;
create table public.studio_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','staff')),
 active boolean not null default true
);
create function public.studio_has_role(wanted text[] default array['owner','staff']) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studio_members m where m.user_id=auth.uid() and m.active and m.role=any(wanted));
$$;
revoke all on function public.studio_has_role(text[]) from public;
grant execute on function public.studio_has_role(text[]) to authenticated;
create table public.studio_palette_versions (
 id uuid primary key default gen_random_uuid(),
 palette jsonb not null check(jsonb_typeof(palette)='array'),
 geometry jsonb not null check(jsonb_typeof(geometry)='object'),
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id)
);
create table public.studio_config (
 singleton boolean primary key default true check(singleton),
 active_version uuid not null references public.studio_palette_versions(id)
);
create table public.studio_orders (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 request_hash text not null,
 receipt text not null unique default ('CAT-'||upper(replace(gen_random_uuid()::text,'-',''))),
 palette_version uuid not null references public.studio_palette_versions(id),
 design jsonb not null,
 status text not null default '待確認' check(status in ('待確認','等待製作','製作中','品質檢查','已完成')),
 ref text not null default '' check(length(ref)<=80),
 note text not null default '' check(length(note)<=3000),
 assignee text not null default '' check(length(assignee)<=60),
 due date,
 checks jsonb not null default '{"left":[],"right":[]}'::jsonb,
 qc boolean not null default false,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'已完成' or qc)
);
create index studio_orders_created_idx on public.studio_orders(created_at desc);
create table public.studio_intake_rate (
 bucket text primary key, hits integer not null, reset_at timestamptz not null
);
alter table public.studio_members enable row level security;
alter table public.studio_palette_versions enable row level security;
alter table public.studio_config enable row level security;
alter table public.studio_orders enable row level security;
alter table public.studio_intake_rate enable row level security;
revoke all on public.studio_members,public.studio_palette_versions,public.studio_config,public.studio_orders,public.studio_intake_rate from anon,authenticated;
grant select(user_id,role,active) on public.studio_members to authenticated;
create policy studio_member_self on public.studio_members for select to authenticated using(user_id=auth.uid());
grant select on public.studio_orders to authenticated;
create policy studio_orders_read on public.studio_orders for select to authenticated using(public.studio_has_role());
grant select on public.studio_palette_versions,public.studio_config to authenticated;
create policy studio_palette_read on public.studio_palette_versions for select to authenticated using(public.studio_has_role(array['owner']));
create policy studio_config_read on public.studio_config for select to authenticated using(public.studio_has_role(array['owner']));
-- Only the server's service role may call this. No direct public table writes.
create function public.studio_submit(p_request uuid,p_hash text,p_version uuid,p_design jsonb,p_bucket text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior public.studio_orders%rowtype; n int; result_row public.studio_orders%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into prior from public.studio_orders where request_id=p_request;
 if found then
  if prior.request_hash<>p_hash then raise exception 'request_conflict'; end if;
  return jsonb_build_object('receipt',prior.receipt,'status',prior.status);
 end if;
 if not exists(select 1 from public.studio_config where singleton and active_version=p_version) then raise exception 'palette_changed'; end if;
 insert into public.studio_intake_rate(bucket,hits,reset_at) values(p_bucket,1,now()+interval '1 hour')
 on conflict(bucket) do update set hits=case when studio_intake_rate.reset_at<=now() then 1 else studio_intake_rate.hits+1 end,
 reset_at=case when studio_intake_rate.reset_at<=now() then now()+interval '1 hour' else studio_intake_rate.reset_at end returning hits into n;
 if n>10 then raise exception 'rate_limited'; end if;
 insert into public.studio_orders(request_id,request_hash,palette_version,design) values(p_request,p_hash,p_version,p_design) returning * into result_row;
 return jsonb_build_object('receipt',result_row.receipt,'status',result_row.status);
end $$;
revoke all on function public.studio_submit(uuid,text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.studio_submit(uuid,text,uuid,jsonb,text) to service_role;
-- Owner-only atomic publication of a new immutable palette/geometry version.
-- The server validates the complete palette before calling this service-only RPC.
create function public.studio_publish(p_actor uuid,p_palette jsonb,p_geometry jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if not exists(select 1 from public.studio_members where user_id=p_actor and active and role='owner') then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(470050);
 insert into public.studio_palette_versions(palette,geometry,created_by) values(p_palette,p_geometry,p_actor) returning id into v;
 insert into public.studio_config(singleton,active_version) values(true,v) on conflict(singleton) do update set active_version=excluded.active_version;
 return v;
end $$;
revoke all on function public.studio_publish(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studio_publish(uuid,jsonb,jsonb) to service_role;
-- Authenticated staff update operational fields only; original designs are never rewritten.
create function public.studio_update_order(p_id uuid,p_expected integer,p_status text,p_ref text,p_note text,p_assignee text,p_due date,p_checks jsonb,p_qc boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.studio_orders%rowtype;
begin
 if not public.studio_has_role() then raise exception 'forbidden'; end if;
 if p_status not in ('待確認','等待製作','製作中','品質檢查','已完成') or (p_status='已完成' and not p_qc) then raise exception 'invalid_status'; end if;
 if jsonb_typeof(p_checks)<>'object' or jsonb_typeof(p_checks->'left')<>'array' or jsonb_typeof(p_checks->'right')<>'array' or octet_length(p_checks::text)>16000 then raise exception 'invalid_checks'; end if;
 update public.studio_orders set status=p_status,ref=p_ref,note=p_note,assignee=p_assignee,due=p_due,checks=p_checks,qc=p_qc,revision=revision+1,updated_at=now()
 where id=p_id and revision=p_expected returning * into o;
 if not found then raise exception 'version_conflict'; end if;
 return to_jsonb(o);
end $$;
revoke all on function public.studio_update_order(uuid,integer,text,text,text,text,date,jsonb,boolean) from public,anon;
grant execute on function public.studio_update_order(uuid,integer,text,text,text,text,date,jsonb,boolean) to authenticated;
commit;
-- After creating the first user in Supabase Auth dashboard, manually insert its UUID:
-- insert into public.studio_members(user_id,role) values ('YOUR-AUTH-USER-UUID','owner');
-- Never grant owner role based on user-supplied metadata. Disable public Auth signups.
