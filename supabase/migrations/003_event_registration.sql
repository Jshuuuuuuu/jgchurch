-- Add event-specific registration without linking identities to ARC feedback.
-- Apply after 001 and 002. Existing events keep the Sunday Service flow.
begin;

alter table public.events
  add column event_type text not null default 'sunday_service'
    check (event_type in ('sunday_service', 'midweek_prayer', 'extracurricular')),
  add column location text check (char_length(location) <= 500),
  add constraint registration_event_details check (
    event_type = 'sunday_service' or
    (location is not null and char_length(btrim(location)) > 0 and starts_at is not null)
  ),
  add constraint extracurricular_duration check (
    event_type <> 'extracurricular' or (ends_at is not null and ends_at > starts_at)
  );

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  request_key uuid not null unique,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  contact text check (contact is null or char_length(btrim(contact)) between 1 and 255),
  transport text check (transport in ('own', 'pickup')),
  consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
comment on table public.event_registrations is
  'Advance attendance intentions, not arrival check-ins or membership records. Never join participant identities to anonymous ARC feedback.';
create index event_registrations_event_idx on public.event_registrations(event_id, created_at desc);
alter table public.event_registrations enable row level security;
revoke all on public.event_registrations from anon, authenticated;
grant select on public.event_registrations to authenticated;
create policy registration_organizer_read on public.event_registrations
  for select to authenticated
  using (public.has_role(array['super_admin', 'ministry_leader']));

-- Only safe event information is public through an active, unexpired QR token.
-- No attendees, contact details, creator identity, or private notes are returned.
create function public.get_registration_event(p_token text)
returns table(name text, event_type text, location text, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select e.name, e.event_type, e.location, e.starts_at, e.ends_at
  from public.qr_tokens q join public.events e on e.id = q.event_id
  where q.token = p_token and q.active and e.active
    and (q.expires_at is null or q.expires_at > now())
  limit 1
$$;
revoke all on function public.get_registration_event(text) from public;
grant execute on function public.get_registration_event(text) to anon, authenticated;

-- ARC/prayer tokens remain Sunday Service only; generic anonymous forms still work.
create or replace function public.resolve_event(p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_event uuid;
begin
  if p_token is null or p_token = '' then return null; end if;
  select q.event_id into v_event
  from public.qr_tokens q join public.events e on e.id = q.event_id
  where q.token = p_token and q.active and e.active
    and e.event_type = 'sunday_service'
    and (q.expires_at is null or q.expires_at > now()) limit 1;
  if v_event is null then raise exception 'Invalid or expired Sunday Service token'; end if;
  return v_event;
end $$;

alter table public.public_rate_limits drop constraint public_rate_limits_scope_check;
alter table public.public_rate_limits add constraint public_rate_limits_scope_check
  check (scope in ('arc', 'prayer', 'registration'));
create or replace function public.check_public_rate_limit(
  p_key_hash text, p_scope text, p_limit integer, p_window_minutes integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_window timestamptz; v_count integer;
begin
  if p_key_hash is null or length(p_key_hash) <> 64
    or p_scope is null or p_scope not in ('arc', 'prayer', 'registration')
    or p_limit is null or p_limit < 1
    or p_window_minutes is null or p_window_minutes not between 1 and 60 then
    return false;
  end if;
  v_window := date_trunc('minute', now()) -
    ((floor(extract(minute from now()))::int % p_window_minutes) * interval '1 minute');
  delete from public.public_rate_limits where window_start < now() - interval '1 day';
  insert into public.public_rate_limits(key_hash, scope, window_start, request_count)
    values(p_key_hash, p_scope, v_window, 1)
  on conflict(key_hash, scope, window_start) do update
    set request_count = public.public_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end $$;

create function public.register_for_event(
  p_token text, p_request_key uuid, p_name text, p_contact text,
  p_transport text, p_consent boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_type text; v_id uuid;
begin
  select e.id, e.event_type into v_event, v_type
  from public.qr_tokens q join public.events e on e.id = q.event_id
  where q.token = p_token and q.active and e.active
    and (q.expires_at is null or q.expires_at > now())
  limit 1 for share of e, q;
  if v_event is null or v_type not in ('midweek_prayer', 'extracurricular') then
    raise exception 'Registration unavailable for this event' using errcode = '22023';
  end if;
  if p_request_key is null or p_name is null
    or char_length(btrim(p_name)) not between 2 and 120
    or char_length(coalesce(p_contact, '')) > 255
    or p_consent is distinct from true then
    raise exception 'Invalid registration' using errcode = '22023';
  end if;
  if v_type = 'midweek_prayer' and (p_transport is null or p_transport not in ('own', 'pickup')) then
    raise exception 'Choose transportation' using errcode = '22023';
  end if;
  if v_type = 'extracurricular' and
    (nullif(btrim(p_contact), '') is null or p_transport is not null) then
    raise exception 'Contact is required; transportation is not used for this event' using errcode = '22023';
  end if;
  -- Retrying the same form cannot create an extra attendance entry.
  insert into public.event_registrations(event_id, request_key, name, contact, transport, consent)
    values(v_event, p_request_key, btrim(p_name), nullif(btrim(p_contact), ''), p_transport, true)
    on conflict(request_key) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.event_registrations
    where request_key = p_request_key and event_id = v_event
      and name = btrim(p_name) and contact is not distinct from nullif(btrim(p_contact), '')
      and transport is not distinct from p_transport;
    if v_id is null then raise exception 'Registration retry does not match' using errcode = '22023'; end if;
  end if;
  return v_id;
end $$;
revoke all on function public.register_for_event(text, uuid, text, text, text, boolean) from public;
grant execute on function public.register_for_event(text, uuid, text, text, text, boolean) to anon, authenticated;

-- Create the event and its QR together, so neither can be left half-created.
create function public.create_event_with_qr(
  p_name text, p_event_type text, p_location text, p_starts_at timestamptz,
  p_ends_at timestamptz, p_expires_at timestamptz, p_token text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.has_role(array['super_admin', 'ministry_leader']) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_ends_at is not null and (p_starts_at is null or p_ends_at <= p_starts_at) then
    raise exception 'End must be after start' using errcode = '22023';
  end if;
  insert into public.events(name, event_type, location, starts_at, ends_at, created_by)
    values(btrim(p_name), p_event_type, nullif(btrim(p_location), ''), p_starts_at, p_ends_at, auth.uid())
    returning id into v_id;
  insert into public.qr_tokens(event_id, token, expires_at) values(v_id, p_token, p_expires_at);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values(auth.uid(), 'created', 'event', v_id, jsonb_build_object('event_type', p_event_type));
  return v_id;
end $$;
revoke all on function public.create_event_with_qr(text, text, text, timestamptz, timestamptz, timestamptz, text) from public;
grant execute on function public.create_event_with_qr(text, text, text, timestamptz, timestamptz, timestamptz, text) to authenticated;

commit;
