-- ARC production schema. Apply with Supabase CLI: supabase db push
create extension if not exists pgcrypto;

create type public.arc_entry_type as enum ('affirmation','recommendation','correction');
create type public.arc_entry_status as enum ('unread','reviewed','in_progress','resolved');
create type public.prayer_status as enum ('new','being_prayed_for','followup_requested','closed');
create type public.prayer_visibility as enum ('prayer_team','leader_only','congregation_review');
create type public.member_status as enum ('regular','new','visitor','inactive');

create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('super_admin','ministry_leader','prayer_team','membership_admin')),
  description text not null default ''
);
create table public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role_id uuid not null references public.admin_roles(id),
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.admin_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);
create table public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token text not null unique check (char_length(token) between 24 and 160),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.ministry_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);
create table public.arc_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.arc_submissions is 'Anonymous container. Never add participant identity, auth user, IP, or member fields.';
create table public.arc_entries (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.arc_submissions(id) on delete cascade,
  type public.arc_entry_type not null,
  ministry_area_id uuid not null references public.ministry_areas(id),
  content text not null check (char_length(btrim(content)) between 10 and 4000),
  status public.arc_entry_status not null default 'unread',
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, type)
);
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  name text check (char_length(name) <= 120),
  is_anonymous boolean not null default false,
  request text not null check (char_length(btrim(request)) between 10 and 5000),
  category text not null check (category in ('Personal / Spiritual Growth','Family','Health and Healing','Financial Provision','Academics / Career','Thanksgiving','Others')),
  visibility public.prayer_visibility not null,
  contact_info text check (char_length(contact_info) <= 255),
  contact_consent boolean not null default false,
  share_consent boolean not null default false,
  sharing_approved boolean not null default false,
  status public.prayer_status not null default 'new',
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_info is null or contact_consent),
  check (visibility <> 'congregation_review' or share_consent),
  check (not is_anonymous or name is null),
  check (not sharing_approved or (visibility = 'congregation_review' and share_consent))
);
create table public.prayer_followups (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid not null references public.prayer_requests(id) on delete cascade,
  admin_id uuid not null default auth.uid() references public.admin_profiles(id),
  action_type text not null,
  notes text not null check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);
create sequence public.member_number_seq start 1001;
create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_number text unique,
  first_name text not null,
  middle_name text,
  last_name text not null,
  birthdate date,
  contact_number text not null,
  email text,
  address text,
  status public.member_status not null default 'new',
  date_joined date,
  administrative_notes text,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.member_ministries (
  member_id uuid not null references public.members(id) on delete cascade,
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  primary key (member_id, ministry_id)
);
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null default auth.uid() references public.admin_profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.admin_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.public_rate_limits (
  key_hash text not null,
  scope text not null check (scope in ('arc','prayer')),
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (key_hash, scope, window_start)
);

create index arc_submissions_created_idx on public.arc_submissions(created_at desc);
create index arc_submissions_event_idx on public.arc_submissions(event_id);
create index arc_entries_filters_idx on public.arc_entries(type,status,ministry_area_id,created_at desc) where not archived;
create index arc_entries_content_search_idx on public.arc_entries using gin(to_tsvector('english',content));
create index prayer_filters_idx on public.prayer_requests(status,category,created_at desc) where not archived;
create index members_name_idx on public.members(last_name,first_name) where not archived;
create index members_status_idx on public.members(status) where not archived;
create index audit_entity_idx on public.audit_logs(entity_type,entity_id,created_at desc);
create index qr_token_lookup_idx on public.qr_tokens(token) where active;

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger admin_profiles_updated before update on public.admin_profiles for each row execute function public.set_updated_at();
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();
create trigger arc_entries_updated before update on public.arc_entries for each row execute function public.set_updated_at();
create trigger prayer_requests_updated before update on public.prayer_requests for each row execute function public.set_updated_at();
create trigger members_updated before update on public.members for each row execute function public.set_updated_at();
create function public.assign_member_number() returns trigger language plpgsql set search_path = '' as $$ begin if new.member_number is null then new.member_number := 'ARC-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.member_number_seq')::text,5,'0'); end if; return new; end $$;
create trigger members_number before insert on public.members for each row execute function public.assign_member_number();

insert into public.admin_roles(name,description) values
 ('super_admin','Full administration'),('ministry_leader','ARC feedback and events'),('prayer_team','Restricted prayer care'),('membership_admin','Member directory');
