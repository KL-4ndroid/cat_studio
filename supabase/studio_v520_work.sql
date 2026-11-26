-- V5.2.0: additive production labor tracking; apply after studio_v50.sql.
-- Server time only. Each worker may have one running or paused session.
begin;
create table public.studio_work_sessions (
 id uuid primary key,
 order_id uuid not null references public.studio_orders(id) on delete restrict,
 worker_id uuid not null references auth.users(id) on delete restrict,
 phase text not null check(phase in ('準備','調色','上色','封層','組裝','品檢','包裝','重做')),
 state text not null default 'running' check(state in ('running','paused','finished')),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),
 finished_at timestamptz,
 check((state='finished')=(finished_at is not null))
);
create unique index studio_work_one_open on public.studio_work_sessions(worker_id) where state<>'finished';
create index studio_work_order_idx on public.studio_work_sessions(order_id);
create table public.studio_work_intervals (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.studio_work_sessions(id) on delete restrict,
 started_at timestamptz not null,
 ended_at timestamptz,
 check(ended_at is null or ended_at>=started_at)
);
create unique index studio_work_one_interval on public.studio_work_intervals(session_id) where ended_at is null;
create index studio_work_interval_time on public.studio_work_intervals(started_at,ended_at);
create index studio_work_interval_session on public.studio_work_intervals(session_id);
alter table public.studio_work_sessions enable row level security;
alter table public.studio_work_intervals enable row level security;
revoke all on public.studio_work_sessions,public.studio_work_intervals from public,anon,authenticated,service_role;
grant select,insert,update on public.studio_work_sessions,public.studio_work_intervals to service_role;
grant select(user_id,role,active) on public.studio_members to service_role;
grant select(id,status,receipt) on public.studio_orders to service_role;

create function public.studio_work_command(p_actor uuid,p_order uuid,p_session uuid,p_expected integer,p_action text,p_phase text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.studio_work_sessions%rowtype; t timestamptz;
begin
 if not exists(select 1 from public.studio_members where user_id=p_actor and active and role in ('owner','staff')) then raise exception 'forbidden'; end if;
 if p_action is null or p_action not in ('start','pause','resume','finish') or p_session is null or p_order is null then raise exception 'work_invalid'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('studio-work:'||p_actor::text,0));
 t:=pg_catalog.clock_timestamp();
 select * into s from public.studio_work_sessions where id=p_session;
 if p_action='start' then
  if p_expected is distinct from 0 or p_phase is null or p_phase not in ('準備','調色','上色','封層','組裝','品檢','包裝','重做') then raise exception 'work_invalid'; end if;
  if found then
   if s.worker_id<>p_actor or s.order_id<>p_order or s.phase<>p_phase then raise exception 'work_conflict'; end if;
   return jsonb_build_object('id',s.id,'revision',s.revision,'state',s.state);
  end if;
  if not exists(select 1 from public.studio_orders where id=p_order and status in ('等待製作','製作中','品質檢查')) then raise exception 'work_order_not_ready'; end if;
  if exists(select 1 from public.studio_work_sessions where worker_id=p_actor and state<>'finished') then raise exception 'work_already_open'; end if;
  insert into public.studio_work_sessions(id,order_id,worker_id,phase,created_at) values(p_session,p_order,p_actor,p_phase,t) returning * into s;
  insert into public.studio_work_intervals(session_id,started_at) values(s.id,t);
 else
  if not found or s.worker_id<>p_actor or s.order_id<>p_order then raise exception 'forbidden'; end if;
  if p_expected is distinct from s.revision then raise exception 'work_conflict'; end if;
  if p_action='pause' and s.state='running' then
   update public.studio_work_intervals set ended_at=t where session_id=s.id and ended_at is null;
   if not found then raise exception 'work_conflict'; end if;
   update public.studio_work_sessions set state='paused',revision=revision+1 where id=s.id returning * into s;
  elsif p_action='resume' and s.state='paused' then
   if not exists(select 1 from public.studio_orders where id=p_order and status in ('等待製作','製作中','品質檢查')) then raise exception 'work_order_not_ready'; end if;
   insert into public.studio_work_intervals(session_id,started_at) values(s.id,t);
   update public.studio_work_sessions set state='running',revision=revision+1 where id=s.id returning * into s;
  elsif p_action='finish' and s.state in ('running','paused') then
   if s.state='running' then
    update public.studio_work_intervals set ended_at=t where session_id=s.id and ended_at is null;
    if not found then raise exception 'work_conflict'; end if;
   end if;
   update public.studio_work_sessions set state='finished',finished_at=t,revision=revision+1 where id=s.id returning * into s;
  else raise exception 'work_conflict';
  end if;
 end if;
 return jsonb_build_object('id',s.id,'revision',s.revision,'state',s.state);
