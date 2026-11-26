-- Run after studio_v50.sql. Small private JPEG QC photographs.
begin;
create table public.studio_order_photos (
 order_id uuid primary key references public.studio_orders(id) on delete cascade,
 jpeg text not null check(length(jpeg)<=700000 and jpeg ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$'),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
alter table public.studio_order_photos enable row level security;
revoke all on public.studio_order_photos from anon,authenticated;
grant select on public.studio_order_photos to authenticated;
create policy studio_photo_read on public.studio_order_photos for select to authenticated using(public.studio_has_role());
create function public.studio_set_photo(p_id uuid,p_expected integer,p_jpeg text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 if not public.studio_has_role() then raise exception 'forbidden'; end if;
 if p_jpeg is not null and (length(p_jpeg)>700000 or p_jpeg !~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$') then raise exception 'invalid_photo'; end if;
 update public.studio_orders set revision=revision+1,updated_at=now()
 where id=p_id and revision=p_expected returning revision into v;
 if not found then raise exception 'version_conflict'; end if;
 if p_jpeg is null then delete from public.studio_order_photos where order_id=p_id;
 else insert into public.studio_order_photos(order_id,jpeg,updated_by) values(p_id,p_jpeg,auth.uid())
 on conflict(order_id) do update set jpeg=excluded.jpeg,updated_at=now(),updated_by=excluded.updated_by;
 end if;
 return jsonb_build_object('id',p_id,'revision',v);
end $$;
revoke all on function public.studio_set_photo(uuid,integer,text) from public,anon;
grant execute on function public.studio_set_photo(uuid,integer,text) to authenticated;
commit;