insert into public.ministry_areas(id,name,sort_order) values
 ('00000000-0000-4000-8000-000000000001','Worship',10),('00000000-0000-4000-8000-000000000002','Multimedia',20),('00000000-0000-4000-8000-000000000003','Ushering',30),('00000000-0000-4000-8000-000000000004','Preaching / Teaching',40),('00000000-0000-4000-8000-000000000005','Youth Ministry',50),('00000000-0000-4000-8000-000000000006','Prayer Ministry',60),('00000000-0000-4000-8000-000000000007','Program Flow',70),('00000000-0000-4000-8000-000000000008','Facilities',80),('00000000-0000-4000-8000-000000000009','Communications',90),('00000000-0000-4000-8000-000000000010','Leadership',100),('00000000-0000-4000-8000-000000000011','Others',110);
insert into public.ministries(name) select name from public.ministry_areas where name <> 'Others';

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.admin_profiles where id=auth.uid() and is_active) $$;
create function public.has_role(roles text[]) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.admin_profiles p join public.admin_roles r on r.id=p.role_id where p.id=auth.uid() and p.is_active and r.name=any(roles)) $$;
revoke all on function public.is_admin() from public;
revoke all on function public.has_role(text[]) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_role(text[]) to authenticated;

create function public.resolve_event(p_token text) returns uuid language plpgsql stable security definer set search_path = '' as $$ declare v_event uuid; begin if p_token is null or p_token='' then return null; end if; select q.event_id into v_event from public.qr_tokens q join public.events e on e.id=q.event_id where q.token=p_token and q.active and e.active and (q.expires_at is null or q.expires_at>now()) limit 1; if v_event is null then raise exception 'Invalid or expired event token'; end if; return v_event; end $$;
create function public.check_public_rate_limit(p_key_hash text,p_scope text,p_limit integer,p_window_minutes integer) returns boolean language plpgsql security definer set search_path = '' as $$ declare v_window timestamptz := date_trunc('minute',now()) - ((extract(minute from now())::int % p_window_minutes) * interval '1 minute'); v_count int; begin if length(p_key_hash)<>64 or p_scope not in ('arc','prayer') or p_limit<1 then return false; end if; delete from public.public_rate_limits where window_start<now()-interval '1 day'; insert into public.public_rate_limits(key_hash,scope,window_start,request_count) values(p_key_hash,p_scope,v_window,1) on conflict(key_hash,scope,window_start) do update set request_count=public.public_rate_limits.request_count+1 returning request_count into v_count; return v_count<=p_limit; end $$;
create function public.submit_arc_reflection(p_event_token text,p_entries jsonb) returns uuid language plpgsql security definer set search_path = '' as $$ declare v_submission uuid; v_count int; begin if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries) not between 1 and 3 then raise exception 'Invalid entries'; end if; select count(*) into v_count from jsonb_to_recordset(p_entries) as x(type text,"ministryAreaId" uuid,content text) where x.type in ('affirmation','recommendation','correction') and char_length(btrim(x.content)) between 10 and 4000 and exists(select 1 from public.ministry_areas m where m.id=x."ministryAreaId" and m.active) having count(*)=count(distinct x.type); if coalesce(v_count,0)<>jsonb_array_length(p_entries) then raise exception 'Invalid entries'; end if; insert into public.arc_submissions(event_id) values(public.resolve_event(p_event_token)) returning id into v_submission; insert into public.arc_entries(submission_id,type,ministry_area_id,content) select v_submission,x.type::public.arc_entry_type,x."ministryAreaId",btrim(x.content) from jsonb_to_recordset(p_entries) as x(type text,"ministryAreaId" uuid,content text); return v_submission; end $$;
create function public.submit_prayer_request(p_event_token text,p_name text,p_is_anonymous boolean,p_request text,p_category text,p_visibility text,p_contact text,p_contact_consent boolean,p_share_consent boolean) returns uuid language plpgsql security definer set search_path = '' as $$ declare v_id uuid; begin if char_length(btrim(p_request)) not between 10 and 5000 or p_visibility not in ('prayer_team','leader_only','congregation_review') or p_category not in ('Personal / Spiritual Growth','Family','Health and Healing','Financial Provision','Academics / Career','Thanksgiving','Others') or (p_contact is not null and not p_contact_consent) or (p_visibility='congregation_review' and not p_share_consent) then raise exception 'Invalid request'; end if; insert into public.prayer_requests(event_id,name,is_anonymous,request,category,visibility,contact_info,contact_consent,share_consent) values(public.resolve_event(p_event_token),case when p_is_anonymous then null else nullif(btrim(p_name),'') end,p_is_anonymous,btrim(p_request),p_category,p_visibility::public.prayer_visibility,case when p_contact_consent then nullif(btrim(p_contact),'') end,p_contact_consent,p_share_consent) returning id into v_id; return v_id; end $$;
revoke all on function public.resolve_event(text) from public;
revoke all on function public.check_public_rate_limit(text,text,integer,integer) from public;
revoke all on function public.submit_arc_reflection(text,jsonb) from public;
revoke all on function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) from public;
grant execute on function public.check_public_rate_limit(text,text,integer,integer) to anon;
grant execute on function public.submit_arc_reflection(text,jsonb) to anon;
grant execute on function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) to anon;