end $$;

create function public.studio_work_snapshot(p_actor uuid,p_order uuid,p_day date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare member_role text; t timestamptz:=pg_catalog.statement_timestamp(); day_start timestamptz; day_end timestamptz; active_work jsonb; phases jsonb; daily jsonb; own_daily jsonb; total_seconds numeric; active_count integer;
begin
 select role into member_role from public.studio_members where user_id=p_actor and active and role in ('owner','staff');
 if member_role is null then raise exception 'forbidden'; end if;
 if p_order is not null and not exists(select 1 from public.studio_orders where id=p_order) then raise exception 'work_invalid'; end if;
 if p_day is null then p_day:=(t at time zone 'Asia/Taipei')::date; end if;
 day_start:=p_day::timestamp at time zone 'Asia/Taipei'; day_end:=(p_day+1)::timestamp at time zone 'Asia/Taipei';
 select jsonb_build_object('id',s.id,'orderId',s.order_id,'receipt',o.receipt,'phase',s.phase,'state',s.state,'revision',s.revision,
 'seconds',coalesce((select sum(extract(epoch from (coalesce(i.ended_at,t)-i.started_at))) from public.studio_work_intervals i where i.session_id=s.id),0))
 into active_work from public.studio_work_sessions s join public.studio_orders o on o.id=s.order_id where s.worker_id=p_actor and s.state<>'finished';
 select coalesce(jsonb_agg(to_jsonb(x) order by x.phase),'[]'::jsonb),coalesce(sum(x.seconds),0),coalesce(sum(x.running),0)::integer into phases,total_seconds,active_count
 from (select s.phase,coalesce(sum(extract(epoch from (coalesce(i.ended_at,t)-i.started_at))),0) as seconds,count(*) filter(where i.ended_at is null) as running
 from public.studio_work_sessions s join public.studio_work_intervals i on i.session_id=s.id where s.order_id=p_order group by s.phase) x;
 select jsonb_build_object('seconds',coalesce(sum(extract(epoch from (least(coalesce(i.ended_at,t),day_end)-greatest(i.started_at,day_start)))),0),'orders',count(distinct s.order_id),'sessions',count(distinct s.id))
 into own_daily from public.studio_work_sessions s join public.studio_work_intervals i on i.session_id=s.id
 where s.worker_id=p_actor and i.started_at<day_end and coalesce(i.ended_at,t)>day_start and coalesce(i.ended_at,t)>i.started_at and i.started_at<t;
 if member_role='owner' then
  select jsonb_build_object('seconds',coalesce(sum(extract(epoch from (least(coalesce(i.ended_at,t),day_end)-greatest(i.started_at,day_start)))),0),'orders',count(distinct s.order_id),'workers',count(distinct s.worker_id))
  into daily from public.studio_work_sessions s join public.studio_work_intervals i on i.session_id=s.id
  where i.started_at<day_end and coalesce(i.ended_at,t)>day_start and coalesce(i.ended_at,t)>i.started_at and i.started_at<t;
 end if;
 return jsonb_build_object('configured',true,'serverNow',t,'day',p_day,'active',active_work,'phases',phases,'totalSeconds',total_seconds,'runningCount',active_count,'ownDaily',own_daily,'teamDaily',daily);
end $$;
revoke all on function public.studio_work_command(uuid,uuid,uuid,integer,text,text),public.studio_work_snapshot(uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.studio_work_command(uuid,uuid,uuid,integer,text,text),public.studio_work_snapshot(uuid,uuid,date) to service_role;
commit;
