-- Apply after 003. No existing ARC, prayer, event, or member records are deleted.
-- Deploy the matching API code and configure the server secret before using forms.
begin;

create schema if not exists arc_private;
revoke all on schema arc_private from public, anon, authenticated;

-- Move implementations out of the exposed API schema. Revoke inherited grants,
-- including authenticated administrators: all public submissions use our server.
alter function public.submit_arc_reflection(text,jsonb) set schema arc_private;
alter function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) set schema arc_private;
revoke all on function arc_private.submit_arc_reflection(text,jsonb) from public, anon, authenticated, service_role;
revoke all on function arc_private.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) from public, anon, authenticated, service_role;

-- No blank-token bypass, including direct calls by a server client.
create or replace function public.resolve_event(p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_event uuid;
begin
  if p_token is null or char_length(p_token) not between 24 and 160 then
    raise exception 'Active church QR link required' using errcode = '22023';
  end if;
  select q.event_id into v_event from public.qr_tokens q
  join public.events e on e.id = q.event_id
  where q.token = p_token and q.active and e.active and e.event_type = 'sunday_service'
    and (q.expires_at is null or q.expires_at > statement_timestamp()) limit 1;
  if v_event is null then raise exception 'Active church QR link required' using errcode = '22023'; end if;
  return v_event;
end $$;
revoke all on function public.resolve_event(text) from public, anon, authenticated, service_role;

create function public.submit_arc_reflection(p_event_token text, p_entries jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if extract(isodow from statement_timestamp() at time zone 'Asia/Manila') <> 7 then
    raise exception 'ARC is open on Sundays in Philippine time only' using errcode = '22023';
  end if;
  perform public.resolve_event(p_event_token);
  return arc_private.submit_arc_reflection(p_event_token, p_entries);
end $$;

create function public.submit_prayer_request(
  p_event_token text, p_name text, p_is_anonymous boolean, p_request text,
  p_category text, p_visibility text, p_contact text, p_contact_consent boolean, p_share_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform public.resolve_event(p_event_token);
  return arc_private.submit_prayer_request(p_event_token,p_name,p_is_anonymous,p_request,
    p_category,p_visibility,p_contact,p_contact_consent,p_share_consent);
end $$;

revoke all on function public.submit_arc_reflection(text,jsonb) from public, anon, authenticated;
revoke all on function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.register_for_event(text,uuid,text,text,text,boolean) from public, anon, authenticated;
revoke all on function public.check_public_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.submit_arc_reflection(text,jsonb) to service_role;
grant execute on function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) to service_role;
grant execute on function public.register_for_event(text,uuid,text,text,text,boolean) to service_role;
grant execute on function public.check_public_rate_limit(text,text,integer,integer) to service_role;

-- Actual Sunday attendance is separate from advance event registration and ARC.
create table public.sunday_attendance (
  member_id uuid not null references public.members(id) on delete cascade,
  sunday_date date not null check (extract(isodow from sunday_date) = 7),
  present boolean not null,
  recorded_by uuid not null references public.admin_profiles(id),
  updated_at timestamptz not null default now(),
  primary key (sunday_date, member_id)
);
comment on table public.sunday_attendance is 'Admin-recorded member attendance. Never link this table to anonymous ARC submissions or entries.';
alter table public.sunday_attendance enable row level security;
revoke all on public.sunday_attendance from public, anon, authenticated;
grant select on public.sunday_attendance to authenticated;
create policy sunday_attendance_read on public.sunday_attendance for select to authenticated
  using(public.has_role(array['super_admin','membership_admin']));

create function public.save_sunday_attendance(p_member_id uuid, p_sunday date, p_present boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(array['super_admin','membership_admin']) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_sunday is null or extract(isodow from p_sunday) <> 7
    or p_sunday > (statement_timestamp() at time zone 'Asia/Manila')::date
    or p_present is null then raise exception 'Choose a current or past Sunday' using errcode = '22023'; end if;
  if not exists(select 1 from public.members where id=p_member_id and not archived) then
    raise exception 'Member unavailable' using errcode = '22023';
  end if;
  insert into public.sunday_attendance(member_id,sunday_date,present,recorded_by)
    values(p_member_id,p_sunday,p_present,auth.uid())
    on conflict(sunday_date,member_id) do update set present=excluded.present,
      recorded_by=auth.uid(),updated_at=now();
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(auth.uid(),'attendance_recorded','member',p_member_id,
      jsonb_build_object('sunday',p_sunday,'present',p_present));
end $$;
revoke all on function public.save_sunday_attendance(uuid,date,boolean) from public, anon;
grant execute on function public.save_sunday_attendance(uuid,date,boolean) to authenticated;

commit;