create function public.dashboard_daily_trend(p_days integer default 14) returns table(day text,arc bigint,prayer bigint) language sql stable security definer set search_path = '' as $$ with days as (select generate_series(current_date-greatest(1,least(p_days,365))+1,current_date,'1 day')::date d), a as (select created_at::date d,count(*) c from public.arc_submissions where created_at>=current_date-greatest(1,least(p_days,365))+1 group by 1), p as (select created_at::date d,count(*) c from public.prayer_requests where created_at>=current_date-greatest(1,least(p_days,365))+1 group by 1) select to_char(days.d,'Mon DD'),coalesce(a.c,0),coalesce(p.c,0) from days left join a using(d) left join p using(d) order by days.d $$;
create function public.arc_category_counts(p_days integer default 30) returns table(label text,count bigint) language sql stable security definer set search_path = '' as $$ select type::text,count(*) from public.arc_entries where created_at>=current_date-greatest(1,least(p_days,365))+1 group by type order by type $$;
create function public.ministry_entry_counts(p_days integer default 30) returns table(label text,count bigint) language sql stable security definer set search_path = '' as $$ select m.name,count(e.*) from public.ministry_areas m left join public.arc_entries e on e.ministry_area_id=m.id and e.created_at>=current_date-greatest(1,least(p_days,365))+1 group by m.id order by count(e.*) desc $$;
revoke all on function public.dashboard_daily_trend(integer) from public;
revoke all on function public.arc_category_counts(integer) from public;
revoke all on function public.ministry_entry_counts(integer) from public;
grant execute on function public.dashboard_daily_trend(integer),public.arc_category_counts(integer),public.ministry_entry_counts(integer) to authenticated;

alter table public.admin_roles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.events enable row level security;
alter table public.qr_tokens enable row level security;
alter table public.ministry_areas enable row level security;
alter table public.arc_submissions enable row level security;
alter table public.arc_entries enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_followups enable row level security;
alter table public.members enable row level security;
alter table public.ministries enable row level security;
alter table public.member_ministries enable row level security;
alter table public.admin_actions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.public_rate_limits enable row level security;

create policy roles_read on public.admin_roles for select to authenticated using(public.is_admin());
create policy profiles_read on public.admin_profiles for select to authenticated using(id=auth.uid() or public.has_role(array['super_admin']));
create policy profiles_super_all on public.admin_profiles for all to authenticated using(public.has_role(array['super_admin'])) with check(public.has_role(array['super_admin']));
create policy event_read on public.events for select to authenticated using(public.is_admin());
create policy event_manage on public.events for all to authenticated using(public.has_role(array['super_admin','ministry_leader'])) with check(public.has_role(array['super_admin','ministry_leader']));
create policy qr_read on public.qr_tokens for select to authenticated using(public.is_admin());
create policy qr_manage on public.qr_tokens for all to authenticated using(public.has_role(array['super_admin','ministry_leader'])) with check(public.has_role(array['super_admin','ministry_leader']));
create policy areas_public_read on public.ministry_areas for select to anon,authenticated using(active or public.is_admin());
create policy areas_manage on public.ministry_areas for all to authenticated using(public.has_role(array['super_admin'])) with check(public.has_role(array['super_admin']));
create policy arc_sub_read on public.arc_submissions for select to authenticated using(public.has_role(array['super_admin','ministry_leader']));
create policy arc_entry_manage on public.arc_entries for all to authenticated using(public.has_role(array['super_admin','ministry_leader'])) with check(public.has_role(array['super_admin','ministry_leader']));
create policy prayer_manage on public.prayer_requests for all to authenticated using(public.has_role(array['super_admin','prayer_team'])) with check(public.has_role(array['super_admin','prayer_team']));
create policy followup_manage on public.prayer_followups for all to authenticated using(public.has_role(array['super_admin','prayer_team'])) with check(public.has_role(array['super_admin','prayer_team']));
create policy member_manage on public.members for all to authenticated using(public.has_role(array['super_admin','membership_admin'])) with check(public.has_role(array['super_admin','membership_admin']));
create policy ministry_read on public.ministries for select to authenticated using(public.has_role(array['super_admin','membership_admin']));
create policy ministry_manage on public.ministries for all to authenticated using(public.has_role(array['super_admin'])) with check(public.has_role(array['super_admin']));
create policy member_ministry_manage on public.member_ministries for all to authenticated using(public.has_role(array['super_admin','membership_admin'])) with check(public.has_role(array['super_admin','membership_admin']));
create policy action_manage on public.admin_actions for all to authenticated using(admin_id=auth.uid() or public.has_role(array['super_admin'])) with check(admin_id=auth.uid());
create policy audit_read on public.audit_logs for select to authenticated using(public.has_role(array['super_admin']));
create policy audit_insert on public.audit_logs for insert to authenticated with check(actor_id=auth.uid() and public.is_admin());

-- Retention helper: schedule with pg_cron after choosing church policy.
create function public.apply_retention(p_arc_months integer,p_prayer_months integer,p_audit_months integer) returns void language plpgsql security definer set search_path = '' as $$ begin if not public.has_role(array['super_admin']) then raise exception 'Forbidden'; end if; delete from public.arc_submissions where created_at<now()-make_interval(months=>p_arc_months); delete from public.prayer_requests where created_at<now()-make_interval(months=>p_prayer_months); delete from public.audit_logs where created_at<now()-make_interval(months=>p_audit_months); end $$;
revoke all on function public.apply_retention(integer,integer,integer) from public;
grant execute on function public.apply_retention(integer,integer,integer) to authenticated;

-- Authenticated administrators may also use public forms without bypassing validation.
grant execute on function public.check_public_rate_limit(text,text,integer,integer) to authenticated;
grant execute on function public.submit_arc_reflection(text,jsonb) to authenticated;
grant execute on function public.submit_prayer_request(text,text,boolean,text,text,text,text,boolean,boolean) to authenticated;

-- Aggregate functions bypass content RLS, so require an active administrator profile.
create function public.assert_admin() returns void language plpgsql stable security definer set search_path = '' as $$ begin if not public.is_admin() then raise exception 'Forbidden'; end if; end $$;
revoke all on function public.assert_admin() from public;

create or replace function public.dashboard_daily_trend(p_days integer default 14) returns table(day text,arc bigint,prayer bigint) language plpgsql stable security definer set search_path = '' as $$ begin perform public.assert_admin(); return query with days as (select generate_series(current_date-greatest(1,least(p_days,365))+1,current_date,'1 day')::date d), a as (select created_at::date d,count(*) c from public.arc_submissions where created_at>=current_date-greatest(1,least(p_days,365))+1 group by 1), p as (select created_at::date d,count(*) c from public.prayer_requests where created_at>=current_date-greatest(1,least(p_days,365))+1 group by 1) select to_char(days.d,'Mon DD'),coalesce(a.c,0),coalesce(p.c,0) from days left join a using(d) left join p using(d) order by days.d; end $$;
create or replace function public.arc_category_counts(p_days integer default 30) returns table(label text,count bigint) language plpgsql stable security definer set search_path = '' as $$ begin perform public.assert_admin(); return query select type::text,count(*) from public.arc_entries where created_at>=current_date-greatest(1,least(p_days,365))+1 group by type order by type; end $$;
create or replace function public.ministry_entry_counts(p_days integer default 30) returns table(label text,count bigint) language plpgsql stable security definer set search_path = '' as $$ begin perform public.assert_admin(); return query select m.name,count(e.*) from public.ministry_areas m left join public.arc_entries e on e.ministry_area_id=m.id and e.created_at>=current_date-greatest(1,least(p_days,365))+1 group by m.id order by count(e.*) desc; end $$;

create function public.dashboard_summary() returns jsonb language plpgsql stable security definer set search_path = '' as $$ declare v_start timestamptz := date_trunc('day',now()); begin perform public.assert_admin(); return jsonb_build_object('arc_submissions_today',(select count(*) from public.arc_submissions where created_at>=v_start),'arc_entries_today',(select count(*) from public.arc_entries where created_at>=v_start),'prayer_requests_today',(select count(*) from public.prayer_requests where created_at>=v_start),'members',(select count(*) from public.members where not archived),'pending_reviews',(select count(*) from public.arc_entries where not archived and status in ('unread','in_progress'))); end $$;
revoke all on function public.dashboard_summary() from public;
grant execute on function public.dashboard_summary() to authenticated;
